function getUnlockedEnemyTypes(roomIdx, enemyTypes) {
  return Object.entries(enemyTypes)
    .filter(([, def]) => roomIdx >= def.unlockRoom)
    .map(([type]) => type);
}

function weightedPick(candidates, randomFn = Math.random) {
  const total = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
  let roll = randomFn() * total;
  for(const candidate of candidates) {
    roll -= candidate.weight;
    if(roll <= 0) return candidate.type;
  }
  return candidates[candidates.length - 1].type;
}

const LATE_PREMIUM_TYPES = new Set([
  'triangle',
  'purple_chaser',
  'purple_disruptor',
  'purple_zoner',
  'orange_zoner',
]);

function generateWeightedWave(roomIdx, enemyTypes, randomFn = Math.random) {
  const unlocked = getUnlockedEnemyTypes(roomIdx, enemyTypes);
  const entries = new Map();
  const earlyRoomBudgetPenalty = roomIdx >= 12 && roomIdx <= 14 ? 2.25 : 0;
  const room20BudgetBonus = Math.max(0, roomIdx - 19) * 0.55;
  const room40BudgetBonus = Math.max(0, roomIdx - 39) * 0.55;
  const room80BudgetBonus = Math.max(0, roomIdx - 79) * 0.85;
  const budgetBase = 5.0 + roomIdx * 1.35 + room20BudgetBonus + room40BudgetBonus + room80BudgetBonus - earlyRoomBudgetPenalty;
  let budget = budgetBase;
  let shooterCount = 0;
  let siphonCount = 0;
  const maxTypes = roomIdx >= 60 ? 5 : (roomIdx >= 15 ? 4 : 2);

  if(roomIdx === 9) {
    entries.set('purple_chaser', 1);
    budget -= enemyTypes.purple_chaser.spawnValue;
    shooterCount += 1;
  }

  while(budget >= 2) {
    const candidates = unlocked
      .filter((type) => roomIdx > 9 || (type !== 'purple_chaser' && type !== 'purple_disruptor'))
      .filter((type) => type !== 'purple_chaser' || roomIdx >= 14)
      .filter((type) => type !== 'purple_disruptor' || roomIdx >= 15)
      .filter((type) => enemyTypes[type].spawnValue <= budget + 0.5)
      .filter((type) => entries.size < maxTypes || entries.has(type))
      .filter((type) => {
        if(type === 'siphon' && entries.size === 0) return false;
        if(type === 'siphon' && siphonCount >= (roomIdx >= 60 ? 2 : 1)) return false;
        if(roomIdx >= 12 && roomIdx <= 14 && ['zoner','disruptor','purple_chaser','purple_disruptor'].includes(type) && shooterCount >= 1) {
          return false;
        }
        if(roomIdx >= 20 && roomIdx < 30 && entries.has('triangle')) {
          return !['zoner','purple_disruptor','purple_chaser','disruptor'].includes(type);
        }
        return true;
      })
      .map((type) => {
        const def = enemyTypes[type];
        const pressureBias = def.ammoPressure > 0 ? 1.15 : (def.isSiphon ? 0.28 : 0.78);
        const affordabilityPower = roomIdx >= 40 ? 0.82 : 1;
        const affordability = 1 / Math.pow(def.spawnValue, affordabilityPower);
        const roomBias = 1 + Math.min(1.2, Math.max(0, roomIdx - def.unlockRoom) * 0.08);
        const lateThreatBias = roomIdx >= 40 ? 1 + Math.min(0.22, Math.max(0, def.spawnValue - 4) * 0.04) : 1;
        const premiumBias = roomIdx >= 40 && LATE_PREMIUM_TYPES.has(type)
          ? 1 + Math.min(0.2, 0.08 + Math.max(0, roomIdx - 39) * 0.004)
          : 1;
        return { type, weight: pressureBias * affordability * roomBias * lateThreatBias * premiumBias };
      });

    if(candidates.length === 0) break;
    const type = weightedPick(candidates, randomFn);
    entries.set(type, (entries.get(type) || 0) + 1);
    budget -= enemyTypes[type].spawnValue;
    if(enemyTypes[type].ammoPressure > 0) shooterCount++;
    if(enemyTypes[type].isSiphon) siphonCount++;
  }

  if(shooterCount === 0) {
    entries.set('chaser', (entries.get('chaser') || 0) + 1);
  }
  if(entries.size === 1 && entries.has('siphon')) {
    entries.delete('siphon');
    entries.set('chaser', 2);
    entries.set(roomIdx >= 20 ? 'disruptor' : 'sniper', 1);
    if(roomIdx >= 8) entries.set('siphon', 1);
  }
  if(entries.has('siphon') && entries.size < 3) {
    const supportShooter = roomIdx >= 20 ? 'disruptor' : 'sniper';
    entries.set(supportShooter, (entries.get(supportShooter) || 0) + 1);
  }

  return [...entries.entries()].map(([t, n]) => ({ t, n, d: 0 }));
}

function buildSpawnQueue(roomDef) {
  const queue = [];
  let waveStartAt = 0;
  roomDef.waves.forEach((wave, waveIndex) => {
    let waveMaxDelay = 0;
    for(const entry of wave) {
      for(let i = 0; i < entry.n; i++) {
        const spawnDelay = (entry.d || 0) * i;
        const spawnAt = waveStartAt + spawnDelay;
        waveMaxDelay = Math.max(waveMaxDelay, spawnDelay);
        queue.push({
          t: entry.t,
          spawnAt,
          isBoss: Boolean(entry.isBoss),
          waveIndex,
          bossScale: entry.bossScale || 1,
        });
      }
    }
    waveStartAt += waveMaxDelay + 1800;
  });
  queue.sort((a, b) => a.spawnAt - b.spawnAt);
  return queue;
}

export {
  getUnlockedEnemyTypes,
  weightedPick,
  generateWeightedWave,
  buildSpawnQueue,
};
