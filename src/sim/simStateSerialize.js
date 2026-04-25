/**
 * SimState serialization for rollback ring buffer and state save/load.
 *
 * Serialization strategy:
 * - SimState is a plain object tree (no classes, no Maps, no Sets).
 * - JSON.stringify(simState) produces a JSON string safe to store/transmit.
 * - State snapshots are deep-cloned via structuredClone or JSON round-trip.
 * - Restore: copy snapshot fields back into live simState (never replace the object).
 *
 * R1 additions (v1.20.82):
 * - serialize(state) → JSON string
 * - deserialize(jsonString) → plain object (caller decides what to do with it)
 * - snapshotState(state) → deep clone suitable for rollback buffer
 * - restoreState(liveState, snapshotState) → in-place field-by-field restore
 *
 * The in-place restore convention (never replace liveState, only mutate fields)
 * is critical because bridges in script.js (score, player, roomIndex, etc.)
 * rely on simState maintaining stable object identity.
 */

/**
 * Serialize sim state to JSON string.
 * Safe for storage, transmission, or logging.
 *
 * @param {object} state - SimState object
 * @returns {string} JSON representation
 */
export function serialize(state) {
  if (!state || typeof state !== 'object') {
    throw new Error('serialize: state must be an object');
  }
  return JSON.stringify(state);
}

/**
 * Deserialize JSON string back to a plain object.
 * The returned object is NOT wired to any runtime state — it's just data.
 * Caller decides what to do (e.g., pass to restoreState).
 *
 * @param {string} json - JSON string from serialize()
 * @returns {object} Plain object with all sim state fields
 */
export function deserialize(json) {
  if (typeof json !== 'string') {
    throw new Error('deserialize: json must be a string');
  }
  try {
    return JSON.parse(json);
  } catch (err) {
    throw new Error(`deserialize: JSON parse failed: ${err.message}`);
  }
}

/**
 * Create a deep snapshot of sim state suitable for rollback ring buffer.
 * Uses structuredClone if available (Node 17.5+, modern browsers), falls back to
 * JSON round-trip for maximum compatibility.
 *
 * @param {object} state - SimState object
 * @returns {object} Deep clone of state
 */
export function snapshotState(state) {
  if (!state || typeof state !== 'object') {
    throw new Error('snapshotState: state must be an object');
  }
  // Try native structuredClone (faster, no serialization overhead).
  if (typeof structuredClone === 'function') {
    return structuredClone(state);
  }
  // Fallback: JSON round-trip (works everywhere, but slightly slower).
  return JSON.parse(JSON.stringify(state));
}

/**
 * Restore sim state from a snapshot IN PLACE.
 * Copies all fields from snapshot into live state, preserving the live object's identity.
 * This is critical for rollback: bridges in script.js rely on simState object identity
 * staying stable (they hold references to simState.run, simState.slots[0], etc.).
 *
 * @param {object} liveState - The live SimState object (mutated)
 * @param {object} snapshot - The snapshot to restore from
 */
