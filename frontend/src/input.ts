/**
 * Input handling:
 * - WASD / arrow keys: walking (only effective when idle/free — see
 *   backend/src/systems/movement.ts, stands still when fishing). Stands still when no key is held,
 *   completely different from the old .io scheme (always moving towards cursor).
 * - Mouse direction: SEPARATE from walking, only used to aim the cast (twin-stick style).
 * - Left click, MEANING DEPENDS ON CURRENT FISHING STATE (read via `getFishState`, server still ignores
 *   invalid actions for that state — this is just UX, not the source of truth):
 *   - idle: hold then release = cast bobber in cursor direction, power based on hold time (see
 *     CAST_MAX_CHARGE_MS in @bomio/shared).
 *   - reeling: HOLD mouse down = push catch zone up to chase the fish, RELEASE = catch zone falls down
 *     due to gravity (the "1-bar" minigame — see backend/src/systems/fishing.ts#updateReeling).
 *   (No more hooking phase — fish biting automatically enters reeling, see docs/progress.md, so Space is no
 *   longer used for any fishing action.)
 *
 * This module only tracks intent and exposes it via getters + a `tick` hook — it does not decide
 * whether an action is actually allowed (that's the server's job).
 */

import type { ClientMessage, FishingState } from "@bomio/shared";
import { CAST_MAX_CHARGE_MS, MOVE_SEND_INTERVAL_MS } from "./config.ts";

// Below this distance (px) from the local player's own screen position, `atan2` is numerically
// unstable — see the original game's comment on this same constant. Below this radius, keep facing
// whatever angle was last stable instead of recomputing a meaningless-and-unstable one.
const POINTER_DEADZONE_PX = 8;

const MOVE_KEY_VECTORS: Record<string, { dx: number; dy: number }> = {
  KeyW: { dx: 0, dy: -1 },
  KeyS: { dx: 0, dy: 1 },
  KeyA: { dx: -1, dy: 0 },
  KeyD: { dx: 1, dy: 0 },
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
};

export class InputController {
  private mouseX = 0;
  private mouseY = 0;
  private stableAngle = 0;
  private lastSentAngle: number | null = null;
  private lastSentMoving: boolean | null = null;
  private lastMoveSendAt = 0;

  private lastMovementAngle = 0;

  private chargeStartAt: number | null = null;
  private reelHeld = false;

  private heldMoveKeys = new Map<string, number>();
  private static readonly KEY_STALE_MS = 2000;

  private touchStartX = 0;
  private touchStartY = 0;
  private touchStartAt = 0;

  // Virtual Joystick properties
  private joystickAngle = 0;
  private joystickMoving = false;
  private joystickTouchId: number | null = null;
  private joystickCenter = { x: 0, y: 0 };
  private maxJoystickDist = 45; // limit handle travel (px)

  private canvas: HTMLCanvasElement;
  private send: (message: ClientMessage) => void;
  private getOrigin: () => { x: number; y: number };
  private getFishState: () => FishingState;
  private getPlayerPos: () => { x: number; y: number };

  private targetWorldX = 0;
  private targetWorldY = 0;
  private hasTarget = false;
  private targetAngle = 0;
  private targetMoving = false;

  constructor(
    canvas: HTMLCanvasElement,
    send: (message: ClientMessage) => void,
    getOrigin: () => { x: number; y: number },
    getFishState: () => FishingState,
    getPlayerPos: () => { x: number; y: number },
  ) {
    this.canvas = canvas;
    this.send = send;
    this.getOrigin = getOrigin;
    this.getFishState = getFishState;
    this.getPlayerPos = getPlayerPos;
    this.mouseX = canvas.width / 2;
    this.mouseY = canvas.height / 2;

    canvas.addEventListener("mousemove", this.onMouseMove);
    canvas.addEventListener("mousedown", this.onMouseDown);
    canvas.addEventListener("mouseup", this.onMouseUp);
    canvas.addEventListener("mouseleave", this.onMouseLeave);
    canvas.addEventListener("contextmenu", this.onContextMenu);

    canvas.addEventListener("touchstart", this.onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", this.onTouchMove, { passive: false });
    canvas.addEventListener("touchend", this.onTouchEnd, { passive: false });

    // Bind virtual joystick DOM events if they exist
    setTimeout(() => {
      const joystickEl = document.getElementById("mobile-joystick");
      if (joystickEl) {
        joystickEl.addEventListener("touchstart", this.onJoystickStart, { passive: false });
        joystickEl.addEventListener("touchmove", this.onJoystickMove, { passive: false });
        joystickEl.addEventListener("touchend", this.onJoystickEnd, { passive: false });
      }

      const actionBtnEl = document.getElementById("mobile-action-btn");
      if (actionBtnEl) {
        actionBtnEl.addEventListener("touchstart", this.onActionBtnStart, { passive: false });
        actionBtnEl.addEventListener("touchend", this.onActionBtnEnd, { passive: false });
      }
    }, 100);

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onWindowBlur);
  }

