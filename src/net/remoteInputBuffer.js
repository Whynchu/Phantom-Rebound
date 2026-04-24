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

  return { push, peekAt, consumeUpTo, hasFrameFor, size, oldestTick, newestTick, stats };
}

export { createRemoteInputBuffer };
