/**
 * Frontend-only config. Anything that affects actual game rules/timing lives in
 * @bomio/shared instead — this file is strictly for rendering/UI concerns.
 */

// Re-exported straight from @bomio/shared so nothing in frontend hardcodes/guesses lake size.
// The world is centered on the origin, spanning [-WORLD_WIDTH/2, WORLD_WIDTH/2] x
// [-WORLD_HEIGHT/2, WORLD_HEIGHT/2] (see backend/src/systems/utils.ts and movement.ts).
export { WORLD_WIDTH, WORLD_HEIGHT } from "@bomio/shared";

// Colyseus server endpoint (dynamically targets same host IP for mobile local testing).
export const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (window.location.protocol === "https:" ? "wss://" : "ws://") + window.location.hostname + ":2567";
export const ROOM_NAME = "game";

// Visual scaling for the character ball — re-exported from @bomio/shared since it's also used to
// compute the fixed PLAYER_VISUAL_SIZE geometry there.
export { BALL_RADIUS_RATIO, BALL_FOOT_RADIUS_RATIO, PLAYER_VISUAL_SIZE } from "@bomio/shared";

export { CAST_MAX_CHARGE_MS } from "@bomio/shared";

// How often we send `move` messages to the server (ms). Once per animation frame is fine per the
// spec, but we clamp with a tiny min interval as a safety net in case a browser fires rAF unusually
// fast.
export const MOVE_SEND_INTERVAL_MS = 1000 / 30;
