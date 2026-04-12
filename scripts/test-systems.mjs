import assert from 'node:assert/strict';
import {
  getKillSustainCapForRoom,
  applyKillSustainHeal,
} from '../src/systems/sustain.js';
import {
  computeKillScore,
  computeFiveRoomCheckpointBonus,
} from '../src/systems/scoring.js';
import { computeProjectileHitDamage } from '../src/systems/damage.js';
import {
  weightedPick,
  generateWeightedWave,
  buildSpawnQueue,
} from '../src/systems/spawnBudget.js';
import {
  createLeaderboardSyncState,
  beginLeaderboardSync,
  applyLeaderboardSyncSuccess,
  applyLeaderboardSyncFailure,
  forceLocalLeaderboardFallback,
} from '../src/platform/leaderboardController.js';
import {
  sanitizePlayerName,
  parseLocalLeaderboardRows,
  upsertLocalLeaderboardEntry,
  buildLocalScoreEntry,
} from '../src/platform/leaderboardLocal.js';
import { buildGameLoopCrashReport, saveRunCrashReport } from '../src/platform/diagnostics.js';
import {
  getRoomDef,
  getRoomMaxOnScreen,
  getReinforcementIntervalMs,
  getBossEscortRespawnMs,
} from '../src/core/roomFlow.js';
import {
  advanceRoomIntroPhase,
  getPendingWaveIntroIndex,
  pullWaveSpawnEntries,
  getPostSpawningPhase,
  shouldForceClearFromCombat,
  updateBossEscortRespawn,
  pullReinforcementSpawn,
  advanceClearPhase,
} from '../src/core/roomRuntime.js';
import {
  createRunTelemetry,
  createRoomTelemetry,
  buildRunTelemetryPayload,
} from '../src/systems/telemetry.js';
import { applyDamagelessRoomProgression } from '../src/systems/progression.js';
import { orderBoonsForDisplay } from '../src/ui/boonsPanel.js';
import { buildPatchNoteCardHtml } from '../src/ui/patchNotes.js';
import { syncLeaderboardStatusBadge, syncLeaderboardToggleStates } from '../src/ui/leaderboard.js';

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

test('kill sustain cap scales by room and respects max', () => {
  const config = { baseHealCap: 14, perRoomHealCap: 0.22, maxHealCap: 34 };
  assert.equal(getKillSustainCapForRoom(0, config), 14);
  assert.equal(getKillSustainCapForRoom(10, config), 16);
  assert.equal(getKillSustainCapForRoom(200, config), 34);
});

test('applyKillSustainHeal enforces remaining room cap', () => {
  let hp = 80;
  const maxHp = 200;
  const healPlayer = (amount) => {
    const before = hp;
    hp = Math.min(maxHp, hp + amount);
    return hp - before;
  };
  const config = { baseHealCap: 14, perRoomHealCap: 0.22, maxHealCap: 34 };
  let healedThisRoom = 13;

  const first = applyKillSustainHeal({
    amount: 10,
    roomIndex: 0,
    healedThisRoom,
    healPlayer,
    source: 'vampiric',
    config,
  });
  assert.equal(first.applied, 1);
  assert.equal(first.healedThisRoom, 14);

  const second = applyKillSustainHeal({
    amount: 10,
    roomIndex: 0,
    healedThisRoom: first.healedThisRoom,
    healPlayer,
    source: 'vampiric',
    config,
  });
  assert.equal(second.applied, 0);
  assert.equal(second.healedThisRoom, 14);
});

test('computeKillScore doubles crit kills only', () => {
  assert.equal(computeKillScore(120, false), 120);
  assert.equal(computeKillScore(120, true), 240);
});

