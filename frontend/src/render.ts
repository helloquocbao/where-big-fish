/**
 * All canvas drawing lives here. Rendering is pure: given a snapshot + camera,
 * draw it. No game logic/decisions are made in this file.
 */

import type { PlayerState, RoomSnapshot, SkinDefinition, SkinTopper, LakeDefinition } from "@bomio/shared";
import {
  getSkinDefinition,
  hashString,
  LAKE_DEFINITIONS,
  isInsideAnyLake,
  distanceToLakeBoundary,
  aabbDistanceToLake,
  isInsideMountains,
} from "@bomio/shared";
import { BALL_RADIUS_RATIO, PLAYER_VISUAL_SIZE, WORLD_WIDTH, WORLD_HEIGHT } from "./config.ts";
import type { PlayerAnimation } from "./animation.ts";
// Icon cá tách sang module riêng (mỗi loài 1 hình). Re-export để ui.ts vẫn import từ render.ts như cũ.
import { drawFishIcon } from "./fishArt.ts";
export { drawFishIcon };

export interface Camera {
  x: number;
  y: number;
  /** Width/height of the WORLD area that camera sees (world unit = "virtual pixel"). When zoomed out, this value
   * is > the real pixel count of the canvas to reveal more of the map. */
  width: number;
  height: number;
  /** Scale factor virtual→real (= canvasPxWidth / camera.width). <1 = zoom out. render() applies this once for
   * the whole scene so all positions + dimensions shrink uniformly (Vicent 2026-07-14: "zoom map smaller").
   * Default is 1 if not set. */
  scale?: number;
}

function worldToScreen(camera: Camera, x: number, y: number): [number, number] {
  return [x - camera.x + camera.width / 2, y - camera.y + camera.height / 2];
}

/** Deterministic pseudo-random value in [0, 1) for an integer cell coordinate — classic
 * GLSL-style sine hash. Used to scatter shore decorations purely as a function of world position
 * (no state, no per-frame randomness) so the shore looks the same every time the camera revisits
 * a spot instead of flickering/reshuffling. */
function hashCell(cx: number, cy: number, salt: number): number {
  const h = Math.sin(cx * 127.1 + cy * 311.7 + salt * 74.7) * 43758.5453;
  return h - Math.floor(h);
}

// ---- Lake geometry (world-space) — multiple lakes scattered across the map, REAL shapes/sizes (casting is verified
// at the backend, see shared/src/lakes.ts#LAKE_DEFINITIONS), no longer purely cosmetic like the previous single fixed
// elliptical lake.
const NEAR_EDGE_THRESHOLD = 60;

/** Is it near the edge of ANY lake (within NEAR_EDGE_THRESHOLD from boundary, whether inside or
 * outside the lake) — used to scatter reeds right at the water's edge. */
function isNearAnyLakeEdge(worldX: number, worldY: number): boolean {
  return LAKE_DEFINITIONS.some(
    (lake) =>
      // AABB reject first: if the point is further from the lake's AABB than the threshold, then it is definitely further
      // from the real boundary — skip distanceToLakeBoundary (scanning each edge, river has ~132 edges) for that lake.
      aabbDistanceToLake(lake, worldX, worldY) < NEAR_EDGE_THRESHOLD &&
      distanceToLakeBoundary(lake, worldX, worldY) < NEAR_EDGE_THRESHOLD,
  );
}

const MEADOW_PATCH_CELL_SIZE = 480;
const MEADOW_PATCH_COLORS = ["rgba(150,205,90,0.45)", "rgba(200,235,140,0.5)", "rgba(120,190,80,0.4)"];

// Meadow patches used to allocate a fresh radial gradient (ctx.createRadialGradient) for EVERY visible
// cell EVERY frame (~15-25 gradients/frame × 60fps, all immediately GC'd — a top GC offender). Instead we
// pre-render each patch color once onto a small offscreen sprite (radial color→transparent) and blit it with
// drawImage scaled to the cell radius — zero per-frame gradient allocation, identical visual result. Bounded
// by MEADOW_PATCH_COLORS.length sprites total.
const PATCH_SPRITE_SIZE = 128;
const patchSpriteCache = new Map<string, HTMLCanvasElement>();
function getPatchSprite(color: string): HTMLCanvasElement {
  let sprite = patchSpriteCache.get(color);
  if (!sprite) {
    sprite = document.createElement("canvas");
    sprite.width = PATCH_SPRITE_SIZE;
    sprite.height = PATCH_SPRITE_SIZE;
    const sctx = sprite.getContext("2d")!;
    const half = PATCH_SPRITE_SIZE / 2;
    const g = sctx.createRadialGradient(half, half, 0, half, half, half);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    sctx.fillStyle = g;
    sctx.fillRect(0, 0, PATCH_SPRITE_SIZE, PATCH_SPRITE_SIZE);
    patchSpriteCache.set(color, sprite);
  }
  return sprite;
}

/** Static decoration layers (meadow patches, trees, reeds...) are scattered according to a DETERMINISTIC function of grid cell coordinates
 * in world space — the result never changes for a cell. Previously, every frame recalculated placement + expensive
 * lake/mountain checks (point-in-polygon, river ~132 vertices) for each visible cell. Now we cache the STATIC decision
 * of each cell (computed exactly once for the page lifetime), and each frame just does an O(1) lookup and draws.
 * The cache is naturally bounded by the cell count in the world (~a few thousand cells/layer) so it doesn't grow infinitely.
 * Note: DYNAMIC elements (e.g. avoiding player positions for shore decor) are still processed at draw time, not cached. */
function cachedCell<T>(cache: Map<string, T | null>, cx: number, cy: number, compute: (cx: number, cy: number) => T | null): T | null {
  const key = `${cx},${cy}`;
  let v = cache.get(key);
  if (v === undefined) {
    v = compute(cx, cy);
    cache.set(key, v);
  }
  return v;
}

interface ShorePatchCell {
  worldX: number;
  worldY: number;
  color: string;
  radius: number;
}
const shorePatchCache = new Map<string, ShorePatchCell | null>();

function computeShorePatchCell(cx: number, cy: number): ShorePatchCell | null {
  const colorRoll = hashCell(cx, cy, 1);
  if (colorRoll < 0.4) return null;
  const color = MEADOW_PATCH_COLORS[Math.floor(hashCell(cx, cy, 2) * MEADOW_PATCH_COLORS.length)];
  const jitterX = (hashCell(cx, cy, 3) - 0.5) * MEADOW_PATCH_CELL_SIZE * 0.5;
  const jitterY = (hashCell(cx, cy, 4) - 0.5) * MEADOW_PATCH_CELL_SIZE * 0.5;
  const worldX = (cx + 0.5) * MEADOW_PATCH_CELL_SIZE + jitterX;
  const worldY = (cy + 0.5) * MEADOW_PATCH_CELL_SIZE + jitterY;
  if (isInsideAnyLake(worldX, worldY)) return null; // don't tint the water surface itself
  const radius = MEADOW_PATCH_CELL_SIZE * (0.55 + hashCell(cx, cy, 5) * 0.3);
  return { worldX, worldY, color, radius };
}

function drawShorePatches(ctx: CanvasRenderingContext2D, camera: Camera) {
  const startCx = Math.floor((camera.x - camera.width / 2) / MEADOW_PATCH_CELL_SIZE) - 1;
  const endCx = Math.floor((camera.x + camera.width / 2) / MEADOW_PATCH_CELL_SIZE) + 1;
  const startCy = Math.floor((camera.y - camera.height / 2) / MEADOW_PATCH_CELL_SIZE) - 1;
  const endCy = Math.floor((camera.y + camera.height / 2) / MEADOW_PATCH_CELL_SIZE) + 1;

  for (let cx = startCx; cx <= endCx; cx++) {
    for (let cy = startCy; cy <= endCy; cy++) {
      const cell = cachedCell(shorePatchCache, cx, cy, computeShorePatchCell);
      if (!cell) continue;
      const [sx, sy] = worldToScreen(camera, cell.worldX, cell.worldY);
      const sprite = getPatchSprite(cell.color);
      const diameter = cell.radius * 2;
      ctx.drawImage(sprite, sx - cell.radius, sy - cell.radius, diameter, diameter);
    }
  }
}

