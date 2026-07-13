/**
 * Helpers to normalize whatever shape `room.state` happens to be into the plain
 * `RoomSnapshot` shape from @bomio/shared.
 *
 * colyseus.js may expose players/leaderboard as MapSchema/ArraySchema instances (iterable but not
 * plain arrays), or plain arrays/objects before that schema exists. We defensively coerce anything
 * iterable/array-like/map-like into a plain array so rendering code never has to care which shape
 * it got.
 */

import type { LeaderboardEntry, PlayerState, RoomSnapshot } from "@bomio/shared";

function toArray<T>(value: unknown): T[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value as T[];
  // colyseus.js MapSchema (and native Map) are Map-like and keyed by id: iterating them directly
  // (or via Array.from) yields [key, value] entries, not bare values, unlike ArraySchema/native
  // arrays. Detect Map-like via `.size` (arrays/ArraySchema use `.length` instead) and read
  // `.values()` explicitly.
  if (typeof (value as Map<unknown, unknown>).size === "number" &&
      typeof (value as Map<unknown, T>).values === "function") {
    return Array.from((value as Map<unknown, T>).values());
  }
  // colyseus.js ArraySchema and other plain iterables.
  if (typeof (value as Iterable<unknown>)[Symbol.iterator] === "function") {
    return Array.from(value as Iterable<T>);
  }
  // Plain object keyed by id (e.g. { [id]: PlayerState }).
  if (typeof value === "object") {
    return Object.values(value as Record<string, T>);
  }
  return [];
}

/** `collection` on PlayerSchema is itself an ArraySchema<string> — normalize it the same way as
 * the top-level collections so consumers always get a plain string[]. */
function normalizePlayer(raw: unknown): PlayerState {
  const p = raw as PlayerState;
  return { ...p, collection: toArray<string>(p.collection) };
}

/** Reads a snapshot out of an arbitrary `room.state`-shaped value, tolerating missing fields. */
export function readSnapshot(state: unknown): RoomSnapshot {
  const s = (state ?? {}) as Record<string, unknown>;
  return {
    players: toArray<PlayerState>(s.players).map(normalizePlayer),
    leaderboard: toArray<LeaderboardEntry>(s.leaderboard),
  };
}
