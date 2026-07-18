/**
 * Shared schema for realtime state/messages between client and server.
 * Backend is the authoritative source; frontend only reads this state to render + predict UI.
 *
 * PIVOT (2026-07-11): multi-lake fishing game — see constants.ts at the beginning of the file to know the reason for changing from
 * the old PvP "stomp/bomb" game.
 */

import type { FishRarity } from "./constants.js";

/** No more "biting" state — when a fish bites it is AUTOMATICALLY hooked, transitioning directly from waiting -> reeling (Vicent's
 * decision: remove the click-in-time-within-0.9s step to simplify the core loop, see docs/progress.md).
 * Also no separate "casting" state — server resolves cast synchronously (idle -> waiting in 1 step,
 * see backend/src/systems/fishing.ts#tryCast), so the bobber has no "flying" phase at the state level. */
export type FishingState = "idle" | "waiting" | "reeling" | "boss_choice" | "boss_assisting";

export interface PlayerState {
  id: string;
  name: string;
  skinId: string; // see SKIN_CATALOG in constants.ts — purely cosmetic
  isNpc: boolean; // see NPC_FISHER_TARGET_POPULATION — NPC to fill slots when the lake has few real players
  x: number;
  y: number;
  angle: number; // direction currently standing/looking (and direction of casting when releasing), radians

  // ---- Fishing state ----
  fishState: FishingState;
  bobberX: number; // bobber position on the lake surface when waiting/reeling
  bobberY: number;
  activeFishSpeciesId: string; // the fish species being reeled (only when fishState === "reeling"), "" if none
  activeFishWeight: number; // weight of the fish being reeled (kg)
  // ---- "1-bar" reeling minigame ----
  // reelProgress / reelFishY / reelZoneY INTENTIONALLY DO NOT reside in the synchronized state: they change every tick
  // (20Hz) and ONLY make sense for the modal of the ACTUAL player reeling — no other client renders the
  // reel-internals of others. Previously, syncing via schema meant Colyseus broadcasted deltas to EVERY
  // client in the room (wasting ~O(number of reelers × number of clients) every 50ms). Now the server sends it PRIVATELY to the
  // owner via ServerEvent "reel_state" every tick (see backend/src/systems/fishing.ts#updateReeling +
  // frontend/src/main.ts). The catch zone width is recalculated by the frontend from activeFishSpeciesId so it does not
  // need synchronization.

  // ---- Achievements ----
  caughtCount: number;
  totalValue: number;
  collection: string[]; // list of speciesId ever caught (no duplicates) — personal collection book
  assistingPlayerId: string; // The ID of the main player this player is currently helping (when fishState === "boss_assisting"), "" if none

  /** id of the lake (see shared/src/lakes.ts#LAKE_DEFINITIONS) where the rod was successfully cast most recently — ""
   * if the player has not fished in any lake this session. Only updated when casting (tryCast), not the "lake standing
   * nearby" in real-time when walking. */
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
  angle: number; // direction of desired movement, radians (only makes sense when moving === true)
  /** Whether holding a movement key (WASD/arrows) or not — previously the character always walked continuously in
   * the direction of the mouse, now "walking" (keys, can stand still) is separated from "aiming/casting" (mouse). */
  moving: boolean;
}

/** Cast rod — only valid when fishState === "idle". `power` 0..1 (mouse hold duration / CAST_MAX_CHARGE_MS). */
export interface InputCastMessage {
  type: "cast";
  angle: number;
  power: number;
}

/** Reeling minigame result simulated by the CLIENT itself and reported back — client-authoritative to reduce server
 * load (Vicent 2026-07-14): server no longer simulates the catch zone/fish every tick, it only receives the total time the fish
 * was inside the catch zone (ms) throughout the session, clamps it by reelDurationMs, then rolls the probability to catch it. */
export interface ReelResultMessage {
  type: "reel_result";
  timeInZoneMs: number;
}

export interface InputRetractMessage {
  type: "retract";
}

export interface InputBossActionMessage {
  type: "boss_action";
  action: "reel" | "run";
}

export interface InputAssistBossMessage {
  type: "assist_boss";
  targetPlayerId: string;
}

export type ClientMessage = InputMoveMessage | InputCastMessage | ReelResultMessage | InputRetractMessage | InputBossActionMessage | InputAssistBossMessage;

// ---- Server -> Client event messages (in addition to periodic state sync) ----

export type ServerEvent =
  // Fish bites (and AUTOMATICALLY hooked, goes straight to reeling) — client shows effect/opens reeling modal.
  | { type: "fish_bite"; playerId: string }
  // (Removed "reel_state": client simulates reeling minigame itself & reports result via ReelResultMessage,
  // server no longer broadcasts reel bar state at 20Hz — reducing server load, Vicent 2026-07-14.)
  | {
      type: "catch_result";
      playerId: string;
      success: boolean;
      speciesId?: string;
      rarity?: FishRarity;
      value?: number;
      weight?: number; // Weight of the caught fish (kg)
      isFirstCatch?: boolean; // true if this is the first time catching this species (added to collection book)
      reason?: "fish_escaped" | "dragged_in"; // REEL_DURATION_MS exceeded, probability roll based on % of time in catch zone
      // failed — fish escaped. No longer "line_snapped" (line snapped) after removing the tension mechanism.
    }
  // Sent PRIVATELY to the player who just failed to cast because they stood outside the LAKE_CAST_RANGE of all lakes (see
  // backend/src/systems/fishing.ts#tryCast) — not broadcasted to the whole room, only that player needs to know.
  | { type: "cast_rejected"; reason: "too_far_from_lake" }
  | { type: "boss_hooked"; playerId: string; speciesId: string }
  | { type: "boss_helpers_update"; playerId: string; count: number }
  | { type: "boss_dragged_in"; playerIds: string[] };
