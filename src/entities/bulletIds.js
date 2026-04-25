// Phase D4b — Monotonic bullet IDs for snapshot reconciliation.
//
// Every bullet gets a stable, unique `id` at spawn so the host can label it
// in snapshots and the guest can correlate authoritative state with its own
// predicted bullets during reconciliation (D6).
//
// Two ID ranges:
//   - Host-authoritative:  positive uint32, 1..2^32-1
//   - Guest-predicted:     negative int32,  -1..-(2^31)
//
// The sign bit is the authority marker: any bullet with id < 0 is locally
// predicted and should be discarded when a matching authoritative bullet
// arrives (matching strategy lands in D6 — typically ownerSlot + spawnTick
// + first-unclaimed-positive-id).
//
// Both counters reset on init() / restoreRun() via `resetBulletIds()` so
// determinism canaries stay byte-identical (bullet IDs mirror spawn order).
//
// R0.4 chunk 2 — host counter migrated into SimState. The script.js bootstrap
// calls `setBulletIdState(simState)` once at module load, after which
// `nextHostBulletId()` reads/writes `state.nextBulletId` directly. Tests that
// don't supply a state ref fall back to a private internal counter so the
// module stays standalone-testable. The guest counter intentionally stays a
// module-level let — it serves the D17/D18/D19 prediction stack which the
// rollback pivot retires at R3, so threading it into SimState would be churn
// for code with a death sentence.

const _internalState = { nextBulletId: 1 };
let _hostState = _internalState;
let _guestCounter = 0;

// Registers the SimState whose `nextBulletId` field will back the host
// counter. Call once from script.js at module load. Pass null to detach
// (used by tests that want a clean private counter).
function setBulletIdState(state) {
  _hostState = state || _internalState;
}

// Allocates the next host-authoritative bullet ID. Call from the spawn
// helpers on the host (or in solo — solo is the degenerate "host-only"
// case and uses the same counter).
function nextHostBulletId() {
  // Post-increment: the field's value IS the next ID to allocate.
  const id = _hostState.nextBulletId >>> 0;
  let next = ((id + 1) >>> 0);
  // Wraparound guard: skip 0 if we ever loop all the way around. In
  // practice a 60-Hz game firing 10 bullets/s would take ~13 years to
  // exhaust uint32, so this is belt-and-braces.
  if (next === 0) next = 1;
  _hostState.nextBulletId = next;
  return id;
}

// Allocates the next guest-predicted bullet ID (negative). Guest-side
// code will use this during client-side prediction in D5. Separate
// counter so predicted IDs don't collide with authoritative ones even
// if the guest also happens to spawn a bullet with a host counter.
// NOTE: stays module-level — D17/D18/D19 prediction stack retires at R3.
function nextGuestBulletId() {
  _guestCounter = ((_guestCounter - 1) | 0);
  if (_guestCounter === 0) _guestCounter = -1;
  return _guestCounter;
}

function resetBulletIds() {
  _hostState.nextBulletId = 1;
  _guestCounter = 0;
}

function isPredictedBulletId(id) {
  return typeof id === 'number' && id < 0;
}

function isAuthoritativeBulletId(id) {
  return typeof id === 'number' && id > 0;
}

// Debug hook — not for sim use. Reports counter values in the legacy shape
// (host = "last allocated", guest = "last allocated"). For the host counter
// that means we report nextBulletId-1, since nextBulletId is "the upcoming
// allocation."
function peekBulletIdCounters() {
  const next = _hostState.nextBulletId >>> 0;
  // After reset, next === 1, so "last allocated" reads 0 (matches pre-R0.4).
  const host = next === 0 ? 0 : ((next - 1) >>> 0);
  return { host, guest: _guestCounter };
}

export {
  setBulletIdState,
  nextHostBulletId,
  nextGuestBulletId,
  resetBulletIds,
  isPredictedBulletId,
  isAuthoritativeBulletId,
  peekBulletIdCounters,
};
