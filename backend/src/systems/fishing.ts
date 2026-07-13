import type { MapSchema } from "@colyseus/schema";
import {
  CAST_MIN_RANGE,
  CAST_MAX_RANGE,
  REEL_PROGRESS_START,
  REEL_PROGRESS_FILL_RATE,
  REEL_TENSION_MAX,
  REEL_TENSION_FALL_RATE,
  computeTensionRiseRate,
  computeReelResistance,
  getFishSpecies,
  findNearestLake,
  isInsideLake,
  pickRandomFishSpeciesForLake,
  LAKE_CAST_RANGE,
} from "@bomio/shared";
import type { ServerEvent } from "@bomio/shared";
import type { PlayerSchema } from "../schema/State.js";
import { clamp, randRange } from "./utils.js";

export interface FishingContext {
  players: MapSchema<PlayerSchema>;
  now: number;
  deltaSeconds: number;
  broadcast: (event: ServerEvent) => void;
}

export type CastResult = "ok" | "not_idle" | "too_far";

/** Thả cần — chỉ có hiệu lực khi đang rảnh tay (fishState === "idle") VÀ đang đứng trong phạm vi
 * LAKE_CAST_RANGE của 1 hồ (xem shared/src/lakes.ts) — đứng giữa đồng trống xa hồ thì bị từ chối
 * hoàn toàn (không đổi state gì cả). Trả về CastResult để caller (GameRoom.ts) biết đường mà phản
 * hồi riêng cho người chơi khi bị từ chối vì quá xa hồ (xem ServerEvent "cast_rejected") — không
 * cần phản hồi gì khi "not_idle" (chỉ là 2 message chồng lấn vô hại, xem tryCast trong input.ts).
 * Cá được roll theo đúng tập cá riêng của hồ đó (pickRandomFishSpeciesForLake, khác hồ khác cá) và
 * lên lịch thời điểm cắn câu — người chơi/quan sát viên chưa biết loài gì cho tới khi móc câu thành
 * công (activeFishSpeciesId chỉ được set lúc đó), giữ đúng cảm giác hồi hộp "không biết mình vừa
 * câu được con gì". */
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

  // Fallback: if we cast completely away from water, find the closest lake polygon vertex to the target
  if (!found) {
    let bestVertex = lake.polygon[0];
    let minDist = Infinity;
    for (const vertex of lake.polygon) {
      const vx = lake.centerX + vertex.x;
      const vy = lake.centerY + vertex.y;
      const d = Math.hypot(vx - rawBobberX, vy - rawBobberY);
      if (d < minDist) {
        minDist = d;
        bestVertex = vertex;
      }
    }
    bobberX = lake.centerX + bestVertex.x;
    bobberY = lake.centerY + bestVertex.y;
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

function resetToIdle(player: PlayerSchema): void {
  player.fishState = "idle";
  player.activeFishSpeciesId = "";
  player.pendingSpeciesId = "";
  player.reelProgress = 0;
  player.reelTension = 0;
  player.reelPulling = false;
}

/** Per-tick: khi tới giờ cá cắn (`biteAt`), TỰ ĐỘNG móc câu và vào thẳng minigame kéo cá — không
 * còn state "biting" + khung bấm-kịp-0.9s như trước (quyết định của Vicent: cá cắn là vào solo với
 * cá luôn, xem docs/progress.md). Call once per server tick over every player, both real and NPC
 * (NPCs get pushed through the exact same state machine — see npcFishers.ts). */
export function updateBiteScheduling(ctx: FishingContext): void {
  for (const [, player] of ctx.players) {
    if (player.fishState === "waiting" && ctx.now >= player.biteAt) {
      player.fishState = "reeling";
      player.activeFishSpeciesId = player.pendingSpeciesId;
      player.pendingSpeciesId = "";
      player.reelProgress = REEL_PROGRESS_START;
      player.reelTension = 0;
      ctx.broadcast({ type: "fish_bite", playerId: player.id });
    }
  }
}

/** Per-tick: advance the reel minigame for anyone currently reeling — giữ chuột kéo
 * (`reelPulling`) thì reelProgress tăng NHƯNG reelTension (độ căng dây) cũng tăng theo, càng khó
 * (`reelDifficulty` cao) căng càng nhanh; thả chuột ra thì reelTension giảm nhưng cá giằng lại khiến
 * reelProgress tụt (mạnh hơn ở loài khó) — buộc người chơi phải xen kẽ kéo/thả thay vì chỉ giữ
 * chuột suốt. reelTension chạm `REEL_TENSION_MAX` = đứt dây (mất cá) bất kể reelProgress đang bao
 * nhiêu; reelProgress chạm 100 = bắt được cá, chạm 0 = cá thoát (như cũ). */
export function updateReeling(ctx: FishingContext): void {
  for (const [, player] of ctx.players) {
    if (player.fishState !== "reeling") continue;
    const species = getFishSpecies(player.activeFishSpeciesId);
    if (!species) {
      // Shouldn't happen, but don't leave the player stuck reeling a nonexistent fish forever.
      resetToIdle(player);
      continue;
    }

    if (player.reelPulling) {
      player.reelProgress = clamp(player.reelProgress + REEL_PROGRESS_FILL_RATE * ctx.deltaSeconds, 0, 100);
      player.reelTension = clamp(
        player.reelTension + computeTensionRiseRate(species.reelDifficulty) * ctx.deltaSeconds,
        0,
        REEL_TENSION_MAX,
      );
    } else {
      player.reelProgress = clamp(
        player.reelProgress - computeReelResistance(species.reelDifficulty) * ctx.deltaSeconds,
        0,
        100,
      );
      player.reelTension = clamp(player.reelTension - REEL_TENSION_FALL_RATE * ctx.deltaSeconds, 0, REEL_TENSION_MAX);
    }

    if (player.reelTension >= REEL_TENSION_MAX) {
      resetToIdle(player);
      ctx.broadcast({ type: "catch_result", playerId: player.id, success: false, reason: "line_snapped" });
      continue;
    }

    if (player.reelProgress >= 100) {
      const isFirstCatch = !player.collection.includes(species.id);
      player.caughtCount += 1;
      player.totalValue += species.value;
      if (isFirstCatch) player.collection.push(species.id);
      resetToIdle(player);
      ctx.broadcast({
        type: "catch_result",
        playerId: player.id,
        success: true,
        speciesId: species.id,
        rarity: species.rarity,
        value: species.value,
        isFirstCatch,
      });
    } else if (player.reelProgress <= 0) {
      resetToIdle(player);
      ctx.broadcast({ type: "catch_result", playerId: player.id, success: false, reason: "fish_escaped" });
    }
  }
}
