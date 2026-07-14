/**
 * Input handling:
 * - WASD / phím mũi tên: đi bộ (chỉ có tác dụng lúc đang rảnh tay — xem
 *   backend/src/systems/movement.ts, đứng yên khi đang câu). Đứng yên khi không giữ phím nào,
 *   khác hẳn scheme .io cũ (luôn đi liên tục theo hướng chuột).
 * - Hướng chuột: TÁCH BIỆT khỏi đi bộ, chỉ dùng để nhắm hướng thả cần (kiểu twin-stick).
 * - Chuột trái, Ý NGHĨA TUỲ TRẠNG THÁI CÂU CÁ hiện tại (đọc qua `getFishState`, server vẫn tự bỏ
 *   qua hành động không hợp lệ ở trạng thái đó — đây chỉ là UX, không phải nguồn sự thật):
 *   - idle: giữ rồi thả ra = thả cần (cast) theo hướng con trỏ, lực quăng theo thời gian giữ (xem
 *     CAST_MAX_CHARGE_MS trong @bomio/shared).
 *   - reeling: GIỮ chuột xuống = đẩy vùng bắt lên đuổi theo cá, THẢ ra = vùng bắt rơi xuống theo
 *     trọng lực (minigame "1 thanh" — xem backend/src/systems/fishing.ts#updateReeling).
 *   (Không còn bước móc câu — cá cắn là tự động vào reeling, xem docs/progress.md, nên cũng không
 *   còn dùng Space cho bất kỳ hành động câu cá nào.)
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

/** Mỗi phím di chuyển giữ được ánh xạ sang 1 vector đơn vị — giữ nhiều phím cùng lúc (vd W+D) cộng
 * dồn vector rồi lấy góc, cho phép đi 8 hướng. */