test('computeFiveRoomCheckpointBonus returns expected value for clean block', () => {
  const rooms = [
    { room: 1, end: 'clear', clearMs: 10000, hpLost: 0, damageless: true },
    { room: 2, end: 'clear', clearMs: 10000, hpLost: 0, damageless: true },
    { room: 3, end: 'clear', clearMs: 10000, hpLost: 0, damageless: true },
    { room: 4, end: 'clear', clearMs: 10000, hpLost: 0, damageless: true },
    { room: 5, end: 'clear', clearMs: 10000, hpLost: 0, damageless: true },
  ];
  assert.equal(computeFiveRoomCheckpointBonus(rooms), 1121);
});

test('computeFiveRoomCheckpointBonus returns zero for non-clear block', () => {
  const rooms = [
    { room: 1, end: 'clear', clearMs: 10000, hpLost: 0, damageless: true },
    { room: 2, end: 'clear', clearMs: 10000, hpLost: 0, damageless: true },
    { room: 3, end: 'death', clearMs: 10000, hpLost: 20, damageless: false },
    { room: 4, end: 'clear', clearMs: 10000, hpLost: 0, damageless: true },
    { room: 5, end: 'clear', clearMs: 10000, hpLost: 0, damageless: true },
  ];
  assert.equal(computeFiveRoomCheckpointBonus(rooms), 0);
});

test('computeProjectileHitDamage matches baseline room scaling', () => {
  assert.equal(computeProjectileHitDamage({ roomIndex: 0 }), 17);
  assert.equal(computeProjectileHitDamage({ roomIndex: 10 }), 27);
  assert.equal(computeProjectileHitDamage({ roomIndex: 50 }), 65);
});

test('computeProjectileHitDamage applies external multipliers', () => {
  const damage = computeProjectileHitDamage({
    roomIndex: 20,
    bossDamageMultiplier: 2,
    damageTakenMultiplier: 1.18,
    lateBloomDamageTakenMultiplier: 0.9,
    multiplier: 0.05,
  });
  assert.equal(damage, 4);
});

test('weightedPick uses candidate weights', () => {
  const candidates = [
    { type: 'a', weight: 1 },
    { type: 'b', weight: 3 },
  ];
  assert.equal(weightedPick(candidates, () => 0.0), 'a');
  assert.equal(weightedPick(candidates, () => 0.99), 'b');
});

test('generateWeightedWave keeps non-empty waves and fallback pressure', () => {
  const enemyTypes = {
    chaser: { unlockRoom: 0, spawnValue: 5, ammoPressure: 0, isSiphon: false },
    siphon: { unlockRoom: 0, spawnValue: 2, ammoPressure: 0, isSiphon: true },
    sniper: { unlockRoom: 99, spawnValue: 4, ammoPressure: 1, isSiphon: false },
    disruptor: { unlockRoom: 99, spawnValue: 4, ammoPressure: 1, isSiphon: false },
    triangle: { unlockRoom: 99, spawnValue: 4, ammoPressure: 0, isSiphon: false },
    purple_chaser: { unlockRoom: 99, spawnValue: 4, ammoPressure: 1, isSiphon: false },
    purple_disruptor: { unlockRoom: 99, spawnValue: 4, ammoPressure: 1, isSiphon: false },
    zoner: { unlockRoom: 99, spawnValue: 4, ammoPressure: 1, isSiphon: false },
  };
  const wave = generateWeightedWave(0, enemyTypes, () => 0.0);
  assert.ok(Array.isArray(wave) && wave.length > 0);
  const byType = Object.fromEntries(wave.map((entry) => [entry.t, entry.n]));
  assert.ok(byType.chaser >= 1);
});

test('buildSpawnQueue preserves wave order and spawn timing', () => {
  const queue = buildSpawnQueue({
    waves: [
      [{ t: 'chaser', n: 2, d: 100 }],
      [{ t: 'sniper', n: 1, d: 0 }],
    ],
  });
  assert.equal(queue.length, 3);
  assert.equal(queue[0].spawnAt, 0);
  assert.equal(queue[1].spawnAt, 100);
  assert.equal(queue[2].spawnAt, 1900);
  assert.equal(queue[2].waveIndex, 1);
});

