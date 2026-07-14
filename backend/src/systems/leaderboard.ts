import { ArraySchema, MapSchema } from "@colyseus/schema";
import { LEADERBOARD_SIZE } from "@bomio/shared";
import { LeaderboardEntrySchema, PlayerSchema } from "../schema/State.js";

/** Recompute the room's top-N leaderboard (total catch value descending). Ranks BOTH real players
 * AND NPCs (Vicent 2026-07-14) — NPCs now accumulate score gradually (see NPC_CATCH_CHANCE in
 * fishing.ts#updateReeling) so they compete on the leaderboard together to make the lake feel alive; entry.isNpc can be used
 * by the FE to differentiate if desired. Call periodically, not every tick. */
export function recomputeLeaderboard(
  players: MapSchema<PlayerSchema>,
  leaderboard: ArraySchema<LeaderboardEntrySchema>,
): void {
  const sorted = Array.from(players.values())
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, LEADERBOARD_SIZE);

  // Skip if the top-N HAS NOT changed compared to the last time — avoids clear()+rebuild of ArraySchema every second (that
  // operation forces Colyseus to emit delete-all-then-insert operations => re-syncs all 10 entries for EVERY client even if the content
  // is identical). The leaderboard stays static most of the time between fish catches, so this branch cuts out a lot of garbage sync under high load.
  // Shallow comparison based on the order of displayed fields.
  if (sorted.length === leaderboard.length) {
    let unchanged = true;
    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i];
      const b = leaderboard[i];
      if (!b || a.id !== b.playerId || a.totalValue !== b.totalValue || a.caughtCount !== b.caughtCount || a.name !== b.name) {
        unchanged = false;
        break;
      }
    }
    if (unchanged) return;
  }

  leaderboard.clear();
  for (const p of sorted) {
    const entry = new LeaderboardEntrySchema();
    entry.playerId = p.id;
    entry.name = p.name;
    entry.totalValue = p.totalValue;
    entry.caughtCount = p.caughtCount;
    entry.isNpc = p.isNpc;
    leaderboard.push(entry);
  }
}
