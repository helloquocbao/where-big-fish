/**
 * Client-only visual state per player, derived from observed server snapshots rather than stored
 * on PlayerState itself (which has no velocity/isMoving field — it's server-authoritative position
 * only). Kept out of render.ts so that file stays a pure "snapshot -> pixels" function; this module
 * owns the cross-frame state and main.ts feeds its output into render().
 */

import type { PlayerState } from "@bomio/shared";

export interface PlayerAnimation {
  // Smoothed render position — hides the step artifacts from discrete server state updates (the
  // server only broadcasts a few times a second, so drawing raw player.x/y directly makes
  // movement look like small jittery steps rather than continuous motion).
  x: number;
  y: number;
  // Smoothed facing angle, radians — same step-artifact problem as x/y.
  angle: number;
  walkPhase: number; // radians, advances with distance traveled (not wall-clock) so stride rate matches actual movement speed
  isMoving: boolean;
  isDraggedDown: boolean;
  draggedDownStartMs: number;
}

interface AnimState extends PlayerAnimation {
  lastSeenX: number; // position as of the last actual server patch (not every render frame)
  lastSeenY: number;
  lastMovedAtMs: number; // last time lastSeenX/Y actually changed
  lastUpdateMs: number;
}

// Tuned so a player moving at BASE_SPEED completes a full stride (2π) a few times per second —
// purely a visual feel constant, not synced with the server.
const WALK_PHASE_PER_UNIT_DISTANCE = 0.15;
const MOVED_DISTANCE_THRESHOLD = 0.05; // world-unit distance since the last patch below which we treat the player as idle
const MOVING_GRACE_MS = 200;

// Exponential smoothing time constant (ms) for the rendered position.
const POSITION_SMOOTHING_TAU_MS = 100;
const ANGLE_SMOOTHING_TAU_MS = 260;

/** Signed shortest angular distance from `from` to `to`, in (-PI, PI]. */
function shortestAngleDelta(from: number, to: number): number {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

// A fixed, constant walking speed now that there's no size-speed tradeoff (no growth mechanic in
// the fishing pivot) — used only to drive the walk-cycle phase while animating between patches.
const ASSUMED_WALK_SPEED = 160;

export class PlayerAnimator {
  private states = new Map<string, AnimState>();

  update(players: PlayerState[], nowMs: number): void {
    const seen = new Set<string>();
    for (const player of players) {
      seen.add(player.id);
      const prev = this.states.get(player.id);
      if (!prev) {
        // First sighting: snap immediately instead of smoothing in from nothing.
        this.states.set(player.id, {
          lastSeenX: player.x,
          lastSeenY: player.y,
          lastMovedAtMs: nowMs,
          x: player.x,
          y: player.y,
          angle: player.angle,
          walkPhase: 0,
          isMoving: false,
          isDraggedDown: false,
          draggedDownStartMs: 0,
          lastUpdateMs: nowMs,
        });
        continue;
      }

      const dtMs = Math.max(0, nowMs - prev.lastUpdateMs);

      if (Math.hypot(player.x - prev.lastSeenX, player.y - prev.lastSeenY) > MOVED_DISTANCE_THRESHOLD) {
        prev.lastMovedAtMs = nowMs;
        prev.lastSeenX = player.x;
        prev.lastSeenY = player.y;
      }
      prev.isMoving = nowMs - prev.lastMovedAtMs < MOVING_GRACE_MS;
      if (prev.isMoving) {
        const distanceThisFrame = (ASSUMED_WALK_SPEED * dtMs) / 1000;
        prev.walkPhase += distanceThisFrame * WALK_PHASE_PER_UNIT_DISTANCE;
      }

      const smoothing = 1 - Math.exp(-dtMs / POSITION_SMOOTHING_TAU_MS);
      prev.x += (player.x - prev.x) * smoothing;
      prev.y += (player.y - prev.y) * smoothing;

      const angleSmoothing = 1 - Math.exp(-dtMs / ANGLE_SMOOTHING_TAU_MS);
      prev.angle += shortestAngleDelta(prev.angle, player.angle) * angleSmoothing;
      prev.lastUpdateMs = nowMs;
    }
    // Drop players no longer in the snapshot (disconnected) so this map doesn't grow forever.
    for (const id of this.states.keys()) {
      if (!seen.has(id)) this.states.delete(id);
    }
  }

  get(playerId: string): PlayerAnimation {
    const st = this.states.get(playerId);
    if (!st) return { x: 0, y: 0, angle: 0, walkPhase: 0, isMoving: false, isDraggedDown: false, draggedDownStartMs: 0 };
    return st;
  }

  triggerDragDown(playerId: string, nowMs: number) {
    const st = this.states.get(playerId);
    if (st) {
      st.isDraggedDown = true;
      st.draggedDownStartMs = nowMs;
    }
  }
}
