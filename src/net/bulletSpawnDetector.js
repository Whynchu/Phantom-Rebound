// D19.4 — Bullet spawn detector for the guest.
//
// Tracks every bullet id the guest has ever seen in a snapshot. The first
// time an id appears, the caller can fire a cosmetic muzzle flash so the
// bullet doesn't appear out of thin air at its snapshot-delayed position.
// Owner-color routing is the caller's job; this module only answers
// "which bullets in this snapshot are NEW since last call?"
//
// Memory bound: ids are evicted after `ttlTicks` of absence from the
// `markPresent` set. Across a long run, bullet ids can grow into the
// thousands per minute (D4b spawn-seq scheme), so eviction matters.
// 60 ticks = 1 second is plenty: by the time a bullet id is missing for
// 1s, the host has long since despawned it.
//
// Solo / host don't instantiate this; only constructed in the guest's
// snapshot apply path, mirroring D19.1 / D19.3 patterns.

function createBulletSpawnDetector({ ttlTicks = 60 } = {}) {
  // id -> simTick last seen. Presence in the map = "we've already
  // emitted a muzzle for this id, don't re-emit."
  const lastSeenTick = new Map();

  // Detect new bullet ids. Returns the array of bullets whose id was not
  // previously known. Marks all returned bullets as seen so subsequent
  // calls won't re-fire. Also refreshes lastSeenTick for already-known ids
  // so eviction is deferred while the bullet is still alive.
  function detectNewSpawns(bullets, simTick) {
    if (!Array.isArray(bullets)) return [];
    const tick = simTick | 0;
    const fresh = [];
    for (let i = 0; i < bullets.length; i++) {
      const b = bullets[i];
      if (!b) continue;
      const id = b.id;
      if (id == null) continue;
      if (lastSeenTick.has(id)) {
        lastSeenTick.set(id, tick);
      } else {
        lastSeenTick.set(id, tick);
        fresh.push(b);
      }
    }
    // Evict ids stale for > ttlTicks. Important: this lets reused-id
    // edge cases re-fire a muzzle if the host's bullet pool ever recycles
    // an id after a long gap (we don't believe it does, but defense in
    // depth costs nothing).
    if (lastSeenTick.size > 0) {
      const cutoff = tick - (ttlTicks | 0);
      for (const [id, lastTick] of lastSeenTick) {
        if (lastTick < cutoff) lastSeenTick.delete(id);
      }
    }
    return fresh;
  }

  // Mark an id as already-seen WITHOUT emitting. Useful for letting
  // D19.2's local-fire-clock muzzle pre-empt the spawn muzzle for the
  // guest's own slot 1 shots: when the guest's local fireT wraps, call
  // markSeen() with a synthetic id range to suppress double-flash. In
  // practice we don't know the auth id at that moment, so caller will
  // instead skip slot==1 owner bullets at dispatch time. Kept here for
  // future use.
  function markSeen(id, simTick) {
    if (id == null) return;
    lastSeenTick.set(id, simTick | 0);
  }

  function clear() { lastSeenTick.clear(); }
  function size() { return lastSeenTick.size; }

  return {
    detectNewSpawns,
    markSeen,
    clear,
    size,
    _internal: { lastSeenTick, ttlTicks },
  };
}

export {
  createBulletSpawnDetector,
};
