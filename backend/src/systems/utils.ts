import { WORLD_WIDTH, WORLD_HEIGHT, PLAYER_SPAWN_EDGE_MARGIN, LAKE_DEFINITIONS, isInsideAnyLake } from "@bomio/shared";
import type { LakeDefinition } from "@bomio/shared";

let idCounter = 0;

/**
 * Simple monotonic-ish unique id generator. Note: `idCounter` is module-global (shared across
 * every GameRoom instance in this process, not scoped to a single room) - harmless in practice
 * since Date.now() + the counter together are unique enough for in-memory entities.
 */
export function generateId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

const SPAWN_HALF_W = WORLD_WIDTH / 2 - PLAYER_SPAWN_EDGE_MARGIN;
const SPAWN_HALF_H = WORLD_HEIGHT / 2 - PLAYER_SPAWN_EDGE_MARGIN;

/** Fixed walking margin placed just past a lake's approximate radius — close enough that
 * LAKE_CAST_RANGE (shared/src/lakes.ts) reaches the water, so anyone spawned here can cast right
 * away instead of having to walk further first. */
const SPAWN_SHORE_MARGIN = 120;

/** Random point just outside a given lake's shore — picks a REAL vertex of the lake's (jittered,
 * possibly very irregular) polygon and pushes outward from it along its own radial direction by a
 * fixed margin, so the result is always close to the actual boundary regardless of how much a
 * given lake's shape deviates from its base ellipse (a fixed offset from the base ellipse radius
 * alone isn't reliable for high-jitter lakes — a vertex pulled inward can leave the "approx" spawn
 * point standing farther from the true edge than LAKE_CAST_RANGE covers). Clamped to stay within
 * the world bounds in case a lake sits close to an edge. */
export function spawnPointNearLake(lake: LakeDefinition): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let attempts = 0;

  do {
    const vertex = lake.polygon[Math.floor(Math.random() * lake.polygon.length)];
    if (lake.id === "song_chinh") {
      // The river is horizontal. To push it out of the river bank, offset y vertically.
      const offsetSign = vertex.y < 0 ? -1 : 1;
      x = clamp(lake.centerX + vertex.x, -SPAWN_HALF_W, SPAWN_HALF_W);
      y = clamp(lake.centerY + vertex.y + offsetSign * SPAWN_SHORE_MARGIN, -SPAWN_HALF_H, SPAWN_HALF_H);
    } else {
      const len = Math.max(Math.hypot(vertex.x, vertex.y), 1);
      const scale = (len + SPAWN_SHORE_MARGIN) / len;
      x = clamp(lake.centerX + vertex.x * scale, -SPAWN_HALF_W, SPAWN_HALF_W);
      y = clamp(lake.centerY + vertex.y * scale, -SPAWN_HALF_H, SPAWN_HALF_H);
    }
    attempts++;
  } while (isInsideAnyLake(x, y) && attempts < 100);

  // Safeguard fallback: if we failed to find a spot on land after 100 tries, spawn just below Ao Lang (safe land)
  if (isInsideAnyLake(x, y)) {
    return { x: 0, y: 400 };
  }

  return { x, y };
}

/** Random spawn point for a real player joining — lands near a random lake's shore so players see
 * water immediately instead of empty grass somewhere in the middle of the (now much bigger) map. */
export function randomSpawnPoint(): { x: number; y: number } {
  const lake = LAKE_DEFINITIONS[Math.floor(Math.random() * LAKE_DEFINITIONS.length)];
  return spawnPointNearLake(lake);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function pickRandom<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
