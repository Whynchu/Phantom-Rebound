import { C, ROOM_SCRIPTS, BOSS_ROOMS, DECAY_BASE, M, VERSION } from './src/data/gameData.js';
import { CHARGED_ORB_FIRE_INTERVAL_MS, ESCALATION_KILL_PCT, ESCALATION_MAX_BONUS, getActiveBoonEntries, getDefaultUpgrades, getRequiredShotCount, syncChargeCapacity, getEvolvedBoon, checkLegendarySequences, getLateBloomGrowth, LATE_BLOOM_SPEED_PENALTY, LATE_BLOOM_DAMAGE_TAKEN_PENALTY, LATE_BLOOM_DAMAGE_PENALTY } from './src/data/boons.js';
import { ENEMY_TYPES, createEnemy, canEnemyUsePurpleShots } from './src/entities/enemyTypes.js';
import { JOY_DEADZONE, JOY_MAX, createJoystickState, resetJoystickState, bindJoystickControls, tickJoystick } from './src/input/joystick.js';
import { fetchRemoteLeaderboard, submitRemoteScore } from './src/platform/leaderboardService.js';
import { bindResponsiveViewport } from './src/platform/viewport.js';
import { showBoonSelection } from './src/ui/boonSelection.js';
import { renderVersionTag } from './src/ui/versionTag.js';
import { PLAYER_COLORS, getPlayerColor, getPlayerColorScheme, getThreatPalette } from './src/data/colorScheme.js';
import { PATCH_NOTES, PATCH_NOTES_ARCHIVE_MESSAGE } from './src/data/patchNotes.js';
import { renderColorSelector } from './src/ui/colorSelector.js';

renderVersionTag(VERSION);

// 🐰 Easter seasonal flag — show bunny ears on Easter weekend
const _now = new Date();
const _isEaster = (_now.getMonth() === 3 && _now.getDate() >= 4 && _now.getDate() <= 6); // Apr 4-6

// Suppress iOS Safari magnifier / long-press context menu on the whole page
document.addEventListener('contextmenu', (e) => e.preventDefault());
// Block dblclick — iOS can route double-tap zoom through this even when CSS manipulation is set
document.addEventListener('dblclick', (e) => e.preventDefault());
let startDangerCopy;

function revealAppShell() {
  requestAnimationFrame(() => {
    document.body.classList.remove('app-loading');
    document.body.classList.add('app-ready');
  });
}

function syncColorDrivenCopy() {
  if(startDangerCopy) startDangerCopy.textContent = `${getThreatPalette().dangerKey} rounds`;
}

window.addEventListener('phantom:player-color-change', (event) => {
  syncColorDrivenCopy(event.detail?.scheme || getPlayerColorScheme());
});

const cv  = document.getElementById('cv');
const ctx = cv.getContext('2d');
const LB_KEY = 'phantom-rebound-leaderboard-v1';
const NAME_KEY = 'phantom-rebound-runner-name';

const nameInputStart = document.getElementById('name-input-start');
const nameInputGo = document.getElementById('name-input-go');
const startScreen = document.getElementById('s-start');
const gameOverScreen = document.getElementById('s-go');
const lbScreen = document.getElementById('s-lb');
const lbOpenBtn = document.getElementById('btn-lb-open');
const lbOpenBtnGo = document.getElementById('btn-lb-open-go');
const lbCloseBtn = document.getElementById('btn-lb-close');
startDangerCopy = document.getElementById('start-danger-copy');
const lbCurrent = document.getElementById('lb-current');
const lbStatus = document.getElementById('lb-status');
const lbList = document.getElementById('leaderboard-list');
const patchNotesBtn = document.getElementById('btn-patch-notes');
const patchNotesPanel = document.getElementById('patch-notes-panel');
const patchNotesCurrent = document.getElementById('patch-notes-current');
const patchNotesList = document.getElementById('patch-notes-list');
const patchNotesArchiveNote = document.getElementById('patch-notes-archive-note');
const patchNotesCloseBtn = document.getElementById('btn-patch-notes-close');
const lbPeriodBtns = document.querySelectorAll('[data-lb-period]');
const lbScopeBtns = document.querySelectorAll('[data-lb-scope]');
const goBoonsBtn = document.getElementById('btn-go-boons');
const goBoonsPanel = document.getElementById('go-boons-panel');
const goBoonsList = document.getElementById('go-boons-list');
const goBoonsCloseBtn = document.getElementById('btn-go-boons-close');
const mainMenuBtn = document.getElementById('btn-main-menu');
const wrap = document.getElementById('wrap');
const topHud = document.getElementById('top-hud');
const botHud = document.getElementById('bot-hud');
const legend = document.getElementById('legend');

function setMenuChromeVisible(isVisible) {
  document.body.classList.toggle('menu-chrome-visible', isVisible);
  resize();
}

function resize() {
  const BASE_ARENA_ASPECT = 1.18;
  const MAX_ARENA_ASPECT = 1.34;
  const viewportWidth = window.visualViewport?.width || window.innerWidth;
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  document.body.classList.toggle('compact-viewport', viewportHeight < 780);
  document.body.classList.toggle('tight-viewport', viewportHeight < 700);

  const setCanvasSize = (width, height = Math.floor(width * BASE_ARENA_ASPECT)) => {
    const nextWidth = Math.max(240, Math.floor(width));
    const nextHeight = Math.max(Math.floor(nextWidth * BASE_ARENA_ASPECT), Math.floor(height));
    cv.width = nextWidth;
    cv.height = nextHeight;
  };

  const maxWidthByViewport = Math.min(400, viewportWidth - 16);
  setCanvasSize(maxWidthByViewport);

  const wrapGap = parseFloat(getComputedStyle(wrap).gap) || 0;
  const bodyStyle = getComputedStyle(document.body);
  const bodyPadTop = parseFloat(bodyStyle.paddingTop) || 0;
  const bodyPadBottom = parseFloat(bodyStyle.paddingBottom) || 0;
  const availableHeight = viewportHeight - bodyPadTop - bodyPadBottom;
  const visibleFlowItems = [...wrap.children].filter((child) => {
    const style = getComputedStyle(child);
    return style.display !== 'none' && style.position !== 'absolute';
  });
  const visibleGapCount = Math.max(0, visibleFlowItems.length - 1);
  const nonCanvasHeight =
    (topHud?.getBoundingClientRect().height || 0) +
    (botHud?.getBoundingClientRect().height || 0) +
    (legend?.getBoundingClientRect().height || 0) +
    wrapGap * visibleGapCount;
  const availableCanvasHeight = Math.max(0, availableHeight - nonCanvasHeight);
  const maxWidthByHeight = Math.floor(availableCanvasHeight / BASE_ARENA_ASPECT);
  const finalWidth = Math.min(maxWidthByViewport, maxWidthByHeight > 0 ? maxWidthByHeight : maxWidthByViewport);
  const baseHeight = Math.floor(finalWidth * BASE_ARENA_ASPECT);
  const extendedHeightCap = Math.floor(finalWidth * MAX_ARENA_ASPECT);
  const finalHeight = Math.max(baseHeight, Math.min(availableCanvasHeight, extendedHeightCap));
  setCanvasSize(finalWidth, finalHeight);

  cv.style.width = `${cv.width}px`;
  cv.style.height = `${cv.height}px`;
}
bindResponsiveViewport(resize);


// ── PLAYER UPGRADES ───────────────────────────────────────────────────────────
let UPG = getDefaultUpgrades();
function resetUpgrades() {
  UPG = getDefaultUpgrades();
}

function syncRunChargeCapacity() {
  syncChargeCapacity(UPG);
  charge = Math.min(charge, UPG.maxCharge);
}

function getEnemyGreyDropCount() {
  return getRequiredShotCount(UPG);
}

function renderGameOverBoons() {
  if(!goBoonsList) return;
  const entries = getActiveBoonEntries(UPG);
  goBoonsList.innerHTML = '';
  if(entries.length === 0) {
    goBoonsList.innerHTML = '<div class="up-active-empty">No boons collected this run.</div>';
    return;
  }
  for(const entry of entries) {
    const row = document.createElement('div');
    row.className = 'up-active-item';
    row.innerHTML = `<div class="up-active-icon">${entry.icon}</div><div class="up-active-copy"><div class="up-active-name">${entry.name}</div><div class="up-active-detail">${entry.detail}</div></div>`;
    goBoonsList.appendChild(row);
  }
}

function syncPlayerScale() {
  if(!player) return;
  player.r = 9 * (UPG.playerSizeMult || 1);
}

function renderPatchNotes() {
  if(!patchNotesCurrent || !patchNotesList || !patchNotesArchiveNote) return;
  patchNotesCurrent.textContent = `Current live build: v${VERSION.num} — ${VERSION.label}`;
  patchNotesArchiveNote.textContent = PATCH_NOTES_ARCHIVE_MESSAGE;
  patchNotesList.innerHTML = '';
  for(const note of PATCH_NOTES) {
    const card = document.createElement('section');
    card.className = 'patch-note-entry';
    const paragraphs = note.summary
      .map((paragraph) => `<p class="patch-note-paragraph">${paragraph}</p>`)
      .join('');
    const highlights = (note.highlights || [])
      .map((item) => `<div class="patch-note-highlight">${item}</div>`)
      .join('');
    card.innerHTML = `
      <div class="patch-note-meta">
        <div class="patch-note-version">v${note.version}</div>
        <div class="patch-note-label">${note.label}</div>
      </div>
      <div class="patch-note-copy">
        ${paragraphs}
        <div class="patch-note-highlights">${highlights}</div>
      </div>
    `;
    patchNotesList.appendChild(card);
  }
}

function setPatchNotesOpen(isOpen) {
  if(!patchNotesPanel) return;
  patchNotesPanel.classList.toggle('off', !isOpen);
  patchNotesPanel.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
}

// ── STATE ─────────────────────────────────────────────────────────────────────
let gstate = 'start';
let player = {};
let bullets = [], enemies = [], particles = [];
let score=0, kills=0;
let charge=0, fireT=0, stillTimer=0, prevStill=false;
let hp=100, maxHp=100;
const joy = createJoystickState();
const GAME_OVER_ANIM_MS = 850;
const SHIELD_HALF_W = 9;
const SHIELD_HALF_H = 4.5;
const STALL_SPAWN_COOLDOWN_MS = 2600;
const SHIELD_ORBIT_R    = 35;   // orbital radius of shield orbs from player center (px)
const SHIELD_COOLDOWN   = 4.5;  // seconds a shield is inactive after absorbing a bullet (baseline; reduced by Swift Ward)
const SHIELD_ROTATION_SPD  = 0.001; // radians per millisecond (≈1 rev / 6.3 s)
const ORBIT_SPHERE_R    = 40;   // orbital radius of passive orbit spheres (px)
const ORBIT_ROTATION_SPD   = 0.003; // radians per millisecond (≈1 rev / 2.1 s)
const PLAYER_SHOT_LIFE_MS = 1100;
const DENSE_DESPERATION_BONUS = 2.4;
const CRIT_DAMAGE_FACTOR = 2.4;
const MIRROR_SHIELD_DAMAGE_FACTOR = 0.60;
const AEGIS_NOVA_DAMAGE_FACTOR = 0.55;
const VOLATILE_ORB_COOLDOWN = 8;
const VOLATILE_ORB_SHARED_COOLDOWN = 1.0;
let enemyIdSeq = 1;
let playerName = 'RUNNER';
let leaderboard = [];
let lbPeriod = 'daily';
let lbScope = 'everyone';
let remoteLeaderboardRows = [];
let useRemoteLeaderboardRows = false;
let lbStatusMode = 'local';
let lbStatusText = 'LOCAL ONLY';
let lbRequestSeq = 0;
let raf=0, lastT=0;
let gameOverShown = false;
let boonRerolls = 1;
let damagelessRooms = 0;
let tookDamageThisRoom = false;
let lastStallSpawnAt = -99999;
let _barrierPulseTimer = 0;
let _slipCooldown = 0;
let _absorbComboCount = 0, _absorbComboTimer = 0;
let _chainMagnetTimer = 0;
let _echoCounter = 0;
let _vampiricRestoresThisRoom = 0;
let _colossusShockwaveCd = 0;
let _orbFireTimers = [];
let _orbCooldown = [];
let _volatileOrbGlobalCooldown = 0;
let boonHistory = [];
let pendingLegendary = null;
let legendaryOffered = false;

// Room system
let roomIndex = 0;
let roomPhase = 'intro';
let roomTimer = 0;
let spawnQueue = [];
let roomClearTimer = 0;
let roomPurpleShooterAssigned = false;
let roomIntroTimer = 0;
const ROOM_NAMES = ROOM_SCRIPTS.map((room) => room.name);

// Boss room state
let bossAlive = false;
let escortType = '';
let escortMaxCount = 2;
let escortRespawnTimer = 0;
let reinforceTimer = 0;
let currentRoomIsBoss = false;
let currentRoomMaxOnScreen = 99;
let runTelemetry = null;
let currentRoomTelemetry = null;

function roundTelemetryValue(value) {
  return Math.round(value * 100) / 100;
}

function getViewportModeLabel() {
  if(document.body.classList.contains('tight-viewport')) return 'tight';
  if(document.body.classList.contains('compact-viewport')) return 'compact';
  return 'default';
}

function createRunTelemetry() {
  return {
    meta: {
      build: VERSION.num,
      playerColor: getPlayerColor(),
      viewportMode: getViewportModeLabel(),
      canvasWidth: cv.width,
      canvasHeight: cv.height,
    },
    rooms: [],
    snapshots: [],
  };
}

