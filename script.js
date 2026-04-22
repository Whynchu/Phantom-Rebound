import { C, ROOM_SCRIPTS, BOSS_ROOMS, DECAY_BASE, M, VERSION } from './src/data/gameData.js';
import { CHARGED_ORB_FIRE_INTERVAL_MS, ESCALATION_KILL_PCT, ESCALATION_MAX_BONUS, getActiveBoonEntries, getDefaultUpgrades, getRequiredShotCount, getKineticChargeRate, getPayloadBlastRadius, syncChargeCapacity, getEvolvedBoon, checkLegendarySequences, getLateBloomGrowth, LATE_BLOOM_SPEED_PENALTY, LATE_BLOOM_DAMAGE_TAKEN_PENALTY, LATE_BLOOM_DAMAGE_PENALTY } from './src/data/boons.js';
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
import { PLAYER_COLORS, getPlayerColor, getPlayerColorScheme, getThreatPalette, setPlayerColor, getColorAssistMode, getColorAssistOptions, setColorAssistMode, getColorSchemeForKey } from './src/data/colorScheme.js';
import { renderColorSelector } from './src/ui/colorSelector.js';
import { formatRunTime, renderHud } from './src/ui/hud.js';
import {
  renderLeaderboard as renderLeaderboardView,
  syncLeaderboardStatusBadge as syncLeaderboardStatusBadgeView,
} from './src/ui/leaderboard.js';
import { renderGameOverBoonsList, showLeaderboardBoonsPopup } from './src/ui/boonsPanel.js';
import { iconHTML } from './src/ui/iconRenderer.js';
import { renderPatchNotesPanel } from './src/ui/patchNotes.js';
import { createPanelManager } from './src/ui/panelManager.js';
import { showGameOverScreen } from './src/ui/gameOver.js';
import { bullets, enemies, shockwaves, spawnQueue, scoreBreakdown, resetScoreBreakdown } from './src/core/gameState.js';
import { runBoonHook } from './src/systems/boonHooks.js';
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
import { HAT_OPTIONS, getHatHeightMultiplier } from './src/data/hats.js';
import { drawGhostHatLayer } from './src/ui/drawing/hatRenderer.js';
import { drawGhostSprite } from './src/ui/drawing/ghostRenderer.js';
import {
  drawGooBall as drawGooBallImpl,
  drawBounceRings as drawBounceRingsImpl,
  drawBulletSprite as drawBulletSpriteImpl,
  getDangerBounceRingCount,
  getEnemyBounceRingCount,
  getBounceRingMetrics,
} from './src/ui/drawing/bulletRenderer.js';
import {
  STORAGE_KEYS,
  MAX_PARTICLES,
  MAX_BULLETS,
  MAX_DMG_NUMBERS,
  SHIELD_HALF_W,
  SHIELD_HALF_H,
  WINDUP_MS_DRAW,
} from './src/data/constants.js';
import {
  particles,
  clearParticles,
  spawnSparks,
  spawnBlueDissipateBurst,
  spawnPayloadExplosion,
} from './src/systems/particles.js';
import {
  dmgNumbers,
  clearDmgNumbers,
  spawnDmgNumber,
} from './src/systems/damageNumbers.js';
import {
  revealAppShell as revealAppShellView,
  syncColorDrivenCopy as syncColorDrivenCopyView,
  setMenuChromeVisible as setMenuChromeVisibleView,
} from './src/ui/shell.js';
import {
  getKillSustainCapForRoom as getKillSustainCapForRoomValue,
  applyKillSustainHeal as applyKillSustainHealValue,
} from './src/systems/sustain.js';
import { computeKillScore, computeRoomClearBonuses, computeFiveRoomCheckpointBonus } from './src/systems/scoring.js';
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

const PLAYER_COLOR_KEY = STORAGE_KEYS.playerColor;
const COLOR_ASSIST_KEY = STORAGE_KEYS.colorAssist;
const PLAYER_HAT_KEY = STORAGE_KEYS.playerHat;
const storedColorAssist = readText(COLOR_ASSIST_KEY, 'off');
setColorAssistMode(storedColorAssist);
const storedPlayerColor = readText(PLAYER_COLOR_KEY, 'green');
setPlayerColor(PLAYER_COLORS[storedPlayerColor] ? storedPlayerColor : 'green');
let playerHat = HAT_OPTIONS.some((option) => option.key === readText(PLAYER_HAT_KEY, 'none'))
  ? readText(PLAYER_HAT_KEY, 'none')
  : 'none';
renderVersionTag(VERSION);

bindGestureGuards({ doc: document });
let startDangerCopy;

function revealAppShell() {
  revealAppShellView({ doc: document, raf: requestAnimationFrame });
}

function syncColorDrivenCopy() {
  syncColorDrivenCopyView(startDangerCopy, getThreatPalette().dangerKey);
}

function refreshThemeBoundUi() {
  renderColorSelector('color-picker');
  syncColorDrivenCopy();
  renderSettingsPanel();
  renderHatsPanel();
  drawStartGhostPreview(performance.now());
  renderLeaderboard();
}

function getSelectedHatOption() {
  return HAT_OPTIONS.find((option) => option.key === playerHat) || HAT_OPTIONS[0];
}

function setPlayerHat(nextHat) {
  if(!HAT_OPTIONS.some((option) => option.key === nextHat)) return;
  playerHat = nextHat;
  writeText(PLAYER_HAT_KEY, playerHat);
  refreshThemeBoundUi();
}

window.addEventListener('phantom:player-color-change', (event) => {
  const colorKey = event.detail?.key || getPlayerColor();
  writeText(PLAYER_COLOR_KEY, colorKey);
  refreshThemeBoundUi();
});

window.addEventListener('phantom:color-assist-change', (event) => {
  writeText(COLOR_ASSIST_KEY, event.detail?.assistMode || getColorAssistMode());
  refreshThemeBoundUi();
});

const cv  = document.getElementById('cv');
const ctx = cv.getContext('2d');
const LB_KEY = STORAGE_KEYS.leaderboard;
const NAME_KEY = STORAGE_KEYS.runnerName;
const LEGACY_RUN_RECOVERY_KEY = STORAGE_KEYS.legacyRunRecovery;

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
const settingsOpenBtn = document.getElementById('btn-settings-open');
const settingsPanel = document.getElementById('settings-panel');
const hatsOpenBtn = document.getElementById('btn-hats-open');
const hatsPanel = document.getElementById('hats-panel');
const patchNotesCurrent = document.getElementById('patch-notes-current');
const patchNotesList = document.getElementById('patch-notes-list');
const patchNotesArchiveNote = document.getElementById('patch-notes-archive-note');
const patchNotesCloseBtn = document.getElementById('btn-patch-notes-close');
const contributorsOpenBtn = document.getElementById('btn-contributors-open');
const contributorsPanel = document.getElementById('contributors-panel');
const contributorsCloseBtn = document.getElementById('btn-contributors-close');
const settingsCloseBtn = document.getElementById('btn-settings-close');
const hatsCloseBtn = document.getElementById('btn-hats-close');
const settingsColorAssistButtons = document.getElementById('settings-color-assist-buttons');
const settingsPreviewCopy = document.getElementById('settings-preview-copy');
const settingsPreviewGrid = document.getElementById('settings-preview-grid');
const hatsGrid = document.getElementById('hats-grid');
const startGhostPreview = document.getElementById('start-ghost-preview');
const startGhostPreviewCtx = startGhostPreview ? startGhostPreview.getContext('2d') : null;
const versionCurrentEl = document.getElementById('version-current');
const versionLatestEl = document.getElementById('version-latest');
const versionStatusEl = document.getElementById('version-status');
const versionCheckedAtEl = document.getElementById('version-checked-at');
const versionRefreshBtn = document.getElementById('btn-version-refresh');
const versionCloseBtn = document.getElementById('btn-version-close');
const versionUpdateBtn = document.getElementById('btn-version-update');
const UPDATE_AVAILABLE_KEY = STORAGE_KEYS.updateAvailable;
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
const goBreakdownEl = document.getElementById('go-breakdown');
const mainMenuBtn = document.getElementById('btn-main-menu');
const wrap = document.getElementById('wrap');
const topHud = document.getElementById('top-hud');
const botHud = document.getElementById('bot-hud');
const legend = document.getElementById('legend');
const roomCounterEl = document.getElementById('room-label');
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

let _patchNotesDataPromise = null;
function loadPatchNotesData() {
  if(!_patchNotesDataPromise) {
    _patchNotesDataPromise = import('./src/data/patchNotes.js').catch(err => {
      _patchNotesDataPromise = null; // allow retry on failure
      throw err;
    });
  }
  return _patchNotesDataPromise;
}

let _patchNotesRendered = false;
async function renderPatchNotes() {
  try {
    const { PATCH_NOTES, PATCH_NOTES_ARCHIVE_MESSAGE } = await loadPatchNotesData();
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
    _patchNotesRendered = true;
  } catch(err) {
    console.warn('Failed to load patch notes:', err);
    if(patchNotesList) patchNotesList.textContent = 'Failed to load patch notes. Please refresh.';
  }
}

function buildResolvedPlayerColorMap() {
  return Object.fromEntries(Object.keys(PLAYER_COLORS).map((key) => [key, getColorSchemeForKey(key)]));
}

