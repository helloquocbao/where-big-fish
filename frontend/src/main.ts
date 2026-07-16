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
import { initAnalytics, trackEvent } from "./analytics.ts";

// Initialize Google Analytics 4 (GA4)
initAnalytics();

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = "";

const canvas = document.createElement("canvas");
canvas.className = "game-canvas";
app.appendChild(canvas);

const ctx = canvas.getContext("2d")!;

// Logical (CSS) viewport size — all camera/aim math below works in these units (mouse events are also in CSS
// pixels). The canvas BACKING STORE is sized up by devicePixelRatio so rendering is crisp on HiDPI/Retina
// screens instead of being upscaled and blurry; render() applies the dpr scale to the drawing context.
let viewportW = window.innerWidth;
let viewportH = window.innerHeight;
let devicePixelRatioValue = window.devicePixelRatio || 1;

// Initialize/resume AudioContext on first user gesture
const initAudio = () => {
  audioManager.init();
};
window.addEventListener("click", initAudio, { once: true, capture: true });
window.addEventListener("keydown", initAudio, { once: true, capture: true });

function resizeCanvas() {
  viewportW = canvas.clientWidth || window.innerWidth;
  viewportH = canvas.clientHeight || window.innerHeight;
  devicePixelRatioValue = window.devicePixelRatio || 1;
  canvas.width = Math.round(viewportW * devicePixelRatioValue);
  canvas.height = Math.round(viewportH * devicePixelRatioValue);
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

const ui = new UI(app);

const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
if (isMobile) {
  document.body.classList.add("is-mobile");
}

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
      ui.showError(detail ?? "Unable to connect to the server.");
    } else if (status === "disconnected") {
      ui.showStatusBanner(detail ?? "Connection lost. Returning to main screen...");
      setTimeout(() => {
        ui.backToConnectScreen();
        ui.hideStatusBanner();
      }, 1500);
    }
  },
  onGameEvent: (event) => {
    if (event.type === "catch_result") {
      // Only care about catch_result of MYSELF — other players catching fish no longer show ambient
      // toast (previously there was "Someone just caught...", removed per request, reduces HUD noise).
      if (event.playerId !== net.sessionId) return;
      if (event.success && event.speciesId) {
        ui.showCatchModal(event.speciesId, event.rarity, event.value ?? 0, event.weight ?? 0, event.isFirstCatch ?? false);
        audioManager.playCatch(event.rarity ?? "common");
        trackEvent("catch_fish", {
          speciesId: event.speciesId,
          rarity: event.rarity,
          value: event.value ?? 0,
          weight: event.weight ?? 0,
          isFirstCatch: event.isFirstCatch ?? false
        });
      } else if (event.reason === "fish_escaped") {
        ui.showToast("The fish got away... try again!", "danger");
        audioManager.playEscape();
        trackEvent("fish_escape", { reason: event.reason });
      }
    } else if (event.type === "cast_rejected" && event.reason === "too_far_from_lake") {
      ui.showToast("Stand closer to a lake or river shore to cast!", "warning");
      audioManager.playReject();
      trackEvent("cast_rejected", { reason: event.reason });
    } else if (event.type === "fish_bite" && event.playerId === net.sessionId) {
      audioManager.playBite();
      trackEvent("fish_bite");
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
// Fishing modal covers the canvas when open (biting/reeling) — capture additional mousedown/mouseup/mouseleave
// directly on the modal so hooking/reeling works even if the canvas underneath no longer receives events.
input.bindAdditionalTarget(ui.fishingModalInteractiveEl);

// Where the local player is actually drawn on screen this frame — mutated in frame() below.
let localPlayerScreenOrigin = { x: viewportW / 2, y: viewportH / 2 };
// Current fishing state of the local player — mutated in frame() below, read by InputController
// to decide what left click is doing (cast/hook/reel).
let latestLocalFishState: FishingState = "idle";
let lastFishState: FishingState = "idle";
let lastWalkX = 0;
let lastWalkY = 0;
let lastStepTime = 0;
let lastReelClickTime = 0;
// Reeling minigame now runs ENTIRELY on the client side (client-authoritative, reduces server load — Vicent
// 2026-07-14): server doesn't simulate every tick / doesn't send reel_state anymore. We simulate it ourselves at 60fps (smooth +
// instant feedback), when time is up, report timeInZoneMs to the server for clamping + rolling (see reelSim.ts + backend
// fishing.ts#resolveReel). lastReelFrameMs is used to calculate frame time delta; reelResultSent prevents sending
// result multiple times in one session.
const reelSim = new ReelSim();
let lastReelFrameMs = 0;
let reelResultSent = false;

ui.onPlay(async (name, skinId) => {
  audioManager.init();
  trackEvent("play_clicked", { name, skinId });
  if (net.status === "connected") {
    ui.enterGame();
    return;
  }
  try {
    await net.connect(name, skinId);
    trackEvent("join_game", { name, skinId });
  } catch {
    // Status already reflects the error via onStatusChange; nothing else to do — keeps the
    // connect screen usable (graceful degradation) if the backend isn't reachable yet.
  }
});

// Map zoom factor: camera looks at a world area MAP_ZOOM times larger than canvas pixels then shrinks the whole scene
// to fit the screen → see more of the map (Vicent 2026-07-14: "zoomed in too close, make map smaller"). Increasing
// this number = look even further. Only affects rendering, doesn't touch logic/aiming (input uses atan2).
const MAP_ZOOM = 1.4;

// World is centered on the origin — camera starts at (0,0) before a player connects and
// immediately re-centers on the local player once joined (see frame() below).
const camera: Camera = { x: 0, y: 0, width: viewportW * MAP_ZOOM, height: viewportH * MAP_ZOOM, scale: 1 / MAP_ZOOM };
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
  // Virtual viewport = logical viewport × MAP_ZOOM; scale = shrink ratio to logical CSS pixels (render.ts
  // applies this together with devicePixelRatio). Camera math stays in CSS pixels so it matches mouse aim.
  camera.width = viewportW * MAP_ZOOM;
  camera.height = viewportH * MAP_ZOOM;
  camera.scale = viewportW / camera.width;

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

  // Aiming origin must be in REAL PIXELS (mouse is real pixels) — multiply by camera.scale because the scene has been shrunk.
  const camScale = camera.scale ?? 1;
  localPlayerScreenOrigin = localPlayer
    ? {
        x: (animator.get(localPlayer.id).x - camera.x) * camScale + viewportW / 2,
        y: (animator.get(localPlayer.id).y - camera.y) * camScale + viewportH / 2,
      }
    : { x: viewportW / 2, y: viewportH / 2 };
  latestLocalFishState = localPlayer?.fishState ?? "idle";

  // Audio system checks and dynamic SFX triggers
  if (localPlayer) {
    const currentFishState = localPlayer.fishState;
    
    // 1. Detect fishing state transitions.
    // Server resolves a cast synchronously — idle -> waiting in one step, no separate "casting"
    // state is ever actually set (see backend/src/systems/fishing.ts#tryCast) — so the old branch waiting
    // for fishState === "casting" never runs, and the splash sound of the bobber falling into the water (playSplash)
    // is never played. Fix: correctly capture the transition idle -> waiting, play casting sound
    // immediately and splash sound after a short delay (simulating flight time of the bobber
    // in mid-air) instead of relying on a non-existent state.
    if (currentFishState !== lastFishState) {
      if (currentFishState === "waiting" && lastFishState === "idle") {
        audioManager.playCast();
        // Bobber falls into water after ~180ms flying in mid-air: sync splash sound + water splash effect
        // at the exact bobber position (expanding waves + water drops, see render.ts).
        const bx = localPlayer.bobberX;
        const by = localPlayer.bobberY;
        window.setTimeout(() => {
          audioManager.playSplash();
          spawnCastSplash(bx, by, Date.now());
        }, 180);
      }
      // Start new reeling session: start client simulation (lazy start below if species is not synced yet).
      if (currentFishState === "reeling") {
        reelResultSent = false;
        lastReelFrameMs = 0;
        reelSim.stop();
      } else if (lastFishState === "reeling") {
        // Exit reeling (result received): stop simulation.
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

    // 3. Reeling clicks (hold mouse to push the catching bar up in the "1-bar" minigame)
    if (currentFishState === "reeling" && input.isReelHeld) {
      if (nowMs - lastReelClickTime > 90) {
        audioManager.playReelClick();
        lastReelClickTime = nowMs;
      }
    }

    // 4. Simulate reeling minigame on client side (smooth 60fps). Lazy start when species info is synced.
    if (currentFishState === "reeling") {
      if (!reelSim.active && localPlayer.activeFishSpeciesId) {
        reelSim.start(localPlayer.activeFishSpeciesId, localPlayer.activeFishWeight);
      }
      if (reelSim.active) {
        const dtMs = lastReelFrameMs > 0 ? Math.min(100, nowMs - lastReelFrameMs) : 0;
        reelSim.update(dtMs, input.isReelHeld);
        // Time out: report total time of the fish in the catching zone to server (once) to clamp + roll probability.
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
    devicePixelRatio: devicePixelRatioValue,
  });

  ui.updateLeaderboard(snapshot.leaderboard, localPlayerId);
  ui.updateMobileControls(latestLocalFishState);
  // Cast power bar is only meaningful when idle — during fishing, holding the mouse
  // means something else entirely (hooking/reeling), not charging cast power.
  ui.updateCastMeter(net.status === "connected" && latestLocalFishState === "idle" ? input.castChargeFraction : null);

  if (localPlayer) {
    ui.updateStats(localPlayer.caughtCount, localPlayer.totalValue);
    ui.updateCurrentLake(localPlayer.currentLakeId);
    ui.updateCollection(localPlayer.collection);

    // Render the modal directly from client simulation (running at 60fps in section 4 above) — absolutely smooth,
    // no longer dependent on network rhythm, so interpolation is no longer needed.
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
