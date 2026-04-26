// R0.3 — SimState shape definition.
//
// The single struct the rollback simulation operates on. Everything that
// gets mutated by simStep() lives inside SimState; everything else
// (DOM bindings, audio context, canvas refs, transport handles) lives
// outside in the renderer/IO layer.
//
// This file is the SHAPE definition. R0.4 will gradually move script.js's
// scattered module-level state into here, one subsystem at a time. Until
// that migration completes, this module is "load-bearing for tests, not
// yet wired into runtime."
//
// Design rules (these never bend):
//   1. Anything that changes value as the game simulates → lives in SimState.
//   2. Anything that's read-only configuration (constants, boon definitions,
//      enemy types, etc.) → does NOT live in SimState. Stays in src/data/.
//   3. Anything browser-y (canvas, audio, DOM) → does NOT live in SimState.
//      That's renderer territory.
//   4. Side-effects fired during sim are queued via state.effectQueue
//      (see ./effectQueue.js) and drained by the renderer on COMMITTED
//      ticks only. Re-simulated ticks discard their queued effects.
//
// Migration map (where today's script.js state will end up):
//
//   script.js var                    →    SimState path
//   ────────────────────────────────────────────────────────────────────
//   simTick                          →    state.tick
//   simNowMs                         →    state.timeMs
//   runSeed                          →    state.seed (immutable post-init)
//   simRng state                     →    state.rngState
//   WORLD_W, WORLD_H                 →    state.world.w, state.world.h
//   player (the local body)          →    state.slots[0].body
//   playerSlots[0..1]                →    state.slots[0..1]
//   hp, maxHp, charge, fireT, ...    →    state.slots[0].metrics.*
//   UPG (player upgrades)            →    state.slots[0].upg
//   bullets[]                        →    state.bullets
//   enemies[]                        →    state.enemies
//   roomObstacles[]                  →    state.world.obstacles
//   roomPhase, roomIntroTimer        →    state.run.roomPhase, .roomTimer
//   currentRoomIndex                 →    state.run.roomIndex
//   score, kills, scoreBreakdown     →    state.run.score, .kills, .scoreBreakdown
//   gameOver, paused                 →    state.run.gameOver, .paused
//   _orbFireTimers, _orbCooldown     →    state.slots[i].orbState
//   pendingBoonSlotQueue             →    state.run.pendingBoonQueue
//   boonHistory                      →    state.run.boonHistory
//
//   NOT in SimState (renderer-only):
//     particles[]            — cosmetic; rendered, never read by sim
//     damageNumbers          — cosmetic
//     screen-shake / hit-stop— cosmetic, drained from effectQueue
//     leaderboard, lbSync    — IO
//     activeCoopSession      — transport
//     audio buffers          — IO
//     all DOM `el`/btn refs  — IO

import { initEffectQueue } from './effectQueue.js';

const DEFAULT_BASE_PLAYER_HP = 200;

/**
 * Create a fresh sim state seeded for a new run.
 *
 * Parameters:
 *   seed       — uint32, fed to simRng. Must be non-zero (caller should
 *                normalize). Same seed + same inputs ⇒ byte-identical sim.
 *   worldW     — world width in px. 0 means caller will set later.
 *   worldH     — world height in px. 0 means caller will set later.
 *   slotCount  — 1 (solo) or 2 (coop). Defaults to 1.
 *   baseHp     — override BASE_PLAYER_HP for testing.
 *
 * The returned object is a plain JSON-friendly tree (no class instances,
 * no Map/Set at top level) so it serializes cleanly for R1 state-save.
 */
