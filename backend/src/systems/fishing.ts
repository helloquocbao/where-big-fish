import type { MapSchema } from "@colyseus/schema";
import {
  CAST_MIN_RANGE,
  CAST_MAX_RANGE,
  REEL_DURATION_MS,
  REEL_ZONE_RISE_ACCEL,
  REEL_ZONE_GRAVITY,
  REEL_ZONE_MAX_SPEED,
  REEL_FISH_RETARGET_MIN_MS,
  REEL_FISH_RETARGET_MAX_MS,
  REEL_FISH_TARGET_MARGIN,
  computeReelZoneSize,
  computeReelFishSpeed,
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
  player.reelFishY = 50;
  player.reelZoneY = 50;
  player.reelPulling = false;
  player.reelZoneVelocity = 0;
  player.reelFishTargetY = 50;
  player.reelFishNextRetargetAt = 0;
  player.reelStartedAtMs = 0;
  player.reelTimeInZoneMs = 0;
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
      // Bắt đầu 1 thanh mới: cá + vùng bắt đều xuất phát ở giữa thanh, phiên tính giờ từ đây.
      player.reelProgress = 0;
      player.reelFishY = 50;
      player.reelZoneY = 50;
      player.reelZoneVelocity = 0;
      player.reelFishTargetY = 50;
      player.reelFishNextRetargetAt = ctx.now;
      player.reelStartedAtMs = ctx.now;
      player.reelTimeInZoneMs = 0;
      ctx.broadcast({ type: "fish_bite", playerId: player.id });
    }
  }
}

/** Per-tick: advance the "1 thanh" reel minigame cho mọi người đang reeling (redesign theo yêu cầu
 * trực tiếp của Vicent, kèm 2 ảnh phác thảo tay — xem shared/src/constants.ts đầu mục Reel).
 *
 * Cơ chế: "cá" (reelFishY) tự bơi lang thang thất thường kiểu Stardew Valley, chọn 1 điểm ngẫu
 * nhiên mới trên thanh mỗi REEL_FISH_RETARGET_MIN/MAX_MS rồi bơi thẳng tới đó với tốc độ
 * computeReelFishSpeed(reelDifficulty). "Vùng bắt" (reelZoneY, bề rộng computeReelZoneSize) do
 * người chơi điều khiển — giữ chuột (`reelPulling`) thì tăng tốc đẩy lên (REEL_ZONE_RISE_ACCEL),
 * thả ra thì rơi xuống theo trọng lực (REEL_ZONE_GRAVITY), vận tốc luôn bị chặn trần
 * REEL_ZONE_MAX_SPEED. Mỗi tick, nếu cá đang nằm trong vùng bắt thì cộng dồn vào
 * `reelTimeInZoneMs`. Không còn bất kỳ điều kiện thất bại/thành công TỨC THỜI nào (không còn đứt
 * dây/chùng dây) — người chơi luôn chơi đủ REEL_DURATION_MS, rồi ROLL XÁC SUẤT DUY NHẤT 1 LẦN dựa
 * trên % thời gian cá nằm trong vùng bắt suốt phiên đó để quyết định bắt được cá hay vuột mất. */
export function updateReeling(ctx: FishingContext): void {
  for (const [, player] of ctx.players) {
    if (player.fishState !== "reeling") continue;
    const species = getFishSpecies(player.activeFishSpeciesId);
    if (!species) {
      // Shouldn't happen, but don't leave the player stuck reeling a nonexistent fish forever.
      resetToIdle(player);
      continue;
    }

    const zoneSize = computeReelZoneSize(species.reelDifficulty);
    const halfZone = zoneSize / 2;
    const fishSpeed = computeReelFishSpeed(species.reelDifficulty);

    // 1) Cá bơi lang thang: tới giờ thì chọn điểm đích ngẫu nhiên mới, luôn bơi thẳng tới điểm đích
    // hiện tại với tốc độ cố định theo loài.
    if (ctx.now >= player.reelFishNextRetargetAt) {
      player.reelFishTargetY = randRange(REEL_FISH_TARGET_MARGIN, 100 - REEL_FISH_TARGET_MARGIN);
      player.reelFishNextRetargetAt = ctx.now + randRange(REEL_FISH_RETARGET_MIN_MS, REEL_FISH_RETARGET_MAX_MS);
    }
    const fishDiff = player.reelFishTargetY - player.reelFishY;
    const fishStep = fishSpeed * ctx.deltaSeconds;
    if (Math.abs(fishDiff) <= fishStep) {
      player.reelFishY = player.reelFishTargetY;
    } else {
      player.reelFishY += Math.sign(fishDiff) * fishStep;
    }

    // 2) Vùng bắt: đẩy lên khi giữ chuột, rơi xuống theo trọng lực khi thả ra.
    if (player.reelPulling) {
      player.reelZoneVelocity = Math.min(REEL_ZONE_MAX_SPEED, player.reelZoneVelocity + REEL_ZONE_RISE_ACCEL * ctx.deltaSeconds);
    } else {
      player.reelZoneVelocity = Math.max(-REEL_ZONE_MAX_SPEED, player.reelZoneVelocity - REEL_ZONE_GRAVITY * ctx.deltaSeconds);
    }
    const nextZoneY = clamp(player.reelZoneY + player.reelZoneVelocity * ctx.deltaSeconds, halfZone, 100 - halfZone);
    // Chạm biên trên/dưới thanh thì dừng vận tốc lại (đỡ dội ngược trông giả).
    if (nextZoneY <= halfZone || nextZoneY >= 100 - halfZone) player.reelZoneVelocity = 0;
    player.reelZoneY = nextZoneY;

    // 3) Cộng dồn thời gian cá nằm trong vùng bắt + cập nhật % hiện tại (hiển thị UI + dùng để roll
    // lúc hết giờ).
    const elapsedMs = ctx.now - player.reelStartedAtMs;
    const isInZone = Math.abs(player.reelFishY - player.reelZoneY) <= halfZone;
    if (isInZone) player.reelTimeInZoneMs += ctx.deltaSeconds * 1000;
    player.reelProgress = elapsedMs > 0 ? clamp((player.reelTimeInZoneMs / elapsedMs) * 100, 0, 100) : 0;

    // 4) Hết giờ cố định (REEL_DURATION_MS) — roll xác suất DUY NHẤT 1 LẦN dựa trên % thời gian
    // trong vùng bắt suốt cả phiên, quyết định thành/bại ngay lập tức.
    if (elapsedMs >= REEL_DURATION_MS) {
      const catchChance = clamp(player.reelTimeInZoneMs / REEL_DURATION_MS, 0, 1);
      const success = Math.random() < catchChance;
      if (success) {
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
      } else {
        resetToIdle(player);
        ctx.broadcast({ type: "catch_result", playerId: player.id, success: false, reason: "fish_escaped" });
      }
    }
  }
}
