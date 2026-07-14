/**
 * Nhiều hồ câu rải rác trên 1 map (thay cho 1 hồ ellipse cố định trước đây) — xem
 * docs/concept_brief.md mục 1 + docs/progress.md log ngày đổi thiết kế này.
 *
 * Hình dạng hồ giờ là LUẬT CHƠI THẬT (gate việc thả cần — xem backend/src/systems/fishing.ts),
 * không còn thuần cosmetic, nên phải nằm ở shared/ chứ không phải chỉ frontend/render.ts như
 * trước. Polygon méo mó của mỗi hồ được SINH RA bằng hàm xác định (seeded hash theo lake.id, xem
 * hash.ts) thay vì hardcode toạ độ tay — nhờ vậy frontend và backend (2 process riêng biệt) luôn
 * tính ra đúng 1 hình y hệt nhau mà không cần truyền polygon qua network.
 *
 * Mọi thay đổi ở file này phải được ghi log vào docs/progress.md (xem AGENTS.md).
 */

import { FISH_CATALOG, getFishSpecies, type FishSpecies, WORLD_WIDTH } from "./constants.js";
import { hash01, hashString } from "./hash.js";

export interface LakePoint {
  x: number;
  y: number;
}

/** Đứng trong phạm vi này tính từ biên hồ (kể cả đang đứng trong hồ, khoảng cách = 0) thì được thả
 * cần vào hồ đó — xem findNearestLake + backend/src/systems/fishing.ts#tryCast. */
export const LAKE_CAST_RANGE = 140;

interface LakeShapeInput {
  id: string;
  name: string;
  centerX: number;
  centerY: number;
  baseRadiusX: number;
  baseRadiusY: number;
  vertexCount: number;
  /** 0..1 — độ méo của bờ hồ so với ellipse đều (0 = ellipse hoàn hảo, càng cao càng "méo mó"). */
  jitter: number;
  /** speciesId (xem FISH_CATALOG) -> trọng số random khi cá cắn câu Ở HỒ NÀY. Không phải mọi hồ
   * đều có đủ 8 loài — mỗi hồ chỉ có 1 tập con, tạo lý do đi câu nhiều hồ khác nhau để sưu tập đủ. */
  fishWeights: Record<string, number>;
}

/** Axis-aligned bounding box của hồ trong TOẠ ĐỘ WORLD (đã cộng centerX/centerY vào polygon) —
 * tính 1 lần lúc module load. Dùng làm bộ lọc rẻ tiền (O(1)) trước khi chạy point-in-polygon
 * O(n đỉnh) đắt tiền: 1 điểm nằm ngoài AABB thì chắc chắn nằm ngoài hồ, và khoảng cách tới AABB là
 * cận dưới của khoảng cách thật tới biên hồ — xem aabbDistanceToLake + các hàm hot bên dưới. */
export interface LakeBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface LakeDefinition extends LakeShapeInput {
  /** Toạ độ TƯƠNG ĐỐI so với (centerX, centerY), sinh 1 lần lúc module load — xem generateBlobPolygon. */
  polygon: LakePoint[];
  /** AABB world-space, precompute từ polygon — xem LakeBounds. */
  bounds: LakeBounds;
}

/** AABB world-space của 1 hồ từ polygon (toạ độ tương đối) + tâm hồ. */
function computeLakeBounds(centerX: number, centerY: number, polygon: LakePoint[]): LakeBounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of polygon) {
    const wx = centerX + p.x;
    const wy = centerY + p.y;
    if (wx < minX) minX = wx;
    if (wx > maxX) maxX = wx;
    if (wy < minY) minY = wy;
    if (wy > maxY) maxY = wy;
  }
  return { minX, minY, maxX, maxY };
}

/** Khoảng cách từ 1 điểm world tới AABB của hồ (0 nếu nằm trong AABB) — LUÔN <= khoảng cách thật
 * tới biên hồ, nên dùng được làm cận dưới để bỏ qua sớm các hồ ở xa mà không cần point-in-polygon
 * hay quét từng cạnh. */
export function aabbDistanceToLake(lake: LakeDefinition, worldX: number, worldY: number): number {
  const b = lake.bounds;
  const dx = worldX < b.minX ? b.minX - worldX : worldX > b.maxX ? worldX - b.maxX : 0;
  const dy = worldY < b.minY ? b.minY - worldY : worldY > b.maxY ? worldY - b.maxY : 0;
  return Math.hypot(dx, dy);
}

/** Sinh 1 polygon khép kín méo mó từ 1 ellipse cơ sở — bán kính mỗi đỉnh bị jitter theo 1 seeded
 * hash (seed = hash của lake.id + chỉ số đỉnh), nên xác định 100% (không dùng Math.random) mà vẫn
 * khác nhau giữa các hồ và giữa các đỉnh trong cùng 1 hồ. */
