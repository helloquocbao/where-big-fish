/**
 * NGUỒN CHÂN LÝ DUY NHẤT cho luật chơi. Backend là authoritative, frontend chỉ dùng các hằng
 * số này để hiển thị dự đoán (client-side prediction/UI), KHÔNG được tự quyết định thắng/thua.
 *
 * Mọi thay đổi ở file này phải được ghi log vào docs/progress.md (xem AGENTS.md).
 * Nguồn spec: docs/concept_brief.md
 *
 * PIVOT (2026-07-11): đổi từ game .io PvP "nhảy đè/bomb" sang game câu cá multiplayer nhiều
 * người cùng 1 hồ — quyết định trực tiếp với Vicent. Toàn bộ hằng số PvP/food cũ (pounce, bomb,
 * bullet, food, extra lives, collision knockback, size-speed tradeoff) đã bị xoá, thay bằng cơ chế
 * thả cần -> chờ cắn câu -> móc câu (hook) -> kéo cá (reel minigame) -> bắt được/vuột mất.
 */

// ---- Room & Matchmaking ----
/** Giới hạn người chơi tối đa mỗi hồ (room). Hồ nhỏ hơn nhiều so với map PvP cũ — không cần
 * đông để tạo áp lực, chỉ cần đủ để hồ có cảm giác có người. */
export const ROOM_MAX_PLAYERS = 40;

/**
 * Dân số "nền" tối thiểu MỖI HỒ (không phải toàn room) — nếu số người chơi thật đang câu ở 1 hồ ít
 * hơn số này, backend tự lấp đầy hồ đó bằng NPC câu cá cho tới đủ, và tự rút NPC dần khi người chơi
 * thật vào thêm. Tính theo từng hồ (xem shared/src/lakes.ts#LAKE_DEFINITIONS) để nhiều hồ rải rác
 * trên map không có hồ nào bị vắng tanh trong khi hồ khác đông NPC. Chỉ để hồ không bị vắng tanh
 * lúc mới launch — NPC không cạnh tranh gì với người chơi thật (không giành cá hiếm).
 */
export const NPC_FISHER_TARGET_POPULATION = 3;

// ---- Nhân vật (tái sử dụng hình học quả bóng kiểu Kirby từ bản game cũ) ----
export const BALL_RADIUS_RATIO = 0.55;
export const BALL_FOOT_RADIUS_RATIO = 0.16;

/** Không còn cơ chế lớn dần (agar.io) — nhân vật giữ nguyên 1 kích thước cố định. */
export const PLAYER_VISUAL_SIZE = 34;

export function computeCharacterExtent(size: number): { topOffset: number; bottomOffset: number; totalHeight: number } {
  const radius = size * BALL_RADIUS_RATIO;
  const footRadius = size * BALL_FOOT_RADIUS_RATIO;
  const topOffset = -size * 0.1;
  const bottomOffset = radius * 2 + footRadius * 1.2;
  return { topOffset, bottomOffset, totalHeight: bottomOffset - topOffset };
}

/** Điểm neo (player.x, player.y) là ĐỈNH quả bóng — xem render.ts#drawCharacter. */
export function computeBodyCenterY(anchorY: number, size: number): number {
  return anchorY + size * BALL_RADIUS_RATIO;
}

// ---- Skin (trang phục màu sắc, hoàn toàn miễn phí, thuần cosmetic) ----
export type SkinTopper = "none" | "leaf" | "citrus" | "sun" | "berry-cap" | "tendril";

export interface SkinDefinition {
  id: string;
  name: string;
  bodyColor: string;
  topper: SkinTopper;
}

export const SKIN_CATALOG: SkinDefinition[] = [
  { id: "classic", name: "Cổ Điển", bodyColor: "#fdf6ec", topper: "none" },
  { id: "strawberry", name: "Dâu Tây", bodyColor: "#ff6f91", topper: "berry-cap" },
  { id: "blueberry", name: "Việt Quất", bodyColor: "#5b8def", topper: "none" },
  { id: "lemon", name: "Chanh Vàng", bodyColor: "#ffe066", topper: "citrus" },
  { id: "grape", name: "Nho Tím", bodyColor: "#b56fd9", topper: "tendril" },
  { id: "mint", name: "Bạc Hà", bodyColor: "#4dd6a0", topper: "leaf" },
  { id: "sunny", name: "Cam Nắng", bodyColor: "#ffb347", topper: "sun" },
];