type ShoreDecorKind = "tuft" | "clover" | "flower" | "pebble" | "reed";

function pickShoreDecorKind(roll: number): ShoreDecorKind | null {
  if (roll < 0.6) return null;
  if (roll < 0.6 + 0.14) return "tuft";
  if (roll < 0.6 + 0.14 + 0.1) return "clover";
  if (roll < 0.6 + 0.14 + 0.1 + 0.06) return "flower";
  if (roll < 0.6 + 0.14 + 0.1 + 0.06 + 0.06) return "pebble";
  return "reed";
}

function drawShoreDecor(ctx: CanvasRenderingContext2D, sx: number, sy: number, rotation: number, scale: number, kind: ShoreDecorKind) {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);

  if (kind === "tuft") {
    ctx.strokeStyle = "#4b8425";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    for (const dx of [-4, 0, 4]) {
      ctx.beginPath();
      ctx.moveTo(dx, 6);
      ctx.quadraticCurveTo(dx * 1.4, -2, dx * 0.5, -10);
      ctx.stroke();
    }
  } else if (kind === "clover") {
    ctx.fillStyle = "#5aa437";
    ctx.strokeStyle = "#3f7a22";
    ctx.lineWidth = 1;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * 4, 0, 4.5, 3, side * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(0, -4.5, 4.5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (kind === "flower") {
    ctx.fillStyle = "#fffaf0";
    for (let i = 0; i < 5; i++) {
      const petalAngle = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(Math.cos(petalAngle) * 4, Math.sin(petalAngle) * 4, 3.4, 2.1, petalAngle, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#ffd93d";
    ctx.beginPath();
    ctx.arc(0, 0, 2.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "pebble") {
    ctx.fillStyle = "#a89a86";
    ctx.strokeStyle = "#7d7060";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, 5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    // reed: a couple of tall thin blades, leaning slightly — planted right at the waterline.
    ctx.strokeStyle = "#3f7a4a";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    for (const dx of [-3, 3]) {
      ctx.beginPath();
      ctx.moveTo(dx, 8);
      ctx.quadraticCurveTo(dx * 1.8, -6, dx * 0.6, -20);
      ctx.stroke();
    }
  }
  ctx.restore();
}

const SHORE_DECOR_CELL_SIZE = 130;
const SHORE_DECOR_PLAYER_CLEARANCE_FACTOR = 1.4 * PLAYER_VISUAL_SIZE;

interface ShoreDecorCell {
  worldX: number;
  worldY: number;
  rotation: number;
  scale: number;
  kind: ShoreDecorKind;
}
const shoreDecorCache = new Map<string, ShoreDecorCell | null>();

/** Static placement decision for a shore-decor cell (kind + jitter + lake/waterline checks) — all
 * a pure function of the cell coordinate, so computed once and cached. The per-frame player-
 * proximity skip is NOT part of this (players move) and is applied at draw time instead. */
function computeShoreDecorCell(cx: number, cy: number): ShoreDecorCell | null {
  const kind = pickShoreDecorKind(hashCell(cx, cy, 11));
  if (!kind) return null;

  const jitterX = (hashCell(cx, cy, 12) - 0.5) * SHORE_DECOR_CELL_SIZE * 0.7;
  const jitterY = (hashCell(cx, cy, 13) - 0.5) * SHORE_DECOR_CELL_SIZE * 0.7;
  const worldX = (cx + 0.5) * SHORE_DECOR_CELL_SIZE + jitterX;
  const worldY = (cy + 0.5) * SHORE_DECOR_CELL_SIZE + jitterY;

  // Reeds intentionally allowed right at/near the waterline; everything else skips the water.
  if (kind !== "reed" && isInsideAnyLake(worldX, worldY)) return null;
  if (kind === "reed" && !isNearAnyLakeEdge(worldX, worldY)) return null;

  const rotation = hashCell(cx, cy, 14) * Math.PI * 2;
  const scale = 0.75 + hashCell(cx, cy, 15) * 0.7;
  return { worldX, worldY, rotation, scale, kind };
}

/** Static, non-gameplay shore clutter (grass tufts, clover, flowers, pebbles, reeds near the
 * waterline) — purely a function of world position, gives the eye something to notice while
 * walking instead of an empty field. Skips the lake's water surface and any spot currently
 * occupied by a player. */
function drawShoreDecorations(ctx: CanvasRenderingContext2D, camera: Camera, players: PlayerState[]) {
  const startCx = Math.floor((camera.x - camera.width / 2) / SHORE_DECOR_CELL_SIZE) - 1;
  const endCx = Math.floor((camera.x + camera.width / 2) / SHORE_DECOR_CELL_SIZE) + 1;
  const startCy = Math.floor((camera.y - camera.height / 2) / SHORE_DECOR_CELL_SIZE) - 1;
  const endCy = Math.floor((camera.y + camera.height / 2) / SHORE_DECOR_CELL_SIZE) + 1;

  for (let cx = startCx; cx <= endCx; cx++) {
    for (let cy = startCy; cy <= endCy; cy++) {
      const cell = cachedCell(shoreDecorCache, cx, cy, computeShoreDecorCell);
      if (!cell) continue;

      const tooCloseToPlayer = players.some(
        (p) => Math.hypot(p.x - cell.worldX, p.y - cell.worldY) < SHORE_DECOR_PLAYER_CLEARANCE_FACTOR,
      );
      if (tooCloseToPlayer) continue;

      const [sx, sy] = worldToScreen(camera, cell.worldX, cell.worldY);
      if (sx < -20 || sy < -20 || sx > camera.width + 20 || sy > camera.height + 20) continue;

      drawShoreDecor(ctx, sx, sy, cell.rotation, cell.scale, cell.kind);
    }
  }
}

function drawOceanWaves(ctx: CanvasRenderingContext2D, camera: Camera, nowMs: number) {
  const waveSpacing = 160;
  const startX = Math.floor((camera.x - camera.width / 2) / waveSpacing) * waveSpacing;
  const endX = Math.floor((camera.x + camera.width / 2) / waveSpacing) * waveSpacing + waveSpacing;
  const startY = Math.floor((camera.y - camera.height / 2) / waveSpacing) * waveSpacing;
  const endY = Math.floor((camera.y + camera.height / 2) / waveSpacing) * waveSpacing + waveSpacing;

  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.09)";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";

  for (let wx = startX; wx <= endX; wx += waveSpacing) {
    for (let wy = startY; wy <= endY; wy += waveSpacing) {
      if (Math.abs(wx) < WORLD_WIDTH / 2 && Math.abs(wy) < WORLD_HEIGHT / 2) continue;

      const [sx, sy] = worldToScreen(camera, wx, wy);
      const animOffset = Math.sin(nowMs / 800 + wx * 0.01 + wy * 0.01) * 8;
      ctx.beginPath();
      ctx.arc(sx + animOffset, sy, 15, -Math.PI * 0.25, Math.PI * 0.25);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function clearBackground(ctx: CanvasRenderingContext2D, camera: Camera, players: PlayerState[], nowMs: number) {
  // Fill the screen with ocean blue first
  ctx.fillStyle = "#2c7fa6";
  ctx.fillRect(0, 0, camera.width, camera.height);

  // Draw waves in the ocean (which is visible on the right outside the island)
  drawOceanWaves(ctx, camera, nowMs);

  // Draw island landmass
  const [x0, y0] = worldToScreen(camera, -WORLD_WIDTH / 2, -WORLD_HEIGHT / 2);
  const [x1, y1] = worldToScreen(camera, WORLD_WIDTH / 2, WORLD_HEIGHT / 2);

  ctx.save();
  // Main Grass area covering the island (extending to left, top, bottom edges)
  ctx.fillStyle = "#a4bd83";
  ctx.fillRect(x0, y0, (x1 - x0) - 80, y1 - y0);

  // Sandy beach on the right edge
  ctx.fillStyle = "#ebd7a0";
  ctx.fillRect(x1 - 80, y0, 80, y1 - y0);

  // Wet sand transition shadow on the right beach
  ctx.fillStyle = "#d5c088";
  ctx.fillRect(x1 - 80, y0, 20, y1 - y0);
  ctx.restore();

  drawShorePatches(ctx, camera);
  drawShoreDecorations(ctx, camera, players);
  drawMountains(ctx, camera);
}

// Decorative landmarks are resolved once against the authoritative lake geometry.
const shoreSigns = LAKE_DEFINITIONS.filter(lake => lake.id !== "song_chinh" && lake.id !== "bien_dong").map(lake => {
  const x = lake.centerX;
  const y = lake.bounds.maxY + 100;
  return { lake, x, y };
}).filter(sign => !isInsideAnyLake(sign.x, sign.y) && !isInsideMountains(sign.x, sign.y));

function drawShoreSigns(ctx: CanvasRenderingContext2D, camera: Camera) {
  ctx.save();
  for (const sign of shoreSigns) {
    const [x, y] = worldToScreen(camera, sign.x, sign.y);
    if (x < -140 || y < -100 || x > camera.width + 140 || y > camera.height + 100) continue;
    // A small clearing and sign, entirely decorative: no suggested bridge over water.
    ctx.fillStyle = "#c9c894";
    ctx.beginPath(); ctx.ellipse(x, y + 8, 92, 32, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#867655"; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(x - 42, y - 10); ctx.lineTo(x - 42, y + 15);
    ctx.moveTo(x + 42, y - 10); ctx.lineTo(x + 42, y + 15); ctx.stroke();
    ctx.fillStyle = "#fff1cb"; ctx.strokeStyle = "#64775c"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x - 83, y - 49, 166, 45, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#294f42"; ctx.textAlign = "center";
    ctx.font = "bold 15px 'Baloo 2', system-ui"; ctx.fillText(sign.lake.name, x, y - 29);
    ctx.font = "10px system-ui";
    ctx.fillText(`${Object.keys(sign.lake.fishWeights).length} species · fishing shore`, x, y - 13);
  }
  ctx.restore();
}

function drawMountains(ctx: CanvasRenderingContext2D, camera: Camera) {
  const mountX = -WORLD_WIDTH / 2 + 50;
  const mountY = -1200; // where the river starts

  ctx.save();
  // Cozy overlapping mountain peaks
  const peaks = [
    { x: mountX + 80, y: mountY - 200, size: 240 },
    { x: mountX - 40, y: mountY - 80, size: 190 },
    { x: mountX + 160, y: mountY + 80, size: 180 },
  ];

  for (const peak of peaks) {
    const [sx, sy] = worldToScreen(camera, peak.x, peak.y);
    const size = peak.size;

    // Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
    ctx.beginPath();
    ctx.moveTo(sx - size, sy + size);
    ctx.lineTo(sx + size, sy + size);
    ctx.lineTo(sx, sy);
    ctx.closePath();
    ctx.fill();

    // Mountain body
    ctx.fillStyle = "#8d7c71";
    ctx.strokeStyle = "#5a4d46";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(sx - size, sy + size);
    ctx.lineTo(sx + size, sy + size);
    ctx.lineTo(sx, sy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Snow cap
    ctx.fillStyle = "#fffaf0";
    ctx.beginPath();
    ctx.moveTo(sx - size * 0.35, sy + size * 0.35);
    ctx.lineTo(sx + size * 0.35, sy + size * 0.35);
    ctx.lineTo(sx, sy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** Traces a "smooth" closed path through a list of points (already in screen-space) using quadraticCurveTo from
 * midpoint-to-midpoint, using the original points as control points — turning a sharp polygon
 * into a natural rounded blob shape without adding extra points. Does not call ctx.fill()/stroke() —
 * caller decides the styling. */
function traceBlobPath(ctx: CanvasRenderingContext2D, points: [number, number][]) {
  const n = points.length;
  const [lastX, lastY] = points[n - 1];
  const [firstX, firstY] = points[0];
  ctx.beginPath();
  ctx.moveTo((lastX + firstX) / 2, (lastY + firstY) / 2);
  for (let i = 0; i < n; i++) {
    const [curX, curY] = points[i];
    const [nextX, nextY] = points[(i + 1) % n];
    ctx.quadraticCurveTo(curX, curY, (curX + nextX) / 2, (curY + nextY) / 2);
  }
  ctx.closePath();
}

const SHORE_RING_WIDTH = 22;

/**
 * Per-lake render geometry, precomputed ONCE at module load. Lake polygons are static (the same shape every
 * frame — only the camera moves), so the world-space water/shore/wet-shore point rings never change. Previously
 * drawLake rebuilt three fresh arrays with `.map()` every frame (the river alone has ~132 vertices → ~1200 tuple
 * allocations/frame just for it), plus recomputed hypot/scale per vertex. Now we store the static world-space rings
 * and reusable screen-space scratch arrays that we overwrite in place each frame (subtract camera → no allocation).
 * `maxBoundingRadius` is also precomputed here for the off-screen cull in render().
 */
interface LakeRenderGeometry {
  water: { x: number; y: number }[];
  shore: { x: number; y: number }[];
  wetShore: { x: number; y: number }[];
  waterScreen: [number, number][];
  shoreScreen: [number, number][];
  wetShoreScreen: [number, number][];
  maxBoundingRadius: number;
}

const lakeRenderGeometry = new Map<string, LakeRenderGeometry>();
for (const lake of LAKE_DEFINITIONS) {
  const water = lake.polygon.map((p) => ({ x: lake.centerX + p.x, y: lake.centerY + p.y }));
  const shore = lake.polygon.map((p) => {
    const len = Math.max(Math.hypot(p.x, p.y), 1);
    const scale = (len + SHORE_RING_WIDTH) / len;
    return { x: lake.centerX + p.x * scale, y: lake.centerY + p.y * scale };
  });
  const wetShore = lake.polygon.map((p) => {
    const len = Math.max(Math.hypot(p.x, p.y), 1);
    const scale = (len + SHORE_RING_WIDTH * 0.42) / len;
    return { x: lake.centerX + p.x * scale, y: lake.centerY + p.y * scale };
  });
  let maxR = 0;
  for (const p of lake.polygon) {
    const d = Math.hypot(p.x, p.y);
    if (d > maxR) maxR = d;
  }
  lakeRenderGeometry.set(lake.id, {
    water,
    shore,
    wetShore,
    waterScreen: water.map(() => [0, 0] as [number, number]),
    shoreScreen: shore.map(() => [0, 0] as [number, number]),
    wetShoreScreen: wetShore.map(() => [0, 0] as [number, number]),
    maxBoundingRadius: maxR + SHORE_RING_WIDTH,
  });
}

/** Overwrites `screen` in place with the camera-projected coords of `world` (no allocation). */
function projectRing(camera: Camera, world: { x: number; y: number }[], screen: [number, number][]): void {
  const offX = camera.width / 2 - camera.x;
  const offY = camera.height / 2 - camera.y;
  for (let i = 0; i < world.length; i++) {
    screen[i][0] = world[i].x + offX;
    screen[i][1] = world[i].y + offY;
  }
}

function drawLake(ctx: CanvasRenderingContext2D, camera: Camera, lake: LakeDefinition, nowMs: number) {
  const geo = lakeRenderGeometry.get(lake.id)!;
  const waterPoints = geo.waterScreen;
  const shorePoints = geo.shoreScreen;
  const wetShorePoints = geo.wetShoreScreen;
  projectRing(camera, geo.water, waterPoints);
  projectRing(camera, geo.shore, shorePoints);
  projectRing(camera, geo.wetShore, wetShorePoints);

  // Screen-space bounds of the water ring — computed once here in a single pass and reused by the river
  // flow lines + lake-name placement below (previously each did its own Math.min/max(...map()) spread).
  let minSx = Infinity;
  let maxSx = -Infinity;
  let minSy = Infinity;
  let maxSy = -Infinity;
  for (const [sx, sy] of waterPoints) {
    if (sx < minSx) minSx = sx;
    if (sx > maxSx) maxSx = sx;
    if (sy < minSy) minSy = sy;
    if (sy > maxSy) maxSy = sy;
  }

  const [cx, cy] = worldToScreen(camera, lake.centerX, lake.centerY);
  const maxRadius = Math.max(lake.baseRadiusX, lake.baseRadiusY);

  const isSea = lake.id === "bien_dong";

  ctx.save();
  if (!isSea) {
    // 1. Shore drop-shadow (blends sand into grass)
    ctx.fillStyle = "rgba(45, 60, 20, 0.16)";
    ctx.save();
    ctx.translate(3, 5);
    traceBlobPath(ctx, shorePoints);
    ctx.fill();
    ctx.restore();

    // 2. Dry Sand layer
    ctx.fillStyle = "#ebd7a0";
    traceBlobPath(ctx, shorePoints);
    ctx.fill();

    // 3. Wet Sand layer
    ctx.fillStyle = "#d5c088";
    traceBlobPath(ctx, wetShorePoints);
    ctx.fill();
  }

  // 4. Lake water surface depth gradient
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxRadius * 1.4);
  gradient.addColorStop(0, "#19547b");
  gradient.addColorStop(0.65, "#3b8cb3");
  gradient.addColorStop(1, "#66bcd8");
  ctx.fillStyle = gradient;
  traceBlobPath(ctx, waterPoints);
  ctx.fill();

  // 5. Water shoreline shadow (inner water rim)
  ctx.strokeStyle = "rgba(20, 70, 95, 0.3)";
  ctx.lineWidth = 6;
  traceBlobPath(ctx, waterPoints);
  ctx.stroke();

  // 6. Dynamic Shore foam wash
  const foamWave = Math.sin(nowMs / 400) * 1.5;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.38)";
  ctx.lineWidth = 3 + foamWave;
  traceBlobPath(ctx, waterPoints);
  ctx.stroke();
  ctx.restore();

  // Draw procedural lily pads & lotus flowers inside the water
  ctx.save();
  traceBlobPath(ctx, waterPoints);
  ctx.clip();

  const lakeSeed = hashString(lake.id);
  const lilyPadCount = 4 + (lakeSeed % 5);
  for (let i = 0; i < lilyPadCount; i++) {
    const angle = (i / lilyPadCount) * Math.PI * 2 + (lakeSeed % 100) * 0.1;
    const distFrac = 0.25 + 0.5 * hashCell(i, 99, lakeSeed % 50);
    const padR = maxRadius * distFrac;
    const px = lake.centerX + Math.cos(angle) * padR;
    const py = lake.centerY + Math.sin(angle) * padR;

    const [psx, psy] = worldToScreen(camera, px, py);
    const size = 6 + hashCell(i, 88, 10) * 6;

    // Cozy swaying animation for lily pads
    const swayX = Math.sin(nowMs / 900 + i * 2) * 3;
    const swayY = Math.cos(nowMs / 1000 + i * 1.5) * 2.2;
    const lpsx = psx + swayX;
    const lpsy = psy + swayY;

    // Pad shadow on water
    ctx.fillStyle = "rgba(10, 30, 45, 0.25)";
    ctx.beginPath();
    ctx.arc(lpsx + 1.5, lpsy + 2, size, 0, Math.PI * 2);
    ctx.fill();

    // Draw cute green lily pad with a slice cut out
    ctx.fillStyle = "#3e8e58";
    ctx.strokeStyle = "#245736";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(lpsx, lpsy, size, 0.12 * Math.PI * 2, 0.88 * Math.PI * 2);
    ctx.lineTo(lpsx, lpsy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 30% chance to draw a tiny pink lotus flower
    if (hashCell(i, 77, 20) < 0.3) {
      ctx.fillStyle = "#ffbde6";
      ctx.strokeStyle = "#db62ab";
      ctx.lineWidth = 0.8;
      for (let p = 0; p < 4; p++) {
        const pa = (p / 4) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(lpsx + Math.cos(pa) * (size * 0.4), lpsy + Math.sin(pa) * (size * 0.4), size * 0.3, size * 0.15, pa, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = "#ffd93d";
      ctx.beginPath();
      ctx.arc(lpsx, lpsy, size * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Render horizontal flowing current lines if it is the main river (Sông Hàn)
  if (lake.id === "song_chinh") {
    ctx.save();
    traceBlobPath(ctx, waterPoints);
    ctx.clip();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
    ctx.lineWidth = 2.2;
    ctx.setLineDash([30, 90]);

    const flowOffset = (nowMs * 0.08) % 120;

    ctx.lineDashOffset = -flowOffset;
    for (const offset of [-45, -15, 15, 45]) {
      ctx.beginPath();
      ctx.moveTo(minSx - 50, (minSy + maxSy) / 2 + offset);
      for (let x = minSx - 50; x <= maxSx + 50; x += 80) {
        const worldX = x + camera.x - camera.width / 2;
        const worldY = 450 * Math.sin(worldX / 1100) - 800 + offset;
        const [, sy] = worldToScreen(camera, worldX, worldY);
        ctx.lineTo(x, sy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }



  // Lake name, shown above the water block — helps orientation on the large map with many lakes.
  // (minSy computed once at the top of drawLake.)
  ctx.save();
  ctx.font = "bold 14px 'Baloo 2', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.strokeStyle = "rgba(20, 70, 95, 0.75)";
  ctx.lineWidth = 3;
  ctx.strokeText(lake.name, cx, minSy - 12);
  ctx.fillStyle = "#fffaf0";
  ctx.fillText(lake.name, cx, minSy - 12);
  ctx.restore();
}

function drawWorldBounds(ctx: CanvasRenderingContext2D, camera: Camera) {
  const [, y0] = worldToScreen(camera, -WORLD_WIDTH / 2, -WORLD_HEIGHT / 2);
  const [x1, y1] = worldToScreen(camera, WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
  ctx.save();
  // Draw soft sea foam wash border ONLY on the right beach shore
  ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x1, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.restore();
}

function drawFences(ctx: CanvasRenderingContext2D, camera: Camera) {
  ctx.save();
  // Rustic cozy wooden color
  ctx.fillStyle = "#8b5e34";
  ctx.strokeStyle = "#5c3d21";
  ctx.lineWidth = 3;

  const postSpacing = 50;
  const fenceY_top = -WORLD_HEIGHT / 2 + 12;
  const fenceY_bottom = WORLD_HEIGHT / 2 - 12;
  const fenceX_left = -WORLD_WIDTH / 2 + 12;
  const fenceX_right = WORLD_WIDTH / 2 - 80;

  // 1. Draw Rails (horizontal connecting bars) for Top Fence
  const [sx_start_top, sy_top] = worldToScreen(camera, -WORLD_WIDTH / 2, fenceY_top);
  const [sx_end_top] = worldToScreen(camera, fenceX_right, fenceY_top);
  ctx.beginPath();
  ctx.moveTo(sx_start_top, sy_top - 5);
  ctx.lineTo(sx_end_top, sy_top - 5);
  ctx.moveTo(sx_start_top, sy_top + 3);
  ctx.lineTo(sx_end_top, sy_top + 3);
  ctx.stroke();

  // 2. Draw Rails for Bottom Fence
  const [sx_start_bot, sy_bot] = worldToScreen(camera, -WORLD_WIDTH / 2, fenceY_bottom);
  const [sx_end_bot] = worldToScreen(camera, fenceX_right, fenceY_bottom);
  ctx.beginPath();
  ctx.moveTo(sx_start_bot, sy_bot - 5);
  ctx.lineTo(sx_end_bot, sy_bot - 5);
  ctx.moveTo(sx_start_bot, sy_bot + 3);
  ctx.lineTo(sx_end_bot, sy_bot + 3);
  ctx.stroke();

  // 3. Draw Rails for Left Fence
  const [sx_l, sy_start_l] = worldToScreen(camera, fenceX_left, -WORLD_HEIGHT / 2);
  const [, sy_end_l] = worldToScreen(camera, fenceX_left, WORLD_HEIGHT / 2);
  ctx.beginPath();
  ctx.moveTo(sx_l - 4, sy_start_l);
  ctx.lineTo(sx_l - 4, sy_end_l);
  ctx.moveTo(sx_l + 4, sy_start_l);
  ctx.lineTo(sx_l + 4, sy_end_l);
  ctx.stroke();

  // 4. Draw Posts (vertical logs)
  // Top Fence Posts
  for (let x = -WORLD_WIDTH / 2; x <= fenceX_right; x += postSpacing) {
    const [sx, sy] = worldToScreen(camera, x, fenceY_top);
    if (sx < -20 || sx > camera.width + 20 || sy < -20 || sy > camera.height + 20) continue;
    // Draw post shadow
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(sx - 3, sy - 10, 8, 16);
    // Draw post body
    ctx.fillStyle = "#8b5e34";
    ctx.fillRect(sx - 4, sy - 12, 8, 20);
    ctx.strokeRect(sx - 4, sy - 12, 8, 20);
  }

  // Bottom Fence Posts
  for (let x = -WORLD_WIDTH / 2; x <= fenceX_right; x += postSpacing) {
    const [sx, sy] = worldToScreen(camera, x, fenceY_bottom);
    if (sx < -20 || sx > camera.width + 20 || sy < -20 || sy > camera.height + 20) continue;
    // Draw post shadow
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(sx - 3, sy - 10, 8, 16);
    // Draw post body
    ctx.fillStyle = "#8b5e34";
    ctx.fillRect(sx - 4, sy - 12, 8, 20);
    ctx.strokeRect(sx - 4, sy - 12, 8, 20);
  }

  // Left Fence Posts
  for (let y = -WORLD_HEIGHT / 2; y <= WORLD_HEIGHT / 2; y += postSpacing) {
    const [sx, sy] = worldToScreen(camera, fenceX_left, y);
    if (sx < -20 || sx > camera.width + 20 || sy < -20 || sy > camera.height + 20) continue;
    // Draw post shadow
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(sx - 3, sy - 10, 8, 16);
    // Draw post body
    ctx.fillStyle = "#8b5e34";
    ctx.fillRect(sx - 4, sy - 12, 8, 20);
    ctx.strokeRect(sx - 4, sy - 12, 8, 20);
  }

  ctx.restore();
}

function drawTree(ctx: CanvasRenderingContext2D, sx: number, sy: number) {
  ctx.save();
  // Shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
  ctx.beginPath();
  ctx.ellipse(sx, sy + 6, 18, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Trunk
  ctx.fillStyle = "#694a37";
  ctx.strokeStyle = "#38251a";
  ctx.lineWidth = 2;
  ctx.fillRect(sx - 5, sy - 15, 10, 22);
  ctx.strokeRect(sx - 5, sy - 15, 10, 22);

  // Foliage - Layer 1 (Dark bottom)
  ctx.fillStyle = "#3e6e3c";
  ctx.beginPath();
  ctx.arc(sx, sy - 20, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Foliage - Layer 2 (Medium middle)
  ctx.fillStyle = "#4a8a47";
  ctx.beginPath();
  ctx.arc(sx - 10, sy - 34, 18, 0, Math.PI * 2);
  ctx.arc(sx + 10, sy - 34, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Foliage - Layer 3 (Light top)
  ctx.fillStyle = "#5fa85c";
  ctx.beginPath();
  ctx.arc(sx, sy - 46, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

const TREE_CELL_SIZE = 150;
interface TreeCell {
  worldX: number;
  worldY: number;
}
const treeCache = new Map<string, TreeCell | null>();

/** Static tree placement decision for a cell (28% roll + jitter + mountain/lake/start-zone/bounds
 * checks) — all a pure function of the cell coordinate, computed once and cached. */
function computeTreeCell(cx: number, cy: number): TreeCell | null {
  // 28% chance of tree per grid cell
  const roll = hashCell(cx, cy, 33);
  if (roll > 0.28) return null;

  const jitterX = (hashCell(cx, cy, 34) - 0.5) * TREE_CELL_SIZE * 0.6;
  const jitterY = (hashCell(cx, cy, 35) - 0.5) * TREE_CELL_SIZE * 0.6;
  const worldX = (cx + 0.5) * TREE_CELL_SIZE + jitterX;
  const worldY = (cy + 0.5) * TREE_CELL_SIZE + jitterY;

  // Skip if inside mountains, or inside/near any lake edge
  if (isInsideMountains(worldX, worldY) || isInsideAnyLake(worldX, worldY) || isNearAnyLakeEdge(worldX, worldY)) return null;
  // Skip starting zone
  if (Math.hypot(worldX, worldY) < 160) return null;
  // Clamp to grass landmass (excluding beach margins)
  if (Math.abs(worldX) > WORLD_WIDTH / 2 - 50 || Math.abs(worldY) > WORLD_HEIGHT / 2 - 50) return null;

  return { worldX, worldY };
}

function drawProceduralTrees(ctx: CanvasRenderingContext2D, camera: Camera) {
  const startCx = Math.floor((camera.x - camera.width / 2) / TREE_CELL_SIZE) - 1;
  const endCx = Math.floor((camera.x + camera.width / 2) / TREE_CELL_SIZE) + 1;
  const startCy = Math.floor((camera.y - camera.height / 2) / TREE_CELL_SIZE) - 1;
  const endCy = Math.floor((camera.y + camera.height / 2) / TREE_CELL_SIZE) + 1;

  for (let cx = startCx; cx <= endCx; cx++) {
    for (let cy = startCy; cy <= endCy; cy++) {
      const cell = cachedCell(treeCache, cx, cy, computeTreeCell);
      if (!cell) continue;

      const [sx, sy] = worldToScreen(camera, cell.worldX, cell.worldY);
      if (sx < -40 || sy < -60 || sx > camera.width + 40 || sy > camera.height + 40) continue;

      drawTree(ctx, sx, sy);
    }
  }
}

const BLINK_PERIOD_MS = 3400;
const BLINK_DURATION_MS = 140;

/** Tiny signature accessory per skin, drawn just above the character in screen space (kept
 * upright regardless of which way the body is rotated, like a name tag). */
function drawTopper(ctx: CanvasRenderingContext2D, topX: number, topY: number, refSize: number, topper: SkinTopper) {
  if (topper === "none") return;
  const leafGreen = "#3f9e6a";

  ctx.save();
  ctx.fillStyle = leafGreen;
  ctx.strokeStyle = leafGreen;

  if (topper === "leaf") {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(topX + side * refSize * 0.28, topY, refSize * 0.22, refSize * 0.12, side * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (topper === "citrus") {
    ctx.lineWidth = refSize * 0.12;
    ctx.beginPath();
    ctx.moveTo(topX, topY + refSize * 0.15);
    ctx.lineTo(topX, topY - refSize * 0.15);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(topX + refSize * 0.22, topY - refSize * 0.1, refSize * 0.2, refSize * 0.1, -0.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (topper === "sun") {
    ctx.fillStyle = "#ffd93d";
    for (const dx of [-0.35, 0, 0.35]) {
      ctx.beginPath();
      ctx.moveTo(topX + dx * refSize, topY + refSize * 0.2);
      ctx.lineTo(topX + dx * refSize - refSize * 0.08, topY - refSize * 0.25);
      ctx.lineTo(topX + dx * refSize + refSize * 0.08, topY - refSize * 0.25);
      ctx.closePath();
      ctx.fill();
    }
  } else if (topper === "berry-cap") {
    for (const dx of [-0.3, 0, 0.3]) {
      ctx.beginPath();
      ctx.moveTo(topX + dx * refSize, topY + refSize * 0.15);
      ctx.lineTo(topX + dx * refSize - refSize * 0.12, topY - refSize * 0.15);
      ctx.lineTo(topX + dx * refSize + refSize * 0.12, topY - refSize * 0.15);
      ctx.closePath();
      ctx.fill();
    }
  } else if (topper === "tendril") {
    ctx.lineWidth = refSize * 0.1;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(topX, topY + refSize * 0.2);
    ctx.quadraticCurveTo(topX + refSize * 0.3, topY, topX, topY - refSize * 0.2);
    ctx.quadraticCurveTo(topX - refSize * 0.25, topY - refSize * 0.3, topX - refSize * 0.1, topY - refSize * 0.45);
    ctx.stroke();
  }
  ctx.restore();
}

/** Shared upright chibi angler renderer. World anchors and skin IDs remain unchanged. */
function drawCharacter(
  ctx: CanvasRenderingContext2D, sx: number, sy: number, size: number,
  angle: number, skin: SkinDefinition, playerId: string,
  animation: PlayerAnimation, nowMs: number,
) {
  const palette = { outline: "#354b42", skin: "#f4c69e", cheek: "#e68e7e",
    hair: "#674737", hat: "#ead39a", brim: "#c3a46a", boots: "#405c51",
    white: "#fffaf0", shadow: "rgba(36,64,48,0.18)", rod: "#825c3b" };
  const sinking = animation.isDraggedDown ? Math.max(0, nowMs - animation.draggedDownStartMs) : 0;
  const bob = animation.isMoving ? Math.sin(animation.walkPhase * 2) * 0.025 : Math.sin(nowMs / 500) * 0.015;
  const facing = Math.cos(angle) < -0.15 ? -1 : 1;
  const stride = animation.isMoving ? Math.sin(animation.walkPhase) * 0.09 : 0;
  ctx.save();
  ctx.globalAlpha *= Math.max(0, 1 - sinking / 1500);
  ctx.translate(sx, sy + sinking * 0.08);
  ctx.scale(size, size);
  ctx.lineWidth = 0.045;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const oval = (x: number, y: number, rx: number, ry: number, fill: string, outline = true) => {
    ctx.fillStyle = fill; ctx.strokeStyle = palette.outline;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    if (outline) ctx.stroke();
  };
  const rounded = (x: number, y: number, w: number, h: number, r: number, fill: string) => {
    ctx.fillStyle = fill; ctx.strokeStyle = palette.outline;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); ctx.stroke();
  };
  oval(0, 1.12, 0.46, 0.1, palette.shadow, false);
  ctx.translate(0, bob);
  // Alternating boots and a compact jacket keep the silhouette readable at game scale.
  rounded(-0.29, 0.88 + stride, 0.24, 0.25, 0.08, palette.boots);
  rounded(0.05, 0.88 - stride, 0.24, 0.25, 0.08, palette.boots);
  rounded(-0.32, 0.5, 0.64, 0.46, 0.16, skin.bodyColor);
  ctx.strokeStyle = palette.outline; ctx.lineWidth = 0.025;
  ctx.beginPath(); ctx.moveTo(0, 0.66); ctx.lineTo(0, 0.92); ctx.stroke();
  rounded(-0.24, 0.73, 0.15, 0.12, 0.025, palette.hat);
  oval(-facing * 0.34, 0.73 + stride * 0.3, 0.1, 0.13, palette.skin);
  // Rod is held on the facing side; the live line shares this exact tip.
  ctx.strokeStyle = palette.rod; ctx.lineWidth = 0.065;
  ctx.beginPath(); ctx.moveTo(facing * 0.36, 0.83);
  ctx.quadraticCurveTo(facing * 0.61, 0.22, facing * 0.72, -0.24); ctx.stroke();
  oval(facing * 0.43, 0.67, 0.065, 0.065, palette.brim);
  oval(facing * 0.36, 0.72, 0.11, 0.1, palette.skin);
  // Oversized head, ears, fringe, and tiny directional eyes.
  oval(-0.38, 0.35, 0.08, 0.11, palette.skin);
  oval(0.38, 0.35, 0.08, 0.11, palette.skin);
  oval(0, 0.3, 0.39, 0.34, palette.skin);
  oval(0, 0.095, 0.37, 0.14, palette.hair, false);
  const look = Math.cos(angle) * 0.045;
  const blink = (nowMs + hashString(playerId) % BLINK_PERIOD_MS) % BLINK_PERIOD_MS < BLINK_DURATION_MS;
  for (const side of [-1, 1]) {
    oval(side * 0.235, 0.43, 0.07, 0.035, palette.cheek, false);
    if (blink) {
      ctx.strokeStyle = palette.outline; ctx.lineWidth = 0.03;
      ctx.beginPath(); ctx.moveTo(side * 0.14 + look - 0.045, 0.34);
      ctx.lineTo(side * 0.14 + look + 0.045, 0.34); ctx.stroke();
    } else {
      oval(side * 0.14 + look, 0.33, 0.035, 0.052, palette.outline, false);
      oval(side * 0.14 + look - 0.009, 0.313, 0.01, 0.014, palette.white, false);
    }
  }
  ctx.strokeStyle = palette.outline; ctx.lineWidth = 0.023;
  ctx.beginPath(); ctx.arc(look, 0.44, 0.05, 0.15, Math.PI - 0.15); ctx.stroke();
  // Straw bucket hat with a skin-coloured ribbon and original collectible topper.
  oval(0, 0.06, 0.53, 0.13, palette.brim);
  rounded(-0.34, -0.23, 0.68, 0.3, 0.12, palette.hat);
  ctx.fillStyle = skin.bodyColor; ctx.fillRect(-0.315, -0.025, 0.63, 0.075);
  ctx.strokeStyle = palette.outline; ctx.lineWidth = 0.025;
  ctx.beginPath(); ctx.moveTo(-0.31, 0.055); ctx.lineTo(0.31, 0.055); ctx.stroke();
  drawTopper(ctx, 0.18, -0.23, 0.3, skin.topper);
  ctx.restore();
}

/** Small bouncing marker above the local player. */
function drawYouMarker(ctx: CanvasRenderingContext2D, sx: number, sy: number, size: number, nowMs: number) {
  const radius = size * BALL_RADIUS_RATIO;
  const bounce = Math.sin(nowMs / 300) * 4;
  const tipY = sy - radius * 1.8 + bounce;
  ctx.save();
  ctx.fillStyle = "#ffd93d";
  ctx.strokeStyle = "#c9960a";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(sx, tipY + 8);
  ctx.lineTo(sx - 6, tipY - 4);
  ctx.lineTo(sx + 6, tipY - 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Renders a single idle character for the skin picker preview on the connect screen. */
export function drawSkinPreview(ctx: CanvasRenderingContext2D, width: number, height: number, skinId: string, nowMs: number) {
  ctx.clearRect(0, 0, width, height);
  const skin = getSkinDefinition(skinId);
  const idleAnimation: PlayerAnimation = { x: 0, y: 0, angle: -Math.PI / 2, walkPhase: 0, isMoving: false, isDraggedDown: false, draggedDownStartMs: 0 };
  drawCharacter(ctx, width / 2, height * 0.29, Math.min(width / 1.65, height / 1.55), -Math.PI / 2, skin, skinId, idleAnimation, nowMs);
}

function drawNameTag(ctx: CanvasRenderingContext2D, sx: number, sy: number, size: number, player: PlayerState) {
  ctx.font = "bold 13px 'Baloo 2', system-ui, sans-serif";
  ctx.textAlign = "center";
  const label = player.name;
  const y = sy - size * 0.8 - 10;
  ctx.strokeStyle = "rgba(45, 74, 31, 0.85)";
  ctx.lineWidth = 3;
  ctx.strokeText(label, sx, y);
  ctx.fillStyle = "#fffaf0";
  ctx.fillText(label, sx, y);
}

/** Reeling minigame — reconstructed the whole frame according to the Stardew Valley image sent by Vicent (2026-07-14): 1 vertical
 * wooden frame, on the left is a metal ruler bar with notches + a tiny angler sitting in the bottom corner, in the middle is
 * a blue water channel containing the green "catching zone" (`zoneY` ± `zoneSize`/2, player holds mouse to push up / releases to
 * drop down) and the fish (`fishY`) swimming around erratically, on the right is a progress bar rising from the bottom
 * based on `progress` (changes color red→yellow→green based on %). The catching zone glows when the fish is inside. Drawn
 * compactly in a 260x360 canvas (see ui.ts#updateFishingModal). */
export function drawModalReelScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  fishY: number, // 0..100, 0 = đáy máng, 100 = đỉnh máng
  zoneY: number, // 0..100, tâm ô bắt
  zoneSize: number, // 0..100, bề cao ô bắt
  fishColor: string,
  nowMs: number,
  progress: number = 0, // 0..100, % tiến độ bắt cá — cột progress bên phải
  speciesId: string = "", // chọn hình cá riêng theo loài (xem fishArt.ts)
) {
  ctx.clearRect(0, 0, width, height);
  const colors = { water: "#d5e8e0", line: "#abc9bb", ink: "#234c43", zone: "#9acb88", active: "#b4de95", cream: "#fffaf0", progress: "#327b79" };
  const top = 12, bottom = height - 12, laneX = 48, laneW = width - 68;
  const toY = (value: number) => bottom - Math.max(0, Math.min(100, value)) / 100 * (bottom - top);
  ctx.save();
  ctx.fillStyle = colors.water;
  ctx.beginPath(); ctx.roundRect(laneX, top, laneW, bottom - top, 18); ctx.fill();
  ctx.save(); ctx.clip();
  ctx.strokeStyle = colors.line; ctx.lineWidth = 1;
  for (let i = 0; i < 10; i++) {
    const y = top + (i * 42 + nowMs / 90) % (bottom - top);
    ctx.beginPath(); ctx.moveTo(laneX, y); ctx.quadraticCurveTo(laneX + laneW / 2, y - 8, laneX + laneW, y); ctx.stroke();
  }
  const zoneTop = toY(zoneY + zoneSize / 2), zoneBottom = toY(zoneY - zoneSize / 2);
  ctx.fillStyle = Math.abs(fishY - zoneY) <= zoneSize / 2 ? colors.active : colors.zone;
  ctx.strokeStyle = colors.ink; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(laneX + 8, zoneTop, laneW - 16, Math.max(4, zoneBottom - zoneTop), 9); ctx.fill(); ctx.stroke();
  drawFishIcon(ctx, laneX + laneW / 2, toY(fishY), laneW * 0.65, speciesId, fishColor, Math.sin(nowMs / 130) * 0.5, 1);
  ctx.restore();
  ctx.strokeStyle = colors.line; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(laneX, top, laneW, bottom - top, 18); ctx.stroke();
  ctx.fillStyle = colors.water;
  ctx.beginPath(); ctx.roundRect(16, top, 12, bottom - top, 6); ctx.fill();
  const fillY = toY(progress);
  ctx.fillStyle = colors.progress;
  if (bottom > fillY) { ctx.beginPath(); ctx.roundRect(16, fillY, 12, bottom - fillY, 6); ctx.fill(); }
  ctx.restore();
}

/** Fishing line + bobber, drawn from wherever the character stands out to their bobber's world
 * position — visible any time fishState isn't "idle". The bobber bobs gently while waiting and
 * jerks rapidly while reeling (someone's fighting a fish over there!) — the actual reel minigame
 * (single vertical bar + catch zone + fish, xem `drawModalReelScene`) is drawn inside the fishing
 * modal (xem ui.ts#updateFishingModal), full-screen and in focus, not competing with this small
 * world icon. */
function drawFishingLineAndBobber(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  sx: number,
  sy: number,
  size: number,
  player: PlayerState,
  nowMs: number,
) {
  if (player.fishState === "idle") return;
  const [bx, by] = worldToScreen(camera, player.bobberX, player.bobberY);

  const isReeling = player.fishState === "reeling";

  const bob = isReeling ? Math.sin(nowMs / 60) * 5 : Math.sin(nowMs / 500) * 2.5;
  const bobberY = by + bob;

  // Line from roughly the character's hand/body height out to the bobber.
  const facing = Math.cos(player.angle) < -0.15 ? -1 : 1;
  const lineStartY = sy - size * 0.24;
  ctx.save();
  ctx.strokeStyle = "rgba(60, 50, 40, 0.75)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(sx + facing * size * 0.72, lineStartY);
  ctx.lineTo(bx, bobberY);
  ctx.stroke();

  // Bobber (red/white classic fishing float).
  ctx.fillStyle = "#e8433f";
  ctx.beginPath();
  ctx.arc(bx, bobberY - 4, 6, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fffaf0";
  ctx.beginPath();
  ctx.arc(bx, bobberY + 2, 6, 0, Math.PI);
  ctx.fill();
  ctx.strokeStyle = "rgba(45,30,20,0.6)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(bx, bobberY - 1, 6, 0, Math.PI * 2);
  ctx.stroke();

  // Small ripple rings while waiting/reeling, growing and fading on a loop (faster while reeling
  // — the fish is thrashing under the surface).
  if (player.fishState === "waiting" || isReeling) {
    const period = isReeling ? 400 : 1400;
    const phase = (nowMs % period) / period;
    ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - phase)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(bx, bobberY + 4, 8 + phase * 16, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export interface VisualPosition {
  x: number;
  y: number;
}

/** Where a player should actually be drawn this frame — just the animator's smoothed position now
 * that there's no pounce leap arc to interpolate (no PvP in the fishing pivot). */
export function computePlayerVisualPosition(_player: PlayerState, animation: PlayerAnimation): VisualPosition {
  return { x: animation.x, y: animation.y };
}

export interface RenderOptions {
  /** Hide navigational overlays in decorative landing previews. */
  showLandmarks?: boolean;
  snapshot: RoomSnapshot;
  camera: Camera;
  localPlayerId: string | null;
  nowMs: number;
  getPlayerAnimation: (playerId: string) => PlayerAnimation;
  /** Physical-to-CSS pixel ratio of the canvas backing store (window.devicePixelRatio). Applied on top of the
   * zoom scale so the scene renders at native resolution on HiDPI/Retina displays instead of being upscaled/blurry.
   * Defaults to 1. */
  devicePixelRatio?: number;
}

/** Instant water splash effect when the bobber hits the lake surface (Vicent 2026-07-14): a few expanding ripple rings +
 * some water droplets shooting up and falling down. Short-lived state (~650ms), kept in this module so
 * render() remains "snapshot -> pixels"; main.ts calls `spawnCastSplash` at the exact moment the bobber lands. */
interface CastSplash {
  x: number;
  y: number;
  startMs: number;
  drops: { vx: number; vy: number }[];
}
const castSplashes: CastSplash[] = [];
const CAST_SPLASH_DURATION_MS = 650;

// Reused across frames to avoid allocating a fresh Map every render() — cleared at the start of each frame.
const visualsScratch = new Map<string, VisualPosition>();

export function spawnCastSplash(worldX: number, worldY: number, nowMs: number): void {
  const drops: { vx: number; vy: number }[] = [];
  for (let i = 0; i < 8; i++) {
    // Mainly shoots upwards (-90°) spreading to both sides, random speed for natural look.
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.7;
    const speed = 55 + Math.random() * 95;
    drops.push({ vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed });
  }
  castSplashes.push({ x: worldX, y: worldY, startMs: nowMs, drops });
}

function drawCastSplashes(ctx: CanvasRenderingContext2D, camera: Camera, nowMs: number): void {
  for (let i = castSplashes.length - 1; i >= 0; i--) {
    const s = castSplashes[i];
    const elapsed = nowMs - s.startMs;
    if (elapsed >= CAST_SPLASH_DURATION_MS || elapsed < 0) {
      castSplashes.splice(i, 1);
      continue;
    }
    const t = elapsed / CAST_SPLASH_DURATION_MS;
    const [sx, sy] = worldToScreen(camera, s.x, s.y);
    if (sx < -60 || sy < -60 || sx > camera.width + 60 || sy > camera.height + 60) continue;

    ctx.save();
    // Ripple rings: 3 rings expanding in staggered intervals, flattened vertically for an angled perspective of the water surface.
    const easeOut = 1 - Math.pow(1 - t, 2);
    for (let r = 0; r < 3; r++) {
      const rt = t * 1.2 - r * 0.16;
      if (rt <= 0 || rt >= 1) continue;
      const radius = 4 + easeOut * (20 + r * 9);
      ctx.strokeStyle = `rgba(255, 255, 255, ${(1 - rt) * 0.5})`;
      ctx.lineWidth = 2 - r * 0.4;
      ctx.beginPath();
      ctx.ellipse(sx, sy, radius, radius * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Water droplets: parabolic trajectory (gravity), fading out, disappearing when falling back to the water surface.
    const ts = elapsed / 1000;
    const g = 340;
    for (const d of s.drops) {
      const px = d.vx * ts;
      const py = d.vy * ts + 0.5 * g * ts * ts;
      if (py > 5) continue;
      ctx.fillStyle = `rgba(206, 233, 250, ${Math.max(0, 1 - t * 1.4)})`;
      ctx.beginPath();
      ctx.arc(sx + px, sy + py, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/** Lake name drawn right in the MIDDLE of the lake (Vicent 2026-07-14) — uses AABB center (bounds) instead of centerX/Y, because
 * some lakes (especially the river) have centerX/Y = 0,0 far from the actual body. Cozy brown text with parchment border
 * to stand out against the blue water. World-sized so it automatically scales with zoom. */
function drawLakeName(ctx: CanvasRenderingContext2D, camera: Camera, lake: LakeDefinition): void {
  const midX = (lake.bounds.minX + lake.bounds.maxX) / 2;
  const midY = (lake.bounds.minY + lake.bounds.maxY) / 2;
  const [sx, sy] = worldToScreen(camera, midX, midY);
  ctx.save();
  ctx.font = "700 40px 'Baloo 2', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 7;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(255, 246, 222, 0.9)";
  ctx.strokeText(lake.name, sx, sy);
  ctx.fillStyle = "rgba(74, 48, 22, 0.62)";
  ctx.fillText(lake.name, sx, sy);
  ctx.restore();
}

export function render(ctx: CanvasRenderingContext2D, opts: RenderOptions) {
  const { snapshot, camera, localPlayerId, nowMs } = opts;

  // Zoom: vẽ toàn cảnh trong hệ toạ độ "virtual" (world = virtual px), rồi scale 1 lần xuống pixel
  // thật của canvas — mọi vị trí + kích thước thu nhỏ đồng đều. worldToScreen giữ nguyên (virtual),
  // các phép cull so với camera.width/height (cũng virtual) vẫn đúng. reset về identity sau khi vẽ.
  const zoomScale = camera.scale ?? 1;
  const dpr = opts.devicePixelRatio ?? 1;
  ctx.save();
  // dpr scales the backing store up to native pixels (crisp on Retina); zoomScale shrinks the virtual world
  // into that space. Both are applied once here for the whole scene.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(zoomScale * dpr, zoomScale * dpr);

  clearBackground(ctx, camera, snapshot.players, nowMs);
  for (const lake of LAKE_DEFINITIONS) {
    // Cheap off-screen cull: skip lakes whose bounding circle (max jittered vertex distance, precomputed at
    // module load) can't possibly touch the current viewport, so a big multi-lake map doesn't redraw all of
    // them every frame.
    const maxRadius = lakeRenderGeometry.get(lake.id)!.maxBoundingRadius;
    const [lcx, lcy] = worldToScreen(camera, lake.centerX, lake.centerY);
    if (lcx < -maxRadius || lcy < -maxRadius || lcx > camera.width + maxRadius || lcy > camera.height + maxRadius) continue;
    drawLake(ctx, camera, lake, nowMs);
    if (opts.showLandmarks !== false) drawLakeName(ctx, camera, lake);
  }
  drawWorldBounds(ctx, camera);
  drawProceduralTrees(ctx, camera);
  drawFences(ctx, camera);
  if (opts.showLandmarks !== false) drawShoreSigns(ctx, camera);

  // Hiệu ứng bắn nước vẽ ngay trên mặt hồ, trước khi vẽ nhân vật/phao (nằm dưới các đối tượng đó).
  drawCastSplashes(ctx, camera, nowMs);

  const visuals = visualsScratch;
  visuals.clear();
  for (const player of snapshot.players) {
    visuals.set(player.id, computePlayerVisualPosition(player, opts.getPlayerAnimation(player.id)));
  }

  for (const player of snapshot.players) {
    const vp = visuals.get(player.id)!;
    const [sx, sy] = worldToScreen(camera, vp.x, vp.y);
    if (sx < -100 || sy < -100 || sx > camera.width + 100 || sy > camera.height + 100) continue;

    const isLocal = player.id === localPlayerId;
    const skin = getSkinDefinition(player.skinId);
    const animation = opts.getPlayerAnimation(player.id);

    // Scale character size based on total fish value caught (up to 2.5x original size). Divide score
    // by 10 before square rooting to COMPENSATE for scaling up all values by x10 (Vicent 2026-07-14) — keeping the same
    // growth pacing as before the x10, otherwise character hits 2.5x cap almost instantly (with just 1
    // legendary). The 2.5x cap is now reached when totalValue ≈ 9000 instead of 900.
    const scale = 1 + Math.min(1.5, Math.sqrt((player.totalValue || 0) / 10) * 0.05);
    const dynamicSize = PLAYER_VISUAL_SIZE * scale;

    drawFishingLineAndBobber(ctx, camera, sx, sy, dynamicSize, player, nowMs);
    drawCharacter(ctx, sx, sy, dynamicSize, animation.angle, skin, player.id, animation, nowMs);
    if (isLocal) drawYouMarker(ctx, sx, sy, dynamicSize, nowMs);
    drawNameTag(ctx, sx, sy, dynamicSize, player);
  }

  ctx.restore();
}
