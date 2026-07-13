/**
 * Deterministic (seeded) pseudo-random helpers — no Math.random, same input always gives the same
 * output. Needed for lake polygon generation (shared/src/lakes.ts): frontend and backend are two
 * separate processes that both import @bomio/shared and must derive the EXACT same lake shapes
 * independently, without the shapes ever going over the network.
 */

/** Deterministic value in [0, 1) from any number — classic GLSL-style sine hash. */
export function hash01(n: number): number {
  const h = Math.sin(n * 12.9898) * 43758.5453;
  return h - Math.floor(h);
}

/** Deterministic small non-negative integer hash from a string (e.g. a lake id). */
export function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