function renderSettingsPanel() {
  if(!settingsColorAssistButtons || !settingsPreviewGrid || !settingsPreviewCopy) return;
  const activeMode = getColorAssistMode();
  const assistOptions = getColorAssistOptions();
  settingsColorAssistButtons.innerHTML = '';
  for(const option of assistOptions) {
    const button = document.createElement('button');
    button.className = `btn lb-toggle settings-mode-btn${option.key === activeMode ? ' active' : ''}`;
    button.type = 'button';
    button.textContent = option.shortLabel;
    button.title = option.description;
    button.setAttribute('aria-pressed', option.key === activeMode ? 'true' : 'false');
    button.addEventListener('click', () => setColorAssistMode(option.key));
    settingsColorAssistButtons.appendChild(button);
  }

  const playerScheme = getPlayerColorScheme();
  const threat = getThreatPalette();
  const activeLabel = assistOptions.find((option) => option.key === activeMode)?.name || 'Off';
  settingsPreviewCopy.textContent = activeMode === 'off'
    ? `Previewing the default palette for ${playerScheme.name}.`
    : `${activeLabel} is active. Previewing the adjusted live palette for ${playerScheme.name}.`;

  const previewEntries = [
    { label: 'Player', note: 'Your ghost and UI accent', color: playerScheme.hex, glow: playerScheme.light, kind: 'player' },
    { label: 'Buster', note: 'Base ranged threat', color: threat.danger.hex, glow: threat.danger.light, kind: 'enemy' },
    { label: 'Chaser', note: 'Aggressive melee lane', color: threat.aggressive.hex, glow: threat.aggressive.light, kind: 'aggressive' },
    { label: 'Phase Buster', note: 'Advanced wall-shot lane', color: threat.advanced.hex, glow: threat.advanced.light, kind: 'phase' },
    { label: 'Omega', note: 'Elite late-room threat', color: threat.elite.hex, glow: threat.elite.light, kind: 'elite' },
    { label: 'Danger Shot', note: 'Hostile bullet color', color: threat.danger.hex, glow: threat.danger.light, kind: 'bullet' },
    { label: 'Harvest Shot', note: 'Recovered bullet state', color: C.grey, glow: C.grey, kind: 'harvest-bullet' },
  ];

  settingsPreviewGrid.innerHTML = '';
  for(const entry of previewEntries) {
    const card = document.createElement('div');
    card.className = 'settings-preview-card';

    const swatch = document.createElement('div');
    swatch.className = `settings-preview-swatch ${entry.kind}`;
    swatch.style.background = (entry.kind === 'phase' || entry.kind === 'elite') ? 'transparent' : entry.color;
    swatch.style.boxShadow = `0 0 18px ${entry.glow}66`;
    swatch.style.color = entry.color;

    const body = document.createElement('div');
    body.className = 'settings-preview-body';
    body.style.background = entry.color;
    swatch.appendChild(body);

    const core = document.createElement('div');
    core.className = 'settings-preview-core';
    swatch.appendChild(core);

    if(entry.kind === 'phase' || entry.kind === 'elite') {
      const ringCount = entry.kind === 'elite' ? 2 : 1;
      for(let i = 0; i < ringCount; i++) {
        const ring = document.createElement('div');
        ring.className = `settings-preview-ring ring-${i + 1}`;
        swatch.appendChild(ring);
      }
    }

    const meta = document.createElement('div');
    meta.className = 'settings-preview-meta';

    const label = document.createElement('div');
    label.className = 'settings-preview-label';
    label.textContent = entry.label;

    const note = document.createElement('div');
    note.className = 'settings-preview-note';
    note.textContent = entry.note;

    meta.appendChild(label);
    meta.appendChild(note);
    card.appendChild(swatch);
    card.appendChild(meta);
    settingsPreviewGrid.appendChild(card);
  }
}

function renderHatsPanel() {
  if(!hatsGrid) return;
  hatsGrid.innerHTML = '';
  const activeHat = getSelectedHatOption().key;
  for(const hat of HAT_OPTIONS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `hat-card btn-secondary${hat.key === activeHat ? ' active' : ''}`;
    button.setAttribute('aria-pressed', hat.key === activeHat ? 'true' : 'false');

    const preview = document.createElement('canvas');
    preview.className = 'hat-card-preview';
    preview.width = 52;
    preview.height = 52;

    const body = document.createElement('div');
    body.className = 'hat-card-body';

    const name = document.createElement('div');
    name.className = 'hat-card-name';
    name.textContent = hat.name;

    const tag = document.createElement('div');
    tag.className = 'hat-card-tag';
    tag.textContent = hat.tag;

    const copy = document.createElement('div');
    copy.className = 'hat-card-copy';
    copy.textContent = hat.description;

    body.appendChild(name);
    body.appendChild(tag);
    body.appendChild(copy);
    button.appendChild(preview);
    button.appendChild(body);
    button.addEventListener('click', () => setPlayerHat(hat.key));
    hatsGrid.appendChild(button);
    drawHatOptionPreview(preview, hat.key);
  }
}

const panelManager = createPanelManager({
  panels: {
    patchNotes: {
      el: patchNotesPanel,
      renderOnOpen: () => { if(!_patchNotesRendered) renderPatchNotes(); },
      beforeOpen: () => { pauseBoonsPanel?.classList.add('off'); },
      beforeClose: () => { if(gstate === 'paused') pausePanel?.classList.remove('off'); },
    },
    version: {
      el: versionPanel,
      afterOpen: () => { refreshVersionStatus(); },
    },
    settings: {
      el: settingsPanel,
      renderOnOpen: () => { renderSettingsPanel(); },
    },
    hats: {
      el: hatsPanel,
      renderOnOpen: () => { renderHatsPanel(); },
    },
    contributors: {
      el: contributorsPanel,
    },
  },
});

function setPatchNotesOpen(isOpen) { panelManager.setOpen('patchNotes', isOpen); }
function setVersionPanelOpen(isOpen) { panelManager.setOpen('version', isOpen); }
function setSettingsPanelOpen(isOpen) { panelManager.setOpen('settings', isOpen); }
function setHatsPanelOpen(isOpen) { panelManager.setOpen('hats', isOpen); }
function setContributorsPanelOpen(isOpen) { panelManager.setOpen('contributors', isOpen); }

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
let pauseStartedAt = 0;
let player = {};
let score=0, kills=0;
function awardKillPoints(pts) {
  const base = Number(pts) || 0;
  if (!base) return 0;
  score += base;
  scoreBreakdown.kills += base;
  return base;
}
function awardOverkillFromEnemy(e) {
  if (!e) return 0;
  const overkillHp = Math.max(0, -(Number(e.hp) || 0));
  if (overkillHp <= 0) return 0;
  const cap = Math.max(1, (Number(e.maxHp) || 1) * 0.5);
  const eff = Math.min(overkillHp, cap);
  const pts = Math.round(eff * 0.25);
  if (!pts) return 0;
  score += pts;
  scoreBreakdown.overkill += pts;
  if (currentRoomTelemetry) currentRoomTelemetry.overkillDamage = (currentRoomTelemetry.overkillDamage || 0) + eff;
  return pts;
}
function awardScore(amount, category) {
  const n = Number(amount) || 0;
  if (!n) return 0;
  score += n;
  if (category && scoreBreakdown[category] != null) scoreBreakdown[category] += n;
  return n;
}
let charge=0, fireT=0, stillTimer=0, prevStill=false;
let hp=BASE_PLAYER_HP, maxHp=BASE_PLAYER_HP;
let playerAimAngle = -Math.PI * 0.5;
let playerAimHasTarget = false;
const joy = createJoystickState();
const GAME_OVER_ANIM_MS = 850;

const STALL_SPAWN_COOLDOWN_MS = 2600;
const SHIELD_ORBIT_R    = 35;   // orbital radius of shield orbs from player center (px)
const SHIELD_COOLDOWN   = 4.5;  // seconds a shield is inactive after absorbing a bullet (baseline; reduced by Swift Ward)
const SHIELD_ROTATION_SPD  = 0.001; // radians per millisecond (≈1 rev / 6.3 s)
const ORBIT_SPHERE_R    = 40;   // orbital radius of passive orbit spheres (px)
const ORBIT_ROTATION_SPD   = 0.003; // radians per millisecond (≈1 rev / 2.1 s)
function getOrbitRadius() { return ORBIT_SPHERE_R + (UPG.orbitRadiusBonus || 0); }
function getOrbVisualRadius() { return 5 * (UPG.orbSizeMult || 1); }
const GRID_SIZE = 28;
const WALL_CUBE_SIZE = GRID_SIZE;
const TARGET_LOS_SOFT_PENALTY_PX = 30;
const AIM_ARROW_OFFSET = 15;
const AIM_TRI_SIDE = 8;
const PHASE_WALK_MAX_OVERLAP_MS = 1000;
const PHASE_WALK_IDLE_EJECT_MS = 120;
const PLAYER_SHOT_LIFE_MS = 1100;
const DENSE_DESPERATION_BONUS = 2.4;
const CRIT_DAMAGE_FACTOR = 2.4;
const MIRROR_SHIELD_DAMAGE_FACTOR = 0.60;
const AEGIS_NOVA_DAMAGE_FACTOR = 0.55;
const VOLATILE_ORB_COOLDOWN = 8;
const VOLATILE_ORB_SHARED_COOLDOWN = 1.0;
const PHASE_DASH_DAMAGE_MULT = 0.25;
const GLOBAL_SPEED_LIFT = 1.55;
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
let startGhostPreviewRaf = 0;
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
let legendaryRejectedIds = new Set(); // Track rejected legendary boons
let legendaryRoomsSinceRejection = new Map(); // Track rooms since rejection for cooldown