test('leaderboard sync state transitions are deterministic', () => {
  const state = createLeaderboardSyncState();
  assert.equal(state.statusMode, 'local');
  assert.equal(state.statusText, 'LOCAL ONLY');

  const requestId = beginLeaderboardSync(state);
  assert.equal(requestId, 1);
  assert.equal(state.statusMode, 'syncing');
  assert.equal(state.useRemoteRows, false);

  const staleAccepted = applyLeaderboardSyncSuccess(state, 999, [{ name: 'A' }]);
  assert.equal(staleAccepted, false);
  assert.equal(state.statusMode, 'syncing');

  const accepted = applyLeaderboardSyncSuccess(state, 1, [{ name: 'A' }]);
  assert.equal(accepted, true);
  assert.equal(state.statusMode, 'synced');
  assert.equal(state.statusText, 'SUPABASE LIVE');
  assert.equal(state.useRemoteRows, true);
  assert.equal(state.remoteRows.length, 1);

  forceLocalLeaderboardFallback(state);
  assert.equal(state.statusMode, 'local');
  assert.equal(state.statusText, 'LOCAL FALLBACK');
  assert.equal(state.useRemoteRows, false);
});

test('leaderboard failure transition ignores stale request ids', () => {
  const state = createLeaderboardSyncState();
  const requestId = beginLeaderboardSync(state);
  assert.equal(requestId, 1);
  const staleFailure = applyLeaderboardSyncFailure(state, 999);
  assert.equal(staleFailure, false);
  assert.equal(state.statusMode, 'syncing');
  const appliedFailure = applyLeaderboardSyncFailure(state, 1);
  assert.equal(appliedFailure, true);
  assert.equal(state.statusMode, 'local');
  assert.equal(state.statusText, 'LOCAL FALLBACK');
});

test('leaderboard local helpers sanitize, parse, and upsert rows', () => {
  assert.equal(sanitizePlayerName('a!b@c# d$%^&*()'), 'ABC D');

  const parsed = parseLocalLeaderboardRows([
    { name: 'A', score: 100, ts: 10, version: '1.0.0' },
    { name: 'B', score: 300, ts: 30, version: '1.0.0' },
    { name: 'C', score: 200, ts: 20, version: '1.0.1' },
    { name: 'D', score: Number.NaN, ts: 40, version: '1.0.0' },
  ], { gameVersion: '1.0.0', limit: 10 });
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].name, 'B');
  assert.equal(parsed[1].name, 'A');

  const next = upsertLocalLeaderboardEntry(parsed, { name: 'E', score: 250, ts: 50, version: '1.0.0' }, 2);
  assert.equal(next.length, 2);
  assert.equal(next[0].name, 'B');
  assert.equal(next[1].name, 'E');
});

test('buildLocalScoreEntry keeps leaderboard payload contract', () => {
  const entry = buildLocalScoreEntry({
    playerName: 'RUNNER',
    score: 4200,
    room: 25,
    runTimeMs: 123456,
    gameVersion: '1.0.0',
    color: 'green',
    boonOrder: 'Rapid Fire,Shield',
    boons: [{ name: 'Rapid Fire' }],
    telemetry: { summary: { totalKills: 99 } },
    ts: 999,
  });
  assert.equal(entry.name, 'RUNNER');
  assert.equal(entry.version, '1.0.0');
  assert.equal(entry.room, 25);
  assert.equal(entry.runTimeMs, 123456);
  assert.equal(entry.color, 'green');
  assert.equal(entry.boonOrder, 'Rapid Fire,Shield');
  assert.equal(entry.boons.order, 'Rapid Fire,Shield');
  assert.equal(entry.boons.picks.length, 1);
  assert.equal(entry.boons.telemetry.summary.totalKills, 99);
  assert.equal(entry.ts, 999);
});