export function createSimState({
  seed = 1,
  worldW = 0,
  worldH = 0,
  slotCount = 1,
  baseHp = DEFAULT_BASE_PLAYER_HP,
} = {}) {
  if (!Number.isFinite(seed) || (seed >>> 0) === 0) {
    throw new Error('createSimState: seed must be a non-zero uint32');
  }
  if (slotCount !== 1 && slotCount !== 2) {
    throw new Error('createSimState: slotCount must be 1 or 2');
  }

  const slots = [];
  for (let i = 0; i < slotCount; i++) slots.push(createSlot(i, baseHp));

  const state = {
    // ── Identity ─────────────────────────────────────────────────
    tick: 0,
    timeMs: 0,
    seed: seed >>> 0,

    // RNG state lives INSIDE sim state so it rolls back. Initialized
    // to seed; mutated by simRng in lockstep with sim advancement.
    // Concrete representation owned by seededRng.js (currently a
    // single 32-bit int for mulberry32).
    rngState: seed >>> 0,

    // ── World ────────────────────────────────────────────────────
    world: {
      w: worldW | 0,
      h: worldH | 0,
      // Obstacles list — mutated when the room changes. Each obstacle:
      //   { x, y, w, h, kind?: 'wall'|'cube'|... }
      obstacles: [],
    },

    // ── Player slots ─────────────────────────────────────────────
    // slots[0] is always the local player (host in coop, solo player
    // otherwise). slots[1] (if present) is the partner. Boons, hp,
    // charge, fire timers all live per-slot.
    slots,

    // ── Entities ─────────────────────────────────────────────────
    bullets: [],   // every active projectile (player, enemy, danger, grey)
    enemies: [],   // every active enemy

    // ── Run / scoring ────────────────────────────────────────────
    run: {
      roomIndex: 0,
      roomPhase: 'intro',         // 'intro'|'spawning'|'active'|'cleared'|'boon'
      roomTimer: 0,               // seconds in current phase
      score: 0,
      kills: 0,
      scoreBreakdown: {
        kills: 0,
        overkill: 0,
        rooms: 0,
        bonus: 0,
      },
      gameOver: false,
      paused: false,
      // Queue of pending boon-pick prompts (slot indices, in order).
      pendingBoonQueue: [],
      // History of boons picked, in pick order.
      boonHistory: [],
      // Legendary tracking: which legendaries have been rejected (cooldown).
      // legendaryRejectedIds: array of boon.id strings that were offered & rejected.
      // legendaryRoomsSinceReject: dict { boonId: roomIndex } when that legendary was last rejected.
      legendaryRejectedIds: [],
      legendaryRoomsSinceReject: {},
    },

    // ── Sequence counters ────────────────────────────────────────
    // Monotonic id allocator for entities. Lives in state so rollback
    // restores the right "next id."
    nextEnemyId: 1,
    nextBulletId: 1,

    // ── Effect queue (see effectQueue.js) ────────────────────────
    effectQueue: [],
  };

  initEffectQueue(state);
  return state;
}

/**
 * Create a fresh per-slot record. Slot 0 = local, slot 1 = partner.
 *
 * Body shape mirrors today's script.js `player` and `playerSlots[1].body`:
 *   x, y           — world position (px)
 *   vx, vy         — velocity (px/sec)
 *   r              — body radius (px)
 *   alive          — true while playing, false on death (spectator state)
 *
 * Metrics holds gameplay state that today is scattered across script.js
 * module-level vars (charge, fireT, stillTimer, prevStill, ...).
 *
 * Upg holds the upgrade flags for this slot (today's UPG for slot 0,
 * playerSlots[1].upg for slot 1).
 */