function createRoomTelemetry(roomNumber, roomDef) {
  return {
    room: roomNumber,
    name: roomDef.name,
    boss: Boolean(roomDef.isBossRoom),
    viewportMode: getViewportModeLabel(),
    canvasWidth: cv.width,
    canvasHeight: cv.height,
    hpStart: roundTelemetryValue(hp),
    hpEnd: roundTelemetryValue(hp),
    hpLost: 0,
    hitsTaken: 0,
    kills: 0,
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

function recordRoomPeakState() {
  if(!currentRoomTelemetry) return;
  currentRoomTelemetry.pressure.peakEnemies = Math.max(currentRoomTelemetry.pressure.peakEnemies, enemies.length);
  const liveDangerBullets = bullets.reduce((count, bullet) => count + (bullet.state === 'danger' ? 1 : 0), 0);
  currentRoomTelemetry.pressure.peakDangerBullets = Math.max(currentRoomTelemetry.pressure.peakDangerBullets, liveDangerBullets);
}

function recordDangerBulletSpawn(count = 1) {
  if(!currentRoomTelemetry || count <= 0) return;
  currentRoomTelemetry.pressure.dangerBulletsSpawned += count;
}

function recordChargeGain(source, amount) {
  if(!currentRoomTelemetry || amount <= 0) return 0;
  const delta = roundTelemetryValue(amount);
  currentRoomTelemetry.charge[source] = roundTelemetryValue((currentRoomTelemetry.charge[source] || 0) + delta);
  return delta;
}

function gainCharge(amount, source) {
  if(amount <= 0) return 0;
  const before = charge;
  charge = Math.min(UPG.maxCharge, charge + amount);
  return recordChargeGain(source, charge - before);
}

function recordHeal(source, amount) {
  if(!currentRoomTelemetry || amount <= 0) return 0;
  const delta = roundTelemetryValue(amount);
  currentRoomTelemetry.heal[source] = roundTelemetryValue((currentRoomTelemetry.heal[source] || 0) + delta);
  currentRoomTelemetry.hpEnd = roundTelemetryValue(hp);
  return delta;
}

function healPlayer(amount, source) {
  if(amount <= 0) return 0;
  const before = hp;
  hp = Math.min(maxHp, hp + amount);
  return recordHeal(source, hp - before);
}

function recordPlayerDamage(amount, source) {
  if(!currentRoomTelemetry || amount <= 0) return 0;
  const delta = roundTelemetryValue(amount);
  currentRoomTelemetry.hpLost = roundTelemetryValue(currentRoomTelemetry.hpLost + delta);
  currentRoomTelemetry.hitsTaken += 1;
  currentRoomTelemetry.damageless = false;
  currentRoomTelemetry.damage[source] = roundTelemetryValue((currentRoomTelemetry.damage[source] || 0) + delta);
  currentRoomTelemetry.hpEnd = roundTelemetryValue(hp);
  return delta;
}

function recordKill() {
  if(!currentRoomTelemetry) return;
  currentRoomTelemetry.kills += 1;
}

function captureTelemetrySnapshot(roomNumber) {
  if(!runTelemetry) return;
  runTelemetry.snapshots.push({
    room: roomNumber,
    hp: roundTelemetryValue(hp),
    maxHp: roundTelemetryValue(maxHp),
    sps: roundTelemetryValue(UPG.sps || 0),
    maxCharge: roundTelemetryValue(UPG.maxCharge || 0),
    requiredShotCount: getRequiredShotCount(UPG),
    damageMult: roundTelemetryValue((UPG.playerDamageMult || 1) * (UPG.denseDamageMult || 1)),
    damageReductionPct: roundTelemetryValue((1 - (UPG.damageTakenMult || 1)) * 100),
    critChancePct: roundTelemetryValue((UPG.critChance || 0) * 100),
    moveChargeRate: roundTelemetryValue(UPG.moveChargeRate || 0),
    shieldCount: UPG.shieldTier || 0,
    orbitCount: UPG.orbitSphereTier || 0,
    playerSizeMult: roundTelemetryValue(UPG.playerSizeMult || 1),
    viewportMode: getViewportModeLabel(),
    canvasWidth: cv.width,
    canvasHeight: cv.height,
  });
}

function startRoomTelemetry(roomNumber, roomDef) {
  if(!runTelemetry) runTelemetry = createRunTelemetry();
  runTelemetry.meta = {
    ...runTelemetry.meta,
    build: VERSION.num,
    playerColor: getPlayerColor(),
    viewportMode: getViewportModeLabel(),
    canvasWidth: cv.width,
    canvasHeight: cv.height,
  };
  currentRoomTelemetry = createRoomTelemetry(roomNumber, roomDef);
  if(roomNumber === 1 || roomNumber % 10 === 0) {
    captureTelemetrySnapshot(roomNumber);
  }
}

function finalizeCurrentRoomTelemetry(endState, clearMs = roomTimer * 1000) {
  if(!currentRoomTelemetry || !runTelemetry) return;
  currentRoomTelemetry.end = endState;
  currentRoomTelemetry.clearMs = Math.round(clearMs);
  currentRoomTelemetry.hpEnd = roundTelemetryValue(hp);
  currentRoomTelemetry.damageless = currentRoomTelemetry.damageless && !tookDamageThisRoom;
  runTelemetry.rooms.push(currentRoomTelemetry);
  currentRoomTelemetry = null;
}

function buildRunTelemetryPayload() {
  if(!runTelemetry) return null;
  const rooms = runTelemetry.rooms;
  const summary = rooms.reduce((acc, room) => {
    acc.roomsTracked += 1;
    if(room.end === 'clear') acc.roomsCleared += 1;
    acc.totalHpLost = roundTelemetryValue(acc.totalHpLost + (room.hpLost || 0));
    acc.totalKills += room.kills || 0;
    acc.totalDangerBulletsSpawned += room.pressure?.dangerBulletsSpawned || 0;
    acc.totalShieldBlocks += room.safety?.shieldBlocks || 0;
    acc.totalPhaseDashProcs += room.safety?.phaseDashProcs || 0;
    acc.totalMirrorTideProcs += room.safety?.mirrorTideProcs || 0;
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

function getRoomDef(idx) {
  // Boss room every 10th room (0-indexed: 9, 19, 29, 39, 49...)
  if ((idx + 1) % 10 === 0) {
    let bossConfig;
    if (BOSS_ROOMS[idx]) {
      bossConfig = BOSS_ROOMS[idx];
    } else {
      // Rooms 50+ cycle through boss types
      const bossKeys = Object.keys(BOSS_ROOMS).map(Number).sort((a,b) => a-b);
      const ci = Math.floor((idx - 9) / 10) % bossKeys.length;
      const baseConfig = BOSS_ROOMS[bossKeys[ci]];
      bossConfig = { ...baseConfig, name: baseConfig.name + ' +' };
    }
    const wave = [{ t: bossConfig.bossType, n: 1, d: 0, isBoss: true }];
    for (let i = 0; i < bossConfig.escortCount; i++) {
      wave.push({ t: bossConfig.escortType, n: 1, d: 0 });
    }
    return { name: bossConfig.name, chaos: bossConfig.chaos, waves: [wave], isBossRoom: true, bossType: bossConfig.bossType, escortType: bossConfig.escortType, escortCount: bossConfig.escortCount };
  }

  const name = idx < ROOM_NAMES.length
    ? ROOM_NAMES[idx]
    : ['FRENZY','OVERRUN','DELUGE','STORM','NIGHTMARE','ABYSS','INFERNO','CHAOS'][(idx - ROOM_NAMES.length) % 8];
  const chaos = Math.min(0.65, idx * 0.035);
  return { name, chaos, waves:[generateWeightedWave(idx)] };
}

function getUnlockedEnemyTypes(roomIdx) {
  return Object.entries(ENEMY_TYPES)
    .filter(([, def]) => roomIdx >= def.unlockRoom)
    .map(([type]) => type);
}

function weightedPick(candidates) {
  const total = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
  let roll = Math.random() * total;
  for(const candidate of candidates) {
    roll -= candidate.weight;
    if(roll <= 0) return candidate.type;
  }
  return candidates[candidates.length - 1].type;
}

function generateWeightedWave(roomIdx) {
  const unlocked = getUnlockedEnemyTypes(roomIdx);
  const entries = new Map();
  const budgetBase = 5.0 + roomIdx * 1.35;
  let budget = budgetBase;
  let shooterCount = 0;
  const MAX_TYPES = roomIdx >= 12 ? 3 : 99;

  if(roomIdx === 9) {
    entries.set('purple_chaser', 1);
    budget -= ENEMY_TYPES.purple_chaser.spawnValue;
    shooterCount += 1;
  }

  while(budget >= 2) {
    const candidates = unlocked
      .filter((type) => roomIdx > 9 || (type !== 'purple_chaser' && type !== 'purple_disruptor'))
      .filter((type) => type !== 'purple_disruptor' || roomIdx >= 11)
      .filter((type) => ENEMY_TYPES[type].spawnValue <= budget + 0.5)
      .filter((type) => entries.size < MAX_TYPES || entries.has(type))
      .filter((type) => {
        // Rooms 20-29: once a triangle is in the wave, reduce bullet pressure from other heavy shooters
        if(roomIdx >= 20 && roomIdx < 30 && entries.has('triangle')) {
          return !['zoner','purple_disruptor','purple_chaser','disruptor'].includes(type);
        }
        return true;
      })
      .map((type) => {
        const def = ENEMY_TYPES[type];
        const pressureBias = def.ammoPressure > 0 ? 0.9 : 0.75;
        const affordability = 1 / def.spawnValue;
        const roomBias = 1 + Math.min(1.2, Math.max(0, roomIdx - def.unlockRoom) * 0.08);
        return { type, weight: pressureBias * affordability * roomBias };
      });
    if(candidates.length === 0) break;
    const type = weightedPick(candidates);
    entries.set(type, (entries.get(type) || 0) + 1);
    budget -= ENEMY_TYPES[type].spawnValue;
    if(ENEMY_TYPES[type].ammoPressure > 0) shooterCount++;
  }

  if(shooterCount === 0) {
    entries.set('chaser', (entries.get('chaser') || 0) + 1);
  }

  return [...entries.entries()].map(([t, n]) => ({ t, n, d:0 }));
}

function buildSpawnQueue(roomDef) {
  const queue = [];
  for(const wave of roomDef.waves) {
    for(const entry of wave) {
      for(let i=0; i<entry.n; i++) {
        queue.push({ t: entry.t, spawnAt: 0, isBoss: Boolean(entry.isBoss) });
      }
    }
  }
  return queue;
}

function startRoom(idx) {
  tookDamageThisRoom = false;
  _vampiricRestoresThisRoom = 0;
  _orbFireTimers = []; _orbCooldown = [];
  _volatileOrbGlobalCooldown = 0;
  UPG.predatorKillStreak = 0; UPG.predatorKillStreakTime = 0;
  if(UPG.mirrorTide){
    UPG.mirrorTideRoomUses = 0;
    UPG.mirrorTideCooldown = 0;
  }
  if(UPG.phaseDash){
    UPG.phaseDashRoomUses = 0;
    UPG.phaseDashCooldown = 0;
    UPG.isDashing = false;
  }
  roomIndex = idx;
  roomPurpleShooterAssigned = false;
  const def = getRoomDef(idx);
  spawnQueue = buildSpawnQueue(def);
  roomTimer = 0;
  roomIntroTimer = 0;
  roomPhase = 'intro';
  enemies = [];
  bullets = [];
  // Boss room state
  currentRoomIsBoss = Boolean(def.isBossRoom);
  bossAlive = currentRoomIsBoss;
  escortType = def.escortType || '';
  escortMaxCount = def.escortCount || 2;
  escortRespawnTimer = 0;
  reinforceTimer = 0;
  currentRoomMaxOnScreen = getRoomMaxOnScreen(roomIndex, currentRoomIsBoss);
  player.x = cv.width / 2;
  player.y = cv.height / 2;
  player.vx = 0;
  player.vy = 0;
  startRoomTelemetry(idx + 1, def);
  showRoomIntro(currentRoomIsBoss ? 'BOSS!' : 'READY?', false);
}

function getRoomMaxOnScreen(idx, isBossRoom) {
  if(isBossRoom) return 99;
  if(idx >= 120) return 16;
  if(idx >= 80) return 14;
  if(idx >= 40) return 12;
  return 99;
}

function getReinforcementIntervalMs(idx) {
  if(idx >= 120) return 500;
  if(idx >= 80) return 650;
  return 800;
}

function spawnEnemy(type, isBoss = false) {
  const enemy = createEnemy(type, {
    width: cv.width,
    height: cv.height,
    margin: M,
    roomIndex,
    nextEnemyId: enemyIdSeq++,
    isBoss,
  });
  if(enemy.forcePurpleShots) roomPurpleShooterAssigned = true;
  enemies.push(enemy);
}

function pickFallbackShooterType() {
  if(roomIndex < 2) return 'chaser';
  if(roomIndex < 5) return Math.random() < 0.7 ? 'chaser' : 'sniper';
  const pool = ['chaser', 'sniper', 'disruptor', 'zoner'];
  return pool[Math.floor(Math.random() * pool.length)];
}

function ensureShooterPressure() {
  const onlyDryEnemiesRemain = enemies.length > 0
    && bullets.length === 0
    && enemies.every((enemy) => enemy.isRusher || enemy.isSiphon);
  if(!onlyDryEnemiesRemain) return;
  if(roomTimer - lastStallSpawnAt < STALL_SPAWN_COOLDOWN_MS) return;
  spawnEnemy(pickFallbackShooterType());
  lastStallSpawnAt = roomTimer;
}

function circleIntersectsShieldPlate(cx, cy, radius, sx, sy, angle) {
  const dx = cx - sx;
  const dy = cy - sy;
  const cosA = Math.cos(-angle);
  const sinA = Math.sin(-angle);
  const lx = dx * cosA - dy * sinA;
  const ly = dx * sinA + dy * cosA;
  const nearestX = Math.max(-SHIELD_HALF_W, Math.min(SHIELD_HALF_W, lx));
  const nearestY = Math.max(-SHIELD_HALF_H, Math.min(SHIELD_HALF_H, ly));
  const hitDx = lx - nearestX;
  const hitDy = ly - nearestY;
  return hitDx * hitDx + hitDy * hitDy < radius * radius;
}

// Shield recharge time — reduced by Swift Ward boon
function getShieldCooldown() {
  const reduction = (UPG.shieldRegenTier || 0) * 2.0;
  return Math.max(1.5, SHIELD_COOLDOWN - reduction);
}

// Bullet speed scales with room — moderate at room 1, ramps up to full by room 10
function bulletSpeedScale() {
  return 0.68 + Math.min(roomIndex, 10) * 0.032;
}

function getLateBloomMods(room = roomIndex || 0) {
  const growth = getLateBloomGrowth(room);
  switch(UPG.lateBloomVariant) {
    case 'power':
      return { damage: growth, speed: LATE_BLOOM_SPEED_PENALTY, damageTaken: 1 };
    case 'speed':
      return { damage: 1, speed: growth, damageTaken: LATE_BLOOM_DAMAGE_TAKEN_PENALTY };
    case 'defense':
      return { damage: LATE_BLOOM_DAMAGE_PENALTY, speed: 1, damageTaken: 1 / growth };
    default:
      return { damage: 1, speed: 1, damageTaken: 1 };
  }
}

function getEliteBulletStagePalette() {
  const threat = getThreatPalette();
  return [
    { fill: threat.elite.hex, core: C.getRgba(threat.elite.light, 0.9) },
    { fill: threat.advanced.hex, core: C.getRgba(threat.advanced.light, 0.9) },
    { fill: threat.danger.hex, core: C.getRgba(threat.danger.light, 0.9) },
  ];
}

function applyEliteBulletStage(bullet, stage) {
  const palette = getEliteBulletStagePalette();
  const nextStage = Math.max(0, Math.min(stage, palette.length - 1));
  bullet.eliteStage = nextStage;
  bullet.eliteColor = palette[nextStage].fill;
  bullet.eliteCore = palette[nextStage].core;
  bullet.bounceStages = nextStage < palette.length - 1 ? 1 : 0;
}

function getDoubleBounceBulletPalette() {
  const threat = getThreatPalette();
  return {
    fill: threat.advanced.hex,
    core: C.getRgba(threat.advanced.light, 0.9),
  };
}

function spawnEB(ex,ey) {
  const a=Math.atan2(player.y-ey,player.x-ex)+(Math.random()-.5)*.22;
  const spd=(145+Math.random()*40) * bulletSpeedScale();
  bullets.push({x:ex,y:ey,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,state:'danger',r:4.5,decayStart:null,bounces:0});
  recordDangerBulletSpawn();
}

function spawnZB(ex,ey,idx,total) {
  const a=(Math.PI*2/total)*idx;
  const spd=125 * bulletSpeedScale();
  bullets.push({x:ex,y:ey,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,state:'danger',r:4.5,decayStart:null,bounces:0});
  recordDangerBulletSpawn();
}

function spawnEliteZB(ex, ey, idx, total, stageOverride) {
  const a = (Math.PI * 2 / total) * idx;
  const spd = 125 * bulletSpeedScale();
  const stage = stageOverride !== undefined ? stageOverride : 0;
  spawnEliteBullet(ex, ey, a, spd, stage);
}

function spawnDBB(ex,ey) {
  const a=Math.atan2(player.y-ey,player.x-ex)+(Math.random()-.5)*.22;
  const spd=(145+Math.random()*40) * bulletSpeedScale();
  bullets.push({x:ex,y:ey,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,state:'danger',r:4.5,decayStart:null,bounces:0,doubleBounce:true,bounceCount:0});
  recordDangerBulletSpawn();
}

function spawnTB(ex,ey) {
  const a=Math.atan2(player.y-ey,player.x-ex)+(Math.random()-.5)*.18;
  const spd=(145+Math.random()*40) * bulletSpeedScale();
  bullets.push({x:ex,y:ey,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,state:'danger',r:7,decayStart:null,bounces:0,isTriangle:true,wallBounces:0});
  recordDangerBulletSpawn();
}

function spawnTriangleBurst(ex, ey, origVx, origVy) {
  const baseAngle = Math.atan2(origVy, origVx);
  const burstSpd = 140 * bulletSpeedScale();
  for(let i = 0; i < 3; i++) {
    const angle = baseAngle + (i - 1) * (Math.PI * 2 / 3);
    bullets.push({x:ex,y:ey,vx:Math.cos(angle)*burstSpd,vy:Math.sin(angle)*burstSpd,state:'danger',r:5,decayStart:null,bounces:0,dangerBounceBudget:1});
  }
  recordDangerBulletSpawn(3);
  sparks(ex, ey, C.danger, 6, 50);
}

// Elite bullets advance through the current threat palette rather than fixed colors.
function spawnEliteBullet(ex, ey, angle, speed, stageOverride, extras = {}) {
  const stage = stageOverride !== undefined ? stageOverride : 0;
  const bullet = {
    x: ex, y: ey,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    state: 'danger',
    r: extras.r ?? 5,
    decayStart: null,
    bounces: 0,
    ...extras,
  };
  applyEliteBulletStage(bullet, stage);
  bullets.push(bullet);
  recordDangerBulletSpawn();
}

// Elite triangle shots use the same staged palette, just scaled up.
function spawnEliteTriangleBullet(ex, ey) {
  const a = Math.atan2(player.y - ey, player.x - ex) + (Math.random() - 0.5) * 0.18;
  const spd = (145 + Math.random() * 40) * bulletSpeedScale();
  spawnEliteBullet(ex, ey, a, spd, 1, { r: 7 });
}

function spawnEliteTriangleBurst(ex, ey, origVx, origVy) {
  const baseAngle = Math.atan2(origVy, origVx);
  const burstSpd = 140 * bulletSpeedScale();
  for(let i = 0; i < 3; i++) {
    const angle = baseAngle + (i - 1) * (Math.PI * 2 / 3);
    spawnEliteBullet(ex, ey, angle, burstSpd, 2, { dangerBounceBudget: 1 });
  }
  sparks(ex, ey, getThreatPalette().advanced.hex, 6, 60);
}

function createLaneOffsets(count, spacing) {
  return Array.from({ length: count }, (_, idx) => (idx - (count - 1) / 2) * spacing);
}

function drawGooBall(x, y, radius, fillColor, coreColor, wobbleSeed, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = fillColor;
  ctx.beginPath();
  for(let i=0;i<8;i++){
    const angle = (Math.PI * 2 / 8) * i;
    const wobble = 0.86 + 0.22 * Math.sin(wobbleSeed + i * 1.37);
    const px = x + Math.cos(angle) * radius * wobble;
    const py = y + Math.sin(angle) * radius * wobble;
    if(i===0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = coreColor;
  ctx.beginPath();
  ctx.arc(x + Math.sin(wobbleSeed) * radius * 0.08, y + Math.cos(wobbleSeed * 1.2) * radius * 0.08, radius * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function firePlayer(tx,ty) {
  if(charge < 1) return;
  const base=Math.atan2(ty-player.y,tx-player.x);
  const angs=[];
  const forwardOffsets = createLaneOffsets(1 + UPG.forwardShotTier, 7 * Math.min(1.6, UPG.shotSize));

  for(const laneOffset of forwardOffsets) angs.push({ angle: base, offset: laneOffset });
  if(UPG.spreadTier>=1){
    angs.push({ angle: base-0.28, offset: 0 }, { angle: base+0.28, offset: 0 });
  }
  if(UPG.spreadTier>=2){
    angs.push({ angle: base-0.45, offset: 0 }, { angle: base-0.22, offset: 0 }, { angle: base+0.22, offset: 0 }, { angle: base+0.45, offset: 0 });
  }
  if(UPG.dualShot>0){
    angs.push({ angle: base + Math.PI, offset: 0 });
  }
  if(UPG.ringShots>0){
    for(let i=0;i<UPG.ringShots;i++){
      angs.push({ angle: (Math.PI*2/UPG.ringShots)*i, offset: 0, isRing: true });
    }
  }
  
  // Spread Shot: if enabled, modify the primary angle to fire 3 shots in a cone
  if(UPG.spreadShot){
    const newAngs = [];
    for(const ang of angs){
      if(ang.isRing) { newAngs.push(ang); continue; } // skip ring shots
      newAngs.push({ angle: ang.angle, offset: ang.offset });
      newAngs.push({ angle: ang.angle - 0.35, offset: ang.offset });
      newAngs.push({ angle: ang.angle + 0.35, offset: ang.offset });
    }
    angs.length = 0;
    angs.push(...newAngs);
  }

  const availableShots = Math.min(Math.floor(charge), angs.length);
  if(availableShots <= 0) return;

  const snipeScale = 1 + UPG.snipePower * 0.18;
  const bspd = 230 * Math.min(2.0, UPG.shotSpd) * snipeScale;
  const baseRadius = 4.5 * Math.min(2.5, UPG.shotSize) * (1 + UPG.snipePower * 0.15);
  // Predator's Instinct: apply kill streak damage multiplier (25% per kill, max +125%)
  const predatorBonus = UPG.predatorInstinct && UPG.predatorKillStreak >= 2 ? 1 + Math.min(UPG.predatorKillStreak * 0.25, 1.25) : 1;
  // Dense Core desperation bonus: extra damage at critical charge (1 cap)
  const denseDesperationBonus = (UPG.denseTier > 0 && UPG.maxCharge === 1) ? DENSE_DESPERATION_BONUS : 1;
  const lateBloomMods = getLateBloomMods(roomIndex || 0);
  // Escalation: per-kill damage in current room (max +40%)
  const escalationBonus = UPG.escalation ? 1 + Math.min((UPG.escalationKills || 0) * ESCALATION_KILL_PCT, ESCALATION_MAX_BONUS) : 1;
  const baseDmg = (1 + UPG.snipePower * 0.35) * (UPG.playerDamageMult || 1) * (UPG.denseDamageMult || 1) * predatorBonus * denseDesperationBonus * lateBloomMods.damage * escalationBonus;
  const lifeMs = PLAYER_SHOT_LIFE_MS * (UPG.shotLifeMult || 1);
  const now = performance.now();
  const overchargeBonus = (UPG.overchargeVent && charge >= UPG.maxCharge) ? 1.6 : 1;
  
  // Overload: if active and at full charge, apply 2.5x damage multiplier and consume charge
  let overloadBonus = 1;
  if(UPG.overload && UPG.overloadActive && charge >= UPG.maxCharge){
    overloadBonus = 2.5;
    UPG.overloadActive = false;
    UPG.overloadCooldown = 3000;
    charge = 0;
  }

  for(const shot of angs.slice(0, availableShots)) {
    const a = shot.angle;
    const sideX = Math.cos(a + Math.PI / 2) * shot.offset;
    const sideY = Math.sin(a + Math.PI / 2) * shot.offset;
    const crit = Math.random()<UPG.critChance;
    bullets.push({
      x:player.x + sideX, y:player.y + sideY,
      vx:Math.cos(a)*bspd,
      vy:Math.sin(a)*bspd,
      state:'output', r:crit ? baseRadius * 1.28 : baseRadius, decayStart:null,
      bounceLeft: UPG.bounceTier>0?2:0,
      pierceLeft: UPG.pierceTier + ((shot.isRing && UPG.corona) ? 1 : 0),
      homing: UPG.homingTier>0,
      crit,
      dmg: baseDmg * overchargeBonus * overloadBonus,
      expireAt: now + lifeMs,
      hitIds: new Set(),
      isRing: shot.isRing || false,
      hasPayload: UPG.payload || false,
    });
  }
  charge=Math.max(0,charge-availableShots);
  sparks(player.x,player.y,C.green,4 + Math.min(4, availableShots),55);
  
  // Shockwave: fire a radial push on full-charge fire
  if(UPG.shockwave && availableShots === Math.floor(UPG.maxCharge) && UPG.shockwaveCooldown <= 0){
    UPG.shockwaveCooldown = 2250;
    for(const e of enemies){
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const dist = Math.hypot(dx, dy);
      if(dist > 0){
        e.vx = (dx / dist) * 300;
        e.vy = (dy / dist) * 300;
      }
    }
    sparks(player.x, player.y, '#ffaa00', 20, 250);
  }
  
  if(UPG.echoFire){
    _echoCounter++;
    if(_echoCounter>=5){
      _echoCounter=0;
      const eNow=performance.now();
      for(const shot of angs.slice(0,availableShots)){
        const a=shot.angle;
        const sideX=Math.cos(a+Math.PI/2)*shot.offset;
        const sideY=Math.sin(a+Math.PI/2)*shot.offset;
        bullets.push({x:player.x+sideX,y:player.y+sideY,vx:Math.cos(a)*bspd,vy:Math.sin(a)*bspd,state:'output',r:baseRadius,decayStart:null,bounceLeft:UPG.bounceTier>0?2:0,pierceLeft:UPG.pierceTier,homing:UPG.homingTier>0,crit:false,dmg:baseDmg,expireAt:eNow+lifeMs,hitIds:new Set()});
      }
    }
  }
}

const MAX_PARTICLES = 600;
const MAX_BULLETS = 400;

function sparks(x,y,col,n=6,spd=80) {
  const room = Math.min(n, MAX_PARTICLES - particles.length);
  for(let i=0;i<room;i++){
    const a=Math.random()*Math.PI*2,s=spd*(.4+Math.random()*.6);
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,col,life:1,decay:1.6+Math.random()});
  }
}

function spawnGreyDrops(x,y,ts,count=getEnemyGreyDropCount()) {
  const dropCount = Math.max(1, Math.floor(count));
  const room = Math.min(dropCount, MAX_BULLETS - bullets.length);
  for(let i=0;i<room;i++){
    const a=Math.random()*Math.PI*2,s=50+Math.random()*55;
    bullets.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,state:'grey',r:4.5,decayStart:ts,bounces:0});
  }
}
function burstBlueDissipate(x, y) {
  const threat = getThreatPalette();
  const room = Math.min(12, MAX_PARTICLES - particles.length);
  for(let i=0;i<room;i++){
    const a = Math.random() * Math.PI * 2;
    const s = 45 + Math.random() * 70;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      col: C.getRgba(threat.danger.light, 0.35 + Math.random() * 0.4),
      life: 0.9 + Math.random() * 0.35,
      decay: 2.2 + Math.random() * 0.9,
      grow: 0.8 + Math.random() * 1.2,
    });
  }
}

function showUpgrades() {
  gstate='upgrade'; cancelAnimationFrame(raf);
  UPG._roomIndex = roomIndex;
  showBoonSelection({
    upg: UPG,
    hp,
    maxHp,
    rerolls: boonRerolls,
    onReroll: () => { boonRerolls--; },
    pendingLegendary: (!legendaryOffered && pendingLegendary) ? pendingLegendary : null,
    onLegendaryAccept: (leg) => {
      const lState={hp,maxHp}; leg.apply(UPG,lState); hp=lState.hp; maxHp=lState.maxHp;
      legendaryOffered=true; pendingLegendary=null;
      syncRunChargeCapacity(); boonHistory.push(leg.name);
      document.getElementById('s-up').classList.add('off');
      startRoom(roomIndex+1);
      gstate='playing'; lastT=performance.now(); raf=requestAnimationFrame(loop);
    },
    onSelect: (boon) => {
      const state = { hp, maxHp };
      const evolvedBoon = getEvolvedBoon(boon, UPG);
      evolvedBoon.apply(UPG, state);
      syncRunChargeCapacity();
      hp = state.hp;
      maxHp = state.maxHp;
      syncPlayerScale();
      boonHistory.push(evolvedBoon.name);
      // Track boon selection for leaderboard
      UPG.boonSelectionOrder.push(evolvedBoon.name);
      if(!legendaryOffered){
        const leg = checkLegendarySequences(boonHistory, UPG);
        if(leg) pendingLegendary=leg;
      }
      document.getElementById('s-up').classList.add('off');
      startRoom(roomIndex+1);
      gstate='playing'; lastT=performance.now();
      raf=requestAnimationFrame(loop);
    },
  });
}

function sanitizeName(v) {
  const cleaned = (v || '').toUpperCase().replace(/[^A-Z0-9 _-]/g, '').trim();
  return cleaned.slice(0, 14);
}

function loadLeaderboard() {
  try {
    const raw = localStorage.getItem(LB_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if(Array.isArray(parsed)) {
      leaderboard = parsed
        .filter((x)=>x && typeof x.name==='string' && Number.isFinite(x.score) && Number.isFinite(x.ts) && x.version === VERSION.num)
        .slice(0, 500);
      leaderboard.sort((a,b)=>b.score-a.score || b.ts-a.ts);
    }
  } catch {
    leaderboard = [];
  }
}

function loadSavedPlayerName() {
  try {
    return sanitizeName(localStorage.getItem(NAME_KEY) || '');
  } catch {
    return '';
  }
}

function saveLeaderboard() {
  localStorage.setItem(LB_KEY, JSON.stringify(leaderboard.slice(0, 500)));
}

function isSameLocalDay(ts, nowTs = Date.now()) {
  const a = new Date(ts);
  const b = new Date(nowTs);
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}

function getVisibleLeaderboardRows() {
  let rows = leaderboard.slice();
  if(lbPeriod === 'daily') rows = rows.filter((row)=>isSameLocalDay(row.ts));
  if(lbScope === 'personal') rows = rows.filter((row)=>row.name === playerName);
  rows.sort((a,b)=>b.score-a.score || b.ts-a.ts);
  return rows.slice(0, 10);
}

function setLeaderboardStatus(mode, text) {
  lbStatusMode = mode;
  lbStatusText = text;
  lbStatus.textContent = text;
  lbStatus.classList.remove('syncing', 'synced', 'local', 'error');
  lbStatus.classList.add(mode);
}

function updateLeaderboardToggleStates() {
  lbPeriodBtns.forEach((btn)=>btn.classList.toggle('active', btn.dataset.lbPeriod === lbPeriod));
  lbScopeBtns.forEach((btn)=>btn.classList.toggle('active', btn.dataset.lbScope === lbScope));
}

function renderLeaderboard() {
  const periodLabel = lbPeriod === 'daily' ? 'DAILY' : 'ALL TIME';
  const scopeLabel = lbScope === 'personal' ? 'PERSONAL' : 'EVERYONE';
  lbCurrent.textContent = `RUNNER: ${playerName} · ${periodLabel} · ${scopeLabel}`;
  lbStatus.textContent = lbStatusText;
  lbList.innerHTML = '';
  const rows = lbStatusMode === 'syncing'
    ? []
    : (useRemoteLeaderboardRows ? remoteLeaderboardRows : getVisibleLeaderboardRows());
  if(rows.length===0){
    const li = document.createElement('li');
    li.className = 'lb-empty';
    li.textContent = lbStatusMode === 'syncing' ? 'Syncing records...' : 'No runs match this view yet.';
    lbList.appendChild(li);
    updateLeaderboardToggleStates();
    return;
  }
  for(let i=0;i<rows.length;i++){
    const row = rows[i];
    const li = document.createElement('li');
    
    // Handle backwards compatibility: extract boon data
    const boonData = Array.isArray(row.boons) 
      ? { picks: row.boons, color: row.color || 'green', order: row.boonOrder || '' }
      : (row.boons || { picks: [], color: row.color || 'green', order: row.boonOrder || '' });
    const hasBoons = boonData.picks && boonData.picks.length > 0;
    const playerColor = boonData.color || row.color || 'green';
    const boonOrder = boonData.order || row.boonOrder || '';
    
    // Color-coded border based on player color
    const borderColor = PLAYER_COLORS[playerColor]?.hex || PLAYER_COLORS.green.hex;
    
    li.style.borderLeft = `3px solid ${borderColor}`;
    li.innerHTML = `
      <span class="lb-rank">#${i + 1}</span>
      <span class="lb-name">${row.name} · R${row.room}</span>
      <span class="lb-score">${row.score}</span>
      ${hasBoons ? '<button class="lb-boons-btn" type="button" title="View run loadout">📋</button>' : '<span></span>'}
    `;
    if(hasBoons) {
      li.querySelector('.lb-boons-btn').addEventListener('click', () => showLbBoonsPopup(row.name, boonData.picks, boonOrder));
    }
    lbList.appendChild(li);
  }
  updateLeaderboardToggleStates();
}

async function refreshLeaderboardView() {
  const requestId = ++lbRequestSeq;
  remoteLeaderboardRows = [];
  useRemoteLeaderboardRows = false;
  setLeaderboardStatus('syncing', 'SYNCING');
  renderLeaderboard();
  try {
    const rows = await fetchRemoteLeaderboard({
      period: lbPeriod,
      scope: lbScope,
      playerName,
      gameVersion: VERSION.num,
      limit: 10,
    });
    if(requestId !== lbRequestSeq) return;
    remoteLeaderboardRows = rows;
    useRemoteLeaderboardRows = true;
    setLeaderboardStatus('synced', 'SUPABASE LIVE');
  } catch (error) {
    if(requestId !== lbRequestSeq) return;
    remoteLeaderboardRows = [];
    useRemoteLeaderboardRows = false;
    setLeaderboardStatus('local', 'LOCAL FALLBACK');
  }
  renderLeaderboard();
}

function pushLeaderboardEntry() {
  const boons = getActiveBoonEntries(UPG);
  const playerColor = getPlayerColor();
  const boonOrder = (UPG.boonSelectionOrder || []).join(',');
  const telemetry = buildRunTelemetryPayload();
  const entry = {
    name: playerName,
    score,
    room: roomIndex + 1,
    ts: Date.now(),
    version: VERSION.num,
    color: playerColor,
    boonOrder,
    boons: { picks: boons, color: playerColor, order: boonOrder, telemetry },
  };
  leaderboard.push(entry);
  leaderboard.sort((a,b)=>b.score-a.score || b.ts-a.ts);
  leaderboard = leaderboard.slice(0, 500);
  saveLeaderboard();
  submitRemoteScore({
    playerName: entry.name,
    score: entry.score,
    room: entry.room,
    gameVersion: VERSION.num,
    boons: entry.boons,
    playerColor,
  }).then(() => {
    if(lbScope !== 'personal' || playerName === entry.name) {
      refreshLeaderboardView();
    }
  }).catch(() => {
    useRemoteLeaderboardRows = false;
    setLeaderboardStatus('local', 'LOCAL FALLBACK');
    renderLeaderboard();
  });
  renderLeaderboard();
}

function gameOver(){
  if(gameOverShown) return;
  gameOverShown = true;
  finalizeCurrentRoomTelemetry('death');
  gstate='dying';
  player.deadAt = performance.now();
  player.popAt = player.deadAt + GAME_OVER_ANIM_MS * 0.72;
  player.deadPulse = 0;
  player.deadPop = false;
  pushLeaderboardEntry();
}

function init() {
  score=0; kills=0;
  charge=0; fireT=0; stillTimer=0; prevStill=false; hp=120; maxHp=120;
  gameOverShown = false;
  boonRerolls = 1;
  damagelessRooms = 0;
  tookDamageThisRoom = false;
  lastStallSpawnAt = -99999;
  enemyIdSeq = 1;
  player={x:cv.width/2,y:cv.height/2,r:9,vx:0,vy:0,invincible:0,distort:0,deadAt:0,popAt:0,deadPop:false,deadPulse:0};
  player.shields=[];
  _barrierPulseTimer=0;
  _slipCooldown=0; _absorbComboCount=0; _absorbComboTimer=0;
  _chainMagnetTimer=0; _echoCounter=0; _vampiricRestoresThisRoom=0; _colossusShockwaveCd=0;
  _orbFireTimers=[]; _orbCooldown=[];
  boonHistory=[]; pendingLegendary=null; legendaryOffered=false;
  runTelemetry = createRunTelemetry();
  currentRoomTelemetry = null;
  bullets=[];enemies=[];particles=[];
  resetJoystickState(joy);
  resetUpgrades();
  syncRunChargeCapacity();
  syncPlayerScale();
  startRoom(0);
  hudUpdate();
}

// ── MAIN LOOP ─────────────────────────────────────────────────────────────────
function loop(ts){
  if(gstate!=='playing' && gstate!=='dying') return;
  const dt=Math.min((ts-lastT)/1000,.05); lastT=ts;
  update(dt,ts); draw(ts); hudUpdate();
  raf=requestAnimationFrame(loop);
}

// ── UPDATE ────────────────────────────────────────────────────────────────────
function update(dt,ts){
  if(gstate === 'dying'){
    if(!player.deadPop && ts >= player.popAt){
      player.deadPop = true;
      sparks(player.x, player.y, '#f8b4c7', 10, 85);
      burstBlueDissipate(player.x, player.y);
    }
    for(let i=particles.length-1;i>=0;i--){
      const p=particles[i];
      p.x+=p.vx*dt;p.y+=p.vy*dt;
      p.vx*=Math.pow(.84,dt*60);p.vy*=Math.pow(.84,dt*60);
      p.life-=p.decay*dt;
      if(p.life<=0)particles.splice(i,1);
    }
    if(ts - player.deadAt >= GAME_OVER_ANIM_MS){
      gstate='gameover';
      cancelAnimationFrame(raf);
      document.getElementById('go-score').textContent=score;
      document.getElementById('go-note').textContent=`Room ${roomIndex+1} · ${kills} enemies eliminated`;
      if(goBoonsPanel) goBoonsPanel.classList.add('off');
      renderGameOverBoons();
      gameOverScreen.classList.remove('off');
    }
    return;
  }

  const W=cv.width,H=cv.height;
  recordRoomPeakState();
  const titanSlow = UPG.colossus ? 1 - (1 - (UPG.titanSlowMult || 1)) * 0.5 : (UPG.titanSlowMult || 1);
  const bloodRushMult = UPG.bloodRush && UPG.bloodRushTimer > ts ? 1 + ((UPG.bloodRushStacks || 0) * 0.10) : 1;
  const lateBloomMoveMods = getLateBloomMods(roomIndex || 0);
  const BASE_SPD=165*Math.min(2.5,(UPG.speedMult || 1) * titanSlow * bloodRushMult * lateBloomMoveMods.speed);
  const joyMax = joy.max || JOY_MAX;

  // Drift anchor when thumb wanders far past max radius
  if(roomPhase === 'fighting' || roomPhase === 'spawning') tickJoystick(joy, dt);

  // ── Player movement — virtual joystick
  if(roomPhase !== 'intro' && joy.active && joy.mag > JOY_DEADZONE){
    const t = Math.min((joy.mag - JOY_DEADZONE) / (joyMax - JOY_DEADZONE), 1);
    player.vx = joy.dx * BASE_SPD * t;
    player.vy = joy.dy * BASE_SPD * t;
  } else {
    player.vx = 0;
    player.vy = 0;
  }
  player.x=Math.max(M+player.r,Math.min(W-M-player.r,player.x+player.vx*dt));
  player.y=Math.max(M+player.r,Math.min(H-M-player.r,player.y+player.vy*dt));
  if(player.invincible>0)player.invincible-=dt;
  if(player.distort>0)player.distort-=dt;

  // ── Shields — sync count to tier, tick cooldowns
  while(player.shields.length < UPG.shieldTier) player.shields.push({cooldown:0, hardened: !!UPG.shieldTempered, mirrorCooldown:-9999});
  for(const s of player.shields){
    if(s.cooldown>0){
      const prev=s.cooldown;
      s.cooldown=Math.max(0,s.cooldown-dt);
      if(prev>0 && s.cooldown<=0 && UPG.shieldTempered) s.hardened=true;
    }
  }
  if(_barrierPulseTimer>0) _barrierPulseTimer-=dt*1000;
  if(_absorbComboTimer>0){ _absorbComboTimer-=dt*1000; if(_absorbComboTimer<=0){_absorbComboCount=0;} }
  if(_chainMagnetTimer>0) _chainMagnetTimer-=dt*1000;
  if(_slipCooldown>0) _slipCooldown-=dt*1000;
  if(UPG.colossus && _colossusShockwaveCd>0) _colossusShockwaveCd-=dt;
  if(UPG.shockwave && UPG.shockwaveCooldown > 0) UPG.shockwaveCooldown -= dt*1000;
  if(UPG.refraction && UPG.refractionCooldown > 0) UPG.refractionCooldown -= dt*1000;
  if(UPG.mirrorTide && UPG.mirrorTideCooldown > 0) UPG.mirrorTideCooldown -= dt*1000;
  if(UPG.overload && UPG.overloadCooldown > 0) UPG.overloadCooldown -= dt*1000;
  if(UPG.phaseDash && UPG.phaseDashCooldown > 0) UPG.phaseDashCooldown -= dt*1000;
  if(UPG.voidWalker && UPG.voidZoneTimer && ts > UPG.voidZoneTimer) UPG.voidZoneActive = false;
  // Predator's Instinct: decay kill streak if window expires
  if(UPG.predatorInstinct && UPG.predatorKillStreakTime > 0 && ts > UPG.predatorKillStreakTime){
    UPG.predatorKillStreak = 0;
  }
  // Blood Rush: decay stacks after 3s
  if(UPG.bloodRush && UPG.bloodRushTimer > 0 && ts > UPG.bloodRushTimer){
    UPG.bloodRushStacks = 0;
  }
  // Volatile Orb cooldowns — per-orb recharge plus a brief shared detonation lockout
  if(_volatileOrbGlobalCooldown > 0) _volatileOrbGlobalCooldown = Math.max(0, _volatileOrbGlobalCooldown - dt);
  for(let si=0;si<_orbCooldown.length;si++){
    if(_orbCooldown[si]>0) _orbCooldown[si]=Math.max(0,_orbCooldown[si]-dt);
  }
  // ── Room state machine
  roomTimer += dt*1000;

  if(roomPhase==='intro'){
    roomIntroTimer += dt * 1000;
    if(roomIntroTimer >= 1000 && roomIntroTimer < 1600){
      showRoomIntro('GO!', true);
    } else if(roomIntroTimer >= 1600){
      hideRoomIntro();
      roomPhase = 'spawning';
    }
  }

  if(roomPhase==='spawning'){
    // Drain spawn queue (respect on-screen cap for reinforcement rooms)
    while(spawnQueue.length && spawnQueue[0].spawnAt <= roomTimer){
      if(enemies.length >= currentRoomMaxOnScreen) break;
      const entry = spawnQueue.shift();
      spawnEnemy(entry.t, entry.isBoss);
    }
    if(spawnQueue.length===0 && enemies.length > 0) roomPhase='fighting';
    if(spawnQueue.length===0 && enemies.length === 0){
      roomPhase='clear';
      roomClearTimer=0;
      bullets=[]; particles=[];
      if(UPG.regenTick>0) healPlayer(UPG.regenTick, 'roomRegen');
      // Escalation: reset kill count for next room
      if(UPG.escalation) UPG.escalationKills = 0;
      // EMP Burst: reset for next room
      if(UPG.empBurst) UPG.empBurstUsed = false;
      finalizeCurrentRoomTelemetry('clear');
      showRoomClear();
    }
  }

  if(roomPhase==='fighting' || roomPhase==='spawning'){
    if(enemies.length===0 && spawnQueue.length===0){
      roomPhase='clear';
      roomClearTimer=0;
      // Clear all projectiles immediately
      bullets=[]; particles=[];
      // Room clear regen
      if(UPG.regenTick>0) healPlayer(UPG.regenTick, 'roomRegen');
      // Escalation: reset kill count for next room
      if(UPG.escalation) UPG.escalationKills = 0;
      // EMP Burst: reset for next room
      if(UPG.empBurst) UPG.empBurstUsed = false;
      finalizeCurrentRoomTelemetry('clear');
      // Damageless streak → earn reroll (cap 3)
      if(!tookDamageThisRoom){
        damagelessRooms++;
        if(damagelessRooms >= 3){
          boonRerolls = Math.min(3, boonRerolls + 1);
          damagelessRooms = 0;
        }
      } else {
        damagelessRooms = 0;
      }
      showRoomClear();
    }
  }

  if(roomPhase==='fighting' || roomPhase==='spawning'){
    ensureShooterPressure();

    // Boss escort trickle respawning
    if(currentRoomIsBoss && bossAlive) {
      const escortAlive = enemies.filter(e => !e.isBoss).length;
      if(escortAlive < escortMaxCount) {
        escortRespawnTimer += dt * 1000;
        if(escortRespawnTimer >= 7000) {
          escortRespawnTimer = 0;
          spawnEnemy(escortType);
        }
      } else {
        escortRespawnTimer = 0;
      }
    }

    // Reinforcement spawning for rooms 40+ (non-boss)
    if(!currentRoomIsBoss && spawnQueue.length > 0 && enemies.length < currentRoomMaxOnScreen) {
      reinforceTimer += dt * 1000;
      if(reinforceTimer >= getReinforcementIntervalMs(roomIndex)) {
        reinforceTimer = 0;
        const entry = spawnQueue.shift();
        spawnEnemy(entry.t, entry.isBoss);
      }
    }
  }

  if(roomPhase==='clear'){
    roomClearTimer+=dt*1000;
    if(roomClearTimer>1000){
      roomPhase='reward';
      showUpgrades();
    }
  }

  // 'reward' and 'between' phases are handled by showUpgrades / card click callbacks

  // ── Auto-fire: only while still, and always gated by SPS interval
  const isStill = !joy.active || joy.mag <= JOY_DEADZONE;

  if(!isStill){
    stillTimer = 0;
    if(UPG.moveChargeRate > 0 && (roomPhase === 'spawning' || roomPhase === 'fighting')){
      const moveChargeRate = UPG.moveChargeRate * (UPG.fluxState ? 2 : 1);
      gainCharge(moveChargeRate * dt, 'kinetic');
    }
  } else {
    stillTimer += dt;
  }

  // Overload: auto-trigger at full charge (if cooldown ready)
  if(UPG.overload && charge >= UPG.maxCharge && UPG.overloadCooldown <= 0){
    UPG.overloadActive = true;
  }

  if(charge >= 1 && isStill){
    fireT += dt;
    const interval = 1 / (UPG.sps * 2);
    if(fireT >= interval){
      fireT = fireT % interval;
      const tgt=enemies.reduce((b,e)=>{const d=Math.hypot(e.x-player.x,e.y-player.y);return(!b||d<b.d)?{e,d}:b;},null);
      if(tgt) firePlayer(tgt.e.x,tgt.e.y);
    }
  }

  prevStill = isStill;

  // ── Enemies
  const WINDUP_MS = 520; // tell duration before firing
  for(let ei=enemies.length-1;ei>=0;ei--){
    const e=enemies[ei];
    if(e.isSiphon){
      e.x+=Math.sin(ts*.0009+e.y)*22*dt;
      e.y+=Math.cos(ts*.0011+e.x)*22*dt;
      e.x=Math.max(M+e.r,Math.min(W-M-e.r,e.x));
      e.y=Math.max(M+e.r,Math.min(H-M-e.r,e.y));
      if(Math.hypot(e.x-player.x,e.y-player.y)<72){charge=Math.max(0,charge-2.8*dt);sparks(player.x,player.y,C.siphon,1,35);}
    } else if(e.isRusher){
      const dx=player.x-e.x, dy=player.y-e.y, d=Math.hypot(dx,dy);
      if(d>e.r){
        e.x+=dx/d*e.spd*dt;
        e.y+=dy/d*e.spd*dt;
      }
      e.x=Math.max(M+e.r,Math.min(W-M-e.r,e.x));
      e.y=Math.max(M+e.r,Math.min(H-M-e.r,e.y));
      if(d<player.r+e.r+2 && player.invincible<=0){
        hp-=18; recordPlayerDamage(18, 'contact'); player.invincible=1.0; player.distort=.4;
        sparks(player.x,player.y,C.danger,10,90);
        if(UPG.colossus && _colossusShockwaveCd <= 0){
          _colossusShockwaveCd = 4.0;
          for(let ci=bullets.length-1;ci>=0;ci--){ const cb=bullets[ci]; if(cb.state==='danger' && Math.hypot(cb.x-player.x,cb.y-player.y)<120){ cb.state='grey'; cb.decayStart=ts; } }
          sparks(player.x,player.y,getThreatPalette().advanced.hex,14,120);
        }
        if(hp<=0){
          if(UPG.lifeline && UPG.lifelineTriggerCount < (UPG.lifelineUses||1)){
            UPG.lifelineTriggerCount++; UPG.lifelineUsed=true; hp=1; player.invincible=2.0; sparks(player.x,player.y,C.lifelineEffect,16,100);
            if(UPG.lastStand){ const lsNow=performance.now(); for(let la=0;la<Math.floor(UPG.maxCharge);la++){ const lang=(Math.PI*2/Math.max(1,Math.floor(UPG.maxCharge)))*la; bullets.push({x:player.x,y:player.y,vx:Math.cos(lang)*220,vy:Math.sin(lang)*220,state:'output',r:4.5,decayStart:null,bounceLeft:UPG.bounceTier>0?2:0,pierceLeft:UPG.pierceTier,homing:false,crit:false,dmg:(UPG.playerDamageMult||1)*(UPG.denseDamageMult||1),expireAt:lsNow+2000,hitIds:new Set()}); } }
          }
          else { gameOver(); return; }
        }
      }
    } else {
      const dx=player.x-e.x, dy=player.y-e.y, d=Math.hypot(dx,dy);
      const fleeRange = e.fleeRange || 110;
      let spd = e.spd;
      
      // Gravity Well tier 2: apply 20% enemy movement slowdown
      if(UPG.gravityWell2) spd *= 0.8;

      // Advance fire timer
      e.fT += dt*1000;
      const inWindup = e.fT >= e.fRate - WINDUP_MS;

      if(!inWindup){
        // Normal flee/orbit movement
        if(d < fleeRange){
          const nx=dx/d, ny=dy/d;
          const strafeDir = (Math.sin(ts*0.0008 + e.eid*1.3) > 0) ? 1 : -1;
          e.x -= nx*spd*dt + (-ny)*spd*(e.strafeSpd||0.6)*strafeDir*dt;
          e.y -= ny*spd*dt + (nx)*spd*(e.strafeSpd||0.6)*strafeDir*dt;
        } else if(d > fleeRange*1.6){
          e.x += dx/d*spd*0.25*dt;
          e.y += dy/d*spd*0.25*dt;
        } else {
          const strafeDir = (Math.sin(ts*0.0007 + e.eid*2.1) > 0) ? 1 : -1;
          e.x += (-dy/d)*spd*(e.strafeSpd||0.6)*strafeDir*dt;
          e.y += (dx/d)*spd*(e.strafeSpd||0.6)*strafeDir*dt;
        }
        e.x=Math.max(M+e.r,Math.min(W-M-e.r,e.x));
        e.y=Math.max(M+e.r,Math.min(H-M-e.r,e.y));
      }
      // else: frozen during windup — no position update

      // Disruptor cooldown tracking
      if(e.disruptorCooldown > 0) {
        e.disruptorCooldown -= dt*1000;
      }

      // Fire when timer expires (only if not in disruptor cooldown)
      if(e.fT >= e.fRate && e.disruptorCooldown <= 0){
        e.fT = 0;
        if(e.type==='zoner' || e.type==='purple_zoner' || e.type==='orange_zoner'){
          if(e.type==='orange_zoner'){
            // Orange zoner is the elite-stage zoner and uses the rotated elite palette
            for(let i=0;i<e.burst;i++) spawnEliteZB(e.x,e.y,i,e.burst,0); // stage 0 = elite hue
          } else if(e.type==='purple_zoner'){
            // Purple zoner shoots purple double-bounce bullets
            for(let i=0;i<e.burst;i++) spawnDBB(e.x,e.y);
          } else if(e.isElite){
            // Regular zoner that rolled elite
            for(let i=0;i<e.burst;i++) spawnEliteZB(e.x,e.y,i,e.burst,0); // stage 0 = elite hue
          } else {
            for(let i=0;i<e.burst;i++) spawnZB(e.x,e.y,i,e.burst);
          }
        } else if(e.type==='triangle'){
          if(e.isElite){
            for(let i=0;i<e.burst;i++) spawnEliteTriangleBullet(e.x,e.y);
          } else {
            for(let i=0;i<e.burst;i++) spawnTB(e.x,e.y);
          }
        } else {
          const canShootPurple = canEnemyUsePurpleShots(e, roomIndex);
          for(let i=0;i<e.burst;i++){
            if(e.isElite){
              // Elite enemies shoot bullets that stage through elite -> advanced -> danger hues
              const angle = Math.atan2(player.y - e.y, player.x - e.x) + (Math.random() - 0.5) * 0.6;
              const spd = (130 + Math.random() * 40) * bulletSpeedScale();
              spawnEliteBullet(e.x, e.y, angle, spd, 0); // stage 0 = elite hue
            } else if(canShootPurple) {
              spawnDBB(e.x,e.y);
            } else {
              spawnEB(e.x,e.y);
            }
          }
          // Disruptor cooldown: after 5 bullets, cooldown for 800ms
          if(e.type==='disruptor'){
            e.disruptorBulletCount += e.burst;
            if(e.disruptorBulletCount >= 5){
              e.disruptorBulletCount = 0;
              e.disruptorCooldown = 800;
            }
          }
        }
      }
    }

    if(UPG.orbitSphereTier > 0){
      // Sync arrays
      while(_orbFireTimers.length < UPG.orbitSphereTier) _orbFireTimers.push(0);
      while(_orbCooldown.length < UPG.orbitSphereTier) _orbCooldown.push(0);
      if(!e.orbitHitAt) e.orbitHitAt = {};
      for(let si=0;si<UPG.orbitSphereTier;si++){
        if(_orbCooldown[si]>0) continue;
        const sAngle=Math.PI*2/UPG.orbitSphereTier*si+ts*ORBIT_ROTATION_SPD;
        const sx=player.x+Math.cos(sAngle)*ORBIT_SPHERE_R;
        const sy=player.y+Math.sin(sAngle)*ORBIT_SPHERE_R;
        const lastHitAt = e.orbitHitAt[si] || -99999;
        if(ts - lastHitAt < 220) continue;
        if(Math.hypot(e.x-sx,e.y-sy) < e.r + 6){
          e.orbitHitAt[si] = ts;
          e.hp -= 2;
          sparks(sx,sy,C.green,4,45);
          if(e.hp<=0){
            score+=e.pts;kills++; recordKill();
            sparks(e.x,e.y,e.col,14,95);
            spawnGreyDrops(e.x,e.y,ts);
            if(UPG.finalForm && hp <= maxHp * 0.15){ gainCharge(0.5, 'finalForm'); }
            enemies.splice(ei,1);
            break;
          }
        }
      }
    }
  }

  // ── Charged Orbs: each alive orb fires at nearest enemy every 1.8s
  if(UPG.chargedOrbs && UPG.orbitSphereTier>0 && enemies.length>0){
    while(_orbFireTimers.length < UPG.orbitSphereTier) _orbFireTimers.push(0);
    for(let si=0;si<UPG.orbitSphereTier;si++){
      if(_orbCooldown[si]>0) continue;
      _orbFireTimers[si]=((_orbFireTimers[si]||0)+dt*1000);
      if(_orbFireTimers[si] >= CHARGED_ORB_FIRE_INTERVAL_MS){
        _orbFireTimers[si]=0;
        const sAngle=Math.PI*2/UPG.orbitSphereTier*si+ts*ORBIT_ROTATION_SPD;
        const ox=player.x+Math.cos(sAngle)*ORBIT_SPHERE_R;
        const oy=player.y+Math.sin(sAngle)*ORBIT_SPHERE_R;
        const tgt=enemies.reduce((b,e)=>{const d=Math.hypot(e.x-ox,e.y-oy);return(!b||d<b.d)?{e,d}:b;},null);
        if(tgt){
          const ang=Math.atan2(tgt.e.y-oy,tgt.e.x-ox);
          const oNow=performance.now();
          bullets.push({x:ox,y:oy,vx:Math.cos(ang)*220,vy:Math.sin(ang)*220,state:'output',r:3.8,decayStart:null,bounceLeft:0,pierceLeft:0,homing:false,crit:false,dmg:1.4,expireAt:oNow+1300,hitIds:new Set()});
        }
      }
    }
  }

  // ── Bullets
  const absorbR = player.r + 5 + UPG.absorbRange + (_barrierPulseTimer > 0 ? UPG.absorbRange + 40 : 0) + (_chainMagnetTimer > 0 ? UPG.absorbRange + 30 : 0);
  const decayMS = DECAY_BASE + UPG.decayBonus;

  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];

    if(b.state==='output' && b.expireAt && ts>=b.expireAt){
      // Payload: explode on expiration, damaging enemies in AoE
      if(b.hasPayload && enemies.length > 0){
        const aoeRadius = 48;
        for(const e of enemies){
          if(Math.hypot(e.x - b.x, e.y - b.y) < aoeRadius + e.r){
            e.hp -= b.dmg * 0.6; // AoE damage is 60% of bullet damage
          }
        }
        sparks(b.x, b.y, '#ff6b35', 8, 60);
      }
      bullets.splice(i,1);
      continue;
    }

    // Homing for output bullets
    if(b.state==='output'&&b.homing&&enemies.length>0){
      const tgt=enemies.reduce((bst,e)=>{const d=Math.hypot(e.x-b.x,e.y-b.y);return(!bst||d<bst.d)?{e,d}:bst;},null);
      if(tgt){
        const dx=tgt.e.x-b.x,dy=tgt.e.y-b.y,d=Math.hypot(dx,dy);
        b.vx+=(dx/d)*400*dt; b.vy+=(dy/d)*400*dt;
        const sp=Math.hypot(b.vx,b.vy);
        const maxSp=230*Math.min(2.0,UPG.shotSpd)*1.2;
        if(sp>maxSp){b.vx=b.vx/sp*maxSp;b.vy=b.vy/sp*maxSp;}
      }
    }

    if(UPG.gravityWell && b.state==='danger'){
      const gdist=Math.hypot(b.x-player.x,b.y-player.y);
      if(gdist<96){
        const drag=Math.pow(0.55,dt);
        b.vx*=drag; b.vy*=drag;
        // Floor: never fully stop a danger bullet
        const spd=Math.hypot(b.vx,b.vy);
        if(spd<40){const s=40/spd;b.vx*=s;b.vy*=s;}
      }
    }

    b.x+=b.vx*dt; b.y+=b.vy*dt;
    let bounced=false;
    if(b.x-b.r<M){b.x=M+b.r;b.vx=Math.abs(b.vx);bounced=true;}
    if(b.x+b.r>W-M){b.x=W-M-b.r;b.vx=-Math.abs(b.vx);bounced=true;}
    if(b.y-b.r<M){b.y=M+b.r;b.vy=Math.abs(b.vy);bounced=true;}
    if(b.y+b.r>H-M){b.y=H-M-b.r;b.vy=-Math.abs(b.vy);bounced=true;}

    if(bounced){
      if(b.state==='danger'){
        burstBlueDissipate(b.x, b.y);
        if(b.eliteStage !== undefined && b.bounceStages !== undefined && b.bounceStages > 0){
          // Elite bullet: transition to next stage on wall bounce
          applyEliteBulletStage(b, (b.eliteStage || 0) + 1);
          sparks(b.x, b.y, b.eliteColor, 4, 40);
        } else if(b.isTriangle){
          b.wallBounces++;
          if(b.wallBounces>=1){
            spawnTriangleBurst(b.x, b.y, b.vx, b.vy);
            bullets.splice(i,1);continue;
          }
        } else if((b.dangerBounceBudget || 0) > 0){
          b.dangerBounceBudget--;
          sparks(b.x, b.y, C.danger, 4, 40);
        } else if(b.doubleBounce){
          b.bounceCount++;
          if(b.bounceCount>=2){b.state='grey';b.decayStart=ts;sparks(b.x,b.y,C.grey,4,35);}
        } else {
          b.state='grey';b.decayStart=ts;
          sparks(b.x,b.y,C.grey,4,35);
        }
      } else if(b.state==='output'){
        if(b.bounceLeft>0){
          b.bounceLeft--;
          if(UPG.splitShot && !b.hasSplit){
            b.hasSplit=true;
            const splitNow=performance.now();
            const splitDeltas = UPG.splitShotEvolved ? [-0.42, 0, 0.42] : [-0.35, 0.35];
            const splitDamageFactor = UPG.splitShotEvolved ? 0.85 : 0.8;
            for(const delta of splitDeltas){
              const sa=Math.atan2(b.vy,b.vx)+delta;
              const sp=Math.hypot(b.vx,b.vy);
              bullets.push({x:b.x,y:b.y,vx:Math.cos(sa)*sp,vy:Math.sin(sa)*sp,state:'output',r:b.r*0.8,decayStart:null,bounceLeft:0,pierceLeft:b.pierceLeft,homing:b.homing,crit:b.crit,dmg:b.dmg*splitDamageFactor,expireAt:splitNow+2000,hitIds:new Set(),hasSplit:true});
            }
          }
        } else {
          // Payload: explode when no bounces left, damaging enemies in AoE
          if(b.hasPayload && enemies.length > 0){
            const aoeRadius = 48;
            for(const e of enemies){
              if(Math.hypot(e.x - b.x, e.y - b.y) < aoeRadius + e.r){
                e.hp -= b.dmg * 0.6; // AoE damage is 60% of bullet damage
              }
            }
            sparks(b.x, b.y, '#ff6b35', 8, 60);
          }
          bullets.splice(i,1);
          continue;
        }
      }
    }

    if(b.state==='grey'){
      if(ts-b.decayStart>decayMS){bullets.splice(i,1);continue;}
      b.vx*=Math.pow(.97,dt*60); b.vy*=Math.pow(.97,dt*60);
      if(Math.hypot(b.x-player.x,b.y-player.y)<absorbR+b.r){
        let absorbGain = UPG.absorbValue;
        if(UPG.ghostFlow){
          const spd = Math.hypot(player.vx, player.vy);
          const titanSlow = UPG.colossus ? 1 - (1 - (UPG.titanSlowMult || 1)) * 0.5 : (UPG.titanSlowMult || 1);
          const maxSpd = 165 * Math.min(2.5, (UPG.speedMult || 1) * titanSlow);
          const frac = Math.min(1, spd / Math.max(1, maxSpd));
          absorbGain *= 0.5 + frac * 1.1;
        }
        gainCharge(absorbGain, 'greyAbsorb');
        // Resonant Absorb
        if(UPG.resonantAbsorb){
          _absorbComboTimer=1500;
          _absorbComboCount++;
          if(_absorbComboCount>=3){
            gainCharge(UPG.absorbValue * (UPG.surgeHarvest ? 1.0 : 0.5), 'resonantAbsorb');
            _absorbComboCount=0;
          }
        }
        // Refraction: fire weak homing shot from absorbed grey bullet
        if(UPG.refraction && UPG.refractionCooldown <= 0){
          UPG.refractionCount = (UPG.refractionCount || 0) + 1;
          if(UPG.refractionCount <= 4){
            const angle = Math.atan2(player.y - b.y, player.x - b.x);
            const rNow = performance.now();
            bullets.push({x: b.x, y: b.y, vx: Math.cos(angle) * 140, vy: Math.sin(angle) * 140, state: 'output', r: 3.2, decayStart: null, bounceLeft: 0, pierceLeft: 0, homing: true, crit: false, dmg: 0.75, expireAt: rNow + 1600, hitIds: new Set()});
            if(UPG.refractionCount >= 4){
              UPG.refractionCooldown = 900;
              UPG.refractionCount = 0;
            }
          }
        }
        // Chain Magnet
        if(UPG.chainMagnetTier>0){
          _chainMagnetTimer=700+(UPG.chainMagnetTier-1)*350;
        }
        sparks(b.x,b.y,C.ghost,5,45);
        bullets.splice(i,1);continue;
      }
      // Absorb Orbs: grey bullets near any alive orbit sphere are absorbed
      if(UPG.absorbOrbs && UPG.orbitSphereTier>0){
        while(_orbCooldown.length < UPG.orbitSphereTier) _orbCooldown.push(0);
        let absorbed=false;
        for(let si=0;si<UPG.orbitSphereTier;si++){
          if(_orbCooldown[si]>0) continue;
          const sAngle=Math.PI*2/UPG.orbitSphereTier*si+ts*ORBIT_ROTATION_SPD;
          const sx=player.x+Math.cos(sAngle)*ORBIT_SPHERE_R;
          const sy=player.y+Math.sin(sAngle)*ORBIT_SPHERE_R;
          if(Math.hypot(b.x-sx,b.y-sy)<b.r+12){
            gainCharge(UPG.absorbValue, 'orbAbsorb');
            sparks(sx,sy,C.ghost,4,40);
            bullets.splice(i,1); absorbed=true; break;
          }
        }
        if(absorbed) continue;
      }
    }

    // Volatile Orbs: a danger bullet near any alive orbit sphere destroys the sphere + bullet
    if(b.state==='danger' && UPG.volatileOrbs && UPG.orbitSphereTier>0 && _volatileOrbGlobalCooldown<=0){
      while(_orbCooldown.length < UPG.orbitSphereTier) _orbCooldown.push(0);
      let orbHit=false;
      for(let si=0;si<UPG.orbitSphereTier;si++){
        if(_orbCooldown[si]>0) continue;
        const sAngle=Math.PI*2/UPG.orbitSphereTier*si+ts*ORBIT_ROTATION_SPD;
        const sx=player.x+Math.cos(sAngle)*ORBIT_SPHERE_R;
        const sy=player.y+Math.sin(sAngle)*ORBIT_SPHERE_R;
        if(Math.hypot(b.x-sx,b.y-sy)<b.r+7){
          _orbCooldown[si] = VOLATILE_ORB_COOLDOWN;
          _volatileOrbGlobalCooldown = VOLATILE_ORB_SHARED_COOLDOWN;
          sparks(sx,sy,C.green,10,80);
          bullets.splice(i,1); orbHit=true; break;
        }
      }
      if(orbHit) continue;
    }

    if(b.state==='danger' && player.shields.length>0){
      const total=player.shields.length;
      // Quick proximity guard: bullet must be near the orbital ring
      if(Math.hypot(b.x-player.x,b.y-player.y)<SHIELD_ORBIT_R+8+b.r){
        let shieldHit=false;
        for(let si=0;si<total;si++){
          const s=player.shields[si];
          if(s.cooldown>0) continue;
          const sAngle=Math.PI*2/total*si+ts*SHIELD_ROTATION_SPD;
          const sx=player.x+Math.cos(sAngle)*SHIELD_ORBIT_R;
          const sy=player.y+Math.sin(sAngle)*SHIELD_ORBIT_R;
          const shieldFacing = sAngle + Math.PI * 0.5;
          if(circleIntersectsShieldPlate(b.x, b.y, b.r, sx, sy, shieldFacing)){
            if(currentRoomTelemetry) currentRoomTelemetry.safety.shieldBlocks += 1;
            // Mirror Shield: reflect bullet back as output
            if(UPG.shieldMirror && (ts - (s.mirrorCooldown||0)) > 300){
              s.mirrorCooldown = ts;
              const mNow = performance.now();
              bullets.push({x:sx,y:sy,vx:b.vx,vy:b.vy,state:'output',r:4.5*Math.min(2.5,UPG.shotSize),decayStart:null,bounceLeft:0,pierceLeft:0,homing:false,crit:false,dmg:(UPG.playerDamageMult||1)*(UPG.denseDamageMult||1)*(UPG.aegisTitan ? MIRROR_SHIELD_DAMAGE_FACTOR * 2 : MIRROR_SHIELD_DAMAGE_FACTOR),expireAt:mNow+PLAYER_SHOT_LIFE_MS*(UPG.shotLifeMult||1),hitIds:new Set()});
            }
            // Tempered Shield: two-stage (purple -> blue -> pop)
            if(UPG.shieldTempered && s.hardened){
              s.hardened=false;
              sparks(sx,sy,C.shieldEnhanced,8,60);
              bullets.splice(i,1); shieldHit=true; break;
            }
            // Shield pops — Shield Burst fires 4/8-way output
            if(UPG.shieldBurst){
              const bNow=performance.now();
              const burstCount = UPG.aegisTitan ? 8 : 4;
              for(let ba=0;ba<burstCount;ba++){
                const bang=ba*Math.PI*2/burstCount;
                bullets.push({x:player.x,y:player.y,vx:Math.cos(bang)*230,vy:Math.sin(bang)*230,state:'output',r:4.5*Math.min(2.5,UPG.shotSize),decayStart:null,bounceLeft:0,pierceLeft:0,homing:false,crit:false,dmg:(UPG.playerDamageMult||1)*(UPG.denseDamageMult||1)*AEGIS_NOVA_DAMAGE_FACTOR,expireAt:bNow+PLAYER_SHOT_LIFE_MS*(UPG.shotLifeMult||1),hitIds:new Set()});
              }
            }
            // Barrier Pulse: +2 charge + magnet pulse
            if(UPG.barrierPulse){
              gainCharge(2, 'barrierPulse');
              _barrierPulseTimer=800;
            }
            const cd = getShieldCooldown();
            s.cooldown = cd; s.maxCooldown = cd;
            // AEGIS TITAN: all shields share one cooldown
            if(UPG.aegisTitan){ for(const os of player.shields){ if(os!==s && os.cooldown<=0){ os.cooldown=cd; os.maxCooldown=cd; os.hardened=false; } } }
            sparks(sx,sy,C.shieldActive,8,60);
            bullets.splice(i,1); shieldHit=true; break;
          }
        }
        if(shieldHit) continue;
      }
    }

    if(b.state==='danger'&&player.invincible<=0){
      
      // VOID WALKER: void zone blocks danger bullets (part of legendary combo)
      if(UPG.voidWalker && UPG.voidZoneActive && UPG.voidZoneTimer > ts){
        bullets.splice(i,1);
        sparks(b.x,b.y,'#8b5cf6',8,120);
        continue;
      }
      
      if(Math.hypot(b.x-player.x,b.y-player.y)<player.r+b.r-2){
        // Phase Dash: auto-dodge when about to take a hit
        if(
          UPG.phaseDash &&
          UPG.phaseDashCooldown <= 0 &&
          (UPG.phaseDashRoomUses || 0) < (UPG.phaseDashRoomLimit || 0)
        ){
          if(currentRoomTelemetry) currentRoomTelemetry.safety.phaseDashProcs += 1;
          UPG.phaseDashRoomUses = (UPG.phaseDashRoomUses || 0) + 1;
          UPG.isDashing = true;
          player.invincible = 0.45;
          UPG.phaseDashCooldown = 3500;
          // Dash away from the bullet
          const awayAng = Math.atan2(player.y - b.y, player.x - b.x);
          player.x += Math.cos(awayAng) * 75;
          player.y += Math.sin(awayAng) * 75;
          player.x = Math.max(M + player.r, Math.min(W - M - player.r, player.x));
          player.y = Math.max(M + player.r, Math.min(H - M - player.r, player.y));
          sparks(player.x, player.y, getThreatPalette().advanced.hex, 16, 200);
          if(UPG.voidWalker){
            UPG.voidZoneActive = true;
            UPG.voidZoneTimer = ts + 2000;
          }
          bullets.splice(i, 1);
          continue;
        }
        // Mirror Tide: reflect danger hit as output bullet
        if(
          UPG.mirrorTide &&
          UPG.mirrorTideCooldown <= 0 &&
          (UPG.mirrorTideRoomUses || 0) < (UPG.mirrorTideRoomLimit || 0)
        ){
          if(currentRoomTelemetry) currentRoomTelemetry.safety.mirrorTideProcs += 1;
          UPG.mirrorTideRoomUses = (UPG.mirrorTideRoomUses || 0) + 1;
          UPG.mirrorTideCooldown = 1500;
          const reflectAngle = Math.atan2(b.vy, b.vx) + Math.PI;
          const mNow = performance.now();
          bullets.push({x: player.x, y: player.y, vx: Math.cos(reflectAngle) * 200, vy: Math.sin(reflectAngle) * 200, state: 'output', r: b.r, decayStart: null, bounceLeft: 0, pierceLeft: 0, homing: false, crit: false, dmg: (UPG.playerDamageMult || 1) * (UPG.denseDamageMult || 1), expireAt: mNow + 2000, hitIds: new Set()});
          sparks(player.x, player.y, getThreatPalette().elite.hex, 12, 150);
          bullets.splice(i, 1);
          continue;
        }
        
        // Damage scaling: log-based for early game, reduced scaling post-30 (enemies have more health instead)
        const tierOver = Math.max(0, roomIndex - 29);
        const dmgScale = (1 + Math.log(roomIndex + 1) * 0.24) * (tierOver > 0 ? 1 + tierOver * 0.04 : 1);
        const rawDamage = Math.ceil(18 * dmgScale);
        const lateBloomDefenseMods = getLateBloomMods(roomIndex || 0);
        const finalDamage = Math.max(1, Math.ceil(rawDamage * (UPG.damageTakenMult || 1) * lateBloomDefenseMods.damageTaken));
        hp-=finalDamage; recordPlayerDamage(finalDamage, 'projectile'); player.invincible=1.2; player.distort=.45;
        tookDamageThisRoom = true;
        if(UPG.hitChargeGain > 0){
          gainCharge(UPG.hitChargeGain, 'hitReward');
        }
        
        // EMP Burst: at ≤30% HP + take damage, destroy all danger bullets (once per room)
        if(UPG.empBurst && !UPG.empBurstUsed && hp <= maxHp * 0.3){
          UPG.empBurstUsed = true;
          for(let ei = bullets.length - 1; ei >= 0; ei--){
            if(bullets[ei].state === 'danger'){
              sparks(bullets[ei].x, bullets[ei].y, '#fbbf24', 4, 100);
              bullets.splice(ei, 1);
            }
          }
          sparks(player.x, player.y, '#fbbf24', 20, 180);
        }
        
        sparks(player.x,player.y,C.danger,10,85);
        bullets.splice(i,1);
        // Colossus: shockwave converts nearby danger bullets to grey
        if(UPG.colossus && _colossusShockwaveCd <= 0){
          _colossusShockwaveCd = 4.0;
          for(let ci=bullets.length-1;ci>=0;ci--){ const cb=bullets[ci]; if(cb.state==='danger' && Math.hypot(cb.x-player.x,cb.y-player.y)<120){ cb.state='grey'; cb.decayStart=ts; } }
          sparks(player.x,player.y,getThreatPalette().advanced.hex,14,120);
        }
        if(hp<=0){
          if(UPG.lifeline && UPG.lifelineTriggerCount < (UPG.lifelineUses||1)){
            UPG.lifelineTriggerCount++; UPG.lifelineUsed=true; hp=1; player.invincible=2.0; sparks(player.x,player.y,C.lifelineEffect,16,100);
            if(UPG.lastStand){ const lsNow=performance.now(); for(let la=0;la<Math.floor(UPG.maxCharge);la++){ const lang=(Math.PI*2/Math.max(1,Math.floor(UPG.maxCharge)))*la; bullets.push({x:player.x,y:player.y,vx:Math.cos(lang)*220,vy:Math.sin(lang)*220,state:'output',r:4.5,decayStart:null,bounceLeft:UPG.bounceTier>0?2:0,pierceLeft:UPG.pierceTier,homing:false,crit:false,dmg:(UPG.playerDamageMult||1)*(UPG.denseDamageMult||1),expireAt:lsNow+2000,hitIds:new Set()}); } }
          }
          else { gameOver(); return; }
        }
        continue;
      }
      // Slipstream: near-miss detection
      if(UPG.slipTier>0 && _slipCooldown<=0){
        const dist=Math.hypot(b.x-player.x,b.y-player.y);
        if(dist < player.r+b.r+10 && dist >= player.r+b.r-2){
          const slipGain = UPG.slipChargeGain * (UPG.ghostFlow ? 2 : 1);
          gainCharge(slipGain, 'slipstream');
          _slipCooldown=150;
        }
      }
    }

    if(b.state==='output'){
      let removeBullet=false;
      for(let j=enemies.length-1;j>=0;j--){
        const e=enemies[j];
        if(b.hitIds.has(e.eid)) continue;
        if(Math.hypot(b.x-e.x,b.y-e.y)<b.r+e.r){
          b.hitIds.add(e.eid);
          const deadManThreshold = maxHp * 0.15;
          const deadManMult = (UPG.deadManTrigger && hp <= deadManThreshold) ? (UPG.finalForm ? 2.5 : 2) : 1;
          const deadManPierce = UPG.deadManTrigger && hp <= deadManThreshold;
          const dmg = (b.crit ? CRIT_DAMAGE_FACTOR : 1) * b.dmg * deadManMult;
          e.hp-=dmg;
          sparks(b.x,b.y,b.crit?C.ghost:C.green,b.crit?8:5,b.crit?70:55);
          // Blood Pact: piercing shots restore 1 HP per enemy hit
          if(UPG.bloodPact && b.pierceLeft > 0){
            healPlayer(1, 'bloodPact');
          }
          if(e.hp<=0){
            score+=e.pts*(b.crit?2:1);kills++; recordKill();
            sparks(e.x,e.y,e.col, e.isBoss ? 30 : 14, e.isBoss ? 160 : 95);
            // Death bullets scatter as grey
            spawnGreyDrops(e.x,e.y,ts);
            // Escalation: track kills in room for damage scaling
            if(UPG.escalation) UPG.escalationKills = (UPG.escalationKills || 0) + 1;
            // Boss death: big HP restore + stop escort respawns
            if(e.isBoss) {
              bossAlive = false;
              healPlayer(Math.floor(maxHp * 0.5), 'bossReward');
              showBossDefeated();
            }
            // Vampiric Return: +5 HP and +0.5 charge per kill
            if(UPG.vampiric){ 
              healPlayer(5, 'vampiric'); 
              gainCharge(0.5, 'vampiric');
            }
              // Predator's Instinct: track kill streak (5s window)
              UPG.predatorKillStreak++;
              UPG.predatorKillStreakTime = ts + 5000;
              
              // Blood Rush: grant +10% speed for 3s, stacks to +50%
              if(UPG.bloodRush){
                if(!UPG.bloodRushStacks) UPG.bloodRushStacks = 0;
                UPG.bloodRushStacks = Math.min(5, UPG.bloodRushStacks + 1);
                UPG.bloodRushTimer = ts + 3000;
              }
              
              // Crimson Harvest: drop extra grey bullet at enemy position
              if(UPG.crimsonHarvest){
                bullets.push({x:e.x,y:e.y,vx:(Math.random()-0.5)*150,vy:(Math.random()-0.5)*150,state:'grey',r:5,decayStart:ts,bounceLeft:0,pierceLeft:0,homing:false,crit:false,dmg:0,hitIds:new Set()});
              }
              
              // Sanguine Burst: every 8th kill (or 4th if Rampage) fires burst
              if(UPG.sanguineBurst){
                UPG.sanguineKillCount = (UPG.sanguineKillCount || 0) + 1;
                const burstThreshold = UPG.rampageEvolved ? 4 : 8;
                if(UPG.sanguineKillCount >= burstThreshold){
                  UPG.sanguineKillCount = 0;
                  const numShots = UPG.rampageEvolved ? 8 : 6;
                  const angleStep = Math.PI * 2 / numShots;
                  for(let a=0;a<numShots;a++){
                    const ang = a * angleStep;
                    const vx = Math.cos(ang) * 220;
                    const vy = Math.sin(ang) * 220;
                    bullets.push({x:player.x,y:player.y,vx,vy,state:'output',r:5.5,decayStart:null,bounceLeft:UPG.bounceTier,pierceLeft:UPG.pierceTier,homing:UPG.homingTier>0,crit:false,dmg:(UPG.playerDamageMult||1)*(UPG.denseDamageMult||1),expireAt:ts+2200,hitIds:new Set()});
                  }
                }
              }
              
              // BLOOD MOON: enhanced kill rewards
              if(UPG.bloodMoon){
                healPlayer(8, 'bossReward');
                for(let i=0;i<3;i++){
                  const ang = (Math.PI*2/3)*i + Math.random()*0.3;
                  bullets.push({x:e.x,y:e.y,vx:Math.cos(ang)*120,vy:Math.sin(ang)*120,state:'grey',r:5,decayStart:ts,bounceLeft:0,pierceLeft:0,homing:false,crit:false,dmg:0,hitIds:new Set()});
                }
              }
              
            // Corona: ring kills refund 1 charge
            if(b.isRing && UPG.corona){ gainCharge(1, 'corona'); }
            // Final Form: low-HP kills grant charge
            if(UPG.finalForm && hp <= maxHp * 0.15){ gainCharge(0.5, 'finalForm'); }
            enemies.splice(j,1);
          }
          if(deadManPierce || b.pierceLeft>0){
            if(!deadManPierce){
              b.pierceLeft--;
              if((b.pierceLeft===0 || UPG.volatileAllTargets) && UPG.volatileRounds){
                const vNow=performance.now();
                for(let va=0;va<4;va++){
                  const vang=va*Math.PI/2;
                  bullets.push({x:b.x,y:b.y,vx:Math.cos(vang)*180,vy:Math.sin(vang)*180,state:'output',r:b.r*0.75,decayStart:null,bounceLeft:0,pierceLeft:0,homing:false,crit:false,dmg:b.dmg*0.65,expireAt:vNow+1600,hitIds:new Set()});
                }
                sparks(b.x,b.y,C.green,6,60);
              }
            }
          } else { removeBullet=true; break; }
        }
      }
      if(removeBullet){bullets.splice(i,1);continue;}
      if(b.x<-10||b.x>W+10||b.y<-10||b.y>H+10){bullets.splice(i,1);continue;}
    }
  }

  // ── Particles
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];
    p.x+=p.vx*dt;p.y+=p.vy*dt;
    p.vx*=Math.pow(.84,dt*60);p.vy*=Math.pow(.84,dt*60);
    p.life-=p.decay*dt;
    if(p.life<=0)particles.splice(i,1);
  }
}