// Room system
let roomIndex = 0;
let roomPhase = 'intro';
let roomTimer = 0;
let runElapsedMs = 0;
let activeWaveIndex = 0;
let roomClearTimer = 0;
let roomPurpleShooterAssigned = false;
let roomIntroTimer = 0;
let roomObstacles = [];
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
  awardScore(computeFiveRoomCheckpointBonus(runTelemetry.rooms), 'streak');
}

function awardRoomClearBonuses(room) {
  const bonuses = computeRoomClearBonuses(room, { maxHp });
  awardScore(bonuses.clear, 'roomClear');
  awardScore(bonuses.pace, 'pace');
  awardScore(bonuses.efficiency, 'efficiency');
  awardScore(bonuses.flawless, 'flawless');
  awardScore(bonuses.boss, 'boss');
  awardScore(bonuses.density, 'density');
  awardScore(bonuses.clutch, 'clutch');
  awardScore(bonuses.accuracy, 'accuracy');
  awardScore(bonuses.dodge, 'dodge');
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
    sps: roundTelemetryValue((UPG.sps || 0) * (UPG.heavyRoundsFireMult || 1)),
    maxCharge: roundTelemetryValue(UPG.maxCharge || 0),
    currentCharge: roundTelemetryValue(charge || 0),
    requiredShotCount: getRequiredShotCount(UPG),
    damageMult: roundTelemetryValue((UPG.playerDamageMult || 1) * (UPG.denseDamageMult || 1) * (UPG.heavyRoundsDamageMult || 1) * Math.min(1.45, 1 + Math.min(UPG.sustainedFireShots || 0, 15) * 0.03) * Math.max(0.5, 1 - (UPG.spsTier || 0) * 0.04)),
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
  captureTelemetrySnapshot(roomNumber);
}