export const DEFAULT_SKIN_ID = SKIN_CATALOG[0].id;

const SKIN_BY_ID = new Map(SKIN_CATALOG.map((s) => [s.id, s]));

export function getSkinDefinition(skinId: string | null | undefined): SkinDefinition {
  return (skinId != null ? SKIN_BY_ID.get(skinId) : undefined) ?? SKIN_CATALOG[0];
}

// ---- World / Hồ ----
/** Kích thước toàn bộ map (world-space units) — chứa NHIỀU hồ rải rác (xem
 * shared/src/lakes.ts#LAKE_DEFINITIONS), không phải chỉ 1 hồ ở giữa như trước. Tăng từ 3000x2000
 * lên đủ lớn để 6 hồ có khoảng đi bộ giữa chúng thay vì chen chúc. */
export const WORLD_WIDTH = 8000;
export const WORLD_HEIGHT = 7000;

/** Lề an toàn quanh biên để vị trí spawn không rơi đúng mép, camera luôn có thể căn giữa. */
export const PLAYER_SPAWN_EDGE_MARGIN = 300;

/** Tốc độ đi bộ cố định quanh hồ (world units/giây) — không còn đánh đổi tốc độ theo kích thước
 * vì không còn cơ chế lớn dần. */
export const BASE_SPEED = 160;

// ---- Thả cần (Cast) ----
/** Thời gian giữ chuột tối đa để đạt lực quăng 100% (ms). Giữ lâu hơn không tăng thêm. */
export const CAST_MAX_CHARGE_MS = 1200;

/** Khoảng cách quăng cần gần nhất/xa nhất (world units), nội suy theo lực quăng 0..1. */
export const CAST_MIN_RANGE = 60;
export const CAST_MAX_RANGE = 420;

// ---- Cá & độ hiếm ----
export type FishRarity = "common" | "uncommon" | "rare" | "legendary" | "BOSS";

export interface FishSpecies {
  id: string;
  name: string;
  rarity: FishRarity;
  color: string;
  /** Trọng số random khi cá cắn câu — số càng lớn càng dễ ra. */
  weight: number;
  /** Điểm/giá trị cộng khi bắt được. */
  value: number;
  /** Khoảng thời gian chờ cắn câu (ms) sau khi thả cần thành công. */
  biteWaitMinMs: number;
  biteWaitMaxMs: number;
  /** 0..1 — càng cao thì minigame kéo cá càng khó (cá vùng vẫy nhanh/thất thường hơn, vùng bắt hẹp hơn). */
  reelDifficulty: number;
  /** Cân nặng tối thiểu của loài (kg) */
  minWeight: number;
  /** Cân nặng tối đa của loài (kg) */
  maxWeight: number;
  /** Mô tả bựa/hài hước của loài cá */
  description: string;
}

