/**
 * Schema dùng chung cho realtime state/messages giữa client-server.
 * Backend là authoritative source; frontend chỉ đọc state này để render + dự đoán UI.
 *
 * PIVOT (2026-07-11): game câu cá nhiều hồ — xem constants.ts đầu file để biết lý do đổi từ
 * game PvP "nhảy đè/bomb" cũ.
 */

import type { FishRarity } from "./constants.js";

/** Không còn state "biting" — cá cắn câu là TỰ ĐỘNG móc, chuyển thẳng waiting -> reeling (quyết
 * định của Vicent: bỏ bước bấm-kịp-0.9s, đơn giản hoá core loop, xem docs/progress.md).
 * Cũng không có state "casting" riêng — server resolve cast đồng bộ (idle -> waiting trong 1 bước,
 * xem backend/src/systems/fishing.ts#tryCast), nên phao không có giai đoạn "đang bay" ở tầng state. */
export type FishingState = "idle" | "waiting" | "reeling";

export interface PlayerState {
  id: string;
  name: string;
  skinId: string; // xem SKIN_CATALOG trong constants.ts — thuần cosmetic
  isNpc: boolean; // xem NPC_FISHER_TARGET_POPULATION — NPC lấp chỗ trống khi hồ ít người thật
  x: number;
  y: number;
  angle: number; // hướng đang đứng/nhìn (và hướng quăng cần lúc thả), radian

  // ---- Trạng thái câu cá ----
  fishState: FishingState;
  bobberX: number; // vị trí phao trên mặt hồ khi đang waiting/reeling
  bobberY: number;
  activeFishSpeciesId: string; // loài cá đang kéo (chỉ có khi fishState === "reeling"), "" nếu không có
  activeFishWeight: number; // cân nặng của con cá đang kéo (kg)
  // ---- Minigame kéo cá "1 thanh" ----
  // reelProgress / reelFishY / reelZoneY CỐ TÌNH KHÔNG nằm trong state đồng bộ: chúng đổi mỗi tick
  // (20Hz) và CHỈ có ý nghĩa với modal của CHÍNH người chơi đang kéo — không client nào render
  // reel-internals của người khác. Trước đây sync qua schema thì Colyseus broadcast delta cho MỌI
  // client trong room (lãng phí ~O(số người kéo × số client) mỗi 50ms). Giờ server gửi RIÊNG cho chủ
  // nhân qua ServerEvent "reel_state" mỗi tick (xem backend/src/systems/fishing.ts#updateReeling +
  // frontend/src/main.ts). Bề rộng vùng bắt frontend tự tính lại từ activeFishSpeciesId nên không
  // cần đồng bộ.

  // ---- Thành tích ----
  caughtCount: number;
  totalValue: number;
  collection: string[]; // danh sách speciesId đã từng bắt được (không lặp) — sổ sưu tập cá nhân

  /** id của hồ (xem shared/src/lakes.ts#LAKE_DEFINITIONS) vừa thả cần thành công lần gần nhất — ""
   * nếu chưa từng câu ở hồ nào phiên này. Chỉ cập nhật lúc cast (tryCast), không phải "hồ đang đứng
   * gần" theo thời gian thực khi đi bộ. */
  currentLakeId: string;
}

export interface RoomSnapshot {
  players: PlayerState[];
  leaderboard: LeaderboardEntry[];
}

export interface LeaderboardEntry {
  playerId: string;
  name: string;
  totalValue: number;
  caughtCount: number;
  isNpc: boolean;
}

// ---- Client -> Server input messages ----

export interface InputMoveMessage {
  type: "move";
  angle: number; // hướng di chuyển mong muốn, radian (chỉ có ý nghĩa khi moving === true)
  /** Đang giữ 1 phím di chuyển (WASD/mũi tên) hay không — trước đây nhân vật luôn đi liên tục theo
   * hướng chuột, giờ tách bạch "đi bộ" (phím, có thể đứng yên) khỏi "nhắm/thả cần" (chuột). */
  moving: boolean;
}

/** Thả cần — chỉ có hiệu lực khi fishState === "idle". `power` 0..1 (thời gian giữ chuột / CAST_MAX_CHARGE_MS). */
export interface InputCastMessage {
  type: "cast";
  angle: number;
  power: number;
}

/** Kết quả minigame kéo cá do CLIENT tự mô phỏng rồi báo về — client-authoritative để giảm tải
 * server (Vicent 2026-07-14): server không còn sim vùng bắt/cá mỗi tick, chỉ nhận tổng thời gian cá
 * nằm trong vùng bắt (ms) suốt phiên, clamp theo reelDurationMs rồi roll xác suất bắt được. */
export interface ReelResultMessage {
  type: "reel_result";
  timeInZoneMs: number;
}

export type ClientMessage = InputMoveMessage | InputCastMessage | ReelResultMessage;

// ---- Server -> Client event messages (ngoài state sync định kỳ) ----

export type ServerEvent =
  // Cá cắn câu (và TỰ ĐỘNG móc, vào thẳng reeling) — client hiện hiệu ứng/mở modal kéo cá.
  | { type: "fish_bite"; playerId: string }
  // (Đã bỏ "reel_state": client tự mô phỏng minigame kéo cá & báo kết quả về qua ReelResultMessage,
  // server không còn bắn trạng thái thanh kéo 20Hz nữa — giảm tải server, Vicent 2026-07-14.)
  | {
      type: "catch_result";
      playerId: string;
      success: boolean;
      speciesId?: string;
      rarity?: FishRarity;
      value?: number;
      weight?: number; // Cân nặng của con cá câu được (kg)
      isFirstCatch?: boolean; // true nếu đây là lần đầu bắt được loài này (thêm vào sổ sưu tập)
      reason?: "fish_escaped"; // hết REEL_DURATION_MS, roll xác suất theo % thời gian trong vùng bắt
      // không trúng — cá thoát. Không còn "line_snapped" (đứt dây) sau khi bỏ cơ chế tension.
    }
  // Gửi RIÊNG cho người vừa thả cần hụt vì đứng ngoài LAKE_CAST_RANGE của mọi hồ (xem
  // backend/src/systems/fishing.ts#tryCast) — không broadcast cho cả phòng, chỉ người đó cần biết.
  | { type: "cast_rejected"; reason: "too_far_from_lake" };
