import "./style.css";
import type { FishingState } from "@bomio/shared";
import { Net } from "./net.ts";
import { UI } from "./ui.ts";
import { InputController } from "./input.ts";
import { render, computePlayerVisualPosition, spawnCastSplash, type Camera } from "./render.ts";
import { ReelSim } from "./reelSim.ts";
import { PlayerAnimator } from "./animation.ts";
import { WORLD_WIDTH, WORLD_HEIGHT } from "./config.ts";
import { audioManager } from "./audio.ts";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = "";

const canvas = document.createElement("canvas");
canvas.className = "game-canvas";
app.appendChild(canvas);

const ctx = canvas.getContext("2d")!;

// Initialize/resume AudioContext on first user gesture
const initAudio = () => {
  audioManager.init();
};
window.addEventListener("click", initAudio, { once: true, capture: true });
window.addEventListener("keydown", initAudio, { once: true, capture: true });

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
        ui.showCatchModal(event.speciesId, event.rarity, event.value ?? 0, event.weight ?? 0, event.isFirstCatch ?? false);
        audioManager.playCatch(event.rarity ?? "common");
      } else if (event.reason === "fish_escaped") {
        ui.showToast("The fish got away... try again!", "danger");
        audioManager.playEscape();
      }
    } else if (event.type === "cast_rejected" && event.reason === "too_far_from_lake") {
      ui.showToast("Stand closer to a lake or river shore to cast!", "warning");
      audioManager.playReject();
    } else if (event.type === "fish_bite" && event.playerId === net.sessionId) {
      audioManager.playBite();
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
  () => {
    const snapshot = net.getSnapshot();
    const localPlayer = snapshot.players.find((p) => p.id === net.sessionId);
    return { x: localPlayer ? localPlayer.x : 0, y: localPlayer ? localPlayer.y : 0 };
  },
);
// Modal câu cá che phủ canvas lúc đang mở (biting/reeling) — bắt thêm mousedown/mouseup/mouseleave
// ngay trên modal để móc câu/kéo cần hoạt động dù canvas bên dưới không còn nhận được sự kiện.
input.bindAdditionalTarget(ui.fishingModalInteractiveEl);

// Where the local player is actually drawn on screen this frame — mutated in frame() below.
let localPlayerScreenOrigin = { x: canvas.width / 2, y: canvas.height / 2 };
// Trạng thái câu cá hiện tại của local player — mutated in frame() below, đọc bởi InputController
// để quyết định chuột trái đang làm gì (cast/hook/reel).
let latestLocalFishState: FishingState = "idle";
let lastFishState: FishingState = "idle";
let lastWalkX = 0;
let lastWalkY = 0;
let lastStepTime = 0;
let lastReelClickTime = 0;
// Minigame kéo cá giờ chạy HOÀN TOÀN phía client (client-authoritative, giảm tải server — Vicent
// 2026-07-14): server không sim mỗi tick / không bắn reel_state nữa. Ta tự mô phỏng ở 60fps (mượt +
// phản hồi tức thì), hết giờ báo timeInZoneMs về server để clamp + roll (xem reelSim.ts + backend
// fishing.ts#resolveReel). lastReelFrameMs để tính delta thời gian frame; reelResultSent chặn gửi
// kết quả nhiều lần trong 1 phiên.
const reelSim = new ReelSim();
let lastReelFrameMs = 0;
let reelResultSent = false;

