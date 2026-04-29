// D19.3 — Host-side lag compensation for grey-bullet pickups by guest slots.
//
// Background: greys are decel-per-tick projectiles that the guest renders
// via snapshot-lerp at sim-time-now-renderDelayMs (currently 70 ms ≈ 4
// ticks behind the body's predicted clock). When the guest "touches" a
// grey on their screen, the body is at host-now position but the grey
// they see is at host's K-ticks-ago position. Without compensation, the
// host-side collision check (body-now vs grey-now) misses by however far
// the grey moved during those K ticks — feeling like "I glided over the
// orb, it didn't catch."
//
// Fix: per-grey ring buffer of `lagBufferTicks + 1` recent positions on
// the host. When the host runs the slot-1+ pickup check, it tests against
// BOTH the current position AND the K-ticks-ago position. If either
// overlaps the body, count as a pickup. K matches renderDelayMs / 16.67
// + a small slack (input transport latency on top of render delay).
//
// Why is this OK for fairness? Greys are friendly pickups — false
// positives (giving a pickup the guest "barely missed") feel forgiving
// and right. False negatives ("I touched it and got nothing") feel
// broken. Lag-comp accepts a small amount of false-positive risk in
// exchange for eliminating the broken-feeling false-negative.
//
// This module is host-only. Solo / guest never instantiate it.
// Determinism canary unaffected (no change to solo path; coop-host-only
// extension lives behind a `playerSlots.length > 1` gate at the callsite).

// Default look-back: 6 ticks ≈ 100 ms at 60 Hz. Aligns with the 70 ms
// renderDelayMs window plus a generous cushion for transport jitter.
const DEFAULT_LAG_TICKS = 6;
// Ring buffer length must hold lagTicks + 1 entries (current tick + K
// historical). We size to lagTicks + 2 to keep the "next slot to write"
// distinct from the oldest.
const RING_PAD = 2;

// Construct a host-only grey lag-comp tracker. Host calls record(...) once
// per sim tick with the current grey bullets after position update. Then
// during the pickup check, calls wasNearAnyHistoric(...) for each grey
// the body might overlap. clear() drops all state on run end.
function createGreyLagComp({ lagTicks = DEFAULT_LAG_TICKS } = {}) {
  const bufLen = (lagTicks | 0) + RING_PAD;
  const ringByBulletId = new Map();

  // Record the current position of every grey bullet for this sim tick.
  // Greys missing from the input list are evicted (their pickup window
  // has closed; they were absorbed/expired).
  function record(bullets, simTick) {
    if (!Array.isArray(bullets)) return;
    const tick = simTick | 0;
    const seen = new Set();
    for (let i = 0; i < bullets.length; i++) {
      const b = bullets[i];
      if (!b || b.state !== 'grey') continue;
      const id = b.id;
      if (id == null) continue;
      seen.add(id);
      let ring = ringByBulletId.get(id);
      if (!ring) {
        ring = { entries: new Array(bufLen).fill(null), head: 0 };
        ringByBulletId.set(id, ring);
      }
      ring.entries[ring.head] = { tick, x: b.x, y: b.y, r: b.r || 6 };
      ring.head = (ring.head + 1) % bufLen;
    }
    // Evict ids no longer present
    if (ringByBulletId.size > seen.size) {
      for (const id of [...ringByBulletId.keys()]) {
        if (!seen.has(id)) ringByBulletId.delete(id);
      }
    }
  }

  // Find the entry closest to (currentTick - lagTicks). Returns null if
  // we don't yet have history that far back (bullet is younger than the
  // lag window — fall through to the caller's normal current-position
  // check, which is fine since "grey just spawned and body touched it"
  // doesn't have a perceptual lag problem yet).
  function getHistoric(id, currentTick) {
    const ring = ringByBulletId.get(id);
    if (!ring) return null;
    const targetTick = (currentTick | 0) - (lagTicks | 0);
    let best = null;
    let bestDelta = Infinity;
    for (let i = 0; i < ring.entries.length; i++) {
      const e = ring.entries[i];
      if (!e) continue;
      const delta = Math.abs(e.tick - targetTick);
      if (delta < bestDelta) {
        best = e;
        bestDelta = delta;
      }
    }
    // Require the closest entry to be reasonably close to the target
    // tick. If the bullet just spawned (history shorter than lagTicks),
    // bestDelta will be ≥ lagTicks → reject so the caller falls back to
    // its current-position check. Strict `<` means "history must reach
    // back at least 1 tick into the lag window."
    if (best === null || bestDelta >= (lagTicks | 0)) return null;
    return best;
  }

  // Distance-squared check against the historic entry. Returns true iff
  // the body at (bx, by) with abs-radius `bodyAbsR` would have overlapped
  // the bullet at the K-ticks-ago position. False if no usable history.
  function wasNearHistoric(id, currentTick, bx, by, bodyAbsR) {
    const e = getHistoric(id, currentTick);
    if (!e) return false;
    const dx = bx - e.x;
    const dy = by - e.y;
    const rr = bodyAbsR + e.r;
    return (dx * dx + dy * dy) <= rr * rr;
  }

  function clear() { ringByBulletId.clear(); }
  function size() { return ringByBulletId.size; }

  return {
    record,
    wasNearHistoric,
    getHistoric,
    clear,
    size,
    _internal: { ringByBulletId, bufLen, lagTicks },
  };
}

export {
  createGreyLagComp,
  DEFAULT_LAG_TICKS,
};
