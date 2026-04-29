// ── RUN TELEMETRY CONTROLLER ────────────────────────────────────────────────
// Owns the `runTelemetry` + `currentRoomTelemetry` objects and the per-room
// recording surface (damage, heal, charge, control, kills, snapshots, etc.).
//
// Pure mutators (no hidden game globals) — all outer state is injected via the
// deps object as getters/callbacks. Script.js still owns hp/charge/UPG/score
// but calls through this controller for anything that mutates telemetry.

import {
  createRunTelemetry as createRunTelemetryValue,
  createRoomTelemetry as createRoomTelemetryValue,
  buildRunTelemetryPayload as buildRunTelemetryPayloadValue,
} from './telemetry.js';

export function roundTelemetryValue(value) {
  return Math.round(value * 100) / 100;
}

export function createRunTelemetryController({
  getHp,
  getMaxHp,
  getCharge,
  getUpg,
  getRoomPhase,
  getRoomTimer,
  getRoomIndex,
  getScore,
  getTookDamageThisRoom,
  getEnemies,
  getBullets,
  getPlayerColor,
  getViewportModeLabel,
  getCanvasSize,
  getVersionNum,
  getRequiredShotCount,
  getKineticChargeRate,
  onRoomClear, // (finalizedRoom) => void — awards room-clear + 5-room streak bonuses
} = {}) {
  let runTelemetry = null;
  let currentRoomTelemetry = null;

  function createRun() {
    const size = getCanvasSize();
    return createRunTelemetryValue({
      build: getVersionNum(),
      playerColor: getPlayerColor(),
      viewportMode: getViewportModeLabel(),
      canvasWidth: size.width,
      canvasHeight: size.height,
    });
  }

  function createRoom(roomNumber, roomDef) {
    const size = getCanvasSize();
    return createRoomTelemetryValue({
      roomNumber,
      roomDef,
      viewportMode: getViewportModeLabel(),
      canvasWidth: size.width,
      canvasHeight: size.height,
      hpStart: roundTelemetryValue(getHp()),
    });
  }

  function recordRoomPeakState() {
    if (!currentRoomTelemetry) return;
    const enemies = getEnemies();
    const bullets = getBullets();
    currentRoomTelemetry.pressure.peakEnemies = Math.max(
      currentRoomTelemetry.pressure.peakEnemies, enemies.length,
    );
    const liveDangerBullets = bullets.reduce(
      (count, bullet) => count + (bullet.state === 'danger' ? 1 : 0), 0,
    );
    currentRoomTelemetry.pressure.peakDangerBullets = Math.max(
      currentRoomTelemetry.pressure.peakDangerBullets, liveDangerBullets,
    );
  }

  function recordDangerBulletSpawn(count = 1) {
    if (!currentRoomTelemetry || count <= 0) return;
    currentRoomTelemetry.pressure.dangerBulletsSpawned += count;
  }

  function recordChargeGain(source, amount) {
    if (!currentRoomTelemetry || amount <= 0) return 0;
    const delta = roundTelemetryValue(amount);
    currentRoomTelemetry.charge[source] = roundTelemetryValue(
      (currentRoomTelemetry.charge[source] || 0) + delta,
    );
    return delta;
  }

  function recordChargeWasted(amount) {
    if (!currentRoomTelemetry || amount <= 0) return;
    currentRoomTelemetry.charge.wasted = roundTelemetryValue(
      (currentRoomTelemetry.charge.wasted || 0) + amount,
    );
  }

  function recordHeal(source, amount) {
    if (!currentRoomTelemetry || amount <= 0) return 0;
    const delta = roundTelemetryValue(amount);
    currentRoomTelemetry.heal[source] = roundTelemetryValue(
      (currentRoomTelemetry.heal[source] || 0) + delta,
    );
    currentRoomTelemetry.hpEnd = roundTelemetryValue(getHp());
    return delta;
  }

  function recordPlayerDamage(amount, source) {
    if (!currentRoomTelemetry || amount <= 0) return 0;
    const delta = roundTelemetryValue(amount);
    currentRoomTelemetry.hpLost = roundTelemetryValue(currentRoomTelemetry.hpLost + delta);
    currentRoomTelemetry.hitsTaken += 1;
    currentRoomTelemetry.damageless = false;
    currentRoomTelemetry.damage[source] = roundTelemetryValue(
      (currentRoomTelemetry.damage[source] || 0) + delta,
    );
    currentRoomTelemetry.hpEnd = roundTelemetryValue(getHp());
    return delta;
  }

  function recordShotSpend(count) {
    if (!currentRoomTelemetry || count <= 0) return;
    currentRoomTelemetry.offense.shotsFired += count;
    currentRoomTelemetry.offense.chargeSpent = roundTelemetryValue(
      currentRoomTelemetry.offense.chargeSpent + count,
    );
  }

  function recordControlTelemetry(dt, isStill) {
    if (!currentRoomTelemetry) return;
    const phase = getRoomPhase();
    if (!(phase === 'spawning' || phase === 'fighting')) return;
    const ms = dt * 1000;
    const control = currentRoomTelemetry.control;
    const charge = getCharge();
    const upg = getUpg();
    const enemies = getEnemies();
    if (isStill) control.stillMs = roundTelemetryValue(control.stillMs + ms);
    else control.movingMs = roundTelemetryValue(control.movingMs + ms);
    if (charge >= upg.maxCharge) control.fullChargeMs = roundTelemetryValue(control.fullChargeMs + ms);
    if (enemies.length > 0) {
      if (!isStill) control.movingWithEnemiesMs = roundTelemetryValue(control.movingWithEnemiesMs + ms);
      if (!isStill && charge >= 1) control.movingNoFireMs = roundTelemetryValue(control.movingNoFireMs + ms);
      if (isStill && charge >= 1) control.firingReadyMs = roundTelemetryValue(control.firingReadyMs + ms);
    }
  }

  function recordKill(source = 'output') {
    if (!currentRoomTelemetry) return;
    currentRoomTelemetry.kills += 1;
    if (source === 'orbit') currentRoomTelemetry.offense.orbitKills += 1;
    else currentRoomTelemetry.offense.outputKills += 1;
  }

  function captureTelemetrySnapshot(roomNumber) {
    if (!runTelemetry) return;
    const hp = getHp();
    const maxHp = getMaxHp();
    const charge = getCharge();
    const UPG = getUpg();
    const size = getCanvasSize();
    runTelemetry.snapshots.push({
      room: roomNumber,
      hp: roundTelemetryValue(hp),
      maxHp: roundTelemetryValue(maxHp),
      sps: roundTelemetryValue((UPG.sps || 0) * (UPG.heavyRoundsFireMult || 1)),
      maxCharge: roundTelemetryValue(UPG.maxCharge || 0),
      currentCharge: roundTelemetryValue(charge || 0),
      requiredShotCount: getRequiredShotCount(UPG),
      damageMult: roundTelemetryValue(
        (UPG.playerDamageMult || 1) * (UPG.denseDamageMult || 1) * (UPG.heavyRoundsDamageMult || 1)
        * Math.min(1.45, 1 + Math.min(UPG.sustainedFireShots || 0, 15) * 0.03)
        * Math.max(0.5, 1 - (UPG.spsTier || 0) * 0.04),
      ),
      denseTier: UPG.denseTier || 0,
      denseDamageMult: roundTelemetryValue(UPG.denseDamageMult || 1),
      chargeCapTier: UPG.chargeCapTier || 0,
      chargeCapMult: roundTelemetryValue(UPG.chargeCapMult || 1),
      chargeCapFlatTier: UPG.chargeCapFlatTier || 0,
      chargeCapFlatBonus: roundTelemetryValue(UPG.chargeCapFlatBonus || 0),
      damageReductionPct: roundTelemetryValue((1 - (UPG.damageTakenMult || 1)) * 100),
      critChancePct: roundTelemetryValue((UPG.critChance || 0) * 100),
      moveChargeRate: roundTelemetryValue(getKineticChargeRate(UPG) * (UPG.fluxState ? 2 : 1)),
      shieldCount: UPG.shieldTier || 0,
      orbitCount: UPG.orbitSphereTier || 0,
      conduit: Boolean(UPG.conduit),
      playerSizeMult: roundTelemetryValue(UPG.playerSizeMult || 1),
      viewportMode: getViewportModeLabel(),
      canvasWidth: size.width,
      canvasHeight: size.height,
    });
  }

  function startRoomTelemetry(roomNumber, roomDef) {
    if (!runTelemetry) runTelemetry = createRun();
    const size = getCanvasSize();
    runTelemetry.meta = {
      ...runTelemetry.meta,
      build: getVersionNum(),
      playerColor: getPlayerColor(),
      viewportMode: getViewportModeLabel(),
      canvasWidth: size.width,
      canvasHeight: size.height,
    };
    currentRoomTelemetry = createRoom(roomNumber, roomDef);
    captureTelemetrySnapshot(roomNumber);
  }

  function finalizeCurrentRoomTelemetry(endState, clearMs) {
    if (!currentRoomTelemetry || !runTelemetry) return;
    const effectiveClearMs = clearMs == null ? getRoomTimer() : clearMs;
    currentRoomTelemetry.end = endState;
    currentRoomTelemetry.clearMs = Math.round(effectiveClearMs);
    currentRoomTelemetry.hpEnd = roundTelemetryValue(getHp());
    currentRoomTelemetry.damageless = currentRoomTelemetry.damageless && !getTookDamageThisRoom();
    runTelemetry.rooms.push(currentRoomTelemetry);
    const finalized = currentRoomTelemetry;
    if (endState === 'clear' && typeof onRoomClear === 'function') {
      onRoomClear(finalized);
    }
    currentRoomTelemetry = null;
  }

  function buildRunTelemetryPayload() {
    return buildRunTelemetryPayloadValue({
      runTelemetry,
      currentRoomTelemetry,
      hp: getHp(),
      tookDamageThisRoom: getTookDamageThisRoom(),
      roomTimer: getRoomTimer(),
      roomIndex: getRoomIndex(),
      score: getScore(),
      roundTelemetryValue,
    });
  }

  return {
    // record/mutate
    recordRoomPeakState,
    recordDangerBulletSpawn,
    recordChargeGain,
    recordChargeWasted,
    recordHeal,
    recordPlayerDamage,
    recordShotSpend,
    recordControlTelemetry,
    recordKill,
    captureTelemetrySnapshot,
    startRoomTelemetry,
    finalizeCurrentRoomTelemetry,
    buildRunTelemetryPayload,
    // factories (for persistence/save-restore edge cases)
    createRunTelemetry: createRun,
    // state accessors for inline mutation sites and save/restore
    getRun: () => runTelemetry,
    getCurrentRoom: () => currentRoomTelemetry,
    setRun: (v) => { runTelemetry = v; },
    setCurrentRoom: (v) => { currentRoomTelemetry = v; },
    resetRun: () => {
      runTelemetry = createRun();
      currentRoomTelemetry = null;
    },
    // pure helper (re-exposed for call sites that formatted raw values)
    roundTelemetryValue,
  };
}
