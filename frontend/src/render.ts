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
import { BALL_RADIUS_RATIO, BALL_FOOT_RADIUS_RATIO, PLAYER_VISUAL_SIZE, WORLD_WIDTH, WORLD_HEIGHT } from "./config.ts";
import type { PlayerAnimation } from "./animation.ts";
// Icon cá tách sang module riêng (mỗi loài 1 hình). Re-export để ui.ts vẫn import từ render.ts như cũ.
import { drawFishIcon } from "./fishArt.ts";
export { drawFishIcon };

export interface Camera {
  x: number;
  y: number;
  /** Bề rộng/cao vùng WORLD camera nhìn thấy (đơn vị world = "virtual pixel"). Khi zoom xa, giá trị
   * này > số pixel thật của canvas để lộ nhiều map hơn. */
  width: number;
  height: number;
  /** Hệ số scale virtual→real (= canvasPxWidth / camera.width). <1 = zoom xa. render() áp 1 lần cho
   * cả cảnh nên mọi vị trí + kích thước đều thu nhỏ đồng đều (Vicent 2026-07-14: "zoom map nhỏ lại").
   * Mặc định 1 nếu không set. */
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

// ---- Lake geometry (world-space) — nhiều hồ rải khắp map, hình dạng/kích thước THẬT (gate thả
// cần ở backend, xem shared/src/lakes.ts#LAKE_DEFINITIONS), không còn thuần cosmetic như bản 1 hồ
// ellipse cố định trước đây.
const NEAR_EDGE_THRESHOLD = 60;

/** Gần mép BẤT KỲ hồ nào không (trong khoảng NEAR_EDGE_THRESHOLD tính từ biên, kể cả từ trong hay
 * ngoài hồ) — dùng để rải lau sậy đúng ngay mép nước. */
function isNearAnyLakeEdge(worldX: number, worldY: number): boolean {
  return LAKE_DEFINITIONS.some(
    (lake) =>
      // AABB reject trước: nếu điểm cách AABB của hồ đã xa hơn ngưỡng thì chắc chắn cách biên thật
      // còn xa hơn nữa — bỏ qua distanceToLakeBoundary (quét từng cạnh, sông có ~132 cạnh) cho hồ đó.
      aabbDistanceToLake(lake, worldX, worldY) < NEAR_EDGE_THRESHOLD &&
      distanceToLakeBoundary(lake, worldX, worldY) < NEAR_EDGE_THRESHOLD,
  );
}

const MEADOW_PATCH_CELL_SIZE = 480;
const MEADOW_PATCH_COLORS = ["rgba(150,205,90,0.45)", "rgba(200,235,140,0.5)", "rgba(120,190,80,0.4)"];

/** Các lớp trang trí tĩnh (đồng cỏ, cây, lau sậy...) được rải theo 1 hàm XÁC ĐỊNH của toạ độ ô lưới
 * world — kết quả không bao giờ đổi cho 1 ô. Trước đây mỗi frame lại tính lại placement + các phép
 * kiểm tra hồ/núi đắt tiền (point-in-polygon, sông ~132 đỉnh) cho từng ô đang thấy. Giờ cache quyết
 * định TĨNH của mỗi ô (tính đúng 1 lần cho suốt vòng đời trang), mỗi frame chỉ tra cứu O(1) rồi vẽ.
 * Cache bị chặn trên tự nhiên bởi số ô trong world (~vài nghìn ô/lớp) nên không phình vô hạn.
 * Lưu ý: các yếu tố ĐỘNG (vd né vị trí người chơi cho shore decor) vẫn xử lý lúc vẽ, không cache. */
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
      const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, cell.radius);
      gradient.addColorStop(0, cell.color);
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(sx, sy, cell.radius, 0, Math.PI * 2);
      ctx.fill();
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
  ctx.fillStyle = "#8fc97b";
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

/** Vẽ 1 đường khép kín "mềm" đi qua danh sách điểm (đã ở screen-space) bằng quadraticCurveTo từ
 * trung điểm-tới-trung điểm, dùng chính các điểm gốc làm control point — biến 1 polygon góc cạnh
 * thành 1 hình blob bo tròn tự nhiên mà không cần thêm điểm nào. Không gọi ctx.fill()/stroke() —
 * caller tự quyết định style. */
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