export const FISH_CATALOG: FishSpecies[] = [
  { id: "silver_carp", name: "Silver Carp", rarity: "common", color: "#b8c4cc", weight: 30, value: 50, biteWaitMinMs: 1500, biteWaitMaxMs: 4000, reelDifficulty: 0.1, minWeight: 0.5, maxWeight: 3.0, description: "The nation's fish. Lots of tiny bones, only good for teasing other players." },
  { id: "minnow", name: "Minnow", rarity: "common", color: "#9fd6e0", weight: 26, value: 40, biteWaitMinMs: 1200, biteWaitMaxMs: 3500, reelDifficulty: 0.08, minWeight: 0.05, maxWeight: 0.2, description: "So tiny you might mistake it for a piece of seaweed stuck to your hook." },
  { id: "catfish", name: "Catfish", rarity: "common", color: "#6b5843", weight: 20, value: 70, biteWaitMinMs: 2000, biteWaitMaxMs: 5000, reelDifficulty: 0.2, minWeight: 1.5, maxWeight: 10.0, description: "Grows extra-long whiskers to look dangerous, but actually just likes eating mud." },
  { id: "tilapia", name: "Tilapia", rarity: "uncommon", color: "#7fa8d9", weight: 12, value: 140, biteWaitMinMs: 3000, biteWaitMaxMs: 7000, reelDifficulty: 0.35, minWeight: 0.3, maxWeight: 2.5, description: "Its shiny scales look like an invitation to pan-fry it immediately." },
  { id: "snakehead", name: "Snakehead", rarity: "uncommon", color: "#5a7a3f", weight: 9, value: 180, biteWaitMinMs: 3500, biteWaitMaxMs: 8000, reelDifficulty: 0.45, minWeight: 1.0, maxWeight: 6.0, description: "Looks like a snake but is actually a fish. Master of hide-and-seek under the water lilies." },
  { id: "koi", name: "Koi", rarity: "rare", color: "#ff8c5a", weight: 4, value: 400, biteWaitMinMs: 5000, biteWaitMaxMs: 12000, reelDifficulty: 0.6, minWeight: 1.0, maxWeight: 8.0, description: "The wealthy household's feng-shui fish. Catching it brings good fortune (and points)." },
  { id: "giant_barb", name: "Giant Barb", rarity: "rare", color: "#d9a441", weight: 3, value: 550, biteWaitMinMs: 6000, biteWaitMaxMs: 14000, reelDifficulty: 0.7, minWeight: 10.0, maxWeight: 150.0, description: "Known as the 'king of carps'. A massive fat round fish that will make your arms sore to pull up." },
  { id: "golden_dragonfish", name: "Golden Arowana", rarity: "legendary", color: "#ffd700", weight: 1, value: 1500, biteWaitMinMs: 9000, biteWaitMaxMs: 20000, reelDifficulty: 0.9, minWeight: 5.0, maxWeight: 30.0, description: "The legendary Golden Arowana. Its 24k gold-plated scales shine brightly in the lake." },
  // Ocean species
  { id: "butterfish", name: "Butterfish", rarity: "common", color: "#8fae34", weight: 22, value: 100, biteWaitMinMs: 1600, biteWaitMaxMs: 4500, reelDifficulty: 0.18, minWeight: 0.2, maxWeight: 1.5, description: "Slippery like butter, very easy to lose your grip and slide back into the ocean." },
  { id: "mackerel", name: "Mackerel", rarity: "uncommon", color: "#508a8a", weight: 14, value: 250, biteWaitMinMs: 3200, biteWaitMaxMs: 7500, reelDifficulty: 0.4, minWeight: 0.5, maxWeight: 4.0, description: "Swims extremely fast, often moves in schools to deceive anglers." },
  { id: "tuna", name: "Bluefin Tuna", rarity: "rare", color: "#163f66", weight: 6, value: 800, biteWaitMinMs: 5500, biteWaitMaxMs: 13000, reelDifficulty: 0.65, minWeight: 15.0, maxWeight: 250.0, description: "The powerhouse of the ocean. Weighs hundreds of kilograms, prefers eating sashimi over becoming sashimi." },
  { id: "baby_shark", name: "Baby Shark", rarity: "legendary", color: "#4f6575", weight: 1, value: 2600, biteWaitMinMs: 10000, biteWaitMaxMs: 22000, reelDifficulty: 0.95, minWeight: 5.0, maxWeight: 40.0, description: "Dooo dooo dooo... Was about to sing along but it tried to bite your finger off!" },
  // Meme / Silly items
  { id: "old_boot", name: "Old Boot", rarity: "common", color: "#5c4033", weight: 15, value: 10, biteWaitMinMs: 1000, biteWaitMaxMs: 3000, reelDifficulty: 0.05, minWeight: 0.8, maxWeight: 2.0, description: "An old leather boot discarded by someone. Pulled up covered in mud and completely worthless." },
  { id: "soggy_bread", name: "Soggy Bread", rarity: "common", color: "#e1c699", weight: 18, value: 20, biteWaitMinMs: 1000, biteWaitMaxMs: 2800, reelDifficulty: 0.04, minWeight: 0.2, maxWeight: 0.6, description: "A soggy piece of bread soaked in the lake for days. Don't squeeze it too hard or it turns into mush!" },
  { id: "sad_blobfish", name: "Sad Blobfish", rarity: "rare", color: "#ffb6c1", weight: 5, value: 450, biteWaitMinMs: 4000, biteWaitMaxMs: 10000, reelDifficulty: 0.55, minWeight: 1.0, maxWeight: 9.0, description: "A blobfish with a permanently sad face. Looks like a crying blob of pink jelly." },
  { id: "vicent_wallet", name: "Vicent's Wallet", rarity: "legendary", color: "#8b0000", weight: 1, value: 3000, biteWaitMinMs: 8000, biteWaitMaxMs: 18000, reelDifficulty: 0.85, minWeight: 0.1, maxWeight: 0.5, description: "The missing wallet of game developer Vicent! Full of credit cards and gold coins." },
  // Boss
  { id: "fish_leviathan", name: "Leviathan", rarity: "BOSS", color: "#4B0082", weight: 0.5, value: 50000, biteWaitMinMs: 1000, biteWaitMaxMs: 2000, reelDifficulty: 0.99, minWeight: 500.0, maxWeight: 2000.0, description: "A legendary sea monster. Pulls you into the depths if you fail." },
];

