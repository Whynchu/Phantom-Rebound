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
  shouldExpireOutputBullet,
  shouldRemoveBulletOutOfBounds,
  resolveDangerBounceState,
  resolveOutputBounceState,
} from '../src/systems/bulletRuntime.js';
import {
  resolveOutputEnemyHit,
  resolveSanguineBurst,
} from '../src/systems/outputHit.js';
import {
  resolveEnemyKillEffects,
  resolveOrbitKillEffects,
  applyKillUpgradeState,
  buildKillRewardActions,
} from '../src/systems/killRewards.js';
import {
  resolveLifelineRecovery,
  resolveDangerPlayerHit,
  resolveSlipstreamNearMiss,
  resolveRusherContactHit,
  convertNearbyDangerBulletsToGrey,
  buildLastStandBurstSpec,
  resolvePostHitAftermath,
} from '../src/systems/dangerHit.js';
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
  refreshLeaderboardSync,
  shouldRefreshLeaderboardAfterSubmit,
  submitLeaderboardEntryRemote,
} from '../src/platform/leaderboardRuntime.js';
import {
  getRoomDef,
  getRoomMaxOnScreen,
  getReinforcementIntervalMs,
  getBossEscortRespawnMs,
} from '../src/core/roomFlow.js';
import {
  applyEliteBulletStage,
  getDoubleBounceBulletPalette,
  spawnAimedEnemyBullet,
  spawnRadialEnemyBullet,
  spawnTriangleBurst,
  spawnEliteBullet,
  spawnEliteTriangleBurst,
} from '../src/entities/projectiles.js';
import {
  createOutputBullet,
  pushOutputBullet,
  pushGreyBullet,
  spawnGreyDrops,
  spawnSplitOutputBullets,
  spawnRadialOutputBurst,
} from '../src/entities/playerProjectiles.js';
import {
  stepSiphonEnemy,
  stepRusherEnemy,
  advanceRangedEnemyCombatState,
  stepEnemyCombatState,
  applyDisruptorPostFire,
  fireEnemyBurst,
  applyOrbitSphereContact,
} from '../src/entities/enemyRuntime.js';
import {
  createLaneOffsets,
  buildPlayerShotPlan,
  buildPlayerVolleySpecs,
} from '../src/entities/playerFire.js';
import {
  syncOrbRuntimeArrays,
  getOrbitSlotPosition,
  getShieldSlotPosition,
  tickShieldCooldowns,
  countReadyShields,
  advanceAegisBatteryTimer,
  buildAegisBatteryBoltSpec,
  buildMirrorShieldReflectionSpec,
  buildShieldBurstSpec,
  buildChargedOrbVolleyForSlot,
} from '../src/entities/defenseRuntime.js';
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
import { showGameOverScreen } from '../src/ui/gameOver.js';
import {
  revealAppShell,
  syncColorDrivenCopy,
  setMenuChromeVisible,
} from '../src/ui/shell.js';
import {
  showRoomClearOverlay,
  showBossDefeatedOverlay,
  showRoomIntroOverlay,
  hideRoomIntroOverlay,
} from '../src/ui/roomOverlays.js';
import {
  bindPatchNotesControls,
  bindLeaderboardControls,
  bindBoonsPanelControls,
  bindPopupClose,
} from '../src/ui/appChrome.js';
import {
  setPlayerNameState,
  bindNameInputs,
  bindSessionFlow,
} from '../src/ui/sessionFlow.js';
import { bindGestureGuards } from '../src/platform/gestureGuards.js';
import { setPlayerColor, getPlayerColor, getPlayerColorScheme } from '../src/data/colorScheme.js';

const pendingTests = [];