export function createSlot(index, baseHp = DEFAULT_BASE_PLAYER_HP) {
  return {
    index: index | 0,
    body: {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      r: 14,
      alive: true,
      // Transient combat state — must roll back with body so resim
      // re-applies post-hit invuln + distort timers correctly. coopSpectating
      // gates whether dt-decrements apply (skipped while a teammate
      // is spectating), so it must round-trip too.
      invincible: 0,
      distort: 0,
      phaseWalkOverlapMs: 0,
      phaseWalkIdleMs: 0,
      coopSpectating: false,
      // Death/pop visual state (R0.4 step 8 — GAP 1 closed). Legacy
      // runState.player carries these on the player body and the renderer
      // reads them to drive the death "pop" animation + post-death pulse.
      // Carving Region E (shield collision) or any future hit-resolution
      // region into sim will set these on hit; if they don't snapshot/restore
      // with the body, resim will desync the death visual. Init values match
      // legacy createInitialPlayerState defaults (deadAt=0, popAt=0,
      // deadPop=false, deadPulse=0). Snapshotted automatically via the
      // structuredClone path; restoreState explicitly copies them so the
      // in-place field-by-field restore covers them too.
      deadAt: 0,
      popAt: 0,
      deadPop: false,
      deadPulse: 0,
    },
    metrics: {
      hp: baseHp,
      maxHp: baseHp,
      charge: 0,
      fireT: 0,
      stillTimer: 0,
      prevStill: false,
      aimAngle: -Math.PI * 0.5,
      aimHasTarget: false,
    },
    upg: {},
    // Per-slot scalar timers/counters. These are the slot-local
    // boon/combat cadence timers that today live as `_xxx` closure
    // lets in script.js (see slot0Timers in script.js:1262). Schema
    // lives here so rollback snapshot/restore covers them.
    //
    // Units note (see rubber-duck R0.4 critique): some timers tick in
    // ms (decremented by dt*1000 in update()), others in seconds
    // (decremented by dt). Don't normalize — the consumers expect the
    // existing units. Mark each here so future migration doesn't
    // unify them by accident.
    timers: {
      barrierPulseTimer: 0,           // ms
      slipCooldown: 0,                // ms
      absorbComboCount: 0,            // count
      absorbComboTimer: 0,            // ms (resets count on expire)
      chainMagnetTimer: 0,            // ms
      echoCounter: 0,                 // count
      vampiricRestoresThisRoom: 0,    // count
      killSustainHealedThisRoom: 0,   // count
      colossusShockwaveCd: 0,         // s
      volatileOrbGlobalCooldown: 0,   // s
    },
    // Per-shield runtime state. Each entry: { hardened: bool, cooldown: number }.
    // Length matches active shield count (0–8).
    shields: [],
    // Per-orb runtime state. Indices align with orb visual slots.
    orbState: {
      fireTimers: [],
      cooldowns: [],
    },
  };
}

