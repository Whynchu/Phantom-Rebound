function createLaneOffsets(count, spacing) {
  return Array.from({ length: count }, (_, idx) => (idx - (count - 1) / 2) * spacing);
}

function buildPlayerShotPlan({
  tx,
  ty,
  player,
  upg,
} = {}) {
  const base = Math.atan2(ty - player.y, tx - player.x);
  const shots = [];
  const forwardOffsets = createLaneOffsets(1 + (upg.forwardShotTier || 0), 7 * Math.min(1.6, upg.shotSize || 1));

  for(const laneOffset of forwardOffsets) shots.push({ angle: base, offset: laneOffset });
  if((upg.spreadTier || 0) >= 1) {
    shots.push({ angle: base - 0.28, offset: 0 }, { angle: base + 0.28, offset: 0 });
  }
  if((upg.spreadTier || 0) >= 2) {
    shots.push(
      { angle: base - 0.45, offset: 0 },
      { angle: base - 0.22, offset: 0 },
      { angle: base + 0.22, offset: 0 },
      { angle: base + 0.45, offset: 0 },
    );
  }
  if((upg.dualShot || 0) > 0) {
    shots.push({ angle: base + Math.PI, offset: 0 });
  }
  if((upg.ringShots || 0) > 0) {
    for(let i = 0; i < upg.ringShots; i++) {
      shots.push({ angle: (Math.PI * 2 / upg.ringShots) * i, offset: 0, isRing: true });
    }
  }
  if(upg.spreadShot) {
    shots.push({ angle: base - 0.35, offset: 0, isSpreadExtra: true });
    shots.push({ angle: base + 0.35, offset: 0, isSpreadExtra: true });
  }
  return shots;
}

function buildPlayerVolleySpecs({
  shots,
  availableShots,
  player,
  upg,
  bulletSpeed,
  baseRadius,
  baseDamage,
  lifeMs,
  overchargeBonus = 1,
  overloadBonus = 1,
  getPierceLeft = () => 0,
  getBloodPactHealCap = () => 0,
  now,
  random = Math.random,
} = {}) {
  const volleySpecs = [];
  const selectedShots = shots.slice(0, availableShots);
  for(const shot of selectedShots) {
    const angle = shot.angle;
    const sideX = Math.cos(angle + Math.PI / 2) * shot.offset;
    const sideY = Math.sin(angle + Math.PI / 2) * shot.offset;
    const crit = random() < (upg.critChance || 0);
    volleySpecs.push({
      x: player.x + sideX,
      y: player.y + sideY,
      vx: Math.cos(angle) * bulletSpeed,
      vy: Math.sin(angle) * bulletSpeed,
      radius: crit ? baseRadius * 1.28 : baseRadius,
      bounceLeft: (upg.bounceTier || 0) > 0 ? 2 : 0,
      pierceLeft: getPierceLeft(shot) + (shot.isSpreadExtra ? (upg.spreadShotPierceBonus || 0) : 0),
      homing: (upg.homingTier || 0) > 0,
      crit,
      dmg: baseDamage * overchargeBonus * overloadBonus * (shot.isSpreadExtra ? (upg.spreadShotDamageMult || 1) : 1),
      expireAt: now + lifeMs,
      extras: {
        isRing: shot.isRing || false,
        hasPayload: Boolean(upg.payload),
        bloodPactHeals: 0,
        bloodPactHealCap: getBloodPactHealCap(),
      },
    });
  }
  return volleySpecs;
}

export {
  createLaneOffsets,
  buildPlayerShotPlan,
  buildPlayerVolleySpecs,
};
