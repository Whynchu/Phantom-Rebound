import { simRng } from './seededRng.js';

function resolveEnemyKillEffects({
  enemy,
  bullet,
  upgrades,
  hp,
  maxHp,
  ts,
  vampiricHealPerKill,
  vampiricChargePerKill,
} = {}) {
  const nextUpgradeState = {
    escalationKills: upgrades.escalation ? (upgrades.escalationKills || 0) + 1 : upgrades.escalationKills || 0,
    predatorKillStreak: (upgrades.predatorKillStreak || 0) + 1,
    predatorKillStreakTime: ts + 5000,
    bloodRushStacks: upgrades.bloodRush ? Math.min(5, (upgrades.bloodRushStacks || 0) + 1) : (upgrades.bloodRushStacks || 0),
    bloodRushTimer: upgrades.bloodRush ? ts + 3000 : upgrades.bloodRushTimer || 0,
    sanguineKillCount: upgrades.sanguineKillCount || 0,
  };

  const bossRewardHeal = enemy.isBoss ? Math.floor(maxHp * 0.5) : 0;
  const vampiricHeal = upgrades.vampiric ? vampiricHealPerKill : 0;
  const vampiricCharge = upgrades.vampiric ? vampiricChargePerKill : 0;
  const bloodMoonHeal = upgrades.bloodMoon ? 8 : 0;
  const coronaCharge = bullet.isRing && upgrades.corona ? 1 : 0;
  const finalFormCharge = upgrades.finalForm && hp <= maxHp * 0.15 ? 0.5 : 0;

  let sanguineBurstCount = 0;
  if(upgrades.sanguineBurst) {
    const nextKillCountRaw = (upgrades.sanguineKillCount || 0) + 1;
    const threshold = upgrades.rampageEvolved ? 4 : 8;
    if(nextKillCountRaw >= threshold) {
      nextUpgradeState.sanguineKillCount = 0;
      sanguineBurstCount = upgrades.rampageEvolved ? 8 : 6;
    } else {
      nextUpgradeState.sanguineKillCount = nextKillCountRaw;
    }
  }

  return {
    bossCleared: Boolean(enemy.isBoss),
    bossRewardHeal,
    vampiricHeal,
    vampiricCharge,
    bloodMoonHeal,
    coronaCharge,
    finalFormCharge,
    crimsonHarvestGreyDrops: upgrades.crimsonHarvest ? 1 : 0,
    bloodMoonGreyDrops: upgrades.bloodMoon ? 3 : 0,
    sanguineBurstCount,
    nextUpgradeState,
  };
}

function resolveOrbitKillEffects({
  scorePerKill = 0,
  finalForm = false,
  hp = 0,
  maxHp = 0,
  finalFormChargeGain = 0.5,
} = {}) {
  return {
    scoreDelta: scorePerKill,
    killsDelta: 1,
    shouldGrantFinalFormCharge: Boolean(finalForm && hp <= maxHp * 0.15),
    finalFormChargeGain,
  };
}

function applyKillUpgradeState(upgrades, nextUpgradeState = {}) {
  upgrades.escalationKills = nextUpgradeState.escalationKills;
  upgrades.predatorKillStreak = nextUpgradeState.predatorKillStreak;
  upgrades.predatorKillStreakTime = nextUpgradeState.predatorKillStreakTime;
  upgrades.bloodRushStacks = nextUpgradeState.bloodRushStacks;
  upgrades.bloodRushTimer = nextUpgradeState.bloodRushTimer;
  upgrades.sanguineKillCount = nextUpgradeState.sanguineKillCount;
}

function buildKillRewardActions({
  killEffects,
  enemyX,
  enemyY,
  playerX,
  playerY,
  ts,
  upgrades,
  globalSpeedLift = 1,
  bloodPactHealCap = 0,
  random = () => simRng.next(),
} = {}) {
  const actions = [];
  if(killEffects.bossCleared) {
    actions.push({
      type: 'bossClear',
      healAmount: killEffects.bossRewardHeal,
    });
  }
  if(killEffects.vampiricHeal > 0) {
    actions.push({
      type: 'sustainHeal',
      amount: killEffects.vampiricHeal,
      source: 'vampiric',
    });
    actions.push({
      type: 'gainCharge',
      amount: killEffects.vampiricCharge,
      source: 'vampiric',
    });
  }
  for(let drop = 0; drop < killEffects.crimsonHarvestGreyDrops; drop++) {
    actions.push({
      type: 'spawnGreyBullet',
      x: enemyX,
      y: enemyY,
      vx: (random() - 0.5) * 150,
      vy: (random() - 0.5) * 150,
      radius: 5,
      decayStart: ts,
    });
  }
  if(killEffects.sanguineBurstCount > 0) {
    actions.push({
      type: 'spawnSanguineBurst',
      x: playerX,
      y: playerY,
      count: killEffects.sanguineBurstCount,
      speed: 220 * globalSpeedLift,
      radius: 5.5,
      bounceLeft: upgrades.bounceTier,
      pierceLeft: upgrades.pierceTier,
      homing: upgrades.homingTier > 0,
      crit: false,
      dmg: (upgrades.playerDamageMult || 1) * (upgrades.denseDamageMult || 1),
      expireAt: ts + 2200,
      extras: {
        bloodPactHeals: 0,
        bloodPactHealCap,
      },
    });
  }
  if(killEffects.bloodMoonHeal > 0) {
    actions.push({
      type: 'sustainHeal',
      amount: killEffects.bloodMoonHeal,
      source: 'vampiric',
    });
    for(let bloodMoonDrop = 0; bloodMoonDrop < killEffects.bloodMoonGreyDrops; bloodMoonDrop++) {
      const ang = (Math.PI * 2 / 3) * bloodMoonDrop + random() * 0.3;
      actions.push({
        type: 'spawnGreyBullet',
        x: enemyX,
        y: enemyY,
        vx: Math.cos(ang) * 120,
        vy: Math.sin(ang) * 120,
        radius: 5,
        decayStart: ts,
      });
    }
  }
  if(killEffects.coronaCharge > 0) {
    actions.push({
      type: 'gainCharge',
      amount: killEffects.coronaCharge,
      source: 'corona',
    });
  }
  if(killEffects.finalFormCharge > 0) {
    actions.push({
      type: 'gainCharge',
      amount: killEffects.finalFormCharge,
      source: 'finalForm',
    });
  }
  return actions;
}

export {
  resolveEnemyKillEffects,
  resolveOrbitKillEffects,
  applyKillUpgradeState,
  buildKillRewardActions,
};
