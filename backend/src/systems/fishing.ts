import type { MapSchema } from "@colyseus/schema";
import {
  CAST_MIN_RANGE,
  CAST_MAX_RANGE,
  REEL_DURATION_MS,
  NPC_CATCH_CHANCE,
  computeCatchScore,
  computeReelDurationMs,
  getFishSpecies,
  findNearestLake,
  isInsideLake,
  pickRandomFishSpeciesForLake,
  LAKE_CAST_RANGE,
  BOSS_REEL_DURATION_MS,
} from "@bomio/shared";
import type { ServerEvent } from "@bomio/shared";
import type { PlayerSchema } from "../schema/State.js";
import { clamp, randRange } from "./utils.js";

/** Grace period (ms) after reelDurationMs that the server waits for the client to report the fishing result;
 * if this time is exceeded (client disconnects/closes tab), automatically reset to idle to avoid getting stuck in the reeling state. */
const REEL_RESULT_GRACE_MS = 5000;

export interface FishingContext {
  players: MapSchema<PlayerSchema>;
  now: number;
  deltaSeconds: number;
  /** Send an event DIRECTLY to the relevant player (do not broadcast to the entire room). fish_bite/catch_result
   * only makes sense for that specific player (the client ignores other players' events — see
   * frontend/src/main.ts), so fanning out to the whole room is a waste of bandwidth at O(number of clients).
   * NPCs do not have a client -> notify is a no-op (see GameRoom.notifyPlayer). */
  notify: (playerId: string, event: ServerEvent) => void;
}

export type CastResult = "ok" | "not_idle" | "too_far";

/** Cast line — only valid when idle (fishState === "idle") AND standing within the LAKE_CAST_RANGE
 * of a lake (see shared/src/lakes.ts) — standing in the middle of an open field far from the lake is rejected
 * completely (no state change). Returns CastResult so the caller (GameRoom.ts) knows how to respond
 * individually to the player when rejected for being too far from the lake (see ServerEvent "cast_rejected") — no
 * response is needed for "not_idle" (just 2 harmless overlapping messages, see tryCast in input.ts).
 * Fish is rolled according to the specific fish pool of that lake (pickRandomFishSpeciesForLake, different lakes have different fish)
 * and schedules the bite time — the player/observer does not know the species until hooked
 * successfully (activeFishSpeciesId is only set at that point), keeping the suspense of "not knowing what you just caught". */
export function tryCast(player: PlayerSchema, angle: number, power: number, now: number): CastResult {
  if (player.fishState !== "idle") return "not_idle";

  const nearest = findNearestLake(player.x, player.y);
  if (!nearest || nearest.distance > LAKE_CAST_RANGE) return "too_far";
  const lake = nearest.lake;

  const clampedPower = clamp(power, 0, 1);
  const dist = CAST_MIN_RANGE + (CAST_MAX_RANGE - CAST_MIN_RANGE) * clampedPower;
  player.angle = angle;
  const rawBobberX = player.x + Math.cos(angle) * dist;
  const rawBobberY = player.y + Math.sin(angle) * dist;

  // Step back from target to player to find if the line crosses water (for narrow shapes like rivers)
  let bobberX = rawBobberX;
  let bobberY = rawBobberY;
  let found = false;

  for (let step = 0; step <= 20; step++) {
    const t = step / 20;
    const testX = rawBobberX * (1 - t) + player.x * t;
    const testY = rawBobberY * (1 - t) + player.y * t;
    if (isInsideLake(lake, testX, testY)) {
      bobberX = testX;
      bobberY = testY;
      found = true;
      break;
    }
  }

  // Fallback: if the entire ray from player to target does not touch water (player aimed too far/off the lake) then
  // ENSURE the bobber still falls INSIDE the water (old bug: snapping to polygon vertices right on the edge -> bobber "out of the lake",
  // Vicent 2026-07-14). Method: scan from target to CENTROID (average of all vertices) — this point lies
  // inside the lake for both blob lakes and winding rivers — take the first in-water point closest to the aimed direction.
  if (!found) {
    let cxSum = 0;
    let cySum = 0;
    for (const v of lake.polygon) {
      cxSum += lake.centerX + v.x;
      cySum += lake.centerY + v.y;
    }
    const centroidX = cxSum / lake.polygon.length;
    const centroidY = cySum / lake.polygon.length;
    for (let step = 0; step <= 24; step++) {
      const t = step / 24;
      const testX = rawBobberX * (1 - t) + centroidX * t;
      const testY = rawBobberY * (1 - t) + centroidY * t;
      if (isInsideLake(lake, testX, testY)) {
        bobberX = testX;
        bobberY = testY;
        found = true;
        break;
      }
    }
    if (!found) {
      // Extremely rare (centroid falls outside an unusually concave lake) — use the centroid directly.
      bobberX = centroidX;
      bobberY = centroidY;
    }
  }

  player.bobberX = bobberX;
  player.bobberY = bobberY;

  player.currentLakeId = lake.id;
  const species = pickRandomFishSpeciesForLake(lake);
  player.pendingSpeciesId = species.id;
  player.fishState = "waiting";
  player.biteAt = now + randRange(species.biteWaitMinMs, species.biteWaitMaxMs);
  return "ok";
}

