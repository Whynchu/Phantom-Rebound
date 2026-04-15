function resolveOutputEnemyHit({
  bullet,
  enemyHp,
  hp,
  maxHp,
  upgrades,
  critDamageFactor,
  bloodPactBaseHealCap,
} = {}) {
  const deadManActive = Boolean(upgrades.deadManTrigger && hp <= maxHp * 0.15);
  const deadManMult = deadManActive ? (upgrades.finalForm ? 2.5 : 2) : 1;
  const damage = (bullet.crit ? critDamageFactor : 1) * bullet.dmg * deadManMult;
  const enemyHpAfterHit = enemyHp - damage;
  const bloodPactHealCap = bullet.bloodPactHealCap || bloodPactBaseHealCap;
  const bloodPactHeals = bullet.bloodPactHeals || 0;
  const shouldBloodPactHeal = Boolean(
    upgrades.bloodPact &&
    bullet.pierceLeft > 0 &&
    bloodPactHeals < bloodPactHealCap
  );
  const nextBloodPactHeals = shouldBloodPactHeal ? bloodPactHeals + 1 : bloodPactHeals;

  const piercesAfterHit = deadManActive || bullet.pierceLeft > 0;
  let nextPierceLeft = bullet.pierceLeft || 0;
  let shouldTriggerVolatile = false;
  if(piercesAfterHit && !deadManActive) {
    nextPierceLeft = Math.max(0, nextPierceLeft - 1);
    shouldTriggerVolatile = Boolean(
      upgrades.volatileRounds &&
      (nextPierceLeft === 0 || upgrades.volatileAllTargets)
    );
  }

  return {
    damage,
    enemyHpAfterHit,
    enemyKilled: enemyHpAfterHit <= 0,
    deadManActive,
    deadManMult,
    shouldBloodPactHeal,
    nextBloodPactHeals,
    piercesAfterHit,
    nextPierceLeft,
    shouldTriggerVolatile,
    removeBullet: !piercesAfterHit,
  };
}

function resolveSanguineBurst({
  enabled,
  currentKillCount,
  rampageEvolved,
} = {}) {
  if(!enabled) {
    return {
      nextKillCount: currentKillCount || 0,
      shouldBurst: false,
      burstCount: 0,
    };
  }
  const nextKillCountRaw = (currentKillCount || 0) + 1;
  const burstThreshold = rampageEvolved ? 4 : 8;
  if(nextKillCountRaw >= burstThreshold) {
    return {
      nextKillCount: 0,
      shouldBurst: true,
      burstCount: rampageEvolved ? 8 : 6,
    };
  }
  return {
    nextKillCount: nextKillCountRaw,
    shouldBurst: false,
    burstCount: 0,
  };
}

export {
  resolveOutputEnemyHit,
  resolveSanguineBurst,
};