function generateBlobPolygon(shape: LakeShapeInput): LakePoint[] {
  const baseSeed = hashString(shape.id);
  const points: LakePoint[] = [];
  for (let i = 0; i < shape.vertexCount; i++) {
    const angle = (i / shape.vertexCount) * Math.PI * 2;
    const jitterRoll = hash01(baseSeed + i * 97.13);
    const radiusScale = 1 + (jitterRoll - 0.5) * 2 * shape.jitter;
    points.push({
      x: Math.cos(angle) * shape.baseRadiusX * radiusScale,
      y: Math.sin(angle) * shape.baseRadiusY * radiusScale,
    });
  }
  return points;
}

// ---- 6 hồ, rải khắp world (xem WORLD_WIDTH/HEIGHT trong constants.ts) — kích thước/độ méo/loại cá
// khác nhau theo yêu cầu: hồ nhỏ/tròn gần điểm xuất phát chỉ có cá thường, hồ lớn/méo/xa thiên về
// cá hiếm-huyền thoại. Đảm bảo cả 8 loài trong FISH_CATALOG đều xuất hiện ở ít nhất 1 hồ.
const LAKE_SHAPES: LakeShapeInput[] = [
  {
    id: "ao_lang",
    name: "Village Pond",
    centerX: 0,
    centerY: 0,
    baseRadiusX: 320,
    baseRadiusY: 280,
    vertexCount: 10,
    jitter: 0.15,
    fishWeights: { silver_carp: 30, minnow: 26 },
  },
  {
    id: "ho_guong",
    name: "Mirror Lake",
    centerX: 2000,
    centerY: -1300,
    baseRadiusX: 520,
    baseRadiusY: 440,
    vertexCount: 12,
    jitter: 0.2,
    fishWeights: { silver_carp: 20, catfish: 20, tilapia: 12 },
  },
  {
    id: "ho_ran",
    name: "Serpent Lake",
    centerX: -2500,
    centerY: -300,
    baseRadiusX: 900,
    baseRadiusY: 300,
    vertexCount: 16,
    jitter: 0.35,
    fishWeights: { tilapia: 12, snakehead: 9, catfish: 15 },
  },
  {
    id: "dam_sen",
    name: "Lotus Marsh",
    centerX: -1100,
    centerY: 2200,
    baseRadiusX: 400,
    baseRadiusY: 360,
    vertexCount: 11,
    jitter: 0.4,
    fishWeights: { snakehead: 10, koi: 4 },
  },
  {
    id: "vinh_bang",
    name: "Ice Bay",
    centerX: 2700,
    centerY: 1900,
    baseRadiusX: 750,
    baseRadiusY: 620,
    vertexCount: 14,
    jitter: 0.4,
    fishWeights: { tilapia: 6, koi: 5, giant_barb: 4 },
  },
  {
    id: "ho_rong",
    name: "Dragon Lake",
    centerX: -2500,
    centerY: -2000,
    baseRadiusX: 850,
    baseRadiusY: 650,
    vertexCount: 13,
    jitter: 0.25,
    fishWeights: { koi: 3, giant_barb: 4, golden_dragonfish: 1 },
  },
  // ---- 1 Sông Duy Nhất (Single winding river connecting left to right/sea) ----
  {
    id: "song_chinh",
    name: "Han River",
    centerX: 0,
    centerY: 0,
    baseRadiusX: 3700,
    baseRadiusY: 80,
    vertexCount: 80,
    jitter: 0,
    fishWeights: { silver_carp: 20, tilapia: 20, catfish: 15, snakehead: 10 },
  },
  // ---- Biển bên phải (Sea on the right) ----
  {
    id: "bien_dong",
    name: "East Sea",
    centerX: 4100,
    centerY: 0,
    baseRadiusX: 400,
    baseRadiusY: 3800,
    vertexCount: 18,
    jitter: 0.08,
    fishWeights: { butterfish: 22, mackerel: 14, tuna: 6, baby_shark: 1 },
  },
];

function generateRiverPolygon(): LakePoint[] {
  const points: LakePoint[] = [];
  const startX = -3400;
  const endX = 3900;
  const steps = 65;
  const width = 150;

  const riverY = (x: number) => {
    return 450 * Math.sin(x / 1100) - 800;
  };

  // Top bank
  for (let i = 0; i <= steps; i++) {
    const x = startX + (i / steps) * (endX - startX);
    const jitterVal = (hash01(987 + i * 17.3) - 0.5) * 20;
    points.push({
      x,
      y: riverY(x) - (width / 2 + jitterVal),
    });
  }

  // Bottom bank
  for (let i = steps; i >= 0; i--) {
    const x = startX + (i / steps) * (endX - startX);
    const jitterVal = (hash01(123 + i * 17.3) - 0.5) * 20;
    points.push({
      x,
      y: riverY(x) + (width / 2 + jitterVal),
    });
  }

  return points;
}

export const LAKE_DEFINITIONS: LakeDefinition[] = LAKE_SHAPES.map((shape) => {
  const polygon = shape.id === "song_chinh" ? generateRiverPolygon() : generateBlobPolygon(shape);
  return {
    ...shape,
    polygon,
    bounds: computeLakeBounds(shape.centerX, shape.centerY, polygon),
  };
});