function finalizeCurrentRoomTelemetry(endState, clearMs = roomTimer) {
  if(!currentRoomTelemetry || !runTelemetry) return;
  currentRoomTelemetry.end = endState;
  currentRoomTelemetry.clearMs = Math.round(clearMs);
  currentRoomTelemetry.hpEnd = roundTelemetryValue(hp);
  currentRoomTelemetry.damageless = currentRoomTelemetry.damageless && !tookDamageThisRoom;
  runTelemetry.rooms.push(currentRoomTelemetry);
  if(endState === 'clear') {
    awardRoomClearBonuses(currentRoomTelemetry);
    awardFiveRoomScoreBonus();
  }
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

function createRoomObstacles(width, height) {
  const arenaWidth = Math.max(0, width - 2 * M);
  const arenaHeight = Math.max(0, height - 2 * M);
  const cols = Math.max(1, Math.floor(arenaWidth / GRID_SIZE));
  const rows = Math.max(1, Math.floor(arenaHeight / GRID_SIZE));
  const cx = Math.floor(cols / 2);
  const cy = Math.floor(rows / 2);
  const leftCol = Math.max(1, Math.min(cols - 2, cx - 3));
  const rightCol = Math.max(1, Math.min(cols - 2, cx + 2));
  const topRow = Math.max(1, cy - 2);
  const bottomRow = Math.min(rows - 2, cy + 1);
  const inset = (GRID_SIZE - WALL_CUBE_SIZE) * 0.5;

  const cells = [];
  for(let y = topRow; y <= bottomRow; y++){
    cells.push({ col: leftCol, row: y });
    cells.push({ col: rightCol, row: y });
  }

  return cells.map(({ col, row }) => ({
    x: M + col * GRID_SIZE + inset,
    y: M + row * GRID_SIZE + inset,
    w: WALL_CUBE_SIZE,
    h: WALL_CUBE_SIZE,
  }));
}

function getCircleRectContactNormal(x, y, radius, rect) {
  const nearestX = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const nearestY = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  const dx = x - nearestX;
  const dy = y - nearestY;
  const distSq = dx * dx + dy * dy;
  if(distSq > radius * radius) return null;

  if(distSq > 0.0001){
    const dist = Math.sqrt(distSq);
    return { nx: dx / dist, ny: dy / dist, push: radius - dist };
  }

  const leftPen = Math.abs(x - rect.x);
  const rightPen = Math.abs((rect.x + rect.w) - x);
  const topPen = Math.abs(y - rect.y);
  const bottomPen = Math.abs((rect.y + rect.h) - y);
  const minPen = Math.min(leftPen, rightPen, topPen, bottomPen);
  if(minPen === leftPen) return { nx: -1, ny: 0, push: radius };
  if(minPen === rightPen) return { nx: 1, ny: 0, push: radius };
  if(minPen === topPen) return { nx: 0, ny: -1, push: radius };
  return { nx: 0, ny: 1, push: radius };
}

function resolveEntityObstacleCollisions(entity, maxPasses = 3) {
  if(!entity || !roomObstacles.length) return;
  for(let pass = 0; pass < maxPasses; pass++){
    let hadContact = false;
    for(const obstacle of roomObstacles){
      const contact = getCircleRectContactNormal(entity.x, entity.y, entity.r, obstacle);
      if(!contact) continue;
      hadContact = true;
      entity.x += contact.nx * (contact.push + 0.05);
      entity.y += contact.ny * (contact.push + 0.05);
    }
    if(!hadContact) break;
  }
}

function isEntityOverlappingObstacle(entity) {
  if(!entity || !roomObstacles.length) return false;
  for(const obstacle of roomObstacles){
    if(getCircleRectContactNormal(entity.x, entity.y, entity.r, obstacle)) return true;
  }
  return false;
}

function ejectEntityFromObstacles(entity) {
  if(!entity) return;
  resolveEntityObstacleCollisions(entity, 14);
  if(!isEntityOverlappingObstacle(entity)) return;
  for(const obstacle of roomObstacles){
    const contact = getCircleRectContactNormal(entity.x, entity.y, entity.r, obstacle);
    if(!contact) continue;
    entity.x += contact.nx * (contact.push + entity.r + 2);
    entity.y += contact.ny * (contact.push + entity.r + 2);
  }
  resolveEntityObstacleCollisions(entity, 14);
}

function resolveBulletObstacleCollision(bullet) {
  if(!bullet || !roomObstacles.length) return false;
  for(const obstacle of roomObstacles){
    const contact = getCircleRectContactNormal(bullet.x, bullet.y, bullet.r, obstacle);
    if(!contact) continue;
    bullet.x += contact.nx * (contact.push + 0.05);
    bullet.y += contact.ny * (contact.push + 0.05);
    if(Math.abs(contact.nx) >= Math.abs(contact.ny)) bullet.vx = -bullet.vx;
    else bullet.vy = -bullet.vy;
    return true;
  }
  return false;
}

function segmentIntersectsRect(ax, ay, bx, by, rect, pad = 0) {
  const minX = rect.x - pad;
  const maxX = rect.x + rect.w + pad;
  const minY = rect.y - pad;
  const maxY = rect.y + rect.h + pad;
  const dx = bx - ax;
  const dy = by - ay;
  let tMin = 0;
  let tMax = 1;
  const tests = [
    { p: -dx, q: ax - minX },
    { p: dx, q: maxX - ax },
    { p: -dy, q: ay - minY },
    { p: dy, q: maxY - ay },
  ];
  for(const { p, q } of tests){
    if(Math.abs(p) < 0.000001){
      if(q < 0) return false;
      continue;
    }
    const t = q / p;
    if(p < 0){
      if(t > tMax) return false;
      if(t > tMin) tMin = t;
    } else {
      if(t < tMin) return false;
      if(t < tMax) tMax = t;
    }
  }
  return tMax >= tMin;
}

function hasObstacleLineBlock(ax, ay, bx, by, pad = 1.5) {
  for(const obstacle of roomObstacles){
    if(segmentIntersectsRect(ax, ay, bx, by, obstacle, pad)) return true;
  }
  return false;
}

function pickPlayerAutoTarget(px, py) {
  let best = null;
  for(const e of enemies){
    const dx = e.x - px;
    const dy = e.y - py;
    const dist = Math.hypot(dx, dy);
    const blocked = hasObstacleLineBlock(px, py, e.x, e.y);
    const score = dist + (blocked ? TARGET_LOS_SOFT_PENALTY_PX : 0);
    if(!best || score < best.score || (score === best.score && dist < best.dist)){
      best = { e, dist, score };
    }
  }
  return best;
}

function beginWaveIntro(nextWaveIndex) {
  activeWaveIndex = nextWaveIndex;
  roomPhase = 'intro';
  roomIntroTimer = 0;
  bullets.length = 0;
  clearParticles();
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
  spawnQueue.length = 0;
  spawnQueue.push(...buildSpawnQueue(def));
  activeWaveIndex = 0;
  roomTimer = 0;
  roomIntroTimer = 0;
  roomPhase = 'intro';
  roomObstacles = createRoomObstacles(cv.width, cv.height);
  enemies.length = 0;
  bullets.length = 0;
  clearDmgNumbers();
  shockwaves.length = 0;
  payloadCooldownMs = 0;
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
  // Spawn the first wave before READY so players can parse the room layout.
  while(
    spawnQueue.length
    && spawnQueue[0].waveIndex === activeWaveIndex
    && enemies.length < currentRoomMaxOnScreen
  ) {
    const entry = spawnQueue.shift();
    spawnEnemy(entry.t, entry.isBoss, entry.bossScale || 1);
  }
  showRoomIntro(currentRoomIsBoss ? 'BOSS!' : 'READY?', false);
}

function triggerPayloadBlast(bullet, enemies, ts) {
  if(!bullet?.hasPayload || !enemies || enemies.length === 0) return;
  if(payloadCooldownMs > 0) return;
  const aoeRadius = getPayloadBlastRadius(UPG, bullet.r || 4.5);
  const impactDamage = bullet.dmg * 0.6;
  let hitCount = 0;
  for(let j = enemies.length - 1; j >= 0; j--){
    const e = enemies[j];
    if(Math.hypot(e.x - bullet.x, e.y - bullet.y) < aoeRadius + e.r){
      e.hp -= impactDamage;
      hitCount++;
      spawnDmgNumber(e.x, e.y - e.r, impactDamage, getPlayerColorScheme().hex);
      if(e.hp <= 0){
        awardKillPoints(e.pts);
        kills++;
        recordKill('payload');
        awardOverkillFromEnemy(e);
        sparks(e.x, e.y, e.col, e.isBoss ? 30 : 14, e.isBoss ? 160 : 95);
        spawnGreyDrops(e.x, e.y, ts);
        const killEffects = resolveEnemyKillEffects({
          enemy: e, bullet, upgrades: UPG, hp, maxHp, ts,
          vampiricHealPerKill: VAMPIRIC_HEAL_PER_KILL,
          vampiricChargePerKill: VAMPIRIC_CHARGE_PER_KILL,
        });
        applyKillUpgradeState(UPG, killEffects.nextUpgradeState);
        const killRewardActions = buildKillRewardActions({
          killEffects, enemyX: e.x, enemyY: e.y,
          playerX: player.x, playerY: player.y, ts, upgrades: UPG,
          globalSpeedLift: GLOBAL_SPEED_LIFT, bloodPactHealCap: getBloodPactHealCap(),
          random: Math.random,
        });
        for(const action of killRewardActions){
          if(action.type === 'bossClear'){ bossAlive = false; bossClears += 1; healPlayer(action.healAmount, 'bossReward'); showBossDefeated(); }
          else if(action.type === 'sustainHeal'){ applyKillSustainHeal(action.amount, action.source); }
          else if(action.type === 'gainCharge'){ gainCharge(action.amount, action.source); }
          else if(action.type === 'spawnGreyBullet'){ pushGreyBullet({ bullets, x:action.x, y:action.y, vx:action.vx, vy:action.vy, radius:action.radius, decayStart:action.decayStart }); }
          else if(action.type === 'spawnSanguineBurst'){ spawnRadialOutputBurst({ bullets, x:action.x, y:action.y, count:action.count, speed:action.speed, radius:action.radius, bounceLeft:action.bounceLeft, pierceLeft:action.pierceLeft, homing:action.homing, crit:action.crit, dmg:action.dmg, expireAt:action.expireAt, extras:action.extras }); }
        }
        enemies.splice(j, 1);
      }
    }
  }
  if(hitCount > 0) payloadCooldownMs = 5000;
  burstPayloadExplosion(bullet.x, bullet.y, aoeRadius);
  sparks(bullet.x, bullet.y, '#ff6b35', 12 + Math.min(12, Math.round((aoeRadius - 80) / 6)), 80 + aoeRadius * 0.2);
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
  resolveEntityObstacleCollisions(enemy);
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

function spawnEB(ex,ey, angleOverride = null) {
  spawnAimedEnemyBullet({
    bullets,
    player,
    x: ex,
    y: ey,
    angleOverride,
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

function spawnDBB(ex,ey, angleOverride = null) {
  spawnAimedEnemyBullet({
    bullets,
    player,
    x: ex,
    y: ey,
    angleOverride,
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
  drawGooBallImpl(ctx, x, y, radius, fillColor, coreColor, wobbleSeed, alpha);
}

function drawBounceRings(x, y, totalRadius, count, color, alpha = 0.92) {
  return drawBounceRingsImpl(ctx, x, y, totalRadius, count, color, alpha);
}

function drawBulletSprite(b, ts) {
  drawBulletSpriteImpl(ctx, b, ts, {
    decayBonus: UPG.decayBonus,
    doubleBouncePalette: getDoubleBounceBulletPalette(),
  });
}

const VOLLEY_TOTAL_DAMAGE_MULTS = [1.00, 1.75, 2.40, 2.95, 3.40, 3.75, 4.00];
const ORBITAL_FOCUS_CONTACT_BONUS = 15;
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

function getOverloadSizeScale(chargeSpent) {
  const spent = Math.max(1, Math.floor(chargeSpent || 1));
  return 2 + 2 * Math.min(1, Math.max(0, (spent - 5) / 25));
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
  const aimDx = tx - player.x;
  const aimDy = ty - player.y;
  if(Math.abs(aimDx) > 0.001 || Math.abs(aimDy) > 0.001){
    playerAimAngle = Math.atan2(aimDy, aimDx);
    playerAimHasTarget = true;
  }
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
  // Fire-rate scaling penalty: -4% damage per SPS tier so speed builds trade individual power for volume
  const spsFireRateScaling = Math.max(0.5, 1 - (UPG.spsTier || 0) * 0.04);
  // Sustained Fire bonus: +3% damage per consecutive shot, max +45%, decays 1s after last shot
  const sustainedFireBonus = Math.min(1.45, 1 + Math.min(UPG.sustainedFireShots || 0, 15) * 0.03);
  const baseDmg = (1 + UPG.snipePower * 0.35) * (UPG.playerDamageMult || 1) * (UPG.denseDamageMult || 1) * (UPG.heavyRoundsDamageMult || 1) * predatorBonus * denseDesperationBonus * lateBloomMods.damage * escalationBonus * sustainedFireBonus * spsFireRateScaling * 10;
  const lifeMs = PLAYER_SHOT_LIFE_MS * (UPG.shotLifeMult || 1) * (UPG.phantomRebound ? 2.0 : 1.0);
  const now = performance.now();
  const overchargeBonus = (UPG.overchargeVent && charge >= UPG.maxCharge) ? 1.6 : 1;
  const volleyTotalDamageMult = getVolleyTotalDamageMultiplier(availableShots);
  const volleyPerBulletDamageMult = volleyTotalDamageMult / availableShots;
  
  // Overload converts the full bank into one scaled volley worth the charge it burns.
  let overloadBonus = 1;
  let overloadSizeScale = 1;
  let chargeSpent = availableShots;
  if(UPG.overload && UPG.overloadActive && charge >= UPG.maxCharge){
    chargeSpent = Math.max(availableShots, Math.floor(charge));
    overloadBonus = chargeSpent / availableShots;
    overloadSizeScale = getOverloadSizeScale(chargeSpent);
    UPG.overloadActive = false;
    UPG.overloadCooldown = 3000;
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
    overloadSizeScale,
    getPierceLeft: (shot) => UPG.pierceTier + ((shot.isRing && UPG.corona) ? 1 : 0),
    getBloodPactHealCap,
    now,
  });
  volleySpecs.forEach((spec) => pushOutputBullet({ bullets, ...spec }));
  if(currentRoomTelemetry) currentRoomTelemetry.shotsFired = (currentRoomTelemetry.shotsFired || 0) + volleySpecs.length;
  charge=Math.max(0,charge-chargeSpent);
  recordShotSpend(chargeSpent);
  sparks(player.x,player.y,C.green,4 + Math.min(6, availableShots + Math.floor((chargeSpent - availableShots) / Math.max(1, availableShots))),55);
  
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
    shockwaves.push({ x: player.x, y: player.y, r: 10, maxR: 220, life: 1, color: getPlayerColorScheme().hex });
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
        overloadSizeScale: 1,
        getPierceLeft: (shot) => UPG.pierceTier + ((shot.isRing && UPG.corona) ? 1 : 0),
        getBloodPactHealCap,
        now: eNow,
        random: () => 1,
      });
      echoSpecs.forEach((spec) => pushOutputBullet({ bullets, ...spec }));
      if(currentRoomTelemetry) currentRoomTelemetry.shotsFired = (currentRoomTelemetry.shotsFired || 0) + echoSpecs.length;
    }
  }
}

let payloadCooldownMs = 0;

const sparks = spawnSparks;
const burstPayloadExplosion = spawnPayloadExplosion;
function burstBlueDissipate(x, y) {
  const threat = getThreatPalette();
  spawnBlueDissipateBurst(x, y, (a) => C.getRgba(threat.danger.light, a));
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

function showUpgrades() {
  gstate='upgrade'; cancelAnimationFrame(raf);
  saveRunState();
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
      legendaryOffered=true; pendingLegendary=null; legendaryRejectedIds.delete(leg.id);
      syncRunChargeCapacity(); boonHistory.push(leg.name);
      document.getElementById('s-up').classList.add('off');
      UPG._boonAppliedForRoom = roomIndex + 1;
      saveRunState();
      startRoom(roomIndex+1);
      gstate='playing'; lastT=performance.now(); raf=requestAnimationFrame(loop);
      btnPause.style.display = 'inline-flex';
      btnPatchNotes.style.display = 'none';
    },
    onLegendaryReject: (leg) => {
      legendaryRejectedIds.add(leg.id);
      legendaryRoomsSinceRejection.set(leg.id, roomIndex);
      pendingLegendary = null;
      boonHistory.push('Reject-' + leg.name);
      document.getElementById('s-up').classList.add('off');
      startRoom(roomIndex+1);
      gstate='playing'; lastT=performance.now(); raf=requestAnimationFrame(loop);
      btnPause.style.display = 'inline-flex';
      btnPatchNotes.style.display = 'none';
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
        const leg = checkLegendarySequences(boonHistory, UPG, legendaryRejectedIds, legendaryRoomsSinceRejection, roomIndex);
        if(leg) pendingLegendary=leg;
      }
      document.getElementById('s-up').classList.add('off');
      UPG._boonAppliedForRoom = roomIndex + 1;
      saveRunState();
      startRoom(roomIndex+1);
      gstate='playing'; lastT=performance.now();
      raf=requestAnimationFrame(loop);
      btnPause.style.display = 'inline-flex';
      btnPatchNotes.style.display = 'none';
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
  const entry = buildLocalScoreEntry({
    playerName,
    score,
    room: roomIndex + 1,
    runTimeMs: Math.round(runElapsedMs),
    gameVersion: VERSION.num,
    color: playerColor,
    boonOrder,
    boons,
    telemetry: buildRunTelemetryPayload(),
    continued: UPG._continued || false,
  });
  return entry;
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
    playerColors: buildResolvedPlayerColorMap(),
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
    breakdownEl: goBreakdownEl,
    score,
    note: `Crash captured at Room ${roomIndex+1} · diagnostic saved, score not submitted`,
    breakdown: { ...scoreBreakdown },
    stats: { kills, rooms: roomIndex + 1, elapsedMs: runElapsedMs, damagelessRooms },
    renderBoons: renderGameOverBoons,
  });
}