test('diagnostics builder produces crash report envelope', () => {
  const report = buildGameLoopCrashReport({
    error: new Error('boom'),
    entry: { name: 'RUNNER', score: 1000 },
    bulletsCount: 12,
    enemiesCount: 3,
    particlesCount: 44,
    at: 123,
  });
  assert.equal(report.type, 'game-loop-crash');
  assert.equal(report.crash.message, 'boom');
  assert.equal(report.crash.at, 123);
  assert.equal(report.entry.name, 'RUNNER');
  assert.equal(report.counts.bullets, 12);
  assert.equal(report.counts.enemies, 3);
  assert.equal(report.counts.particles, 44);
});

test('diagnostics save returns false without browser storage', () => {
  assert.equal(saveRunCrashReport({ type: 'x' }), false);
});

test('orderBoonsForDisplay respects recorded boon pick order', () => {
  const ordered = orderBoonsForDisplay([
    { name: 'Shield Burst' },
    { name: 'Rapid Fire' },
    { name: 'Critical Hit' },
  ], 'Rapid Fire,Critical Hit');
  assert.equal(ordered[0].name, 'Rapid Fire');
  assert.equal(ordered[1].name, 'Critical Hit');
  assert.equal(ordered[2].name, 'Shield Burst');
});

test('buildPatchNoteCardHtml includes versioned summary and highlights markup', () => {
  const html = buildPatchNoteCardHtml({
    version: '1.2.3',
    label: 'BALANCE PASS',
    summary: ['One', 'Two'],
    highlights: ['A', 'B'],
  });
  assert.ok(html.includes('v1.2.3'));
  assert.ok(html.includes('BALANCE PASS'));
  assert.ok(html.includes('patch-note-paragraph'));
  assert.ok(html.includes('patch-note-highlight'));
});

test('leaderboard ui helpers sync badge class and toggle state', () => {
  const classes = new Set();
  const statusEl = {
    textContent: '',
    classList: {
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      add: (name) => classes.add(name),
    },
  };
  syncLeaderboardStatusBadge(statusEl, 'synced', 'SUPABASE LIVE');
  assert.equal(statusEl.textContent, 'SUPABASE LIVE');
  assert.ok(classes.has('synced'));
  assert.equal(classes.has('local'), false);

  const periodBtnA = { dataset: { lbPeriod: 'daily' }, classList: { toggle: (_, on) => { periodBtnA.active = !!on; } }, active: false };
  const periodBtnB = { dataset: { lbPeriod: 'all' }, classList: { toggle: (_, on) => { periodBtnB.active = !!on; } }, active: false };
  const scopeBtnA = { dataset: { lbScope: 'everyone' }, classList: { toggle: (_, on) => { scopeBtnA.active = !!on; } }, active: false };
  const scopeBtnB = { dataset: { lbScope: 'personal' }, classList: { toggle: (_, on) => { scopeBtnB.active = !!on; } }, active: false };
  syncLeaderboardToggleStates([periodBtnA, periodBtnB], [scopeBtnA, scopeBtnB], 'all', 'personal');
  assert.equal(periodBtnA.active, false);
  assert.equal(periodBtnB.active, true);
  assert.equal(scopeBtnA.active, false);
  assert.equal(scopeBtnB.active, true);
});

test('room flow helpers keep threshold values', () => {
  assert.equal(getRoomMaxOnScreen(0, true), 99);
  assert.equal(getRoomMaxOnScreen(25, false), 12);
  assert.equal(getRoomMaxOnScreen(85, false), 18);
  assert.equal(getReinforcementIntervalMs(0), 800);
  assert.equal(getReinforcementIntervalMs(120), 360);
  assert.equal(getBossEscortRespawnMs(0), 7000);
  assert.equal(getBossEscortRespawnMs(160), 2800);
});

