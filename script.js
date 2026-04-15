import { C, ROOM_SCRIPTS, BOSS_ROOMS, DECAY_BASE, M, VERSION } from './src/data/gameData.js';
import { CHARGED_ORB_FIRE_INTERVAL_MS, ESCALATION_KILL_PCT, ESCALATION_MAX_BONUS, getActiveBoonEntries, getDefaultUpgrades, getRequiredShotCount, getKineticChargeRate, syncChargeCapacity, getEvolvedBoon, checkLegendarySequences, getLateBloomGrowth, LATE_BLOOM_SPEED_PENALTY, LATE_BLOOM_DAMAGE_TAKEN_PENALTY, LATE_BLOOM_DAMAGE_PENALTY } from './src/data/boons.js';
import { ENEMY_TYPES, createEnemy, canEnemyUsePurpleShots } from './src/entities/enemyTypes.js';
import {
  resolveEnemySeparation,
  stepEnemyCombatState,
  fireEnemyBurst,
  applyOrbitSphereContact,
} from './src/entities/enemyRuntime.js';
import {
  applyEliteBulletStage as applyEliteBulletStageValue,
  getDoubleBounceBulletPalette as getDoubleBounceBulletPaletteValue,
  spawnAimedEnemyBullet,
  spawnRadialEnemyBullet,
  spawnTriangleBurst as spawnTriangleBurstValue,
  spawnEliteBullet as spawnEliteBulletValue,
  spawnEliteTriangleBurst as spawnEliteTriangleBurstValue,
} from './src/entities/projectiles.js';
import {
  pushGreyBullet,
  pushOutputBullet,
  spawnGreyDrops as spawnGreyDropsValue,
  spawnSplitOutputBullets,
  spawnRadialOutputBurst,
} from './src/entities/playerProjectiles.js';
import {
  createLaneOffsets as createLaneOffsetsValue,
  buildPlayerShotPlan,
  buildPlayerVolleySpecs,
} from './src/entities/playerFire.js';
import {
  syncOrbRuntimeArrays,
  getOrbitSlotPosition,
  getShieldSlotPosition,
  tickShieldCooldowns,
  countReadyShields,
  advanceAegisBatteryTimer,
  buildAegisBatteryBoltSpec,
  buildMirrorShieldReflectionSpec,
  buildShieldBurstSpec,
  buildChargedOrbVolleyForSlot,
} from './src/entities/defenseRuntime.js';
import { JOY_DEADZONE, JOY_MAX, createJoystickState, resetJoystickState, bindJoystickControls, tickJoystick } from './src/input/joystick.js';
import { fetchRemoteLeaderboard, submitRemoteScore, submitRunDiagnostic } from './src/platform/leaderboardService.js';
import {
  refreshLeaderboardSync,
  shouldRefreshLeaderboardAfterSubmit,
  submitLeaderboardEntryRemote,
} from './src/platform/leaderboardRuntime.js';
import { bindResponsiveViewport } from './src/platform/viewport.js';
import { bindGestureGuards } from './src/platform/gestureGuards.js';
import { readText, writeText, readJson, writeJson, removeKey } from './src/platform/storage.js';
import { buildGameLoopCrashReport, saveRunCrashReport } from './src/platform/diagnostics.js';
import {
  sanitizePlayerName,
  parseLocalLeaderboardRows,
  upsertLocalLeaderboardEntry,
  buildLocalScoreEntry,
} from './src/platform/leaderboardLocal.js';
import {
  createLeaderboardSyncState,
  beginLeaderboardSync,
  applyLeaderboardSyncSuccess,
  applyLeaderboardSyncFailure,
  forceLocalLeaderboardFallback,
} from './src/platform/leaderboardController.js';
import { showBoonSelection } from './src/ui/boonSelection.js';
import { renderVersionTag } from './src/ui/versionTag.js';
import { PLAYER_COLORS, getPlayerColor, getPlayerColorScheme, getThreatPalette, setPlayerColor } from './src/data/colorScheme.js';
import { PATCH_NOTES, PATCH_NOTES_ARCHIVE_MESSAGE } from './src/data/patchNotes.js';
import { renderColorSelector } from './src/ui/colorSelector.js';
import { formatRunTime, renderHud } from './src/ui/hud.js';
import {
  renderLeaderboard as renderLeaderboardView,
  syncLeaderboardStatusBadge as syncLeaderboardStatusBadgeView,
} from './src/ui/leaderboard.js';
import { renderGameOverBoonsList, showLeaderboardBoonsPopup } from './src/ui/boonsPanel.js';
import { renderPatchNotesPanel, setPatchNotesVisibility } from './src/ui/patchNotes.js';
import { showGameOverScreen } from './src/ui/gameOver.js';
import {
  bindPatchNotesControls,
  bindLeaderboardControls,
  bindBoonsPanelControls,
  bindPopupClose,
} from './src/ui/appChrome.js';
import {
  setPlayerNameState,
  bindNameInputs,
  bindSessionFlow,
} from './src/ui/sessionFlow.js';
import {
  showRoomClearOverlay,
  showBossDefeatedOverlay,
  showRoomIntroOverlay,
  hideRoomIntroOverlay,
} from './src/ui/roomOverlays.js';
import {
  revealAppShell as revealAppShellView,
  syncColorDrivenCopy as syncColorDrivenCopyView,
  setMenuChromeVisible as setMenuChromeVisibleView,
} from './src/ui/shell.js';
import {
  getKillSustainCapForRoom as getKillSustainCapForRoomValue,
  applyKillSustainHeal as applyKillSustainHealValue,
} from './src/systems/sustain.js';
import { computeKillScore, computeFiveRoomCheckpointBonus } from './src/systems/scoring.js';
import { applyDamagelessRoomProgression as applyDamagelessRoomProgressionValue } from './src/systems/progression.js';
import { computeProjectileHitDamage } from './src/systems/damage.js';
import {
  generateWeightedWave as generateWeightedWaveValue,
  buildSpawnQueue as buildSpawnQueueValue,
} from './src/systems/spawnBudget.js';
import {
  shouldExpireOutputBullet,
  shouldRemoveBulletOutOfBounds,
  resolveDangerBounceState,
  resolveOutputBounceState,
} from './src/systems/bulletRuntime.js';
import {
  resolveOutputEnemyHit,
} from './src/systems/outputHit.js';
import {
  resolveEnemyKillEffects,
  resolveOrbitKillEffects,
  applyKillUpgradeState,
  buildKillRewardActions,
} from './src/systems/killRewards.js';
import {
  resolveDangerPlayerHit,
  resolveSlipstreamNearMiss,
  resolveRusherContactHit,
  convertNearbyDangerBulletsToGrey,
  resolvePostHitAftermath,
} from './src/systems/dangerHit.js';
import {
  createRunTelemetry as createRunTelemetryValue,
  createRoomTelemetry as createRoomTelemetryValue,
  buildRunTelemetryPayload as buildRunTelemetryPayloadValue,
} from './src/systems/telemetry.js';
import { createInitialPlayerState, createInitialRunMetrics, createInitialRuntimeTimers } from './src/core/runState.js';
import {
  getRoomDef as getRoomDefValue,
  getRoomMaxOnScreen as getRoomMaxOnScreenValue,
  getReinforcementIntervalMs as getReinforcementIntervalMsValue,
  getBossEscortRespawnMs as getBossEscortRespawnMsValue,
} from './src/core/roomFlow.js';
import {
  advanceRoomIntroPhase,
  getPendingWaveIntroIndex,
  pullWaveSpawnEntries,
  getPostSpawningPhase,
  shouldForceClearFromCombat,
  updateBossEscortRespawn,
  pullReinforcementSpawn,
  advanceClearPhase,
} from './src/core/roomRuntime.js';

const PLAYER_COLOR_KEY = 'phantom-player-color';
const storedPlayerColor = readText(PLAYER_COLOR_KEY, 'green');
setPlayerColor(PLAYER_COLORS[storedPlayerColor] ? storedPlayerColor : 'green');
renderVersionTag(VERSION);

// 🐰 Easter seasonal flag — show bunny ears on Easter weekend
const _now = new Date();
const _isEaster = (_now.getMonth() === 3 && _now.getDate() >= 4 && _now.getDate() <= 6); // Apr 4-6

bindGestureGuards({ doc: document });
let startDangerCopy;

function revealAppShell() {
  revealAppShellView({ doc: document, raf: requestAnimationFrame });
}

function syncColorDrivenCopy() {
  syncColorDrivenCopyView(startDangerCopy, getThreatPalette().dangerKey);
}

window.addEventListener('phantom:player-color-change', (event) => {
  const colorKey = event.detail?.key || getPlayerColor();
  writeText(PLAYER_COLOR_KEY, colorKey);
  syncColorDrivenCopy(event.detail?.scheme || getPlayerColorScheme());
});

