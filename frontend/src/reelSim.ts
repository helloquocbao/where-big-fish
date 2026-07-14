/**
 * Mô phỏng minigame kéo cá HOÀN TOÀN phía client (client-authoritative để giảm tải server — yêu cầu
 * Vicent 2026-07-14). Trước đây server chạy vật lý này mỗi tick rồi bắn `reel_state` 20Hz cho từng
 * người đang câu; giờ client tự chạy ở 60fps (mượt tuyệt đối, phản hồi tức thì với chuột), hết giờ
 * chỉ báo `timeInZoneMs` về cho server clamp + roll xác suất (xem backend fishing.ts#resolveReel).
 *
 * Dùng ĐÚNG các hằng số / công thức trong @bomio/shared như server cũ nên cảm giác chơi không đổi:
 * vùng bắt đẩy lên khi giữ chuột, rơi theo trọng lực khi thả; cá bơi lang thang thất thường; tiến độ
 * = % thời gian cá nằm trong vùng bắt. Cá bơi giờ là RNG cục bộ (thuần hiển thị, không ai khác cần).
 */
import {
  REEL_ZONE_RISE_ACCEL,
  REEL_ZONE_GRAVITY,
  REEL_ZONE_MAX_SPEED,
  REEL_FISH_RETARGET_MIN_MS,
  REEL_FISH_RETARGET_MAX_MS,
  REEL_FISH_TARGET_MARGIN,
  REEL_DURATION_MS,
  computeReelZoneSize,
  computeReelFishSpeed,
  computeActualDifficulty,
  computeReelDurationMs,
  getFishSpecies,
} from "@bomio/shared";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

export class ReelSim {
  active = false;
  done = false;
  speciesId = "";
  private zoneSize = 40;
  private fishSpeed = 0;
  durationMs = REEL_DURATION_MS;
  fishY = 50;
  zoneY = 50;
  progress = 0;
  timeInZoneMs = 0;
  private zoneVel = 0;
  private fishTargetY = 50;
  private fishRetargetInMs = 0;
  private elapsedMs = 0;

  /** Bắt đầu 1 phiên kéo mới — suy hết tham số từ loài + cân nặng (đều lấy được từ state đã sync),
   * y hệt server nên client/server nhất quán về thời lượng & độ khó. */
  start(speciesId: string, weight: number): void {
    const sp = getFishSpecies(speciesId);
    if (!sp) {
      this.active = false;
      return;
    }
    const diff = computeActualDifficulty(sp.reelDifficulty, weight, sp.minWeight, sp.maxWeight);
    this.zoneSize = computeReelZoneSize(diff);
    this.fishSpeed = computeReelFishSpeed(diff);
    this.durationMs = computeReelDurationMs(weight, sp.minWeight, sp.maxWeight);
    this.speciesId = speciesId;
    this.fishY = 50;
    this.zoneY = 50;
    this.zoneVel = 0;
    this.fishTargetY = 50;
    this.fishRetargetInMs = 0; // retarget ngay frame đầu (giống server set reelFishNextRetargetAt = now)
    this.elapsedMs = 0;
    this.timeInZoneMs = 0;
    this.progress = 0;
    this.done = false;
    this.active = true;
  }

  /** Tiến 1 bước mô phỏng theo delta thời gian frame (ms) + trạng thái giữ chuột kéo. */
  update(dtMs: number, pulling: boolean): void {
    if (!this.active || this.done) return;
    const dt = dtMs / 1000;
    const half = this.zoneSize / 2;

    // Cá bơi lang thang: hết hạn thì chọn đích mới, luôn bơi thẳng tới đích với tốc độ cố định.
    this.fishRetargetInMs -= dtMs;
    if (this.fishRetargetInMs <= 0) {
      this.fishTargetY = rand(REEL_FISH_TARGET_MARGIN, 100 - REEL_FISH_TARGET_MARGIN);
      this.fishRetargetInMs = rand(REEL_FISH_RETARGET_MIN_MS, REEL_FISH_RETARGET_MAX_MS);
    }
    const fishDiff = this.fishTargetY - this.fishY;
    const fishStep = this.fishSpeed * dt;
    if (Math.abs(fishDiff) <= fishStep) this.fishY = this.fishTargetY;
    else this.fishY += Math.sign(fishDiff) * fishStep;

    // Vùng bắt: giữ chuột đẩy lên, thả rơi xuống; chạm biên thì dừng vận tốc.
    if (pulling) this.zoneVel = Math.min(REEL_ZONE_MAX_SPEED, this.zoneVel + REEL_ZONE_RISE_ACCEL * dt);
    else this.zoneVel = Math.max(-REEL_ZONE_MAX_SPEED, this.zoneVel - REEL_ZONE_GRAVITY * dt);
    const nextZoneY = clamp(this.zoneY + this.zoneVel * dt, half, 100 - half);
    if (nextZoneY <= half || nextZoneY >= 100 - half) this.zoneVel = 0;
    this.zoneY = nextZoneY;

    // Cộng dồn thời gian cá trong vùng bắt + cập nhật % (dùng hiển thị và gửi về server lúc hết giờ).
    this.elapsedMs += dtMs;
    if (Math.abs(this.fishY - this.zoneY) <= half) this.timeInZoneMs += dtMs;
    this.progress = this.elapsedMs > 0 ? clamp((this.timeInZoneMs / this.elapsedMs) * 100, 0, 100) : 0;
    if (this.elapsedMs >= this.durationMs) this.done = true;
  }

  stop(): void {
    this.active = false;
    this.done = false;
  }
}
