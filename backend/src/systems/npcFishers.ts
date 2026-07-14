import type { MapSchema } from "@colyseus/schema";
import { NPC_FISHER_TARGET_POPULATION, SKIN_CATALOG, LAKE_DEFINITIONS, findNearestLake } from "@bomio/shared";
import type { LakeDefinition } from "@bomio/shared";
import type { PlayerSchema } from "../schema/State.js";
import { PlayerSchema as PlayerSchemaClass } from "../schema/State.js";
import { spawnPointNearLake, generateId, pickRandom, randRange } from "./utils.js";
import { tryCast } from "./fishing.js";

// Casual handles drawn broadly (game is going global, not one region) — no visible NPC indicator
// in the UI (see render.ts/ui.ts), NPCs should read as regular players enjoying the lake.
const NPC_NAME_POOL = [
  "Alex", "Max", "Leo", "Jay", "Sam", "Ivy", "Ruby", "Finn", "Zoe", "Chris",
  "Diego", "Mateo", "Luna", "Sofia", "Carlos", "Yuki", "Ren", "Haruto", "Mei", "Jin",
  "Wei", "Priya", "Arjun", "Zara", "Rohan", "Omar", "Layla", "Karim", "Kofi", "Amara",
  "Zola", "Nico", "Elin", "Anya", "Lukas", "Kai", "Mika", "Noor", "Théo", "Freya",
];

function generateNpcName(): string {
  const base = pickRandom(NPC_NAME_POOL) ?? "Player";
  if (Math.random() < 0.35) {
    return `${base}${Math.floor(Math.random() * 90 + 10)}`;
  }
  return base;
}

/** NPCs never move after spawn (see updateNpcFishers below) — pinning one to a specific lake at
 * creation, spawned right on its shore, is what makes it show up in that lake's population count
 * (via findNearestLake) and lets its own idle casts always land in that same lake's water. */
function createNpc(lake: LakeDefinition): PlayerSchema {
  const npc = new PlayerSchemaClass();
  npc.id = generateId("npc");
  npc.name = generateNpcName();
  npc.isNpc = true;
  npc.skinId = pickRandom(SKIN_CATALOG)?.id ?? SKIN_CATALOG[0].id;
  // Seed điểm ban đầu để người mới vào (chưa có ai thật) vẫn thấy leaderboard sống động, không toàn
  // số 0 (Vicent 2026-07-14). Rải ngẫu nhiên: đa số đã câu được ít nhiều, ~20% "vừa vào" nên 0 điểm.
  // Điểm ~ số cá × giá trị trung bình mỗi con (value đã x10) cho ra dải rộng tự nhiên. Sau đó chúng
  // vẫn tích thêm dần theo thời gian (xem NPC_CATCH_CHANCE trong fishing.ts#updateReeling).
  if (Math.random() < 0.8) {
    npc.caughtCount = Math.floor(randRange(1, 28));
    npc.totalValue = Math.round(npc.caughtCount * randRange(70, 340));
  }
  const spawn = spawnPointNearLake(lake);
  npc.x = spawn.x;
  npc.y = spawn.y;
  npc.angle = Math.random() * Math.PI * 2;
  npc.desiredAngle = npc.angle;
  // Stagger first cast so a batch of NPCs created together doesn't all cast in lockstep.
  npc.npcNextActionAt = Date.now() + randRange(0, 3000);
  return npc;
}

/**
 * Keeps each lake's population near NPC_FISHER_TARGET_POPULATION (per lake, not room-wide — see
 * shared/src/constants.ts) by filling the gap with NPC fishers when real players are scarce there,
 * and thinning NPCs back out as real players join. "Which lake" a player counts toward is whichever
 * lake is nearest their current position (findNearestLake) — NPCs never move, so this always
 * resolves to the lake they were spawned at. Call periodically, not on every tick.
 */
export function rebalanceNpcFishers(players: MapSchema<PlayerSchema>): void {
  const realCountByLake = new Map<string, number>();
  const npcIdsByLake = new Map<string, string[]>();
  for (const lake of LAKE_DEFINITIONS) {
    realCountByLake.set(lake.id, 0);
    npcIdsByLake.set(lake.id, []);
  }

  for (const [id, p] of players) {
    const nearest = findNearestLake(p.x, p.y);
    if (!nearest) continue;
    const lakeId = nearest.lake.id;
    if (p.isNpc) npcIdsByLake.get(lakeId)?.push(id);
    else realCountByLake.set(lakeId, (realCountByLake.get(lakeId) ?? 0) + 1);
  }

  for (const lake of LAKE_DEFINITIONS) {
    const realCount = realCountByLake.get(lake.id) ?? 0;
    const npcIds = npcIdsByLake.get(lake.id) ?? [];
    const targetNpcCount = Math.max(0, NPC_FISHER_TARGET_POPULATION - realCount);
    const deficit = targetNpcCount - npcIds.length;

    if (deficit > 0) {
      for (let i = 0; i < deficit; i++) {
        const npc = createNpc(lake);
        players.set(npc.id, npc);
      }
    } else if (deficit < 0) {
      for (let i = 0; i < -deficit; i++) {
        players.delete(npcIds[i]);
      }
    }
  }
}

/**
 * Cheap NPC behavior: cast toward a random direction/power when idle (bites auto-hook straight
 * into reeling now — see fishing.ts#updateBiteScheduling, no reaction step needed anymore). NPCs
 * KHÔNG chơi minigame kéo cá thật — updateReeling chỉ cho NPC "giả vờ" kéo đủ REEL_DURATION_MS rồi
 * quay về idle (không mutate field synced nào, tiết kiệm băng thông dưới tải cao — xem lý do đầy đủ
 * trong fishing.ts#updateReeling), nên ở đây chỉ cần lo việc cast lúc idle. Not meant to be
 * impressive — just enough activity to keep an empty lake feeling alive, purely cosmetic population
 * (NPCs never compete with real players for anything).
 */
export function updateNpcFishers(players: MapSchema<PlayerSchema>, now: number): void {
  for (const [, npc] of players) {
    if (!npc.isNpc) continue;

    if (npc.fishState === "idle" && now >= npc.npcNextActionAt) {
      const angle = Math.random() * Math.PI * 2;
      const power = 0.3 + Math.random() * 0.7;
      tryCast(npc, angle, power, now);
      npc.npcNextActionAt = now + randRange(1500, 4000);
    }
  }
}
