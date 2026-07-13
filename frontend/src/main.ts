import "./style.css";
import type { FishingState } from "@bomio/shared";
import { Net } from "./net.ts";
import { UI } from "./ui.ts";
import { InputController } from "./input.ts";
import { render, computePlayerVisualPosition, type Camera } from "./render.ts";
import { PlayerAnimator } from "./animation.ts";
import { WORLD_WIDTH, WORLD_HEIGHT } from "./config.ts";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = "";

const canvas = document.createElement("canvas");
canvas.className = "game-canvas";
app.appendChild(canvas);

const ctx = canvas.getContext("2d")!;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

const ui = new UI(app);

const net = new Net({
  onStatusChange: (status, detail) => {
    if (status === "connecting") {
      ui.setConnecting(true);
      ui.showError("");
    } else if (status === "connected") {
      ui.setConnecting(false);
      ui.showError("");
      ui.enterGame();
      ui.hideStatusBanner();
    } else if (status === "error") {
      ui.setConnecting(false);
      ui.showError(detail ?? "Không thể kết nối tới server.");
    } else if (status === "disconnected") {
      ui.showStatusBanner(detail ?? "Mất kết nối. Đang quay lại màn hình chính...");
      setTimeout(() => {
        ui.backToConnectScreen();
        ui.hideStatusBanner();
      }, 1500);
    }
  },
  onGameEvent: (event) => {
    if (event.type === "catch_result") {
      // Chỉ quan tâm catch_result của CHÍNH MÌNH — người chơi khác bắt được cá không còn hiện toast
      // ambient nữa (trước đây có "Ai đó vừa câu được...", bỏ theo yêu cầu, đỡ nhiễu HUD).
      if (event.playerId !== net.sessionId) return;
      if (event.success && event.speciesId) {
        ui.showCatchModal(event.speciesId, event.rarity, event.value ?? 0, event.isFirstCatch ?? false);
      } else if (event.reason === "fish_escaped") {
        ui.showToast("The fish got away... try again!", "danger");
      } else if (event.reason === "line_snapped") {
        ui.showToast("Line snapped! You reeled for too long — release the mouse periodically to ease tension.", "danger");
      }
    } else if (event.type === "cast_rejected" && event.reason === "too_far_from_lake") {
      ui.showToast("Stand closer to a lake or river shore to cast!", "warning");
    }
    // "fish_bite" is purely visual (see render.ts's drawBiteIndicator, driven straight off
    // fishState/biteExpiresAt in the synced snapshot) — no extra toast needed, it would just be
    // noisy given how often it fires.
  },
});

const input = new InputController(
  canvas,
  (message) => net.send(message),
  () => localPlayerScreenOrigin,
  () => latestLocalFishState,
);
// Modal câu cá che phủ canvas lúc đang mở (biting/reeling) — bắt thêm mousedown/mouseup/mouseleave
// ngay trên modal để móc câu/kéo cần hoạt động dù canvas bên dưới không còn nhận được sự kiện.
input.bindAdditionalTarget(ui.fishingModalInteractiveEl);

// Where the local player is actually drawn on screen this frame — mutated in frame() below.
let localPlayerScreenOrigin = { x: canvas.width / 2, y: canvas.height / 2 };
// Trạng thái câu cá hiện tại của local player — mutated in frame() below, đọc bởi InputController
// để quyết định chuột trái đang làm gì (cast/hook/reel).
let latestLocalFishState: FishingState = "idle";

ui.onPlay(async (name, skinId) => {
  if (net.status === "connected") {
    ui.enterGame();
    return;
  }
  try {
    await net.connect(name, skinId);
  } catch {
    // Status already reflects the error via onStatusChange; nothing else to do — keeps the
    // connect screen usable (graceful degradation) if the backend isn't reachable yet.
  }
});

// World is centered on the origin — camera starts at (0,0) before a player connects and
// immediately re-centers on the local player once joined (see frame() below).
const camera: Camera = { x: 0, y: 0, width: canvas.width, height: canvas.height };
const animator = new PlayerAnimator();

/** Keeps the camera's view rectangle fully inside the world — otherwise players near an edge
 * would see empty void past the boundary instead of standing at the edge of the visible lake. */
function clampCameraAxis(center: number, worldSize: number, viewportSize: number): number {
  const halfWorld = worldSize / 2;
  const halfViewport = viewportSize / 2;
  if (halfViewport >= halfWorld) return 0;
  return Math.min(halfWorld - halfViewport, Math.max(-halfWorld + halfViewport, center));
}

function frame() {
  const nowMs = Date.now();
  camera.width = canvas.width;
  camera.height = canvas.height;

  const snapshot = net.getSnapshot();
  const localPlayerId = net.sessionId;
  const localPlayer = snapshot.players.find((p) => p.id === localPlayerId) ?? null;

  animator.update(snapshot.players, nowMs);

  if (localPlayer) {
    const localVisual = computePlayerVisualPosition(localPlayer, animator.get(localPlayer.id));
    camera.x = localVisual.x;
    camera.y = localVisual.y;
  }
  camera.x = clampCameraAxis(camera.x, WORLD_WIDTH, camera.width);
  camera.y = clampCameraAxis(camera.y, WORLD_HEIGHT, camera.height);

  localPlayerScreenOrigin = localPlayer
    ? {
        x: animator.get(localPlayer.id).x - camera.x + camera.width / 2,
        y: animator.get(localPlayer.id).y - camera.y + camera.height / 2,
      }
    : { x: camera.width / 2, y: camera.height / 2 };
  latestLocalFishState = localPlayer?.fishState ?? "idle";

  if (net.status === "connected") {
    input.tick(nowMs);
  }

  render(ctx, {
    snapshot,
    camera,
    localPlayerId,
    nowMs,
    getPlayerAnimation: (playerId) => animator.get(playerId),
  });

  ui.updateLeaderboard(snapshot.leaderboard, localPlayerId);
  // Thanh tích lực quăng cần chỉ có ý nghĩa lúc đang rảnh tay (idle) — lúc đang câu, giữ chuột lại
  // mang nghĩa khác hẳn (móc câu/kéo cần), không phải đang tích lực quăng.
  ui.updateCastMeter(net.status === "connected" && latestLocalFishState === "idle" ? input.castChargeFraction : null);

  if (localPlayer) {
    ui.updateStats(localPlayer.caughtCount, localPlayer.totalValue);
    ui.updateCurrentLake(localPlayer.currentLakeId);
    ui.updateCollection(localPlayer.collection);

    ui.updateFishingModal(localPlayer.fishState === "reeling", {
      reelProgress: localPlayer.reelProgress,
      reelTension: localPlayer.reelTension,
      speciesId: localPlayer.activeFishSpeciesId,
      nowMs,
    });
  } else {
    ui.updateFishingModal(false);
  }
  ui.updateMinimap(snapshot.players, localPlayerId);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
