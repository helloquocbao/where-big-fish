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

  /** id of the lake (LAKE_DEFINITIONS) where the player successfully cast their line most recently — "" if they haven't fished in any
   * lake yet this session. See shared/src/types.ts#PlayerState. */
  @type("string") currentLakeId: string = "";

  // ---- Server-internal bookkeeping, NOT part of the shared PlayerState wire shape ----
  /** Desired movement angle from the last "move" input — not synced (frontend doesn't need it,
   * only the resulting x/y/angle). */
  desiredAngle: number = 0;
  /** Whether the player is currently holding a movement key (from "move" message) — not synced, see movement.ts. */
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

  // ---- Server-only bookkeeping for the "1-bar" reel minigame (no synchronization needed, see
  // shared/src/types.ts#PlayerState + backend/src/systems/fishing.ts#updateReeling) ----
  /** 0..100 — % of time the fish is inside the capture zone up to the current moment of the reeling session (used to roll
   * probability when time is up). NOT synced via schema — sent specifically to the owner via "reel_state" event. */
  reelProgress: number = 0;
  /** 0..100 — position of the "fish" on the bar (the fish swims erratically on its own). NOT synced — see reelProgress. */
  reelFishY: number = 50;
  /** 0..100 — center of the "capture zone" controlled by the player. NOT synced — see reelProgress. */
  reelZoneY: number = 50;
  /** Current velocity (units/s) of the capture zone (reelZoneY) — increases when holding click, decreases (falls) when released. */
  reelZoneVelocity: number = 0;
  /** Random point (0..100) that the "fish" (reelFishY) is currently swimming towards. */
  reelFishTargetY: number = 50;
  /** Epoch ms when the fish chooses the NEXT random target destination. */
  reelFishNextRetargetAt: number = 0;
  /** Epoch ms when the current reeling session started — used to calculate elapsed vs reelDurationMs. */
  reelStartedAtMs: number = 0;
  /** Duration of the current reeling session (ms) — calculated based on the fish's weight when it bit
   * (computeReelDurationMs): heavier fish take longer to reel. Default = REEL_DURATION_MS in case it's not set. */
  reelDurationMs: number = REEL_DURATION_MS;
  /** Accumulated total time (ms) that the fish is inside the capture zone since reelStartedAtMs — the % of this compared to
   * reelDurationMs is the probability of catching the fish when time is up. */
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