export function retractCast(player: PlayerSchema): boolean {
  if (player.fishState === "waiting") {
    resetToIdle(player);
    return true;
  }
  return false;
}

function resetToIdle(player: PlayerSchema): void {
  player.fishState = "idle";
  player.activeFishSpeciesId = "";
  player.activeFishWeight = 0;
  player.pendingSpeciesId = "";
  player.reelProgress = 0;
  player.reelFishY = 50;
  player.reelZoneY = 50;
  player.reelPulling = false;
  player.reelZoneVelocity = 0;
  player.reelFishTargetY = 50;
  player.reelFishNextRetargetAt = 0;
  player.reelStartedAtMs = 0;
  player.reelDurationMs = REEL_DURATION_MS;
  player.reelTimeInZoneMs = 0;
  player.assistingPlayerId = "";
}

/** Per-tick: when it's time for the fish to bite (`biteAt`), AUTOMATICALLY hook and enter the reel minigame directly — no
 * more "biting" state + 0.9s reaction window as before (Vicent's decision: when fish bites, enter solo fight with the
 * fish immediately, see docs/progress.md). Call once per server tick over every player, both real and NPC
 * (NPCs get pushed through the exact same state machine — see npcFishers.ts). */
export function updateBiteScheduling(ctx: FishingContext): void {
  for (const [, player] of ctx.players) {
    if (player.fishState === "waiting" && ctx.now >= player.biteAt) {
      const pendingSpecies = getFishSpecies(player.pendingSpeciesId);
      if (pendingSpecies?.rarity === "BOSS") {
        if (player.isNpc) {
          // NPCs don't take part in the boss risk/reward system (no client to show the choice/fight to,
          // and the NPC auto-catch shortcut below has no rarity gate) — treat the bite as a pass instead
          // of letting it fall through and get auto-caught for full boss value at no risk.
          resetToIdle(player);
          continue;
        }
        // Boss fight choice
        player.fishState = "boss_choice";
        player.biteAt = 0;
        ctx.notify(player.id, { type: "boss_hooked", playerId: player.id, speciesId: pendingSpecies.id });
        continue;
      }

      player.fishState = "reeling";
      player.activeFishSpeciesId = player.pendingSpeciesId;
      const species = getFishSpecies(player.activeFishSpeciesId);
      if (species) {
        player.activeFishWeight = Math.round(randRange(species.minWeight, species.maxWeight) * 100) / 100;
        // The heavier the fish, the longer the reel duration (Vicent's request 2026-07-14).
        player.reelDurationMs = computeReelDurationMs(player.activeFishWeight, species.minWeight, species.maxWeight);
      } else {
        player.activeFishWeight = 0;
        player.reelDurationMs = REEL_DURATION_MS;
      }
      player.pendingSpeciesId = "";
      // Start a new bar: both fish + catch zone start in the middle of the bar, session timer starts here.
      player.reelProgress = 0;
      player.reelFishY = 50;
      player.reelZoneY = 50;
      player.reelZoneVelocity = 0;
      player.reelFishTargetY = 50;
      player.reelFishNextRetargetAt = ctx.now;
      player.reelStartedAtMs = ctx.now;
      player.reelTimeInZoneMs = 0;
      ctx.notify(player.id, { type: "fish_bite", playerId: player.id });
    }
  }
}

