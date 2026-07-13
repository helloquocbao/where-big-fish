/**
 * All canvas drawing lives here. Rendering is pure: given a snapshot + camera,
 * draw it. No game logic/decisions are made in this file.
 */

import type { PlayerState, RoomSnapshot, SkinDefinition, SkinTopper, LakeDefinition } from "@bomio/shared";
import {
  getSkinDefinition,
  LAKE_DEFINITIONS,
  isInsideAnyLake,
  distanceToLakeBoundary,
  isInsideMountains,
} from "@bomio/shared";
import { BALL_RADIUS_RATIO, BALL_FOOT_RADIUS_RATIO, PLAYER_VISUAL_SIZE, WORLD_WIDTH, WORLD_HEIGHT } from "./config.ts";
import type { PlayerAnimation } from "./animation.ts";

export interface Camera {
  x: number;
  y: number;
  width: number;
  height: number;
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

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// ---- Lake geometry (world-space) — nhiều hồ rải khắp map, hình dạng/kích thước THẬT (gate thả
// cần ở backend, xem shared/src/lakes.ts#LAKE_DEFINITIONS), không còn thuần cosmetic như bản 1 hồ
// ellipse cố định trước đây.
const NEAR_EDGE_THRESHOLD = 60;

/** Gần mép BẤT KỲ hồ nào không (trong khoảng NEAR_EDGE_THRESHOLD tính từ biên, kể cả từ trong hay
 * ngoài hồ) — dùng để rải lau sậy đúng ngay mép nước. */
function isNearAnyLakeEdge(worldX: number, worldY: number): boolean {
  return LAKE_DEFINITIONS.some((lake) => distanceToLakeBoundary(lake, worldX, worldY) < NEAR_EDGE_THRESHOLD);
}

const MEADOW_PATCH_CELL_SIZE = 480;
const MEADOW_PATCH_COLORS = ["rgba(150,205,90,0.45)", "rgba(200,235,140,0.5)", "rgba(120,190,80,0.4)"];

function drawShorePatches(ctx: CanvasRenderingContext2D, camera: Camera) {
  const startCx = Math.floor((camera.x - camera.width / 2) / MEADOW_PATCH_CELL_SIZE) - 1;
  const endCx = Math.floor((camera.x + camera.width / 2) / MEADOW_PATCH_CELL_SIZE) + 1;
  const startCy = Math.floor((camera.y - camera.height / 2) / MEADOW_PATCH_CELL_SIZE) - 1;
  const endCy = Math.floor((camera.y + camera.height / 2) / MEADOW_PATCH_CELL_SIZE) + 1;

  for (let cx = startCx; cx <= endCx; cx++) {
    for (let cy = startCy; cy <= endCy; cy++) {
      const colorRoll = hashCell(cx, cy, 1);
      if (colorRoll < 0.4) continue;
      const color = MEADOW_PATCH_COLORS[Math.floor(hashCell(cx, cy, 2) * MEADOW_PATCH_COLORS.length)];
      const jitterX = (hashCell(cx, cy, 3) - 0.5) * MEADOW_PATCH_CELL_SIZE * 0.5;
      const jitterY = (hashCell(cx, cy, 4) - 0.5) * MEADOW_PATCH_CELL_SIZE * 0.5;
      const worldX = (cx + 0.5) * MEADOW_PATCH_CELL_SIZE + jitterX;
      const worldY = (cy + 0.5) * MEADOW_PATCH_CELL_SIZE + jitterY;
      if (isInsideAnyLake(worldX, worldY)) continue; // don't tint the water surface itself
      const [sx, sy] = worldToScreen(camera, worldX, worldY);
      const radius = MEADOW_PATCH_CELL_SIZE * (0.55 + hashCell(cx, cy, 5) * 0.3);

      const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
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
      const kind = pickShoreDecorKind(hashCell(cx, cy, 11));
      if (!kind) continue;

      const jitterX = (hashCell(cx, cy, 12) - 0.5) * SHORE_DECOR_CELL_SIZE * 0.7;
      const jitterY = (hashCell(cx, cy, 13) - 0.5) * SHORE_DECOR_CELL_SIZE * 0.7;
      const worldX = (cx + 0.5) * SHORE_DECOR_CELL_SIZE + jitterX;
      const worldY = (cy + 0.5) * SHORE_DECOR_CELL_SIZE + jitterY;

      // Reeds intentionally allowed right at/near the waterline; everything else skips the water.
      if (kind !== "reed" && isInsideAnyLake(worldX, worldY)) continue;
      if (kind === "reed" && !isNearAnyLakeEdge(worldX, worldY)) continue;

      const tooCloseToPlayer = players.some(
        (p) => Math.hypot(p.x - worldX, p.y - worldY) < SHORE_DECOR_PLAYER_CLEARANCE_FACTOR,
      );
      if (tooCloseToPlayer) continue;

      const [sx, sy] = worldToScreen(camera, worldX, worldY);
      if (sx < -20 || sy < -20 || sx > camera.width + 20 || sy > camera.height + 20) continue;

      const rotation = hashCell(cx, cy, 14) * Math.PI * 2;
      const scale = 0.75 + hashCell(cx, cy, 15) * 0.7;
      drawShoreDecor(ctx, sx, sy, rotation, scale, kind);
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
function drawProceduralTrees(ctx: CanvasRenderingContext2D, camera: Camera) {
  const startCx = Math.floor((camera.x - camera.width / 2) / TREE_CELL_SIZE) - 1;
  const endCx = Math.floor((camera.x + camera.width / 2) / TREE_CELL_SIZE) + 1;
  const startCy = Math.floor((camera.y - camera.height / 2) / TREE_CELL_SIZE) - 1;
  const endCy = Math.floor((camera.y + camera.height / 2) / TREE_CELL_SIZE) + 1;

  for (let cx = startCx; cx <= endCx; cx++) {
    for (let cy = startCy; cy <= endCy; cy++) {
      // 28% chance of tree per grid cell
      const roll = hashCell(cx, cy, 33);
      if (roll > 0.28) continue;

      const jitterX = (hashCell(cx, cy, 34) - 0.5) * TREE_CELL_SIZE * 0.6;
      const jitterY = (hashCell(cx, cy, 35) - 0.5) * TREE_CELL_SIZE * 0.6;
      const worldX = (cx + 0.5) * TREE_CELL_SIZE + jitterX;
      const worldY = (cy + 0.5) * TREE_CELL_SIZE + jitterY;

      // Skip if inside mountains, or inside/near any lake edge
      if (isInsideMountains(worldX, worldY) || isInsideAnyLake(worldX, worldY) || isNearAnyLakeEdge(worldX, worldY)) continue;

      // Skip starting zone
      if (Math.hypot(worldX, worldY) < 160) continue;

      // Clamp to grass landmass (excluding beach margins)
      if (Math.abs(worldX) > WORLD_WIDTH / 2 - 50 || Math.abs(worldY) > WORLD_HEIGHT / 2 - 50) continue;

      const [sx, sy] = worldToScreen(camera, worldX, worldY);
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

/** Icon cá đơn giản vẽ bằng canvas (thân + đuôi + vây + mắt), tô theo màu riêng của loài trong
 * FISH_CATALOG — dùng cả lúc kéo cá (thân đang vùng vẫy tại vị trí phao) lẫn trong modal kết quả
 * câu được cá (`ui.ts`). `tailWiggle` là góc lệch (radian) của đuôi, cho hiệu ứng vẫy — truyền 0
 * để vẽ tĩnh (modal). Quay đầu cá theo `facing` (1 = quay phải, -1 = quay trái). */
export function drawFishIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
  tailWiggle = 0,
  facing = 1,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(facing, 1);
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = Math.max(1, size * 0.045);

  // Đuôi (vẫy theo tailWiggle).
  ctx.save();
  ctx.translate(-size * 0.42, 0);
  ctx.rotate(tailWiggle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-size * 0.34, -size * 0.28);
  ctx.lineTo(-size * 0.34, size * 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Thân.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.42, size * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Vây lưng.
  ctx.beginPath();
  ctx.moveTo(size * 0.02, -size * 0.2);
  ctx.quadraticCurveTo(size * 0.12, -size * 0.44, size * 0.22, -size * 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Mắt.
  ctx.fillStyle = "#fffaf0";
  ctx.beginPath();
  ctx.arc(size * 0.24, -size * 0.04, size * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2d2018";
  ctx.beginPath();
  ctx.arc(size * 0.27, -size * 0.04, size * 0.045, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/** Cần câu cong theo độ căng dây — cầm gần vai nhân vật, ngọn cần càng cong xuống khi reelTension
 * càng cao (đúng cảm giác "cần câu bị kéo cong" khi cá giằng mạnh). Trả về toạ độ ngọn cần để dây
 * câu vẽ tiếp từ đó thay vì từ thân nhân vật. */
function drawBentRod(ctx: CanvasRenderingContext2D, sx: number, sy: number, size: number, tensionFrac: number, mirrored = false) {
  const gripX = sx + (mirrored ? -size * 0.18 : size * 0.18);
  const gripY = sy - size * 0.3;
  const reach = size * 0.85;
  const bend = size * 0.35 * tensionFrac;
  const tipX = gripX + (mirrored ? -reach * 0.55 : reach * 0.55);
  const tipY = gripY - reach * 0.85 + bend;

  ctx.save();
  ctx.strokeStyle = "#7a5233";
  ctx.lineWidth = Math.max(2, size * 0.07);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(gripX, gripY);
  ctx.quadraticCurveTo(gripX + (mirrored ? -reach * 0.3 : reach * 0.3), gripY - reach * 0.55 + bend * 0.4, tipX, tipY);
  ctx.stroke();
  ctx.restore();

  return { x: tipX, y: tipY };
}

/** Cảnh cần câu cong + cá vùng vẫy vẽ trên 1 canvas độc lập ĐẶT NGAY TRONG modal câu cá (xem
 * ui.ts#updateFishingModal) — không neo theo world/camera như trước, chỉ có 1 "người câu" (ngọn
 * cần góc dưới-trái) và 1 "con cá" (góc phải) cố định trong khung canvas riêng của modal. Cá vẫy
 * mạnh/nhanh hơn theo `reelTension` — càng gần đứt dây càng thấy cá vùng vẫy dữ dội. */
export function drawModalReelScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  reelTension: number,
  fishColor: string,
  nowMs: number,
) {
  ctx.clearRect(0, 0, width, height);

  const leftX = width * 0.08;
  const rightX = width * 0.72;
  const bottomY = height * 0.9;
  const topY = height * 0.12;

  // Draw the blue water dome/pond
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(leftX + 10, bottomY);
  // Left wall curving up
  ctx.bezierCurveTo(leftX - 15, bottomY - 20, leftX - 15, topY + 25, leftX + 10, topY + 15);
  // Top arch
  ctx.bezierCurveTo(width * 0.25, topY - 10, width * 0.55, topY - 10, rightX - 10, topY + 15);
  // Right wall curving down
  ctx.bezierCurveTo(rightX + 15, topY + 25, rightX + 15, bottomY - 20, rightX - 10, bottomY);
  ctx.closePath();

  const waterGrad = ctx.createLinearGradient(0, topY, 0, bottomY);
  waterGrad.addColorStop(0, "#76c4eb");
  waterGrad.addColorStop(1, "#3c92c4");
  ctx.fillStyle = waterGrad;
  ctx.fill();

  ctx.strokeStyle = "#27688c";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  const tensionFrac = Math.max(0, Math.min(1, reelTension / 100));

  // Mirrored Rod placement (starts on the right, curves left)
  const rodOriginX = rightX - width * 0.05;
  const rodOriginY = bottomY - height * 0.05;
  const rodSize = height * 0.62;
  const rodTip = drawBentRod(ctx, rodOriginX, rodOriginY, rodSize, tensionFrac, true);

  // Mirrored Fish placement (on the left)
  const fishX = leftX + width * 0.12;
  const fishY = bottomY - height * 0.35;

  const slack = (1 - tensionFrac) * 12;
  const jitter = tensionFrac > 0.6 ? (Math.random() - 0.5) * tensionFrac * 6 : 0;
  ctx.save();
  ctx.strokeStyle = "rgba(60, 50, 40, 0.8)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(rodTip.x, rodTip.y);
  ctx.quadraticCurveTo((rodTip.x + fishX) / 2 + jitter, (rodTip.y + fishY) / 2 + slack, fishX, fishY);
  ctx.stroke();
  ctx.restore();

  const wiggleSpeed = 6 + tensionFrac * 22;
  const wiggle = Math.sin(nowMs / (1000 / wiggleSpeed)) * (0.35 + tensionFrac * 0.55);
  // Fish faces right (direction 1) towards the rod tip
  drawFishIcon(ctx, fishX, fishY, rodSize * 0.6, fishColor, wiggle, 1);
}

/** Fishing line + bobber, drawn from wherever the character stands out to their bobber's world
 * position — visible any time fishState isn't "idle". The bobber bobs gently while waiting and
 * jerks rapidly while reeling (someone's fighting a fish over there!) — the actual reel minigame
 * (bent rod, fish, progress/tension) is drawn inside the fishing modal (xem `drawModalReelScene` +
 * ui.ts#updateFishingModal), full-screen and in focus, not competing with this small world icon. */
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

export function render(ctx: CanvasRenderingContext2D, opts: RenderOptions) {
  const { snapshot, camera, localPlayerId, nowMs } = opts;

  clearBackground(ctx, camera, snapshot.players, nowMs);
  for (const lake of LAKE_DEFINITIONS) {
    // Cheap off-screen cull: skip lakes whose bounding circle (max jittered vertex distance) can't
    // possibly touch the current viewport, so a big multi-lake map doesn't redraw all 6 every frame.
    const maxRadius = Math.max(...lake.polygon.map((p) => Math.hypot(p.x, p.y))) + SHORE_RING_WIDTH;
    const [lcx, lcy] = worldToScreen(camera, lake.centerX, lake.centerY);
    if (lcx < -maxRadius || lcy < -maxRadius || lcx > camera.width + maxRadius || lcy > camera.height + maxRadius) continue;
    drawLake(ctx, camera, lake, nowMs);
  }
  drawWorldBounds(ctx, camera);
  drawProceduralTrees(ctx, camera);
  drawFences(ctx, camera);

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

    // Scale character size based on total fish value caught (up to 2.5x original size)
    const scale = 1 + Math.min(1.5, Math.sqrt(player.totalValue || 0) * 0.05);
    const dynamicSize = PLAYER_VISUAL_SIZE * scale;

    drawFishingLineAndBobber(ctx, camera, sx, sy, dynamicSize, player, nowMs);
    drawCharacter(ctx, sx, sy, dynamicSize, animation.angle, skin, player.id, animation, nowMs);
    if (isLocal) drawYouMarker(ctx, sx, sy, dynamicSize, nowMs);
    drawNameTag(ctx, sx, sy, dynamicSize, player);
  }
}