// ── ROOM CLEAR FLASH ──────────────────────────────────────────────────────────
function showRoomClear(){
  const el=document.getElementById('room-clear');
  el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'),1400);
}

function showBossDefeated() {
  const el = document.getElementById('room-clear');
  const txt = document.getElementById('room-clear-txt');
  txt.textContent = 'BOSS DEFEATED';
  el.classList.add('show', 'boss-clear');
  setTimeout(() => {
    el.classList.remove('show', 'boss-clear');
    txt.textContent = 'ROOM CLEAR';
  }, 2000);
}

function showRoomIntro(text, isGo) {
  const el = document.getElementById('room-intro');
  const txt = document.getElementById('room-intro-txt');
  txt.textContent = text;
  el.classList.toggle('go', Boolean(isGo));
  el.classList.add('show');
}

function hideRoomIntro() {
  const el = document.getElementById('room-intro');
  el.classList.remove('show', 'go');
}

// ── DRAW ──────────────────────────────────────────────────────────────────────
function draw(ts){
  const W=cv.width,H=cv.height;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle=C.bg;ctx.fillRect(0,0,W,H);

  // Grid
  ctx.strokeStyle=C.grid;ctx.lineWidth=1;
  const gs=28;
  for(let x=M;x<W-M;x+=gs){ctx.beginPath();ctx.moveTo(x,M);ctx.lineTo(x,H-M);ctx.stroke();}
  for(let y=M;y<H-M;y+=gs){ctx.beginPath();ctx.moveTo(M,y);ctx.lineTo(W-M,y);ctx.stroke();}

  // Arena border — neutral
  ctx.strokeStyle='rgba(255,255,255,0.1)';ctx.lineWidth=1.5;
  ctx.strokeRect(M,M,W-2*M,H-2*M);

  // Corner ticks
  ctx.strokeStyle='rgba(255,255,255,0.2)';ctx.lineWidth=1.5;
  const tick=12;
  [[M,M],[W-M,M],[M,H-M],[W-M,H-M]].forEach(([cx,cy])=>{
    const sx=cx===M?1:-1,sy=cy===M?1:-1;
    ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+sx*tick,cy);ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx,cy+sy*tick);ctx.stroke();
  });

  // Particles
  ctx.save();
  for(const p of particles){
    ctx.globalAlpha=Math.max(0,p.life*.85);
    ctx.fillStyle=p.col;
    const particleR = (3 + (p.grow || 0) * (1 - p.life)) * Math.max(0.18, p.life);
    ctx.beginPath();ctx.arc(p.x,p.y,particleR,0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=1;ctx.restore();

  // Bullets
  for(const b of bullets){
    if(b.state==='danger'){
      const pulse=.75+.25*Math.sin(ts*.014);
      const doubleBouncePalette = getDoubleBounceBulletPalette();
      let bCol, bCore;
      if(b.eliteColor){
        bCol = b.eliteColor;
        bCore = b.eliteCore || C.dangerCore;
      } else if(b.isTriangle){
        bCol=C.danger;
        bCore=C.dangerCore;
      } else {
        bCol=b.doubleBounce&&b.bounceCount===0 ? doubleBouncePalette.fill : C.danger;
        bCore=b.doubleBounce&&b.bounceCount===0 ? doubleBouncePalette.core : C.dangerCore;
      }
      ctx.globalAlpha = 0.88;
      ctx.shadowColor=bCol;ctx.shadowBlur=16*pulse;
      ctx.fillStyle=bCol;
      if(b.isTriangle){
        const angle = Math.atan2(b.vy, b.vx);
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(b.r, 0);
        ctx.lineTo(-b.r*.6, b.r*.6);
        ctx.lineTo(-b.r*.6, -b.r*.6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();
      }
      ctx.shadowBlur=0;ctx.fillStyle=bCore;
      if(!b.isTriangle){
        ctx.beginPath();ctx.arc(b.x,b.y,b.r*.42,0,Math.PI*2);ctx.fill();
      }
      ctx.globalAlpha = 1;

    } else if(b.state==='grey'){
      const age=(ts-b.decayStart)/(DECAY_BASE+UPG.decayBonus);
      ctx.globalAlpha=Math.max(.10,0.82-age*.72);
      ctx.shadowColor=C.grey;ctx.shadowBlur=5;
      ctx.fillStyle=C.grey;
      ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=1;ctx.shadowBlur=0;

    } else if(b.state==='output'){
      const col = b.crit?C.ghost:C.green;
      ctx.shadowColor=col;ctx.shadowBlur=b.crit?28:18;
      drawGooBall(
        b.x,
        b.y,
        b.r,
        b.crit ? C.getRgba(C.ghost, 0.82) : C.getRgba(C.green, 0.72),
        b.crit ? 'rgba(255,255,255,0.94)' : C.getRgba(C.ghost, 0.84),
        ts * 0.013 + b.x * 0.09 + b.y * 0.07,
        0.92
      );
      ctx.shadowBlur=0;
    }
    ctx.shadowBlur=0;
  }

  // Enemies
  const WINDUP_MS_DRAW = 520;
  for(const e of enemies){
    ctx.save();

    // Windup tell: very subtle swell + faint ring
    const inWindup = !e.isRusher && !e.isSiphon && e.fT >= e.fRate - WINDUP_MS_DRAW;
    let drawR = e.r;
    if(inWindup){
      const prog = (e.fT - (e.fRate - WINDUP_MS_DRAW)) / WINDUP_MS_DRAW; // 0→1
      drawR = e.r * (1 + prog * 0.12); // max 12% swell — subtle
      // Faint ring only
      ctx.strokeStyle = `rgba(255,255,255,${0.08 + prog * 0.18})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(e.x, e.y, drawR + 4, 0, Math.PI*2);
      ctx.stroke();
    }

    if(e.isSiphon){
      const threat = getThreatPalette();
      const dd=Math.hypot(e.x-player.x,e.y-player.y);
      const aa=dd<72?.14+.08*Math.sin(ts*.006):.04;
      const g=ctx.createRadialGradient(e.x,e.y,0,e.x,e.y,72);
      g.addColorStop(0,C.getRgba(threat.siphon.hex, aa * 4));
      g.addColorStop(1,C.getRgba(threat.siphon.hex, 0));
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(e.x,e.y,72,0,Math.PI*2);ctx.fill();
    }

    ctx.shadowColor= e.glowCol;
    ctx.shadowBlur = 16;
    ctx.fillStyle = e.col;
    if(e.isTriangle){
      const angle = Math.atan2(player.y - e.y, player.x - e.x);
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(drawR, 0);
      ctx.lineTo(-drawR * 0.5, drawR * 0.866);
      ctx.lineTo(-drawR * 0.5, -drawR * 0.866);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      // Inner glint along the tip axis
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath();
      ctx.moveTo(drawR * 0.55, 0);
      ctx.lineTo(-drawR * 0.25, drawR * 0.43);
      ctx.lineTo(-drawR * 0.25, -drawR * 0.43);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      ctx.beginPath();ctx.arc(e.x,e.y,drawR,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;
      // Inner glint
      ctx.fillStyle='rgba(255,255,255,0.18)';
      ctx.beginPath();ctx.arc(e.x,e.y,drawR*.38,0,Math.PI*2);ctx.fill();
    }

    if(e.hp<e.maxHp){
      const bw = e.isBoss ? e.r * 2.8 : e.r * 2.4;
      const bh = e.isBoss ? 5 : 3;
      const bx = e.x - bw/2;
      const by = e.y - e.r - (e.isBoss ? 12 : 8);
      ctx.fillStyle='#0a0e1a';ctx.fillRect(bx,by,bw,bh);
      ctx.fillStyle = e.col;
      ctx.fillRect(bx,by,bw*(e.hp/e.maxHp),bh);
    }
    ctx.fillStyle = e.isBoss ? C.getRgba(e.col, 0.72) : 'rgba(180,180,180,0.45)';
    ctx.font = e.isBoss ? 'bold 9px IBM Plex Mono,monospace' : '7px IBM Plex Mono,monospace';
    ctx.textAlign='center';
    ctx.fillText(e.isBoss ? '★ BOSS' : e.type.toUpperCase(), e.x, e.y + e.r + (e.isBoss ? 14 : 11));
    ctx.restore();
  }

  // Ghost player sprite
  const show=player.invincible<=0||Math.floor(ts/90)%2===0;
  if(show){ drawGhost(ts); }

  // Shields
  if(player.shields && player.shields.length>0){
    const total=player.shields.length;
    for(let si=0;si<total;si++){
      const s=player.shields[si];
      const sAngle=Math.PI*2/total*si+ts*SHIELD_ROTATION_SPD;
      const sx=player.x+Math.cos(sAngle)*SHIELD_ORBIT_R;
      const sy=player.y+Math.sin(sAngle)*SHIELD_ORBIT_R;
      const shieldFacing = sAngle + Math.PI * 0.5;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(shieldFacing);
      if(s.cooldown>0){
        const frac=s.cooldown/(s.maxCooldown||SHIELD_COOLDOWN);
        ctx.globalAlpha=0.25+0.15*frac;
        ctx.strokeStyle=C.shieldActive;
        ctx.lineWidth=1.5;
        ctx.strokeRect(-SHIELD_HALF_W,-SHIELD_HALF_H,SHIELD_HALF_W * 2,SHIELD_HALF_H * 2);
        // Partial fill showing regeneration progress
        ctx.globalAlpha=0.12*(1-frac);
        ctx.fillStyle=C.shieldActive;
        ctx.fillRect(-SHIELD_HALF_W,-SHIELD_HALF_H,SHIELD_HALF_W * 2,SHIELD_HALF_H * 2);
      } else {
        const shieldCol = (UPG.shieldTempered && s.hardened) ? C.shieldEnhanced : C.shieldActive;
        ctx.shadowColor=shieldCol; ctx.shadowBlur=14;
        ctx.strokeStyle=shieldCol;
        ctx.lineWidth=2;
        ctx.globalAlpha=0.9;
        ctx.strokeRect(-SHIELD_HALF_W,-SHIELD_HALF_H,SHIELD_HALF_W*2,SHIELD_HALF_H*2);
        ctx.shadowBlur=0;
        ctx.fillStyle=(UPG.shieldTempered&&s.hardened)?C.getShieldEnhancedRgba(0.18):C.getShieldActiveRgba(0.18);
        ctx.fillRect(-SHIELD_HALF_W,-SHIELD_HALF_H,SHIELD_HALF_W*2,SHIELD_HALF_H*2);
      }
      ctx.restore();
    }
  }

  // Orbit Spheres
  if(UPG.orbitSphereTier>0){
    for(let si=0;si<UPG.orbitSphereTier;si++){
      const sAngle=Math.PI*2/UPG.orbitSphereTier*si+ts*ORBIT_ROTATION_SPD;
      const sx=player.x+Math.cos(sAngle)*ORBIT_SPHERE_R;
      const sy=player.y+Math.sin(sAngle)*ORBIT_SPHERE_R;
      if(_orbCooldown[si]>0){
        // Recharging — show as dim ghost with progress ring
        ctx.save();
        ctx.globalAlpha=0.18;
        ctx.fillStyle=C.green;
        ctx.beginPath();ctx.arc(sx,sy,5,0,Math.PI*2);ctx.fill();
        ctx.restore();
        continue;
      }
      ctx.save();
      ctx.shadowColor=C.green;ctx.shadowBlur=12;
      ctx.fillStyle=C.green;
      ctx.globalAlpha=0.85;
      ctx.beginPath();ctx.arc(sx,sy,5,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;
      ctx.fillStyle=C.getRgba(C.ghost, 0.92);
      ctx.beginPath();ctx.arc(sx,sy,2,0,Math.PI*2);ctx.fill();
      ctx.restore();
    }
  }

  // VOID WALKER void zone indicator
  if(UPG.voidWalker && UPG.voidZoneActive && UPG.voidZoneTimer > ts){
    ctx.save();
    const frac = Math.max(0, (UPG.voidZoneTimer - ts) / 2000);
    ctx.globalAlpha = 0.35 * frac;
    ctx.fillStyle = '#8b5cf6';
    ctx.beginPath();
    ctx.arc(player.x, player.y, 150, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.55 * frac;
    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }

  // Joystick anchor — tiny subtle dot where finger landed
  if(joy.active){
    ctx.globalAlpha=0.18;
    ctx.strokeStyle='#fff';
    ctx.lineWidth=1;
    ctx.beginPath();ctx.arc(joy.ax,joy.ay,joy.max || JOY_MAX,0,Math.PI*2);ctx.stroke();
    ctx.globalAlpha=0.35;
    ctx.fillStyle='#fff';
    ctx.beginPath();ctx.arc(joy.ax,joy.ay,3,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;
  }
}

// ── GHOST SPRITE ──────────────────────────────────────────────────────────────
function drawGhost(ts){
  const p=player;
  if(!p||!p.x) return;
  const t=ts/1000;
  const chargeFrac=Math.min(1,charge/Math.max(1,UPG.maxCharge||10));
  const shotInterval = 1 / (UPG.sps * 2);
  const fireFrac = charge >= 1 ? Math.max(0, Math.min(1, fireT / shotInterval)) : 0;
  const overload=chargeFrac>=0.95;
  const overloadPulse=overload?Math.sin(t*12)*.3+.7:1;
  const lean=Math.max(-.3,Math.min(.3,player.vx/300));
  const wobble=Math.sin(t*3)*2;
  const deathFrac = gstate === 'dying' ? Math.max(0, Math.min(1, (ts - player.deadAt) / GAME_OVER_ANIM_MS)) : 0;
  const popFrac = gstate === 'dying' ? Math.max(0, Math.min(1, (ts - player.popAt) / (GAME_OVER_ANIM_MS * 0.28))) : 0;
  const size=player.r*1.18+chargeFrac*3.9 - deathFrac*1.2;

  ctx.save();
  if(player.distort>0 || gstate === 'dying'){
    ctx.translate(p.x,p.y+wobble);
    const deathScale = gstate === 'dying' ? 1 + deathFrac * 0.22 - popFrac * 1.1 : 1;
    ctx.scale((1+.12*Math.sin(ts*.06)) * deathScale,(1+.12*Math.cos(ts*.07)) * deathScale);
    ctx.rotate(lean);
  } else {
    ctx.translate(p.x,p.y+wobble);
    ctx.rotate(lean);
  }

  // Ambient glow
  const pulse=.55+.45*Math.sin(ts*.0025);
  const gRgb = C.ghostRgb;
  const ga=ctx.createRadialGradient(0,0,0,0,0,size*3);
  ga.addColorStop(0,gstate === 'dying' ? `rgba(248,180,199,${0.14 + deathFrac * 0.16})` : overload?`rgba(${gRgb.r},${gRgb.g},${gRgb.b},${0.20 + 0.08 * pulse})`:`rgba(${gRgb.r},${gRgb.g},${gRgb.b},${0.18*pulse})`);
  ga.addColorStop(1,`rgba(${gRgb.r},${gRgb.g},${gRgb.b},0)`);
  ctx.fillStyle=ga;
  ctx.beginPath();ctx.arc(0,0,size*3,0,Math.PI*2);ctx.fill();

  ctx.shadowBlur=22+chargeFrac*14;
  ctx.shadowColor=gstate === 'dying' ? '#f8b4c7' : overload?C.ghost:C.ghost;

  const inv=player.invincible>0?Math.min(1,player.invincible/.4):0;
  const baseRgb = C.ghostBodyRgb;
  const accentRgb = C.greenRgb;
  let bodyR,bodyG,bodyB;
  if(gstate === 'dying'){
    bodyR = 208;
    bodyG = 244 - Math.round(deathFrac * 36);
    bodyB = 224 + Math.round(deathFrac * 12);
  } else if(overload){
    const tintMix = Math.min(0.55, 0.34 + overloadPulse * 0.18);
    bodyR=Math.round(baseRgb.r + (accentRgb.r - baseRgb.r) * tintMix);
    bodyG=Math.round(baseRgb.g + (accentRgb.g - baseRgb.g) * tintMix);
    bodyB=Math.round(baseRgb.b + (accentRgb.b - baseRgb.b) * tintMix);
  } else {
    bodyR=Math.round(Math.min(255,baseRgb.r+inv*26));
    bodyG=Math.round(Math.min(255,baseRgb.g+inv*12));
    bodyB=Math.round(Math.min(255,baseRgb.b+inv*22));
  }
  ctx.fillStyle=`rgba(${bodyR},${bodyG},${bodyB},0.93)`;

  ctx.beginPath();
  ctx.arc(0,-size*.2,size,Math.PI,0);
  const tailW=size,segs=4;
  for(let s=0;s<=segs;s++){
    const xOff=tailW-(s/segs)*tailW*2;
    const yOff=size*.8+Math.sin(t*3+s)*2;
    if(s===0) ctx.lineTo(tailW,yOff);
    else ctx.lineTo(xOff,yOff);
  }
  ctx.closePath();ctx.fill();
  ctx.shadowBlur=0;

  // 🐰 Easter bunny ears (seasonal)
  if(_isEaster){
    const earH = size * 1.6;
    const earW = size * 0.35;
    const earBase = -size * 1.1;
    ctx.save();

    // Left ear — tall and straight, slight outward tilt
    ctx.save();
    ctx.translate(-size * 0.3, earBase);
    ctx.rotate(-0.15);
    // Outer ear
    ctx.fillStyle = `rgba(${bodyR},${bodyG},${bodyB},0.93)`;
    ctx.beginPath();
    ctx.ellipse(0, -earH * 0.5, earW, earH * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(${Math.max(0,bodyR-40)},${Math.max(0,bodyG-30)},${Math.max(0,bodyB-40)},0.6)`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Inner ear (pink)
    ctx.fillStyle = 'rgba(255,180,200,0.55)';
    ctx.beginPath();
    ctx.ellipse(0, -earH * 0.5, earW * 0.5, earH * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Right ear — flopped over to the right
    ctx.save();
    ctx.translate(size * 0.3, earBase);
    ctx.rotate(0.9);
    ctx.fillStyle = `rgba(${bodyR},${bodyG},${bodyB},0.93)`;
    ctx.beginPath();
    ctx.ellipse(0, -earH * 0.4, earW * 0.9, earH * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(${Math.max(0,bodyR-40)},${Math.max(0,bodyG-30)},${Math.max(0,bodyB-40)},0.6)`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,180,200,0.55)';
    ctx.beginPath();
    ctx.ellipse(0, -earH * 0.4, earW * 0.45, earH * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  ctx.fillStyle='#080f0a';
  ctx.beginPath();ctx.arc(-5.5,-size*.25,3,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(5.5, -size*.25,3,0,Math.PI*2);ctx.fill();
  if(gstate === 'dying'){
    ctx.strokeStyle='rgba(12,20,16,0.85)';
    ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(-5.5,-size*.25,1.5,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.arc(5.5,-size*.25,1.5,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.arc(0,size*.08,4.6,Math.PI+.25,Math.PI*2-.25);ctx.stroke();
  } else {
    ctx.fillStyle=C.getRgba(C.green, 0.9);
    ctx.beginPath();ctx.arc(-4.5,-size*.3,1.3,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(4.5, -size*.3,1.3,0,Math.PI*2);ctx.fill();
  }

  if(chargeFrac>0.3 && gstate !== 'dying'){
    ctx.strokeStyle='rgba(0,0,0,0.55)';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(0,-size*.1,4.5,.2,Math.PI-.2);ctx.stroke();
  }

  // Shot cooldown ring mirrors the enemy tell ring and shows when auto-fire is primed.
  const ringRadius = size + 8;
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
  ctx.stroke();
  if(charge >= 1){
    ctx.strokeStyle = C.green;
    ctx.shadowColor = C.green;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fireFrac);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // ── HP bar above ghost (drawn in local space, above dome)
  const barW=size*2.8, barH=4;
  const barY = -size * (1.55 + (_isEaster ? 1.5 : 0));
  const barX=-barW/2;
  const hpFrac=Math.max(0,hp/maxHp);
  // Track
  ctx.fillStyle='rgba(0,0,0,0.55)';
  ctx.beginPath();ctx.roundRect(barX-1,barY-1,barW+2,barH+2,2);ctx.fill();
  // Fill uses the selected player accent while still warning at mid/low HP.
  const hpCol = hpFrac > 0.5 ? C.green : hpFrac > 0.25 ? '#fbbf24' : '#f87171';
  ctx.shadowBlur=6; ctx.shadowColor=hpCol;
  ctx.fillStyle=hpCol;
  ctx.beginPath();ctx.roundRect(barX,barY,barW*hpFrac,barH,2);ctx.fill();
  ctx.shadowBlur=0;

  ctx.restore();
}

// ── HUD ───────────────────────────────────────────────────────────────────────
function hudUpdate(){
  document.getElementById('room-counter').textContent=`ROOM ${roomIndex+1}`;
  document.getElementById('score-txt').textContent=score;
  document.getElementById('charge-fill').style.width=`${Math.max(0, Math.min(100, (charge / UPG.maxCharge) * 100))}%`;
  document.getElementById('charge-badge').textContent=`${Math.floor(charge)} / ${UPG.maxCharge}`;
  document.getElementById('sps-num').textContent=UPG.sps.toFixed(1);
}

bindJoystickControls({
  canvas: cv,
  joy,
  getGameState: () => gstate,
});

renderPatchNotes();
patchNotesBtn?.addEventListener('click', () => setPatchNotesOpen(true));
patchNotesCloseBtn?.addEventListener('click', () => setPatchNotesOpen(false));
patchNotesPanel?.addEventListener('click', (event) => {
  if(event.target === patchNotesPanel) setPatchNotesOpen(false);
});
document.addEventListener('keydown', (event) => {
  if(event.key === 'Escape') {
    setPatchNotesOpen(false);
  }
});

function openLeaderboardScreen() {
  lbScreen.classList.remove('off');
  refreshLeaderboardView();
}

if(lbOpenBtn){
  lbOpenBtn.addEventListener('click', openLeaderboardScreen);
}
if(lbOpenBtnGo){
  lbOpenBtnGo.addEventListener('click', openLeaderboardScreen);
}
lbCloseBtn.addEventListener('click', () => lbScreen.classList.add('off'));
lbPeriodBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    lbPeriod = btn.dataset.lbPeriod;
    refreshLeaderboardView();
  });
});
lbScopeBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    lbScope = btn.dataset.lbScope;
    refreshLeaderboardView();
  });
});

function setPlayerName(v, { syncInputs = false } = {}){
  const sanitized = sanitizeName(v);
  playerName = sanitized || 'RUNNER';
  try {
    localStorage.setItem(NAME_KEY, sanitized);
  } catch {}
  if(syncInputs){
    nameInputStart.value = sanitized;
    nameInputGo.value = sanitized;
  }
  refreshLeaderboardView();
}

nameInputStart.addEventListener('input', (e)=>setPlayerName(e.target.value));
nameInputGo.addEventListener('input', (e)=>setPlayerName(e.target.value));

// Initialize color picker on start screen
renderColorSelector('color-picker');
syncColorDrivenCopy();

// Start game from name entry screen
document.getElementById('btn-start').onclick=()=>{
  setPlayerName(nameInputStart.value, { syncInputs: true });
  setMenuChromeVisible(false);
  startScreen.classList.add('off');
  init();gstate='playing';lastT=performance.now();raf=requestAnimationFrame(loop);
};

document.getElementById('btn-restart').onclick=()=>{
  setPlayerName(nameInputGo.value, { syncInputs: true });
  setMenuChromeVisible(false);
  gameOverScreen.classList.add('off');
  if(goBoonsPanel) goBoonsPanel.classList.add('off');
  init();gstate='playing';lastT=performance.now();raf=requestAnimationFrame(loop);
};

mainMenuBtn?.addEventListener('click', () => {
  setPlayerName(nameInputGo.value, { syncInputs: true });
  gameOverScreen.classList.add('off');
  if(goBoonsPanel) goBoonsPanel.classList.add('off');
  lbScreen.classList.add('off');
  setMenuChromeVisible(true);
  startScreen.classList.remove('off');
  gstate = 'start';
});

goBoonsBtn?.addEventListener('click', ()=>goBoonsPanel?.classList.toggle('off'));
goBoonsCloseBtn?.addEventListener('click', ()=>goBoonsPanel?.classList.add('off'));

const lbBoonsPopup = document.getElementById('lb-boons-popup');
const lbBoonsPopupTitle = document.getElementById('lb-boons-popup-title');
const lbBoonsPopupList = document.getElementById('lb-boons-popup-list');
document.getElementById('btn-lb-boons-close')?.addEventListener('click', () => lbBoonsPopup?.classList.add('off'));

function orderBoonsForDisplay(boons, boonOrder = '') {
  if(!Array.isArray(boons) || boons.length < 2 || !boonOrder) return boons;
  const orderedNames = boonOrder.split(',').map((name) => name.trim()).filter(Boolean);
  if(orderedNames.length === 0) return boons;
  const orderMap = new Map(orderedNames.map((name, index) => [name, index]));
  return [...boons].sort((a, b) => {
    const aIndex = orderMap.has(a.name) ? orderMap.get(a.name) : Number.MAX_SAFE_INTEGER;
    const bIndex = orderMap.has(b.name) ? orderMap.get(b.name) : Number.MAX_SAFE_INTEGER;
    return aIndex - bIndex || a.name.localeCompare(b.name);
  });
}

function showLbBoonsPopup(runnerName, boons, boonOrder = '') {
  if(!lbBoonsPopup) return;
  lbBoonsPopupTitle.textContent = `${runnerName} · Run Loadout`;
  lbBoonsPopupList.innerHTML = '';
  const orderedBoons = orderBoonsForDisplay(boons, boonOrder);
  if(!orderedBoons || orderedBoons.length === 0) {
    lbBoonsPopupList.innerHTML = '<div class="up-active-empty">No boon data recorded.</div>';
  } else {
    for(const b of orderedBoons) {
      const row = document.createElement('div');
      row.className = 'up-active-item';
      row.innerHTML = `<div class="up-active-icon">${b.icon}</div><div class="up-active-copy"><div class="up-active-name">${b.name}</div><div class="up-active-detail">${b.detail}</div></div>`;
      lbBoonsPopupList.appendChild(row);
    }
  }
  lbBoonsPopup.classList.remove('off');
}


loadLeaderboard();
setLeaderboardStatus('local', 'LOCAL FALLBACK');
setPlayerName(loadSavedPlayerName(), { syncInputs: true });
renderLeaderboard();
revealAppShell();

draw(0);