export function handleBossAction(
  player: PlayerSchema,
  action: "reel" | "run",
  now: number,
  allPlayers: MapSchema<PlayerSchema>,
  notify: (playerId: string, event: ServerEvent) => void
): void {
  if (player.fishState !== "boss_choice") return;

  if (action === "run") {
    resetToIdle(player);
    notify(player.id, { type: "catch_result", playerId: player.id, success: false, reason: "fish_escaped" });
    // Helpers assisting this fight get no other signal that it's over (their own fishState flip to idle is
    // silent) — give them the same explicit result so the group always gets a clear outcome, not just a modal
    // that vanishes with no explanation (see docs/progress.md).
    for (const [, helper] of allPlayers) {
      if (helper.assistingPlayerId === player.id) {
        resetToIdle(helper);
        notify(helper.id, { type: "catch_result", playerId: helper.id, success: false, reason: "fish_escaped" });
      }
    }
    return;
  }

  // action === "reel"
  player.fishState = "reeling"; // Re-use reeling state, client will see it's a boss from activeFishSpeciesId
  player.activeFishSpeciesId = player.pendingSpeciesId;
  const species = getFishSpecies(player.activeFishSpeciesId);
  player.activeFishWeight = species ? Math.round(randRange(species.minWeight, species.maxWeight) * 100) / 100 : 1000;
  player.reelDurationMs = BOSS_REEL_DURATION_MS; // Fixed massive duration for bosses
  player.pendingSpeciesId = "";

  player.reelProgress = 0;
  player.reelFishY = 50;
  player.reelZoneY = 50;
  player.reelZoneVelocity = 0;
  player.reelFishTargetY = 50;
  player.reelFishNextRetargetAt = now;
  player.reelStartedAtMs = now;
  player.reelTimeInZoneMs = 0;
  
  // Re-use fish_bite to trigger the reel minigame UI
  notify(player.id, { type: "fish_bite", playerId: player.id });
}

export function handleAssistBoss(
  player: PlayerSchema, 
  targetPlayerId: string, 
  allPlayers: MapSchema<PlayerSchema>,
  notify: (playerId: string, event: ServerEvent) => void
): void {
  if (player.fishState !== "idle") return; // Must be idle to assist
  
  const target = allPlayers.get(targetPlayerId);
  if (!target) return;
  if (target.fishState !== "boss_choice" && target.fishState !== "reeling") return; // target must be fighting boss
  const targetSpecies = getFishSpecies(target.activeFishSpeciesId || target.pendingSpeciesId);
  if (targetSpecies?.rarity !== "BOSS") return;

  // Check distance (must be close to target)
  const distSq = (player.x - target.x) ** 2 + (player.y - target.y) ** 2;
  if (distSq > 150 * 150) return; // Must be within 150 units

  player.fishState = "boss_assisting";
  player.assistingPlayerId = target.id;

  // Notify the main player that they got a helper (could be used by client to ease the minigame)
  let helperCount = 0;
  for (const [, p] of allPlayers) {
    if (p.assistingPlayerId === target.id) helperCount++;
  }
  notify(target.id, { type: "boss_helpers_update", playerId: target.id, count: helperCount });
}

