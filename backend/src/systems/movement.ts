import { BASE_SPEED, WORLD_WIDTH, WORLD_HEIGHT, isInsideAnyLake, isInsideMountains } from "@bomio/shared";
import type { PlayerSchema } from "../schema/State.js";
import { clamp } from "./utils.js";

const HALF_W = WORLD_WIDTH / 2;
const HALF_H = WORLD_HEIGHT / 2;

/**
 * Advance a single player's position for one tick based on their last-received desired angle.
 * A player standing anywhere except "idle" (waiting/reeling) is planted at their
 * spot — you can't wander off around the lake mid-cast, matching "post up and fish" pacing
 * instead of agar.io-style constant movement. Speed is a fixed constant now (no more size-speed
 * tradeoff — there's no growth mechanic in the fishing pivot).
 *
 * Movement is now keyboard-driven (WASD/mũi tên) rather than always-walk-toward-cursor: the player
 * only advances while actively holding a movement key (`desiredMoving`), and keeps facing whatever
 * direction they last walked when standing still — mouse aim (cast angle) is set separately by
 * tryCast, see fishing.ts.
 *
 * Can't walk INTO a lake's water (isInsideAnyLake) — only up to its shore. Resolved per-axis (try
 * the full diagonal move, then X-only, then Y-only) instead of a hard stop, so walking along a
 * shoreline slides smoothly instead of snagging the moment either axis alone would dip into water.
 */
export function stepPlayerMovement(player: PlayerSchema, deltaSeconds: number): void {
  if (player.fishState !== "idle") return;
  if (!player.desiredMoving) return;

  player.angle = player.desiredAngle;

  const dx = Math.cos(player.angle) * BASE_SPEED * deltaSeconds;
  const dy = Math.sin(player.angle) * BASE_SPEED * deltaSeconds;

  const nextX = clamp(player.x + dx, -HALF_W, HALF_W);
  const nextY = clamp(player.y + dy, -HALF_H, HALF_H);

  // Block with a SAFETY MARGIN (~half body): previously we only tested the center point so players could push half their body
  // into the water's edge ("sometimes can walk into the lake" — Vicent 2026-07-14). Now, they are blocked if the center OR
  // any of the 4 points around the center at radius FOOT_MARGIN touches water/mountains → stops at a distance from the water's edge,
  // preventing the body from overlapping with the water surface. FOOT_MARGIN << LAKE_CAST_RANGE so they can still get close enough to cast.
  const FOOT_MARGIN = 16;
  const isBlocked = (x: number, y: number) => {
    if (isInsideMountains(x, y)) return true;
    if (isInsideAnyLake(x, y)) return true;
    return (
      isInsideAnyLake(x + FOOT_MARGIN, y) ||
      isInsideAnyLake(x - FOOT_MARGIN, y) ||
      isInsideAnyLake(x, y + FOOT_MARGIN) ||
      isInsideAnyLake(x, y - FOOT_MARGIN)
    );
  };

  if (!isBlocked(nextX, nextY)) {
    player.x = nextX;
    player.y = nextY;
  } else if (!isBlocked(nextX, player.y)) {
    player.x = nextX;
  } else if (!isBlocked(player.x, nextY)) {
    player.y = nextY;
  }
}
