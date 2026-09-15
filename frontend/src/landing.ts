import { render, drawSkinPreview } from './render';

const world = document.querySelector<HTMLCanvasElement>('#landing-world')!;
const angler = document.querySelector<HTMLCanvasElement>('#landing-angler')!;
const context = world.getContext('2d')!;
const anglerContext = angler.getContext('2d')!;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let visible = true;
let frame = 0;
let lastDraw = 0;
function draw(now: number) {
  const width = world.clientWidth, height = world.clientHeight;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  if (world.width !== Math.round(width * dpr) || world.height !== Math.round(height * dpr)) {
    world.width = Math.round(width * dpr); world.height = Math.round(height * dpr);
  }
  render(context, {
    snapshot: { players: [], leaderboard: [] },
    camera: { x: 0, y: 110, width, height, scale: 1 },
    showLandmarks: false,
    localPlayerId: null, nowMs: reducedMotion.matches ? 0 : now,
    devicePixelRatio: dpr,
    getPlayerAnimation: () => ({ x: 0, y: 0, angle: 0, walkPhase: 0, isMoving: false, isDraggedDown: false, draggedDownStartMs: 0 }),
  });
  drawSkinPreview(anglerContext, 180, 180, 'mint', reducedMotion.matches ? 0 : now);
}
function tick(now: number) {
  frame = 0;
  if (!visible || document.hidden) return;
  if (now - lastDraw > 50) { draw(now); lastDraw = now; }
  if (!reducedMotion.matches) frame = requestAnimationFrame(tick);
}
function resume() { if (!frame && visible && !document.hidden) { draw(performance.now()); frame = requestAnimationFrame(tick); } }
new IntersectionObserver(entries => {
  visible = entries[0].isIntersecting;
  if (visible) resume(); else { cancelAnimationFrame(frame); frame = 0; }
}).observe(world);
addEventListener('resize', () => draw(performance.now()));
document.addEventListener('visibilitychange', resume);
reducedMotion.addEventListener('change', resume);
draw(0);
