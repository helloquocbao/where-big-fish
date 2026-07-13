import { Client } from "colyseus.js";

const client = new Client("ws://localhost:2567");
const room = await client.joinOrCreate("game", { name: "SmokeTest", skinId: "classic" });
console.log("joined, sessionId:", room.sessionId);

room.onStateChange.once((state) => {
  console.log("initial players count:", state.players.size);
});

await new Promise((r) => setTimeout(r, 300));

// Cast toward some direction with mid power.
room.send("move", { angle: 0 });
room.send("cast", { angle: 0.5, power: 0.6 });

await new Promise((r) => setTimeout(r, 1500));
const me = room.state.players.get(room.sessionId);
console.log("after cast: fishState=", me.fishState, "bobber=", me.bobberX, me.bobberY);

room.onMessage("fish_bite", (msg) => console.log("EVENT fish_bite", msg));
room.onMessage("catch_result", (msg) => console.log("EVENT catch_result", JSON.stringify(msg)));

// Poll until biting, then hook + hold reel.
let hooked = false;
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 250));
  const p = room.state.players.get(room.sessionId);
  if (p.fishState === "biting" && !hooked) {
    room.send("hook", {});
    hooked = true;
    console.log("sent hook at tick", i);
  }
  if (p.fishState === "reeling") {
    room.send("reel", { pulling: p.playerBarPos < p.fishBarPos });
  }
  if (p.fishState === "idle" && hooked) {
    console.log("resolved: caughtCount=", p.caughtCount, "totalValue=", p.totalValue, "collection=", Array.from(p.collection));
    break;
  }
}

room.leave();
process.exit(0);
