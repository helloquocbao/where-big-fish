/**
 * Simulates the reeling minigame ENTIRELY on the client side (client-authoritative to reduce server load — request
 * by Vicent 2026-07-14). Previously, the server ran this physics simulation every tick and broadcast `reel_state` at 20Hz
 * to everyone fishing; now the client runs it locally at 60fps (perfectly smooth, immediate response to mouse input), and when
 * time is up, it simply reports `timeInZoneMs` back to the server to clamp + roll probability (see backend fishing.ts#resolveReel).
 *
 * Uses EXACTLY the same constants and formulas in @bomio/shared as the old server code so the gameplay feel remains unchanged:
 * the catch zone rises when holding the mouse, falls by gravity when released; the fish swims around erratically; progress
 * is the percentage of time the fish stays inside the catch zone. The fish movement is now a local RNG (purely visual, no one else needs it).
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

  /** Starts a new reeling session — derives all parameters from the species + weight (both retrieved from synced state),
   * exactly like the server, maintaining consistency in duration and difficulty between client and server. */
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
    this.fishRetargetInMs = 0; // retarget on the very first frame (like server setting reelFishNextRetargetAt = now)
    this.elapsedMs = 0;
    this.timeInZoneMs = 0;
    this.progress = 0;
    this.done = false;
    this.active = true;
  }

  /** Advances the simulation by one step based on frame delta time (ms) + mouse pulling state. */
  update(dtMs: number, pulling: boolean): void {
    if (!this.active || this.done) return;
    const dt = dtMs / 1000;
    const half = this.zoneSize / 2;

    // Fish swimming around: selects a new target when expired, always swimming straight towards the target at a constant speed.
    this.fishRetargetInMs -= dtMs;
    if (this.fishRetargetInMs <= 0) {
      this.fishTargetY = rand(REEL_FISH_TARGET_MARGIN, 100 - REEL_FISH_TARGET_MARGIN);
      this.fishRetargetInMs = rand(REEL_FISH_RETARGET_MIN_MS, REEL_FISH_RETARGET_MAX_MS);
    }
    const fishDiff = this.fishTargetY - this.fishY;
    const fishStep = this.fishSpeed * dt;
    if (Math.abs(fishDiff) <= fishStep) this.fishY = this.fishTargetY;
    else this.fishY += Math.sign(fishDiff) * fishStep;

    // Catch zone: holding mouse pushes it up, releasing drops it down; sets velocity to 0 when hitting boundaries.
    if (pulling) this.zoneVel = Math.min(REEL_ZONE_MAX_SPEED, this.zoneVel + REEL_ZONE_RISE_ACCEL * dt);
    else this.zoneVel = Math.max(-REEL_ZONE_MAX_SPEED, this.zoneVel - REEL_ZONE_GRAVITY * dt);
    const nextZoneY = clamp(this.zoneY + this.zoneVel * dt, half, 100 - half);
    if (nextZoneY <= half || nextZoneY >= 100 - half) this.zoneVel = 0;
    this.zoneY = nextZoneY;

    // Accumulates time the fish stays inside the catch zone + updates percentage (used for display and sent to server when time is up).
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