function drawLake(ctx: CanvasRenderingContext2D, camera: Camera, lake: LakeDefinition, nowMs: number) {
  const waterPoints: [number, number][] = lake.polygon.map((p) =>
    worldToScreen(camera, lake.centerX + p.x, lake.centerY + p.y),
  );

  // Dry Sand Shore points (outer shore)
  const shorePoints: [number, number][] = lake.polygon.map((p) => {
    const len = Math.max(Math.hypot(p.x, p.y), 1);
    const scale = (len + SHORE_RING_WIDTH) / len;
    return worldToScreen(camera, lake.centerX + p.x * scale, lake.centerY + p.y * scale);
  });

  // Wet Sand Shore points (inner shore)
  const wetShorePoints: [number, number][] = lake.polygon.map((p) => {
    const len = Math.max(Math.hypot(p.x, p.y), 1);
    const scale = (len + SHORE_RING_WIDTH * 0.42) / len;
    return worldToScreen(camera, lake.centerX + p.x * scale, lake.centerY + p.y * scale);
  });

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
    const minSx = Math.min(...waterPoints.map(([sx]) => sx));
    const maxSx = Math.max(...waterPoints.map(([sx]) => sx));
    const minSy = Math.min(...waterPoints.map(([, sy]) => sy));
    const maxSy = Math.max(...waterPoints.map(([, sy]) => sy));

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



  // Tên hồ, hiện phía trên khối nước — giúp định hướng trên map lớn nhiều hồ.
  const minSy = Math.min(...waterPoints.map(([, sy]) => sy));
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

/** Kirby-style big eyes (white sclera + black pupil + a small glint, closed to a short line while
 * blinking), drawn in the character's own local space (forward = +X, already rotated to face
 * `angle` by the caller). Blink timing is phase-offset per player so a lake full of players
 * doesn't blink in unison. */
function drawEyes(ctx: CanvasRenderingContext2D, forwardOffset: number, spacing: number, eyeRadius: number, nowMs: number, playerId: string) {
  const phaseOffset = hashString(playerId) % BLINK_PERIOD_MS;
  const isBlinking = (nowMs + phaseOffset) % BLINK_PERIOD_MS < BLINK_DURATION_MS;

  for (const side of [-1, 1]) {
    const ey = side * spacing;
    if (isBlinking) {
      ctx.strokeStyle = "#2d2018";
      ctx.lineWidth = Math.max(1.5, eyeRadius * 0.5);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(forwardOffset - eyeRadius, ey);
      ctx.lineTo(forwardOffset + eyeRadius, ey);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#fffaf0";
      ctx.beginPath();
      ctx.arc(forwardOffset, ey, eyeRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2d2018";
      ctx.beginPath();
      ctx.arc(forwardOffset + eyeRadius * 0.15, ey, eyeRadius * 0.62, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fffaf0";
      ctx.beginPath();
      ctx.arc(forwardOffset - eyeRadius * 0.1, ey - eyeRadius * 0.28, eyeRadius * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawEars(ctx: CanvasRenderingContext2D, radius: number, color: string) {
  ctx.fillStyle = color;
  ctx.strokeStyle = "#2d4a1f";
  ctx.lineWidth = Math.max(1.5, radius * 0.1);
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(-radius * 0.15, side * radius * 0.45);
    ctx.rotate(side * 0.4);
    ctx.beginPath();
    ctx.ellipse(0, -radius * 0.75, radius * 0.26, radius * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function drawFins(ctx: CanvasRenderingContext2D, radius: number, color: string, animation: PlayerAnimation) {
  ctx.fillStyle = color;
  ctx.strokeStyle = "#2d4a1f";
  ctx.lineWidth = Math.max(1.5, radius * 0.1);
  const flap = animation.isMoving ? Math.sin(animation.walkPhase) * 0.3 : 0;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(0, side * radius * 0.9);
    ctx.rotate(side * flap);
    ctx.beginPath();
    ctx.ellipse(0, side * radius * 0.35, radius * 0.55, radius * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function drawBlush(ctx: CanvasRenderingContext2D, xOffset: number, spacing: number, blushRadius: number) {
  ctx.fillStyle = "rgba(255, 140, 160, 0.55)";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(xOffset, side * spacing, blushRadius, blushRadius * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

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

/**
 * Draws the character: a round Kirby-style ball body plus bunny ears and side fins — same base
 * design as the original game, minus the gun (no combat in the fishing pivot). `size` is now
 * always PLAYER_VISUAL_SIZE (no more growth mechanic) but kept as a parameter since all the
 * geometry helpers already take it.
 */
function drawCharacter(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  size: number,
  angle: number,
  skin: SkinDefinition,
  playerId: string,
  animation: PlayerAnimation,
  nowMs: number,
) {
  const color = skin.bodyColor;
  const radius = size * BALL_RADIUS_RATIO;
  const footRadius = size * BALL_FOOT_RADIUS_RATIO;

  // Idle breathing bob (small, slow) when stationary only.
  const bobOffset = animation.isMoving ? 0 : Math.sin(nowMs / 500) * radius * 0.06;

  const cx = sx;
  const cy = sy + radius + bobOffset;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  const footStepLeft = animation.isMoving ? Math.sin(animation.walkPhase) * footRadius * 1.3 : 0;
  const footStepRight = animation.isMoving ? Math.sin(animation.walkPhase + Math.PI) * footRadius * 1.3 : 0;
  ctx.fillStyle = "#2d4a1f";
  for (const [side, step] of [[-1, footStepLeft] as const, [1, footStepRight] as const]) {
    ctx.beginPath();
    ctx.ellipse(-radius * 0.3 + step * 0.3, side * radius * 0.65, footRadius, footRadius * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawEars(ctx, radius, color);

  const strokeWidth = Math.max(2, size * 0.1);
  ctx.fillStyle = color;
  ctx.strokeStyle = "#2d4a1f";
  ctx.lineWidth = strokeWidth;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  drawFins(ctx, radius, color, animation);
  drawBlush(ctx, radius * 0.15, radius * 0.5, radius * 0.22);
  drawEyes(ctx, radius * 0.42, radius * 0.36, radius * 0.26, nowMs, playerId);

  ctx.restore();

  drawTopper(ctx, sx, sy + bobOffset - radius * 0.3, radius, skin.topper);
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
  const idleAnimation: PlayerAnimation = { x: 0, y: 0, angle: -Math.PI / 2, walkPhase: 0, isMoving: false };
  drawCharacter(ctx, width / 2, height * 0.6, 40, -Math.PI / 2, skin, skinId, idleAnimation, nowMs);
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

/** Minigame kéo cá — dựng lại nguyên khung theo ảnh Stardew Valley Vicent gửi (14/07/2026): 1 khung
 * gỗ dọc, bên trái là thanh thước bằng kim loại có khấc + ông câu cá nhỏ ngồi dưới góc, ở giữa là
 * máng nước xanh chứa "ô bắt" xanh lá (`zoneY` ± `zoneSize`/2, người chơi giữ chuột đẩy lên / thả ra
 * rơi xuống) và con cá (`fishY`) bơi lang thang thất thường, bên phải là cột progress dâng từ dưới
 * lên theo `progress` (đổi màu đỏ→vàng→xanh lá theo %). Ô bắt sáng/glow khi cá đang nằm trong. Vẽ
 * gọn trong canvas 260×360 (xem ui.ts#updateFishingModal). */
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
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);

  // ---------------------------------------------------------------- KHUNG GỖ (nền)
  const woodGrad = ctx.createLinearGradient(0, 0, width, 0);
  woodGrad.addColorStop(0, "#c79a5b");
  woodGrad.addColorStop(0.5, "#a9743f");
  woodGrad.addColorStop(1, "#c79a5b");
  ctx.fillStyle = woodGrad;
  ctx.fillRect(0, 0, width, height);
  // Ván gỗ dọc 2 mép cho khớp viền bamboo/gỗ trong ảnh.
  ctx.fillStyle = "rgba(233, 205, 150, 0.55)";
  ctx.fillRect(4, 4, 8, height - 8);
  ctx.fillRect(width - 12, 4, 8, height - 8);
  ctx.strokeStyle = "rgba(74, 48, 22, 0.5)";
  ctx.lineWidth = 2;
  ctx.strokeRect(3, 3, width - 6, height - 6);

  const playTop = 14;
  const playBottom = height - 14;
  const playH = playBottom - playTop;
  const toPixelY = (v: number) => playBottom - (clamp(v) / 100) * playH;

  // ---------------------------------------------------------------- THANH PROGRESS = THƯỚC (trái)
  // Gộp progress vào luôn thanh thước bên trái (Vicent 2026-07-14: bỏ cột phải cho gọn UI): rãnh tối,
  // fill dâng từ đáy theo % (màu đỏ→vàng→xanh lá), phủ khấc ngang lên trên nên vẫn ra dáng "thước".
  const rulerX = 14;
  const rulerW = 20;
  const pct = clamp(progress);
  let pr: number, pg: number, pb: number;
  if (pct < 50) {
    const t = pct / 50;
    pr = lerp(224, 242, t); pg = lerp(83, 193, t); pb = lerp(63, 78, t);
  } else {
    const t = (pct - 50) / 50;
    pr = lerp(242, 111, t); pg = lerp(193, 191, t); pb = lerp(78, 79, t);
  }
  // Rãnh tối.
  ctx.fillStyle = "#3a2a1c";
  ctx.fillRect(rulerX, playTop, rulerW, playH);
  // Fill dâng từ đáy.
  const fillH = (pct / 100) * playH;
  const fillGrad = ctx.createLinearGradient(rulerX, 0, rulerX + rulerW, 0);
  fillGrad.addColorStop(0, `rgb(${Math.round(pr * 0.8)}, ${Math.round(pg * 0.8)}, ${Math.round(pb * 0.8)})`);
  fillGrad.addColorStop(0.5, `rgb(${pr}, ${pg}, ${pb})`);
  fillGrad.addColorStop(1, `rgb(${Math.round(pr * 0.75)}, ${Math.round(pg * 0.75)}, ${Math.round(pb * 0.75)})`);
  ctx.fillStyle = fillGrad;
  ctx.fillRect(rulerX, playBottom - fillH, rulerW, fillH);
  if (fillH > 2) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fillRect(rulerX + 3, playBottom - fillH, 3, fillH);
  }
  // Khấc ngang (thang đo) phủ lên trên cho vẫn ra dáng thước.
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 22; i++) {
    const ty = playTop + (playH * i) / 22;
    const long = i % 5 === 0;
    ctx.beginPath();
    ctx.moveTo(rulerX, ty);
    ctx.lineTo(rulerX + (long ? rulerW : rulerW * 0.5), ty);
    ctx.stroke();
  }
  ctx.strokeStyle = "#7a5233";
  ctx.lineWidth = 3;
  ctx.strokeRect(rulerX, playTop, rulerW, playH);

  // ---------------------------------------------------------------- MÁNG NƯỚC (giữa, chiếm phần còn lại)
  const chX = rulerX + rulerW + 12;
  const chW = width - chX - 14;
  const chCenter = chX + chW / 2;
  const waterGrad = ctx.createLinearGradient(0, playTop, 0, playBottom);
  waterGrad.addColorStop(0, "#a9dbf5");
  waterGrad.addColorStop(1, "#6fb4e0");
  ctx.fillStyle = waterGrad;
  ctx.fillRect(chX, playTop, chW, playH);
  // Gợn nước ngang mờ, trôi chậm.
  ctx.save();
  ctx.beginPath();
  ctx.rect(chX, playTop, chW, playH);
  ctx.clip();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    const ry = playTop + ((i * 60 + (nowMs / 40) % 60)) % playH;
    ctx.beginPath();
    ctx.moveTo(chX, ry);
    ctx.lineTo(chX + chW, ry);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = "#3f7ba0";
  ctx.lineWidth = 2.5;
  ctx.strokeRect(chX, playTop, chW, playH);

  // Rong dưới đáy máng cho khớp ảnh.
  ctx.strokeStyle = "#4f9f5a";
  ctx.lineWidth = 3;
  for (let i = -1; i <= 1; i++) {
    const bx = chCenter + i * 16;
    const sway = Math.sin(nowMs / 400 + i) * 4;
    ctx.beginPath();
    ctx.moveTo(bx, playBottom - 2);
    ctx.quadraticCurveTo(bx + sway, playBottom - 16, bx + sway * 1.5, playBottom - 28);
    ctx.stroke();
  }

  // ---------------------------------------------------------------- Ô BẮT (catch zone)
  const isInZone = Math.abs(fishY - zoneY) <= zoneSize / 2;
  const zoneTopPx = toPixelY(zoneY + zoneSize / 2);
  const zoneBottomPx = toPixelY(zoneY - zoneSize / 2);
  const boxX = chCenter - (chW * 0.62) / 2;
  const boxW = chW * 0.62;
  ctx.save();
  if (isInZone) {
    ctx.shadowColor = "rgba(120, 220, 90, 0.9)";
    ctx.shadowBlur = 14;
  }
  const boxGrad = ctx.createLinearGradient(0, zoneTopPx, 0, zoneBottomPx);
  boxGrad.addColorStop(0, isInZone ? "#8fe06a" : "#8fce6c");
  boxGrad.addColorStop(1, isInZone ? "#5fbf3f" : "#5aa84a");
  ctx.fillStyle = boxGrad;
  ctx.globalAlpha = isInZone ? 0.95 : 0.8;
  ctx.fillRect(boxX, zoneTopPx, boxW, zoneBottomPx - zoneTopPx);
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.strokeStyle = isInZone ? "#3c7a24" : "#4f8f2f";
  ctx.lineWidth = 2.5;
  ctx.strokeRect(boxX, zoneTopPx, boxW, zoneBottomPx - zoneTopPx);
  ctx.restore();

  // ---------------------------------------------------------------- CÁ
  const fishPixelY = toPixelY(fishY);
  const wiggle = Math.sin(nowMs / 130) * 0.5;
  drawFishIcon(ctx, chCenter, fishPixelY, boxW * 0.9, speciesId, fishColor, wiggle, 1);

  // ---------------------------------------------------------------- ÔNG CÂU CÁ (góc dưới trái)
  drawTinyAngler(ctx, rulerX + rulerW / 2, playBottom, nowMs);
}

/** Ông câu cá tí hon kiểu pixel ngồi ở góc dưới trái khung minigame (trang trí, khớp ảnh Stardew).
 * Cần câu hơi nhún theo thời gian cho có sức sống. */
function drawTinyAngler(ctx: CanvasRenderingContext2D, x: number, baseY: number, nowMs: number) {
  const bob = Math.sin(nowMs / 500) * 1.5;
  ctx.save();
  ctx.translate(x, baseY - 4 + bob);
  // Thân (áo nâu).
  ctx.fillStyle = "#8a5a2c";
  ctx.fillRect(-7, -14, 14, 14);
  // Đầu (da).
  ctx.fillStyle = "#e8b98a";
  ctx.beginPath();
  ctx.arc(0, -20, 6, 0, Math.PI * 2);
  ctx.fill();
  // Nón (vàng đất).
  ctx.fillStyle = "#c98a3a";
  ctx.beginPath();
  ctx.arc(0, -22, 6.5, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-8, -22, 16, 2.5);
  // Cần câu chĩa lên.
  ctx.strokeStyle = "#5a3a1c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(4, -8);
  ctx.lineTo(16, -34);
  ctx.stroke();
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
  const lineStartY = sy - size * 0.15;
  ctx.save();
  ctx.strokeStyle = "rgba(60, 50, 40, 0.75)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(sx, lineStartY);
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
  snapshot: RoomSnapshot;
  camera: Camera;
  localPlayerId: string | null;
  nowMs: number;
  getPlayerAnimation: (playerId: string) => PlayerAnimation;
}

/** Hiệu ứng bắn nước tức thời khi phao chạm mặt hồ (Vicent 2026-07-14): vài vòng sóng lan tròn +
 * mấy giọt nước văng lên rồi rơi xuống. Trạng thái tạm sống ngắn (~650ms), gom trong module này để
 * render() vẫn "snapshot -> pixels"; main.ts gọi `spawnCastSplash` đúng lúc phao đáp nước. */
interface CastSplash {
  x: number;
  y: number;
  startMs: number;
  drops: { vx: number; vy: number }[];
}
const castSplashes: CastSplash[] = [];
const CAST_SPLASH_DURATION_MS = 650;

export function spawnCastSplash(worldX: number, worldY: number, nowMs: number): void {
  const drops: { vx: number; vy: number }[] = [];
  for (let i = 0; i < 8; i++) {
    // Chủ yếu bắn lên trên (-90°) toả sang 2 bên, tốc độ ngẫu nhiên cho tự nhiên.
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
    // Vòng sóng lan: 3 vòng nở ra so le, dẹt theo trục dọc cho cảm giác nhìn nghiêng mặt nước.
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
    // Giọt nước văng: quỹ đạo parabol (trọng lực), mờ dần, biến mất khi rơi lại mặt nước.
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

/** Tên hồ vẽ ngay GIỮA hồ (Vicent 2026-07-14) — dùng tâm AABB (bounds) chứ không phải centerX/Y, vì
 * vài hồ (nhất là con sông) có centerX/Y = 0,0 lệch hẳn khỏi thân hồ. Chữ nâu cozy, viền giấy da cho
 * nổi trên mặt nước xanh. Kích thước theo world nên tự thu/phóng cùng zoom. */
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
  ctx.save();
  ctx.scale(zoomScale, zoomScale);

  clearBackground(ctx, camera, snapshot.players, nowMs);
  for (const lake of LAKE_DEFINITIONS) {
    // Cheap off-screen cull: skip lakes whose bounding circle (max jittered vertex distance) can't
    // possibly touch the current viewport, so a big multi-lake map doesn't redraw all 6 every frame.
    const maxRadius = Math.max(...lake.polygon.map((p) => Math.hypot(p.x, p.y))) + SHORE_RING_WIDTH;
    const [lcx, lcy] = worldToScreen(camera, lake.centerX, lake.centerY);
    if (lcx < -maxRadius || lcy < -maxRadius || lcx > camera.width + maxRadius || lcy > camera.height + maxRadius) continue;
    drawLake(ctx, camera, lake, nowMs);
    drawLakeName(ctx, camera, lake);
  }
  drawWorldBounds(ctx, camera);
  drawProceduralTrees(ctx, camera);
  drawFences(ctx, camera);

  // Hiệu ứng bắn nước vẽ ngay trên mặt hồ, trước khi vẽ nhân vật/phao (nằm dưới các đối tượng đó).
  drawCastSplashes(ctx, camera, nowMs);

  const visuals = new Map<string, VisualPosition>();
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

    // Scale character size based on total fish value caught (up to 2.5x original size). Chia điểm
    // cho 10 trước khi lấy căn để BÙ lại việc đã x10 toàn bộ value (Vicent 2026-07-14) — giữ nhịp
    // phình to y hệt trước lúc x10, nếu không nhân vật chạm trần 2.5x gần như tức thì (chỉ 1 con
    // legendary). Trần 2.5x giờ đạt khi totalValue ≈ 9000 thay vì 900.
    const scale = 1 + Math.min(1.5, Math.sqrt((player.totalValue || 0) / 10) * 0.05);
    const dynamicSize = PLAYER_VISUAL_SIZE * scale;

    drawFishingLineAndBobber(ctx, camera, sx, sy, dynamicSize, player, nowMs);
    drawCharacter(ctx, sx, sy, dynamicSize, animation.angle, skin, player.id, animation, nowMs);
    if (isLocal) drawYouMarker(ctx, sx, sy, dynamicSize, nowMs);
    drawNameTag(ctx, sx, sy, dynamicSize, player);
  }

  ctx.restore();
}