const MOVE_KEY_VECTORS: Record<string, { dx: number; dy: number }> = {
  KeyW: { dx: 0, dy: -1 },
  ArrowUp: { dx: 0, dy: -1 },
  KeyS: { dx: 0, dy: 1 },
  ArrowDown: { dx: 0, dy: 1 },
  KeyA: { dx: -1, dy: 0 },
  ArrowLeft: { dx: -1, dy: 0 },
  KeyD: { dx: 1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
};

export class InputController {
  private mouseX = 0;
  private mouseY = 0;
  private stableAngle = 0;
  private lastSentAngle: number | null = null;
  private lastSentMoving: boolean | null = null;
  private lastMoveSendAt = 0;

  // code -> thời điểm (performance.now()) nhận được keydown gần nhất cho phím đó — Map thay vì Set
  // để có thể phát hiện phím "kẹt" (xem purgeStaleKeys).
  private heldMoveKeys = new Map<string, number>();
  private lastMovementAngle = 0;

  // Bao lâu không thấy thêm 1 lần keydown lặp lại (auto-repeat của OS khi giữ phím thật) thì coi
  // phím đó là đã nhả. Vá lỗi thực tế gặp trên Windows khi bật bộ gõ tiếng Việt (Unikey/EVKey...):
  // bộ gõ hook bàn phím ở tầng OS để chèn dấu, thỉnh thoảng "nuốt" mất sự kiện keyup gốc của phím
  // vừa gõ (vd nhấn "A") khiến trình duyệt tưởng phím đó VẪN đang giữ mãi mãi -> nhân vật trôi 1
  // chiều không dừng cho tới khi bấm lại đúng phím đó. Phím giữ THẬT luôn tự phát lại keydown (auto-
  // repeat của OS, thường lặp << 1s/lần) nên ngưỡng này không ảnh hưởng cảm giác giữ phím bình
  // thường, chỉ tự "nhả" phím kẹt sau tối đa ~0.9s thay vì kẹt vĩnh viễn.
  private static readonly KEY_STALE_MS = 900;

  private chargeStartAt: number | null = null;
  private reelHeld = false;

  private canvas: HTMLCanvasElement;
  private send: (message: ClientMessage) => void;
  private getOrigin: () => { x: number; y: number };
  private getFishState: () => FishingState;

  constructor(
    canvas: HTMLCanvasElement,
    send: (message: ClientMessage) => void,
    // Where the local player is actually drawn on screen this frame — normally the canvas center,
    // but not when the camera is pinned at the lake's edge.
    getOrigin: () => { x: number; y: number },
    // Trạng thái câu cá hiện tại của local player — quyết định chuột trái làm gì (cast/hook/reel).
    getFishState: () => FishingState,
  ) {
    this.canvas = canvas;
    this.send = send;
    this.getOrigin = getOrigin;
    this.getFishState = getFishState;
    this.mouseX = canvas.width / 2;
    this.mouseY = canvas.height / 2;

    canvas.addEventListener("mousemove", this.onMouseMove);
    canvas.addEventListener("mousedown", this.onMouseDown);
    canvas.addEventListener("mouseup", this.onMouseUp);
    canvas.addEventListener("mouseleave", this.onMouseLeave);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onWindowBlur);
  }

  /** Gắn thêm mousedown/mouseup/mouseleave (dùng lại đúng handler đã bind cho canvas) lên 1 phần tử
   * DOM khác — dùng cho modal câu cá (ui.ts#fishingModalInteractiveEl): click/giữ chuột ngay trong
   * modal cũng móc câu/kéo cần y hệt bấm trên canvas, vì modal che phủ canvas nên canvas không còn
   * nhận được các sự kiện này lúc modal đang mở. */
  bindAdditionalTarget(el: HTMLElement) {
    el.addEventListener("mousedown", this.onMouseDown);
    el.addEventListener("mouseup", this.onMouseUp);
    el.addEventListener("mouseleave", this.onMouseLeave);
  }

  get isReelHeld(): boolean {
    return this.reelHeld;
  }

  dispose() {
    this.canvas.removeEventListener("mousemove", this.onMouseMove);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    this.canvas.removeEventListener("mouseup", this.onMouseUp);
    this.canvas.removeEventListener("mouseleave", this.onMouseLeave);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onWindowBlur);
  }

  private onMouseMove = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = e.clientX - rect.left;
    this.mouseY = e.clientY - rect.top;
  };

  private onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    if (this.getFishState() === "reeling") {
      this.reelHeld = true;
      this.send({ type: "reel", pulling: true });
    } else {
      this.chargeStartAt = performance.now();
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button !== 0) return;
    if (this.reelHeld) {
      this.reelHeld = false;
      this.send({ type: "reel", pulling: false });
      return;
    }
    this.releaseCast();
  };

  private onMouseLeave = () => {
    // Cancel an in-progress charge rather than firing a cast the player can no longer aim, if the
    // cursor leaves the canvas mid-hold. Cũng ngưng kéo cần nếu đang giữ chuột lúc rời canvas —
    // tránh kẹt "đang kéo" mãi vì không còn nhận được mouseup.
    this.chargeStartAt = null;
    if (this.reelHeld) {
      this.reelHeld = false;
      this.send({ type: "reel", pulling: false });
    }
  };

  private releaseCast() {
    if (this.chargeStartAt == null) return;
    const heldMs = performance.now() - this.chargeStartAt;
    this.chargeStartAt = null;
    const power = Math.min(1, heldMs / CAST_MAX_CHARGE_MS);
    this.send({ type: "cast", angle: this.pointerAngle, power });
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code in MOVE_KEY_VECTORS) {
      e.preventDefault(); // chặn mũi tên cuộn trang
      // Dùng Date.now() (không phải performance.now()) vì đây là mốc thời gian sẽ được so sánh với
      // `nowMs` trong `tick`/`purgeStaleKeys`, và main.ts gọi `input.tick(Date.now())` — 2 đồng hồ
      // khác gốc (performance.now() tính từ lúc trang tải) sẽ khiến hiệu số luôn cực lớn, làm mọi
      // phím bị coi là "kẹt" và xoá ngay lập tức mỗi frame (bug vừa gặp: không đi được luôn).
      this.heldMoveKeys.set(e.code, Date.now());
    }
    // Space không còn tác dụng gì — bước móc câu đã bỏ (cá cắn tự vào reeling), kéo cần chỉ dùng
    // chuột (xem class docstring).
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (e.code in MOVE_KEY_VECTORS) {
      this.heldMoveKeys.delete(e.code);
    }
  };

  /** Dọn các phím "kẹt" — đã lâu (> KEY_STALE_MS) không thấy thêm lần keydown lặp lại nào nhưng
   * cũng chưa từng nhận được keyup tương ứng. Gọi mỗi frame từ `tick` trước khi tính hướng đi. */
  private purgeStaleKeys(nowMs: number) {
    for (const [code, lastSeenAt] of this.heldMoveKeys) {
      if (nowMs - lastSeenAt > InputController.KEY_STALE_MS) {
        this.heldMoveKeys.delete(code);
      }
    }
  }

  private onWindowBlur = () => {
    this.heldMoveKeys.clear();
  };

  /** Góc + trạng thái di chuyển hiện tại, suy ra từ tổng vector các phím WASD/mũi tên đang giữ.
   * Không giữ phím nào -> moving=false, giữ nguyên góc mặt hướng cuối cùng lúc còn đi (angle lúc
   * này không có ý nghĩa với backend — xem movement.ts, chỉ dùng khi moving === true). */
  private get movementInput(): { angle: number; moving: boolean } {
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
  }

  /** Angle (radians) from wherever the local player is actually drawn this frame to the mouse. */
  get pointerAngle(): number {
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

  /** Called once per animation frame; throttles + dedupes `move` sends, nhưng luôn gửi ngay khi
   * trạng thái "đang giữ phím di chuyển" vừa đổi (không chờ throttle) — bắt đầu/dừng đi bộ cần phản
   * hồi tức thời, không như thay đổi góc nhỏ giữa chừng lúc đang đi (dedupe được). */
  tick(nowMs: number) {
    this.purgeStaleKeys(nowMs);
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