/** Thời gian kéo cá mặc định cho Boss (Thủy quái) (ms). Rất dài để thử thách người chơi. */
export const BOSS_REEL_DURATION_MS = 30000;

export function computeActualDifficulty(baseDifficulty: number, weight: number, minWeight: number, maxWeight: number): number {
  const weightRange = maxWeight - minWeight;
  const weightRatio = weightRange > 0 ? (weight - minWeight) / weightRange : 0.5;
  const rawDifficulty = baseDifficulty + (weightRatio - 0.5) * 0.2;
  return Math.max(0.05, Math.min(0.99, rawDifficulty));
}

/** Tỉ lệ cân nặng của 1 con cá trong khoảng [minWeight, maxWeight] của loài — 0 = nhẹ nhất, 1 =
 * nặng nhất. Dùng chung cho công thức điểm thưởng và thời lượng minigame. */
function weightRatioOf(weight: number, minWeight: number, maxWeight: number): number {
  const range = maxWeight - minWeight;
  return range > 0 ? Math.max(0, Math.min(1, (weight - minWeight) / range)) : 0.5;
}

/** Điểm khi bắt được cá = value cơ bản + thưởng theo cân nặng: cá càng to (so với max của loài)
 * càng nhiều điểm, từ 1× value (nhẹ nhất) tới 2× value (nặng nhất). Yêu cầu trực tiếp của Vicent
 * (2026-07-14): "cân nặng cũng cộng thêm điểm". */
export function computeCatchScore(value: number, weight: number, minWeight: number, maxWeight: number): number {
  return Math.round(value * (1 + weightRatioOf(weight, minWeight, maxWeight)));
}

/** Thời lượng phiên kéo cá (ms) theo cân nặng: cá nhẹ kéo nhanh, cá nặng kéo lâu hơn — từ 0.7× tới
 * 1.6× REEL_DURATION_MS. Yêu cầu của Vicent (2026-07-14): "cân nặng càng to thì chơi minigame lâu
 * hơn". */
export function computeReelDurationMs(weight: number, minWeight: number, maxWeight: number): number {
  return Math.round(REEL_DURATION_MS * (0.7 + weightRatioOf(weight, minWeight, maxWeight) * 0.9));
}

export const RARITY_LABEL: Record<FishRarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  legendary: "Legendary",
  BOSS: "BOSS",
};

export const RARITY_COLOR: Record<FishRarity, string> = {
  common: "#b8c4cc",
  uncommon: "#5b8def",
  rare: "#b56fd9",
  legendary: "#ffd700",
  BOSS: "#ff4d4d",
};

