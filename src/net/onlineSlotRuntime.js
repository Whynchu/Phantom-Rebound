// C3a-core-1 — Online slot runtime.
//
// Single source of truth for "which slot index represents the person
// sitting at this browser?" Pure utility module — reads from
// coopRunConfig.getActiveCoopRun() or an explicit override, never
// from globals.
//
// Slot index mapping:
//   role='host'           → 0  (host authored the sim, owns slot 0)
//   role='guest'          → 1  (second player on the other browser)
//   role='local'          → 0  (solo + COOP_DEBUG: same device plays slot 0)
//   no active coop run    → 0  (solo default)
//   unknown/invalid role  → 0  (fail-safe)
//
// Consumers:
//   - Input routing (C3a-core-2): local browser's mouse/tap drives
//     whatever getLocalSlotIndex() returns.
//   - HUD / boon picker (post-C3a): visual surfaces targeted at the
//     local player.
//
// Determinism guarantee: in solo (no coop run armed), every call
// collapses to index 0 → byte-identical to pre-C3a behaviour.

import { getActiveCoopRun } from './coopRunConfig.js';

const ROLE_TO_SLOT = Object.freeze({
  host: 0,
  guest: 1,
  local: 0,
});

export function resolveLocalSlotIndex(role) {
  if (typeof role !== 'string') return 0;
  return ROLE_TO_SLOT[role] ?? 0;
}

export function getLocalSlotIndex(coopRunOverride) {
  const run = coopRunOverride === undefined ? getActiveCoopRun() : coopRunOverride;
  if (!run || typeof run !== 'object') return 0;
  return resolveLocalSlotIndex(run.role);
}

export function getLocalSlot(playerSlots, coopRunOverride) {
  if (!Array.isArray(playerSlots) || playerSlots.length === 0) return null;
  const idx = getLocalSlotIndex(coopRunOverride);
  return playerSlots[idx] || null;
}

export function isLocalSlot(slot, coopRunOverride) {
  if (!slot || typeof slot !== 'object') return false;
  const idx = getLocalSlotIndex(coopRunOverride);
  if (typeof slot.id === 'number') return slot.id === idx;
  return false;
}
