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
} from "@bomio/shared";
import type { ServerEvent } from "@bomio/shared";
import type { PlayerSchema } from "../schema/State.js";
import { clamp, randRange } from "./utils.js";

/** Thời gian gia hạn (ms) sau reelDurationMs mà server chờ client báo kết quả kéo cá; quá hạn này
 * (client mất mạng/đóng tab) thì tự đưa về idle để không kẹt trạng thái reeling. */
const REEL_RESULT_GRACE_MS = 5000;

export interface FishingContext {
  players: MapSchema<PlayerSchema>;
  now: number;
  deltaSeconds: number;
  /** Gửi 1 event TỚI ĐÚNG người chơi liên quan (không broadcast cả room). fish_bite/catch_result
   * chỉ có ý nghĩa với chính người chơi đó (client bỏ qua event của người khác — xem
   * frontend/src/main.ts), nên fanout ra cả room là lãng phí băng thông theo O(số client). NPC
   * không có client → notify là no-op (xem GameRoom.notifyPlayer). */
  notify: (playerId: string, event: ServerEvent) => void;
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

  // Fallback: nếu cả tia player→target không hề chạm nước (người chơi ngắm ra xa/lệch khỏi hồ) thì
  // ĐẢM BẢO phao vẫn rơi TRONG nước (bug cũ: bám đỉnh polygon nằm ngay mép → phao "ra khỏi hồ",
  // Vicent 2026-07-14). Cách làm: quét từ target về CENTROID (trung bình các đỉnh) — điểm này nằm
  // trong hồ với cả hồ blob lẫn con sông uốn — lấy điểm-trong-nước đầu tiên gần phía đã ngắm nhất.
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
      // Cực hiếm (centroid rơi ngoài hồ lõm bất thường) — dùng thẳng centroid.
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
      const species = getFishSpecies(player.activeFishSpeciesId);
      if (species) {
        player.activeFishWeight = Math.round(randRange(species.minWeight, species.maxWeight) * 100) / 100;
        // Cá càng nặng, phiên kéo càng dài (yêu cầu Vicent 2026-07-14).
        player.reelDurationMs = computeReelDurationMs(player.activeFishWeight, species.minWeight, species.maxWeight);
      } else {
        player.activeFishWeight = 0;
        player.reelDurationMs = REEL_DURATION_MS;
      }
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
      ctx.notify(player.id, { type: "fish_bite", playerId: player.id });
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

    // NPC KHÔNG chạy minigame kéo cá thật: không client nào render reel-internals của NPC
    // (reelFishY/reelZoneY/reelProgress chỉ dùng cho modal của CHÍNH người chơi local, xem
    // frontend/src/main.ts), và NPC đã bị loại khỏi leaderboard (thuần cosmetic). Nếu để NPC chạy
    // sim thì mỗi tick lại mutate 3 field synced × ~27 NPC/room → Colyseus broadcast delta cho mọi
    // client mỗi 50ms, lãng phí băng thông cực lớn dưới tải cao. Thay vào đó NPC chỉ "giả vờ" kéo
    // đủ REEL_DURATION_MS (nhìn từ ngoài vẫn thấy phao giật + trạng thái reeling) rồi quay về idle
    // để cast tiếp — không đụng field synced nào trong suốt phiên, không phát event.
    if (player.isNpc) {
      if (ctx.now - player.reelStartedAtMs >= REEL_DURATION_MS) {
        // NPC "câu" xong 1 phiên giả: roll xác suất đơn giản để thỉnh thoảng bắt được cá và tích
        // điểm dần → lên leaderboard chung với người thật cho hồ sống động (Vicent 2026-07-14).
        // KHÔNG mô phỏng minigame thật (xem lý do băng thông ở comment dưới), chỉ cộng điểm 1 lần.
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

    // NGƯỜI CHƠI THẬT: minigame kéo cá giờ chạy HOÀN TOÀN trên client (client-authoritative để giảm
    // tải server — Vicent 2026-07-14). Server KHÔNG mô phỏng vùng bắt/cá mỗi tick và KHÔNG bắn
    // reel_state 20Hz nữa; client tự mô phỏng bằng cùng hằng số trong @bomio/shared rồi báo kết quả
    // về qua message "reel_result" (xem GameRoom#onMessage + resolveReel). Ở đây chỉ còn 1 lưới an
    // toàn: nếu client không báo kết quả (mất mạng, đóng tab...) sau khi đã quá hạn kha khá thì tự
    // đưa về idle để không kẹt trạng thái reeling mãi.
    if (getFishSpecies(player.activeFishSpeciesId) == null ||
        ctx.now - player.reelStartedAtMs > player.reelDurationMs + REEL_RESULT_GRACE_MS) {
      resetToIdle(player);
    }
  }
}

/** Chốt kết quả 1 phiên kéo cá do client báo về (message "reel_result"). Server là bên quyết định
 * cuối: clamp `timeInZoneMs` trong [0, reelDurationMs] (chặn client khai khống), roll xác suất =
 * timeInZone/duration, rồi cộng điểm theo loài + cân nặng. Trả về event catch_result cho client. */
export function resolveReel(
  player: PlayerSchema,
  timeInZoneMs: number,
  notify: (playerId: string, event: ServerEvent) => void,
): void {
  if (player.fishState !== "reeling") return;
  const species = getFishSpecies(player.activeFishSpeciesId);
  if (!species) {
    resetToIdle(player);
    return;
  }
  const clampedInZone = Math.max(0, Math.min(player.reelDurationMs, Number(timeInZoneMs) || 0));
  const catchChance = clamp(clampedInZone / player.reelDurationMs, 0, 1);
  const success = Math.random() < catchChance;
  if (success) {
    const isFirstCatch = !player.collection.includes(species.id);
    // Chốt cân nặng TRƯỚC resetToIdle (nó set activeFishWeight = 0) — nếu không weight về 0 (bug cũ).
    const caughtWeight = player.activeFishWeight;
    const catchScore = computeCatchScore(species.value, caughtWeight, species.minWeight, species.maxWeight);
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
  } else {
    resetToIdle(player);
    notify(player.id, { type: "catch_result", playerId: player.id, success: false, reason: "fish_escaped" });
  }
}
