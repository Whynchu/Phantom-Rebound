// Phase C3a-core-2 — Remote input ring buffer.
//
// Stores quantized input frames received from the remote peer, sorted by tick
// ascending. Used by createRemoteInputAdapter to replay frames at the correct
// simulation tick. Capacity is generous (default 120) so a burst of 4-frame
// batches doesn't drop useful frames.
//
// Invariants:
//   - Frames are always kept sorted by tick ascending (reverse-linear scan on
//     push achieves O(1) amortised when frames arrive in order).
//   - Duplicate ticks: first frame wins, second is counted in stats.duplicates.
//   - When over capacity, the oldest frame (index 0) is dropped and
//     stats.droppedCount is incremented.

function createRemoteInputBuffer({ capacity = 120, logger = null } = {}) {
  const buf = [];
  let droppedCount = 0;
  let duplicateCount = 0;

  function push(frame) {
    if (!frame || typeof frame.tick !== 'number') return;

    // Reverse-linear scan: most frames arrive in order → O(1)
    let insertAt = buf.length;
    for (let i = buf.length - 1; i >= 0; i--) {
      if (buf[i].tick === frame.tick) {
        // Duplicate: keep first, drop second
        duplicateCount++;
        logger?.('remoteInputBuffer: duplicate tick dropped', frame.tick);
        return;
      }
      if (buf[i].tick < frame.tick) {
        insertAt = i + 1;
        break;
      }
      insertAt = i;
    }

    buf.splice(insertAt, 0, frame);

    if (buf.length > capacity) {
      buf.shift();
      droppedCount++;
    }
  }

  function peekAt(tick) {
    for (let i = 0; i < buf.length; i++) {
      if (buf[i].tick === tick) return buf[i];
      if (buf[i].tick > tick) break;
    }
    return null;
  }

  // D11 — tolerant lookup. Returns the latest frame whose tick is <= the
  // requested tick. Used by the remote-input adapter to fall back to the
  // most recently received input when the host's simTick has drifted past
  // any exact match (e.g. out-of-sync run start, network jitter, host pause
  // resume). Walks from newest to oldest, O(N) worst case, O(1) typical.
  function peekLatestUpTo(tick) {
    for (let i = buf.length - 1; i >= 0; i--) {
      if (buf[i].tick <= tick) return buf[i];
    }
    return null;
  }

  // D11 — bounded fallback used when host has no buffered frames at or
  // before the requested tick (i.e. host is BEHIND the guest, common at
  // run-start when guest has been ticking for ~one round-trip already).
  // Returns the OLDEST frame in the buffer, which is the best approximation
  // of "most recent guest input we've seen" for the current movement vector.
  function peekOldest() {
    return buf.length > 0 ? buf[0] : null;
  }

  // D12.3 — when guest is AHEAD of host (e.g. host paused for a boon screen
  // while guest's simTick kept advancing), peekLatestUpTo(t) returns null
  // because all frames have tick > t. The right "current intent" frame in
  // that case is the NEWEST, not the oldest. peekOldest is preserved for
  // back-compat, but the adapter prefers peekNewest in this branch.
  function peekNewest() {
    return buf.length > 0 ? buf[buf.length - 1] : null;
  }

  function consumeUpTo(tick) {
    let count = 0;
    while (buf.length > 0 && buf[0].tick <= tick) {
      buf.shift();
      count++;
    }
    return count;
  }

  function hasFrameFor(tick) {
    return peekAt(tick) !== null;
  }

  function size() {
    return buf.length;
  }

  function oldestTick() {
    return buf.length > 0 ? buf[0].tick : null;
  }

  function newestTick() {
    return buf.length > 0 ? buf[buf.length - 1].tick : null;
  }

  function stats() {
    return {
      size: buf.length,
      capacity,
      droppedCount,
      duplicates: duplicateCount,
      oldestTick: oldestTick(),
      newestTick: newestTick(),
    };
  }

  // D20.1 — flush all buffered frames (e.g. on room transition) so stale
  // cross-room position stamps don't contaminate the new room's movement.
  function clear() {
    buf.length = 0;
  }

  return { push, peekAt, peekLatestUpTo, peekOldest, peekNewest, consumeUpTo, hasFrameFor, size, oldestTick, newestTick, stats, clear };
}

export { createRemoteInputBuffer };
