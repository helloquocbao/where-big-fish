import { ArraySchema, MapSchema } from "@colyseus/schema";
import { LEADERBOARD_SIZE } from "@bomio/shared";
import { LeaderboardEntrySchema, PlayerSchema } from "../schema/State.js";

/** Recompute the room's top-N leaderboard (total catch value descending). Call periodically, not
 * every tick. */
export function recomputeLeaderboard(
  players: MapSchema<PlayerSchema>,
  leaderboard: ArraySchema<LeaderboardEntrySchema>,
): void {
  const sorted = Array.from(players.values())
    .slice()
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, LEADERBOARD_SIZE);

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
