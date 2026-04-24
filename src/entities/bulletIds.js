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

let hostCounter = 0;
let guestCounter = 0;

// Allocates the next host-authoritative bullet ID. Call from the spawn
// helpers on the host (or in solo — solo is the degenerate "host-only"
// case and uses the same counter).
function nextHostBulletId() {
  // Pre-increment so IDs are 1-based (0 is reserved as "unassigned").
  hostCounter = ((hostCounter + 1) >>> 0);
  // Wraparound guard: skip 0 if we ever loop all the way around. In
  // practice a 60-Hz game firing 10 bullets/s would take ~13 years to
  // exhaust uint32, so this is belt-and-braces.
  if (hostCounter === 0) hostCounter = 1;
  return hostCounter;
}

// Allocates the next guest-predicted bullet ID (negative). Guest-side
// code will use this during client-side prediction in D5. Separate
// counter so predicted IDs don't collide with authoritative ones even
// if the guest also happens to spawn a bullet with a host counter.
function nextGuestBulletId() {
  guestCounter = ((guestCounter - 1) | 0);
  if (guestCounter === 0) guestCounter = -1;
  return guestCounter;
}

function resetBulletIds() {
  hostCounter = 0;
  guestCounter = 0;
}

function isPredictedBulletId(id) {
  return typeof id === 'number' && id < 0;
}

function isAuthoritativeBulletId(id) {
  return typeof id === 'number' && id > 0;
}

// Debug hook — not for sim use.
function peekBulletIdCounters() {
  return { host: hostCounter, guest: guestCounter };
}

export {
  nextHostBulletId,
  nextGuestBulletId,
  resetBulletIds,
  isPredictedBulletId,
  isAuthoritativeBulletId,
  peekBulletIdCounters,
};