// ── PAUSE / RESUME ────────────────────────────────────────────────────────────
const pausePanel = document.getElementById('pause-panel');
const btnPause = document.getElementById('btn-pause');
const btnPatchNotes = document.getElementById('btn-patch-notes');
const pauseBoonsPanel = document.getElementById('pause-boons-panel');

function offsetAbsoluteTimestamps(pauseDuration) {
  for (const b of bullets) {
    if (b.expireAt) b.expireAt += pauseDuration;
    if (b.decayStart) b.decayStart += pauseDuration;
  }
  if (UPG.predatorKillStreakTime) UPG.predatorKillStreakTime += pauseDuration;
  if (UPG.bloodRushTimer) UPG.bloodRushTimer += pauseDuration;
  if (UPG.voidZoneTimer) UPG.voidZoneTimer += pauseDuration;
  if (UPG.sustainedFireLastShotTime) UPG.sustainedFireLastShotTime += pauseDuration;
  if (UPG.aegisBatteryTimer) UPG.aegisBatteryTimer += pauseDuration;
}

let prePauseState = null;

function pauseGame() {
  if (gstate !== 'playing' && gstate !== 'upgrade') return;
  prePauseState = gstate;
  gstate = 'paused';
  pauseStartedAt = performance.now();
  cancelAnimationFrame(raf);
  pausePanel.classList.remove('off');
  pausePanel.setAttribute('aria-hidden', 'false');
  btnPause.style.display = 'none';
}

function resumeGame() {
  if (gstate !== 'paused') return;
  const pauseDuration = performance.now() - pauseStartedAt;
  offsetAbsoluteTimestamps(pauseDuration);
  gstate = prePauseState || 'playing';
  pausePanel.classList.add('off');
  pausePanel.setAttribute('aria-hidden', 'true');
  pauseBoonsPanel.classList.add('off');
  document.getElementById('pause-confirm-panel')?.classList.add('off');
  btnPause.style.display = 'inline-flex';
  if (gstate === 'playing') {
    lastT = performance.now();
    raf = requestAnimationFrame(loop);
  }
}

function renderPauseBoons() {
  const list = document.getElementById('pause-boons-list');
  if (!list) return;
  const entries = getActiveBoonEntries(UPG);
  list.innerHTML = entries.map(e =>
    `<div class="up-active-row">${iconHTML(e.icon, 'up-active-icon')} ${e.label}</div>`
  ).join('');
}

btnPause.addEventListener('click', pauseGame);
document.getElementById('btn-pause-continue').addEventListener('click', resumeGame);
document.getElementById('btn-pause-boons').addEventListener('click', () => {
  renderPauseBoons();
  pauseBoonsPanel.classList.remove('off');
});

// In-game confirmation dialog (replaces OS confirm())
const pauseConfirmPanel = document.getElementById('pause-confirm-panel');
const pauseConfirmMsg = document.getElementById('pause-confirm-msg');
const btnConfirmYes = document.getElementById('btn-pause-confirm-yes');
const btnConfirmNo = document.getElementById('btn-pause-confirm-no');
let pendingConfirmAction = null;

function showPauseConfirm(message, onConfirm) {
  pauseConfirmMsg.textContent = message;
  pendingConfirmAction = onConfirm;
  pauseBoonsPanel.classList.add('off');
  pauseConfirmPanel.classList.remove('off');
}

btnConfirmYes.addEventListener('click', () => {
  pauseConfirmPanel.classList.add('off');
  if (pendingConfirmAction) pendingConfirmAction();
  pendingConfirmAction = null;
});
btnConfirmNo.addEventListener('click', () => {
  pauseConfirmPanel.classList.add('off');
  pendingConfirmAction = null;
});

document.getElementById('btn-pause-restart').addEventListener('click', () => {
  showPauseConfirm('Restart this run?', () => {
    clearSavedRun();
    resumeGame();
    gstate = 'start';
    cancelAnimationFrame(raf);
    pausePanel.classList.add('off');
    setMenuChromeVisible(true);
    document.getElementById('s-start').classList.remove('off');
    btnPatchNotes.style.display = 'inline-flex';
    btnPause.style.display = 'none';
  });
});
document.getElementById('btn-pause-main-menu').addEventListener('click', () => {
  showPauseConfirm('Return to main menu?', () => {
    clearSavedRun();
    resumeGame();
    gstate = 'start';
    cancelAnimationFrame(raf);
    pausePanel.classList.add('off');
    setMenuChromeVisible(true);
    document.getElementById('s-start').classList.remove('off');
    btnPatchNotes.style.display = 'inline-flex';
    btnPause.style.display = 'none';
  });
});
document.getElementById('btn-pause-lb').addEventListener('click', () => {
  // Show leaderboard overlay; when closed it reveals the still-paused game
  // so re-show pause panel on close via a one-time listener
  pausePanel.classList.add('off');
  openLeaderboardScreen();
  const lbClose = document.getElementById('btn-lb-close');
  const restore = () => {
    if (gstate === 'paused') pausePanel.classList.remove('off');
    lbClose.removeEventListener('click', restore);
  };
  if (lbClose) lbClose.addEventListener('click', restore);
});
document.getElementById('btn-pause-patch-notes').addEventListener('click', () => {
  pausePanel.classList.add('off');
  setPatchNotesOpen(true);
});

// Keyboard shortcut: Escape to toggle pause
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (gstate === 'playing' || gstate === 'upgrade') pauseGame();
    else if (gstate === 'paused') resumeGame();
  }
});

// ── RUN PERSISTENCE ────────────────────────────────────────────────────────────
const SAVED_RUN_KEY = STORAGE_KEYS.savedRun;

function saveRunState() {
  const state = {
    UPG: { ...UPG },
    score, kills, hp, maxHp, charge,
    roomIndex, runElapsedMs,
    boonRerolls, damagelessRooms,
    boonHistory: [...boonHistory],
    legendaryOffered,
    pendingLegendaryId: pendingLegendary ? pendingLegendary.id : null,
    bossClears,
    runTelemetry: { ...runTelemetry, roomHistory: [...(runTelemetry.roomHistory || [])] },
    savedAt: Date.now(),
    boonAppliedForRoom: (UPG._boonAppliedForRoom || -1),
  };
  // Strip any function values from UPG (safety)
  delete state.UPG._pendingLegendary;
  writeJson(SAVED_RUN_KEY, state);
}

function clearSavedRun() {
  removeKey(SAVED_RUN_KEY);
}

function loadSavedRun() {
  return readJson(SAVED_RUN_KEY, null);
}

function restoreRun(saved) {
  const freshDefaults = getDefaultUpgrades();
  UPG = Object.assign(freshDefaults, saved.UPG);
  score = saved.score || 0;
  kills = saved.kills || 0;
  hp = saved.hp || BASE_PLAYER_HP;
  maxHp = saved.maxHp || BASE_PLAYER_HP;
  charge = saved.charge || 0;
  roomIndex = saved.roomIndex || 0;
  runElapsedMs = saved.runElapsedMs || 0;
  boonRerolls = saved.boonRerolls ?? 1;
  damagelessRooms = saved.damagelessRooms || 0;
  boonHistory = saved.boonHistory || [];
  legendaryOffered = saved.legendaryOffered || false;
  bossClears = saved.bossClears || 0;
  if (saved.runTelemetry) {
    runTelemetry = saved.runTelemetry;
  }
  // Rehydrate pending legendary by id
  if (saved.pendingLegendaryId && !legendaryOffered) {
    const leg = checkLegendarySequences(boonHistory, UPG);
    if (leg) pendingLegendary = leg;
  }
  // Mark as continued run
  UPG._continued = true;
  UPG._boonAppliedForRoom = saved.boonAppliedForRoom ?? -1;
  // Re-sync derived state
  syncRunChargeCapacity();
  syncPlayerScale();
  player = createInitialPlayerState(cv.width, cv.height);
  bullets.length = 0; enemies.length = 0; clearParticles(); shockwaves.length = 0;
  _orbFireTimers = []; _orbCooldown = [];
  resetJoystickState(joy);
  fireT = 0; stillTimer = 0; prevStill = false;
  gameOverShown = false;
  tookDamageThisRoom = false;
  clearSavedRun();
}

