// R0.4-A: Room state machine step — intro/spawning/fighting/clear transitions.
//
// Mirrors the room-state-machine block in script.js update() (lines 5711-5828),
// but routes all side-effects through the effectQueue rather than DOM/audio/renderer.
// The pure helper functions live in src/core/roomRuntime.js; this module calls
// them and mutates state.run fields accordingly.

import {
  advanceRoomIntroPhase,
  getPendingWaveIntroIndex,
  pullWaveSpawnEntries,
  getPostSpawningPhase,
  shouldForceClearFromCombat,
  updateBossEscortRespawn,
  pullReinforcementSpawn,
  advanceClearPhase,
} from '../core/roomRuntime.js';
import { emit } from './effectQueue.js';

/**
 * Advance room state machine for one sim tick.
 * Side effects: spawns enemies by calling opts.spawnEnemy, emits room events
 * to effectQueue.
 *
 * @param {object} state - SimState
 * @param {number} dt - delta time in seconds
 * @param {object} opts
 * @param {function} opts.spawnEnemy - (type, isBoss, bossScale) => void — mutates state.enemies
 * @param {function} [opts.getBossEscortRespawnMs] - (roomIndex) => ms
 * @param {function} [opts.getReinforcementIntervalMs] - (roomIndex) => ms
 */