/** Per-tick: advance the "1 bar" reel minigame for everyone who is reeling (redesign requested
 * directly by Vicent, with 2 hand-drawn sketches — see shared/src/constants.ts under the Reel section).
 *
 * Mechanics: "fish" (reelFishY) swims around erratically Stardew Valley style, picking a random
 * new target point on the bar every REEL_FISH_RETARGET_MIN/MAX_MS then swims directly towards it with
 * computeReelFishSpeed(reelDifficulty). "Catch zone" (reelZoneY, width computeReelZoneSize) is
 * controlled by the player — holding down click (`reelPulling`) accelerates it upwards (REEL_ZONE_RISE_ACCEL),
 * releasing makes it fall down due to gravity (REEL_ZONE_GRAVITY), speed is always capped at
 * REEL_ZONE_MAX_SPEED. Each tick, if the fish is inside the catch zone, accumulate into
 * `reelTimeInZoneMs`. There are no longer any INSTANT failure/success conditions (no line snap/slacks)
 * — the player always plays for the full REEL_DURATION_MS, then ROLLS A SINGLE PROBABILITY
 * based on the % of time the fish spent inside the catch zone during that session to decide if caught or lost. */
export function updateReeling(ctx: FishingContext): void {
  for (const [, player] of ctx.players) {
    // Cleanup stuck assistants if their target disconnected or is no longer fighting
    if (player.fishState === "boss_assisting") {
      const target = ctx.players.get(player.assistingPlayerId);
      if (!target || (target.fishState !== "boss_choice" && target.fishState !== "reeling")) {
        resetToIdle(player);
      }
      continue;
    }

    if (player.fishState !== "reeling") continue;

    // NPCs DO NOT run the actual reel minigame: no client renders the reel-internals of NPCs
    // (reelFishY/reelZoneY/reelProgress are only used for the modal of the local player, see
    // frontend/src/main.ts), and NPCs have been excluded from the leaderboard (purely cosmetic). If NPCs ran
    // the simulation, they would mutate 3 synced fields × ~27 NPCs/room every tick -> Colyseus broadcasts deltas to all
    // clients every 50ms, wasting massive bandwidth under high load. Instead, NPCs just "pretend" to reel
    // for the full REEL_DURATION_MS (from the outside you still see the bobber bobbing + reeling state) and then return to idle
    // to cast again — touching zero synced fields during the session, and sending no events.
    if (player.isNpc) {
      if (ctx.now - player.reelStartedAtMs >= REEL_DURATION_MS) {
        // NPC finished a fake reel session: roll a simple probability to catch a fish occasionally and accumulate
        // score gradually -> climb the leaderboard along with real players to make the lake feel alive (Vicent 2026-07-14).
        // DO NOT simulate the real minigame (see bandwidth reasons in the comment above), just add score once.
        const npcSpecies = getFishSpecies(player.activeFishSpeciesId);
        if (npcSpecies && Math.random() < NPC_CATCH_CHANCE) {
          const w = Math.round(randRange(npcSpecies.minWeight, npcSpecies.maxWeight) * 100) / 100;
          player.caughtCount += 1;
          player.totalValue += computeCatchScore(npcSpecies.value, w, npcSpecies.minWeight, npcSpecies.maxWeight);
        }
        resetToIdle(player);
      }
      continue;
    }

    // REAL PLAYERS: the reel minigame now runs ENTIRELY on the client (client-authoritative to reduce
    // server load — Vicent 2026-07-14). The server DOES NOT simulate the catch zone/fish each tick and DOES NOT send
    // reel_state at 20Hz anymore; the client simulates it locally using the same constants from @bomio/shared then reports the result
    // back via the "reel_result" message (see GameRoom#onMessage + resolveReel). Here we only keep a safety net:
    // if the client doesn't report the result (disconnected, tab closed...) after a significant grace period, automatically
    // reset to idle so they don't get stuck in the reeling state forever.
    if (getFishSpecies(player.activeFishSpeciesId) == null ||
        ctx.now - player.reelStartedAtMs > player.reelDurationMs + REEL_RESULT_GRACE_MS) {
      resetToIdle(player);
    }
  }
}

/** Finalize the result of a reel session reported by the client (message "reel_result"). Server makes the final decision:
 * clamp `timeInZoneMs` to [0, reelDurationMs] (prevent client spoofing), roll probability =
 * timeInZone/duration, then add score based on species + weight. Returns catch_result event to client. */