function gameOver(){
  if(gameOverShown) return;
  gameOverShown = true;
  clearSavedRun();
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
  clearSavedRun();
  if (continueRunBtn) continueRunBtn.classList.add('off');
  score = runMetrics.score; kills = runMetrics.kills;
  resetScoreBreakdown();
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
  playerAimAngle = -Math.PI * 0.5;
  playerAimHasTarget = false;
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
  legendaryRejectedIds=new Set(); legendaryRoomsSinceRejection=new Map(); // Reset rejection tracking on new run
  runTelemetry = createRunTelemetry();
  currentRoomTelemetry = null;
  bullets.length=0;enemies.length=0;clearParticles();clearDmgNumbers();shockwaves.length=0;
  payloadCooldownMs = 0;
  resetJoystickState(joy);
  resetUpgrades();
  syncRunChargeCapacity();
  syncPlayerScale();
  startRoom(0);
  hudUpdate();
  btnPause.style.display = 'inline-flex';
  btnPatchNotes.style.display = 'none';
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
        breakdownEl: goBreakdownEl,
        score,
        note: '',
        breakdown: { ...scoreBreakdown },
        stats: { kills, rooms: roomIndex + 1, elapsedMs: runElapsedMs, damagelessRooms },
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
  const playerTravel = Math.hypot(player.vx, player.vy) * dt;
  const playerSteps = Math.min(10, Math.max(1, Math.ceil(playerTravel / 8)));
  const playerStepDt = dt / playerSteps;
  const playerIsMoving = Math.hypot(player.vx, player.vy) > 12;
  for(let step = 0; step < playerSteps; step++){
    player.x=Math.max(M+player.r,Math.min(W-M-player.r,player.x+player.vx*playerStepDt));
    player.y=Math.max(M+player.r,Math.min(H-M-player.r,player.y+player.vy*playerStepDt));
    if(!UPG.phaseWalk) {
      resolveEntityObstacleCollisions(player);
      player.phaseWalkOverlapMs = 0;
      player.phaseWalkIdleMs = 0;
    } else if(isEntityOverlappingObstacle(player)) {
      player.phaseWalkOverlapMs += playerStepDt * 1000;
      if(playerIsMoving) player.phaseWalkIdleMs = 0;
      else player.phaseWalkIdleMs += playerStepDt * 1000;
      if(
        player.phaseWalkOverlapMs >= PHASE_WALK_MAX_OVERLAP_MS
        || player.phaseWalkIdleMs >= PHASE_WALK_IDLE_EJECT_MS
      ) {
        ejectEntityFromObstacles(player);
        player.phaseWalkOverlapMs = 0;
        player.phaseWalkIdleMs = 0;
      }
    } else {
      player.phaseWalkOverlapMs = 0;
      player.phaseWalkIdleMs = 0;
    }
  }
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
    const _remQ = spawnedWaveEntries.remainingQueue;
    if (_remQ !== spawnQueue) { spawnQueue.length = 0; spawnQueue.push(..._remQ); }
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
      bullets.length=0; clearParticles();
      runBoonHook('onRoomClear', { UPG, healPlayer });
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
      bullets.length=0; clearParticles();
      runBoonHook('onRoomClear', { UPG, healPlayer });
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
    const _reinQ = reinforceSpawnState.remainingQueue;
    if (_reinQ !== spawnQueue) { spawnQueue.length = 0; spawnQueue.push(..._reinQ); }
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

  const combatActive = roomPhase === 'spawning' || roomPhase === 'fighting';

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

  const autoTarget = combatActive && enemies.length > 0
    ? pickPlayerAutoTarget(player.x, player.y)
    : null;
  if(autoTarget){
    playerAimAngle = Math.atan2(autoTarget.e.y - player.y, autoTarget.e.x - player.x);
    playerAimHasTarget = true;
  } else if(!combatActive || enemies.length === 0){
    playerAimHasTarget = false;
  }

  if(combatActive && charge >= 1){
    const interval = 1 / (UPG.sps * 2 * (UPG.heavyRoundsFireMult || 1));
    const mobileChargeMult = isStill ? 1.0 : (UPG.mobileChargeRate || 0.10);
    fireT += dt * mobileChargeMult;
    if(!isStill) fireT = Math.min(fireT, interval); // cap while moving — prevents pre-accumulated double shot
    if(fireT >= interval && isStill){
      fireT = fireT % interval;
      if(autoTarget) {
        firePlayer(autoTarget.e.x,autoTarget.e.y);
        UPG.sustainedFireShots = (UPG.sustainedFireShots || 0) + 1;
        UPG.sustainedFireLastShotTime = performance.now();
      }
    }
  }

  // Decay sustained fire when not actively firing (always checked)
  {
    const now = performance.now();
    if((UPG.sustainedFireLastShotTime || 0) > 0 && now - UPG.sustainedFireLastShotTime > 1000) {
      UPG.sustainedFireShots = 0;
      UPG.sustainedFireBonus = 1;
    }
  }

  prevStill = isStill;

  // ── Enemies
  if(combatActive){
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
        obstacles: roomObstacles,
      });
      resolveEntityObstacleCollisions(e);
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
            shockwaves.push({ x: player.x, y: player.y, r: 10, maxR: 180, life: 1, color: '#a78bfa' });
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
            obstacles: roomObstacles,
            random: Math.random,
            canEnemyUsePurpleShots: (enemy) => canEnemyUsePurpleShots(enemy, roomIndex),
            spawnZoner: (idx, total) => spawnZB(e.x, e.y, idx, total),
            spawnEliteZoner: (idx, total, stage) => spawnEliteZB(e.x, e.y, idx, total, stage),
            spawnDoubleBounce: (angle) => spawnDBB(e.x, e.y, angle),
            spawnTriangle: () => spawnTB(e.x, e.y),
            spawnEliteTriangle: () => spawnEliteTriangleBullet(e.x, e.y),
            spawnEliteBullet: (angle, speed, stage) => spawnEliteBullet(e.x, e.y, angle, speed, stage),
            spawnEnemyBullet: (angle) => spawnEB(e.x, e.y, angle),
          });
        }
      }

      if(UPG.orbitSphereTier > 0){
        // Sync arrays
        syncOrbRuntimeArrays(_orbFireTimers, _orbCooldown, UPG.orbitSphereTier);
        const orbDamageBonus = (1 + 0.25 * (UPG.orbDamageTier || 0)) * (1 + 0.10 * Math.max(0, UPG.orbitSphereTier - 1));
        const orbitContact = applyOrbitSphereContact(e, {
          orbCooldown: _orbCooldown,
          orbitSphereTier: UPG.orbitSphereTier,
          ts,
          getOrbitSlotPosition,
          rotationSpeed: ORBIT_ROTATION_SPD,
          radius: getOrbitRadius(),
          originX: player.x,
          originY: player.y,
          orbitalFocus: UPG.orbitalFocus,
          chargeRatio: getChargeRatio(),
          orbSphereRadius: getOrbVisualRadius(),
          baseDamage: 20,
          focusDamageBonus: ORBITAL_FOCUS_CONTACT_BONUS,
          focusChargeScale: 1.5,
          orbDamageBonus,
        });
        if(orbitContact.hit){
          sparks(orbitContact.slotX, orbitContact.slotY, C.green, 4, 45);
          spawnDmgNumber(orbitContact.slotX, orbitContact.slotY - getOrbVisualRadius(), orbitContact.damage, getPlayerColorScheme().hex);
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
          scoreBreakdown.kills += orbitKillEffects.scoreDelta;
          kills += orbitKillEffects.killsDelta;
          recordKill('orbit');
          awardOverkillFromEnemy(e);
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
    for(const e of enemies) resolveEntityObstacleCollisions(e);
  }

  // ── Charged Orbs: each alive orb fires at nearest enemy every 1.8s
  if(combatActive && UPG.chargedOrbs && UPG.orbitSphereTier>0 && enemies.length>0){
    syncOrbRuntimeArrays(_orbFireTimers, _orbCooldown, UPG.orbitSphereTier);
    for(let si=0;si<UPG.orbitSphereTier;si++){
      const orbFireInterval = CHARGED_ORB_FIRE_INTERVAL_MS * (UPG.orbitalFocus ? ORBITAL_FOCUS_CHARGED_ORB_INTERVAL_MULT : 1);
      const orbDamageBonus = (1 + 0.25 * (UPG.orbDamageTier || 0)) * (1 + 0.10 * Math.max(0, UPG.orbitSphereTier - 1));
      const orbVolley = buildChargedOrbVolleyForSlot({
        slotIndex: si,
        timerMs: _orbFireTimers[si] || 0,
        dtMs: dt * 1000,
        fireIntervalMs: orbFireInterval,
        orbCooldown: _orbCooldown,
        orbitSphereTier: UPG.orbitSphereTier,
        ts,
        rotationSpeed: ORBIT_ROTATION_SPD,
        radius: getOrbitRadius(),
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
        orbDamageBonus,
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

  if(combatActive && UPG.aegisBattery && UPG.shieldTier > 0 && enemies.length > 0){
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
      triggerPayloadBlast(b, enemies, ts);
      bullets.splice(i,1);
      continue;
    }
    // Homing for output bullets
    if(b.state==='output'&&b.homing&&enemies.length>0){
      const tgt=enemies.reduce((bst,e)=>{const d=Math.hypot(e.x-b.x,e.y-b.y);return(!bst||d<bst.d)?{e,d}:bst;},null);
      if(tgt){
        const dx=tgt.e.x-b.x,dy=tgt.e.y-b.y,d=Math.hypot(dx,dy);
        const homingSteer = 160 + 160 * (UPG.homingTier || 1);
        b.vx+=(dx/d)*homingSteer*dt; b.vy+=(dy/d)*homingSteer*dt;
        const sp=Math.hypot(b.vx,b.vy);
        // Match the launch-speed basis so homing cannot silently nerf Faster Bullets/Snipe scaling.
        const homingSpeedMult = 1.2 + (UPG.homingTier || 1) * 0.05;
        const maxSp=230*GLOBAL_SPEED_LIFT*Math.min(2.0,UPG.shotSpd)*(1+UPG.snipePower*0.18)*homingSpeedMult;
        if(sp>maxSp){b.vx=b.vx/sp*maxSp;b.vy=b.vy/sp*maxSp;}
      }
    }

    if(b.state==='danger'){
      const gdist=Math.hypot(b.x-player.x,b.y-player.y);
      const inGravityField = Boolean(UPG.gravityWell && gdist < 96);
      const currentSpeed = Math.hypot(b.vx, b.vy);
      if(inGravityField && !b.gravityWellBaseSpeed){
        b.gravityWellBaseSpeed = Math.max(40, currentSpeed);
      }
      if((inGravityField || b.gravityWellBaseSpeed) && currentSpeed > 0.0001){
        const targetSpeed = inGravityField
          ? Math.max(40, b.gravityWellBaseSpeed * 0.55)
          : Math.max(40, b.gravityWellBaseSpeed);
        const pull = 1 - Math.pow(inGravityField ? 0.16 : 0.08, dt);
        const nextSpeed = currentSpeed + (targetSpeed - currentSpeed) * pull;
        b.vx = (b.vx / currentSpeed) * nextSpeed;
        b.vy = (b.vy / currentSpeed) * nextSpeed;
        if(!inGravityField && Math.abs(nextSpeed - targetSpeed) < 2){
          delete b.gravityWellBaseSpeed;
        }
      } else if(!inGravityField && b.gravityWellBaseSpeed){
        delete b.gravityWellBaseSpeed;
      }
    }

    let bounced=false;
    // Sub-stepped bullet movement prevents tunneling through wall cubes on long frames.
    const maxFrameTravel = Math.max(Math.abs(b.vx), Math.abs(b.vy)) * dt;
    const subSteps = Math.min(6, Math.max(1, Math.ceil(maxFrameTravel / 10)));
    const stepDt = dt / subSteps;
    for(let step = 0; step < subSteps; step++){
      b.x += b.vx * stepDt;
      b.y += b.vy * stepDt;
      if(b.x-b.r<M){b.x=M+b.r;b.vx=Math.abs(b.vx);bounced=true;}
      if(b.x+b.r>W-M){b.x=W-M-b.r;b.vx=-Math.abs(b.vx);bounced=true;}
      if(b.y-b.r<M){b.y=M+b.r;b.vy=Math.abs(b.vy);bounced=true;}
      if(b.y+b.r>H-M){b.y=H-M-b.r;b.vy=-Math.abs(b.vy);bounced=true;}
      if(resolveBulletObstacleCollision(b)) bounced = true;
    }

    if(b.state==='danger' && !b.nearMissed && currentRoomTelemetry && player.invincible <= 0){
      const nmDist = Math.hypot(b.x - player.x, b.y - player.y);
      if(nmDist < player.r * 2.75 + b.r && nmDist > player.r + b.r){
        b.nearMissed = true;
        currentRoomTelemetry.nearMisses = (currentRoomTelemetry.nearMisses || 0) + 1;
      }
    }

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
          // Phantom Rebound: convert to grey charge bullet instead of removing
          if(UPG.phantomRebound && UPG.bounceTier > 0) {
            b.state = 'grey';
            b.decayStart = ts;
            sparks(b.x, b.y, C.ghost, 6, 50);
            continue;
          } else {
            triggerPayloadBlast(b, enemies, ts);
            bullets.splice(i,1);
            continue;
          }
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
            radius: getOrbitRadius(),
            originX: player.x,
            originY: player.y,
          });
          const sx=orbitSlot.x;
          const sy=orbitSlot.y;
          const orbAbsorbR = getOrbVisualRadius() + 7;
          if(Math.hypot(b.x-sx,b.y-sy)<b.r+orbAbsorbR){
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
          radius: getOrbitRadius(),
          originX: player.x,
          originY: player.y,
        });
        const sx=orbitSlot.x;
        const sy=orbitSlot.y;
        const orbHitR = getOrbVisualRadius() + 2;
        if(Math.hypot(b.x-sx,b.y-sy)<b.r+orbHitR){
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
        spawnDmgNumber(player.x, player.y, dangerHit.damage, b.col || getThreatPalette().danger.hex);
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
        spawnDmgNumber(player.x, player.y, dangerHit.damage, b.col || getThreatPalette().danger.hex);
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
          spawnDmgNumber(e.x, e.y - e.r, hitResolution.damage, b.crit ? C.ghost : getPlayerColorScheme().hex);
          // Blood Pact: piercing shots restore 1 HP per enemy hit
          if(hitResolution.shouldBloodPactHeal){
            applyKillSustainHeal(1, 'bloodPact');
            b.bloodPactHeals = hitResolution.nextBloodPactHeals;
          }
          if(e.hp<=0){
            awardKillPoints(e.pts);
            kills++;
            recordKill('output');
            awardOverkillFromEnemy(e);
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

  // ── Damage numbers
  for(let i=dmgNumbers.length-1;i>=0;i--){
    const d=dmgNumbers[i];
    d.y -= 40*dt;
    d.life -= 1.8*dt;
    if(d.life<=0) dmgNumbers.splice(i,1);
  }

  // ── Shockwaves
  for(let i=shockwaves.length-1;i>=0;i--){
    const s = shockwaves[i];
    s.r += (s.maxR - s.r) * Math.min(1, dt * 4.5);
    s.life -= dt * 1.4;
    if(s.life <= 0 || s.r >= s.maxR - 0.5) shockwaves.splice(i,1);
  }

  // ── Payload cooldown
  if(payloadCooldownMs > 0) payloadCooldownMs = Math.max(0, payloadCooldownMs - dt*1000);
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
  const gs=GRID_SIZE;
  for(let x=M;x<W-M;x+=gs){ctx.beginPath();ctx.moveTo(x,M);ctx.lineTo(x,H-M);ctx.stroke();}
  for(let y=M;y<H-M;y+=gs){ctx.beginPath();ctx.moveTo(M,y);ctx.lineTo(W-M,y);ctx.stroke();}

  // Grid obstacles (subtle cover cubes)
  ctx.fillStyle='rgba(180, 196, 220, 0.12)';
  ctx.strokeStyle='rgba(220, 235, 255, 0.28)';
  ctx.lineWidth=1;
  for(const obstacle of roomObstacles){
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
    ctx.strokeRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
    ctx.beginPath();
    ctx.moveTo(obstacle.x, obstacle.y + obstacle.h);
    ctx.lineTo(obstacle.x + obstacle.w, obstacle.y);
    ctx.strokeStyle='rgba(255,255,255,0.08)';
    ctx.stroke();
    ctx.strokeStyle='rgba(220, 235, 255, 0.28)';
  }

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
  for(const e of enemies){
    ctx.save();

    // Windup tell: very subtle swell + faint ring
    const inWindup = !e.isRusher && !e.isSiphon && e.fT >= e.fRate - WINDUP_MS_DRAW;
    let drawR = e.r;
    if(inWindup){
      const prog = Math.max(0, Math.min(1, (e.fT - (e.fRate - WINDUP_MS_DRAW)) / WINDUP_MS_DRAW)); // 0→1 clamped
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
      const ringCount = getEnemyBounceRingCount(e);
      const bodyRadius = drawBounceRings(e.x, e.y, drawR, ringCount, e.col, 0.94);
      ctx.beginPath();ctx.arc(e.x,e.y,bodyRadius,0,Math.PI*2);ctx.fill();
      drawBounceRings(e.x, e.y, drawR, ringCount, e.col, 0.98);
      ctx.shadowBlur=0;
      // Inner glint
      ctx.fillStyle='rgba(255,255,255,0.18)';
      ctx.beginPath();ctx.arc(e.x,e.y,Math.max(2, bodyRadius * 0.45),0,Math.PI*2);ctx.fill();
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
    const enemyName = e.label || e.type;
    ctx.fillText(e.isBoss ? '★ BOSS' : enemyName.toUpperCase(), e.x, e.y + e.r + (e.isBoss ? 14 : 11));
    ctx.restore();
  }

  // Ghost player sprite
  // Payload-ready ring indicator (drawn before ghost so ghost is on top)
  if(UPG.payload && payloadCooldownMs <= 0){
    const hex = getPlayerColorScheme().hex;
    const rr = parseInt(hex.slice(1,3),16), gg = parseInt(hex.slice(3,5),16), bb = parseInt(hex.slice(5,7),16);
    const compR = 255 - rr, compG = 255 - gg, compB = 255 - bb;
    const pulse = 0.4 + 0.3 * Math.sin(ts * 0.006);
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = `rgb(${compR},${compG},${compB})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  const show=player.invincible<=0||Math.floor(ts/90)%2===0;
  if(show){ drawGhost(ts); }
  if(show && playerAimHasTarget){
    const drift = Math.sin(ts * 0.01) * 0.8;
    const dist = player.r + AIM_ARROW_OFFSET + drift;
    const cx = player.x + Math.cos(playerAimAngle) * dist;
    const cy = player.y + Math.sin(playerAimAngle) * dist;
    const triH = AIM_TRI_SIDE * 0.8660254;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(playerAimAngle);
    ctx.fillStyle = C.getRgba(C.green, 0.6);
    ctx.beginPath();
    ctx.moveTo((triH * 2) / 3, 0);
    ctx.lineTo(-(triH / 3), AIM_TRI_SIDE / 2);
    ctx.lineTo(-(triH / 3), -(AIM_TRI_SIDE / 2));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

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
    const orbR = getOrbitRadius();
    const orbVis = getOrbVisualRadius();
    const orbInner = 2 * (UPG.orbSizeMult || 1);
    for(let si=0;si<UPG.orbitSphereTier;si++){
      const sAngle=Math.PI*2/UPG.orbitSphereTier*si+ts*ORBIT_ROTATION_SPD;
      const sx=player.x+Math.cos(sAngle)*orbR;
      const sy=player.y+Math.sin(sAngle)*orbR;
      if(_orbCooldown[si]>0){
        ctx.save();
        ctx.globalAlpha=0.18;
        ctx.fillStyle=C.green;
        ctx.beginPath();ctx.arc(sx,sy,orbVis,0,Math.PI*2);ctx.fill();
        ctx.restore();
        continue;
      }
      ctx.save();
      ctx.shadowColor=C.green;ctx.shadowBlur=12;
      ctx.fillStyle=C.green;
      ctx.globalAlpha=0.85;
      ctx.beginPath();ctx.arc(sx,sy,orbVis,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;
      ctx.fillStyle=C.getRgba(C.ghost, 0.92);
      ctx.beginPath();ctx.arc(sx,sy,orbInner,0,Math.PI*2);ctx.fill();
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

  // Shockwaves
  ctx.save();
  for(const s of shockwaves){
    const alpha = Math.max(0, s.life);
    ctx.globalAlpha = alpha * 0.75;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 3;
    ctx.shadowColor = s.color;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
    ctx.stroke();
  }
  ctx.restore();

  // Floating damage numbers
  ctx.save();
  ctx.font = 'bold 10px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  for(const d of dmgNumbers){
    ctx.globalAlpha = Math.max(0, d.life * 0.9);
    ctx.fillStyle = d.color;
    ctx.fillText(d.text, d.x, d.y);
  }
  ctx.restore();

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
  const shotInterval = 1 / (UPG.sps * 2 * (UPG.heavyRoundsFireMult || 1));
  drawGhostSprite(ctx, ts, {
    playerState: player,
    chargeValue: charge,
    maxChargeValue: UPG.maxCharge,
    fireProgress: charge >= 1 ? fireT / shotInterval : 0,
    gameState: gstate,
    hpValue: hp,
    maxHpValue: maxHp,
    hatKey: playerHat,
  });
}

function drawStartGhostPreview(ts = performance.now()) {
  if(!startGhostPreview || !startGhostPreviewCtx) return;
  startGhostPreviewCtx.clearRect(0, 0, startGhostPreview.width, startGhostPreview.height);
  startGhostPreviewCtx.save();
  startGhostPreviewCtx.translate(startGhostPreview.width / 2, startGhostPreview.height / 2 + 16);
  startGhostPreviewCtx.scale(3.1, 3.1);
  startGhostPreviewCtx.translate(-startGhostPreview.width / 2, -(startGhostPreview.height / 2 + 16));
  drawGhostSprite(startGhostPreviewCtx, ts, {
    playerState: {
      x: startGhostPreview.width / 2,
      y: startGhostPreview.height / 2 + 16,
      r: 9,
      vx: 0,
      distort: 0,
      invincible: 0,
      deadAt: 0,
      popAt: 0,
    },
    chargeValue: 0,
    maxChargeValue: 5,
    fireProgress: 0,
    gameState: 'start',
    hpValue: BASE_PLAYER_HP,
    maxHpValue: BASE_PLAYER_HP,
    hatKey: playerHat,
    idleStill: true,
  });
  startGhostPreviewCtx.restore();
}

function drawHatOptionPreview(canvas, hatKey) {
  const ctxRef = canvas?.getContext?.('2d');
  if(!canvas || !ctxRef) return;
  const width = canvas.width;
  const height = canvas.height;
  ctxRef.clearRect(0, 0, width, height);
  ctxRef.save();
  ctxRef.translate(width / 2, height / 2 + 9);
  ctxRef.fillStyle = C.getRgba(C.ghost, 0.14);
  ctxRef.beginPath();
  ctxRef.arc(0, -2, 18, 0, Math.PI * 2);
  ctxRef.fill();
  ctxRef.fillStyle = C.getRgba(C.ghostBody, 0.95);
  ctxRef.beginPath();
  ctxRef.arc(0, -4.5, 8.5, Math.PI, 0);
  ctxRef.lineTo(8.5, 4.5);
  ctxRef.quadraticCurveTo(0, 11, -8.5, 4.5);
  ctxRef.closePath();
  ctxRef.fill();
  drawGhostHatLayer(ctxRef, hatKey, 8.5, C.getRgba(C.ghostBody, 0.95), performance.now());
  ctxRef.restore();
}

// ── HUD ───────────────────────────────────────────────────────────────────────
function hudUpdate(){
  renderHud({
    roomIndex,
    runElapsedMs,
    score,
    charge,
    maxCharge: UPG.maxCharge,
    sps: UPG.sps * (UPG.heavyRoundsFireMult || 1),
    elements: {
      roomCounter: roomCounterEl,
      scoreText: scoreTextEl,
      chargeFill: chargeFillEl,
      chargeBadge: chargeBadgeEl,
      spsNumber: spsNumberEl,
    },
  });
}

function startGhostPreviewLoop() {
  if(startGhostPreviewRaf) cancelAnimationFrame(startGhostPreviewRaf);
  const tick = (ts) => {
    drawStartGhostPreview(ts);
    startGhostPreviewRaf = requestAnimationFrame(tick);
  };
  startGhostPreviewRaf = requestAnimationFrame(tick);
}

bindJoystickControls({
  canvas: cv,
  joy,
  getGameState: () => gstate,
});

// Patch notes render lazily on first panel open (see setPatchNotesOpen).
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

bindPatchNotesControls({
  button: settingsOpenBtn,
  closeButton: settingsCloseBtn,
  panelEl: settingsPanel,
  onOpenChange: setSettingsPanelOpen,
  doc: document,
});

bindPatchNotesControls({
  button: hatsOpenBtn,
  closeButton: hatsCloseBtn,
  panelEl: hatsPanel,
  onOpenChange: setHatsPanelOpen,
  doc: document,
});

bindPatchNotesControls({
  button: contributorsOpenBtn,
  closeButton: contributorsCloseBtn,
  panelEl: contributorsPanel,
  onOpenChange: setContributorsPanelOpen,
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
renderSettingsPanel();
renderHatsPanel();
syncColorDrivenCopy();
startGhostPreviewLoop();

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
  onMainMenu: () => {
    btnPatchNotes.style.display = 'inline-flex';
    btnPause.style.display = 'none';
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

// Continue Run — show button if saved run exists
const continueRunBtn = document.getElementById('btn-continue-run');
const savedRun = loadSavedRun();
if (savedRun && continueRunBtn) {
  continueRunBtn.classList.remove('off');
  continueRunBtn.textContent = `Continue Run (Room ${(savedRun.roomIndex || 0) + 1})`;
  continueRunBtn.addEventListener('click', () => {
    restoreRun(savedRun);
    continueRunBtn.classList.add('off');
    startScreen.classList.add('off');
    setMenuChromeVisible(false);
    // Go straight to room if boon already applied; else show upgrade screen
    if ((savedRun.boonAppliedForRoom ?? -1) === (savedRun.roomIndex || 0)) {
      startRoom(roomIndex);
      gstate = 'playing';
      lastT = performance.now();
      raf = requestAnimationFrame(loop);
      btnPause.style.display = 'inline-flex';
      if (typeof btnPatchNotes !== 'undefined' && btnPatchNotes) btnPatchNotes.style.display = 'none';
    } else {
      showUpgrades();
    }
  });
}

forceLocalLeaderboardFallback(lbSync, 'LOCAL FALLBACK');
syncLeaderboardStatusBadgeView(lbStatus, lbSync.statusMode, lbSync.statusText);
setPlayerName(loadSavedPlayerName(), { syncInputs: true });
renderLeaderboard();
revealAppShell();

draw(0);