test('room flow generates non-boss and room-100 special boss layouts', () => {
  const roomScripts = ['ARRIVAL', 'PATROL', 'RUSH'];
  const bossRooms = {
    9: { name: 'MEGA ZONER', bossType: 'zoner', escortType: 'chaser', escortCount: 1, chaos: 0.24 },
    19: { name: 'MEGA TRIANGLE', bossType: 'triangle', escortType: 'rusher', escortCount: 2, chaos: 0.4 },
    29: { name: 'MEGA DISRUPTOR', bossType: 'purple_disruptor', escortType: 'purple_chaser', escortCount: 2, chaos: 0.5 },
    39: { name: 'MEGA ZONER II', bossType: 'orange_zoner', escortType: 'sniper', escortCount: 2, chaos: 0.55 },
  };
  const generatedWave = [{ t: 'chaser', n: 2, d: 0 }];
  const nonBoss = getRoomDef(3, {
    roomNames: roomScripts,
    bossRooms,
    generateWeightedWave: () => generatedWave,
  });
  assert.equal(nonBoss.isBossRoom, undefined);
  assert.equal(nonBoss.waves[0], generatedWave);

  const room100 = getRoomDef(99, {
    roomNames: roomScripts,
    bossRooms,
    generateWeightedWave: () => generatedWave,
  });
  assert.equal(room100.isBossRoom, true);
  assert.equal(room100.name, 'DOUBLE EXECUTION');
  assert.equal(room100.bossDamageMultiplier, 2);
  const bossEntries = room100.waves[0].filter((entry) => entry.isBoss);
  assert.equal(bossEntries.length, 2);
  assert.equal(bossEntries[0].bossScale, 2);
  assert.equal(bossEntries[1].bossScale, 2);
});

test('room runtime intro and clear phase transitions', () => {
  const introStep1 = advanceRoomIntroPhase({ roomPhase: 'intro', roomIntroTimer: 900, dtMs: 200 });
  assert.equal(introStep1.roomPhase, 'intro');
  assert.equal(introStep1.shouldShowGo, true);
  assert.equal(introStep1.shouldHideIntro, false);

  const introStep2 = advanceRoomIntroPhase({ roomPhase: 'intro', roomIntroTimer: 1500, dtMs: 200 });
  assert.equal(introStep2.roomPhase, 'spawning');
  assert.equal(introStep2.shouldHideIntro, true);

  const clearStep = advanceClearPhase({ roomPhase: 'clear', roomClearTimer: 900, dtMs: 200, rewardDelayMs: 1000 });
  assert.equal(clearStep.roomPhase, 'reward');
  assert.equal(clearStep.shouldShowUpgrades, true);
});

test('room runtime wave/queue helpers keep phase logic stable', () => {
  const pendingWave = getPendingWaveIntroIndex({
    roomPhase: 'spawning',
    enemiesCount: 0,
    spawnQueue: [{ waveIndex: 2, spawnAt: 1000 }],
    activeWaveIndex: 1,
  });
  assert.equal(pendingWave, 2);

  const pullResult = pullWaveSpawnEntries({
    spawnQueue: [
      { t: 'chaser', waveIndex: 1, spawnAt: 100 },
      { t: 'sniper', waveIndex: 1, spawnAt: 200 },
      { t: 'rusher', waveIndex: 2, spawnAt: 100 },
    ],
    activeWaveIndex: 1,
    roomTimer: 250,
    maxOnScreen: 2,
    enemiesCount: 0,
  });
  assert.equal(pullResult.spawnEntries.length, 2);
  assert.equal(pullResult.remainingQueue.length, 1);

  assert.equal(getPostSpawningPhase({ spawnQueueLen: 0, enemiesCount: 2 }), 'fighting');
  assert.equal(getPostSpawningPhase({ spawnQueueLen: 0, enemiesCount: 0 }), 'clear');
  assert.equal(getPostSpawningPhase({ spawnQueueLen: 1, enemiesCount: 0 }), null);

  assert.equal(shouldForceClearFromCombat({ roomPhase: 'fighting', enemiesCount: 0, spawnQueueLen: 0 }), true);
  assert.equal(shouldForceClearFromCombat({ roomPhase: 'spawning', enemiesCount: 1, spawnQueueLen: 0 }), false);
});