ui.onPlay(async (name, skinId) => {
  audioManager.init();
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

// Hệ số zoom map: camera nhìn vùng world rộng gấp MAP_ZOOM lần số pixel canvas rồi thu nhỏ cả cảnh
// lại cho vừa màn hình → thấy nhiều map hơn (Vicent 2026-07-14: "zoom sát quá, nhỏ map lại"). Tăng
// số này = nhìn xa hơn nữa. Chỉ ảnh hưởng hiển thị, không đụng logic/aim (input dùng atan2).
const MAP_ZOOM = 1.4;

// World is centered on the origin — camera starts at (0,0) before a player connects and
// immediately re-centers on the local player once joined (see frame() below).
const camera: Camera = { x: 0, y: 0, width: canvas.width * MAP_ZOOM, height: canvas.height * MAP_ZOOM, scale: 1 / MAP_ZOOM };
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
  // Virtual viewport = canvas × MAP_ZOOM; scale = tỉ lệ thu nhỏ về pixel thật (render.ts áp 1 lần).
  camera.width = canvas.width * MAP_ZOOM;
  camera.height = canvas.height * MAP_ZOOM;
  camera.scale = canvas.width / camera.width;

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

  // Gốc ngắm phải ở PIXEL THẬT (chuột là pixel thật) — nhân với camera.scale vì cảnh đã bị thu nhỏ.
  const camScale = camera.scale ?? 1;
  localPlayerScreenOrigin = localPlayer
    ? {
        x: (animator.get(localPlayer.id).x - camera.x) * camScale + canvas.width / 2,
        y: (animator.get(localPlayer.id).y - camera.y) * camScale + canvas.height / 2,
      }
    : { x: canvas.width / 2, y: canvas.height / 2 };
  latestLocalFishState = localPlayer?.fishState ?? "idle";

  // Audio system checks and dynamic SFX triggers
  if (localPlayer) {
    const currentFishState = localPlayer.fishState;
    
    // 1. Detect fishing state transitions.
    // Server resolves a cast synchronously — idle -> waiting in one step, no separate "casting"
    // state is ever actually set (xem backend/src/systems/fishing.ts#tryCast) — nên nhánh cũ chờ
    // fishState === "casting" không bao giờ chạy, và tiếng "tõm" phao rơi xuống nước (playSplash)
    // theo đó cũng không bao giờ phát. Fix: bắt đúng chuyển trạng thái idle -> waiting, phát tiếng
    // quăng cần ngay lập tức rồi tiếng phao rơi nước sau 1 khoảng trễ ngắn (giả lập thời gian phao
    // bay trong không trung) thay vì dựa vào 1 state không có thật.
    if (currentFishState !== lastFishState) {
      if (currentFishState === "waiting" && lastFishState === "idle") {
        audioManager.playCast();
        // Phao rơi xuống nước sau ~180ms bay trong không trung: đồng bộ tiếng splash + hiệu ứng
        // bắn nước tại đúng vị trí phao (vòng sóng lan + giọt nước văng, xem render.ts).
        const bx = localPlayer.bobberX;
        const by = localPlayer.bobberY;
        window.setTimeout(() => {
          audioManager.playSplash();
          spawnCastSplash(bx, by, Date.now());
        }, 180);
      }
      // Bắt đầu phiên kéo mới: khởi động sim client (start lười ở dưới nếu species chưa kịp sync).
      if (currentFishState === "reeling") {
        reelResultSent = false;
        lastReelFrameMs = 0;
        reelSim.stop();
      } else if (lastFishState === "reeling") {
        // Rời reeling (đã có kết quả): dừng sim.
        reelSim.stop();
        reelResultSent = false;
      }
      lastFishState = currentFishState;
    }

    // 2. Walk footsteps
    if (currentFishState === "idle") {
      const dx = localPlayer.x - lastWalkX;
      const dy = localPlayer.y - lastWalkY;
      const distMoved = Math.sqrt(dx * dx + dy * dy);
      if (distMoved > 0.05) {
        if (nowMs - lastStepTime > 280) {
          audioManager.playFootstep();
          lastStepTime = nowMs;
        }
      }
      lastWalkX = localPlayer.x;
      lastWalkY = localPlayer.y;
    }

    // 3. Reeling clicks (giữ chuột đẩy vùng bắt lên trong minigame "1 thanh")
    if (currentFishState === "reeling" && input.isReelHeld) {
      if (nowMs - lastReelClickTime > 90) {
        audioManager.playReelClick();
        lastReelClickTime = nowMs;
      }
    }

    // 4. Mô phỏng minigame kéo cá phía client (mượt 60fps). Start lười khi đã có loài cá sync về.
    if (currentFishState === "reeling") {
      if (!reelSim.active && localPlayer.activeFishSpeciesId) {
        reelSim.start(localPlayer.activeFishSpeciesId, localPlayer.activeFishWeight);
      }
      if (reelSim.active) {
        const dtMs = lastReelFrameMs > 0 ? Math.min(100, nowMs - lastReelFrameMs) : 0;
        reelSim.update(dtMs, input.isReelHeld);
        // Hết giờ: báo tổng thời gian cá trong vùng bắt về server (1 lần) để clamp + roll xác suất.
        if (reelSim.done && !reelResultSent) {
          net.send({ type: "reel_result", timeInZoneMs: reelSim.timeInZoneMs });
          reelResultSent = true;
        }
      }
      lastReelFrameMs = nowMs;
    }
  }

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

    // Vẽ modal thẳng từ sim client (chạy 60fps ở mục 4 phía trên) — mượt tuyệt đối, không còn phụ
    // thuộc nhịp mạng nên không cần nội suy như trước.
    ui.updateFishingModal(localPlayer.fishState === "reeling", {
      reelProgress: reelSim.progress,
      reelFishY: reelSim.fishY,
      reelZoneY: reelSim.zoneY,
      speciesId: localPlayer.activeFishSpeciesId,
      activeFishWeight: localPlayer.activeFishWeight,
      nowMs,
    });
  } else {
    ui.updateFishingModal(false);
  }
  ui.updateMinimap(snapshot.players, localPlayerId);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