const LAKE_BY_ID = new Map(LAKE_DEFINITIONS.map((l) => [l.id, l]));

export function getLakeById(id: string | null | undefined): LakeDefinition | undefined {
  return id != null ? LAKE_BY_ID.get(id) : undefined;
}

// ---- Hình học polygon (dùng chung cho gate thả cần ở backend + vẽ/skip-decor ở frontend) ----

export function isPointInPolygon(localX: number, localY: number, polygon: LakePoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect = yi > localY !== yj > localY && localX < ((xj - xi) * (localY - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Khoảng cách nguyên bản tới cạnh gần nhất — KHÔNG rút về 0 khi ở trong polygon (khác
 * distanceToPolygon bên dưới). Dùng cho việc "đứng gần mép hồ" (trang trí bờ, xem
 * frontend/src/render.ts) — nơi cần phân biệt "gần mép" với "ở sâu trong hồ", khác gate thả cần
 * (chỉ cần biết trong tầm hay không, xem distanceToPolygon). */
export function distanceToPolygonBoundary(localX: number, localY: number, polygon: LakePoint[]): number {
  let minDist = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const d = distanceToSegment(localX, localY, polygon[j].x, polygon[j].y, polygon[i].x, polygon[i].y);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

/** 0 nếu (localX, localY) nằm trong polygon, ngược lại khoảng cách tới cạnh gần nhất. */
export function distanceToPolygon(localX: number, localY: number, polygon: LakePoint[]): number {
  if (isPointInPolygon(localX, localY, polygon)) return 0;
  return distanceToPolygonBoundary(localX, localY, polygon);
}

export function isInsideLake(lake: LakeDefinition, worldX: number, worldY: number): boolean {
  // Cheap AABB reject first — a point outside the bounding box can't be inside the polygon, so we
  // skip the O(n) point-in-polygon scan for the (common) case of a point far from this lake.
  const b = lake.bounds;
  if (worldX < b.minX || worldX > b.maxX || worldY < b.minY || worldY > b.maxY) return false;
  return isPointInPolygon(worldX - lake.centerX, worldY - lake.centerY, lake.polygon);
}

/** Có đang ở trong BẤT KỲ hồ nào không — dùng để chặn đi bộ vào mặt nước (xem
 * backend/src/systems/movement.ts) và để bỏ qua trang trí/tô đồng cỏ trên mặt nước (xem
 * frontend/src/render.ts). */
export function isInsideAnyLake(worldX: number, worldY: number): boolean {
  return LAKE_DEFINITIONS.some((lake) => isInsideLake(lake, worldX, worldY));
}

export function distanceToLakeEdge(lake: LakeDefinition, worldX: number, worldY: number): number {
  return distanceToPolygon(worldX - lake.centerX, worldY - lake.centerY, lake.polygon);
}

/** Như distanceToLakeEdge nhưng không rút về 0 khi ở trong hồ — xem distanceToPolygonBoundary. */
export function distanceToLakeBoundary(lake: LakeDefinition, worldX: number, worldY: number): number {
  return distanceToPolygonBoundary(worldX - lake.centerX, worldY - lake.centerY, lake.polygon);
}

/** Hồ gần nhất tính từ 1 điểm bất kỳ + khoảng cách tới biên hồ đó (0 nếu đang đứng trong hồ) —
 * dùng để gate thả cần (LAKE_CAST_RANGE) và xác định câu ở hồ nào. */
export function findNearestLake(worldX: number, worldY: number): { lake: LakeDefinition; distance: number } | null {
  let best: { lake: LakeDefinition; distance: number } | null = null;
  for (const lake of LAKE_DEFINITIONS) {
    // aabbDistanceToLake là cận dưới của khoảng cách thật tới biên hồ — nếu ngay cả cận dưới này đã
    // >= khoảng cách tốt nhất tìm được, không cần chạy distanceToLakeEdge (O(n cạnh)) cho hồ này.
    if (best && aabbDistanceToLake(lake, worldX, worldY) >= best.distance) continue;
    const d = distanceToLakeEdge(lake, worldX, worldY);
    if (!best || d < best.distance) best = { lake, distance: d };
  }
  return best;
}

/** Weighted random pick trong tập cá riêng của 1 hồ (khác pickRandomFishSpecies trong constants.ts,
 * vốn random đều trên toàn bộ FISH_CATALOG không phân biệt hồ). */
export function pickRandomFishSpeciesForLake(lake: LakeDefinition): FishSpecies {
  const entries = Object.entries(lake.fishWeights);
  const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = Math.random() * totalWeight;
  for (const [speciesId, weight] of entries) {
    if (r < weight) return getFishSpecies(speciesId) ?? FISH_CATALOG[0];
    r -= weight;
  }
  return getFishSpecies(entries[0]?.[0]) ?? FISH_CATALOG[0];
}

export function isInsideMountains(worldX: number, worldY: number): boolean {
  // Bounding box of the left mountains around y = -1200
  return worldX < -WORLD_WIDTH / 2 + 350 && worldY > -1700 && worldY < -700;
}
