/**
 * Draws each fish species icon using canvas (Vicent's request 2026-07-14: each has its own distinct shape instead of sharing
 * a single shape with only color changes). `drawFishIcon` is a dispatcher: queries `FISH_DRAWERS[speciesId]`, falls back
 * to `drawGenericFish` (keeping it exactly like the old shape) if not found — so species not yet custom drawn will display normally.
 * All drawers work in a coordinate system shifted to the center (0,0), fish head facing +x, outlines + line widths pre-configured;
 * they only need to draw the shape based on `size` (total width ~size) and fill with `color`.
 *
 * Used in 2 places: reeling minigame (swimming fish, has `tailWiggle`) and catch celebration modal (ui.ts).
 */

type FishDrawer = (ctx: CanvasRenderingContext2D, size: number, color: string, tailWiggle: number) => void;

// ---------------------------------------------------------------- color helpers
function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}
/** Lightens (factor>1) / darkens (factor<1) a #rrggbb color. */
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

/** Triangular tail (default), wiggling based on the `wiggle` angle. Places the tail base at x = -bodyHalf. */
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

/** Forked tail style for fast-swimming fish. */
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

/** Crescent tail style for tuna — 2 curved sharp lobes. */
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

/** Rounded fan tail style for carp/koi. */
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

/** Scales: a few rows of small arcs suggesting scales, clipped inside the body shape (called after setting clip if needed). */
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

/** Wavy vertical stripes on the back (mackerel). */
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

// ---------------------------------------------------------------- generic (fallback = old shape)
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

