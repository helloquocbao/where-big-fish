import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";
import { REEL_DURATION_MS } from "@bomio/shared";
import type { FishingState } from "@bomio/shared";

/**
 * @colyseus/schema classes are the actual network-synced state. Field shapes mirror the plain
 * interfaces in @bomio/shared's types.ts (PlayerState, LeaderboardEntry) — those interfaces
 * describe the contract; these classes are the wire implementation.
 */

export class PlayerSchema extends Schema {
  @type("string") id: string = "";
  @type("string") name: string = "";
  @type("string") skinId: string = "";
  @type("boolean") isNpc: boolean = false;
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") angle: number = 0;

  @type("string") fishState: FishingState = "idle";
  @type("number") bobberX: number = 0;
  @type("number") bobberY: number = 0;
  @type("string") activeFishSpeciesId: string = "";
  @type("number") activeFishWeight: number = 0;

  @type("number") caughtCount: number = 0;
  @type("number") totalValue: number = 0;
  @type(["string"]) collection = new ArraySchema<string>();

  /** id của hồ (LAKE_DEFINITIONS) vừa thả cần thành công lần gần nhất — "" nếu chưa từng câu ở hồ
   * nào phiên này. Xem shared/src/types.ts#PlayerState. */
  @type("string") currentLakeId: string = "";

  // ---- Server-internal bookkeeping, NOT part of the shared PlayerState wire shape ----
  /** Desired movement angle from the last "move" input — not synced (frontend doesn't need it,
   * only the resulting x/y/angle). */
  desiredAngle: number = 0;
  /** Đang giữ phím di chuyển hay không (từ message "move") — không synced, xem movement.ts. */
  desiredMoving: boolean = false;
  lastMoveMessageAt: number = 0;
  lastActionMessageAt: number = 0;
  /** Epoch ms a pending bite will actually happen — only meaningful while fishState === "waiting". */
  biteAt: number = 0;
  /** Species rolled for the CURRENT cast, known as soon as it lands but only revealed to the
   * player once they actually hook it (activeFishSpeciesId, which IS synced). */
  pendingSpeciesId: string = "";
  /** Whether the local/NPC player is currently holding the reel-pull input — set by the "reel"
   * message (real players) or by npcFishers.ts (bots), consumed each tick in fishing.ts. */
  reelPulling: boolean = false;
  /** Epoch ms for an NPC's next scripted action (cast / attempt hook) — unused for real players. */
  npcNextActionAt: number = 0;

  // ---- Reel minigame "1 thanh" bookkeeping thuần server (không cần đồng bộ, xem
  // shared/src/types.ts#PlayerState + backend/src/systems/fishing.ts#updateReeling) ----
  /** 0..100 — % thời gian cá nằm trong vùng bắt tính tới hiện tại của phiên đang kéo (dùng để roll
   * xác suất lúc hết giờ). KHÔNG synced qua schema — gửi riêng cho chủ nhân qua event "reel_state". */
  reelProgress: number = 0;
  /** 0..100 — vị trí "cá" trên thanh (cá tự bơi thất thường). KHÔNG synced — xem reelProgress. */
  reelFishY: number = 50;
  /** 0..100 — tâm "vùng bắt" do người chơi điều khiển. KHÔNG synced — xem reelProgress. */
  reelZoneY: number = 50;
  /** Vận tốc hiện tại (units/s) của vùng bắt (reelZoneY) — tăng khi giữ chuột, giảm (rơi) khi thả. */
  reelZoneVelocity: number = 0;
  /** Điểm ngẫu nhiên (0..100) mà "cá" (reelFishY) đang bơi hướng tới. */
  reelFishTargetY: number = 50;
  /** Epoch ms lúc cá chọn điểm đích ngẫu nhiên KẾ TIẾP. */
  reelFishNextRetargetAt: number = 0;
  /** Epoch ms lúc phiên kéo cá hiện tại bắt đầu — dùng để tính elapsed vs reelDurationMs. */
  reelStartedAtMs: number = 0;
  /** Thời lượng phiên kéo cá hiện tại (ms) — tính theo cân nặng con cá lúc cắn câu
   * (computeReelDurationMs): cá nặng kéo lâu hơn. Mặc định = REEL_DURATION_MS phòng khi chưa set. */
  reelDurationMs: number = REEL_DURATION_MS;
  /** Tổng cộng dồn (ms) thời gian cá nằm trong vùng bắt kể từ reelStartedAtMs — % của số này so với
   * reelDurationMs chính là xác suất bắt được cá lúc hết giờ. */
  reelTimeInZoneMs: number = 0;
}

export class LeaderboardEntrySchema extends Schema {
  @type("string") playerId: string = "";
  @type("string") name: string = "";
  @type("number") totalValue: number = 0;
  @type("number") caughtCount: number = 0;
  @type("boolean") isNpc: boolean = false;
}

export class RoomState extends Schema {
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
  @type([LeaderboardEntrySchema]) leaderboard = new ArraySchema<LeaderboardEntrySchema>();
}
