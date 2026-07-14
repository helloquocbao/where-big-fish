/**
 * Vẽ icon từng loài cá bằng canvas (yêu cầu Vicent 2026-07-14: mỗi con 1 hình riêng thay vì dùng
 * chung 1 hình chỉ khác màu). `drawFishIcon` là dispatcher: tra `FISH_DRAWERS[speciesId]`, không có
 * thì rơi về `drawGenericFish` (giữ y hệt hình cũ) — nên loài chưa vẽ riêng vẫn hiển thị bình
 * thường. Mọi drawer làm việc trong hệ toạ độ đã dời về tâm (0,0), đầu cá quay +x, nét viền + độ
 * rộng nét đã set sẵn; chỉ cần vẽ hình theo `size` (bề ngang tổng ~size) và tô `color`.
 *
 * Dùng ở 2 nơi: minigame kéo cá (cá đang bơi, có `tailWiggle`) và modal câu được cá (ui.ts).
 */

type FishDrawer = (ctx: CanvasRenderingContext2D, size: number, color: string, tailWiggle: number) => void;

// ---------------------------------------------------------------- helpers màu
function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}
/** Làm sáng (factor>1) / tối (factor<1) 1 màu #rrggbb. */
function shade(hex: string, factor: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = clampByte(((n >> 16) & 255) * factor);
  const g = clampByte(((n >> 8) & 255) * factor);
  const b = clampByte((n & 255) * factor);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function bodyGrad(ctx: CanvasRenderingContext2D, color: string, halfHeight: number, yOffset = 0): CanvasGradient {
  const grad = ctx.createLinearGradient(0, -halfHeight + yOffset, 0, halfHeight + yOffset);
  grad.addColorStop(0, shade(color, 0.72)); // darker back
  grad.addColorStop(0.35, color);
  grad.addColorStop(1, shade(color, 1.25));  // lighter belly
  return grad;
}

function highlight(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, angle = 0): void {
  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, angle, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- primitives
function eye(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillStyle = "#fffaf0";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2d2018";
  ctx.beginPath();
  ctx.arc(x + r * 0.35, y, r * 0.5, 0, Math.PI * 2);
  ctx.fill();
}

/** Đuôi tam giác (mặc định), vẫy theo góc `wiggle`. Đặt gốc đuôi ở x = -bodyHalf. */
function triTail(ctx: CanvasRenderingContext2D, size: number, color: string, wiggle: number, bodyHalf: number, spread: number): void {
  ctx.save();
  ctx.translate(-bodyHalf, 0);
  ctx.rotate(wiggle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-size * 0.34, -size * spread);
  ctx.lineTo(-size * 0.34, size * spread);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Đuôi chẻ đôi (forked) kiểu cá bơi nhanh. */
function forkedTail(ctx: CanvasRenderingContext2D, size: number, color: string, wiggle: number, bodyHalf: number, spread = 0.3): void {
  ctx.save();
  ctx.translate(-bodyHalf, 0);
  ctx.rotate(wiggle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-size * 0.36, -size * spread);
  ctx.lineTo(-size * 0.22, 0);
  ctx.lineTo(-size * 0.36, size * spread);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Đuôi lưỡi liềm (crescent) kiểu cá ngừ — 2 thuỳ nhọn cong. */
function crescentTail(ctx: CanvasRenderingContext2D, size: number, color: string, wiggle: number, bodyHalf: number): void {
  ctx.save();
  ctx.translate(-bodyHalf, 0);
  ctx.rotate(wiggle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-size * 0.18, -size * 0.24, -size * 0.34, -size * 0.34);
  ctx.quadraticCurveTo(-size * 0.22, -size * 0.08, -size * 0.16, 0);
  ctx.quadraticCurveTo(-size * 0.22, size * 0.08, -size * 0.34, size * 0.34);
  ctx.quadraticCurveTo(-size * 0.18, size * 0.24, 0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Đuôi tròn (rounded fan) kiểu cá chép/koi. */
function roundTail(ctx: CanvasRenderingContext2D, size: number, color: string, wiggle: number, bodyHalf: number, r = 0.3): void {
  ctx.save();
  ctx.translate(-bodyHalf, 0);
  ctx.rotate(wiggle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-size * 0.34, -size * r, -size * 0.4, 0);
  ctx.quadraticCurveTo(-size * 0.34, size * r, 0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Vảy: vài hàng cung nhỏ gợi lớp vảy, cắt trong hình thân (gọi sau khi đã set clip nếu cần). */
function scales(ctx: CanvasRenderingContext2D, size: number, color: string): void {
  ctx.strokeStyle = shade(color, 0.8);
  ctx.lineWidth = Math.max(1, size * 0.02);
  for (let col = 0; col < 3; col++) {
    for (let row = -1; row <= 1; row++) {
      const x = -size * 0.12 + col * size * 0.14;
      const y = row * size * 0.13 + (col % 2) * size * 0.065;
      ctx.beginPath();
      ctx.arc(x, y, size * 0.07, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }
  }
}

/** Sọc dọc gợn sóng trên lưng (mackerel). */
function backStripes(ctx: CanvasRenderingContext2D, size: number, color: string, count: number): void {
  ctx.strokeStyle = shade(color, 0.6);
  ctx.lineWidth = Math.max(1, size * 0.022);
  for (let i = 0; i < count; i++) {
    const x = -size * 0.24 + i * (size * 0.5 / count);
    ctx.beginPath();
    ctx.moveTo(x, -size * 0.22);
    ctx.quadraticCurveTo(x + size * 0.03, -size * 0.1, x, -size * 0.02);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------- generic (fallback = hình cũ)
const drawGenericFish: FishDrawer = (ctx, size, color, wiggle) => {
  triTail(ctx, size, color, wiggle, size * 0.42, 0.28);
  ctx.fillStyle = bodyGrad(ctx, color, size * 0.26);
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.42, size * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  highlight(ctx, -size * 0.05, -size * 0.1, size * 0.22, size * 0.06, -0.05);

  ctx.fillStyle = shade(color, 0.95);
  ctx.beginPath();
  ctx.moveTo(size * 0.02, -size * 0.2);
  ctx.quadraticCurveTo(size * 0.12, -size * 0.44, size * 0.22, -size * 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  eye(ctx, size * 0.24, -size * 0.04, size * 0.09);
};

// ---------------------------------------------------------------- Catfish (râu dài, đầu bẹt)
const drawCatfish: FishDrawer = (ctx, size, color, wiggle) => {
  const dark = shade(color, 0.7);
  // Đuôi tròn to.
  ctx.save();
  ctx.translate(-size * 0.4, 0);
  ctx.rotate(wiggle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-size * 0.3, -size * 0.26, -size * 0.36, 0);
  ctx.quadraticCurveTo(-size * 0.3, size * 0.26, 0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  // Thân dài, đầu bẹt to phía trước.
  ctx.fillStyle = bodyGrad(ctx, color, size * 0.23);
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.44, size * 0.23, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  highlight(ctx, -size * 0.05, -size * 0.08, size * 0.25, size * 0.05, -0.02);

  // Vây lưng thấp dài.
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(-size * 0.1, -size * 0.2);
  ctx.quadraticCurveTo(size * 0.05, -size * 0.34, size * 0.2, -size * 0.16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Râu (barbels) — 2 cặp cong từ mõm.
  ctx.strokeStyle = dark;
  ctx.lineWidth = Math.max(1, size * 0.03);
  const mouth = size * 0.42;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(mouth, size * 0.02 * s);
    ctx.quadraticCurveTo(mouth + size * 0.18, size * 0.12 * s, mouth + size * 0.1, size * 0.28 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mouth, size * 0.06 * s);
    ctx.quadraticCurveTo(mouth + size * 0.22, size * 0.22 * s, mouth + size * 0.26, size * 0.34 * s);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = Math.max(1, size * 0.045);
  eye(ctx, size * 0.26, -size * 0.06, size * 0.075);
};

// ---------------------------------------------------------------- Koi (mảng trắng, vây dài)
const drawKoi: FishDrawer = (ctx, size, color, wiggle) => {
  const white = "#fdf7ef";
  // Vây đuôi xoè mềm.
  ctx.save();
  ctx.translate(-size * 0.4, 0);
  ctx.rotate(wiggle);
  ctx.fillStyle = shade(color, 1.08);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-size * 0.32, -size * 0.34, -size * 0.4, -size * 0.12);
  ctx.quadraticCurveTo(-size * 0.3, 0, -size * 0.4, size * 0.12);
  ctx.quadraticCurveTo(-size * 0.32, size * 0.34, 0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  // Thân tròn mập.
  ctx.fillStyle = bodyGrad(ctx, color, size * 0.28);
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.4, size * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  highlight(ctx, -size * 0.05, -size * 0.1, size * 0.2, size * 0.06, -0.05);
  // Mảng trắng đặc trưng koi.
  ctx.fillStyle = white;
  ctx.beginPath();
  ctx.ellipse(-size * 0.05, -size * 0.05, size * 0.16, size * 0.12, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(size * 0.2, size * 0.08, size * 0.09, size * 0.07, 0.2, 0, Math.PI * 2);
  ctx.fill();
  // Vây bụng xoè.
  ctx.fillStyle = shade(color, 1.08);
  ctx.beginPath();
  ctx.moveTo(size * 0.02, size * 0.18);
  ctx.quadraticCurveTo(-size * 0.06, size * 0.42, size * 0.16, size * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Vây lưng mềm.
  ctx.beginPath();
  ctx.moveTo(-size * 0.08, -size * 0.24);
  ctx.quadraticCurveTo(size * 0.06, -size * 0.4, size * 0.18, -size * 0.22);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Râu nhỏ.
  ctx.strokeStyle = shade(color, 0.7);
  ctx.lineWidth = Math.max(1, size * 0.022);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(size * 0.38, size * 0.04 * s);
    ctx.quadraticCurveTo(size * 0.5, size * 0.12 * s, size * 0.46, size * 0.2 * s);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = Math.max(1, size * 0.045);
  eye(ctx, size * 0.26, -size * 0.02, size * 0.075);
};

// ---------------------------------------------------------------- Baby Shark (mõm nhọn, vây lưng, đuôi liềm)
const drawBabyShark: FishDrawer = (ctx, size, color, wiggle) => {
  const belly = shade(color, 1.35);
  const dark = shade(color, 0.75);
  // Đuôi liềm: thuỳ trên to hơn thuỳ dưới.
  ctx.save();
  ctx.translate(-size * 0.36, 0);
  ctx.rotate(wiggle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-size * 0.22, -size * 0.42);
  ctx.lineTo(-size * 0.12, -size * 0.02);
  ctx.lineTo(-size * 0.28, size * 0.22);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  // Thân thoi, mõm nhọn về +x.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(size * 0.48, 0);
  ctx.quadraticCurveTo(size * 0.1, -size * 0.3, -size * 0.34, 0);
  ctx.quadraticCurveTo(size * 0.1, size * 0.3, size * 0.48, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Bụng sáng.
  ctx.fillStyle = belly;
  ctx.beginPath();
  ctx.moveTo(size * 0.4, size * 0.05);
  ctx.quadraticCurveTo(size * 0.05, size * 0.26, -size * 0.28, size * 0.03);
  ctx.quadraticCurveTo(size * 0.05, size * 0.14, size * 0.4, size * 0.05);
  ctx.closePath();
  ctx.fill();
  // Vây lưng tam giác.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-size * 0.02, -size * 0.22);
  ctx.lineTo(size * 0.12, -size * 0.46);
  ctx.lineTo(size * 0.2, -size * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Vây ngực.
  ctx.beginPath();
  ctx.moveTo(size * 0.14, size * 0.14);
  ctx.lineTo(size * 0.02, size * 0.4);
  ctx.lineTo(size * 0.24, size * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Mang.
  ctx.strokeStyle = dark;
  ctx.lineWidth = Math.max(1, size * 0.02);
  for (let i = 0; i < 3; i++) {
    const gx = size * 0.24 - i * size * 0.05;
    ctx.beginPath();
    ctx.moveTo(gx, -size * 0.1);
    ctx.quadraticCurveTo(gx - size * 0.02, 0, gx, size * 0.1);
    ctx.stroke();
  }
  // Miệng cười.
  ctx.strokeStyle = dark;
  ctx.lineWidth = Math.max(1, size * 0.025);
  ctx.beginPath();
  ctx.moveTo(size * 0.46, size * 0.05);
  ctx.quadraticCurveTo(size * 0.36, size * 0.12, size * 0.3, size * 0.06);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = Math.max(1, size * 0.045);
  eye(ctx, size * 0.34, -size * 0.05, size * 0.06);
};

// ---------------------------------------------------------------- Silver Carp (thân bạc, vảy, đuôi chẻ)
const drawSilverCarp: FishDrawer = (ctx, size, color, wiggle) => {
  forkedTail(ctx, size, shade(color, 0.9), wiggle, size * 0.4, 0.28);
  ctx.fillStyle = bodyGrad(ctx, color, size * 0.27);
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.42, size * 0.27, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  highlight(ctx, -size * 0.05, -size * 0.1, size * 0.22, size * 0.06, -0.05);
  scales(ctx, size, color);
  ctx.fillStyle = shade(color, 0.9);
  ctx.beginPath();
  ctx.moveTo(-size * 0.05, -size * 0.24);
  ctx.quadraticCurveTo(size * 0.1, -size * 0.4, size * 0.24, -size * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  eye(ctx, size * 0.27, size * 0.02, size * 0.08);
};

// ---------------------------------------------------------------- Minnow (bé xíu, mắt to)
const drawMinnow: FishDrawer = (ctx, size, color, wiggle) => {
  forkedTail(ctx, size, color, wiggle, size * 0.34, 0.22);
  ctx.fillStyle = bodyGrad(ctx, color, size * 0.16);
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.36, size * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  highlight(ctx, -size * 0.05, -size * 0.05, size * 0.18, size * 0.04, -0.05);
  // Sọc bên mảnh.
  ctx.strokeStyle = shade(color, 0.7);
  ctx.lineWidth = Math.max(1, size * 0.02);
  ctx.beginPath();
  ctx.moveTo(-size * 0.28, 0);
  ctx.lineTo(size * 0.2, 0);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = Math.max(1, size * 0.045);
  eye(ctx, size * 0.22, -size * 0.02, size * 0.1); // mắt to so với thân
};

// ---------------------------------------------------------------- Tilapia (thân cao, vây lưng gai)
const drawTilapia: FishDrawer = (ctx, size, color, wiggle) => {
  forkedTail(ctx, size, shade(color, 0.95), wiggle, size * 0.36, 0.24);
  ctx.fillStyle = bodyGrad(ctx, color, size * 0.32);
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.38, size * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  highlight(ctx, -size * 0.05, -size * 0.1, size * 0.2, size * 0.07, -0.05);
  // Bands dọc mờ.
  ctx.strokeStyle = shade(color, 0.78);
  ctx.lineWidth = Math.max(1, size * 0.025);
  for (let i = -1; i <= 2; i++) {
    const x = i * size * 0.12;
    ctx.beginPath();
    ctx.moveTo(x, -size * 0.26);
    ctx.lineTo(x, size * 0.26);
    ctx.stroke();
  }
  // Vây lưng gai dài chạy dọc lưng.
  ctx.fillStyle = shade(color, 0.9);
  ctx.beginPath();
  ctx.moveTo(-size * 0.28, -size * 0.28);
  for (let i = 0; i <= 6; i++) {
    const x = -size * 0.28 + i * size * 0.085;
    ctx.lineTo(x + size * 0.04, -size * 0.46);
    ctx.lineTo(x + size * 0.085, -size * 0.3);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = Math.max(1, size * 0.045);
  eye(ctx, size * 0.24, -size * 0.06, size * 0.08);
};

// ---------------------------------------------------------------- Snakehead (dài, đốm, vây lưng dài)
const drawSnakehead: FishDrawer = (ctx, size, color, wiggle) => {
  const dark = shade(color, 0.65);
  roundTail(ctx, size, color, wiggle, size * 0.44, 0.22);
  // Thân dài thuôn.
  ctx.fillStyle = bodyGrad(ctx, color, size * 0.19);
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.46, size * 0.19, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  highlight(ctx, -size * 0.05, -size * 0.06, size * 0.25, size * 0.04, -0.02);
  // Vây lưng thấp chạy gần hết lưng.
  ctx.fillStyle = shade(color, 0.85);
  ctx.beginPath();
  ctx.moveTo(-size * 0.34, -size * 0.15);
  ctx.quadraticCurveTo(0, -size * 0.32, size * 0.3, -size * 0.13);
  ctx.lineTo(size * 0.3, -size * 0.09);
  ctx.quadraticCurveTo(0, -size * 0.2, -size * 0.34, -size * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Đốm loang.
  ctx.fillStyle = dark;
  for (const [dx, dy] of [[-0.2, 0.02], [0.0, -0.03], [0.18, 0.04], [-0.05, 0.1]]) {
    ctx.beginPath();
    ctx.ellipse(size * dx, size * dy, size * 0.06, size * 0.045, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  eye(ctx, size * 0.34, -size * 0.02, size * 0.06);
};

// ---------------------------------------------------------------- Giant Barb (chép khổng lồ, thân sâu)
const drawGiantBarb: FishDrawer = (ctx, size, color, wiggle) => {
  roundTail(ctx, size, shade(color, 0.92), wiggle, size * 0.38, 0.34);
  ctx.fillStyle = bodyGrad(ctx, color, size * 0.34);
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.4, size * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  highlight(ctx, -size * 0.05, -size * 0.12, size * 0.2, size * 0.08, -0.05);
  scales(ctx, size, color);
  // Vây lưng lớn.
  ctx.fillStyle = shade(color, 0.88);
  ctx.beginPath();
  ctx.moveTo(-size * 0.18, -size * 0.3);
  ctx.quadraticCurveTo(0, -size * 0.52, size * 0.2, -size * 0.26);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Vây bụng lớn.
  ctx.beginPath();
  ctx.moveTo(-size * 0.05, size * 0.28);
  ctx.quadraticCurveTo(-size * 0.12, size * 0.5, size * 0.14, size * 0.34);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  eye(ctx, size * 0.26, -size * 0.02, size * 0.075);
};

// ---------------------------------------------------------------- Golden Arowana (dài, vảy to, râu)
const drawGoldenArowana: FishDrawer = (ctx, size, color, wiggle) => {
  const edge = shade(color, 0.78);
  // Vây lưng + hậu môn dài về phía đuôi tạo dáng "rồng".
  ctx.fillStyle = shade(color, 1.05);
  ctx.save();
  ctx.rotate(wiggle * 0.4);
  ctx.beginPath();
  ctx.moveTo(-size * 0.44, 0);
  ctx.quadraticCurveTo(-size * 0.1, -size * 0.14, size * 0.1, -size * 0.13);
  ctx.quadraticCurveTo(-size * 0.1, 0, -size * 0.44, 0);
  ctx.quadraticCurveTo(-size * 0.1, size * 0.14, size * 0.1, size * 0.13);
  ctx.quadraticCurveTo(-size * 0.1, 0, -size * 0.44, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  // Thân ribbon dài.
  ctx.fillStyle = bodyGrad(ctx, color, size * 0.17);
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.46, size * 0.17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  highlight(ctx, -size * 0.05, -size * 0.06, size * 0.25, size * 0.04, -0.01);

  // Vảy to xếp lớp.
  ctx.strokeStyle = edge;
  ctx.lineWidth = Math.max(1, size * 0.025);
  for (let c = 0; c < 4; c++) {
    for (let r = -1; r <= 1; r++) {
      ctx.beginPath();
      ctx.arc(-size * 0.15 + c * size * 0.13, r * size * 0.09, size * 0.09, -Math.PI * 0.4, Math.PI * 0.4);
      ctx.stroke();
    }
  }
  // 2 râu chĩa lên trước.
  ctx.strokeStyle = edge;
  ctx.lineWidth = Math.max(1, size * 0.025);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(size * 0.44, size * 0.04 * s);
    ctx.quadraticCurveTo(size * 0.6, -size * 0.02 * s, size * 0.62, -size * 0.14);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = Math.max(1, size * 0.045);
  eye(ctx, size * 0.32, -size * 0.03, size * 0.065);
};

// ---------------------------------------------------------------- Butterfish (nhỏ, tròn mập, mượt)
const drawButterfish: FishDrawer = (ctx, size, color, wiggle) => {
  forkedTail(ctx, size, shade(color, 0.95), wiggle, size * 0.34, 0.2);
  ctx.fillStyle = bodyGrad(ctx, color, size * 0.27);
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.36, size * 0.27, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  highlight(ctx, -size * 0.05, -size * 0.1, size * 0.18, size * 0.06, -0.05);
  // Ánh bơ: mảng sáng trên lưng.
  ctx.fillStyle = shade(color, 1.25);
  ctx.beginPath();
  ctx.ellipse(-size * 0.02, -size * 0.08, size * 0.22, size * 0.1, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(color, 0.9);
  ctx.beginPath();
  ctx.moveTo(-size * 0.02, -size * 0.22);
  ctx.quadraticCurveTo(size * 0.08, -size * 0.36, size * 0.18, -size * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  eye(ctx, size * 0.22, -size * 0.02, size * 0.075);
};

// ---------------------------------------------------------------- Mackerel (thoi, sọc lưng, đuôi chẻ sâu)
const drawMackerel: FishDrawer = (ctx, size, color, wiggle) => {
  forkedTail(ctx, size, shade(color, 0.9), wiggle, size * 0.4, 0.3);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(size * 0.46, 0);
  ctx.quadraticCurveTo(size * 0.05, -size * 0.24, -size * 0.4, 0);
  ctx.quadraticCurveTo(size * 0.05, size * 0.24, size * 0.46, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  backStripes(ctx, size, color, 7);
  // Finlet nhỏ gần đuôi.
  ctx.fillStyle = shade(color, 0.85);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.moveTo(-size * (0.28 + i * 0.06), size * 0.12 * s);
      ctx.lineTo(-size * (0.32 + i * 0.06), size * 0.2 * s);
      ctx.lineTo(-size * (0.24 + i * 0.06), size * 0.14 * s);
      ctx.closePath();
      ctx.fill();
    }
  }
  eye(ctx, size * 0.3, -size * 0.02, size * 0.07);
};

// ---------------------------------------------------------------- Bluefin Tuna (torpedo, đuôi liềm, finlet)
const drawTuna: FishDrawer = (ctx, size, color, wiggle) => {
  const belly = shade(color, 1.7);
  crescentTail(ctx, size, shade(color, 0.9), wiggle, size * 0.42);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(size * 0.48, 0);
  ctx.quadraticCurveTo(size * 0.05, -size * 0.28, -size * 0.42, 0);
  ctx.quadraticCurveTo(size * 0.05, size * 0.28, size * 0.48, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Bụng bạc.
  ctx.fillStyle = belly;
  ctx.beginPath();
  ctx.moveTo(size * 0.4, size * 0.06);
  ctx.quadraticCurveTo(size * 0.05, size * 0.24, -size * 0.34, size * 0.03);
  ctx.quadraticCurveTo(size * 0.05, size * 0.13, size * 0.4, size * 0.06);
  ctx.closePath();
  ctx.fill();
  // Vây lưng liềm.
  ctx.fillStyle = shade(color, 0.82);
  ctx.beginPath();
  ctx.moveTo(-size * 0.02, -size * 0.24);
  ctx.quadraticCurveTo(size * 0.06, -size * 0.46, size * 0.16, -size * 0.22);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Finlets vàng dọc đuôi.
  ctx.fillStyle = "#f2c14e";
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const fx = -size * (0.22 + i * 0.06);
      ctx.beginPath();
      ctx.moveTo(fx, size * 0.1 * s);
      ctx.lineTo(fx - size * 0.04, size * 0.17 * s);
      ctx.lineTo(fx + size * 0.02, size * 0.12 * s);
      ctx.closePath();
      ctx.fill();
    }
  }
  eye(ctx, size * 0.32, -size * 0.03, size * 0.065);
};

// ---------------------------------------------------------------- Sad Blobfish (blob hồng, mặt sầu)
const drawSadBlobfish: FishDrawer = (ctx, size, color, wiggle) => {
  const dark = shade(color, 0.82);
  // Thân blob mềm oặt, hơi rung theo wiggle.
  ctx.save();
  ctx.rotate(wiggle * 0.3);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-size * 0.36, size * 0.05);
  ctx.quadraticCurveTo(-size * 0.4, -size * 0.28, -size * 0.05, -size * 0.26);
  ctx.quadraticCurveTo(size * 0.3, -size * 0.24, size * 0.34, size * 0.06);
  ctx.quadraticCurveTo(size * 0.36, size * 0.3, size * 0.05, size * 0.28);
  ctx.quadraticCurveTo(-size * 0.3, size * 0.3, -size * 0.36, size * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Mũi to sụ xuống.
  ctx.fillStyle = shade(color, 0.95);
  ctx.beginPath();
  ctx.ellipse(size * 0.28, size * 0.12, size * 0.12, size * 0.1, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Mắt buồn (mí trên sụp).
  for (const s of [1, -1]) {
    const ex = size * 0.06, ey = -size * 0.06 + (s < 0 ? size * 0.0 : 0);
    void ey;
    ctx.fillStyle = "#fffaf0";
    ctx.beginPath();
    ctx.arc(ex + s * size * 0.11, -size * 0.04, size * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2d2018";
    ctx.beginPath();
    ctx.arc(ex + s * size * 0.11, -size * 0.02, size * 0.03, 0, Math.PI * 2);
    ctx.fill();
  }
  // Miệng méo xuống (sad).
  ctx.strokeStyle = dark;
  ctx.lineWidth = Math.max(1, size * 0.03);
  ctx.beginPath();
  ctx.moveTo(size * 0.02, size * 0.14);
  ctx.quadraticCurveTo(size * 0.14, size * 0.08, size * 0.2, size * 0.16);
  ctx.stroke();
  ctx.restore();
};

// ---------------------------------------------------------------- Old Boot (chiếc giày cũ — meme)
const drawOldBoot: FishDrawer = (ctx, size, color, _wiggle) => {
  const dark = shade(color, 0.7);
  ctx.fillStyle = color;
  // Cổ giày + thân + mũi + đế thành 1 khối hình chữ L.
  ctx.beginPath();
  ctx.moveTo(-size * 0.16, -size * 0.34);
  ctx.lineTo(size * 0.02, -size * 0.34);
  ctx.lineTo(size * 0.04, size * 0.14);
  ctx.quadraticCurveTo(size * 0.06, size * 0.26, size * 0.34, size * 0.24);
  ctx.lineTo(size * 0.38, size * 0.32);
  ctx.lineTo(-size * 0.16, size * 0.34);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Đế giày.
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(-size * 0.2, size * 0.3);
  ctx.lineTo(size * 0.42, size * 0.3);
  ctx.lineTo(size * 0.4, size * 0.4);
  ctx.lineTo(-size * 0.2, size * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Miệng cổ giày.
  ctx.fillStyle = shade(color, 0.5);
  ctx.beginPath();
  ctx.ellipse(-size * 0.07, -size * 0.34, size * 0.09, size * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Dây giày.
  ctx.strokeStyle = shade(color, 1.5);
  ctx.lineWidth = Math.max(1, size * 0.025);
  for (let i = 0; i < 3; i++) {
    const y = -size * 0.2 + i * size * 0.11;
    ctx.beginPath();
    ctx.moveTo(-size * 0.14, y);
    ctx.lineTo(size * 0.0, y + size * 0.05);
    ctx.moveTo(size * 0.0, y);
    ctx.lineTo(-size * 0.14, y + size * 0.05);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = Math.max(1, size * 0.045);
};

// ---------------------------------------------------------------- Soggy Bread (ổ bánh mì ỉu — meme)
const drawSoggyBread: FishDrawer = (ctx, size, color, _wiggle) => {
  const crust = shade(color, 0.7);
  // Ổ bánh mì oval, hơi xẹp.
  ctx.fillStyle = crust;
  ctx.beginPath();
  ctx.ellipse(0, size * 0.02, size * 0.42, size * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Ruột bánh sáng.
  ctx.fillStyle = shade(color, 1.12);
  ctx.beginPath();
  ctx.ellipse(0, size * 0.06, size * 0.34, size * 0.17, 0, 0, Math.PI * 2);
  ctx.fill();
  // Rãnh nứt trên vỏ.
  ctx.strokeStyle = crust;
  ctx.lineWidth = Math.max(1, size * 0.025);
  for (const dx of [-0.16, 0, 0.16]) {
    ctx.beginPath();
    ctx.moveTo(size * dx, -size * 0.2);
    ctx.quadraticCurveTo(size * (dx + 0.04), -size * 0.05, size * dx, size * 0.02);
    ctx.stroke();
  }
  // Giọt nước ỉu nhỏ xuống.
  ctx.fillStyle = "rgba(120,180,210,0.7)";
  for (const dx of [-0.24, 0.1, 0.28]) {
    ctx.beginPath();
    ctx.arc(size * dx, size * 0.28, size * 0.035, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = Math.max(1, size * 0.045);
};

// ---------------------------------------------------------------- Vicent's Wallet (cái ví — meme)
const drawVicentWallet: FishDrawer = (ctx, size, color, _wiggle) => {
  const dark = shade(color, 0.7);
  // Thân ví.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-size * 0.4, -size * 0.24);
  ctx.lineTo(size * 0.4, -size * 0.24);
  ctx.quadraticCurveTo(size * 0.44, -size * 0.24, size * 0.44, -size * 0.18);
  ctx.lineTo(size * 0.44, size * 0.24);
  ctx.quadraticCurveTo(size * 0.44, size * 0.3, size * 0.38, size * 0.3);
  ctx.lineTo(-size * 0.4, size * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Nắp gập.
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(-size * 0.4, -size * 0.02);
  ctx.lineTo(size * 0.44, -size * 0.02);
  ctx.lineTo(size * 0.44, size * 0.24);
  ctx.quadraticCurveTo(size * 0.44, size * 0.3, size * 0.38, size * 0.3);
  ctx.lineTo(-size * 0.4, size * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Thẻ/tiền thò ra trên.
  ctx.fillStyle = "#f6e7c1";
  ctx.fillRect(-size * 0.2, -size * 0.36, size * 0.3, size * 0.16);
  ctx.strokeRect(-size * 0.2, -size * 0.36, size * 0.3, size * 0.16);
  ctx.fillStyle = "#c9a24a";
  ctx.beginPath();
  ctx.arc(size * 0.24, -size * 0.28, size * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#8a6a1e";
  ctx.font = `bold ${Math.round(size * 0.1)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("$", size * 0.24, -size * 0.27);
  // Đường chỉ khâu.
  ctx.strokeStyle = shade(color, 1.4);
  ctx.setLineDash([size * 0.03, size * 0.02]);
  ctx.lineWidth = Math.max(1, size * 0.015);
  ctx.strokeRect(-size * 0.36, -size * 0.2, size * 0.76, size * 0.46);
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = Math.max(1, size * 0.045);
};

// ---------------------------------------------------------------- registry + dispatcher
const FISH_DRAWERS: Record<string, FishDrawer> = {
  silver_carp: drawSilverCarp,
  minnow: drawMinnow,
  catfish: drawCatfish,
  tilapia: drawTilapia,
  snakehead: drawSnakehead,
  koi: drawKoi,
  giant_barb: drawGiantBarb,
  golden_dragonfish: drawGoldenArowana,
  butterfish: drawButterfish,
  mackerel: drawMackerel,
  tuna: drawTuna,
  baby_shark: drawBabyShark,
  old_boot: drawOldBoot,
  soggy_bread: drawSoggyBread,
  sad_blobfish: drawSadBlobfish,
  vicent_wallet: drawVicentWallet,
};

/** Vẽ icon 1 loài cá tại (cx, cy), bề ngang ~size, quay đầu theo `facing` (1 phải, -1 trái), đuôi
 * vẫy theo `tailWiggle` (radian). `speciesId` chọn hình riêng; loài chưa có thì dùng hình generic. */
export function drawFishIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  speciesId: string,
  color: string,
  tailWiggle = 0,
  facing = 1,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(facing, 1);
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = Math.max(1, size * 0.045);
  const drawer = FISH_DRAWERS[speciesId] ?? drawGenericFish;
  drawer(ctx, size, color, tailWiggle);
  ctx.restore();
}