export function tickRoomState(state, dt, opts = {}) {
  if (!state || !state.run) return;

  const run = state.run;
  const dtMs = dt * 1000;
  const spawnEnemy = typeof opts.spawnEnemy === 'function' ? opts.spawnEnemy : null;
  const getBossEscortRespawnMs = typeof opts.getBossEscortRespawnMs === 'function'
    ? opts.getBossEscortRespawnMs
    : () => 8000;
  const getReinforcementIntervalMs = typeof opts.getReinforcementIntervalMs === 'function'
    ? opts.getReinforcementIntervalMs
    : () => 6000;

  // Track phase before any mutations so we can detect fight→clear transition.
  const phaseBefore = run.roomPhase;

  // Advance the room-level ms timer (shared across all phases).
  run.roomTimer = (run.roomTimer || 0) + dtMs;

  // ── Intro phase ──────────────────────────────────────────────────────────
  if (run.roomPhase === 'intro') {
    const introStep = advanceRoomIntroPhase({
      roomPhase: run.roomPhase,
      roomIntroTimer: run.roomIntroTimer || 0,
      dtMs,
    });
    run.roomPhase = introStep.roomPhase;
    run.roomIntroTimer = introStep.roomIntroTimer;
    if (introStep.shouldShowGo) {
      emit(state, 'roomIntro.go', {});
    }
    if (introStep.shouldHideIntro) {
      emit(state, 'roomIntro.hide', {});
    }
  }

  // ── Wave intro banner ─────────────────────────────────────────────────────
  const pendingWaveIntroIndex = getPendingWaveIntroIndex({
    roomPhase: run.roomPhase,
    enemiesCount: Array.isArray(state.enemies) ? state.enemies.length : 0,
    spawnQueue: run.spawnQueue || [],
    activeWaveIndex: run.activeWaveIndex || 0,
  });
  if (pendingWaveIntroIndex !== null) {
    emit(state, 'waveIntro', { waveIndex: pendingWaveIntroIndex });
  }

  // ── Spawning phase — pull wave entries ───────────────────────────────────
  if (run.roomPhase === 'spawning') {
    const spawnResult = pullWaveSpawnEntries({
      spawnQueue: run.spawnQueue || [],
      activeWaveIndex: run.activeWaveIndex || 0,
      roomTimer: run.roomTimer,
      maxOnScreen: run.currentRoomMaxOnScreen != null ? run.currentRoomMaxOnScreen : 12,
      enemiesCount: Array.isArray(state.enemies) ? state.enemies.length : 0,
    });

    // Update spawnQueue in place (pure function returns a new array).
    if (Array.isArray(run.spawnQueue)) {
      run.spawnQueue.length = 0;
      run.spawnQueue.push(...spawnResult.remainingQueue);
    } else {
      run.spawnQueue = spawnResult.remainingQueue;
    }

    for (const entry of spawnResult.spawnEntries) {
      if (spawnEnemy) spawnEnemy(entry.t, entry.isBoss, entry.bossScale || 1);
    }

    const postSpawningPhase = getPostSpawningPhase({
      spawnQueueLen: run.spawnQueue.length,
      enemiesCount: Array.isArray(state.enemies) ? state.enemies.length : 0,
    });
    if (postSpawningPhase === 'fighting') {
      run.roomPhase = 'fighting';
    } else if (postSpawningPhase === 'clear') {
      run.roomPhase = 'clear';
      run.roomClearTimer = 0;
    }
  }

  // ── Force-clear check (enemies all gone while fighting/spawning) ──────────
  if (shouldForceClearFromCombat({
    roomPhase: run.roomPhase,
    enemiesCount: Array.isArray(state.enemies) ? state.enemies.length : 0,
    spawnQueueLen: Array.isArray(run.spawnQueue) ? run.spawnQueue.length : 0,
  })) {
    run.roomPhase = 'clear';
    run.roomClearTimer = 0;
  }

  // ── Fighting/spawning — boss escort + reinforcements ─────────────────────
  if (run.roomPhase === 'fighting' || run.roomPhase === 'spawning') {
    // Boss escort respawn trickle
    if (run.currentRoomIsBoss && run.bossAlive) {
      const escortAlive = Array.isArray(state.enemies)
        ? state.enemies.filter(e => !e.isBoss).length
        : 0;
      const escortResult = updateBossEscortRespawn({
        escortAlive,
        escortMaxCount: run.escortMaxCount || 0,
        escortRespawnTimer: run.escortRespawnTimer || 0,
        dtMs,
        respawnMs: getBossEscortRespawnMs(run.roomIndex || 0),
      });
      run.escortRespawnTimer = escortResult.escortRespawnTimer;
      if (escortResult.shouldSpawnEscort && spawnEnemy) {
        spawnEnemy(run.escortType);
      }
    }

    // Reinforcement trickle for non-boss rooms
    const reinforceResult = pullReinforcementSpawn({
      isBossRoom: run.currentRoomIsBoss || false,
      spawnQueue: run.spawnQueue || [],
      activeWaveIndex: run.activeWaveIndex || 0,
      enemiesCount: Array.isArray(state.enemies) ? state.enemies.length : 0,
      maxOnScreen: run.currentRoomMaxOnScreen != null ? run.currentRoomMaxOnScreen : 12,
      reinforceTimer: run.reinforceTimer || 0,
      dtMs,
      intervalMs: getReinforcementIntervalMs(run.roomIndex || 0),
    });
    run.reinforceTimer = reinforceResult.reinforceTimer;
    if (Array.isArray(run.spawnQueue)) {
      run.spawnQueue.length = 0;
      run.spawnQueue.push(...reinforceResult.remainingQueue);
    } else {
      run.spawnQueue = reinforceResult.remainingQueue;
    }
    if (reinforceResult.spawnEntry && spawnEnemy) {
      const entry = reinforceResult.spawnEntry;
      spawnEnemy(entry.t, entry.isBoss, entry.bossScale || 1);
    }
  }

  // ── Clear phase — reward delay countdown ─────────────────────────────────
  const clearStep = advanceClearPhase({
    roomPhase: run.roomPhase,
    roomClearTimer: run.roomClearTimer || 0,
    dtMs,
    rewardDelayMs: 1000,
  });
  run.roomPhase = clearStep.roomPhase;
  run.roomClearTimer = clearStep.roomClearTimer;
  if (clearStep.shouldShowUpgrades) {
    emit(state, 'showUpgrades', {});
  }

  // P5: emit roomClear when phase first transitions to 'clear' this tick.
  // dispatchSimEffects handles this on the guest to fire bullet-clear, boon
  // hooks, progression, and UI — the host's update() path (finalizeRoomClearState)
  // handles the same on the host, guarded by isCoopGuest() in the dispatcher.
  if (run.roomPhase === 'clear' && phaseBefore !== 'clear') {
    emit(state, 'roomClear', { roomIndex: run.roomIndex || 0 });
  }
}
