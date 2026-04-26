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
  // All field restorations are defensive: only restore if the field exists in both.

  if (snapshot.tick !== undefined) liveState.tick = snapshot.tick;
  if (snapshot.timeMs !== undefined) liveState.timeMs = snapshot.timeMs;
  if (snapshot.seed !== undefined) liveState.seed = snapshot.seed;
  if (snapshot.rngState !== undefined) liveState.rngState = snapshot.rngState;

  // World state (preserve identity if possible, otherwise reassign).
  if (liveState.world && snapshot.world) {
    if (snapshot.world.w !== undefined) liveState.world.w = snapshot.world.w;
    if (snapshot.world.h !== undefined) liveState.world.h = snapshot.world.h;
    if (Array.isArray(liveState.world.obstacles) && Array.isArray(snapshot.world.obstacles)) {
      liveState.world.obstacles.length = 0;
      liveState.world.obstacles.push(...snapshot.world.obstacles);
    }
  } else if (snapshot.world) {
    liveState.world = { ...snapshot.world };
  }

  // Slots (preserve slot objects, restore their fields).
  if (Array.isArray(snapshot.slots) && Array.isArray(liveState.slots)) {
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
      if (snapshotSlot.body && liveSlot.body) {
        if (snapshotSlot.body.x !== undefined) liveSlot.body.x = snapshotSlot.body.x;
        if (snapshotSlot.body.y !== undefined) liveSlot.body.y = snapshotSlot.body.y;
        if (snapshotSlot.body.vx !== undefined) liveSlot.body.vx = snapshotSlot.body.vx;
        if (snapshotSlot.body.vy !== undefined) liveSlot.body.vy = snapshotSlot.body.vy;
        if (snapshotSlot.body.r !== undefined) liveSlot.body.r = snapshotSlot.body.r;
        if (snapshotSlot.body.alive !== undefined) liveSlot.body.alive = snapshotSlot.body.alive;
        // Transient combat state (post-hit invuln, distort, phase-walk timers).
        // These MUST roll back so a re-sim through a hit produces the same
        // visual & gameplay state. coopSpectating gates the dt-decrements;
        // also round-trip.
        if (snapshotSlot.body.invincible !== undefined) liveSlot.body.invincible = snapshotSlot.body.invincible;
        if (snapshotSlot.body.distort !== undefined) liveSlot.body.distort = snapshotSlot.body.distort;
        if (snapshotSlot.body.phaseWalkOverlapMs !== undefined) liveSlot.body.phaseWalkOverlapMs = snapshotSlot.body.phaseWalkOverlapMs;
        if (snapshotSlot.body.phaseWalkIdleMs !== undefined) liveSlot.body.phaseWalkIdleMs = snapshotSlot.body.phaseWalkIdleMs;
        if (snapshotSlot.body.coopSpectating !== undefined) liveSlot.body.coopSpectating = snapshotSlot.body.coopSpectating;
        // Death/pop visuals (R0.4 step 8 — GAP 1).
        if (snapshotSlot.body.deadAt !== undefined) liveSlot.body.deadAt = snapshotSlot.body.deadAt;
        if (snapshotSlot.body.popAt !== undefined) liveSlot.body.popAt = snapshotSlot.body.popAt;
        if (snapshotSlot.body.deadPop !== undefined) liveSlot.body.deadPop = snapshotSlot.body.deadPop;
        if (snapshotSlot.body.deadPulse !== undefined) liveSlot.body.deadPulse = snapshotSlot.body.deadPulse;
      }

      // Metrics fields.
      if (snapshotSlot.metrics && liveSlot.metrics) {
        if (snapshotSlot.metrics.hp !== undefined) liveSlot.metrics.hp = snapshotSlot.metrics.hp;
        if (snapshotSlot.metrics.maxHp !== undefined) liveSlot.metrics.maxHp = snapshotSlot.metrics.maxHp;
        if (snapshotSlot.metrics.charge !== undefined) liveSlot.metrics.charge = snapshotSlot.metrics.charge;
        if (snapshotSlot.metrics.fireT !== undefined) liveSlot.metrics.fireT = snapshotSlot.metrics.fireT;
        if (snapshotSlot.metrics.stillTimer !== undefined) liveSlot.metrics.stillTimer = snapshotSlot.metrics.stillTimer;
        if (snapshotSlot.metrics.prevStill !== undefined) liveSlot.metrics.prevStill = snapshotSlot.metrics.prevStill;
        if (snapshotSlot.metrics.aimAngle !== undefined) liveSlot.metrics.aimAngle = snapshotSlot.metrics.aimAngle;
        if (snapshotSlot.metrics.aimHasTarget !== undefined) liveSlot.metrics.aimHasTarget = snapshotSlot.metrics.aimHasTarget;
      }

      // UPG — just assign the whole object (boons are immutable once picked).
      if (snapshotSlot.upg) {
        liveSlot.upg = { ...snapshotSlot.upg };
      }

      // Per-slot timers (boon/combat cadence). These must roll back or
      // re-sim through a tick will produce different damage windows,
      // shockwave cooldowns, orb fires, etc. Field-by-field copy
      // preserves liveSlot.timers identity.
      if (snapshotSlot.timers && liveSlot.timers) {
        if (snapshotSlot.timers.barrierPulseTimer !== undefined) liveSlot.timers.barrierPulseTimer = snapshotSlot.timers.barrierPulseTimer;
        if (snapshotSlot.timers.slipCooldown !== undefined) liveSlot.timers.slipCooldown = snapshotSlot.timers.slipCooldown;
        if (snapshotSlot.timers.absorbComboCount !== undefined) liveSlot.timers.absorbComboCount = snapshotSlot.timers.absorbComboCount;
        if (snapshotSlot.timers.absorbComboTimer !== undefined) liveSlot.timers.absorbComboTimer = snapshotSlot.timers.absorbComboTimer;
        if (snapshotSlot.timers.chainMagnetTimer !== undefined) liveSlot.timers.chainMagnetTimer = snapshotSlot.timers.chainMagnetTimer;
        if (snapshotSlot.timers.echoCounter !== undefined) liveSlot.timers.echoCounter = snapshotSlot.timers.echoCounter;
        if (snapshotSlot.timers.vampiricRestoresThisRoom !== undefined) liveSlot.timers.vampiricRestoresThisRoom = snapshotSlot.timers.vampiricRestoresThisRoom;
        if (snapshotSlot.timers.killSustainHealedThisRoom !== undefined) liveSlot.timers.killSustainHealedThisRoom = snapshotSlot.timers.killSustainHealedThisRoom;
        if (snapshotSlot.timers.colossusShockwaveCd !== undefined) liveSlot.timers.colossusShockwaveCd = snapshotSlot.timers.colossusShockwaveCd;
        if (snapshotSlot.timers.volatileOrbGlobalCooldown !== undefined) liveSlot.timers.volatileOrbGlobalCooldown = snapshotSlot.timers.volatileOrbGlobalCooldown;
      } else if (snapshotSlot.timers && !liveSlot.timers) {
        // Live slot was created before timers field existed — adopt snapshot copy.
        liveSlot.timers = { ...snapshotSlot.timers };
      }

      // Shields and orbState arrays.
      if (Array.isArray(liveSlot.shields) && Array.isArray(snapshotSlot.shields)) {
        liveSlot.shields.length = 0;
        liveSlot.shields.push(...snapshotSlot.shields);
      }
      if (snapshotSlot.orbState && liveSlot.orbState) {
        if (Array.isArray(liveSlot.orbState.fireTimers) && Array.isArray(snapshotSlot.orbState.fireTimers)) {
          liveSlot.orbState.fireTimers.length = 0;
          liveSlot.orbState.fireTimers.push(...snapshotSlot.orbState.fireTimers);
        }
        if (Array.isArray(liveSlot.orbState.cooldowns) && Array.isArray(snapshotSlot.orbState.cooldowns)) {
          liveSlot.orbState.cooldowns.length = 0;
          liveSlot.orbState.cooldowns.push(...snapshotSlot.orbState.cooldowns);
        }
      }
    }
  }

  // Entity arrays (bullets, enemies) — only restore if they exist in both.
  if (liveState.bullets && snapshot.bullets && Array.isArray(liveState.bullets) && Array.isArray(snapshot.bullets)) {
    liveState.bullets.length = 0;
    liveState.bullets.push(...snapshot.bullets);
  }
  if (liveState.enemies && snapshot.enemies && Array.isArray(liveState.enemies) && Array.isArray(snapshot.enemies)) {
    liveState.enemies.length = 0;
    liveState.enemies.push(...snapshot.enemies);
  }

  // Run state (preserve run object identity, restore its fields).
  if (liveState.run && snapshot.run) {
    if (snapshot.run.roomIndex !== undefined) liveState.run.roomIndex = snapshot.run.roomIndex;
    if (snapshot.run.roomPhase !== undefined) liveState.run.roomPhase = snapshot.run.roomPhase;
    if (snapshot.run.roomTimer !== undefined) liveState.run.roomTimer = snapshot.run.roomTimer;
    if (snapshot.run.score !== undefined) liveState.run.score = snapshot.run.score;
    if (snapshot.run.kills !== undefined) liveState.run.kills = snapshot.run.kills;
    // scoreBreakdown is a referenced object; copy its fields.
    if (liveState.run.scoreBreakdown && snapshot.run.scoreBreakdown) {
      if (snapshot.run.scoreBreakdown.kills !== undefined) liveState.run.scoreBreakdown.kills = snapshot.run.scoreBreakdown.kills;
      if (snapshot.run.scoreBreakdown.overkill !== undefined) liveState.run.scoreBreakdown.overkill = snapshot.run.scoreBreakdown.overkill;
      if (snapshot.run.scoreBreakdown.rooms !== undefined) liveState.run.scoreBreakdown.rooms = snapshot.run.scoreBreakdown.rooms;
      if (snapshot.run.scoreBreakdown.bonus !== undefined) liveState.run.scoreBreakdown.bonus = snapshot.run.scoreBreakdown.bonus;
    }
    if (snapshot.run.gameOver !== undefined) liveState.run.gameOver = snapshot.run.gameOver;
    if (snapshot.run.paused !== undefined) liveState.run.paused = snapshot.run.paused;
    if (Array.isArray(liveState.run.pendingBoonQueue) && Array.isArray(snapshot.run.pendingBoonQueue)) {
      liveState.run.pendingBoonQueue.length = 0;
      liveState.run.pendingBoonQueue.push(...snapshot.run.pendingBoonQueue);
    }
    if (Array.isArray(liveState.run.boonHistory) && Array.isArray(snapshot.run.boonHistory)) {
      liveState.run.boonHistory.length = 0;
      liveState.run.boonHistory.push(...snapshot.run.boonHistory);
    }
    if (Array.isArray(liveState.run.legendaryRejectedIds) && Array.isArray(snapshot.run.legendaryRejectedIds)) {
      liveState.run.legendaryRejectedIds.length = 0;
      liveState.run.legendaryRejectedIds.push(...snapshot.run.legendaryRejectedIds);
    }
    if (snapshot.run.legendaryRoomsSinceReject) {
      liveState.run.legendaryRoomsSinceReject = { ...snapshot.run.legendaryRoomsSinceReject };
    }
  }

  // ID counters.
  if (snapshot.nextEnemyId !== undefined) liveState.nextEnemyId = snapshot.nextEnemyId;
  if (snapshot.nextBulletId !== undefined) liveState.nextBulletId = snapshot.nextBulletId;

  // Effect queue.
  if (liveState.effectQueue && snapshot.effectQueue && Array.isArray(liveState.effectQueue) && Array.isArray(snapshot.effectQueue)) {
    liveState.effectQueue.length = 0;
    liveState.effectQueue.push(...snapshot.effectQueue);
  }
}

/**
 * Test helpers (optional exports for test isolation).
 * Re-export from simState if needed for other tests.
 */
export const __testing__ = {
  // Could add utilities like "diff snapshots" or "validate state shape" here.
};