const cv  = document.getElementById('cv');
const ctx = cv.getContext('2d');
const LB_KEY = 'phantom-rebound-leaderboard-v1';
const NAME_KEY = 'phantom-rebound-runner-name';
const LEGACY_RUN_RECOVERY_KEY = 'phantom-rebound-run-recovery-v1';

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
const versionOpenBtn = document.getElementById('btn-version-open');
const patchNotesPanel = document.getElementById('patch-notes-panel');
const versionPanel = document.getElementById('version-panel');
const patchNotesCurrent = document.getElementById('patch-notes-current');
const patchNotesList = document.getElementById('patch-notes-list');
const patchNotesArchiveNote = document.getElementById('patch-notes-archive-note');
const patchNotesCloseBtn = document.getElementById('btn-patch-notes-close');
const versionCurrentEl = document.getElementById('version-current');
const versionLatestEl = document.getElementById('version-latest');
const versionStatusEl = document.getElementById('version-status');
const versionCheckedAtEl = document.getElementById('version-checked-at');
const versionRefreshBtn = document.getElementById('btn-version-refresh');
const versionCloseBtn = document.getElementById('btn-version-close');
const versionUpdateBtn = document.getElementById('btn-version-update');
const UPDATE_AVAILABLE_KEY = 'phantom-rebound-update-available';
let latestAvailableVersion = null;
const roomClearEl = document.getElementById('room-clear');
const roomClearTextEl = document.getElementById('room-clear-txt');
const roomIntroEl = document.getElementById('room-intro');
const roomIntroTextEl = document.getElementById('room-intro-txt');
const lbPeriodBtns = document.querySelectorAll('[data-lb-period]');
const lbScopeBtns = document.querySelectorAll('[data-lb-scope]');
const goBoonsBtn = document.getElementById('btn-go-boons');
const goBoonsPanel = document.getElementById('go-boons-panel');
const goBoonsList = document.getElementById('go-boons-list');
const goBoonsCloseBtn = document.getElementById('btn-go-boons-close');
const goScoreEl = document.getElementById('go-score');
const goNoteEl = document.getElementById('go-note');
const mainMenuBtn = document.getElementById('btn-main-menu');
const wrap = document.getElementById('wrap');
const topHud = document.getElementById('top-hud');
const botHud = document.getElementById('bot-hud');
const legend = document.getElementById('legend');
const roomCounterEl = document.getElementById('room-counter');
const scoreTextEl = document.getElementById('score-txt');
const chargeFillEl = document.getElementById('charge-fill');
const chargeBadgeEl = document.getElementById('charge-badge');
const spsNumberEl = document.getElementById('sps-num');

function setMenuChromeVisible(isVisible) {
  setMenuChromeVisibleView({ doc: document, isVisible, onResize: resize });
}

function resize() {
  const BASE_ARENA_ASPECT = 1.18;
  const viewportWidth = window.visualViewport?.width || window.innerWidth;
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  const isPhoneWidth = viewportWidth <= 430;
  const maxArenaAspect = isPhoneWidth ? 1.78 : 1.34;
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
  const extendedHeightCap = Math.floor(finalWidth * maxArenaAspect);
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
  const requiredShots = getRequiredShotCount(UPG);
  return Math.max(1, Math.min(5, Math.round(1 + (requiredShots - 1) * 0.55)));
}

function renderGameOverBoons() {
  renderGameOverBoonsList(goBoonsList, getActiveBoonEntries(UPG));
}

function syncPlayerScale() {
  if(!player) return;
  player.r = 9 * (UPG.playerSizeMult || 1);
}

function renderPatchNotes() {
  renderPatchNotesPanel({
    currentEl: patchNotesCurrent,
    listEl: patchNotesList,
    archiveEl: patchNotesArchiveNote,
    versionNumber: VERSION.num,
    versionLabel: VERSION.label,
    notes: PATCH_NOTES,
    archiveMessage: PATCH_NOTES_ARCHIVE_MESSAGE,
    doc: document,
  });
}

function setPatchNotesOpen(isOpen) {
  if(isOpen) setVersionPanelOpen(false);
  setPatchNotesVisibility(patchNotesPanel, isOpen);
}

function setVersionPanelOpen(isOpen) {
  if(!versionPanel) return;
  if(isOpen) setPatchNotesOpen(false);
  versionPanel.classList.toggle('off', !isOpen);
  versionPanel.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
  if(isOpen) refreshVersionStatus();
}

function setVersionStatusClass(element, mode) {
  if(!element) return;
  element.classList.remove('ok', 'warn', 'err');
  if(mode) element.classList.add(mode);
}

async function refreshVersionStatus() {
  if(!versionCurrentEl || !versionLatestEl || !versionStatusEl || !versionCheckedAtEl) return;
  const currentBuild = VERSION.num;
  versionCurrentEl.textContent = `v${currentBuild}`;
  versionLatestEl.textContent = 'Checking...';
  versionStatusEl.textContent = 'Checking...';
  versionCheckedAtEl.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  setVersionStatusClass(versionStatusEl, null);
  versionUpdateBtn?.classList.remove('show');
  latestAvailableVersion = null;

  try {
    const response = await fetch(`version.json?ts=${Date.now()}`, { cache: 'no-store' });
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const latestVersion = data?.version || 'Unknown';
    versionLatestEl.textContent = latestVersion === 'Unknown' ? latestVersion : `v${latestVersion}`;
    if(latestVersion === currentBuild) {
      versionStatusEl.textContent = 'Up to date';
      setVersionStatusClass(versionStatusEl, 'ok');
      try { sessionStorage.removeItem(UPDATE_AVAILABLE_KEY); } catch {}
    } else {
      versionStatusEl.textContent = 'Update available';
      setVersionStatusClass(versionStatusEl, 'warn');
      versionUpdateBtn?.classList.add('show');
      latestAvailableVersion = latestVersion;
      try { sessionStorage.setItem(UPDATE_AVAILABLE_KEY, latestVersion); } catch {}
    }
  } catch {
    versionLatestEl.textContent = 'Unavailable';
    versionStatusEl.textContent = 'Check failed';
    setVersionStatusClass(versionStatusEl, 'err');
  }
}

// ── STATE ─────────────────────────────────────────────────────────────────────
const BASE_PLAYER_HP = 200;
let gstate = 'start';
let player = {};
let bullets = [], enemies = [], particles = [];
let score=0, kills=0;
let charge=0, fireT=0, stillTimer=0, prevStill=false;
let hp=BASE_PLAYER_HP, maxHp=BASE_PLAYER_HP;
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
const PHASE_DASH_DAMAGE_MULT = 0.05;
const GLOBAL_SPEED_LIFT = 1.45;
const VAMPIRIC_HEAL_PER_KILL = 4;
const VAMPIRIC_CHARGE_PER_KILL = 0.25;
const VAMPIRIC_HEAL_CAP_BASE = 14;
const VAMPIRIC_HEAL_CAP_PER_ROOM = 0.22;
const VAMPIRIC_HEAL_CAP_MAX = 34;
const KILL_SUSTAIN_CAP_CONFIG = {
  baseHealCap: VAMPIRIC_HEAL_CAP_BASE,
  perRoomHealCap: VAMPIRIC_HEAL_CAP_PER_ROOM,
  maxHealCap: VAMPIRIC_HEAL_CAP_MAX,
};
const BLOOD_PACT_BASE_HEAL_CAP_PER_BULLET = 1;
const BLOOD_PACT_BLOOD_MOON_BONUS_CAP = 1;
let enemyIdSeq = 1;
let playerName = 'RUNNER';
let leaderboard = [];
let lbPeriod = 'daily';
let lbScope = 'everyone';
const lbSync = createLeaderboardSyncState();
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
let _killSustainHealedThisRoom = 0;
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
let runElapsedMs = 0;
let spawnQueue = [];
let activeWaveIndex = 0;
let roomClearTimer = 0;
let roomPurpleShooterAssigned = false;
let roomIntroTimer = 0;
const ROOM_NAMES = ROOM_SCRIPTS.map((room) => room.name);
const BASE_CONTACT_INVULN_S = 1.0;
const BASE_PROJECTILE_INVULN_S = 1.2;
const BOSS_CLEAR_INVULN_REDUCTION_S = 0.08;
const MIN_CONTACT_INVULN_S = 0.45;
const MIN_PROJECTILE_INVULN_S = 0.6;

// Boss room state
let bossAlive = false;
let bossClears = 0;
let escortType = '';
let escortMaxCount = 2;
let escortRespawnTimer = 0;
let reinforceTimer = 0;
let currentRoomIsBoss = false;
let currentRoomMaxOnScreen = 99;
let currentBossDamageMultiplier = 1;
let runTelemetry = null;
let currentRoomTelemetry = null;

function roundTelemetryValue(value) {
  return Math.round(value * 100) / 100;
}

function getPostHitInvulnSeconds(kind = 'projectile') {
  const reduction = bossClears * BOSS_CLEAR_INVULN_REDUCTION_S;
  if(kind === 'contact') {
    return Math.max(MIN_CONTACT_INVULN_S, BASE_CONTACT_INVULN_S - reduction);
  }
  return Math.max(MIN_PROJECTILE_INVULN_S, BASE_PROJECTILE_INVULN_S - reduction);
}

function getKillSustainCapForRoom(room = roomIndex || 0) {
  return getKillSustainCapForRoomValue(room, KILL_SUSTAIN_CAP_CONFIG);
}

function applyKillSustainHeal(amount, source) {
  const result = applyKillSustainHealValue({
    amount,
    roomIndex: roomIndex || 0,
    healedThisRoom: _killSustainHealedThisRoom,
    healPlayer,
    source,
    config: KILL_SUSTAIN_CAP_CONFIG,
  });
  _killSustainHealedThisRoom = result.healedThisRoom;
  return result.applied;
}

function awardFiveRoomScoreBonus() {
  if(!runTelemetry) return;
  score += computeFiveRoomCheckpointBonus(runTelemetry.rooms);
}

function applyRoomClearProgression() {
  const progression = applyDamagelessRoomProgressionValue({
    tookDamageThisRoom,
    damagelessRooms,
    boonRerolls,
    streakThreshold: 3,
    rerollCap: 3,
  });
  damagelessRooms = progression.damagelessRooms;
  boonRerolls = progression.boonRerolls;
}