// ---------------------------------------------------------------- Catfish (long barbels, flat head)
const drawCatfish: FishDrawer = (ctx, size, color, wiggle) => {
  const dark = shade(color, 0.7);
  // Large rounded tail.
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
  // Long body, large flat head in front.
  ctx.fillStyle = bodyGrad(ctx, color, size * 0.23);
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.44, size * 0.23, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  highlight(ctx, -size * 0.05, -size * 0.08, size * 0.25, size * 0.05, -0.02);

  // Long low dorsal fin.
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(-size * 0.1, -size * 0.2);
  ctx.quadraticCurveTo(size * 0.05, -size * 0.34, size * 0.2, -size * 0.16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Barbels — 2 curved pairs from the snout.
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

// ---------------------------------------------------------------- Koi (white patches, long fins)
const drawKoi: FishDrawer = (ctx, size, color, wiggle) => {
  const white = "#fdf7ef";
  // Soft spreading tail fin.
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
  // Plump round body.
  ctx.fillStyle = bodyGrad(ctx, color, size * 0.28);
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.4, size * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  highlight(ctx, -size * 0.05, -size * 0.1, size * 0.2, size * 0.06, -0.05);
  // Characteristic koi white patches.
  ctx.fillStyle = white;
  ctx.beginPath();
  ctx.ellipse(-size * 0.05, -size * 0.05, size * 0.16, size * 0.12, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(size * 0.2, size * 0.08, size * 0.09, size * 0.07, 0.2, 0, Math.PI * 2);
  ctx.fill();
  // Spreading ventral fin.
  ctx.fillStyle = shade(color, 1.08);
  ctx.beginPath();
  ctx.moveTo(size * 0.02, size * 0.18);
  ctx.quadraticCurveTo(-size * 0.06, size * 0.42, size * 0.16, size * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Soft dorsal fin.
  ctx.beginPath();
  ctx.moveTo(-size * 0.08, -size * 0.24);
  ctx.quadraticCurveTo(size * 0.06, -size * 0.4, size * 0.18, -size * 0.22);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Small barbels.
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

// ---------------------------------------------------------------- Baby Shark (pointed snout, dorsal fin, crescent tail)
const drawBabyShark: FishDrawer = (ctx, size, color, wiggle) => {
  const belly = shade(color, 1.35);
  const dark = shade(color, 0.75);
  // Crescent tail: upper lobe larger than lower lobe.
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
  // Fusiform body, pointed snout towards +x.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(size * 0.48, 0);
  ctx.quadraticCurveTo(size * 0.1, -size * 0.3, -size * 0.34, 0);
  ctx.quadraticCurveTo(size * 0.1, size * 0.3, size * 0.48, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Light belly.
  ctx.fillStyle = belly;
  ctx.beginPath();
  ctx.moveTo(size * 0.4, size * 0.05);
  ctx.quadraticCurveTo(size * 0.05, size * 0.26, -size * 0.28, size * 0.03);
  ctx.quadraticCurveTo(size * 0.05, size * 0.14, size * 0.4, size * 0.05);
  ctx.closePath();
  ctx.fill();
  // Triangular dorsal fin.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-size * 0.02, -size * 0.22);
  ctx.lineTo(size * 0.12, -size * 0.46);
  ctx.lineTo(size * 0.2, -size * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Pectoral fin.
  ctx.beginPath();
  ctx.moveTo(size * 0.14, size * 0.14);
  ctx.lineTo(size * 0.02, size * 0.4);
  ctx.lineTo(size * 0.24, size * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Gills.
  ctx.strokeStyle = dark;
  ctx.lineWidth = Math.max(1, size * 0.02);
  for (let i = 0; i < 3; i++) {
    const gx = size * 0.24 - i * size * 0.05;
    ctx.beginPath();
    ctx.moveTo(gx, -size * 0.1);
    ctx.quadraticCurveTo(gx - size * 0.02, 0, gx, size * 0.1);
    ctx.stroke();
  }
  // Smiling mouth.
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

// ---------------------------------------------------------------- Silver Carp (silver body, scales, forked tail)
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

// ---------------------------------------------------------------- Minnow (tiny, big eyes)
const drawMinnow: FishDrawer = (ctx, size, color, wiggle) => {
  forkedTail(ctx, size, color, wiggle, size * 0.34, 0.22);
  ctx.fillStyle = bodyGrad(ctx, color, size * 0.16);
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.36, size * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  highlight(ctx, -size * 0.05, -size * 0.05, size * 0.18, size * 0.04, -0.05);
  // Thin lateral stripe.
  ctx.strokeStyle = shade(color, 0.7);
  ctx.lineWidth = Math.max(1, size * 0.02);
  ctx.beginPath();
  ctx.moveTo(-size * 0.28, 0);
  ctx.lineTo(size * 0.2, 0);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = Math.max(1, size * 0.045);
  eye(ctx, size * 0.22, -size * 0.02, size * 0.1); // big eyes compared to body
};

// ---------------------------------------------------------------- Tilapia (deep body, spiny dorsal fin)
const drawTilapia: FishDrawer = (ctx, size, color, wiggle) => {
  forkedTail(ctx, size, shade(color, 0.95), wiggle, size * 0.36, 0.24);
  ctx.fillStyle = bodyGrad(ctx, color, size * 0.32);
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.38, size * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  highlight(ctx, -size * 0.05, -size * 0.1, size * 0.2, size * 0.07, -0.05);
  // Faint vertical bands.
  ctx.strokeStyle = shade(color, 0.78);
  ctx.lineWidth = Math.max(1, size * 0.025);
  for (let i = -1; i <= 2; i++) {
    const x = i * size * 0.12;
    ctx.beginPath();
    ctx.moveTo(x, -size * 0.26);
    ctx.lineTo(x, size * 0.26);
    ctx.stroke();
  }
  // Long spiny dorsal fin running along the back.
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

// ---------------------------------------------------------------- Snakehead (long, spotted, long dorsal fin)
const drawSnakehead: FishDrawer = (ctx, size, color, wiggle) => {
  const dark = shade(color, 0.65);
  roundTail(ctx, size, color, wiggle, size * 0.44, 0.22);
  // Long elongated body.
  ctx.fillStyle = bodyGrad(ctx, color, size * 0.19);
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.46, size * 0.19, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  highlight(ctx, -size * 0.05, -size * 0.06, size * 0.25, size * 0.04, -0.02);
  // Low dorsal fin running almost the entire back.
  ctx.fillStyle = shade(color, 0.85);
  ctx.beginPath();
  ctx.moveTo(-size * 0.34, -size * 0.15);
  ctx.quadraticCurveTo(0, -size * 0.32, size * 0.3, -size * 0.13);
  ctx.lineTo(size * 0.3, -size * 0.09);
  ctx.quadraticCurveTo(0, -size * 0.2, -size * 0.34, -size * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Scattered spots.
  ctx.fillStyle = dark;
  for (const [dx, dy] of [[-0.2, 0.02], [0.0, -0.03], [0.18, 0.04], [-0.05, 0.1]]) {
    ctx.beginPath();
    ctx.ellipse(size * dx, size * dy, size * 0.06, size * 0.045, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  eye(ctx, size * 0.34, -size * 0.02, size * 0.06);
};

// ---------------------------------------------------------------- Giant Barb (giant carp, deep body)
const drawGiantBarb: FishDrawer = (ctx, size, color, wiggle) => {
  roundTail(ctx, size, shade(color, 0.92), wiggle, size * 0.38, 0.34);
  ctx.fillStyle = bodyGrad(ctx, color, size * 0.34);
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.4, size * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  highlight(ctx, -size * 0.05, -size * 0.12, size * 0.2, size * 0.08, -0.05);
  scales(ctx, size, color);
  // Large dorsal fin.
  ctx.fillStyle = shade(color, 0.88);
  ctx.beginPath();
  ctx.moveTo(-size * 0.18, -size * 0.3);
  ctx.quadraticCurveTo(0, -size * 0.52, size * 0.2, -size * 0.26);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Large ventral fin.
  ctx.beginPath();
  ctx.moveTo(-size * 0.05, size * 0.28);
  ctx.quadraticCurveTo(-size * 0.12, size * 0.5, size * 0.14, size * 0.34);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  eye(ctx, size * 0.26, -size * 0.02, size * 0.075);
};

// ---------------------------------------------------------------- Golden Arowana (long, large scales, barbels)
const drawGoldenArowana: FishDrawer = (ctx, size, color, wiggle) => {
  const edge = shade(color, 0.78);
  // Long dorsal + anal fins towards the tail creating a "dragon" shape.
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
  // Long ribbon body.
  ctx.fillStyle = bodyGrad(ctx, color, size * 0.17);
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.46, size * 0.17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  highlight(ctx, -size * 0.05, -size * 0.06, size * 0.25, size * 0.04, -0.01);

  // Large overlapping scales.
  ctx.strokeStyle = edge;
  ctx.lineWidth = Math.max(1, size * 0.025);
  for (let c = 0; c < 4; c++) {
    for (let r = -1; r <= 1; r++) {
      ctx.beginPath();
      ctx.arc(-size * 0.15 + c * size * 0.13, r * size * 0.09, size * 0.09, -Math.PI * 0.4, Math.PI * 0.4);
      ctx.stroke();
    }
  }
  // 2 barbels pointing forward.
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

// ---------------------------------------------------------------- Butterfish (small, plump round, smooth)
const drawButterfish: FishDrawer = (ctx, size, color, wiggle) => {
  forkedTail(ctx, size, shade(color, 0.95), wiggle, size * 0.34, 0.2);
  ctx.fillStyle = bodyGrad(ctx, color, size * 0.27);
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.36, size * 0.27, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  highlight(ctx, -size * 0.05, -size * 0.1, size * 0.18, size * 0.06, -0.05);
  // Butter glow: light patch on the back.
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

// ---------------------------------------------------------------- Mackerel (fusiform, back stripes, deeply forked tail)
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
  // Small finlets near the tail.
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

// ---------------------------------------------------------------- Bluefin Tuna (torpedo, crescent tail, finlets)
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
  // Silver belly.
  ctx.fillStyle = belly;
  ctx.beginPath();
  ctx.moveTo(size * 0.4, size * 0.06);
  ctx.quadraticCurveTo(size * 0.05, size * 0.24, -size * 0.34, size * 0.03);
  ctx.quadraticCurveTo(size * 0.05, size * 0.13, size * 0.4, size * 0.06);
  ctx.closePath();
  ctx.fill();
  // Crescent dorsal fin.
  ctx.fillStyle = shade(color, 0.82);
  ctx.beginPath();
  ctx.moveTo(-size * 0.02, -size * 0.24);
  ctx.quadraticCurveTo(size * 0.06, -size * 0.46, size * 0.16, -size * 0.22);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Yellow finlets along the tail.
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

// ---------------------------------------------------------------- Sad Blobfish (pink blob, sad face)
const drawSadBlobfish: FishDrawer = (ctx, size, color, wiggle) => {
  const dark = shade(color, 0.82);
  // Flabby blob body, wiggling slightly with wiggle.
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
  // Large droopy nose.
  ctx.fillStyle = shade(color, 0.95);
  ctx.beginPath();
  ctx.ellipse(size * 0.28, size * 0.12, size * 0.12, size * 0.1, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Sad eyes (drooping upper eyelids).
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
  // Frowning mouth (sad).
  ctx.strokeStyle = dark;
  ctx.lineWidth = Math.max(1, size * 0.03);
  ctx.beginPath();
  ctx.moveTo(size * 0.02, size * 0.14);
  ctx.quadraticCurveTo(size * 0.14, size * 0.08, size * 0.2, size * 0.16);
  ctx.stroke();
  ctx.restore();
};

// ---------------------------------------------------------------- Old Boot (old boot — meme)
const drawOldBoot: FishDrawer = (ctx, size, color, _wiggle) => {
  const dark = shade(color, 0.7);
  ctx.fillStyle = color;
  // Boot shaft + body + toe + sole into a single L-shaped block.
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
  // Boot sole.
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(-size * 0.2, size * 0.3);
  ctx.lineTo(size * 0.42, size * 0.3);
  ctx.lineTo(size * 0.4, size * 0.4);
  ctx.lineTo(-size * 0.2, size * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Boot opening.
  ctx.fillStyle = shade(color, 0.5);
  ctx.beginPath();
  ctx.ellipse(-size * 0.07, -size * 0.34, size * 0.09, size * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Boot laces.
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

// ---------------------------------------------------------------- Soggy Bread (soggy bread — meme)
const drawSoggyBread: FishDrawer = (ctx, size, color, _wiggle) => {
  const crust = shade(color, 0.7);
  // Oval loaf of bread, slightly deflated.
  ctx.fillStyle = crust;
  ctx.beginPath();
  ctx.ellipse(0, size * 0.02, size * 0.42, size * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Light crumb.
  ctx.fillStyle = shade(color, 1.12);
  ctx.beginPath();
  ctx.ellipse(0, size * 0.06, size * 0.34, size * 0.17, 0, 0, Math.PI * 2);
  ctx.fill();
  // Score marks on the crust.
  ctx.strokeStyle = crust;
  ctx.lineWidth = Math.max(1, size * 0.025);
  for (const dx of [-0.16, 0, 0.16]) {
    ctx.beginPath();
    ctx.moveTo(size * dx, -size * 0.2);
    ctx.quadraticCurveTo(size * (dx + 0.04), -size * 0.05, size * dx, size * 0.02);
    ctx.stroke();
  }
  // Soggy water drops dripping down.
  ctx.fillStyle = "rgba(120,180,210,0.7)";
  for (const dx of [-0.24, 0.1, 0.28]) {
    ctx.beginPath();
    ctx.arc(size * dx, size * 0.28, size * 0.035, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = Math.max(1, size * 0.045);
};

// ---------------------------------------------------------------- Vicent's Wallet (wallet — meme)
const drawVicentWallet: FishDrawer = (ctx, size, color, _wiggle) => {
  const dark = shade(color, 0.7);
  // Wallet body.
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
  // Flap.
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
  // Cards/money sticking out from the top.
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
  // Stitching line.
  ctx.strokeStyle = shade(color, 1.4);
  ctx.setLineDash([size * 0.03, size * 0.02]);
  ctx.lineWidth = Math.max(1, size * 0.015);
  ctx.strokeRect(-size * 0.36, -size * 0.2, size * 0.76, size * 0.46);
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = Math.max(1, size * 0.045);
};

// ---------------------------------------------------------------- Leviathan (Boss sea monster - massive snake body, multiple spiky fins, glowing red eye, sharp fangs)
const drawLeviathan: FishDrawer = (ctx, size, color, wiggle) => {
  const dark = shade(color, 0.55);
  const glow = "#ff2a2a"; // Glowing red accents/eyes
  const belly = shade(color, 1.25);

  // 1. Long serpentine tail wiggling
  ctx.save();
  ctx.translate(-size * 0.38, 0);
  ctx.rotate(wiggle * 1.5); // extra wiggly tail
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  // Large ragged/forked dragon tail
  ctx.lineTo(-size * 0.35, -size * 0.28);
  ctx.lineTo(-size * 0.24, -size * 0.05);
  ctx.lineTo(-size * 0.35, size * 0.28);
  ctx.lineTo(0, size * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  
  // Spikes on the tail
  ctx.fillStyle = glow;
  for (const offset of [-0.2, -0.1, 0, 0.1, 0.2]) {
    ctx.beginPath();
    ctx.arc(-size * 0.15, size * offset * 0.5, size * 0.03, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 2. Serpentine body - long ellipse
  ctx.fillStyle = bodyGrad(ctx, color, size * 0.24);
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.5, size * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 3. Spiky fins on the back (dorsal spikes)
  ctx.fillStyle = dark;
  ctx.beginPath();
  // Spike 1 (front)
  ctx.moveTo(size * 0.1, -size * 0.22);
  ctx.lineTo(size * 0.18, -size * 0.44);
  ctx.lineTo(size * 0.24, -size * 0.18);
  // Spike 2 (middle)
  ctx.lineTo(size * 0.0, -size * 0.23);
  ctx.lineTo(-size * 0.06, -size * 0.48);
  ctx.lineTo(-size * 0.12, -size * 0.22);
  // Spike 3 (back)
  ctx.lineTo(-size * 0.2, -size * 0.21);
  ctx.lineTo(-size * 0.26, -size * 0.42);
  ctx.lineTo(-size * 0.32, -size * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 4. Light belly with segments (dragon-like)
  ctx.fillStyle = belly;
  ctx.beginPath();
  ctx.moveTo(size * 0.42, size * 0.08);
  ctx.quadraticCurveTo(size * 0.0, size * 0.34, -size * 0.42, size * 0.08);
  ctx.quadraticCurveTo(size * 0.0, size * 0.22, size * 0.42, size * 0.08);
  ctx.closePath();
  ctx.fill();

  // Segment lines on the belly
  ctx.strokeStyle = dark;
  ctx.lineWidth = Math.max(1, size * 0.015);
  for (const dx of [-0.25, -0.1, 0.05, 0.2]) {
    ctx.beginPath();
    ctx.moveTo(size * dx, size * 0.14);
    ctx.lineTo(size * (dx + 0.02), size * 0.24);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = Math.max(1, size * 0.045);

  // 5. Angry Glowing Eye (Red glowing eye with dark mask)
  ctx.fillStyle = "#110a08";
  ctx.beginPath();
  ctx.ellipse(size * 0.3, -size * 0.05, size * 0.09, size * 0.06, 0.15, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = glow; // neon red
  ctx.beginPath();
  ctx.arc(size * 0.32, -size * 0.05, size * 0.04, 0, Math.PI * 2);
  ctx.fill();

  // Inner white glow
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(size * 0.33, -size * 0.06, size * 0.015, 0, Math.PI * 2);
  ctx.fill();

  // 6. Huge jaw with sharp fangs!
  ctx.fillStyle = glow;
  // Draw mouth line
  ctx.strokeStyle = dark;
  ctx.lineWidth = Math.max(1.5, size * 0.025);
  ctx.beginPath();
  ctx.moveTo(size * 0.22, size * 0.08);
  ctx.quadraticCurveTo(size * 0.36, size * 0.16, size * 0.48, size * 0.06);
  ctx.stroke();

  // Sharp fangs hanging down from upper jaw
  ctx.fillStyle = "#fffaf0"; // bone white
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = Math.max(0.5, size * 0.01);
  for (const [fx, fy, h] of [[0.34, 0.08, 0.07], [0.4, 0.09, 0.08], [0.45, 0.08, 0.06]]) {
    ctx.beginPath();
    ctx.moveTo(size * fx, size * fy);
    ctx.lineTo(size * (fx + 0.01), size * (fy + h));
    ctx.lineTo(size * (fx + 0.025), size * fy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Restore line widths
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = Math.max(1, size * 0.045);
};

// ---------------------------------------------------------------- registry + dispatcher
const FISH_DRAWERS: Record<string, FishDrawer> = {
  fish_leviathan: drawLeviathan,
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

/** Draws a fish species icon at (cx, cy), width ~size, facing direction based on `facing` (1 right, -1 left), tail
 * wiggling based on `tailWiggle` (radians). `speciesId` selects the custom shape; if not found, falls back to generic. */
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