/* -------------------------------------------------------------------------
 * R0.4 SLOT-0 PARITY AUDIT (recorded 2026-04-25 alongside step 5 / clock seam)
 * -------------------------------------------------------------------------
 * Before any of the deferred bullet regions (B/C/D/E in script.js update())
 * can be carved into hostSimStep, the legacy `player` shape (src/core/runState.js
 * createInitialPlayerState) and the sim slot shape above must reach parity.
 * Today they diverge in four ways. Doc kept inline so the next session sees
 * it in the same file as the schema it constrains.
 *
 *   GAP 1 — death/pop visuals on body. runState.player carries:
 *           deadAt, popAt, deadPop (bool), deadPulse.
 *           [CLOSED 2026-04-26 v1.20.101 — R0.4 step 8.] simState
 *           slot.body now carries the same four fields, init to
 *           0/0/false/0, snapshotted via the structuredClone path,
 *           restored explicitly in restoreState. Future hit-resolution
 *           carve-outs that set deadAt/popAt/deadPop/deadPulse on the
 *           body will now round-trip through rollback resim.
 *
 *   GAP 2 — shields location. runState.player.shields is on the body in
 *           legacy code (player.shields). simState keeps shields one
 *           level up (slot.shields) outside slot.body. Region E (shield
 *           collision) iterates `player.shields` — a generic carve-out
 *           that iterates state.slots[i].body.shields would miss them.
 *           [CLOSED 2026-04-26 v1.20.101 — R0.4 step 8.] Adapter
 *           getSlotShields(slotOrPlayer) added; reads slot.shields
 *           direct, falls back to .body.shields, defensive on junk
 *           inputs. Region E carve-out can be written against ONE
 *           shape via this helper.
 *
 *   GAP 3 — runtime stat fields not on slot. runState.player owns
 *           score/kills/charge/fireT/stillTimer/prevStill/hp/maxHp/
 *           runElapsedMs/gameOverShown/boonRerolls/damagelessRooms/
 *           tookDamageThisRoom/lastStallSpawnAt/enemyIdSeq/bossClears.
 *           Some (hp/maxHp/charge/fireT/stillTimer/prevStill) live on
 *           slot.metrics here — round-trip works. Others (runElapsedMs,
 *           damagelessRooms, tookDamageThisRoom, enemyIdSeq, bossClears)
 *           are run-scope and should move to state-level (alongside
 *           state.tick/state.timeMs), NOT per-slot. enemyIdSeq is the
 *           critical one — bullet/enemy carve-outs need a deterministic
 *           id source; today script.js bumps a closure variable.
 *
 *   GAP 4 — out-of-sim ring buffers. Region C (grey absorb) reads
 *           hostGreyLagComp (src/net/greyLagComp.js) which is a host-only
 *           ring buffer NOT part of simState. That region cannot be
 *           carved until the lag-comp data is either (a) moved into sim
 *           (rollback-safe but wider blast radius), or (b) the lag-comp
 *           lookup is moved to a post-sim resolution pass and the sim
 *           emits an "absorb candidate" event.
 *
 * EFFECT-QUEUE CONTRACT — the four deferred regions need these events on
 * state.effectQueue (drained on commit by the renderer; suppressed during
 * resim so cosmetic effects don't double-fire):
 *
 *   Region B (bounce dispatch): 'sparks', 'burstBlueDissipate',
 *     'eliteBulletStageAdvanced', 'triangleBurstSpawned',
 *     'splitOutputBulletsSpawned', 'payloadBlast'.
 *
 *   Region C (grey absorb): 'sparks' (greyAbsorbSparks variant),
 *     'chargeGain' (with absorbValue + reason='orbAbsorb'),
 *     'orbCooldownStarted'.
 *
 *   Region D (volatile orbs): 'volatileOrbDetonated' (carries position
 *     + radius + damage), 'sparks'.
 *
 *   Region E (shield collision): 'shieldHit' (carries shield index +
 *     hardened flag), 'mirrorReflectionSpawned' (uses
 *     buildMirrorShieldReflectionSpec output), 'shieldBurstSpawned'
 *     (uses buildShieldBurstSpec), 'barrierPulseStarted',
 *     'aegisTitanCdShared', 'telemetry.shieldBlocks++' (telemetry must
 *     route through commit-phase, NOT inside sim).
 *
 * Telemetry rule: any counter visible to the player (runs / kills /
 * shieldBlocks / damageTaken) is a commit-phase concern. Sim emits the
 * event; the rollback coordinator's "tick committed" handler increments
 * the counter exactly once. Otherwise resim N times = counter incremented
 * N+1 times.
 * ----------------------------------------------------------------------- */


/**
 * Slot-shape adapter (R0.4 step 8 — GAP 2 closed).
 *
 * Returns the shields array for a slot-or-legacy-player object. Both
 * shapes store shields as a direct array property (`shields`); the
 * legacy `player` object from runState.js is itself the body, while
 * the sim slot is `state.slots[i]` with shields one level up from
 * `slot.body`. This helper exists so a future Region E (shield
 * collision) carve-out can be written against ONE shape — pass either
 * `legacyPlayer` OR `state.slots[i]` and get the right array back.
 *
 * Defensive: returns an empty array if neither shape applies, so a
 * caller iterating the result never NPEs on a half-initialized object.
 *
 * @param {object} slotOrPlayer - sim slot OR legacy player
 * @returns {Array} shields array (live reference, not a copy)
 */
