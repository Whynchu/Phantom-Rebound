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

// R0.4 — seededRng.js rewritten for SimState integration.
// RNG state now lives in a mutable context (either registered simState or
// local context). Each RNG instance carries its own state reference.
// createSeededRng() returns a new instance; simRng singleton is registered
// to simState at module load (script.js calls setRngState(simState)).

function mulberry32Step(state) {
  state = (state + 0x6D2B79F5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, nextState: state };
}

// Module-level registered state. setRngState() points this to simState,
// so the singleton uses the sim's RNG state. Fallback for testing when
// no external state is registered.
let _registeredState = null;
let _internalFallback = { rngState: 1 };

export function setRngState(simStateOrContext) {
  if (simStateOrContext && typeof simStateOrContext === 'object') {
    _registeredState = simStateOrContext;
  }
}

export function createSeededRng(seed = 1) {
  // Each instance has its own state context. Used for testing isolation.
  const context = { rngState: (seed >>> 0) || 1 };
  
  return {
    reseed(nextSeed) {
      context.rngState = (nextSeed >>> 0) || 1;
    },
    getSeed() { 
      return context.rngState;
    },
    next() { 
      const { value, nextState } = mulberry32Step(context.rngState);
      context.rngState = nextState;
      return value;
    },
    range(min, max) { 
      return min + this.next() * (max - min); 
    },
    // Integer in [min, max] inclusive.
    int(min, max) {
      const lo = Math.ceil(min);
      const hi = Math.floor(max);
      return lo + Math.floor(this.next() * (hi - lo + 1));
    },
    pick(arr) {
      if (!arr || arr.length === 0) return undefined;
      return arr[Math.floor(this.next() * arr.length)];
    },
    fork() {
      const childSeed = (this.next() * 0x100000000) >>> 0;
      return createSeededRng(childSeed || 1);
    },
  };
}

// Module-level singleton. Imported by enemy, projectile, boon, spawn, and
// kill-reward modules. script.js calls setRngState(simState) once at module
// load, then simRng reads/writes _registeredState (which is simState).
// For standalone tests, simRng uses _internalFallback.
const _singletonContext = {
  get rngState() {
    return (_registeredState || _internalFallback).rngState;
  },
  set rngState(v) {
    (_registeredState || _internalFallback).rngState = v;
  },
};

export const simRng = {
  reseed(nextSeed) {
    _singletonContext.rngState = (nextSeed >>> 0) || 1;
  },
  getSeed() {
    return _singletonContext.rngState;
  },
  next() {
    const { value, nextState } = mulberry32Step(_singletonContext.rngState);
    _singletonContext.rngState = nextState;
    return value;
  },
  range(min, max) {
    return min + this.next() * (max - min);
  },
  int(min, max) {
    const lo = Math.ceil(min);
    const hi = Math.floor(max);
    return lo + Math.floor(this.next() * (hi - lo + 1));
  },
  pick(arr) {
    if (!arr || arr.length === 0) return undefined;
    return arr[Math.floor(this.next() * arr.length)];
  },
  fork() {
    const childSeed = (this.next() * 0x100000000) >>> 0;
    return createSeededRng(childSeed || 1);
  },
};

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