export function restoreState(liveState, snapshot) {
  if (!liveState || typeof liveState !== 'object') {
    throw new Error('restoreState: liveState must be an object');
  }
  if (!snapshot || typeof snapshot !== 'object') {
    throw new Error('restoreState: snapshot must be an object');
  }

  // Field-by-field restore for top-level primitives and nested objects.
  // This preserves object identity for any object already referenced elsewhere.

  liveState.tick = snapshot.tick;
  liveState.timeMs = snapshot.timeMs;
  liveState.seed = snapshot.seed;
  liveState.rngState = snapshot.rngState;

  // World state (preserve identity if possible, otherwise reassign).
  if (liveState.world && snapshot.world) {
    liveState.world.w = snapshot.world.w;
    liveState.world.h = snapshot.world.h;
    liveState.world.obstacles.length = 0;
    liveState.world.obstacles.push(...snapshot.world.obstacles);
  } else if (snapshot.world) {
    liveState.world = { ...snapshot.world };
  }

  // Slots (preserve slot objects, restore their fields).
  if (Array.isArray(snapshot.slots)) {
    // Resize slot array if needed (shouldn't happen in normal flow, but be safe).
    while (liveState.slots.length < snapshot.slots.length) {
      // This shouldn't fire; slots are pre-allocated in createSimState.
      liveState.slots.push({
        index: liveState.slots.length,
        body: {},
        metrics: {},
        upg: {},
        shields: [],
        orbState: { fireTimers: [], cooldowns: [] },
      });
    }

    for (let i = 0; i < snapshot.slots.length; i++) {
      const snapshotSlot = snapshot.slots[i];
      const liveSlot = liveState.slots[i];

      // Body fields.
      liveSlot.body.x = snapshotSlot.body.x;
      liveSlot.body.y = snapshotSlot.body.y;
      liveSlot.body.vx = snapshotSlot.body.vx;
      liveSlot.body.vy = snapshotSlot.body.vy;
      liveSlot.body.r = snapshotSlot.body.r;
      liveSlot.body.alive = snapshotSlot.body.alive;

      // Metrics fields.
      liveSlot.metrics.hp = snapshotSlot.metrics.hp;
      liveSlot.metrics.maxHp = snapshotSlot.metrics.maxHp;
      liveSlot.metrics.charge = snapshotSlot.metrics.charge;
      liveSlot.metrics.fireT = snapshotSlot.metrics.fireT;
      liveSlot.metrics.stillTimer = snapshotSlot.metrics.stillTimer;
      liveSlot.metrics.prevStill = snapshotSlot.metrics.prevStill;
      liveSlot.metrics.aimAngle = snapshotSlot.metrics.aimAngle;
      liveSlot.metrics.aimHasTarget = snapshotSlot.metrics.aimHasTarget;

      // UPG — just assign the whole object (boons are immutable once picked).
      liveSlot.upg = { ...snapshotSlot.upg };

      // Shields and orbState arrays.
      liveSlot.shields.length = 0;
      liveSlot.shields.push(...snapshotSlot.shields);
      liveSlot.orbState.fireTimers.length = 0;
      liveSlot.orbState.fireTimers.push(...snapshotSlot.orbState.fireTimers);
      liveSlot.orbState.cooldowns.length = 0;
      liveSlot.orbState.cooldowns.push(...snapshotSlot.orbState.cooldowns);
    }
  }

  // Entity arrays (bullets, enemies).
  liveState.bullets.length = 0;
  liveState.bullets.push(...snapshot.bullets);
  liveState.enemies.length = 0;
  liveState.enemies.push(...snapshot.enemies);

  // Run state (preserve run object identity, restore its fields).
  if (liveState.run && snapshot.run) {
    liveState.run.roomIndex = snapshot.run.roomIndex;
    liveState.run.roomPhase = snapshot.run.roomPhase;
    liveState.run.roomTimer = snapshot.run.roomTimer;
    liveState.run.score = snapshot.run.score;
    liveState.run.kills = snapshot.run.kills;
    // scoreBreakdown is a referenced object; copy its fields.
    if (liveState.run.scoreBreakdown && snapshot.run.scoreBreakdown) {
      liveState.run.scoreBreakdown.kills = snapshot.run.scoreBreakdown.kills;
      liveState.run.scoreBreakdown.overkill = snapshot.run.scoreBreakdown.overkill;
      liveState.run.scoreBreakdown.rooms = snapshot.run.scoreBreakdown.rooms;
      liveState.run.scoreBreakdown.bonus = snapshot.run.scoreBreakdown.bonus;
    }
    liveState.run.gameOver = snapshot.run.gameOver;
    liveState.run.paused = snapshot.run.paused;
    liveState.run.pendingBoonQueue.length = 0;
    liveState.run.pendingBoonQueue.push(...snapshot.run.pendingBoonQueue);
    liveState.run.boonHistory.length = 0;
    liveState.run.boonHistory.push(...snapshot.run.boonHistory);
    liveState.run.legendaryRejectedIds.length = 0;
    liveState.run.legendaryRejectedIds.push(...snapshot.run.legendaryRejectedIds);
    liveState.run.legendaryRoomsSinceReject = { ...snapshot.run.legendaryRoomsSinceReject };
  }

  // ID counters.
  liveState.nextEnemyId = snapshot.nextEnemyId;
  liveState.nextBulletId = snapshot.nextBulletId;

  // Effect queue.
  liveState.effectQueue.length = 0;
  liveState.effectQueue.push(...snapshot.effectQueue);
}

/**
 * Test helpers (optional exports for test isolation).
 * Re-export from simState if needed for other tests.
 */
export const __testing__ = {
  // Could add utilities like "diff snapshots" or "validate state shape" here.
};