export function resolveReel(
  player: PlayerSchema,
  timeInZoneMs: number,
  allPlayers: MapSchema<PlayerSchema>,
  notify: (playerId: string, event: ServerEvent) => void,
  broadcast: (event: ServerEvent) => void,
): void {
  if (player.fishState !== "reeling") return;
  const species = getFishSpecies(player.activeFishSpeciesId);
  if (!species) {
    resetToIdle(player);
    return;
  }

  // Anti-cheat: Check if the client sent the message too early (Instant Catch hack)
  const elapsedMs = Date.now() - player.reelStartedAtMs;
  // We allow a 1.5s (1500ms) tolerance buffer for network jitter/client loop desync.
  // If they finish a 15s minigame in less than 13.5s, it's physically impossible and is a hack.
  if (elapsedMs < player.reelDurationMs - 1500) {
    console.warn(`[Anti-Cheat] Player ${player.id} tried to instant-catch! Elapsed: ${elapsedMs}ms, required: ${player.reelDurationMs}ms`);
    resetToIdle(player);
    notify(player.id, { type: "catch_result", playerId: player.id, success: false, reason: "fish_escaped" });
    return;
  }

  const isBoss = species.rarity === "BOSS";

  // Find helpers
  const helpers: PlayerSchema[] = [];
  if (isBoss) {
    for (const [, p] of allPlayers) {
      if (p.assistingPlayerId === player.id) helpers.push(p);
    }
  }

  // Calculate success chance
  const clampedInZone = Math.max(0, Math.min(player.reelDurationMs, Number(timeInZoneMs) || 0));
  const catchChance = clamp(clampedInZone / player.reelDurationMs, 0, 1);
  const success = Math.random() < catchChance;

  if (success) {
    // ---- SUCCESS ----
    const caughtWeight = player.activeFishWeight;
    const catchScore = computeCatchScore(species.value, caughtWeight, species.minWeight, species.maxWeight);

    // Reward main player
    const isFirstCatch = !player.collection.includes(species.id);
    player.caughtCount += 1;
    player.totalValue += catchScore;
    if (isFirstCatch) player.collection.push(species.id);
    resetToIdle(player);
    notify(player.id, {
      type: "catch_result",
      playerId: player.id,
      success: true,
      speciesId: species.id,
      rarity: species.rarity,
      value: catchScore,
      weight: caughtWeight,
      isFirstCatch,
    });

    // Reward helpers (Full points)
    if (isBoss) {
      for (const helper of helpers) {
        const helperFirstCatch = !helper.collection.includes(species.id);
        helper.caughtCount += 1;
        helper.totalValue += catchScore;
        if (helperFirstCatch) helper.collection.push(species.id);
        resetToIdle(helper);
        notify(helper.id, {
          type: "catch_result",
          playerId: helper.id,
          success: true,
          speciesId: species.id,
          rarity: species.rarity,
          value: catchScore,
          weight: caughtWeight,
          isFirstCatch: helperFirstCatch,
        });
      }
    }
  } else {
    // ---- FAIL ----
    if (isBoss) {
      // GROUP WIPE
      const wipedIds = [player.id, ...helpers.map((h) => h.id)];
      // Reset scores and set idle
      player.totalValue = 0;
      player.caughtCount = 0;
      resetToIdle(player);
      for (const helper of helpers) {
        helper.totalValue = 0;
        helper.caughtCount = 0;
        resetToIdle(helper);
      }
      // Broadcast death animation
      broadcast({ type: "boss_dragged_in", playerIds: wipedIds });
      // Send individual fail results
      notify(player.id, { type: "catch_result", playerId: player.id, success: false, reason: "dragged_in" });
      for (const helper of helpers) {
        notify(helper.id, { type: "catch_result", playerId: helper.id, success: false, reason: "dragged_in" });
      }
    } else {
      resetToIdle(player);
      notify(player.id, { type: "catch_result", playerId: player.id, success: false, reason: "fish_escaped" });
    }
  }
}
