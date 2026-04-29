// ── PLAYER SLOT ──────────────────────────────────────────────────────────────
// A "slot" is the per-player bundle that co-op pluralizes. In solo and in
// the current codebase we only ever have slot 0; Phase C2 introduces slot 1
// (guest) behind `?coopdebug=1`, and Phase C3 wires slot 1 to a remote peer.
//
// The slot holds LIVE VIEWS onto the real state, not copies. In Phase C2a we
// wire slot 0 to the legacy singletons (`player`, `UPG`, `score`, etc.) via
// injected getters/setters so that existing callsites are untouched. Later
// C2 phases migrate individual callsites to read from the slot directly,
// and eventually the singletons disappear in favor of `playerSlots[i]`.
//
// Design contract (must stay stable across C2 sub-phases):
//   slot.id        — canonical player id (0 = host, 1 = guest)
//   slot.body      — mutable player entity (x, y, r, vx, vy, shields, ...)
//   slot.upg       — mutable UPG boon/upgrade state
//   slot.metrics   — { score, kills, charge, fireT, hp, maxHp, ... } mutable
//   slot.timers    — { slipCooldown, absorbComboCount, chainMagnetTimer, ... }
//   slot.input     — per-slot input adapter (keyboard/joystick/remote packet)
//   slot.aim       — { angle, hasTarget }
//
// For C2a all but `id` delegate through getter/setter bridges that live in
// script.js, so reassigning `player = createInitialPlayerState()` etc. still
// works transparently — the slot keeps pointing at the latest value.

export function createPlayerSlot({
  id,
  getBody,
  getUpg,
  metrics,
  timers,
  aim,
  input = null,
} = {}) {
  if (!Number.isInteger(id) || id < 0) {
    throw new Error(`createPlayerSlot: id must be a non-negative integer (got ${id})`);
  }
  if (typeof getBody !== 'function') throw new Error('createPlayerSlot: getBody must be a function');
  if (typeof getUpg !== 'function') throw new Error('createPlayerSlot: getUpg must be a function');
  if (!metrics || typeof metrics !== 'object') throw new Error('createPlayerSlot: metrics required');
  if (!timers || typeof timers !== 'object') throw new Error('createPlayerSlot: timers required');
  if (!aim || typeof aim !== 'object') throw new Error('createPlayerSlot: aim required');

  return Object.freeze({
    id,
    get body() { return getBody(); },
    get upg() { return getUpg(); },
    metrics,
    timers,
    aim,
    input,
  });
}

// Playersslots live in a small array. Solo = [slot0]; coopdebug / online coop
// = [slot0, slot1]. The array is module-level mutable so that `init()` can
// reseat it on each new run without callers losing their reference (they
// always index through `playerSlots[i]`).
export const playerSlots = [];

export function resetPlayerSlots() {
  playerSlots.length = 0;
}

export function registerPlayerSlot(slot) {
  if (!slot || !Number.isInteger(slot.id)) {
    throw new Error('registerPlayerSlot: slot with integer id required');
  }
  playerSlots[slot.id] = slot;
  return slot;
}

export function getPlayerSlot(id) {
  return playerSlots[id] || null;
}

export function getActiveSlots() {
  return playerSlots.filter(Boolean);
}
