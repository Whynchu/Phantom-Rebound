// Seeded PRNG for deterministic simulation (co-op lockstep foundation).
//
// Uses mulberry32 — a small, fast 32-bit PRNG with 2^32 period. Not
// cryptographically strong, but sufficient for game-sim determinism and
// matches the characteristics we need: same seed → identical sequence on
// every platform, regardless of JS engine.
//
// Design:
// - A single module-level `simRng` singleton is imported everywhere the
//   simulation needs randomness. Callers replace `Math.random()` with
//   `simRng.next()`.
// - `simRng.reseed(seed)` is called once at run start (from script.js).
//   If no `?seed=N` URL param is present, a time-based seed is used so
//   solo play stays varied — but any run can be replayed by recording
//   its seed.
// - Cosmetic randomness (particles, damage-number jitter) can continue
//   to use `Math.random()` because it does not affect gameplay state.
//
// See docs/coop-multiplayer-plan.md §2.2 for the full call-site inventory
// and the Phase A migration plan.

function mulberry32(state) {
  return function next() {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSeededRng(seed = 1) {
  let seedState = (seed >>> 0) || 1;
  let step = mulberry32(seedState);
  return {
    reseed(nextSeed) {
      seedState = (nextSeed >>> 0) || 1;
      step = mulberry32(seedState);
    },
    getSeed() { return seedState; },
    next() { return step(); },
    range(min, max) { return min + step() * (max - min); },
    // Integer in [min, max] inclusive.
    int(min, max) {
      const lo = Math.ceil(min);
      const hi = Math.floor(max);
      return lo + Math.floor(step() * (hi - lo + 1));
    },
    pick(arr) {
      if (!arr || arr.length === 0) return undefined;
      return arr[Math.floor(step() * arr.length)];
    },
    // Spawn an independent sub-stream. Useful when we want to isolate
    // one system's randomness from another's for clearer testing
    // (e.g., enemy spawn rolls shouldn't shift because a boon roll
    // happened first). Returns a new seeded rng seeded from the
    // current stream.
    fork() {
      const childSeed = (step() * 0x100000000) >>> 0;
      return createSeededRng(childSeed || 1);
    },
  };
}

// Module-level singleton used across the simulation. Imported directly
// by enemy, projectile, boon, spawn, and kill-reward modules. Seeded
// once per run by script.js via `simRng.reseed(seed)`.
export const simRng = createSeededRng(1);

// Utility to derive a 32-bit seed from a string (used for URL codes
// like ?seed=ABC123 being hashed to an int, and later for co-op room
// codes seeding runs identically on both clients).
export function seedFromString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h || 1;
}

// Parse a seed from a URL query param. Accepts integers ("12345") or
// arbitrary strings ("my-run") which are hashed via FNV-1a.
export function parseSeedParam(raw) {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  if (/^-?\d+$/.test(trimmed)) {
    const n = Number.parseInt(trimmed, 10);
    if (Number.isFinite(n)) return (n >>> 0) || 1;
  }
  return seedFromString(trimmed);
}