  bindAdditionalTarget(el: HTMLElement) {
    el.addEventListener("mousedown", this.onMouseDown);
    el.addEventListener("mouseup", this.onMouseUp);
    el.addEventListener("mouseleave", this.onMouseLeave);
    el.addEventListener("touchstart", this.onTouchStart, { passive: false });
    el.addEventListener("touchend", this.onTouchEnd, { passive: false });
  }

  get isReelHeld(): boolean {
    return this.reelHeld;
  }

  dispose() {
    this.canvas.removeEventListener("mousemove", this.onMouseMove);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    this.canvas.removeEventListener("mouseup", this.onMouseUp);
    this.canvas.removeEventListener("mouseleave", this.onMouseLeave);
    this.canvas.removeEventListener("contextmenu", this.onContextMenu);

    this.canvas.removeEventListener("touchstart", this.onTouchStart);
    this.canvas.removeEventListener("touchmove", this.onTouchMove);
    this.canvas.removeEventListener("touchend", this.onTouchEnd);

    const joystickEl = document.getElementById("mobile-joystick");
    if (joystickEl) {
      joystickEl.removeEventListener("touchstart", this.onJoystickStart);
      joystickEl.removeEventListener("touchmove", this.onJoystickMove);
      joystickEl.removeEventListener("touchend", this.onJoystickEnd);
    }

    const actionBtnEl = document.getElementById("mobile-action-btn");
    if (actionBtnEl) {
      actionBtnEl.removeEventListener("touchstart", this.onActionBtnStart);
      actionBtnEl.removeEventListener("touchend", this.onActionBtnEnd);
    }

    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onWindowBlur);
  }

  private onJoystickStart = (e: TouchEvent) => {
    e.preventDefault();
    const joystickEl = document.getElementById("mobile-joystick");
    if (!joystickEl) return;
    const rect = joystickEl.getBoundingClientRect();
    this.joystickCenter = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
    const touch = e.changedTouches[0];
    this.joystickTouchId = touch.identifier;
    this.handleJoystickMove(touch.clientX, touch.clientY);
  };

  private onJoystickMove = (e: TouchEvent) => {
    e.preventDefault();
    if (this.joystickTouchId === null) return;
    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches[i];
      if (touch.identifier === this.joystickTouchId) {
        this.handleJoystickMove(touch.clientX, touch.clientY);
        break;
      }
    }
  };

  private handleJoystickMove(clientX: number, clientY: number) {
    const dx = clientX - this.joystickCenter.x;
    const dy = clientY - this.joystickCenter.y;
    const dist = Math.hypot(dx, dy);

    this.joystickAngle = Math.atan2(dy, dx);
    this.joystickMoving = dist > 5; // deadzone

    const handleEl = document.querySelector(".joystick-handle") as HTMLElement;
    if (handleEl) {
      const clampDist = Math.min(dist, this.maxJoystickDist);
      const hx = Math.cos(this.joystickAngle) * clampDist;
      const hy = Math.sin(this.joystickAngle) * clampDist;
      handleEl.style.transform = `translate(${hx}px, ${hy}px)`;
    }
  }

  private onJoystickEnd = (e: TouchEvent) => {
    e.preventDefault();
    if (this.joystickTouchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === this.joystickTouchId) {
        this.joystickTouchId = null;
        this.joystickMoving = false;

        const handleEl = document.querySelector(".joystick-handle") as HTMLElement;
        if (handleEl) {
          handleEl.style.transform = `translate(0px, 0px)`;
        }
        break;
      }
    }
  };

  private onActionBtnStart = (e: TouchEvent) => {
    e.preventDefault();
    const state = this.getFishState();
    if (state === "reeling" || state === "boss_assisting") {
      this.reelHeld = true;
    } else if (state === "waiting") {
      this.send({ type: "retract" });
    } else if (state === "idle") {
      this.chargeStartAt = performance.now();
    }
  };

  private onActionBtnEnd = (e: TouchEvent) => {
    e.preventDefault();
    if (this.reelHeld) {
      this.reelHeld = false;
      return;
    }
    if (this.getFishState() === "idle") {
      this.releaseCast();
    }
  };

  private onTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = this.canvas.getBoundingClientRect();
    this.touchStartX = touch.clientX - rect.left;
    this.touchStartY = touch.clientY - rect.top;
    this.mouseX = this.touchStartX;
    this.mouseY = this.touchStartY;
    this.touchStartAt = performance.now();

    const state = this.getFishState();
    if (state === "reeling" || state === "boss_assisting") {
      this.reelHeld = true;
    } else {
      this.chargeStartAt = performance.now();
    }
  };

  private onTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = touch.clientX - rect.left;
    this.mouseY = touch.clientY - rect.top;
  };

  private onTouchEnd = (e: TouchEvent) => {
    e.preventDefault();
    if (this.reelHeld) {
      this.reelHeld = false;
      return;
    }

    const duration = performance.now() - this.touchStartAt;
    const dx = this.mouseX - this.touchStartX;
    const dy = this.mouseY - this.touchStartY;
    const dist = Math.hypot(dx, dy);

    if (this.getFishState() === "idle") {
      if (duration < 250 && dist < 15) {
        // Simple tap -> walk there!
        this.chargeStartAt = null;
        const origin = this.getOrigin();
        const mdx = this.mouseX - origin.x;
        const mdy = this.mouseY - origin.y;
        const playerPos = this.getPlayerPos();
        
        this.targetWorldX = playerPos.x + mdx;
        this.targetWorldY = playerPos.y + mdy;
        this.hasTarget = true;
        this.targetMoving = true;
      } else {
        // Drag/Hold release -> cast!
        this.releaseCast();
      }
    }
  };

  private onMouseMove = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = e.clientX - rect.left;
    this.mouseY = e.clientY - rect.top;
  };

  private onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    if (this.getFishState() !== "idle") return; // Only allow movement when idle/free

    const origin = this.getOrigin();
    const dx = this.mouseX - origin.x;
    const dy = this.mouseY - origin.y;

    const playerPos = this.getPlayerPos();
    this.targetWorldX = playerPos.x + dx;
    this.targetWorldY = playerPos.y + dy;
    this.hasTarget = true;
    this.targetMoving = true;
  };

  private onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    const state = this.getFishState();
    if (state === "reeling" || state === "boss_assisting") {
      // Hold mouse = pull catch zone up. No longer send anything to server — minigame runs entirely on the client
      // (see reelSim.ts), server only receives the final result. Only set local flag for simulation + click SFX.
      this.reelHeld = true;
    } else if (state === "waiting") {
      this.send({ type: "retract" });
    } else if (state === "idle") {
      this.chargeStartAt = performance.now();
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button !== 0) return;
    if (this.reelHeld) {
      this.reelHeld = false;
      return;
    }
    this.releaseCast();
  };

  private onMouseLeave = () => {
    // Cancel an in-progress charge rather than firing a cast the player can no longer aim, if the
    // cursor leaves the canvas mid-hold. Also stop reeling if mouse is held when leaving the canvas —
    // avoiding getting stuck in "reeling" forever because mouseup is never received.
    this.chargeStartAt = null;
    this.reelHeld = false;
  };

  private releaseCast() {
    if (this.chargeStartAt == null) return;
    const heldMs = performance.now() - this.chargeStartAt;
    this.chargeStartAt = null;
    const power = Math.min(1, heldMs / CAST_MAX_CHARGE_MS);
    this.send({ type: "cast", angle: this.pointerAngle, power });
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const targetTagName = (e.target as HTMLElement)?.tagName;
    if (targetTagName === "INPUT" || targetTagName === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) {
      return;
    }

    if (e.code in MOVE_KEY_VECTORS) {
      e.preventDefault(); // prevent arrow keys from scrolling the page
      this.heldMoveKeys.set(e.code, Date.now());
      this.hasTarget = false; // Pressing WASD cancels right-click movement destination
    }

    if (e.code === "Space") {
      e.preventDefault();
      if (this.getFishState() === "waiting") {
        this.send({ type: "retract" });
      }
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (e.code in MOVE_KEY_VECTORS) {
      this.heldMoveKeys.delete(e.code);
    }
  };

  /** Cleans up "stuck" keys — keys that haven't repeated keydown for a long time (> KEY_STALE_MS) but
   * have never received a corresponding keyup. Called every frame from `tick` before calculating movement direction. */
  private purgeStaleKeys(nowMs: number) {
    for (const [code, lastSeenAt] of this.heldMoveKeys) {
      if (nowMs - lastSeenAt > InputController.KEY_STALE_MS) {
        this.heldMoveKeys.delete(code);
      }
    }
  }

  private onWindowBlur = () => {
    this.heldMoveKeys.clear();
    this.hasTarget = false;
  };

  /** Current angle + movement state, derived from the virtual joystick or right-click destination.
   * No active inputs -> moving=false, keeping the last facing angle when moving. */
  private get movementInput(): { angle: number; moving: boolean } {
    if (this.joystickMoving) {
      this.lastMovementAngle = this.joystickAngle;
      return { angle: this.joystickAngle, moving: true };
    }
    if (this.heldMoveKeys.size > 0) {
      let dx = 0;
      let dy = 0;
      for (const code of this.heldMoveKeys.keys()) {
        const v = MOVE_KEY_VECTORS[code];
        dx += v.dx;
        dy += v.dy;
      }
      if (dx === 0 && dy === 0) return { angle: this.lastMovementAngle, moving: false };
      this.lastMovementAngle = Math.atan2(dy, dx);
      return { angle: this.lastMovementAngle, moving: true };
    } else if (this.hasTarget) {
      this.lastMovementAngle = this.targetAngle;
      return { angle: this.targetAngle, moving: this.targetMoving };
    }
    return { angle: this.lastMovementAngle, moving: false };
  }

  /** Angle (radians) from wherever the local player is actually drawn this frame to the mouse. */
  get pointerAngle(): number {
    const isMobile = document.body.classList.contains("is-mobile");
    if (isMobile) {
      return this.lastMovementAngle;
    }
    const origin = this.getOrigin();
    const dx = this.mouseX - origin.x;
    const dy = this.mouseY - origin.y;
    if (Math.hypot(dx, dy) < POINTER_DEADZONE_PX) {
      return this.stableAngle;
    }
    this.stableAngle = Math.atan2(dy, dx);
    return this.stableAngle;
  }

  /** 0..1 while charging a cast (mouse held down), null otherwise — used by the UI to draw a
   * charge meter. */
  get castChargeFraction(): number | null {
    if (this.chargeStartAt == null) return null;
    return Math.min(1, (performance.now() - this.chargeStartAt) / CAST_MAX_CHARGE_MS);
  }

  /** Called once per animation frame; throttles + dedupes `move` sends, but always sends immediately when
   * the "holding movement key" state has just changed (no throttling delay) — starting/stopping walking needs instant
   * feedback, unlike small angle changes midway while walking (which can be deduped). */
  tick(nowMs: number) {
    this.purgeStaleKeys(nowMs);

    if (this.getFishState() !== "idle") {
      this.hasTarget = false;
    }

    if (this.hasTarget) {
      const playerPos = this.getPlayerPos();
      const dx = this.targetWorldX - playerPos.x;
      const dy = this.targetWorldY - playerPos.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 5) {
        this.targetAngle = Math.atan2(dy, dx);
        this.targetMoving = true;
      } else {
        this.hasTarget = false;
        this.targetMoving = false;
      }
    }

    const { angle, moving } = this.movementInput;
    const movingChanged = this.lastSentMoving === null || moving !== this.lastSentMoving;

    if (!movingChanged) {
      if (nowMs - this.lastMoveSendAt < MOVE_SEND_INTERVAL_MS) return;
      if (this.lastSentAngle !== null && Math.abs(angleDiff(angle, this.lastSentAngle)) < 0.01) {
        return;
      }
    }

    this.lastSentAngle = angle;
    this.lastSentMoving = moving;
    this.lastMoveSendAt = nowMs;
    this.send({ type: "move", angle, moving });
  }
}

function angleDiff(a: number, b: number): number {
  let diff = a - b;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}
