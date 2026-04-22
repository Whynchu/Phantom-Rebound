function createRunTelemetry({
  build,
  playerColor,
  viewportMode,
  canvasWidth,
  canvasHeight,
}) {
  return {
    meta: {
      build,
      playerColor,
      viewportMode,
      canvasWidth,
      canvasHeight,
    },
    rooms: [],
    snapshots: [],
  };
}

function cloneWaveEntries(waves = []) {
  return waves.map((wave) => wave.map((entry) => ({
    t: entry.t,
    n: entry.n,
    d: entry.d || 0,
    ...(entry.isBoss ? { isBoss: true } : {}),
    ...(entry.bossScale && entry.bossScale !== 1 ? { bossScale: entry.bossScale } : {}),
  })));
}

function summarizeWaveEntries(waves = []) {
  return waves.map((wave) => wave.map((entry) => `${entry.t}x${entry.n}`).join(', ')).join(' | ');
}

function createRoomTelemetry({
  roomNumber,
  roomDef,
  viewportMode,
  canvasWidth,
  canvasHeight,
  hpStart,
}) {
  return {
    room: roomNumber,
    name: roomDef.name,
    boss: Boolean(roomDef.isBossRoom),
    viewportMode,
    canvasWidth,
    canvasHeight,
    hpStart,
    layoutSource: roomDef.layoutSource || (roomDef.isBossRoom ? 'boss' : 'generated'),
    layoutSummary: summarizeWaveEntries(roomDef.waves),
    layout: cloneWaveEntries(roomDef.waves),
    hpEnd: hpStart,
    hpLost: 0,
    hitsTaken: 0,
    kills: 0,
    shotsFired: 0,
    nearMisses: 0,
    overkillDamage: 0,
    clearMs: 0,
    damageless: true,
    end: 'active',
    heal: {
      vampiric: 0,
      bloodPact: 0,
      roomRegen: 0,
      bossReward: 0,
    },
    charge: {
      greyAbsorb: 0,
      orbAbsorb: 0,
      resonantAbsorb: 0,
      kinetic: 0,
      vampiric: 0,
      barrierPulse: 0,
      hitReward: 0,
      slipstream: 0,
      corona: 0,
      finalForm: 0,
      wasted: 0,
    },
    offense: {
      shotsFired: 0,
      chargeSpent: 0,
      outputKills: 0,
      orbitKills: 0,
    },
    control: {
      movingMs: 0,
      stillMs: 0,
      movingWithEnemiesMs: 0,
      movingNoFireMs: 0,
      firingReadyMs: 0,
      fullChargeMs: 0,
    },
    damage: {
      projectile: 0,
      contact: 0,
    },
    pressure: {
      dangerBulletsSpawned: 0,
      peakDangerBullets: 0,
      peakEnemies: 0,
    },
    safety: {
      shieldBlocks: 0,
      phaseDashProcs: 0,
      mirrorTideProcs: 0,
    },
  };
}

function buildRunTelemetryPayload({
  runTelemetry,
  currentRoomTelemetry,
  hp,
  tookDamageThisRoom,
  roomTimer,
  roomIndex,
  score,
  roundTelemetryValue,
}) {
  if(!runTelemetry) return null;
  const activeRoomSnapshot = currentRoomTelemetry
    ? {
      ...currentRoomTelemetry,
      end: currentRoomTelemetry.end === 'active' ? 'snapshot' : currentRoomTelemetry.end,
      clearMs: Math.round(roomTimer),
      hpEnd: roundTelemetryValue(hp),
      damageless: currentRoomTelemetry.damageless && !tookDamageThisRoom,
    }
    : null;
  const rooms = activeRoomSnapshot ? [...runTelemetry.rooms, activeRoomSnapshot] : runTelemetry.rooms;
  const summary = rooms.reduce((acc, room) => {
    acc.roomsTracked += 1;
    if(room.end === 'clear') acc.roomsCleared += 1;
    acc.totalHpLost = roundTelemetryValue(acc.totalHpLost + (room.hpLost || 0));
    acc.totalKills += room.kills || 0;
    acc.totalDangerBulletsSpawned += room.pressure?.dangerBulletsSpawned || 0;
    acc.totalShieldBlocks += room.safety?.shieldBlocks || 0;
    acc.totalPhaseDashProcs += room.safety?.phaseDashProcs || 0;
    acc.totalMirrorTideProcs += room.safety?.mirrorTideProcs || 0;
    acc.totalShotsFired += room.offense?.shotsFired || 0;
    acc.totalChargeSpent = roundTelemetryValue(acc.totalChargeSpent + (room.offense?.chargeSpent || 0));
    acc.totalChargeWasted = roundTelemetryValue(acc.totalChargeWasted + (room.charge?.wasted || 0));
    acc.totalOutputKills += room.offense?.outputKills || 0;
    acc.totalOrbitKills += room.offense?.orbitKills || 0;
    acc.totalMovingNoFireMs = roundTelemetryValue(acc.totalMovingNoFireMs + (room.control?.movingNoFireMs || 0));
    acc.totalFiringReadyMs = roundTelemetryValue(acc.totalFiringReadyMs + (room.control?.firingReadyMs || 0));
    acc.totalFullChargeMs = roundTelemetryValue(acc.totalFullChargeMs + (room.control?.fullChargeMs || 0));
    for(const [key, value] of Object.entries(room.heal || {})) {
      acc.heal[key] = roundTelemetryValue((acc.heal[key] || 0) + (value || 0));
    }
    for(const [key, value] of Object.entries(room.charge || {})) {
      acc.charge[key] = roundTelemetryValue((acc.charge[key] || 0) + (value || 0));
    }
    return acc;
  }, {
    roomsTracked: 0,
    roomsCleared: 0,
    totalHpLost: 0,
    totalKills: 0,
    totalDangerBulletsSpawned: 0,
    totalShieldBlocks: 0,
    totalPhaseDashProcs: 0,
    totalMirrorTideProcs: 0,
    totalShotsFired: 0,
    totalChargeSpent: 0,
    totalChargeWasted: 0,
    totalOutputKills: 0,
    totalOrbitKills: 0,
    totalMovingNoFireMs: 0,
    totalFiringReadyMs: 0,
    totalFullChargeMs: 0,
    heal: {},
    charge: {},
  });

  return {
    meta: {
      ...runTelemetry.meta,
      finalRoom: roomIndex + 1,
      finalScore: score,
    },
    summary,
    snapshots: runTelemetry.snapshots,
    rooms,
  };
}

export { createRunTelemetry, createRoomTelemetry, buildRunTelemetryPayload };