test('room runtime escort and reinforcement timing helpers are deterministic', () => {
  const escort = updateBossEscortRespawn({
    escortAlive: 0,
    escortMaxCount: 2,
    escortRespawnTimer: 6000,
    dtMs: 1200,
    respawnMs: 7000,
  });
  assert.equal(escort.shouldSpawnEscort, true);
  assert.equal(escort.escortRespawnTimer, 0);

  const reinforce = pullReinforcementSpawn({
    isBossRoom: false,
    spawnQueue: [{ t: 'chaser', waveIndex: 0, spawnAt: 0 }],
    activeWaveIndex: 0,
    enemiesCount: 1,
    maxOnScreen: 5,
    reinforceTimer: 790,
    dtMs: 20,
    intervalMs: 800,
  });
  assert.equal(reinforce.spawnEntry.t, 'chaser');
  assert.equal(reinforce.reinforceTimer, 0);
  assert.equal(reinforce.remainingQueue.length, 0);
});

test('telemetry builders create baseline structures', () => {
  const run = createRunTelemetry({
    build: '1.0.0',
    playerColor: 'cyan',
    viewportMode: 'tight',
    canvasWidth: 400,
    canvasHeight: 600,
  });
  assert.equal(run.meta.build, '1.0.0');
  assert.equal(run.meta.playerColor, 'cyan');
  assert.equal(run.rooms.length, 0);
  assert.equal(run.snapshots.length, 0);

  const room = createRoomTelemetry({
    roomNumber: 10,
    roomDef: { name: 'MEGA ZONER', isBossRoom: true },
    viewportMode: 'tight',
    canvasWidth: 400,
    canvasHeight: 600,
    hpStart: 200,
  });
  assert.equal(room.room, 10);
  assert.equal(room.name, 'MEGA ZONER');
  assert.equal(room.boss, true);
  assert.equal(room.hpStart, 200);
  assert.equal(room.end, 'active');
  assert.equal(room.heal.vampiric, 0);
  assert.equal(room.charge.wasted, 0);
  assert.equal(room.offense.shotsFired, 0);
});

