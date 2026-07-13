/**
 * Schema dùng chung cho realtime state/messages giữa client-server.
 * Backend là authoritative source; frontend chỉ đọc state này để render + dự đoán UI.
 *
 * PIVOT (2026-07-11): game câu cá nhiều hồ — xem constants.ts đầu file để biết lý do đổi từ
 * game PvP "nhảy đè/bomb" cũ.
 */

import type { FishRarity } from "./constants.js";

/** Không còn state "biting" — cá cắn câu là TỰ ĐỘNG móc, chuyển thẳng waiting -> reeling (quyết
 * định của Vicent: bỏ bước bấm-kịp-0.9s, đơn giản hoá core loop, xem docs/progress.md). */
export type FishingState = "idle" | "casting" | "waiting" | "reeling";

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
  reelProgress: number; // 0..100 — đã "kéo được" bao nhiêu, xem REEL_PROGRESS_* trong constants.ts
  reelTension: number; // 0..100 — độ căng dây câu, giữ chuột kéo liên tục sẽ tăng, thả ra sẽ giảm;
  // chạm REEL_TENSION_MAX thì đứt dây (mất cá) — xem REEL_TENSION_* trong constants.ts

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

/** Giữ/nhả nút kéo cần trong minigame kéo cá — chỉ có ý nghĩa khi fishState === "reeling". */
export interface InputReelMessage {
  type: "reel";
  pulling: boolean;
}

export type ClientMessage = InputMoveMessage | InputCastMessage | InputReelMessage;

// ---- Server -> Client event messages (ngoài state sync định kỳ) ----

export type ServerEvent =
  // Cá cắn câu (và TỰ ĐỘNG móc, vào thẳng reeling) — client hiện hiệu ứng/mở modal kéo cá.
  | { type: "fish_bite"; playerId: string }
  | {
      type: "catch_result";
      playerId: string;
      success: boolean;
      speciesId?: string;
      rarity?: FishRarity;
      value?: number;
      isFirstCatch?: boolean; // true nếu đây là lần đầu bắt được loài này (thêm vào sổ sưu tập)
      reason?: "fish_escaped" | "line_snapped"; // line_snapped: giữ chuột kéo liên tục không thả
      // ra, độ căng dây chạm REEL_TENSION_MAX — đứt dây, mất cá
    }
  // Gửi RIÊNG cho người vừa thả cần hụt vì đứng ngoài LAKE_CAST_RANGE của mọi hồ (xem
  // backend/src/systems/fishing.ts#tryCast) — không broadcast cho cả phòng, chỉ người đó cần biết.
  | { type: "cast_rejected"; reason: "too_far_from_lake" };