const FISH_BY_ID = new Map(FISH_CATALOG.map((f) => [f.id, f]));

/** O(1) tra cứu loài cá theo id — gọi rất nhiều lần trên hot path (mỗi tick server, mỗi reeling
 * player) nên dùng Map thay vì FISH_CATALOG.find() tuyến tính. */
export function getFishSpecies(id: string | null | undefined): FishSpecies | undefined {
  return id != null ? FISH_BY_ID.get(id) : undefined;
}

// ---- Minigame kéo cá (Reel) ----
// (Không còn bước "móc câu" thủ công — cá cắn là tự động móc, vào thẳng minigame kéo cá; hằng số
// HOOK_WINDOW_MS cũ đã xoá cùng state "biting", xem docs/progress.md.)
//
// REDESIGN (theo yêu cầu trực tiếp của Vicent, kèm 2 ảnh phác thảo tay): gộp 2 thanh
// progress/tension cũ thành 1 thanh dọc DUY NHẤT (thang 0..100, 0 = đáy, 100 = đỉnh). Trên thanh đó
// có "cá" (reelFishY) tự bơi lang thang thất thường kiểu Stardew Valley, và "vùng bắt" (reelZoneY,
// bề rộng = computeReelZoneSize) do người chơi điều khiển — giữ chuột đẩy vùng bắt lên, thả ra thì
// rơi xuống theo trọng lực. Cá càng dễ (reelDifficulty thấp) thì vùng bắt càng RỘNG (dễ giữ cá bên
// trong), cá càng hiếm/khó thì vùng bắt càng HẸP (đúng ảnh 2). Không còn khái niệm "đứt dây"/"chùng
// dây" hay thất bại tức thời nào cả — người chơi luôn chơi đủ REEL_DURATION_MS, sau đó % thời gian
// cá nằm trong vùng bắt trong suốt phiên đó chính là XÁC SUẤT bắt được cá, roll 1 lần duy nhất lúc
// hết giờ (xem backend/src/systems/fishing.ts#updateReeling).

/** Tổng thời lượng cố định (ms) của 1 phiên kéo cá — hết giờ là roll xác suất ngay, bất kể đang làm
 * tốt hay tệ tới đâu. Không đổi theo độ khó loài cá — độ khó nằm ở bề rộng vùng bắt + tốc độ cá bơi,
 * không phải ở thời lượng thử thách. */
export const REEL_DURATION_MS = 8000;

/** Xác suất 1 NPC "bắt được cá" mỗi khi kết thúc 1 phiên câu giả — dùng để NPC tích điểm dần theo
 * thời gian và lên leaderboard chung với người thật (Vicent 2026-07-14), cho hồ trông sống động chứ
 * không toàn số 0. NPC không chơi minigame thật nên chỉ roll xác suất đơn giản này. */
export const NPC_CATCH_CHANCE = 0.55;

/** Bề rộng vùng bắt (thang 0..100, cùng đơn vị với reelFishY/reelZoneY) cho loài DỄ NHẤT
 * (reelDifficulty = 0) — rộng rãi, gần như chỉ cần đứng yên giữa thanh là trúng, đúng ảnh 1. */
export const REEL_ZONE_MAX_SIZE = 62;

/** Bề rộng vùng bắt cho loài KHÓ/HIẾM NHẤT (reelDifficulty = 1) — hẹp lại nhiều, đòi hỏi bám sát
 * cá liên tục, đúng ảnh 2. */
export const REEL_ZONE_MIN_SIZE = 16;

/** Nội suy tuyến tính giữa MAX_SIZE (dễ) và MIN_SIZE (khó) theo reelDifficulty (0..1) của loài cá
 * đang kéo — dùng chung ở cả backend (tính vùng bắt thật) lẫn frontend (vẽ minigame + hiển thị dự
 * đoán), đúng nguyên tắc "1 nguồn chân lý duy nhất" ở đầu file. */
