import { BASE_SPEED, WORLD_WIDTH, WORLD_HEIGHT, isInsideAnyLake, isInsideMountains } from "@bomio/shared";
import type { PlayerSchema } from "../schema/State.js";
import { clamp } from "./utils.js";

const HALF_W = WORLD_WIDTH / 2;
const HALF_H = WORLD_HEIGHT / 2;

/**
 * Precomputed "is this point inside a lake" lookup grid, built ONCE at server start.
 *
 * Movement collision used to call isInsideAnyLake up to 5×3 = 15 times per moving player per tick, and each call
 * runs point-in-polygon over every lake — the Han River polygon alone has ~132 vertices and its AABB spans almost
 * the whole map, so it rarely gets cheaply rejected. At scale that was tens of thousands of polygon tests per second.
 *
 * Instead we rasterize walkability once into a bitmap (cell = isInsideAnyLake at the cell center) and turn each
 * runtime check into an O(1) array lookup. The grid is DILATED by one cell so it is conservative — a cell adjacent
 * to any water cell is also marked blocked — which guarantees the discretization never lets a player dip into the
 * water (the exact behaviour Vicent wanted preserved), at the cost of stopping at most ~one cell earlier from shore.
 */
const GRID_CELL = 16;
// Pad by one cell on every side so FOOT_MARGIN probes just outside the world bounds still resolve to a valid cell.
const GRID_ORIGIN_X = -HALF_W - GRID_CELL;
const GRID_ORIGIN_Y = -HALF_H - GRID_CELL;
const GRID_COLS = Math.ceil((WORLD_WIDTH + 2 * GRID_CELL) / GRID_CELL) + 1;
const GRID_ROWS = Math.ceil((WORLD_HEIGHT + 2 * GRID_CELL) / GRID_CELL) + 1;

const lakeGrid: Uint8Array = (() => {
  const raw = new Uint8Array(GRID_COLS * GRID_ROWS);
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const wx = GRID_ORIGIN_X + (c + 0.5) * GRID_CELL;
      const wy = GRID_ORIGIN_Y + (r + 0.5) * GRID_CELL;
      if (isInsideAnyLake(wx, wy)) raw[r * GRID_COLS + c] = 1;
    }
  }
  // Dilate by one cell (3×3 neighbourhood) → conservative blocking, no false "walkable" next to water.
  const dilated = new Uint8Array(GRID_COLS * GRID_ROWS);
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      let blocked = 0;
      for (let dr = -1; dr <= 1 && !blocked; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr < 0 || nc < 0 || nr >= GRID_ROWS || nc >= GRID_COLS) continue;
          if (raw[nr * GRID_COLS + nc]) {
            blocked = 1;
            break;
          }
        }
      }
      dilated[r * GRID_COLS + c] = blocked;
    }
  }
  return dilated;
})();

/** O(1) grid lookup replacement for isInsideAnyLake on the movement hot path. Points outside the grid are
 * treated as not-water (players are clamped inside the world anyway). */
function isInsideAnyLakeFast(worldX: number, worldY: number): boolean {
  const c = Math.floor((worldX - GRID_ORIGIN_X) / GRID_CELL);
  const r = Math.floor((worldY - GRID_ORIGIN_Y) / GRID_CELL);
  if (c < 0 || r < 0 || c >= GRID_COLS || r >= GRID_ROWS) return false;
  return lakeGrid[r * GRID_COLS + c] === 1;
}

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
    if (isInsideAnyLakeFast(x, y)) return true;
    return (
      isInsideAnyLakeFast(x + FOOT_MARGIN, y) ||
      isInsideAnyLakeFast(x - FOOT_MARGIN, y) ||
      isInsideAnyLakeFast(x, y + FOOT_MARGIN) ||
      isInsideAnyLakeFast(x, y - FOOT_MARGIN)
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
