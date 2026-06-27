const ANOMALY_KIND_HUNTER_SEAL = 'hunterSeal';
const HUNTER_SEAL_UNLOCK_ROOM = 12;
const HUNTER_SEAL_ROLL_CHANCE = 0.14;
const HUNTER_SEAL_AURA_RADIUS = 132;
const HUNTER_SEAL_FIRE_ACCEL = 0.22;
const HUNTER_SEAL_REWARD_RADIUS = 156;
const HUNTER_SEAL_CHARGE_GAIN = 2;

function createInactiveAnomalyState() {
  return {
    active: false,
    kind: null,
    anchorId: null,
    assigned: false,
    rewardClaimed: false,
  };
}

function shouldRollAnomalyRoom({ roomIndex = 0, isBossRoom = false, random = Math.random } = {}) {
  if(isBossRoom) return false;
  if(roomIndex < HUNTER_SEAL_UNLOCK_ROOM) return false;
  return random() < HUNTER_SEAL_ROLL_CHANCE;
}

function createRoomAnomalyState({ roomIndex = 0, isBossRoom = false, random = Math.random } = {}) {
  if(!shouldRollAnomalyRoom({ roomIndex, isBossRoom, random })) {
    return createInactiveAnomalyState();
  }
  return {
    active: true,
    kind: ANOMALY_KIND_HUNTER_SEAL,
    anchorId: null,
    assigned: false,
    rewardClaimed: false,
  };
}

function isEligibleAnomalyAnchor(enemy) {
  if(!enemy) return false;
  if(enemy.dead || enemy.alive === false) return false;
  if(enemy.isBoss) return false;
  if(!Number.isFinite(enemy.x) || !Number.isFinite(enemy.y)) return false;
  if((enemy.hp ?? 1) <= 0) return false;
  return true;
}

function selectAnomalyAnchor(enemies, { random = Math.random } = {}) {
  const eligible = Array.isArray(enemies) ? enemies.filter(isEligibleAnomalyAnchor) : [];
  if(eligible.length === 0) return null;
  return eligible[Math.floor(random() * eligible.length)];
}

function applyAnomalyAnchor(enemy, anomalyState) {
  if(!enemy || !anomalyState?.active || anomalyState.assigned) return anomalyState;
  enemy.isAnomalyAnchor = true;
  enemy.anomalyKind = anomalyState.kind || ANOMALY_KIND_HUNTER_SEAL;
  return {
    ...anomalyState,
    anchorId: enemy.eid ?? enemy.id ?? null,
    assigned: true,
  };
}

function assignAnomalyAnchor(enemies, anomalyState, { random = Math.random } = {}) {
  if(!anomalyState?.active || anomalyState.assigned) return anomalyState || createInactiveAnomalyState();
  const anchor = selectAnomalyAnchor(enemies, { random });
  if(!anchor) return anomalyState;
  return applyAnomalyAnchor(anchor, anomalyState);
}

function findAnomalyAnchor(enemies, anomalyState) {
  if(!anomalyState?.active || !anomalyState.assigned) return null;
  return (Array.isArray(enemies) ? enemies : []).find((enemy) => {
    if(!isEligibleAnomalyAnchor(enemy)) return false;
    if(enemy.isAnomalyAnchor) return true;
    return anomalyState.anchorId != null && (enemy.eid ?? enemy.id ?? null) === anomalyState.anchorId;
  }) || null;
}

function getHunterSealAura(enemy, anchor, {
  radius = HUNTER_SEAL_AURA_RADIUS,
  fireAccel = HUNTER_SEAL_FIRE_ACCEL,
} = {}) {
  if(!isEligibleAnomalyAnchor(enemy) || !isEligibleAnomalyAnchor(anchor)) return null;
  if(enemy === anchor) return null;
  const distance = Math.hypot((enemy.x || 0) - (anchor.x || 0), (enemy.y || 0) - (anchor.y || 0));
  if(distance > radius + (enemy.r || 0)) return null;
  const proximity = 1 - Math.max(0, Math.min(1, distance / Math.max(1, radius)));
  return {
    distance,
    radius,
    fireAccel: fireAccel * (0.55 + proximity * 0.45),
  };
}

function getAnomalyPressure(enemy, enemies, anomalyState) {
  if(!anomalyState?.active || anomalyState.kind !== ANOMALY_KIND_HUNTER_SEAL) return null;
  const anchor = findAnomalyAnchor(enemies, anomalyState);
  if(!anchor) return null;
  return getHunterSealAura(enemy, anchor);
}

function resolveAnomalyAnchorDeath(anomalyState, enemy, bullets, {
  rewardRadius = HUNTER_SEAL_REWARD_RADIUS,
  chargeGain = HUNTER_SEAL_CHARGE_GAIN,
} = {}) {
  if(!anomalyState?.active || anomalyState.rewardClaimed) {
    return { triggered: false, nextAnomaly: anomalyState || createInactiveAnomalyState(), clearedBulletIndexes: [] };
  }
  const enemyId = enemy?.eid ?? enemy?.id ?? null;
  const isAnchor = Boolean(enemy?.isAnomalyAnchor)
    || (anomalyState.anchorId != null && enemyId === anomalyState.anchorId);
  if(!isAnchor) {
    return { triggered: false, nextAnomaly: anomalyState, clearedBulletIndexes: [] };
  }

  const clearedBulletIndexes = [];
  for(let i = 0; i < (Array.isArray(bullets) ? bullets.length : 0); i++) {
    const bullet = bullets[i];
    if(!bullet || bullet.state !== 'danger') continue;
    const distance = Math.hypot((bullet.x || 0) - (enemy.x || 0), (bullet.y || 0) - (enemy.y || 0));
    if(distance <= rewardRadius + (bullet.r || 0)) clearedBulletIndexes.push(i);
  }

  return {
    triggered: true,
    nextAnomaly: {
      ...anomalyState,
      rewardClaimed: true,
      active: false,
    },
    clearedBulletIndexes,
    chargeGain,
    rewardRadius,
  };
}

export {
  ANOMALY_KIND_HUNTER_SEAL,
  HUNTER_SEAL_AURA_RADIUS,
  HUNTER_SEAL_REWARD_RADIUS,
  createInactiveAnomalyState,
  shouldRollAnomalyRoom,
  createRoomAnomalyState,
  isEligibleAnomalyAnchor,
  selectAnomalyAnchor,
  applyAnomalyAnchor,
  assignAnomalyAnchor,
  findAnomalyAnchor,
  getHunterSealAura,
  getAnomalyPressure,
  resolveAnomalyAnchorDeath,
};