test('buildRunTelemetryPayload includes active snapshot and summary totals', () => {
  const runTelemetry = {
    meta: {
      build: '1.0.0',
      playerColor: 'blue',
      viewportMode: 'compact',
      canvasWidth: 398,
      canvasHeight: 533,
    },
    snapshots: [{ room: 1 }],
    rooms: [
      {
        room: 1,
        end: 'clear',
        hpLost: 12.1,
        kills: 3,
        heal: { roomRegen: 5 },
        charge: { kinetic: 2.55, wasted: 1.2 },
        offense: { shotsFired: 9, chargeSpent: 9, outputKills: 3, orbitKills: 1 },
        control: { movingNoFireMs: 100, firingReadyMs: 80, fullChargeMs: 20 },
        safety: { shieldBlocks: 2, phaseDashProcs: 1, mirrorTideProcs: 0 },
        pressure: { dangerBulletsSpawned: 25 },
      },
    ],
  };
  const payload = buildRunTelemetryPayload({
    runTelemetry,
    currentRoomTelemetry: {
      room: 2,
      end: 'active',
      hpLost: 3,
      kills: 4,
      damageless: true,
      heal: { vampiric: 8 },
      charge: { kinetic: 0.33, wasted: 0.75 },
      offense: { shotsFired: 5, chargeSpent: 5, outputKills: 4, orbitKills: 0 },
      control: { movingNoFireMs: 40, firingReadyMs: 30, fullChargeMs: 10 },
      safety: { shieldBlocks: 1, phaseDashProcs: 0, mirrorTideProcs: 1 },
      pressure: { dangerBulletsSpawned: 10 },
    },
    hp: 87.126,
    tookDamageThisRoom: true,
    roomTimer: 1234.4,
    roomIndex: 9,
    score: 4200,
    roundTelemetryValue: (value) => Math.round(value * 100) / 100,
  });

  assert.equal(payload.meta.finalRoom, 10);
  assert.equal(payload.meta.finalScore, 4200);
  assert.equal(payload.rooms.length, 2);
  assert.equal(payload.rooms[1].end, 'snapshot');
  assert.equal(payload.rooms[1].clearMs, 1234);
  assert.equal(payload.rooms[1].hpEnd, 87.13);
  assert.equal(payload.rooms[1].damageless, false);
  assert.equal(payload.summary.roomsTracked, 2);
  assert.equal(payload.summary.roomsCleared, 1);
  assert.equal(payload.summary.totalHpLost, 15.1);
  assert.equal(payload.summary.totalKills, 7);
  assert.equal(payload.summary.totalDangerBulletsSpawned, 35);
  assert.equal(payload.summary.totalShieldBlocks, 3);
  assert.equal(payload.summary.totalPhaseDashProcs, 1);
  assert.equal(payload.summary.totalMirrorTideProcs, 1);
  assert.equal(payload.summary.totalShotsFired, 14);
  assert.equal(payload.summary.totalChargeSpent, 14);
  assert.equal(payload.summary.totalChargeWasted, 1.95);
  assert.equal(payload.summary.totalOutputKills, 7);
  assert.equal(payload.summary.totalOrbitKills, 1);
  assert.equal(payload.summary.totalMovingNoFireMs, 140);
  assert.equal(payload.summary.totalFiringReadyMs, 110);
  assert.equal(payload.summary.totalFullChargeMs, 30);
  assert.equal(payload.summary.heal.roomRegen, 5);
  assert.equal(payload.summary.heal.vampiric, 8);
  assert.equal(payload.summary.charge.kinetic, 2.88);
  assert.equal(payload.summary.charge.wasted, 1.95);
});

test('buildRunTelemetryPayload returns null without run state', () => {
  const payload = buildRunTelemetryPayload({
    runTelemetry: null,
    currentRoomTelemetry: null,
    hp: 100,
    tookDamageThisRoom: false,
    roomTimer: 0,
    roomIndex: 0,
    score: 0,
    roundTelemetryValue: (value) => value,
  });
  assert.equal(payload, null);
});

test('applyDamagelessRoomProgression handles streak and reset behavior', () => {
  const tookHit = applyDamagelessRoomProgression({
    tookDamageThisRoom: true,
    damagelessRooms: 2,
    boonRerolls: 1,
  });
  assert.equal(tookHit.damagelessRooms, 0);
  assert.equal(tookHit.boonRerolls, 1);
  assert.equal(tookHit.awardedReroll, false);

  const streaking = applyDamagelessRoomProgression({
    tookDamageThisRoom: false,
    damagelessRooms: 1,
    boonRerolls: 1,
  });
  assert.equal(streaking.damagelessRooms, 2);
  assert.equal(streaking.boonRerolls, 1);
  assert.equal(streaking.awardedReroll, false);

  const completed = applyDamagelessRoomProgression({
    tookDamageThisRoom: false,
    damagelessRooms: 2,
    boonRerolls: 1,
  });
  assert.equal(completed.damagelessRooms, 0);
  assert.equal(completed.boonRerolls, 2);
  assert.equal(completed.awardedReroll, true);

  const capped = applyDamagelessRoomProgression({
    tookDamageThisRoom: false,
    damagelessRooms: 2,
    boonRerolls: 3,
  });
  assert.equal(capped.damagelessRooms, 0);
  assert.equal(capped.boonRerolls, 3);
  assert.equal(capped.awardedReroll, true);
});

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode);
}