function getViewportModeLabel() {
  if(document.body.classList.contains('tight-viewport')) return 'tight';
  if(document.body.classList.contains('compact-viewport')) return 'compact';
  return 'default';
}

function createRunTelemetry() {
  return createRunTelemetryValue({
    build: VERSION.num,
    playerColor: getPlayerColor(),
    viewportMode: getViewportModeLabel(),
    canvasWidth: cv.width,
    canvasHeight: cv.height,
  });
}

function createRoomTelemetry(roomNumber, roomDef) {
  return createRoomTelemetryValue({
    roomNumber,
    roomDef,
    viewportMode: getViewportModeLabel(),
    canvasWidth: cv.width,
    canvasHeight: cv.height,
    hpStart: roundTelemetryValue(hp),
  });
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
  const gained = charge - before;
  const wasted = amount - gained;
  if(currentRoomTelemetry && wasted > 0) {
    currentRoomTelemetry.charge.wasted = roundTelemetryValue((currentRoomTelemetry.charge.wasted || 0) + wasted);
  }
  return recordChargeGain(source, gained);
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

function recordShotSpend(count) {
  if(!currentRoomTelemetry || count <= 0) return;
  currentRoomTelemetry.offense.shotsFired += count;
  currentRoomTelemetry.offense.chargeSpent = roundTelemetryValue(currentRoomTelemetry.offense.chargeSpent + count);
}

function recordControlTelemetry(dt, isStill) {
  if(!currentRoomTelemetry || !(roomPhase === 'spawning' || roomPhase === 'fighting')) return;
  const ms = dt * 1000;
  const control = currentRoomTelemetry.control;
  if(isStill) control.stillMs = roundTelemetryValue(control.stillMs + ms);
  else control.movingMs = roundTelemetryValue(control.movingMs + ms);
  if(charge >= UPG.maxCharge) control.fullChargeMs = roundTelemetryValue(control.fullChargeMs + ms);
  if(enemies.length > 0) {
    if(!isStill) control.movingWithEnemiesMs = roundTelemetryValue(control.movingWithEnemiesMs + ms);
    if(!isStill && charge >= 1) control.movingNoFireMs = roundTelemetryValue(control.movingNoFireMs + ms);
    if(isStill && charge >= 1) control.firingReadyMs = roundTelemetryValue(control.firingReadyMs + ms);
  }
}

function recordKill(source = 'output') {
  if(!currentRoomTelemetry) return;
  currentRoomTelemetry.kills += 1;
  if(source === 'orbit') currentRoomTelemetry.offense.orbitKills += 1;
  else currentRoomTelemetry.offense.outputKills += 1;
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
    moveChargeRate: roundTelemetryValue(getKineticChargeRate(UPG) * (UPG.fluxState ? 2 : 1)),
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

function finalizeCurrentRoomTelemetry(endState, clearMs = roomTimer) {
  if(!currentRoomTelemetry || !runTelemetry) return;
  currentRoomTelemetry.end = endState;
  currentRoomTelemetry.clearMs = Math.round(clearMs);
  currentRoomTelemetry.hpEnd = roundTelemetryValue(hp);
  currentRoomTelemetry.damageless = currentRoomTelemetry.damageless && !tookDamageThisRoom;
  runTelemetry.rooms.push(currentRoomTelemetry);
  if(endState === 'clear') awardFiveRoomScoreBonus();
  currentRoomTelemetry = null;
}

function buildRunTelemetryPayload() {
  return buildRunTelemetryPayloadValue({
    runTelemetry,
    currentRoomTelemetry,
    hp,
    tookDamageThisRoom,
    roomTimer,
    roomIndex,
    score,
    roundTelemetryValue,
  });
}

function getRoomDef(idx) {
  return getRoomDefValue(idx, {
    roomNames: ROOM_NAMES,
    bossRooms: BOSS_ROOMS,
    generateWeightedWave,
  });
}

function generateWeightedWave(roomIdx) {
  return generateWeightedWaveValue(roomIdx, ENEMY_TYPES);
}

function buildSpawnQueue(roomDef) {
  return buildSpawnQueueValue(roomDef);
}

function beginWaveIntro(nextWaveIndex) {
  activeWaveIndex = nextWaveIndex;
  roomPhase = 'intro';
  roomIntroTimer = 0;
  bullets = [];
  particles = [];
  player.x = cv.width / 2;
  player.y = cv.height / 2;
  player.vx = 0;
  player.vy = 0;
  showRoomIntro(`WAVE ${nextWaveIndex + 1}`, false);
}

function startRoom(idx) {
  tookDamageThisRoom = false;
  _vampiricRestoresThisRoom = 0;
  _killSustainHealedThisRoom = 0;
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
  bossClears = 0;
  roomPurpleShooterAssigned = false;
  const def = getRoomDef(idx);
  spawnQueue = buildSpawnQueue(def);
  activeWaveIndex = 0;
  roomTimer = 0;
  roomIntroTimer = 0;
  roomPhase = 'intro';
  enemies = [];
  bullets = [];
  // Boss room state
  currentRoomIsBoss = Boolean(def.isBossRoom);
  bossAlive = currentRoomIsBoss;
  currentBossDamageMultiplier = def.bossDamageMultiplier || 1;
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
  return getRoomMaxOnScreenValue(idx, isBossRoom);
}

function getReinforcementIntervalMs(idx) {
  return getReinforcementIntervalMsValue(idx);
}

function getBossEscortRespawnMs(idx) {
  return getBossEscortRespawnMsValue(idx);
}

function spawnEnemy(type, isBoss = false, bossScale = 1) {
  const enemy = createEnemy(type, {
    width: cv.width,
    height: cv.height,
    margin: M,
    roomIndex,
    nextEnemyId: enemyIdSeq++,
    isBoss,
    bossScale,
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
  return (0.68 + Math.min(roomIndex, 10) * 0.032) * GLOBAL_SPEED_LIFT;
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

function getProjectileHitDamage(multiplier = 1) {
  const lateBloomDefenseMods = getLateBloomMods(roomIndex || 0);
  return computeProjectileHitDamage({
    roomIndex,
    bossDamageMultiplier: currentBossDamageMultiplier,
    damageTakenMultiplier: UPG.damageTakenMult || 1,
    lateBloomDamageTakenMultiplier: lateBloomDefenseMods.damageTaken,
    multiplier,
  });
}

function applyEliteBulletStage(bullet, stage) {
  return applyEliteBulletStageValue({
    bullet,
    stage,
    getThreatPalette,
    getRgba: C.getRgba,
  });
}

function getDoubleBounceBulletPalette() {
  return getDoubleBounceBulletPaletteValue({
    getThreatPalette,
    getRgba: C.getRgba,
  });
}

function spawnEB(ex,ey) {
  spawnAimedEnemyBullet({
    bullets,
    player,
    x: ex,
    y: ey,
    bulletSpeedScale,
    onSpawn: recordDangerBulletSpawn,
  });
}

function spawnZB(ex,ey,idx,total) {
  spawnRadialEnemyBullet({
    bullets,
    x: ex,
    y: ey,
    idx,
    total,
    bulletSpeedScale,
    onSpawn: recordDangerBulletSpawn,
  });
}

function spawnEliteZB(ex, ey, idx, total, stageOverride) {
  const a = (Math.PI * 2 / total) * idx;
  const spd = 125 * bulletSpeedScale();
  const stage = stageOverride !== undefined ? stageOverride : 0;
  spawnEliteBullet(ex, ey, a, spd, stage);
}

function spawnDBB(ex,ey) {
  spawnAimedEnemyBullet({
    bullets,
    player,
    x: ex,
    y: ey,
    bulletSpeedScale,
    extras: { doubleBounce: true, bounceCount: 0 },
    onSpawn: recordDangerBulletSpawn,
  });
}

function spawnTB(ex,ey) {
  spawnAimedEnemyBullet({
    bullets,
    player,
    x: ex,
    y: ey,
    spread: 0.18,
    radius: 7,
    bulletSpeedScale,
    extras: { isTriangle: true, wallBounces: 0 },
    onSpawn: recordDangerBulletSpawn,
  });
}

function spawnTriangleBurst(ex, ey, origVx, origVy) {
  spawnTriangleBurstValue({
    bullets,
    x: ex,
    y: ey,
    origVx,
    origVy,
    bulletSpeedScale,
    onSpawn: recordDangerBulletSpawn,
    sparks,
    sparkColor: C.danger,
  });
}

// Elite bullets advance through the current threat palette rather than fixed colors.
function spawnEliteBullet(ex, ey, angle, speed, stageOverride, extras = {}) {
  spawnEliteBulletValue({
    bullets,
    x: ex,
    y: ey,
    angle,
    speed,
    stage: stageOverride !== undefined ? stageOverride : 0,
    extras,
    onSpawn: recordDangerBulletSpawn,
    getThreatPalette,
    getRgba: C.getRgba,
  });
}

// Elite triangle shots use the same staged palette, just scaled up.
function spawnEliteTriangleBullet(ex, ey) {
  const a = Math.atan2(player.y - ey, player.x - ex) + (Math.random() - 0.5) * 0.18;
  const spd = (145 + Math.random() * 40) * bulletSpeedScale();
  spawnEliteBullet(ex, ey, a, spd, 1, { r: 7 });
}

function spawnEliteTriangleBurst(ex, ey, origVx, origVy) {
  spawnEliteTriangleBurstValue({
    bullets,
    x: ex,
    y: ey,
    origVx,
    origVy,
    bulletSpeedScale,
    onSpawn: recordDangerBulletSpawn,
    sparks,
    sparkColor: getThreatPalette().advanced.hex,
    getThreatPalette,
    getRgba: C.getRgba,
  });
}

function createLaneOffsets(count, spacing) {
  return createLaneOffsetsValue(count, spacing);
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

function drawBulletSprite(b, ts) {
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

const VOLLEY_TOTAL_DAMAGE_MULTS = [1.00, 1.75, 2.40, 2.95, 3.40, 3.75, 4.00];
const ORBITAL_FOCUS_CONTACT_BONUS = 1.5;
const ORBITAL_FOCUS_CHARGED_ORB_DAMAGE_MULT = 1.6;
const ORBITAL_FOCUS_CHARGED_ORB_INTERVAL_MULT = 0.65;
const ORB_TWIN_TOTAL_DAMAGE_MULT = 1.6;
const ORB_OVERCHARGE_DAMAGE_MULT = 1.1;
const AEGIS_BATTERY_READY_PLATE_BONUS = 0.25;
const AEGIS_BATTERY_BOLT_INTERVAL_MS = 1800;

function getVolleyTotalDamageMultiplier(shotCount) {
  const count = Math.max(1, Math.floor(shotCount || 1));
  return VOLLEY_TOTAL_DAMAGE_MULTS[Math.min(VOLLEY_TOTAL_DAMAGE_MULTS.length - 1, count - 1)];
}

function getChargeRatio() {
  return Math.max(0, Math.min(1, charge / Math.max(1, UPG.maxCharge || 1)));
}

function getReadyShieldCount() {
  return countReadyShields(player.shields);
}

function getAegisBatteryDamageMult() {
  if(!UPG.aegisBattery) return 1;
  return 1 + getReadyShieldCount() * AEGIS_BATTERY_READY_PLATE_BONUS;
}

function getBloodPactHealCap() {
  return BLOOD_PACT_BASE_HEAL_CAP_PER_BULLET + (UPG.bloodMoon ? BLOOD_PACT_BLOOD_MOON_BONUS_CAP : 0);
}

function getPlayerShotChargeReserve(isStill, enemyCount = enemies.length) {
  if(!isStill || enemyCount <= 0) return 0;
  return Math.max(1, getRequiredShotCount(UPG));
}

function firePlayer(tx,ty) {
  if(charge < 1) return;
  const angs = buildPlayerShotPlan({
    tx,
    ty,
    player,
    upg: UPG,
  });

  const availableShots = Math.min(Math.floor(charge), angs.length);
  if(availableShots <= 0) return;

  const snipeScale = 1 + UPG.snipePower * 0.18;
  const bspd = 230 * GLOBAL_SPEED_LIFT * Math.min(2.0, UPG.shotSpd) * snipeScale;
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
  const volleyTotalDamageMult = getVolleyTotalDamageMultiplier(availableShots);
  const volleyPerBulletDamageMult = volleyTotalDamageMult / availableShots;
  
  // Overload: if active and at full charge, apply 2.5x damage multiplier and consume charge
  let overloadBonus = 1;
  if(UPG.overload && UPG.overloadActive && charge >= UPG.maxCharge){
    overloadBonus = 2.5;
    UPG.overloadActive = false;
    UPG.overloadCooldown = 3000;
    charge = 0;
  }

  const volleySpecs = buildPlayerVolleySpecs({
    shots: angs,
    availableShots,
    player,
    upg: UPG,
    bulletSpeed: bspd,
    baseRadius,
    baseDamage: baseDmg * volleyPerBulletDamageMult,
    lifeMs,
    overchargeBonus,
    overloadBonus,
    getPierceLeft: (shot) => UPG.pierceTier + ((shot.isRing && UPG.corona) ? 1 : 0),
    getBloodPactHealCap,
    now,
  });
  volleySpecs.forEach((spec) => pushOutputBullet({ bullets, ...spec }));
  charge=Math.max(0,charge-availableShots);
  recordShotSpend(availableShots);
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
      const echoSpecs = buildPlayerVolleySpecs({
        shots: angs,
        availableShots,
        player,
        upg: { ...UPG, critChance: 0 },
        bulletSpeed: bspd,
        baseRadius,
        baseDamage: baseDmg * volleyPerBulletDamageMult,
        lifeMs,
        overchargeBonus: 1,
        overloadBonus: 1,
        getPierceLeft: (shot) => UPG.pierceTier + ((shot.isRing && UPG.corona) ? 1 : 0),
        getBloodPactHealCap,
        now: eNow,
        random: () => 1,
      });
      echoSpecs.forEach((spec) => pushOutputBullet({ bullets, ...spec }));
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
  spawnGreyDropsValue({
    bullets,
    x,
    y,
    ts,
    count,
    maxBullets: MAX_BULLETS,
  });
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

function loadLeaderboard() {
  leaderboard = parseLocalLeaderboardRows(readJson(LB_KEY, []), {
    gameVersion: VERSION.num,
    limit: 500,
  });
}

function loadSavedPlayerName() {
  return sanitizePlayerName(readText(NAME_KEY, ''));
}

function saveLeaderboard() {
  writeJson(LB_KEY, leaderboard.slice(0, 500));
}

function buildScoreEntry() {
  const boons = getActiveBoonEntries(UPG);
  const playerColor = getPlayerColor();
  const boonOrder = (UPG.boonSelectionOrder || []).join(',');
  return buildLocalScoreEntry({
    playerName,
    score,
    room: roomIndex + 1,
    runTimeMs: Math.round(runElapsedMs),
    gameVersion: VERSION.num,
    color: playerColor,
    boonOrder,
    boons,
    telemetry: buildRunTelemetryPayload(),
  });
}

function clearLegacyRunRecovery() {
  removeKey(LEGACY_RUN_RECOVERY_KEY);
}

function renderLeaderboard() {
  renderLeaderboardView({
    lbCurrent,
    lbStatus,
    lbList,
    lbPeriod,
    lbScope,
    playerName,
    lbStatusMode: lbSync.statusMode,
    lbStatusText: lbSync.statusText,
    useRemoteLeaderboardRows: lbSync.useRemoteRows,
    remoteLeaderboardRows: lbSync.remoteRows,
    leaderboard,
    playerColors: PLAYER_COLORS,
    formatRunTime,
    onOpenBoons: showLbBoonsPopup,
    lbPeriodBtns,
    lbScopeBtns,
  });
}

async function refreshLeaderboardView() {
  const result = await refreshLeaderboardSync({
    lbSync,
    period: lbPeriod,
    scope: lbScope,
    playerName,
    gameVersion: VERSION.num,
    limit: 10,
    fetchRemoteLeaderboard,
    beginLeaderboardSync,
    applyLeaderboardSyncSuccess,
    applyLeaderboardSyncFailure,
    onSyncStart: () => {
      syncLeaderboardStatusBadgeView(lbStatus, lbSync.statusMode, lbSync.statusText);
      renderLeaderboard();
    },
  });
  if(!result.applied) return;
  syncLeaderboardStatusBadgeView(lbStatus, lbSync.statusMode, lbSync.statusText);
  renderLeaderboard();
}

function pushLeaderboardEntry() {
  const entry = buildScoreEntry();
  leaderboard = upsertLocalLeaderboardEntry(leaderboard, entry, 500);
  saveLeaderboard();
  submitLeaderboardEntryRemote({
    entry,
    gameVersion: VERSION.num,
    submitRemoteScore,
    forceLocalLeaderboardFallback,
    lbSync,
  }).then((result) => {
    if(result.ok && shouldRefreshLeaderboardAfterSubmit({
      lbScope,
      playerName,
      entryName: entry.name,
    })) {
      refreshLeaderboardView();
      return;
    }
    if(!result.ok) {
      syncLeaderboardStatusBadgeView(lbStatus, lbSync.statusMode, lbSync.statusText);
      renderLeaderboard();
    }
  });
  clearLegacyRunRecovery();
  renderLeaderboard();
}

function handleGameLoopCrash(error) {
  console.error('Phantom Rebound game loop crashed', error);
  try {
    const entry = buildScoreEntry();
    const report = buildGameLoopCrashReport({
      error,
      entry,
      bulletsCount: bullets.length,
      enemiesCount: enemies.length,
      particlesCount: particles.length,
    });
    saveRunCrashReport(report);
    submitRunDiagnostic({
      playerName: entry.name,
      score: entry.score,
      room: entry.room,
      gameVersion: entry.version || VERSION.num,
      report,
      playerColor: entry.color || entry.boons.color || 'green',
    }).catch(() => {});
  } catch {}
  gstate = 'gameover';
  cancelAnimationFrame(raf);
  showGameOverScreen({
    panelEl: gameOverScreen,
    boonsPanelEl: goBoonsPanel,
    scoreEl: goScoreEl,
    noteEl: goNoteEl,
    score,
    note: `Crash captured at Room ${roomIndex+1} · diagnostic saved, score not submitted`,
    renderBoons: renderGameOverBoons,
  });
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
  const runMetrics = createInitialRunMetrics(BASE_PLAYER_HP);
  const runtimeTimers = createInitialRuntimeTimers();
  clearLegacyRunRecovery();
  score = runMetrics.score; kills = runMetrics.kills;
  charge = runMetrics.charge; fireT = runMetrics.fireT; stillTimer = runMetrics.stillTimer; prevStill = runMetrics.prevStill;
  hp = runMetrics.hp; maxHp = runMetrics.maxHp;
  runElapsedMs = runMetrics.runElapsedMs;
  gameOverShown = runMetrics.gameOverShown;
  boonRerolls = runMetrics.boonRerolls;
  damagelessRooms = runMetrics.damagelessRooms;
  tookDamageThisRoom = runMetrics.tookDamageThisRoom;
  lastStallSpawnAt = runMetrics.lastStallSpawnAt;
  enemyIdSeq = runMetrics.enemyIdSeq;
  bossClears = runMetrics.bossClears;
  player = createInitialPlayerState(cv.width, cv.height);
  _barrierPulseTimer = runtimeTimers.barrierPulseTimer;
  _slipCooldown = runtimeTimers.slipCooldown;
  _absorbComboCount = runtimeTimers.absorbComboCount;
  _absorbComboTimer = runtimeTimers.absorbComboTimer;
  _chainMagnetTimer = runtimeTimers.chainMagnetTimer;
  _echoCounter = runtimeTimers.echoCounter;
  _vampiricRestoresThisRoom = runtimeTimers.vampiricRestoresThisRoom;
  _killSustainHealedThisRoom = runtimeTimers.killSustainHealedThisRoom;
  _colossusShockwaveCd = runtimeTimers.colossusShockwaveCd;
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
  try {
    const dt=Math.min((ts-lastT)/1000,.05); lastT=ts;
    update(dt,ts); draw(ts); hudUpdate();
    raf=requestAnimationFrame(loop);
  } catch(error) {
    handleGameLoopCrash(error);
  }
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
      showGameOverScreen({
        panelEl: gameOverScreen,
        boonsPanelEl: goBoonsPanel,
        scoreEl: goScoreEl,
        noteEl: goNoteEl,
        score,
        note: `Room ${roomIndex+1} · ${kills} enemies eliminated`,
        renderBoons: renderGameOverBoons,
      });
    }
    return;
  }

  const W=cv.width,H=cv.height;
  recordRoomPeakState();
  const titanSlow = UPG.colossus ? 1 - (1 - (UPG.titanSlowMult || 1)) * 0.5 : (UPG.titanSlowMult || 1);
  const bloodRushMult = UPG.bloodRush && UPG.bloodRushTimer > ts ? 1 + ((UPG.bloodRushStacks || 0) * 0.10) : 1;
  const lateBloomMoveMods = getLateBloomMods(roomIndex || 0);
  const BASE_SPD=165*GLOBAL_SPEED_LIFT*Math.min(2.5,(UPG.speedMult || 1) * titanSlow * bloodRushMult * lateBloomMoveMods.speed);
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
  tickShieldCooldowns(player.shields, dt, UPG.shieldTempered);
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
  if(gstate === 'playing') runElapsedMs += dt * 1000;

  if(roomPhase==='intro'){
    const introStep = advanceRoomIntroPhase({
      roomPhase,
      roomIntroTimer,
      dtMs: dt * 1000,
    });
    roomPhase = introStep.roomPhase;
    roomIntroTimer = introStep.roomIntroTimer;
    if(introStep.shouldShowGo) {
      showRoomIntro('GO!', true);
    }
    if(introStep.shouldHideIntro) {
      hideRoomIntro();
    }
  }

  const pendingWaveIntroIndex = getPendingWaveIntroIndex({
    roomPhase,
    enemiesCount: enemies.length,
    spawnQueue,
    activeWaveIndex,
  });
  if(pendingWaveIntroIndex !== null) {
    beginWaveIntro(pendingWaveIntroIndex);
  }

  if(roomPhase==='spawning'){
    const spawnedWaveEntries = pullWaveSpawnEntries({
      spawnQueue,
      activeWaveIndex,
      roomTimer,
      maxOnScreen: currentRoomMaxOnScreen,
      enemiesCount: enemies.length,
    });
    spawnQueue = spawnedWaveEntries.remainingQueue;
    for(const entry of spawnedWaveEntries.spawnEntries) {
      spawnEnemy(entry.t, entry.isBoss, entry.bossScale || 1);
    }
    const postSpawningPhase = getPostSpawningPhase({
      spawnQueueLen: spawnQueue.length,
      enemiesCount: enemies.length,
    });
    if(postSpawningPhase === 'fighting') roomPhase='fighting';
    if(postSpawningPhase === 'clear'){
      roomPhase='clear';
      roomClearTimer=0;
      bullets=[]; particles=[];
      if(UPG.regenTick>0) healPlayer(UPG.regenTick, 'roomRegen');
      // Escalation: reset kill count for next room
      if(UPG.escalation) UPG.escalationKills = 0;
      // EMP Burst: reset for next room
      if(UPG.empBurst) UPG.empBurstUsed = false;
      finalizeCurrentRoomTelemetry('clear');
      applyRoomClearProgression();
      showRoomClear();
    }
  }

  if(shouldForceClearFromCombat({
    roomPhase,
    enemiesCount: enemies.length,
    spawnQueueLen: spawnQueue.length,
  })){
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
      applyRoomClearProgression();
      showRoomClear();
    }

  if(roomPhase==='fighting' || roomPhase==='spawning'){
    ensureShooterPressure();

    // Boss escort trickle respawning
    if(currentRoomIsBoss && bossAlive) {
      const escortAlive = enemies.filter(e => !e.isBoss).length;
      const escortSpawnState = updateBossEscortRespawn({
        escortAlive,
        escortMaxCount,
        escortRespawnTimer,
        dtMs: dt * 1000,
        respawnMs: getBossEscortRespawnMs(roomIndex),
      });
      escortRespawnTimer = escortSpawnState.escortRespawnTimer;
      if(escortSpawnState.shouldSpawnEscort) {
        spawnEnemy(escortType);
      }
    }

    // Reinforcement spawning for rooms 40+ (non-boss)
    const reinforceSpawnState = pullReinforcementSpawn({
      isBossRoom: currentRoomIsBoss,
      spawnQueue,
      activeWaveIndex,
      enemiesCount: enemies.length,
      maxOnScreen: currentRoomMaxOnScreen,
      reinforceTimer,
      dtMs: dt * 1000,
      intervalMs: getReinforcementIntervalMs(roomIndex),
    });
    reinforceTimer = reinforceSpawnState.reinforceTimer;
    spawnQueue = reinforceSpawnState.remainingQueue;
    if(reinforceSpawnState.spawnEntry) {
      const entry = reinforceSpawnState.spawnEntry;
      spawnEnemy(entry.t, entry.isBoss, entry.bossScale || 1);
    }
  }

  const clearStep = advanceClearPhase({
    roomPhase,
    roomClearTimer,
    dtMs: dt * 1000,
    rewardDelayMs: 1000,
  });
  roomPhase = clearStep.roomPhase;
  roomClearTimer = clearStep.roomClearTimer;
  if(clearStep.shouldShowUpgrades) {
    showUpgrades();
  }

  // 'reward' and 'between' phases are handled by showUpgrades / card click callbacks

  // ── Auto-fire: only while still, and always gated by SPS interval
  const isStill = !joy.active || joy.mag <= JOY_DEADZONE;
  recordControlTelemetry(dt, isStill);

  if(!isStill){
    stillTimer = 0;
    if(UPG.moveChargeRate > 0 && (roomPhase === 'spawning' || roomPhase === 'fighting')){
      const moveChargeRate = getKineticChargeRate(UPG, charge) * (UPG.fluxState ? 2 : 1);
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
  if(enemies.length > 1){
    resolveEnemySeparation(enemies, {
      width: W,
      height: H,
      margin: M,
      separationPadding: 2,
      maxIterations: 2,
    });
  }
  for(let ei=enemies.length-1;ei>=0;ei--){
    const e=enemies[ei];
    const combatStep = stepEnemyCombatState(e, {
      player,
      ts,
      dt,
      width: W,
      height: H,
      margin: M,
      gravityWell2: UPG.gravityWell2,
      windupMs: WINDUP_MS,
    });
    if(combatStep.kind === 'siphon'){
      if(combatStep.shouldDrainCharge){charge=Math.max(0,charge-2.8*dt);sparks(player.x,player.y,C.siphon,1,35);}
    } else if(combatStep.kind === 'rusher'){
      if(combatStep.distanceToPlayer<player.r+e.r+2 && player.invincible<=0){
        const rusherHit = resolveRusherContactHit({
          hp,
          upgrades: UPG,
          contactDamage: 18,
          contactInvulnSeconds: getPostHitInvulnSeconds('contact'),
        });
        hp = rusherHit.nextHp;
        recordPlayerDamage(rusherHit.damage, 'contact');
        player.invincible = rusherHit.invincibleSeconds;
        player.distort = rusherHit.distortSeconds;
        sparks(player.x,player.y,C.danger,10,90);
        const rusherAftermath = resolvePostHitAftermath({
          hitResult: rusherHit,
          upgrades: UPG,
          colossusShockwaveCd: _colossusShockwaveCd,
          enableShockwave: true,
          shouldTriggerLastStand: rusherHit.shouldTriggerLastStand,
          playerX: player.x,
          playerY: player.y,
          shotSpeed: 220 * GLOBAL_SPEED_LIFT,
          now: performance.now(),
          bloodPactHealCap: getBloodPactHealCap(),
        });
        if(rusherAftermath.triggerColossusShockwave){
          _colossusShockwaveCd = rusherAftermath.nextColossusShockwaveCd;
          convertNearbyDangerBulletsToGrey({
            bullets,
            originX: player.x,
            originY: player.y,
            radius: 120,
            ts,
          });
          sparks(player.x,player.y,getThreatPalette().advanced.hex,14,120);
        }
        if(rusherAftermath.shouldApplyLifelineState){
          UPG.lifelineTriggerCount = rusherAftermath.nextLifelineTriggerCount;
          UPG.lifelineUsed = rusherAftermath.nextLifelineUsed;
          sparks(player.x,player.y,C.lifelineEffect,16,100);
          if(rusherAftermath.lastStandBurstSpec){
            spawnRadialOutputBurst({ bullets, ...rusherAftermath.lastStandBurstSpec });
          }
        } else if(rusherAftermath.shouldGameOver) {
          gameOver(); return;
        }
      }
    } else {
      if(combatStep.shouldFire){
        fireEnemyBurst(e, {
          player,
          bulletSpeedScale,
          random: Math.random,
          canEnemyUsePurpleShots: (enemy) => canEnemyUsePurpleShots(enemy, roomIndex),
          spawnZoner: (idx, total) => spawnZB(e.x, e.y, idx, total),
          spawnEliteZoner: (idx, total, stage) => spawnEliteZB(e.x, e.y, idx, total, stage),
          spawnDoubleBounce: () => spawnDBB(e.x, e.y),
          spawnTriangle: () => spawnTB(e.x, e.y),
          spawnEliteTriangle: () => spawnEliteTriangleBullet(e.x, e.y),
          spawnEliteBullet: (angle, speed, stage) => spawnEliteBullet(e.x, e.y, angle, speed, stage),
          spawnEnemyBullet: () => spawnEB(e.x, e.y),
        });
      }
    }

  if(UPG.orbitSphereTier > 0){
      // Sync arrays
      syncOrbRuntimeArrays(_orbFireTimers, _orbCooldown, UPG.orbitSphereTier);
      const orbitContact = applyOrbitSphereContact(e, {
        orbCooldown: _orbCooldown,
        orbitSphereTier: UPG.orbitSphereTier,
        ts,
        getOrbitSlotPosition,
        rotationSpeed: ORBIT_ROTATION_SPD,
        radius: ORBIT_SPHERE_R,
        originX: player.x,
        originY: player.y,
        orbitalFocus: UPG.orbitalFocus,
        chargeRatio: getChargeRatio(),
        baseDamage: 2,
        focusDamageBonus: ORBITAL_FOCUS_CONTACT_BONUS,
        focusChargeScale: 1.5,
      });
      if(orbitContact.hit){
        sparks(orbitContact.slotX, orbitContact.slotY, C.green, 4, 45);
      }
      if(orbitContact.killed){
        const orbitKillEffects = resolveOrbitKillEffects({
          scorePerKill: computeKillScore(e.pts, false),
          finalForm: UPG.finalForm,
          hp,
          maxHp,
          finalFormChargeGain: 0.5,
        });
        score += orbitKillEffects.scoreDelta;
        kills += orbitKillEffects.killsDelta;
        recordKill('orbit');
        sparks(e.x,e.y,e.col,14,95);
        spawnGreyDrops(e.x,e.y,ts);
        if(orbitKillEffects.shouldGrantFinalFormCharge){
          gainCharge(orbitKillEffects.finalFormChargeGain, 'finalForm');
        }
        enemies.splice(ei,1);
        continue;
      }
    }
  }
  if(enemies.length > 1){
    resolveEnemySeparation(enemies, {
      width: W,
      height: H,
      margin: M,
      separationPadding: 2,
      maxIterations: 2,
    });
  }

  // ── Charged Orbs: each alive orb fires at nearest enemy every 1.8s
  if(UPG.chargedOrbs && UPG.orbitSphereTier>0 && enemies.length>0){
    syncOrbRuntimeArrays(_orbFireTimers, _orbCooldown, UPG.orbitSphereTier);
    for(let si=0;si<UPG.orbitSphereTier;si++){
      const orbFireInterval = CHARGED_ORB_FIRE_INTERVAL_MS * (UPG.orbitalFocus ? ORBITAL_FOCUS_CHARGED_ORB_INTERVAL_MULT : 1);
      const orbVolley = buildChargedOrbVolleyForSlot({
        slotIndex: si,
        timerMs: _orbFireTimers[si] || 0,
        dtMs: dt * 1000,
        fireIntervalMs: orbFireInterval,
        orbCooldown: _orbCooldown,
        orbitSphereTier: UPG.orbitSphereTier,
        ts,
        rotationSpeed: ORBIT_ROTATION_SPD,
        radius: ORBIT_SPHERE_R,
        originX: player.x,
        originY: player.y,
        enemies,
        getOrbitSlotPosition,
        orbTwin: UPG.orbTwin,
        orbitalFocus: UPG.orbitalFocus,
        orbOvercharge: UPG.orbOvercharge,
        orbPierce: UPG.orbPierce,
        charge,
        reservedForPlayer: getPlayerShotChargeReserve(isStill, enemies.length),
        chargeRatio: getChargeRatio(),
        twinDamageMult: ORB_TWIN_TOTAL_DAMAGE_MULT,
        focusDamageMult: ORBITAL_FOCUS_CHARGED_ORB_DAMAGE_MULT,
        focusChargeScale: 0.8,
        overchargeDamageMult: ORB_OVERCHARGE_DAMAGE_MULT,
        shotSpeed: 220 * GLOBAL_SPEED_LIFT,
        now: performance.now(),
        bloodPactHealCap: getBloodPactHealCap(),
      });
      _orbFireTimers[si] = orbVolley.nextTimerMs;
      if(!orbVolley.fired) continue;
      for(const shotSpec of orbVolley.shotSpecs){
        pushOutputBullet({
          bullets,
          ...shotSpec,
        });
      }
      charge = Math.max(0, charge - orbVolley.chargeSpent);
      recordShotSpend(orbVolley.chargeSpent);
    }
  }

  if(UPG.aegisBattery && UPG.shieldTier > 0 && enemies.length > 0){
    const readyShieldCount = getReadyShieldCount();
    const aegisStep = advanceAegisBatteryTimer({
      aegisBattery: UPG.aegisBattery,
      shieldTier: UPG.shieldTier,
      enemiesCount: enemies.length,
      readyShieldCount,
      timer: UPG.aegisBatteryTimer || 0,
      dtMs: dt * 1000,
      intervalMs: AEGIS_BATTERY_BOLT_INTERVAL_MS,
    });
    UPG.aegisBatteryTimer = aegisStep.timer;
    if(aegisStep.shouldFire){
      const boltSpec = buildAegisBatteryBoltSpec({
        shouldFire: aegisStep.shouldFire,
        enemies,
        originX: player.x,
        originY: player.y,
        damageMult: UPG.playerDamageMult || 1,
        denseDamageMult: UPG.denseDamageMult || 1,
        readyShieldCount,
        shotSpeed: 210 * GLOBAL_SPEED_LIFT,
        now: performance.now(),
      });
      if(boltSpec){
        pushOutputBullet({
          bullets,
          ...boltSpec,
        });
        sparks(player.x, player.y, C.shieldActive, 6, 70);
      }
    }
  } else if(UPG.aegisBattery) {
    UPG.aegisBatteryTimer = 0;
  }

  // ── Bullets
  const absorbR = player.r + 5 + UPG.absorbRange + (_barrierPulseTimer > 0 ? UPG.absorbRange + 40 : 0) + (_chainMagnetTimer > 0 ? UPG.absorbRange + 30 : 0);
  const decayMS = DECAY_BASE + UPG.decayBonus;

  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];
    if(!b || typeof b !== 'object'){
      bullets.splice(i,1);
      continue;
    }

    if(shouldExpireOutputBullet(b, ts)){
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
        const dangerBounce = resolveDangerBounceState(b, ts);
        if(dangerBounce.kind === 'elite-stage'){
          applyEliteBulletStage(b, dangerBounce.nextEliteStage);
          sparks(b.x, b.y, b.eliteColor, 4, 40);
        } else if(dangerBounce.kind === 'triangle-burst'){
          spawnTriangleBurst(b.x, b.y, b.vx, b.vy);
          bullets.splice(i,1);continue;
        } else if(dangerBounce.kind === 'convert-grey'){
          sparks(b.x,b.y,C.grey,4,35);
        }
      } else if(b.state==='output'){
        const outputBounce = resolveOutputBounceState(b, {
          splitShot: UPG.splitShot,
          splitShotEvolved: UPG.splitShotEvolved,
        });
        if(outputBounce.kind === 'split'){
          const splitNow=performance.now();
          spawnSplitOutputBullets({
            bullets,
            sourceBullet: b,
            splitDeltas: outputBounce.splitDeltas,
            damageFactor: outputBounce.splitDamageFactor,
            expireAt: splitNow + 2000,
            fallbackBloodPactHealCap: getBloodPactHealCap(),
          });
        } else if(outputBounce.removeBullet) {
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
            pushOutputBullet({
              bullets,
              x: b.x,
              y: b.y,
              vx: Math.cos(angle) * 140 * GLOBAL_SPEED_LIFT,
              vy: Math.sin(angle) * 140 * GLOBAL_SPEED_LIFT,
              radius: 3.2,
              bounceLeft: 0,
              pierceLeft: 0,
              homing: true,
              crit: false,
              dmg: 0.75,
              expireAt: rNow + 1600,
            });
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
        syncOrbRuntimeArrays(_orbFireTimers, _orbCooldown, UPG.orbitSphereTier);
        let absorbed=false;
        for(let si=0;si<UPG.orbitSphereTier;si++){
          if(_orbCooldown[si]>0) continue;
          const orbitSlot = getOrbitSlotPosition({
            index: si,
            orbitSphereTier: UPG.orbitSphereTier,
            ts,
            rotationSpeed: ORBIT_ROTATION_SPD,
            radius: ORBIT_SPHERE_R,
            originX: player.x,
            originY: player.y,
          });
          const sx=orbitSlot.x;
          const sy=orbitSlot.y;
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
      syncOrbRuntimeArrays(_orbFireTimers, _orbCooldown, UPG.orbitSphereTier);
      let orbHit=false;
      for(let si=0;si<UPG.orbitSphereTier;si++){
        if(_orbCooldown[si]>0) continue;
        const orbitSlot = getOrbitSlotPosition({
          index: si,
          orbitSphereTier: UPG.orbitSphereTier,
          ts,
          rotationSpeed: ORBIT_ROTATION_SPD,
          radius: ORBIT_SPHERE_R,
          originX: player.x,
          originY: player.y,
        });
        const sx=orbitSlot.x;
        const sy=orbitSlot.y;
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
          const shieldSlot = getShieldSlotPosition({
            index: si,
            shieldCount: total,
            ts,
            rotationSpeed: SHIELD_ROTATION_SPD,
            radius: SHIELD_ORBIT_R,
            originX: player.x,
            originY: player.y,
          });
          const sx=shieldSlot.x;
          const sy=shieldSlot.y;
          const shieldFacing = shieldSlot.facing;
          if(circleIntersectsShieldPlate(b.x, b.y, b.r, sx, sy, shieldFacing)){
            if(currentRoomTelemetry) currentRoomTelemetry.safety.shieldBlocks += 1;
            // Mirror Shield: reflect bullet back as output
            if(UPG.shieldMirror && (ts - (s.mirrorCooldown||0)) > 300){
              s.mirrorCooldown = ts;
              const reflectionSpec = buildMirrorShieldReflectionSpec({
                x: sx,
                y: sy,
                vx: b.vx,
                vy: b.vy,
                shotSize: UPG.shotSize,
                playerDamageMult: UPG.playerDamageMult || 1,
                denseDamageMult: UPG.denseDamageMult || 1,
                aegisTitan: UPG.aegisTitan,
                mirrorShieldDamageFactor: MIRROR_SHIELD_DAMAGE_FACTOR,
                aegisBatteryDamageMult: getAegisBatteryDamageMult(),
                now: performance.now(),
                playerShotLifeMs: PLAYER_SHOT_LIFE_MS,
                shotLifeMult: UPG.shotLifeMult || 1,
              });
              pushOutputBullet({ bullets, ...reflectionSpec });
            }
            // Tempered Shield: two-stage (purple -> blue -> pop)
            if(UPG.shieldTempered && s.hardened){
              s.hardened=false;
              sparks(sx,sy,C.shieldEnhanced,8,60);
              bullets.splice(i,1); shieldHit=true; break;
            }
            // Shield pops — Shield Burst fires 4/8-way output
            if(UPG.shieldBurst){
              const shieldBurstSpec = buildShieldBurstSpec({
                x: player.x,
                y: player.y,
                aegisTitan: UPG.aegisTitan,
                globalSpeedLift: GLOBAL_SPEED_LIFT,
                shotSize: UPG.shotSize,
                playerDamageMult: UPG.playerDamageMult || 1,
                denseDamageMult: UPG.denseDamageMult || 1,
                aegisNovaDamageFactor: AEGIS_NOVA_DAMAGE_FACTOR,
                aegisBatteryDamageMult: getAegisBatteryDamageMult(),
                now: performance.now(),
                playerShotLifeMs: PLAYER_SHOT_LIFE_MS,
                shotLifeMult: UPG.shotLifeMult || 1,
              });
              spawnRadialOutputBurst({ bullets, ...shieldBurstSpec });
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
      const dangerHit = resolveDangerPlayerHit({
        bullet: b,
        player,
        upgrades: UPG,
        ts,
        hp,
        maxHp,
        phaseDamage: getProjectileHitDamage(PHASE_DASH_DAMAGE_MULT),
        directDamage: getProjectileHitDamage(),
        projectileInvulnSeconds: getPostHitInvulnSeconds('projectile'),
      });

      if(dangerHit.kind === 'void-block'){
        bullets.splice(i,1);
        sparks(b.x,b.y,'#8b5cf6',8,120);
        continue;
      }

      if(dangerHit.kind === 'phase-dash'){
        if(currentRoomTelemetry) currentRoomTelemetry.safety.phaseDashProcs += 1;
        UPG.phaseDashRoomUses = dangerHit.nextPhaseDashRoomUses;
        UPG.phaseDashCooldown = dangerHit.nextPhaseDashCooldown;
        UPG.isDashing = true;
        player.invincible = dangerHit.invincibleSeconds;
        const awayAng = dangerHit.awayAngle;
        player.x += Math.cos(awayAng) * dangerHit.dashDistance;
        player.y += Math.sin(awayAng) * dangerHit.dashDistance;
        player.x = Math.max(M + player.r, Math.min(W - M - player.r, player.x));
        player.y = Math.max(M + player.r, Math.min(H - M - player.r, player.y));
        sparks(player.x, player.y, getThreatPalette().advanced.hex, 16, 200);
        hp = dangerHit.nextHp;
        recordPlayerDamage(dangerHit.damage, 'projectile');
        player.distort = dangerHit.distortSeconds;
        tookDamageThisRoom = true;
        if(dangerHit.shouldGainHitCharge) gainCharge(UPG.hitChargeGain, 'hitReward');
        UPG.voidZoneActive = dangerHit.nextVoidZoneActive;
        UPG.voidZoneTimer = dangerHit.nextVoidZoneTimer;
        bullets.splice(i, 1);
        const phaseDashAftermath = resolvePostHitAftermath({
          hitResult: dangerHit,
          upgrades: UPG,
        });
        if(phaseDashAftermath.shouldApplyLifelineState){
          UPG.lifelineTriggerCount = phaseDashAftermath.nextLifelineTriggerCount;
          UPG.lifelineUsed = phaseDashAftermath.nextLifelineUsed;
          sparks(player.x,player.y,C.lifelineEffect,16,100);
        } else if(phaseDashAftermath.shouldGameOver) {
          gameOver(); return;
        }
        continue;
      }

      if(dangerHit.kind === 'mirror-tide'){
        if(currentRoomTelemetry) currentRoomTelemetry.safety.mirrorTideProcs += 1;
        UPG.mirrorTideRoomUses = dangerHit.nextMirrorTideRoomUses;
        UPG.mirrorTideCooldown = dangerHit.nextMirrorTideCooldown;
        const mNow = performance.now();
        pushOutputBullet({
          bullets,
          x: player.x,
          y: player.y,
          vx: Math.cos(dangerHit.reflectAngle) * 200 * GLOBAL_SPEED_LIFT,
          vy: Math.sin(dangerHit.reflectAngle) * 200 * GLOBAL_SPEED_LIFT,
          radius: b.r,
          bounceLeft: 0,
          pierceLeft: 0,
          homing: false,
          crit: false,
          dmg: (UPG.playerDamageMult || 1) * (UPG.denseDamageMult || 1),
          expireAt: mNow + 2000,
        });
        sparks(player.x, player.y, getThreatPalette().elite.hex, 12, 150);
        bullets.splice(i, 1);
        continue;
      }

      if(dangerHit.kind === 'direct-hit'){
        hp = dangerHit.nextHp;
        recordPlayerDamage(dangerHit.damage, 'projectile');
        player.invincible = dangerHit.invincibleSeconds;
        player.distort = dangerHit.distortSeconds;
        tookDamageThisRoom = true;
        if(dangerHit.shouldGainHitCharge) gainCharge(UPG.hitChargeGain, 'hitReward');
        if(dangerHit.shouldEmpBurst){
          UPG.empBurstUsed = dangerHit.nextEmpBurstUsed;
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
        const directHitAftermath = resolvePostHitAftermath({
          hitResult: dangerHit,
          upgrades: UPG,
          colossusShockwaveCd: _colossusShockwaveCd,
          enableShockwave: true,
          shouldTriggerLastStand: Boolean(UPG.lastStand && dangerHit.lifelineTriggered),
          playerX: player.x,
          playerY: player.y,
          shotSpeed: 220 * GLOBAL_SPEED_LIFT,
          now: performance.now(),
          bloodPactHealCap: getBloodPactHealCap(),
        });
        if(directHitAftermath.triggerColossusShockwave){
          _colossusShockwaveCd = directHitAftermath.nextColossusShockwaveCd;
          convertNearbyDangerBulletsToGrey({
            bullets,
            originX: player.x,
            originY: player.y,
            radius: 120,
            ts,
          });
          sparks(player.x,player.y,getThreatPalette().advanced.hex,14,120);
        }
        if(directHitAftermath.shouldApplyLifelineState){
          UPG.lifelineTriggerCount = directHitAftermath.nextLifelineTriggerCount;
          UPG.lifelineUsed = directHitAftermath.nextLifelineUsed;
          sparks(player.x,player.y,C.lifelineEffect,16,100);
          if(directHitAftermath.lastStandBurstSpec){
            spawnRadialOutputBurst({ bullets, ...directHitAftermath.lastStandBurstSpec });
          }
        } else if(directHitAftermath.shouldGameOver) {
          gameOver(); return;
        }
        continue;
      }

      const slipstream = resolveSlipstreamNearMiss({
        bullet: b,
        player,
        upgrades: UPG,
        slipCooldown: _slipCooldown,
      });
      if(slipstream.shouldTrigger){
        gainCharge(slipstream.chargeGain, 'slipstream');
        _slipCooldown = slipstream.nextSlipCooldown;
      }
    }

    if(b.state==='output'){
      let removeBullet=false;
      for(let j=enemies.length-1;j>=0;j--){
        const e=enemies[j];
        if(b.hitIds.has(e.eid)) continue;
        if(Math.hypot(b.x-e.x,b.y-e.y)<b.r+e.r){
          b.hitIds.add(e.eid);
          const hitResolution = resolveOutputEnemyHit({
            bullet: b,
            enemyHp: e.hp,
            hp,
            maxHp,
            upgrades: UPG,
            critDamageFactor: CRIT_DAMAGE_FACTOR,
            bloodPactBaseHealCap: BLOOD_PACT_BASE_HEAL_CAP_PER_BULLET,
          });
          e.hp = hitResolution.enemyHpAfterHit;
          sparks(b.x,b.y,b.crit?C.ghost:C.green,b.crit?8:5,b.crit?70:55);
          // Blood Pact: piercing shots restore 1 HP per enemy hit
          if(hitResolution.shouldBloodPactHeal){
            applyKillSustainHeal(1, 'bloodPact');
            b.bloodPactHeals = hitResolution.nextBloodPactHeals;
          }
          if(e.hp<=0){
            score += computeKillScore(e.pts, b.crit);
            kills++;
            recordKill('output');
            sparks(e.x,e.y,e.col, e.isBoss ? 30 : 14, e.isBoss ? 160 : 95);
            // Death bullets scatter as grey
            spawnGreyDrops(e.x,e.y,ts);
            const killEffects = resolveEnemyKillEffects({
              enemy: e,
              bullet: b,
              upgrades: UPG,
              hp,
              maxHp,
              ts,
              vampiricHealPerKill: VAMPIRIC_HEAL_PER_KILL,
              vampiricChargePerKill: VAMPIRIC_CHARGE_PER_KILL,
            });
            applyKillUpgradeState(UPG, killEffects.nextUpgradeState);
            const killRewardActions = buildKillRewardActions({
              killEffects,
              enemyX: e.x,
              enemyY: e.y,
              playerX: player.x,
              playerY: player.y,
              ts,
              upgrades: UPG,
              globalSpeedLift: GLOBAL_SPEED_LIFT,
              bloodPactHealCap: getBloodPactHealCap(),
              random: Math.random,
            });
            for(const action of killRewardActions){
              if(action.type === 'bossClear'){
                bossAlive = false;
                bossClears += 1;
                healPlayer(action.healAmount, 'bossReward');
                showBossDefeated();
                continue;
              }
              if(action.type === 'sustainHeal'){
                applyKillSustainHeal(action.amount, action.source);
                continue;
              }
              if(action.type === 'gainCharge'){
                gainCharge(action.amount, action.source);
                continue;
              }
              if(action.type === 'spawnGreyBullet'){
                pushGreyBullet({
                  bullets,
                  x: action.x,
                  y: action.y,
                  vx: action.vx,
                  vy: action.vy,
                  radius: action.radius,
                  decayStart: action.decayStart,
                });
                continue;
              }
              if(action.type === 'spawnSanguineBurst'){
                spawnRadialOutputBurst({
                  bullets,
                  x: action.x,
                  y: action.y,
                  count: action.count,
                  speed: action.speed,
                  radius: action.radius,
                  bounceLeft: action.bounceLeft,
                  pierceLeft: action.pierceLeft,
                  homing: action.homing,
                  crit: action.crit,
                  dmg: action.dmg,
                  expireAt: action.expireAt,
                  extras: action.extras,
                });
              }
            }
            enemies.splice(j,1);
          }
          if(hitResolution.piercesAfterHit){
            b.pierceLeft = hitResolution.nextPierceLeft;
            if(hitResolution.shouldTriggerVolatile){
              const vNow=performance.now();
              spawnRadialOutputBurst({
                bullets,
                x: b.x,
                y: b.y,
                count: 4,
                speed: 180 * GLOBAL_SPEED_LIFT,
                radius: b.r * 0.75,
                bounceLeft: 0,
                pierceLeft: 0,
                homing: false,
                crit: false,
                dmg: b.dmg * 0.65,
                expireAt: vNow + 1600,
              });
              sparks(b.x,b.y,C.green,6,60);
            }
          } else { removeBullet=true; break; }
        }
      }
      if(removeBullet){bullets.splice(i,1);continue;}
      if(shouldRemoveBulletOutOfBounds(b, W, H)){bullets.splice(i,1);continue;}
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
  showRoomClearOverlay({
    panelEl: roomClearEl,
    textEl: roomClearTextEl,
  });
}

function showBossDefeated() {
  showBossDefeatedOverlay({
    panelEl: roomClearEl,
    textEl: roomClearTextEl,
  });
}

function showRoomIntro(text, isGo) {
  showRoomIntroOverlay({
    panelEl: roomIntroEl,
    textEl: roomIntroTextEl,
    text,
    isGo,
  });
}

function hideRoomIntro() {
  hideRoomIntroOverlay({ panelEl: roomIntroEl });
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

  // Output and neutral bullets sit below entities.
  for(const b of bullets){
    if(b.state==='danger') continue;
    drawBulletSprite(b, ts);
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

  // Enemy projectiles stay visually above the ghost and orbit visuals.
  for(const b of bullets){
    if(b.state!=='danger') continue;
    drawBulletSprite(b, ts);
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
  renderHud({
    roomIndex,
    runElapsedMs,
    score,
    charge,
    maxCharge: UPG.maxCharge,
    sps: UPG.sps,
    elements: {
      roomCounter: roomCounterEl,
      scoreText: scoreTextEl,
      chargeFill: chargeFillEl,
      chargeBadge: chargeBadgeEl,
      spsNumber: spsNumberEl,
    },
  });
}

bindJoystickControls({
  canvas: cv,
  joy,
  getGameState: () => gstate,
});

renderPatchNotes();
function openLeaderboardScreen() {
  lbScreen.classList.remove('off');
  refreshLeaderboardView();
}

bindPatchNotesControls({
  button: patchNotesBtn,
  closeButton: patchNotesCloseBtn,
  panelEl: patchNotesPanel,
  onOpenChange: setPatchNotesOpen,
  doc: document,
});

bindPatchNotesControls({
  button: versionOpenBtn,
  closeButton: versionCloseBtn,
  panelEl: versionPanel,
  onOpenChange: setVersionPanelOpen,
  doc: document,
});
versionRefreshBtn?.addEventListener('click', () => {
  refreshVersionStatus();
});
versionUpdateBtn?.addEventListener('click', () => {
  const url = new URL(window.location.href);
  url.searchParams.set('build', latestAvailableVersion || VERSION.num);
  url.searchParams.set('ts', String(Date.now()));
  window.location.replace(url.toString());
});
try {
  const flaggedVersion = sessionStorage.getItem(UPDATE_AVAILABLE_KEY);
  if(flaggedVersion && flaggedVersion !== VERSION.num) {
    setVersionPanelOpen(true);
  }
} catch {}

bindLeaderboardControls({
  openButtons: [lbOpenBtn, lbOpenBtnGo],
  closeButton: lbCloseBtn,
  periodButtons: [...lbPeriodBtns],
  scopeButtons: [...lbScopeBtns],
  onOpen: openLeaderboardScreen,
  onClose: () => lbScreen.classList.add('off'),
  onPeriodChange: (period) => {
    lbPeriod = period;
    refreshLeaderboardView();
  },
  onScopeChange: (scope) => {
    lbScope = scope;
    refreshLeaderboardView();
  },
});

function setPlayerName(v, { syncInputs = false } = {}){
  playerName = setPlayerNameState({
    value: v,
    sanitizePlayerName,
    persistName: (sanitized) => writeText(NAME_KEY, sanitized),
    inputs: [nameInputStart, nameInputGo],
    syncInputs,
    onNameChange: () => refreshLeaderboardView(),
  });
}

bindNameInputs({
  inputs: [nameInputStart, nameInputGo],
  setPlayerName,
});

// Initialize color picker on start screen
renderColorSelector('color-picker');
syncColorDrivenCopy();

bindSessionFlow({
  startButton: document.getElementById('btn-start'),
  restartButton: document.getElementById('btn-restart'),
  mainMenuButton: mainMenuBtn,
  startInput: nameInputStart,
  gameOverInput: nameInputGo,
  setPlayerName,
  setMenuChromeVisible,
  startScreen,
  gameOverScreen,
  boonsPanelEl: goBoonsPanel,
  leaderboardScreen: lbScreen,
  initRun: init,
  beginLoop: () => {
    lastT = performance.now();
    raf = requestAnimationFrame(loop);
  },
  setGameState: (nextState) => {
    gstate = nextState;
  },
});

bindBoonsPanelControls({
  toggleButton: goBoonsBtn,
  panelEl: goBoonsPanel,
  closeButton: goBoonsCloseBtn,
});

const lbBoonsPopup = document.getElementById('lb-boons-popup');
const lbBoonsPopupTitle = document.getElementById('lb-boons-popup-title');
const lbBoonsPopupList = document.getElementById('lb-boons-popup-list');
bindPopupClose({
  closeButton: document.getElementById('btn-lb-boons-close'),
  panelEl: lbBoonsPopup,
});

function showLbBoonsPopup(runnerName, boons, boonOrder = '') {
  showLeaderboardBoonsPopup({
    popup: lbBoonsPopup,
    titleEl: lbBoonsPopupTitle,
    listEl: lbBoonsPopupList,
    runnerName,
    boons,
    boonOrder,
  });
}


loadLeaderboard();
clearLegacyRunRecovery();
forceLocalLeaderboardFallback(lbSync, 'LOCAL FALLBACK');
syncLeaderboardStatusBadgeView(lbStatus, lbSync.statusMode, lbSync.statusText);
setPlayerName(loadSavedPlayerName(), { syncInputs: true });
renderLeaderboard();
revealAppShell();

draw(0);