export function getSlotShields(slotOrPlayer) {
  if (!slotOrPlayer || typeof slotOrPlayer !== 'object') return [];
  if (Array.isArray(slotOrPlayer.shields)) return slotOrPlayer.shields;
  // Legacy fallback: shields nested under .body (no current callers, but
  // future schema migrations may temporarily live here).
  if (slotOrPlayer.body && Array.isArray(slotOrPlayer.body.shields)) {
    return slotOrPlayer.body.shields;
  }
  return [];
}


/**
 * Reset a sim state in place to a fresh-run starting position WITHOUT
 * reallocating it. Used between runs to avoid garbage. Preserves the
 * world dimensions and slot count from the existing state.
 */
export function resetSimState(state, { seed = 1, baseHp = DEFAULT_BASE_PLAYER_HP } = {}) {
  if (!state) throw new Error('resetSimState: state required');
  if (!Number.isFinite(seed) || (seed >>> 0) === 0) {
    throw new Error('resetSimState: seed must be a non-zero uint32');
  }
  state.tick = 0;
  state.timeMs = 0;
  state.seed = seed >>> 0;
  state.rngState = seed >>> 0;
  state.world.obstacles.length = 0;
  for (const slot of state.slots) {
    slot.body.x = 0; slot.body.y = 0;
    slot.body.vx = 0; slot.body.vy = 0;
    slot.body.alive = true;
    slot.body.invincible = 0;
    slot.body.distort = 0;
    slot.body.phaseWalkOverlapMs = 0;
    slot.body.phaseWalkIdleMs = 0;
    slot.body.coopSpectating = false;
    slot.body.deadAt = 0;
    slot.body.popAt = 0;
    slot.body.deadPop = false;
    slot.body.deadPulse = 0;
    slot.metrics.hp = baseHp;
    slot.metrics.maxHp = baseHp;
    slot.metrics.charge = 0;
    slot.metrics.fireT = 0;
    slot.metrics.stillTimer = 0;
    slot.metrics.prevStill = false;
    slot.metrics.aimAngle = -Math.PI * 0.5;
    slot.metrics.aimHasTarget = false;
    slot.upg = {};
    if (!slot.timers) slot.timers = {
      barrierPulseTimer: 0, slipCooldown: 0,
      absorbComboCount: 0, absorbComboTimer: 0,
      chainMagnetTimer: 0, echoCounter: 0,
      vampiricRestoresThisRoom: 0, killSustainHealedThisRoom: 0,
      colossusShockwaveCd: 0, volatileOrbGlobalCooldown: 0,
    };
    slot.timers.barrierPulseTimer = 0;
    slot.timers.slipCooldown = 0;
    slot.timers.absorbComboCount = 0;
    slot.timers.absorbComboTimer = 0;
    slot.timers.chainMagnetTimer = 0;
    slot.timers.echoCounter = 0;
    slot.timers.vampiricRestoresThisRoom = 0;
    slot.timers.killSustainHealedThisRoom = 0;
    slot.timers.colossusShockwaveCd = 0;
    slot.timers.volatileOrbGlobalCooldown = 0;
    slot.shields.length = 0;
    slot.orbState.fireTimers.length = 0;
    slot.orbState.cooldowns.length = 0;
  }
  state.bullets.length = 0;
  state.enemies.length = 0;
  state.run.roomIndex = 0;
  state.run.roomPhase = 'intro';
  state.run.roomTimer = 0;
  state.run.score = 0;
  state.run.kills = 0;
  state.run.scoreBreakdown.kills = 0;
  state.run.scoreBreakdown.overkill = 0;
  state.run.scoreBreakdown.rooms = 0;
  state.run.scoreBreakdown.bonus = 0;
  state.run.gameOver = false;
  state.run.paused = false;
  state.run.pendingBoonQueue.length = 0;
  state.run.boonHistory.length = 0;
  state.run.legendaryRejectedIds.length = 0;
  state.run.legendaryRoomsSinceReject = {};
  state.nextEnemyId = 1;
  state.nextBulletId = 1;
  state.effectQueue.length = 0;
}