export function computeReelZoneSize(reelDifficulty: number): number {
  const clamped = Math.max(0, Math.min(1, reelDifficulty));
  return REEL_ZONE_MAX_SIZE - (REEL_ZONE_MAX_SIZE - REEL_ZONE_MIN_SIZE) * clamped;
}

/** Gia tốc đẩy vùng bắt LÊN (units/s²) khi đang giữ chuột — cố định, không đổi theo độ khó loài cá
 * (độ khó của cần thủ nằm ở việc phải bám theo 1 con cá bơi thất thường + hẹp vùng bắt, không nằm ở
 * việc tay có "nặng" hay không). */
export const REEL_ZONE_RISE_ACCEL = 260;

/** Gia tốc rơi XUỐNG (units/s²) của vùng bắt khi thả chuột ra — trọng lực, luôn kéo vùng bắt về
 * đáy thanh nếu không giữ chuột liên tục. */
export const REEL_ZONE_GRAVITY = 220;

/** Vận tốc tối đa (units/s, cả 2 chiều) của vùng bắt — chặn trần để không văng quá nhanh qua khỏi
 * cá dù giữ/thả chuột liên tục nhiều khung hình liền. */
export const REEL_ZONE_MAX_SPEED = 150;

/** Tốc độ bơi (units/s) của cá hướng về điểm ngẫu nhiên kế tiếp (reelFishTargetY) cho loài DỄ NHẤT
 * (reelDifficulty = 0) — bơi khá chậm, dễ bám theo. */
export const REEL_FISH_BASE_SPEED = 26;

/** Cộng thêm vào tốc độ bơi cho loài KHÓ/HIẾM NHẤT (reelDifficulty = 1) — bơi nhanh hơn hẳn, khó bám
 * theo hơn nhiều, kết hợp với vùng bắt hẹp (computeReelZoneSize) tạo ra độ khó tổng thể leo theo
 * đúng reelDifficulty của từng loài. */
export const REEL_FISH_DIFFICULTY_SPEED_BONUS = 70;

/** Nội suy tuyến tính tốc độ bơi của cá theo reelDifficulty (0..1) — dùng chung backend/frontend
 * giống computeReelZoneSize. */
export function computeReelFishSpeed(reelDifficulty: number): number {
  const clamped = Math.max(0, Math.min(1, reelDifficulty));
  return REEL_FISH_BASE_SPEED + REEL_FISH_DIFFICULTY_SPEED_BONUS * clamped;
}

/** Sau khi tới nơi (hoặc mỗi khoảng này), cá lại chọn 1 điểm ngẫu nhiên mới trên thanh để bơi tới —
 * khoảng thời gian ngẫu nhiên giữa 2 mốc giúp việc bơi trông "thất thường" (erratic) kiểu Stardew
 * Valley thay vì đều đặn máy móc. */
export const REEL_FISH_RETARGET_MIN_MS = 450;
export const REEL_FISH_RETARGET_MAX_MS = 1500;

/** Lề an toàn (thang 0..100) mà điểm đích ngẫu nhiên của cá không được vượt qua — tránh cá cứ nhắm
 * sát mép trên/dưới thanh liên tục trông thiếu tự nhiên. */
export const REEL_FISH_TARGET_MARGIN = 8;

// ---- Leaderboard ----
/** Số lượng vị trí hiển thị trên bảng xếp hạng mỗi hồ — xếp theo tổng giá trị cá đã bắt được. */
export const LEADERBOARD_SIZE = 10;

// ---- Simulation tick ----
export const SERVER_TICK_RATE = 20;

// ---- Networking / anti-abuse ----
/** Khoảng cách tối thiểu (ms) giữa 2 message "move" liên tiếp được server chấp nhận. */
export const MIN_MOVE_MESSAGE_INTERVAL_MS = 20;

/** Khoảng cách tối thiểu (ms) giữa 2 message hành động (cast/hook/reel) liên tiếp từ cùng 1 người
 * chơi — chặn spam message rác dù server luôn từ chối hành động không hợp lệ ở tầng game-logic. */
export const MIN_ACTION_MESSAGE_INTERVAL_MS = 60;
