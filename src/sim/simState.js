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
    slot.metrics.hp = baseHp;
    slot.metrics.maxHp = baseHp;
    slot.metrics.charge = 0;
    slot.metrics.fireT = 0;
    slot.metrics.stillTimer = 0;
    slot.metrics.prevStill = false;
    slot.metrics.aimAngle = -Math.PI * 0.5;
    slot.metrics.aimHasTarget = false;
    slot.upg = {};
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
  state.nextEnemyId = 1;
  state.nextBulletId = 1;
  state.effectQueue.length = 0;
}