function test(name, fn) {
  try {
    const result = fn();
    if(result && typeof result.then === 'function') {
      pendingTests.push(
        result.then(() => {
          console.log(`PASS ${name}`);
        }).catch((error) => {
          console.error(`FAIL ${name}`);
          console.error(error);
          process.exitCode = 1;
        }),
      );
      return;
    }
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

test('bullet runtime helpers keep expiry and bounce transitions deterministic', () => {
  assert.equal(shouldExpireOutputBullet({ state: 'output', expireAt: 100 }, 100), true);
  assert.equal(shouldExpireOutputBullet({ state: 'danger', expireAt: 100 }, 100), false);
  assert.equal(shouldRemoveBulletOutOfBounds({ x: -11, y: 0 }, 100, 100), true);
  assert.equal(shouldRemoveBulletOutOfBounds({ x: 50, y: 50 }, 100, 100), false);

  const eliteBullet = { state: 'danger', eliteStage: 0, bounceStages: 2 };
  const eliteResult = resolveDangerBounceState(eliteBullet, 1000);
  assert.equal(eliteResult.kind, 'elite-stage');
  assert.equal(eliteResult.nextEliteStage, 1);

  const triangleBullet = { state: 'danger', isTriangle: true, wallBounces: 0 };
  const triangleResult = resolveDangerBounceState(triangleBullet, 1000);
  assert.equal(triangleResult.kind, 'triangle-burst');
  assert.equal(triangleBullet.wallBounces, 1);

  const budgetBullet = { state: 'danger', dangerBounceBudget: 1 };
  const budgetResult = resolveDangerBounceState(budgetBullet, 900);
  assert.equal(budgetResult.kind, 'convert-grey');
  assert.equal(budgetBullet.state, 'grey');
  assert.equal(budgetBullet.decayStart, 900);
  assert.equal(budgetBullet.dangerBounceBudget, 0);

  const doubleBounceBullet = { state: 'danger', doubleBounce: true, bounceCount: 0 };
  const doubleFirst = resolveDangerBounceState(doubleBounceBullet, 1000);
  assert.equal(doubleFirst.kind, 'double-bounce-continue');
  assert.equal(doubleBounceBullet.state, 'danger');
  const doubleSecond = resolveDangerBounceState(doubleBounceBullet, 1100);
  assert.equal(doubleSecond.kind, 'convert-grey');
  assert.equal(doubleBounceBullet.state, 'grey');

  const splitBullet = { bounceLeft: 2, hasSplit: false };
  const splitResult = resolveOutputBounceState(splitBullet, { splitShot: true, splitShotEvolved: true });
  assert.equal(splitResult.kind, 'split');
  assert.deepEqual(splitResult.splitDeltas, [-0.42, 0, 0.42]);
  assert.equal(splitBullet.bounceLeft, 1);
  assert.equal(splitBullet.hasSplit, true);

  const continueBullet = { bounceLeft: 1, hasSplit: true };
  const continueResult = resolveOutputBounceState(continueBullet, { splitShot: true, splitShotEvolved: false });
  assert.equal(continueResult.kind, 'continue');
  assert.equal(continueBullet.bounceLeft, 0);

  const removeResult = resolveOutputBounceState({ bounceLeft: 0 }, { splitShot: false });
  assert.equal(removeResult.kind, 'remove');
  assert.equal(removeResult.removeBullet, true);
});

test('output hit helpers keep damage, pierce, and reward cadence deterministic', () => {
  const hit = resolveOutputEnemyHit({
    bullet: {
      crit: true,
      dmg: 10,
      pierceLeft: 2,
      bloodPactHeals: 0,
      bloodPactHealCap: 2,
    },
    enemyHp: 40,
    hp: 20,
    maxHp: 100,
    upgrades: {
      deadManTrigger: true,
      finalForm: true,
      bloodPact: true,
      volatileRounds: true,
      volatileAllTargets: false,
    },
    critDamageFactor: 2.4,
    bloodPactBaseHealCap: 1,
  });
  assert.equal(hit.damage, 24);
  assert.equal(hit.enemyKilled, false);
  assert.equal(hit.deadManActive, false);
  assert.equal(hit.shouldBloodPactHeal, true);
  assert.equal(hit.nextBloodPactHeals, 1);
  assert.equal(hit.piercesAfterHit, true);
  assert.equal(hit.nextPierceLeft, 1);
  assert.equal(hit.shouldTriggerVolatile, false);
  assert.equal(hit.removeBullet, false);

  const deadManHit = resolveOutputEnemyHit({
    bullet: {
      crit: false,
      dmg: 8,
      pierceLeft: 0,
      bloodPactHeals: 0,
    },
    enemyHp: 25,
    hp: 10,
    maxHp: 100,
    upgrades: {
      deadManTrigger: true,
      finalForm: false,
      bloodPact: false,
      volatileRounds: true,
      volatileAllTargets: true,
    },
    critDamageFactor: 2.4,
    bloodPactBaseHealCap: 1,
  });
  assert.equal(deadManHit.deadManActive, true);
  assert.equal(deadManHit.damage, 16);
  assert.equal(deadManHit.piercesAfterHit, true);
  assert.equal(deadManHit.nextPierceLeft, 0);
  assert.equal(deadManHit.shouldTriggerVolatile, false);

  const volatileHit = resolveOutputEnemyHit({
    bullet: {
      crit: false,
      dmg: 5,
      pierceLeft: 1,
      bloodPactHeals: 1,
      bloodPactHealCap: 1,
    },
    enemyHp: 20,
    hp: 90,
    maxHp: 100,
    upgrades: {
      deadManTrigger: false,
      finalForm: false,
      bloodPact: true,
      volatileRounds: true,
      volatileAllTargets: false,
    },
    critDamageFactor: 2.4,
    bloodPactBaseHealCap: 1,
  });
  assert.equal(volatileHit.shouldBloodPactHeal, false);
  assert.equal(volatileHit.nextPierceLeft, 0);
  assert.equal(volatileHit.shouldTriggerVolatile, true);

  const removeHit = resolveOutputEnemyHit({
    bullet: { crit: false, dmg: 3, pierceLeft: 0 },
    enemyHp: 10,
    hp: 90,
    maxHp: 100,
    upgrades: {
      deadManTrigger: false,
      finalForm: false,
      bloodPact: false,
      volatileRounds: false,
      volatileAllTargets: false,
    },
    critDamageFactor: 2.4,
    bloodPactBaseHealCap: 1,
  });
  assert.equal(removeHit.removeBullet, true);

  const sanguineCharging = resolveSanguineBurst({
    enabled: true,
    currentKillCount: 2,
    rampageEvolved: false,
  });
  assert.equal(sanguineCharging.nextKillCount, 3);
  assert.equal(sanguineCharging.shouldBurst, false);

  const sanguineBurst = resolveSanguineBurst({
    enabled: true,
    currentKillCount: 7,
    rampageEvolved: false,
  });
  assert.equal(sanguineBurst.nextKillCount, 0);
  assert.equal(sanguineBurst.shouldBurst, true);
  assert.equal(sanguineBurst.burstCount, 6);

  const rampageBurst = resolveSanguineBurst({
    enabled: true,
    currentKillCount: 3,
    rampageEvolved: true,
  });
  assert.equal(rampageBurst.shouldBurst, true);
  assert.equal(rampageBurst.burstCount, 8);
});

test('kill reward helpers derive boss, sustain, and burst side effects deterministically', () => {
  const effects = resolveEnemyKillEffects({
    enemy: { isBoss: true },
    bullet: { isRing: true },
    upgrades: {
      escalation: true,
      escalationKills: 2,
      predatorKillStreak: 4,
      bloodRush: true,
      bloodRushStacks: 4,
      sanguineBurst: true,
      sanguineKillCount: 7,
      rampageEvolved: false,
      vampiric: true,
      bloodMoon: true,
      corona: true,
      finalForm: true,
      crimsonHarvest: true,
    },
    hp: 10,
    maxHp: 100,
    ts: 5000,
    vampiricHealPerKill: 4,
    vampiricChargePerKill: 0.25,
  });

  assert.equal(effects.bossCleared, true);
  assert.equal(effects.bossRewardHeal, 50);
  assert.equal(effects.vampiricHeal, 4);
  assert.equal(effects.vampiricCharge, 0.25);
  assert.equal(effects.bloodMoonHeal, 8);
  assert.equal(effects.coronaCharge, 1);
  assert.equal(effects.finalFormCharge, 0.5);
  assert.equal(effects.crimsonHarvestGreyDrops, 1);
  assert.equal(effects.bloodMoonGreyDrops, 3);
  assert.equal(effects.sanguineBurstCount, 6);
  assert.equal(effects.nextUpgradeState.escalationKills, 3);
  assert.equal(effects.nextUpgradeState.predatorKillStreak, 5);
  assert.equal(effects.nextUpgradeState.predatorKillStreakTime, 10000);
  assert.equal(effects.nextUpgradeState.bloodRushStacks, 5);
  assert.equal(effects.nextUpgradeState.bloodRushTimer, 8000);
  assert.equal(effects.nextUpgradeState.sanguineKillCount, 0);

  const plainEffects = resolveEnemyKillEffects({
    enemy: { isBoss: false },
    bullet: { isRing: false },
    upgrades: {
      escalation: false,
      predatorKillStreak: 0,
      bloodRush: false,
      sanguineBurst: false,
      vampiric: false,
      bloodMoon: false,
      corona: false,
      finalForm: false,
      crimsonHarvest: false,
    },
    hp: 90,
    maxHp: 100,
    ts: 2000,
    vampiricHealPerKill: 4,
    vampiricChargePerKill: 0.25,
  });
  assert.equal(plainEffects.bossCleared, false);
  assert.equal(plainEffects.bossRewardHeal, 0);
  assert.equal(plainEffects.vampiricHeal, 0);
  assert.equal(plainEffects.bloodMoonGreyDrops, 0);
  assert.equal(plainEffects.sanguineBurstCount, 0);
  assert.equal(plainEffects.nextUpgradeState.escalationKills, 0);

  const orbitEffects = resolveOrbitKillEffects({
    scorePerKill: 240,
    finalForm: true,
    hp: 10,
    maxHp: 100,
    finalFormChargeGain: 0.5,
  });
  assert.equal(orbitEffects.scoreDelta, 240);
  assert.equal(orbitEffects.killsDelta, 1);
  assert.equal(orbitEffects.shouldGrantFinalFormCharge, true);
  assert.equal(orbitEffects.finalFormChargeGain, 0.5);

  const orbitNoFinalForm = resolveOrbitKillEffects({
    scorePerKill: 120,
    finalForm: false,
    hp: 5,
    maxHp: 100,
  });
  assert.equal(orbitNoFinalForm.shouldGrantFinalFormCharge, false);

  const upgradeState = {};
  applyKillUpgradeState(upgradeState, {
    escalationKills: 4,
    predatorKillStreak: 2,
    predatorKillStreakTime: 7000,
    bloodRushStacks: 3,
    bloodRushTimer: 6000,
    sanguineKillCount: 1,
  });
  assert.equal(upgradeState.escalationKills, 4);
  assert.equal(upgradeState.predatorKillStreak, 2);
  assert.equal(upgradeState.predatorKillStreakTime, 7000);
  assert.equal(upgradeState.bloodRushStacks, 3);
  assert.equal(upgradeState.bloodRushTimer, 6000);
  assert.equal(upgradeState.sanguineKillCount, 1);

  const rewardActions = buildKillRewardActions({
    killEffects: {
      bossCleared: true,
      bossRewardHeal: 40,
      vampiricHeal: 4,
      vampiricCharge: 0.25,
      crimsonHarvestGreyDrops: 1,
      sanguineBurstCount: 6,
      bloodMoonHeal: 8,
      bloodMoonGreyDrops: 3,
      coronaCharge: 1,
      finalFormCharge: 0.5,
    },
    enemyX: 10,
    enemyY: 20,
    playerX: 30,
    playerY: 40,
    ts: 1000,
    upgrades: {
      bounceTier: 1,
      pierceTier: 2,
      homingTier: 1,
      playerDamageMult: 1.5,
      denseDamageMult: 2,
    },
    globalSpeedLift: 1.2,
    bloodPactHealCap: 3,
    random: () => 0.5,
  });
  assert.ok(rewardActions.some((action) => action.type === 'bossClear' && action.healAmount === 40));
  assert.ok(rewardActions.some((action) => action.type === 'sustainHeal' && action.amount === 4));
  assert.ok(rewardActions.some((action) => action.type === 'gainCharge' && action.source === 'vampiric'));
  assert.ok(rewardActions.some((action) => action.type === 'spawnSanguineBurst' && action.count === 6));
  assert.equal(rewardActions.filter((action) => action.type === 'spawnGreyBullet').length, 4);
});

test('danger hit helpers resolve void block, phase dash, mirror tide, direct hit, and slipstream deterministically', () => {
  const lifeline = resolveLifelineRecovery({
    hpAfterDamage: -10,
    lifeline: true,
    lifelineTriggerCount: 0,
    lifelineUses: 1,
  });
  assert.equal(lifeline.triggered, true);
  assert.equal(lifeline.nextHp, 1);
  assert.equal(lifeline.nextLifelineTriggerCount, 1);

  const voidBlock = resolveDangerPlayerHit({
    bullet: { x: 0, y: 0, r: 5 },
    player: { x: 0, y: 0, r: 10 },
    upgrades: {
      voidWalker: true,
      voidZoneActive: true,
      voidZoneTimer: 5000,
    },
    ts: 1000,
    hp: 100,
    maxHp: 100,
    phaseDamage: 1,
    directDamage: 20,
    projectileInvulnSeconds: 1,
  });
  assert.equal(voidBlock.kind, 'void-block');

  const phaseDash = resolveDangerPlayerHit({
    bullet: { x: 0, y: 0, r: 5 },
    player: { x: 10, y: 0, r: 10 },
    upgrades: {
      voidWalker: true,
      voidZoneActive: false,
      voidZoneTimer: 0,
      phaseDash: true,
      phaseDashCooldown: 0,
      phaseDashRoomUses: 0,
      phaseDashRoomLimit: 1,
      hitChargeGain: 2,
      lifeline: false,
    },
    ts: 1000,
    hp: 50,
    maxHp: 100,
    phaseDamage: 5,
    directDamage: 20,
    projectileInvulnSeconds: 1,
  });
  assert.equal(phaseDash.kind, 'phase-dash');
  assert.equal(phaseDash.damage, 5);
  assert.equal(phaseDash.nextHp, 45);
  assert.equal(phaseDash.shouldGainHitCharge, true);
  assert.equal(phaseDash.nextPhaseDashRoomUses, 1);
  assert.equal(phaseDash.nextPhaseDashCooldown, 3500);
  assert.equal(phaseDash.nextVoidZoneActive, true);
  assert.equal(phaseDash.nextVoidZoneTimer, 3000);

  const mirror = resolveDangerPlayerHit({
    bullet: { x: 0, y: 0, r: 5, vx: 0, vy: 3 },
    player: { x: 0, y: 0, r: 10 },
    upgrades: {
      voidWalker: false,
      mirrorTide: true,
      mirrorTideCooldown: 0,
      mirrorTideRoomUses: 0,
      mirrorTideRoomLimit: 1,
    },
    ts: 1000,
    hp: 50,
    maxHp: 100,
    phaseDamage: 5,
    directDamage: 20,
    projectileInvulnSeconds: 1,
  });
  assert.equal(mirror.kind, 'mirror-tide');
  assert.equal(mirror.nextMirrorTideRoomUses, 1);
  assert.equal(mirror.nextMirrorTideCooldown, 1500);
  assert.equal(mirror.reflectAngle, Math.PI * 1.5);

  const direct = resolveDangerPlayerHit({
    bullet: { x: 0, y: 0, r: 5 },
    player: { x: 0, y: 0, r: 10 },
    upgrades: {
      voidWalker: false,
      phaseDash: false,
      mirrorTide: false,
      hitChargeGain: 1,
      empBurst: true,
      empBurstUsed: false,
      lifeline: true,
      lifelineTriggerCount: 0,
      lifelineUses: 1,
    },
    ts: 1000,
    hp: 20,
    maxHp: 100,
    phaseDamage: 5,
    directDamage: 30,
    projectileInvulnSeconds: 0.8,
  });
  assert.equal(direct.kind, 'direct-hit');
  assert.equal(direct.nextHp, 1);
  assert.equal(direct.shouldEmpBurst, true);
  assert.equal(direct.nextEmpBurstUsed, true);
  assert.equal(direct.lifelineTriggered, true);
  assert.equal(direct.invincibleSeconds, 2);

  const slipstream = resolveSlipstreamNearMiss({
    bullet: { x: 20, y: 0, r: 5 },
    player: { x: 0, y: 0, r: 10 },
    upgrades: { slipTier: 1, slipChargeGain: 0.5, ghostFlow: true },
    slipCooldown: 0,
  });
  assert.equal(slipstream.shouldTrigger, true);
  assert.equal(slipstream.chargeGain, 1);
  assert.equal(slipstream.nextSlipCooldown, 150);

  const rusherNoLifeline = resolveRusherContactHit({
    hp: 30,
    upgrades: { lifeline: false, lastStand: false },
    contactDamage: 18,
    contactInvulnSeconds: 0.6,
  });
  assert.equal(rusherNoLifeline.nextHp, 12);
  assert.equal(rusherNoLifeline.lifelineTriggered, false);
  assert.equal(rusherNoLifeline.shouldGameOver, false);

  const rusherLifeline = resolveRusherContactHit({
    hp: 10,
    upgrades: {
      lifeline: true,
      lifelineTriggerCount: 0,
      lifelineUses: 1,
      lastStand: true,
    },
    contactDamage: 18,
    contactInvulnSeconds: 0.6,
  });
  assert.equal(rusherLifeline.nextHp, 1);
  assert.equal(rusherLifeline.lifelineTriggered, true);
  assert.equal(rusherLifeline.nextLifelineTriggerCount, 1);
  assert.equal(rusherLifeline.shouldTriggerLastStand, true);
  assert.equal(rusherLifeline.invincibleSeconds, 2);

  const nearbyBullets = [
    { x: 0, y: 0, state: 'danger' },
    { x: 200, y: 0, state: 'danger' },
    { x: 10, y: 0, state: 'output' },
  ];
  const converted = convertNearbyDangerBulletsToGrey({
    bullets: nearbyBullets,
    originX: 0,
    originY: 0,
    radius: 120,
    ts: 5000,
  });
  assert.equal(converted, 1);
  assert.equal(nearbyBullets[0].state, 'grey');
  assert.equal(nearbyBullets[0].decayStart, 5000);
  assert.equal(nearbyBullets[1].state, 'danger');

  const lastStandBurst = buildLastStandBurstSpec({
    x: 15,
    y: 25,
    maxCharge: 9.7,
    speed: 220,
    bounceTier: 1,
    pierceTier: 2,
    damageMult: 1.5,
    denseDamageMult: 2,
    now: 1000,
    bloodPactHealCap: 3,
  });
  assert.equal(lastStandBurst.x, 15);
  assert.equal(lastStandBurst.y, 25);
  assert.equal(lastStandBurst.count, 9);
  assert.equal(lastStandBurst.speed, 220);
  assert.equal(lastStandBurst.bounceLeft, 2);
  assert.equal(lastStandBurst.pierceLeft, 2);
  assert.equal(lastStandBurst.radius, 4.5);
  assert.equal(lastStandBurst.homing, false);
  assert.equal(lastStandBurst.crit, false);
  assert.equal(lastStandBurst.dmg, 3);
  assert.equal(lastStandBurst.expireAt, 3000);
  assert.equal(lastStandBurst.extras.bloodPactHeals, 0);
  assert.equal(lastStandBurst.extras.bloodPactHealCap, 3);

  const aftermath = resolvePostHitAftermath({
    hitResult: {
      lifelineTriggered: true,
      nextLifelineTriggerCount: 2,
      nextLifelineUsed: true,
      shouldGameOver: false,
    },
    upgrades: {
      colossus: true,
      maxCharge: 10,
      bounceTier: 1,
      pierceTier: 2,
      playerDamageMult: 1.5,
      denseDamageMult: 2,
    },
    colossusShockwaveCd: 0,
    enableShockwave: true,
    shouldTriggerLastStand: true,
    playerX: 12,
    playerY: 18,
    shotSpeed: 220,
    now: 1000,
    bloodPactHealCap: 4,
  });
  assert.equal(aftermath.shouldApplyLifelineState, true);
  assert.equal(aftermath.nextLifelineTriggerCount, 2);
  assert.equal(aftermath.nextLifelineUsed, true);
  assert.equal(aftermath.shouldGameOver, false);
  assert.equal(aftermath.triggerColossusShockwave, true);
  assert.equal(aftermath.nextColossusShockwaveCd, 4);
  assert.ok(aftermath.lastStandBurstSpec);
  assert.equal(aftermath.lastStandBurstSpec.x, 12);

  const noAftermath = resolvePostHitAftermath({
    hitResult: { lifelineTriggered: false, shouldGameOver: true },
    upgrades: { colossus: true },
    colossusShockwaveCd: 1,
    enableShockwave: true,
    shouldTriggerLastStand: false,
  });
  assert.equal(noAftermath.shouldApplyLifelineState, false);
  assert.equal(noAftermath.shouldGameOver, true);
  assert.equal(noAftermath.triggerColossusShockwave, false);
  assert.equal(noAftermath.lastStandBurstSpec, null);
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

test('leaderboard runtime helpers refresh and submit deterministically', async () => {
  const state = createLeaderboardSyncState();
  let started = false;
  const okRefresh = await refreshLeaderboardSync({
    lbSync: state,
    period: 'daily',
    scope: 'everyone',
    playerName: 'RUNNER',
    gameVersion: '1.0.0',
    fetchRemoteLeaderboard: async () => [{ name: 'A' }],
    beginLeaderboardSync,
    applyLeaderboardSyncSuccess,
    applyLeaderboardSyncFailure,
    onSyncStart: () => { started = true; },
  });
  assert.equal(started, true);
  assert.equal(okRefresh.ok, true);
  assert.equal(state.statusMode, 'synced');
  assert.equal(state.remoteRows.length, 1);

  const failRefresh = await refreshLeaderboardSync({
    lbSync: state,
    period: 'daily',
    scope: 'everyone',
    playerName: 'RUNNER',
    gameVersion: '1.0.0',
    fetchRemoteLeaderboard: async () => { throw new Error('offline'); },
    beginLeaderboardSync,
    applyLeaderboardSyncSuccess,
    applyLeaderboardSyncFailure,
  });
  assert.equal(failRefresh.ok, false);
  assert.equal(state.statusMode, 'local');

  assert.equal(shouldRefreshLeaderboardAfterSubmit({
    lbScope: 'everyone',
    playerName: 'A',
    entryName: 'B',
  }), true);
  assert.equal(shouldRefreshLeaderboardAfterSubmit({
    lbScope: 'personal',
    playerName: 'A',
    entryName: 'B',
  }), false);
  assert.equal(shouldRefreshLeaderboardAfterSubmit({
    lbScope: 'personal',
    playerName: 'A',
    entryName: 'A',
  }), true);
});

test('submitLeaderboardEntryRemote applies fallback on failure', async () => {
  const state = createLeaderboardSyncState();
  const success = await submitLeaderboardEntryRemote({
    entry: { name: 'A', score: 1, room: 1, boons: {}, color: 'green' },
    gameVersion: '1.0.0',
    submitRemoteScore: async () => {},
    forceLocalLeaderboardFallback,
    lbSync: state,
  });
  assert.equal(success.ok, true);

  const failure = await submitLeaderboardEntryRemote({
    entry: { name: 'A', score: 1, room: 1, boons: {}, color: 'green' },
    gameVersion: '1.0.0',
    submitRemoteScore: async () => { throw new Error('offline'); },
    forceLocalLeaderboardFallback,
    lbSync: state,
  });
  assert.equal(failure.ok, false);
  assert.equal(state.statusMode, 'local');
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

test('showGameOverScreen populates score/note and opens panel', () => {
  const panelClasses = new Set(['off']);
  const boonsClasses = new Set();
  const panelEl = {
    classList: {
      remove: (name) => panelClasses.delete(name),
    },
  };
  const boonsPanelEl = {
    classList: {
      add: (name) => boonsClasses.add(name),
    },
  };
  const scoreEl = { textContent: '' };
  const noteEl = { textContent: '' };
  let rendered = false;
  showGameOverScreen({
    panelEl,
    boonsPanelEl,
    scoreEl,
    noteEl,
    score: 1234,
    note: 'Room 10',
    renderBoons: () => { rendered = true; },
  });
  assert.equal(scoreEl.textContent, 1234);
  assert.equal(noteEl.textContent, 'Room 10');
  assert.equal(panelClasses.has('off'), false);
  assert.equal(boonsClasses.has('off'), true);
  assert.equal(rendered, true);
});

test('shell ui helpers update class state and copy text', () => {
  const classes = new Set(['app-loading']);
  const doc = {
    body: {
      classList: {
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
        toggle: (name, enabled) => {
          if(enabled) classes.add(name);
          else classes.delete(name);
        },
      },
    },
  };
  revealAppShell({ doc, raf: (fn) => fn() });
  assert.equal(classes.has('app-loading'), false);
  assert.equal(classes.has('app-ready'), true);

  const copyEl = { textContent: '' };
  syncColorDrivenCopy(copyEl, 'CRIMSON');
  assert.equal(copyEl.textContent, 'CRIMSON rounds');

  let resized = false;
  setMenuChromeVisible({ doc, isVisible: true, onResize: () => { resized = true; } });
  assert.equal(classes.has('menu-chrome-visible'), true);
  assert.equal(resized, true);
});

test('color scheme setters are Node-safe and update active color', () => {
  setPlayerColor('blue');
  assert.equal(getPlayerColor(), 'blue');
  assert.equal(getPlayerColorScheme().hex, '#60a5fa');
  setPlayerColor('green');
});

test('room overlay helpers update text, classes, and reset timers', () => {
  const classes = new Set();
  const panelEl = {
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      toggle: (name, enabled) => {
        if(enabled) classes.add(name);
        else classes.delete(name);
      },
    },
  };
  const textEl = { textContent: '' };
  const timers = [];
  const cleared = [];
  const setTimer = (fn, delayMs) => {
    const id = { fn, delayMs };
    timers.push(id);
    return id;
  };
  const clearTimer = (id) => cleared.push(id);

  showRoomIntroOverlay({ panelEl, textEl, text: 'READY?', isGo: false });
  assert.equal(textEl.textContent, 'READY?');
  assert.equal(classes.has('show'), true);
  assert.equal(classes.has('go'), false);

  showRoomIntroOverlay({ panelEl, textEl, text: 'GO!', isGo: true });
  assert.equal(textEl.textContent, 'GO!');
  assert.equal(classes.has('go'), true);

  hideRoomIntroOverlay({ panelEl });
  assert.equal(classes.has('show'), false);
  assert.equal(classes.has('go'), false);

  showRoomClearOverlay({ panelEl, textEl, setTimer, clearTimer });
  assert.equal(textEl.textContent, 'ROOM CLEAR');
  assert.equal(classes.has('show'), true);
  assert.equal(timers.at(-1).delayMs, 1400);

  showBossDefeatedOverlay({ panelEl, textEl, setTimer, clearTimer });
  assert.equal(textEl.textContent, 'BOSS DEFEATED');
  assert.equal(classes.has('boss-clear'), true);
  assert.equal(cleared.length, 1);
  timers.at(-1).fn();
  assert.equal(textEl.textContent, 'ROOM CLEAR');
  assert.equal(classes.has('show'), false);
  assert.equal(classes.has('boss-clear'), false);
});

test('gesture guard blocks dblclick and fast double-tap while allowing inputs', () => {
  const listeners = new Map();
  const doc = {
    addEventListener: (name, handler) => { listeners.set(name, handler); },
    removeEventListener: (name) => { listeners.delete(name); },
  };
  let now = 1000;
  const dispose = bindGestureGuards({
    doc,
    now: () => now,
    doubleTapWindowMs: 320,
  });

  let prevented = false;
  listeners.get('dblclick')({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);

  prevented = false;
  const touchStartHandler = listeners.get('touchstart');
  touchStartHandler({
    target: { closest: () => null },
    preventDefault: () => { prevented = true; },
  });
  assert.equal(prevented, false);

  now += 100;
  touchStartHandler({
    target: { closest: () => null },
    preventDefault: () => { prevented = true; },
  });
  assert.equal(prevented, true);

  prevented = false;
  listeners.get('selectstart')({
    target: { closest: () => null },
    preventDefault: () => { prevented = true; },
  });
  assert.equal(prevented, true);

  prevented = false;
  listeners.get('selectstart')({
    target: { closest: (selector) => selector === 'input, textarea, select' ? {} : null },
    preventDefault: () => { prevented = true; },
  });
  assert.equal(prevented, false);

  prevented = false;
  const touchHandler = listeners.get('touchend');
  touchHandler({
    target: { closest: () => null },
    preventDefault: () => { prevented = true; },
  });
  assert.equal(prevented, false);

  now += 200;
  touchHandler({
    target: { closest: () => null },
    preventDefault: () => { prevented = true; },
  });
  assert.equal(prevented, true);

  prevented = false;
  now += 200;
  touchHandler({
    target: { closest: (selector) => selector === 'input, textarea, select' ? {} : null },
    preventDefault: () => { prevented = true; },
  });
  assert.equal(prevented, false);

  dispose();
  assert.equal(listeners.size, 0);
});

test('app chrome bindings wire patch notes, leaderboard, and boon panels', () => {
  const listeners = new Map();
  const makeButton = (dataset = {}) => ({
    dataset,
    handlers: new Map(),
    addEventListener(name, handler) {
      this.handlers.set(name, handler);
    },
  });
  const doc = {
    addEventListener(name, handler) {
      listeners.set(name, handler);
    },
  };

  const patchButton = makeButton();
  const patchClose = makeButton();
  const patchPanel = makeButton();
  const patchStates = [];
  bindPatchNotesControls({
    button: patchButton,
    closeButton: patchClose,
    panelEl: patchPanel,
    onOpenChange: (isOpen) => patchStates.push(isOpen),
    doc,
  });
  patchButton.handlers.get('click')();
  patchClose.handlers.get('click')();
  patchPanel.handlers.get('click')({ target: patchPanel });
  listeners.get('keydown')({ key: 'Escape' });
  assert.deepEqual(patchStates, [true, false, false, false]);

  let opened = 0;
  let closed = 0;
  const periodCalls = [];
  const scopeCalls = [];
  const lbOpenA = makeButton();
  const lbOpenB = makeButton();
  const lbClose = makeButton();
  const periodBtn = makeButton({ lbPeriod: 'daily' });
  const scopeBtn = makeButton({ lbScope: 'personal' });
  bindLeaderboardControls({
    openButtons: [lbOpenA, lbOpenB],
    closeButton: lbClose,
    periodButtons: [periodBtn],
    scopeButtons: [scopeBtn],
    onOpen: () => { opened += 1; },
    onClose: () => { closed += 1; },
    onPeriodChange: (period) => periodCalls.push(period),
    onScopeChange: (scope) => scopeCalls.push(scope),
  });
  lbOpenA.handlers.get('click')();
  lbOpenB.handlers.get('click')();
  lbClose.handlers.get('click')();
  periodBtn.handlers.get('click')();
  scopeBtn.handlers.get('click')();
  assert.equal(opened, 2);
  assert.equal(closed, 1);
  assert.deepEqual(periodCalls, ['daily']);
  assert.deepEqual(scopeCalls, ['personal']);

  const panelClasses = new Set(['off']);
  const panelEl = {
    classList: {
      add: (name) => panelClasses.add(name),
      toggle: (name) => {
        if(panelClasses.has(name)) panelClasses.delete(name);
        else panelClasses.add(name);
      },
    },
  };
  const toggleButton = makeButton();
  const closeButton = makeButton();
  bindBoonsPanelControls({
    toggleButton,
    panelEl,
    closeButton,
  });
  toggleButton.handlers.get('click')();
  assert.equal(panelClasses.has('off'), false);
  closeButton.handlers.get('click')();
  assert.equal(panelClasses.has('off'), true);

  const popupClasses = new Set();
  const popupEl = {
    classList: {
      add: (name) => popupClasses.add(name),
    },
  };
  const popupClose = makeButton();
  bindPopupClose({
    closeButton: popupClose,
    panelEl: popupEl,
  });
  popupClose.handlers.get('click')();
  assert.equal(popupClasses.has('off'), true);
});

test('session flow helpers sanitize names and wire start/menu transitions', () => {
  const makeButton = () => ({
    handlers: new Map(),
    addEventListener(name, handler) {
      this.handlers.set(name, handler);
    },
  });
  const makeInput = () => ({
    value: '',
    handlers: new Map(),
    addEventListener(name, handler) {
      this.handlers.set(name, handler);
    },
  });
  const makePanel = (initial = []) => {
    const classes = new Set(initial);
    return {
      classes,
      classList: {
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
      },
    };
  };

  const inputs = [makeInput(), makeInput()];
  const persisted = [];
  const observedNames = [];
  const playerName = setPlayerNameState({
    value: 'ab!! c',
    sanitizePlayerName: (value) => value.replace(/[^a-z ]/gi, '').toUpperCase().trim(),
    persistName: (value) => persisted.push(value),
    inputs,
    syncInputs: true,
    onNameChange: (name) => observedNames.push(name),
  });
  assert.equal(playerName, 'AB C');
  assert.deepEqual(persisted, ['AB C']);
  assert.equal(inputs[0].value, 'AB C');
  assert.equal(inputs[1].value, 'AB C');
  assert.deepEqual(observedNames, ['AB C']);

  const typed = [];
  bindNameInputs({
    inputs,
    setPlayerName: (value) => typed.push(value),
  });
  inputs[0].handlers.get('input')({ target: { value: 'ONE' } });
  inputs[1].handlers.get('input')({ target: { value: 'TWO' } });
  assert.deepEqual(typed, ['ONE', 'TWO']);

  const startButton = makeButton();
  const restartButton = makeButton();
  const mainMenuButton = makeButton();
  const startScreen = makePanel();
  const gameOverScreen = makePanel();
  const boonsPanelEl = makePanel();
  const leaderboardScreen = makePanel();
  const startInput = makeInput();
  const gameOverInput = makeInput();
  startInput.value = 'START';
  gameOverInput.value = 'RESTART';
  const nameCalls = [];
  const menuCalls = [];
  let initCount = 0;
  let beginLoopCount = 0;
  const states = [];

  bindSessionFlow({
    startButton,
    restartButton,
    mainMenuButton,
    startInput,
    gameOverInput,
    setPlayerName: (value, options) => nameCalls.push({ value, options }),
    setMenuChromeVisible: (visible) => menuCalls.push(visible),
    startScreen,
    gameOverScreen,
    boonsPanelEl,
    leaderboardScreen,
    initRun: () => { initCount += 1; },
    beginLoop: () => { beginLoopCount += 1; },
    setGameState: (state) => states.push(state),
  });

  startButton.onclick();
  assert.deepEqual(nameCalls[0], { value: 'START', options: { syncInputs: true } });
  assert.deepEqual(menuCalls[0], false);
  assert.equal(startScreen.classes.has('off'), true);
  assert.equal(initCount, 1);
  assert.equal(beginLoopCount, 1);
  assert.deepEqual(states, ['playing']);

  restartButton.onclick();
  assert.deepEqual(nameCalls[1], { value: 'RESTART', options: { syncInputs: true } });
  assert.deepEqual(menuCalls[1], false);
  assert.equal(gameOverScreen.classes.has('off'), true);
  assert.equal(boonsPanelEl.classes.has('off'), true);
  assert.equal(initCount, 2);
  assert.equal(beginLoopCount, 2);
  assert.deepEqual(states, ['playing', 'playing']);

  mainMenuButton.handlers.get('click')();
  assert.deepEqual(nameCalls[2], { value: 'RESTART', options: { syncInputs: true } });
  assert.deepEqual(menuCalls[2], true);
  assert.equal(leaderboardScreen.classes.has('off'), true);
  assert.equal(startScreen.classes.has('off'), false);
  assert.deepEqual(states, ['playing', 'playing', 'start']);
});

test('projectile helpers build danger bullets and elite stages deterministically', () => {
  const getThreatPalette = () => ({
    elite: { hex: '#111111', light: '#222222' },
    advanced: { hex: '#333333', light: '#444444' },
    danger: { hex: '#555555', light: '#666666' },
  });
  const getRgba = (hex, alpha) => `${hex}:${alpha}`;
  const bullet = {};
  applyEliteBulletStage({ bullet, stage: 5, getThreatPalette, getRgba });
  assert.equal(bullet.eliteStage, 2);
  assert.equal(bullet.eliteColor, '#555555');
  assert.equal(bullet.eliteCore, '#666666:0.9');
  assert.equal(bullet.bounceStages, 0);

  const doubleBouncePalette = getDoubleBounceBulletPalette({ getThreatPalette, getRgba });
  assert.deepEqual(doubleBouncePalette, { fill: '#333333', core: '#444444:0.9' });

  const bullets = [];
  const spawns = [];
  const player = { x: 10, y: 20 };
  spawnAimedEnemyBullet({
    bullets,
    player,
    x: 0,
    y: 0,
    bulletSpeedScale: () => 1,
    onSpawn: (count) => spawns.push(count),
    random: () => 0.5,
  });
  assert.equal(bullets.length, 1);
  assert.equal(bullets[0].state, 'danger');
  assert.equal(bullets[0].r, 4.5);
  assert.deepEqual(spawns, [1]);

  spawnRadialEnemyBullet({
    bullets,
    x: 0,
    y: 0,
    idx: 1,
    total: 4,
    bulletSpeedScale: () => 1,
    onSpawn: (count) => spawns.push(count),
  });
  assert.equal(bullets.length, 2);
  assert.deepEqual(spawns, [1, 1]);

  let sparkCalls = 0;
  spawnTriangleBurst({
    bullets,
    x: 0,
    y: 0,
    origVx: 1,
    origVy: 0,
    bulletSpeedScale: () => 1,
    onSpawn: (count) => spawns.push(count),
    sparks: () => { sparkCalls += 1; },
    sparkColor: '#fff',
  });
  assert.equal(bullets.length, 5);
  assert.equal(sparkCalls, 1);

  spawnEliteBullet({
    bullets,
    x: 0,
    y: 0,
    angle: 0,
    speed: 10,
    stage: 1,
    getThreatPalette,
    getRgba,
  });
  assert.equal(bullets.at(-1).eliteStage, 1);
  assert.equal(bullets.at(-1).eliteColor, '#333333');

  spawnEliteTriangleBurst({
    bullets,
    x: 0,
    y: 0,
    origVx: 1,
    origVy: 0,
    bulletSpeedScale: () => 1,
    sparks: () => { sparkCalls += 1; },
    sparkColor: '#0ff',
    getThreatPalette,
    getRgba,
  });
  assert.equal(bullets.at(-1).eliteStage, 2);
  assert.equal(sparkCalls, 2);
});

test('player projectile helpers build output and grey bullets deterministically', () => {
  const bullets = [];
  const output = createOutputBullet({
    x: 1,
    y: 2,
    vx: 3,
    vy: 4,
    radius: 5,
    bounceLeft: 2,
    pierceLeft: 1,
    homing: true,
    crit: true,
    dmg: 9,
    expireAt: 100,
    extras: { custom: 'ok' },
  });
  assert.equal(output.state, 'output');
  assert.equal(output.r, 5);
  assert.equal(output.custom, 'ok');
  assert.ok(output.hitIds instanceof Set);

  pushOutputBullet({
    bullets,
    x: 0,
    y: 0,
    vx: 10,
    vy: 20,
    radius: 4,
    expireAt: 50,
  });
  assert.equal(bullets.length, 1);
  assert.equal(bullets[0].state, 'output');

  pushGreyBullet({
    bullets,
    x: 1,
    y: 1,
    vx: 2,
    vy: 3,
    decayStart: 123,
  });
  assert.equal(bullets.length, 2);
  assert.equal(bullets[1].state, 'grey');

  spawnGreyDrops({
    bullets,
    x: 5,
    y: 6,
    ts: 200,
    count: 2,
    maxBullets: 10,
    random: () => 0.5,
  });
  assert.equal(bullets.length, 4);
  assert.equal(bullets[2].state, 'grey');
  assert.equal(bullets[3].state, 'grey');

  const sourceBullet = {
    x: 0,
    y: 0,
    vx: 10,
    vy: 0,
    r: 5,
    pierceLeft: 2,
    homing: true,
    crit: false,
    dmg: 12,
    bloodPactHeals: 1,
    bloodPactHealCap: 3,
  };
  spawnSplitOutputBullets({
    bullets,
    sourceBullet,
    splitDeltas: [-0.5, 0.5],
    damageFactor: 0.8,
    expireAt: 400,
    fallbackBloodPactHealCap: 99,
  });
  assert.equal(bullets.length, 6);
  assert.equal(bullets[4].state, 'output');
  assert.equal(bullets[5].dmg, 9.600000000000001);
  assert.equal(bullets[5].bloodPactHealCap, 3);

  spawnRadialOutputBurst({
    bullets,
    x: 0,
    y: 0,
    count: 4,
    speed: 30,
    radius: 3,
    dmg: 7,
    expireAt: 500,
  });
  assert.equal(bullets.length, 10);
  assert.equal(bullets[9].state, 'output');
});

test('player fire helpers build lane offsets, shot plan, and volley specs deterministically', () => {
  assert.deepEqual(createLaneOffsets(3, 7), [-7, 0, 7]);
  assert.deepEqual(createLaneOffsets(4, 6), [-9, -3, 3, 9]);

  const shots = buildPlayerShotPlan({
    tx: 20,
    ty: 10,
    player: { x: 10, y: 10 },
    upg: {
      forwardShotTier: 1,
      shotSize: 1,
      spreadTier: 1,
      dualShot: 1,
      ringShots: 4,
      spreadShot: true,
    },
  });
  assert.equal(shots.length, 11);
  assert.equal(shots[0].offset, -3.5);
  assert.equal(shots[1].offset, 3.5);
  assert.equal(shots[4].angle, Math.PI);
  assert.equal(shots[5].isRing, true);
  assert.equal(shots[10].isSpreadExtra, true);

  const volley = buildPlayerVolleySpecs({
    shots,
    availableShots: 3,
    player: { x: 100, y: 50 },
    upg: {
      critChance: 0.5,
      bounceTier: 1,
      homingTier: 1,
      payload: true,
    },
    bulletSpeed: 10,
    baseRadius: 4,
    baseDamage: 12,
    lifeMs: 800,
    overchargeBonus: 1.2,
    overloadBonus: 1.5,
    getPierceLeft: (shot) => shot.offset === 0 ? 2 : 1,
    getBloodPactHealCap: () => 9,
    now: 1000,
    random: (() => {
      const rolls = [0.4, 0.8, 0.2];
      let idx = 0;
      return () => rolls[idx++];
    })(),
  });

  assert.equal(volley.length, 3);
  assert.equal(volley[0].crit, true);
  assert.equal(volley[1].crit, false);
  assert.equal(volley[2].crit, true);
  assert.equal(volley[0].radius, 5.12);
  assert.equal(volley[1].radius, 4);
  assert.equal(volley[0].bounceLeft, 2);
  assert.equal(volley[1].pierceLeft, 1);
  assert.equal(volley[2].pierceLeft, 2);
  assert.equal(volley[0].homing, true);
  assert.ok(Math.abs(volley[0].dmg - 21.6) < 1e-9);
  assert.equal(volley[0].expireAt, 1800);
  assert.equal(volley[0].extras.hasPayload, true);
  assert.equal(volley[0].extras.bloodPactHealCap, 9);
  assert.equal(volley[0].x, 100);
  assert.equal(volley[0].y, 46.5);
});

test('defense runtime helpers keep orbit and shield state deterministic', () => {
  const orbFireTimers = [];
  const orbCooldown = [1];
  syncOrbRuntimeArrays(orbFireTimers, orbCooldown, 3);
  assert.deepEqual(orbFireTimers, [0, 0, 0]);
  assert.deepEqual(orbCooldown, [1, 0, 0]);

  const orbitSlot = getOrbitSlotPosition({
    index: 1,
    orbitSphereTier: 4,
    ts: 0,
    rotationSpeed: 1,
    radius: 40,
    originX: 100,
    originY: 50,
  });
  assert.ok(Math.abs(orbitSlot.x - 100) < 1e-9);
  assert.equal(orbitSlot.y, 90);

  const shieldSlot = getShieldSlotPosition({
    index: 0,
    shieldCount: 2,
    ts: 0,
    rotationSpeed: 1,
    radius: 35,
    originX: 10,
    originY: 20,
  });
  assert.equal(shieldSlot.x, 45);
  assert.equal(shieldSlot.y, 20);
  assert.equal(shieldSlot.facing, Math.PI * 0.5);

  const shields = [
    { cooldown: 0.5, hardened: false },
    { cooldown: 0, hardened: false },
  ];
  tickShieldCooldowns(shields, 0.5, true);
  assert.equal(shields[0].cooldown, 0);
  assert.equal(shields[0].hardened, true);
  assert.equal(countReadyShields(shields), 2);

  const charging = advanceAegisBatteryTimer({
    aegisBattery: true,
    shieldTier: 2,
    enemiesCount: 3,
    readyShieldCount: 2,
    timer: 1200,
    dtMs: 500,
    intervalMs: 1800,
  });
  assert.equal(charging.timer, 1700);
  assert.equal(charging.shouldFire, false);

  const firing = advanceAegisBatteryTimer({
    aegisBattery: true,
    shieldTier: 2,
    enemiesCount: 3,
    readyShieldCount: 2,
    timer: 1500,
    dtMs: 400,
    intervalMs: 1800,
  });
  assert.equal(firing.timer, 0);
  assert.equal(firing.shouldFire, true);

  const reset = advanceAegisBatteryTimer({
    aegisBattery: true,
    shieldTier: 2,
    enemiesCount: 0,
    readyShieldCount: 2,
    timer: 700,
    dtMs: 100,
    intervalMs: 1800,
  });
  assert.equal(reset.timer, 0);
  assert.equal(reset.shouldFire, false);

  const noBolt = buildAegisBatteryBoltSpec({
    shouldFire: false,
    enemies: [{ x: 10, y: 0 }],
    originX: 0,
    originY: 0,
    now: 1000,
  });
  assert.equal(noBolt, null);

  const bolt = buildAegisBatteryBoltSpec({
    shouldFire: true,
    enemies: [{ x: 30, y: 0 }, { x: 12, y: 0 }],
    originX: 0,
    originY: 0,
    damageMult: 1.5,
    denseDamageMult: 2,
    readyShieldCount: 3,
    shotSpeed: 210,
    now: 1000,
    expireMs: 1700,
  });
  assert.ok(bolt);
  assert.equal(bolt.x, 0);
  assert.equal(bolt.y, 0);
  assert.equal(bolt.vx, 210);
  assert.equal(bolt.vy, 0);
  assert.equal(bolt.radius, 4.2);
  assert.equal(bolt.homing, true);
  assert.equal(bolt.crit, false);
  assert.equal(bolt.expireAt, 2700);
  assert.ok(Math.abs(bolt.dmg - 5.1) < 1e-9);

  const reflection = buildMirrorShieldReflectionSpec({
    x: 10,
    y: 20,
    vx: 5,
    vy: 6,
    shotSize: 3,
    playerDamageMult: 2,
    denseDamageMult: 1.5,
    aegisTitan: true,
    mirrorShieldDamageFactor: 0.8,
    aegisBatteryDamageMult: 1.2,
    now: 1000,
    playerShotLifeMs: 2000,
    shotLifeMult: 1.1,
  });
  assert.equal(reflection.x, 10);
  assert.equal(reflection.y, 20);
  assert.equal(reflection.radius, 11.25);
  assert.equal(reflection.expireAt, 3200);
  assert.ok(Math.abs(reflection.dmg - 5.76) < 1e-9);

  const shieldBurst = buildShieldBurstSpec({
    x: 5,
    y: 6,
    aegisTitan: true,
    globalSpeedLift: 1.2,
    shotSize: 2.4,
    playerDamageMult: 1.5,
    denseDamageMult: 2,
    aegisNovaDamageFactor: 0.75,
    aegisBatteryDamageMult: 1.1,
    now: 1000,
    playerShotLifeMs: 2000,
    shotLifeMult: 1.2,
  });
  assert.equal(shieldBurst.count, 8);
  assert.equal(shieldBurst.speed, 276);
  assert.ok(Math.abs(shieldBurst.radius - 10.8) < 1e-9);
  assert.ok(Math.abs(shieldBurst.dmg - 2.475) < 1e-9);
  assert.equal(shieldBurst.expireAt, 3400);

  const volleyNoFire = buildChargedOrbVolleyForSlot({
    slotIndex: 0,
    timerMs: 100,
    dtMs: 50,
    fireIntervalMs: 200,
    orbCooldown: [0],
    orbitSphereTier: 1,
    ts: 0,
    rotationSpeed: 0,
    radius: 40,
    originX: 0,
    originY: 0,
    enemies: [{ x: 100, y: 0 }],
    getOrbitSlotPosition: ({ originX, originY }) => ({ x: originX + 40, y: originY }),
    charge: 5,
    reservedForPlayer: 0,
    now: 1000,
  });
  assert.equal(volleyNoFire.fired, false);
  assert.equal(volleyNoFire.nextTimerMs, 150);

  const volleyFire = buildChargedOrbVolleyForSlot({
    slotIndex: 0,
    timerMs: 180,
    dtMs: 50,
    fireIntervalMs: 200,
    orbCooldown: [0],
    orbitSphereTier: 1,
    ts: 0,
    rotationSpeed: 0,
    radius: 40,
    originX: 0,
    originY: 0,
    enemies: [{ x: 100, y: 0 }],
    getOrbitSlotPosition: ({ originX, originY }) => ({ x: originX + 40, y: originY }),
    orbTwin: true,
    orbitalFocus: true,
    orbOvercharge: true,
    orbPierce: true,
    charge: 5,
    reservedForPlayer: 1,
    chargeRatio: 0.5,
    twinDamageMult: 1.6,
    focusDamageMult: 1.6,
    focusChargeScale: 0.8,
    overchargeDamageMult: 1.1,
    shotSpeed: 220,
    now: 1000,
    bloodPactHealCap: 2,
  });
  assert.equal(volleyFire.fired, true);
  assert.equal(volleyFire.nextTimerMs, 0);
  assert.equal(volleyFire.chargeSpent, 2);
  assert.equal(volleyFire.shotSpecs.length, 2);
  assert.equal(volleyFire.shotSpecs[0].pierceLeft, 1);
  assert.equal(volleyFire.shotSpecs[0].homing, true);
  assert.equal(volleyFire.shotSpecs[0].radius, 4.1);
  assert.equal(volleyFire.shotSpecs[0].extras.bloodPactHealCap, 2);
});

test('enemy runtime helpers keep movement and fire cadence deterministic', () => {
  const siphon = { x: 10, y: 20, r: 5 };
  const siphonStep = stepSiphonEnemy(siphon, {
    ts: 0,
    dt: 1,
    width: 200,
    height: 200,
    margin: 10,
    player: { x: 10, y: 20 },
  });
  assert.equal(siphonStep.shouldDrainCharge, true);
  assert.ok(siphon.x >= 15 && siphon.x <= 185);
  assert.ok(siphon.y >= 15 && siphon.y <= 185);

  const rusher = { x: 10, y: 10, r: 5, spd: 20 };
  const rusherStep = stepRusherEnemy(rusher, {
    player: { x: 40, y: 10 },
    dt: 1,
    width: 100,
    height: 100,
    margin: 0,
  });
  assert.equal(rusherStep.distanceToPlayer, 30);
  assert.equal(rusher.x, 30);
  assert.equal(rusher.y, 10);

  const ranged = {
    x: 50,
    y: 50,
    r: 5,
    spd: 40,
    fT: 900,
    fRate: 1000,
    eid: 2,
    fleeRange: 100,
    strafeSpd: 0.6,
    disruptorCooldown: 0,
    type: 'disruptor',
    burst: 2,
    disruptorBulletCount: 4,
  };
  const rangedStep = advanceRangedEnemyCombatState(ranged, {
    player: { x: 150, y: 50 },
    ts: 0,
    dt: 0.2,
    width: 200,
    height: 200,
    margin: 10,
    gravityWell2: false,
    windupMs: 520,
  });
  assert.equal(rangedStep.inWindup, true);
  assert.equal(rangedStep.shouldFire, true);
  assert.equal(ranged.fT, 0);

  const siphonCombat = stepEnemyCombatState(
    { x: 10, y: 10, r: 5, isSiphon: true },
    {
      player: { x: 10, y: 10 },
      ts: 0,
      dt: 0.1,
      width: 200,
      height: 200,
      margin: 10,
    },
  );
  assert.equal(siphonCombat.kind, 'siphon');
  assert.equal(siphonCombat.shouldDrainCharge, true);

  const rusherCombat = stepEnemyCombatState(
    { x: 0, y: 0, r: 5, spd: 20, isRusher: true },
    {
      player: { x: 20, y: 0 },
      ts: 0,
      dt: 0.1,
      width: 200,
      height: 200,
      margin: 0,
    },
  );
  assert.equal(rusherCombat.kind, 'rusher');
  assert.ok(rusherCombat.distanceToPlayer > 0);

  const rangedCombat = stepEnemyCombatState(
    { x: 50, y: 50, r: 5, spd: 40, fT: 900, fRate: 1000, eid: 2, strafeSpd: 0.6, disruptorCooldown: 0 },
    {
      player: { x: 150, y: 50 },
      ts: 0,
      dt: 0.2,
      width: 200,
      height: 200,
      margin: 10,
      gravityWell2: false,
      windupMs: 520,
    },
  );
  assert.equal(rangedCombat.kind, 'ranged');
  assert.equal(rangedCombat.shouldFire, true);
  assert.equal(rangedCombat.inWindup, true);

  const cooldownApplied = applyDisruptorPostFire(ranged);
  assert.equal(cooldownApplied, true);
  assert.equal(ranged.disruptorBulletCount, 0);
  assert.equal(ranged.disruptorCooldown, 800);
});

test('enemy fire helper routes burst patterns by enemy type deterministically', () => {
  const calls = {
    zoner: 0,
    eliteZoner: 0,
    doubleBounce: 0,
    triangle: 0,
    eliteTriangle: 0,
    eliteBullet: 0,
    enemyBullet: 0,
  };
  const spawners = {
    spawnZoner: () => { calls.zoner += 1; },
    spawnEliteZoner: () => { calls.eliteZoner += 1; },
    spawnDoubleBounce: () => { calls.doubleBounce += 1; },
    spawnTriangle: () => { calls.triangle += 1; },
    spawnEliteTriangle: () => { calls.eliteTriangle += 1; },
    spawnEliteBullet: () => { calls.eliteBullet += 1; },
    spawnEnemyBullet: () => { calls.enemyBullet += 1; },
  };

  fireEnemyBurst(
    { type: 'orange_zoner', burst: 3, isElite: false },
    { player: { x: 0, y: 0 }, bulletSpeedScale: () => 1, ...spawners },
  );
  assert.equal(calls.eliteZoner, 3);

  fireEnemyBurst(
    { type: 'triangle', burst: 2, isElite: true },
    { player: { x: 0, y: 0 }, bulletSpeedScale: () => 1, ...spawners },
  );
  assert.equal(calls.eliteTriangle, 2);

  const disruptor = { type: 'disruptor', burst: 2, isElite: false, x: 0, y: 0, disruptorBulletCount: 4, disruptorCooldown: 0 };
  fireEnemyBurst(disruptor, {
    player: { x: 10, y: 0 },
    bulletSpeedScale: () => 1,
    canEnemyUsePurpleShots: () => true,
    ...spawners,
  });
  assert.equal(calls.doubleBounce, 2);
  assert.equal(disruptor.disruptorCooldown, 800);

  const eliteChaser = { type: 'chaser', burst: 2, isElite: true, x: 0, y: 0, disruptorBulletCount: 0, disruptorCooldown: 0 };
  fireEnemyBurst(eliteChaser, {
    player: { x: 10, y: 0 },
    bulletSpeedScale: () => 1,
    random: () => 0.5,
    canEnemyUsePurpleShots: () => false,
    ...spawners,
  });
  assert.equal(calls.eliteBullet, 2);

  const plainChaser = { type: 'chaser', burst: 1, isElite: false, x: 0, y: 0, disruptorBulletCount: 0, disruptorCooldown: 0 };
  fireEnemyBurst(plainChaser, {
    player: { x: 10, y: 0 },
    bulletSpeedScale: () => 1,
    canEnemyUsePurpleShots: () => false,
    ...spawners,
  });
  assert.equal(calls.enemyBullet, 1);
});

test('orbit contact helper applies cooldown-gated damage and kill state deterministically', () => {
  const enemy = { x: 40, y: 0, r: 8, hp: 6 };
  const result1 = applyOrbitSphereContact(enemy, {
    orbCooldown: [0],
    orbitSphereTier: 1,
    ts: 1000,
    getOrbitSlotPosition: ({ originX, originY }) => ({ x: originX + 40, y: originY }),
    rotationSpeed: 0,
    radius: 40,
    originX: 0,
    originY: 0,
    orbitalFocus: false,
    chargeRatio: 0,
  });
  assert.equal(result1.hit, true);
  assert.equal(result1.killed, false);
  assert.equal(enemy.hp, 4);

  const result2 = applyOrbitSphereContact(enemy, {
    orbCooldown: [0],
    orbitSphereTier: 1,
    ts: 1100,
    getOrbitSlotPosition: ({ originX, originY }) => ({ x: originX + 40, y: originY }),
    rotationSpeed: 0,
    radius: 40,
    originX: 0,
    originY: 0,
    orbitalFocus: false,
    chargeRatio: 0,
  });
  assert.equal(result2.hit, false);

  const result3 = applyOrbitSphereContact(enemy, {
    orbCooldown: [0],
    orbitSphereTier: 1,
    ts: 1300,
    getOrbitSlotPosition: ({ originX, originY }) => ({ x: originX + 40, y: originY }),
    rotationSpeed: 0,
    radius: 40,
    originX: 0,
    originY: 0,
    orbitalFocus: true,
    chargeRatio: 1,
    baseDamage: 2,
    focusDamageBonus: 1.5,
    focusChargeScale: 1.5,
  });
  assert.equal(result3.hit, true);
  assert.equal(result3.killed, true);
  assert.ok(enemy.hp <= 0);
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

await Promise.all(pendingTests);

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode);
}
