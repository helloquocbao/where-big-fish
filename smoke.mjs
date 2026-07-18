// Post-deploy smoke test: connects to a running backend and exercises the real cast -> bite ->
// reel -> catch round trip. Kept in sync with the ACTUAL current protocol (shared/src/types.ts +
// backend/src/rooms/GameRoom.ts) — there is no separate "biting"/"hook" step anymore (a fish bite
// auto-hooks straight into "reeling", see backend/src/systems/fishing.ts#updateBiteScheduling) and
// the reel minigame itself is simulated by the CLIENT and reported back via a single "reel_result"
// message (see frontend/src/reelSim.ts + backend/src/systems/fishing.ts#resolveReel).
import { Client } from "colyseus.js";

const SERVER_URL = process.env.SMOKE_SERVER_URL ?? "ws://localhost:2567";

// Longest biteWaitMaxMs across the fish catalog (see shared/src/constants.ts) is 22s — give some margin.
const BITE_WAIT_TIMEOUT_MS = 25000;
// Longest possible non-boss reelDurationMs is REEL_DURATION_MS * 1.6 = 12800ms (see
// shared/src/constants.ts#computeReelDurationMs) - the server's anti-cheat check in resolveReel
// rejects a reel_result reported before (reelDurationMs - 1500ms) has elapsed, so wait past the max.
const REEL_WAIT_MS = 13500;

const client = new Client(SERVER_URL);
console.log(`[smoke] connecting to ${SERVER_URL}`);
const room = await client.joinOrCreate("game", { name: "SmokeTest", skinId: "classic" });
console.log("[smoke] joined, sessionId:", room.sessionId);

const events = [];
room.onMessage("fish_bite", (msg) => events.push({ type: "fish_bite", msg }));
room.onMessage("boss_hooked", (msg) => events.push({ type: "boss_hooked", msg }));
room.onMessage("catch_result", (msg) => events.push({ type: "catch_result", msg }));
room.onMessage("cast_rejected", (msg) => events.push({ type: "cast_rejected", msg }));

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const me = () => room.state.players.get(room.sessionId);

await wait(300); // let the initial state snapshot land before reading room.state
if (!me()) throw new Error("player not found in room.state after join");
console.log("[smoke] spawn position:", me().x, me().y, "fishState:", me().fishState);

// Spawn point is always generated near a lake (see backend/src/systems/utils.ts#randomSpawnPoint),
// so an immediate cast should be accepted rather than rejected as "too_far_from_lake".
room.send("move", { angle: 0, moving: false });
room.send("cast", { angle: 0, power: 0.6 });
await wait(500);
if (me().fishState !== "waiting") {
  throw new Error(`expected fishState "waiting" after cast, got "${me().fishState}" — events so far: ${JSON.stringify(events)}`);
}
console.log(`[smoke] cast accepted, waiting for a bite (up to ${BITE_WAIT_TIMEOUT_MS / 1000}s)...`);

let waited = 0;
while (waited < BITE_WAIT_TIMEOUT_MS && me().fishState === "waiting") {
  await wait(250);
  waited += 250;
}

if (me().fishState === "boss_choice") {
  console.log("[smoke] hooked a BOSS — sending boss_action 'run' to skip the 30s fight for this smoke test");
  room.send("boss_action", { action: "run" });
  await wait(300);
  if (me().fishState !== "idle") throw new Error(`expected fishState "idle" after running from boss, got "${me().fishState}"`);
  console.log("[smoke] OK: boss_action round trip works, player back to idle");
} else if (me().fishState === "reeling") {
  console.log("[smoke] bite! activeFishSpeciesId=", me().activeFishSpeciesId, "weight=", me().activeFishWeight);
  await wait(REEL_WAIT_MS);
  room.send("reel_result", { timeInZoneMs: 4000 });
  await wait(500);
  const result = events.find((e) => e.type === "catch_result");
  if (!result) throw new Error(`no catch_result received after reel_result — events: ${JSON.stringify(events)}`);
  console.log("[smoke] catch_result:", JSON.stringify(result.msg));
  console.log(
    "[smoke] resolved: caughtCount=", me().caughtCount,
    "totalValue=", me().totalValue,
    "collection=", Array.from(me().collection)
  );
  if (me().fishState !== "idle") throw new Error(`expected fishState "idle" after reel resolved, got "${me().fishState}"`);
} else {
  // Bite timing is randomized per-species (biteWaitMinMs/MaxMs) — an occasional miss within the
  // timeout is possible but should be rare given the generous margin above.
  throw new Error(`no bite within ${BITE_WAIT_TIMEOUT_MS}ms (fishState="${me().fishState}") — this can be a false negative on an unlucky run, retry once before treating as a real failure`);
}

console.log("[smoke] PASS");
room.leave();
process.exit(0);
