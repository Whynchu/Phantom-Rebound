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

export { resolveEnemyKillEffects, resolveOrbitKillEffects };
