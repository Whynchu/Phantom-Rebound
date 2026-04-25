function createInitialPlayerState(width, height) {
  return {
    x: width / 2,
    y: height / 2,
    r: 9,
    vx: 0,
    vy: 0,
    phaseWalkOverlapMs: 0,
    phaseWalkIdleMs: 0,
    invincible: 0,
    distort: 0,
    deadAt: 0,
    popAt: 0,
    deadPop: false,
    deadPulse: 0,
    shields: [],
  };
}

function createInitialRunMetrics(basePlayerHp) {
  return {
    score: 0,
    kills: 0,
    charge: 0,
    fireT: 0,
    stillTimer: 0,
    prevStill: false,
    hp: basePlayerHp,
    maxHp: basePlayerHp,
    runElapsedMs: 0,
    gameOverShown: false,
    boonRerolls: 1,
    damagelessRooms: 0,
    tookDamageThisRoom: false,
    lastStallSpawnAt: -99999,
    enemyIdSeq: 1,
    bossClears: 0,
  };
}

function createInitialRuntimeTimers() {
  return {
    barrierPulseTimer: 0,
    slipCooldown: 0,
    absorbComboCount: 0,
    absorbComboTimer: 0,
    chainMagnetTimer: 0,
    echoCounter: 0,
    vampiricRestoresThisRoom: 0,
    killSustainHealedThisRoom: 0,
    colossusShockwaveCd: 0,
    // R0.4 step 1 (rubber-duck fix): this was missing from the
    // structured run-init bundle, which left _volatileOrbGlobalCooldown
    // un-reset across runs (it relied on the bare-field assignment in
    // script.js). Adding it here closes the gap so re-init zeroes it
    // alongside the other timers.
    volatileOrbGlobalCooldown: 0,
  };
}

export { createInitialPlayerState, createInitialRunMetrics, createInitialRuntimeTimers };
