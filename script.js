// ═══════════════════════════════════════════════════════════════════════════════
// script.js — monolithic game module (4500+ lines). Agents: read agents.md first.
//
// FILE MAP (grep these dividers — `// ── SECTION ──`):
//   ~373   PLAYER UPGRADES    UPG object, boon tier registry, resetUpgrades
//   ~629   STATE              player/bullets/enemies/room state, input refs, run vars
//   ~1178  buildRoom          spawn queue composition, boss setup (hook: onRoomStart)
//   ~1518  drawBulletSprite   per-bullet rendering (not yet extracted)
//   ~1580  fire()             bullet spawn + overload/shockwave/echoFire activation
//   ~1910  PAUSE / RESUME     pause overlay, offsetAbsoluteTimestamps (hook: onPauseAdjust)
//   ~2044  RUN PERSISTENCE    serialize / continueRun (legacy recovery intentionally disabled)
//   ~2173  MAIN LOOP          requestAnimationFrame loop
//   ~2185  finalizeRoomClearState, update()
//            in-update sub-sections (grep `// ── ` inside update):
//            Player movement · Shields · Room state machine · Auto-fire ·
//            Enemies · Charged Orbs · Bullets · Particles · Damage numbers ·
//            Shockwaves · Payload cooldown
//   ~3329  ROOM CLEAR FLASH   screen flash + room-clear transition (hook: onRoomClear)
//   ~3357  DRAW               render pass: background, entities, HUD overlays
//   ~3657  GHOST SPRITE       ghost rendering delegates to src/ui/drawing/ghostRenderer.js
//   ~3725  HUD                score/HP/charge/kill-streak HUD elements
//
// Line numbers drift; grep the divider text instead of relying on them.
// Before editing large sections, prefer extracting to src/ (see agents.md).
// ═══════════════════════════════════════════════════════════════════════════════

import { C, ROOM_SCRIPTS, BOSS_ROOMS, DECAY_BASE, M, VERSION } from './src/data/gameData.js';
import { BOONS, CHARGED_ORB_FIRE_INTERVAL_MS, ESCALATION_KILL_PCT, ESCALATION_MAX_BONUS, getActiveBoonEntries, getDefaultUpgrades, getRequiredShotCount, getKineticChargeRate, getPayloadBlastRadius, syncChargeCapacity, getEvolvedBoon, checkLegendarySequences, pickBoonChoices, getLateBloomGrowth, LATE_BLOOM_SPEED_PENALTY, LATE_BLOOM_DAMAGE_TAKEN_PENALTY, LATE_BLOOM_DAMAGE_PENALTY } from './src/data/boons.js';
import { ENEMY_TYPES, createEnemy, canEnemyUsePurpleShots, getEnemyDefinition } from './src/entities/enemyTypes.js';
import {
  resolveEnemySeparation,
  stepEnemyCombatState,
  fireEnemyBurst,
  applyOrbitSphereContact,
} from './src/entities/enemyRuntime.js';
import {
  createRoomObstacles as createRoomObstaclesImpl,
  resolveEntityObstacleCollisions as resolveEntityObstacleCollisionsImpl,
  isEntityOverlappingObstacle as isEntityOverlappingObstacleImpl,
  ejectEntityFromObstacles as ejectEntityFromObstaclesImpl,
  resolveBulletObstacleCollision as resolveBulletObstacleCollisionImpl,
  hasObstacleLineBlock as hasObstacleLineBlockImpl,
} from './src/systems/obstacles.js';
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
import { resetBulletIds, setBulletIdState } from './src/entities/bulletIds.js';
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
import { createPauseController } from './src/ui/pauseController.js';
import { simRng, parseSeedParam, setRngState } from './src/systems/seededRng.js';
import { createSimState, createSlot } from './src/sim/simState.js';
import { showGameOverScreen, renderScoreBreakdown } from './src/ui/gameOver.js';
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
import { bindCoopLobby } from './src/ui/coopLobby.js';
import { supabaseTransportFactory } from './src/net/coopTransportSupabase.js';
import {
  armPendingCoopRun,
  consumePendingCoopRun,
  clearCoopRun,
  isCoopRun,
  isOnlineCoopRun,
  isCoopHost,
  isCoopGuest,
} from './src/net/coopRunConfig.js';
import { getLocalSlot, getLocalSlotIndex } from './src/net/onlineSlotRuntime.js';
import { createCoopInputSync } from './src/net/coopInputSync.js';
import {
  createSnapshotSequencer,
  isNewerSnapshot,
  decodeSnapshot,
} from './src/net/coopSnapshot.js';
import { createSnapshotApplier } from './src/net/snapshotApplier.js';
import { createPredictionReconciler } from './src/net/predictionReconciler.js';
import { createBulletLocalAdvance, PREDICTABLE_STATES as BULLET_PREDICTABLE_STATES } from './src/net/bulletLocalAdvance.js';
import { createGreyLagComp } from './src/net/greyLagComp.js';
import { createBulletSpawnDetector } from './src/net/bulletSpawnDetector.js';
import { createSnapshotBroadcaster } from './src/net/coopSnapshotBroadcaster.js';
import { createHostRemoteInputProcessor } from './src/net/hostRemoteInputProcessor.js';
import { setupRollback, teardownRollback, coordinatorStep } from './src/net/rollbackIntegration.js';
import { hostSimStep } from './src/sim/hostSimStep.js';
import { drain as drainSimEffectQueue } from './src/sim/effectQueue.js';
import { applyJoystickVelocity, tickBodyPosition } from './src/sim/playerMovement.js';
import { tickPostMovementTimers } from './src/sim/postMovementTick.js';
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
  spawnMuzzleStreak,
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
  applyBulletHoming,
  applyDangerGravityWell,
  advanceBulletWithSubsteps,
  detectBulletNearMiss,
  tickGreyBulletDecay,
} from './src/systems/bulletRuntime.js';
import { dispatchBulletBounce } from './src/sim/bulletBounceDispatch.js';
import { detectVolatileOrbHit } from './src/sim/volatileOrbDispatch.js';
import { detectGreyAbsorb } from './src/sim/greyAbsorbDispatch.js';
import { detectShieldHit } from './src/sim/shieldHitDispatch.js';
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
import { createInitialPlayerState, createInitialRunMetrics, createInitialRuntimeTimers } from './src/core/runState.js';
import { createWorldSpace } from './src/core/worldSpace.js';
import {
  createPlayerSlot,
  playerSlots,
  resetPlayerSlots,
  registerPlayerSlot,
} from './src/core/playerSlot.js';
import {
  createHostInputAdapter,
  createArrowKeysInputAdapter,
  createRemoteInputAdapter,
} from './src/core/inputAdapters.js';
import { createRunTelemetryController } from './src/systems/runTelemetryController.js';
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
  // D18.14 — re-announce our hat to the coop partner so they see the
  // change immediately, not just on next run start. No-op if not in coop.
  try { sendCoopLocalHat(); } catch (_) {}
}

window.addEventListener('phantom:player-color-change', (event) => {
  const colorKey = event.detail?.key || getPlayerColor();
  writeText(PLAYER_COLOR_KEY, colorKey);
  refreshThemeBoundUi();
  // D18.7 — re-announce our color to the coop partner so they see the
  // change immediately, not just on next run start. No-op if not in coop.
  try { sendCoopLocalColor(); } catch (_) {}
});

window.addEventListener('phantom:color-assist-change', (event) => {
  writeText(COLOR_ASSIST_KEY, event.detail?.assistMode || getColorAssistMode());
  refreshThemeBoundUi();
});

const cv  = document.getElementById('cv');
const ctx = cv.getContext('2d');

// ── WORLD-SPACE (Phase D0a, 2026-04-24) ──────────────────────────────────────
// The sim runs in WORLD coordinates. In solo (and ?coopdebug=1) WORLD_W/WORLD_H
// are mirrored from cv.width/cv.height in resize() so behavior is byte-identical.
// In online coop (Phase D+) the host pins a fixed world size and the renderer
// scales the canvas viewport into world space via a ctx transform in draw().
// This gives host + guest a shared arena regardless of each device's screen.
const worldSpace = createWorldSpace();
let WORLD_W = 0;
let WORLD_H = 0;
// D12.1 — once the guest receives the host's world dimensions on coop-run-start
// the world is "pinned": subsequent canvas resizes (orientation change, viewport
// rescale, etc.) must NOT clobber WORLD_W/WORLD_H, only change the render
// scale via getRenderScale. Cleared on coop teardown so solo runs go back to
// canvas-driven world sizing.
let coopWorldPinned = false;
function syncWorldFromCanvas() {
  if (coopWorldPinned) return; // Coop guest: world is host-authoritative.
  if (cv.width > 0 && cv.height > 0) {
    worldSpace.set(cv.width, cv.height);
    WORLD_W = worldSpace.width;
    WORLD_H = worldSpace.height;
  }
}
function setCoopWorldFromHost(worldW, worldH) {
  // Coop guest: pin sim world to host's dimensions. Render scale is computed
  // each frame from worldSpace + cv.width/cv.height, so the guest's canvas
  // can stay at any resolution and the arena will letterbox-scale to fit.
  if (!Number.isFinite(worldW) || !Number.isFinite(worldH) || worldW <= 0 || worldH <= 0) return false;
  try {
    worldSpace.set(worldW | 0, worldH | 0);
    WORLD_W = worldSpace.width;
    WORLD_H = worldSpace.height;
    coopWorldPinned = true;
    try { console.info('[coop] world pinned to host: ' + WORLD_W + 'x' + WORLD_H); } catch (_) {}
    return true;
  } catch (err) {
    try { console.warn('[coop] setCoopWorldFromHost failed', err); } catch (_) {}
    return false;
  }
}
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
// D18.8 — coop end-screen DOM (parity with solo s-go).
const goCoopBoonsBtn = document.getElementById('btn-go-coop-boons');
const goCoopBoonsPanel = document.getElementById('go-coop-boons-panel');
const goCoopBoonsList = document.getElementById('go-coop-boons-list');
const goCoopBoonsCloseBtn = document.getElementById('btn-go-coop-boons-close');
const goCoopBreakdownEl = document.getElementById('go-coop-breakdown');
const goCoopNoteEl = document.getElementById('go-coop-note');
const lbOpenBtnGoCoop = document.getElementById('btn-lb-open-go-coop');
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
  // D16.1 (2026-04-25): unified arena aspect across all devices. Previously PC
  // capped at 1.34 while phone went to 1.78, which broke entity placement
  // (busters at top/bottom corners clipped or bunched on PC because spawn
  // coords assume the tall portrait world). Single ARENA_ASPECT keeps the sim
  // arena visually consistent everywhere; viewport-height shrinks the canvas
  // width to fit while preserving aspect.
  const ARENA_ASPECT = 1.78;
  const viewportWidth = window.visualViewport?.width || window.innerWidth;
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  document.body.classList.toggle('compact-viewport', viewportHeight < 780);
  document.body.classList.toggle('tight-viewport', viewportHeight < 700);

  const setCanvasSize = (width, height = Math.floor(width * ARENA_ASPECT)) => {
    const nextWidth = Math.max(240, Math.floor(width));
    const nextHeight = Math.max(Math.floor(nextWidth * ARENA_ASPECT), Math.floor(height));
    cv.width = nextWidth;
    cv.height = nextHeight;
    syncWorldFromCanvas();
  };

  // D18.4 (2026-04-26): pin canvas reference width to 380 (matches phone
  // viewport minus 16px gutter on iPhone 14 Pro Max class devices). Prior
  // cap of 400 made desktop canvases ~7% wider than typical phones, which
  // playtesters reported as a "drastically oversized" arena. The CSS
  // #wrap rule mirrors this cap. Phones below 396 CSS px are unaffected
  // because they hit the `viewportWidth - 16` cap first.
  const maxWidthByViewport = Math.min(380, viewportWidth - 16);
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
  const maxWidthByHeight = Math.floor(availableCanvasHeight / ARENA_ASPECT);
  const finalWidth = Math.min(maxWidthByViewport, maxWidthByHeight > 0 ? maxWidthByHeight : maxWidthByViewport);
  const finalHeight = Math.floor(finalWidth * ARENA_ASPECT);
  setCanvasSize(finalWidth, finalHeight);

  cv.style.width = `${cv.width}px`;
  cv.style.height = `${cv.height}px`;

  // D12.2 — coop guest with host-pinned world: use host's WORLD_W/WORLD_H
  // as the canvas pixel buffer (1:1 render transform → no distortion or
  // bottom-truncation when guest's viewport aspect differs from host's),
  // and scale only the CSS display size to fit the device while preserving
  // world aspect. Joystick reads via getBoundingClientRect so input still
  // maps correctly across the pixel/CSS scale gap.
  if (coopWorldPinned && WORLD_W > 0 && WORLD_H > 0) {
    const displayW = cv.width;
    const displayH = cv.height;
    cv.width = WORLD_W;
    cv.height = WORLD_H;
    const worldAspect = WORLD_H / WORLD_W;
    const cssW = Math.min(displayW, displayH / worldAspect);
    const cssH = cssW * worldAspect;
    cv.style.width = `${Math.floor(cssW)}px`;
    cv.style.height = `${Math.floor(cssH)}px`;
  }
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

// D18.8 — coop end screen renders the LOCAL player's loadout. Host shows
// slot 0's UPG (== global UPG). Guest shows slot 1's UPG (independent per
// D14.1).
function renderCoopGameOverBoons() {
  if (!goCoopBoonsList) return;
  let upg = UPG;
  try {
    if (coopRematchRole === 'guest' && playerSlots && playerSlots[1]) {
      const slot1 = playerSlots[1];
      upg = (typeof slot1.getUpg === 'function') ? slot1.getUpg() : (slot1.upg || UPG);
    }
  } catch (_) {}
  renderGameOverBoonsList(goCoopBoonsList, getActiveBoonEntries(upg));
}

function syncPlayerScale() {
  if(!player) return;
  player.r = 9 * (UPG.playerSizeMult || 1);
}

let _patchNotesDataPromise = null;
function loadPatchNotesData() {
  if(!_patchNotesDataPromise) {
    const patchNotesUrl = `./src/data/patchNotes.js?v=${encodeURIComponent(VERSION.num)}`;
    _patchNotesDataPromise = import(patchNotesUrl).catch(err => {
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
  const overkillRoom = telemetryController.getCurrentRoom();
  if (overkillRoom) overkillRoom.overkillDamage = (overkillRoom.overkillDamage || 0) + eff;
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
// R0.4 chunk 1 — nextEnemyId is the first field migrated from scattered
// module-level state into the SimState shape defined in src/sim/simState.js.
// The simState instance is created with placeholder world dims and slot count;
// remaining fields (bullets, enemies, slot bodies, world.obstacles, etc.) will
// be migrated in subsequent versions following the map in src/sim/simState.js.
// R0.4 chunk 2 — bullet IDs (host counter) also routed through this state via
// setBulletIdState below; bulletIds.js reads/writes simState.nextBulletId.
let simState = createSimState({ seed: 1, worldW: 0, worldH: 0, slotCount: 1 });
setBulletIdState(simState);
// R0.4 chunk 9 — RNG state integration. Register simState to seededRng so
// simState.rngState becomes the live backing store for RNG state. Each
// simRng call reads/writes simState.rngState directly. On rollback restore,
// simState.rngState = snapshotValue flows into the registered state, and the
// next RNG call consumes it. Same singleton-ref pattern as bulletIds.js.
setRngState(simState);
// R0.4 chunk 3 — bridge score/kills/scoreBreakdown into simState.run for
// rollback serialization. The `let score`/`let kills` bindings stay the
// canonical runtime storage (so the ~25 read/write sites in script.js need
// zero changes); simState.run.score and simState.run.kills become accessor
// properties that forward through to those lets via getter/setter. On
// rollback restore, fields will be written field-by-field which fires the
// setters and propagates back into the let bindings — never replace simState
// itself, always mutate in place. scoreBreakdown is a never-reassigned object
// imported from gameState.js, so we just point simState.run.scoreBreakdown at
// the same reference; mutations on either side are visible to both.
Object.defineProperty(simState.run, 'score', {
  get() { return score; },
  set(v) { score = v; },
  enumerable: true,
  configurable: true,
});
Object.defineProperty(simState.run, 'kills', {
  get() { return kills; },
  set(v) { kills = v; },
  enumerable: true,
  configurable: true,
});
simState.run.scoreBreakdown = scoreBreakdown;
// R0.4 chunk 5 — bullets[] and enemies[] arrays. Both are imported from
// gameState.js and never reassigned (only mutated via push/splice/length=0).
// Identical handling to scoreBreakdown: point simState.bullets and
// simState.enemies at the same array refs so mutations on either side are
// visible to both. JSON.stringify(simState) and structuredClone(simState) will
// deep-copy the elements through these refs, which is what R1 serialize needs.
// Restore semantics: rollback writes back element-by-element using
// `simState.bullets.length = 0; simState.bullets.push(...snapshotBullets)`
// to preserve the shared identity — never reassign simState.bullets, that
// would orphan gameState.js's binding.
simState.bullets = bullets;
simState.enemies = enemies;
// R0.4 chunk 6 — slot 0 body + metrics scalars. Bridge simState.slots[0].body
// to the legacy `let player` (reassigned at run init via createInitialPlayerState),
// and simState.slots[0].metrics.{hp,maxHp,charge,fireT,stillTimer,prevStill}
// to the legacy module-level lets. Same getter/setter pattern as score/kills
// (chunk 3) and roomIndex (chunk 4). Player aim scalars also bridged for
// completeness — they're written from input/aim resolution every frame and
// must roll back. The existing playerSlots[0] abstraction (src/core/playerSlot.js)
// is a parallel surface that already getters into the same legacy lets — both
// surfaces stay in sync because they both delegate to the singleton storage.
Object.defineProperty(simState.slots[0], 'body', {
  get() { return player; },
  set(v) { player = v; },
  enumerable: true,
  configurable: true,
});
const _slot0Metrics = simState.slots[0].metrics;
Object.defineProperty(_slot0Metrics, 'hp', {
  get() { return hp; }, set(v) { hp = v; }, enumerable: true, configurable: true,
});
Object.defineProperty(_slot0Metrics, 'maxHp', {
  get() { return maxHp; }, set(v) { maxHp = v; }, enumerable: true, configurable: true,
});
Object.defineProperty(_slot0Metrics, 'charge', {
  get() { return charge; }, set(v) { charge = v; }, enumerable: true, configurable: true,
});
Object.defineProperty(_slot0Metrics, 'fireT', {
  get() { return fireT; }, set(v) { fireT = v; }, enumerable: true, configurable: true,
});
Object.defineProperty(_slot0Metrics, 'stillTimer', {
  get() { return stillTimer; }, set(v) { stillTimer = v; }, enumerable: true, configurable: true,
});
Object.defineProperty(_slot0Metrics, 'prevStill', {
  get() { return prevStill; }, set(v) { prevStill = v; }, enumerable: true, configurable: true,
});
Object.defineProperty(_slot0Metrics, 'aimAngle', {
  get() { return playerAimAngle; }, set(v) { playerAimAngle = v; }, enumerable: true, configurable: true,
});
Object.defineProperty(_slot0Metrics, 'aimHasTarget', {
  get() { return playerAimHasTarget; }, set(v) { playerAimHasTarget = v; }, enumerable: true, configurable: true,
});
// R0.4 chunk 7 — UPG (upgrade/boon state). Bridge simState.slots[0].upg to
// the legacy `let UPG` at line 528, which is reassigned at resetUpgrades() but
// otherwise mutated in place. Setter fires when rollback restores from snapshot,
// propagating back into the let binding. Same getter/setter pattern as player/body.
Object.defineProperty(simState.slots[0], 'upg', {
  get() { return UPG; },
  set(v) { UPG = v; },
  enumerable: true,
  configurable: true,
});
// R0.4 chunk 8 — world.obstacles. Bridge simState.world.obstacles to the
// legacy `let roomObstacles` at line 1197, which is reassigned on room
// transitions (line 3722) but otherwise mutated via splice/push. Getter/setter
// allows rollback to rewind the list (and the room boundary it represents) in
// place. Same pattern as UPG and player/body.
// R0.4 chunk 10 — legendary tracking conversion from Map/Set to plain arrays/objects.
// legendaryRejectedIds (was Set) → simState.run.legendaryRejectedIds (array).
// legendaryRoomsSinceReject (was Map) → simState.run.legendaryRoomsSinceReject (plain object dict).
// Both are modified at boon-pick time and read during legendary checks. Use bridge
// pattern so code can continue using the legacy lets without churn.
Object.defineProperty(simState.run, 'legendaryRejectedIds', {
  get() { return legendaryRejectedIds; },
  set(v) { legendaryRejectedIds = v; },
  enumerable: true,
  configurable: true,
});
Object.defineProperty(simState.run, 'legendaryRoomsSinceReject', {
  get() { return legendaryRoomsSinceReject; },
  set(v) { legendaryRoomsSinceReject = v; },
  enumerable: true,
  configurable: true,
});
let playerName = 'RUNNER';
let leaderboard = [];
let lbPeriod = 'daily';
let lbScope = 'everyone';
const lbSync = createLeaderboardSyncState();
let raf=0, lastT=0;
// Simulation clock — advances by accumulated dt inside the main loop.
// All SIM-CRITICAL timers (projectile expireAt, decay windows, death
// sequence, boon durations, cooldowns, kill-streak deadlines) read
// this, NOT performance.now(). Keeps sim advancement independent of
// wall-clock, which is what lockstep co-op will rely on. During pause
// the loop is cancelled so simNowMs naturally freezes, which means
// bullet timers don't need any offset-shifting on resume.
let simNowMs = 0;
// Phase D3: monotonic sim-tick counter. Increments once per fixed-step
// `update()` call. Used as the authoritative clientTick on guest input
// frames and (later in D4) as the host's snapshot sim-tick tag. Reset
// to 0 on every init()/restoreRun() so tick 0 always aligns with the
// run's first sim step.
let simTick = 0;
// Phase D3: coop input uplink handles. Guest: flushes quantized frames
// to host at batchSize intervals. Host: ingests guest frames into a
// ring buffer (consumed by slot-1 sim in D4). `null` in solo and
// COOP_DEBUG (role='local'). Teardown via dispose + unsubscribe on
// gameover / new run.
let coopInputSync = null;
let coopInputUnsubscribe = null;
// Phase D4: host-side snapshot broadcaster + runId/epoch tracking. The host
// generates a fresh runId at init()/restoreRun() (after resetBulletIds) and
// includes it in every emitted snapshot. Guests track the latest snapshot
// they've received per runId; when runId changes the guest resets its
// sequence-number tracker so post-dispose stale packets from a prior run
// can't contaminate the new one. `null` outside online coop runs.
let coopSnapshotBroadcaster = null;
let coopSnapshotSequencer = null;
let currentRunId = null;
const coopEnemyDamageEvents = [];
const coopPickupEvents = [];
// Phase D4: guest stores newest received snapshot but does NOT yet render
// from it (D5 wires interpolation/prediction). Reset on runId change.
let latestRemoteSnapshot = null;
let latestRemoteSnapshotSeq = null;
// Phase D5c — wall-clock receive time of the latest snapshot. Used by the
// applier's interpolation buffer as the curr-snapshot timestamp on shift.
let latestRemoteSnapshotRecvAtMs = 0;
// D18.3 — disconnect watchdog. Guest only. If we've received at least one
// snapshot but then go silent for COOP_WATCHDOG_TIMEOUT_MS, the transport is
// dead; trip once, toast, and run unified teardown so the run doesn't sit
// frozen and leak listeners into the menu.
// D18.6 — bumped to 30s. The user only ever wants a "true" disconnect (lost
// internet for 30s+ or app closed) to bail. The watchdog is also gated off
// during boon-phase / upgrade gstate, where the host intentionally cancels
// its RAF loop and stops emitting snapshots until both peers pick.
const COOP_WATCHDOG_TIMEOUT_MS = 30000;
let coopWatchdogTripped = false;
// D18.6 — guest-only local map: per-bullet decayStart (in simNowMs frame)
// for grey-state pickups. The wire format omits decayStart, so without
// stamping it locally the bullet renderer's age math collapses to NaN and
// orbs sit at full alpha forever instead of fading out the way they do on
// host. Pruned per snapshot apply to bound memory.
const guestGreyDecayStartByBulletId = new Map();
// D18.6 — guest-only local fireT for animating each slot's fire-ready ring
// when fully charged. The wire format omits fireT to save bandwidth, so
// without ticking locally the ring stays empty on the guest screen even
// when its slot is fully charged. Reset to 0 when charge drops < 1.
const guestLocalFireTBySlotId = new Map();
// D18.11 — Coop disconnect resilience.
// Wall-clock of the most recent inbound gameplay packet (any kind:
// input/snapshot/heartbeat/boon/etc). 0 outside a live coop run; the
// liveness check is gated on activeCoopSession so solo/canary paths are
// inert. Soft pause shows an overlay + freezes sim stepping; hard pause
// trips unified teardown. Heartbeat decouples liveness from gameplay
// activity so a slow-boon-picker doesn't false-trip the watchdog.
let coopLastInboundAtMs = 0;
let coopSoftDisconnectActive = false;
let coopSoftDisconnectShownAtMs = 0;
let coopHardDisconnectTripped = false;
let coopHeartbeatTimer = null;
let coopVisibilityListenersInstalled = false;
let coopByeSentForHidden = false;
let coopHiddenAtMs = 0;
const COOP_SOFT_DISCONNECT_MS = 7000;
const COOP_HARD_DISCONNECT_MS = 30000;
const COOP_HEARTBEAT_INTERVAL_MS = 2500;
const ONLINE_COOP_ENEMY_HP_MULT = 2;

// D18.7 — partner color sync. Each peer broadcasts its chosen color key
// once on coop run start (and again on local color change) via a
// 'coop-color' gameplay message. The other peer stores it here, and
// drawGuestSlots passes the corresponding scheme to drawGhostSprite so
// the partner ghost renders in the partner's chosen color. `null` outside
// coop or before the partner's first message arrives → falls back to the
// local C palette (legacy behavior). Reset by teardownCoopRunFully.
let coopPartnerColorKey = null;
let coopLocalColorAnnounced = false;
// D18.14 — same idea as coopPartnerColorKey but for the partner's chosen
// hat (HAT_OPTIONS key, or 'none'). drawGuestSlots reads this each frame
// to render the partner with their cosmetic. Reset by teardownCoopRunFully.
let coopPartnerHatKey = null;
let coopLocalHatAnnounced = false;
// Phase D4.5: host-side processor that tracks the highest sim-tick for
// which the host has actually consumed a remote-input frame (for slot 1).
// `null` outside online host runs. Powers `lastProcessedInputSeq[1]` on
// snapshots and trims the remote-input ring buffer to bound memory.
let hostRemoteInputProcessor = null;
let onlineHostSlot1Installed = false;
// Phase D5b — guest-side snapshot applier + slot 1 install.
let guestSnapshotApplier = null;
let onlineGuestSlot1Installed = false;
// D19.1 — guest-side bullet local-advance pool. Maintains a separate pool
// of `output`/`danger` bullets that's stepped forward each frame at host's
// 60 Hz cadence (matching the body's predicted clock), then reconciled
// against snapshots once per shift. `grey` and other states stay on the
// applier's snapshot-lerp path. Null outside online guest runs.
let guestBulletLocalAdvance = null;
let lastBulletReconciledSnapshotSeq = null;

function queueCoopEnemyDamageEvent(ev) {
  if (!activeCoopSession || !isCoopHost()) return;
  if (!ev || !Number.isFinite(ev.damage) || ev.damage <= 0) return;
  coopEnemyDamageEvents.push({
    enemyId: (ev.enemyId ?? 0) | 0,
    damage: ev.damage,
    x: ev.x ?? 0,
    y: ev.y ?? 0,
    ownerSlot: (ev.ownerSlot ?? 0) | 0,
  });
}

function queueCoopPickupEvent(ev) {
  if (!activeCoopSession || !isCoopHost()) return;
  if (!ev || !Number.isFinite(ev.x) || !Number.isFinite(ev.y)) return;
  coopPickupEvents.push({
    slotId: (ev.slotId ?? ev.slotIdx ?? 0) | 0,
    x: ev.x,
    y: ev.y,
    kind: ev.kind || 'grey',
  });
}

function getCoopPlayerColorForSlot(slotId) {
  const localSlot = getLocalSlotIndex();
  if (Number.isFinite(slotId) && ((slotId | 0) === (localSlot | 0))) {
    return getPlayerColorScheme().hex;
  }
  if (coopPartnerColorKey) {
    return getColorSchemeForKey(coopPartnerColorKey)?.hex || getPlayerColorScheme().hex;
  }
  return getPlayerColorScheme().hex;
}
// D19.3 — host-side grey-pickup lag compensation. Records each grey bullet's
// recent positions per sim tick on the host. When a non-host slot's pickup
// check runs, the host augments the current-position overlap test with a
// historical-position overlap test (~6 ticks back, ~100 ms) so guest's
// snapshot-delayed view of the grey lines up with where it counted as
// "touched." Null on solo and on guest devices.
let hostGreyLagComp = null;
// D19.4 — guest-side bullet spawn detector. Tracks every bullet id observed
// in a snapshot so we can pop a small muzzle flash the first time a given
// id appears (host shots, enemy shots, charge orbs). Without this, bullets
// teleport into existence at their ~70 ms snapshot-delayed position with no
// spawn cue, looking like they came out of thin air. Null on solo and host.
let guestBulletSpawnDetector = null;
// Phase D5e — guest-side prediction reconciler. Records local input frames
// per tick and replays them from authoritative state to compute drift
// corrections. Null outside online guest runs. Plus a tracker for the
// last snapshot seq we already reconciled against (don't double-correct
// the same snapshot at 60 Hz against a 10 Hz feed).
let guestPredictionReconciler = null;
let lastReconciledSnapshotSeq = null;
// Phase D5e — correction thresholds. HARD_SNAP: error magnitude (px) above
// which we instantly teleport the predicted body to the corrected position
// (massive desync, prediction is unrecoverable). SOFT_DEAD_ZONE: errors
// below this are ignored (small numerical noise). SOFT_FACTOR: fraction of
// error closed per snapshot inside the soft band (10 Hz cadence → ~3-5
// snapshots to fully converge on a typical drift).
//
// D18.16 — widened the dead-zone substantially. The reconciler's replay
// is collision-free Euler (no obstacle resolves), but the predicted body
// IS resolved against obstacles every tick. When the player walks into a
// wall, replay says "you should be 30 px past the wall" while the body
// is clamped at the wall edge — a tight 1.5 px dead-zone made the soft
// pull jam the body into the wall every snapshot, producing visible
// vibration / "sloppy" feel. 10 px dead-zone is invisible to players,
// kills wall-wedge tug-of-war, and still corrects real drift inside ~5
// snapshots. Soft factor reduced from 0.35 to 0.18 so the pull is half
// as aggressive — the body slides smoothly to truth instead of snapping.
const RECONCILE_HARD_SNAP_PX = 96;
const RECONCILE_SOFT_DEAD_ZONE_PX = 10;
const RECONCILE_SOFT_FACTOR = 0.18;
// D18.16 — track whether the last prediction tick was collision-clamped.
// updateOnlineGuestPrediction sets this when actual travel < 60% of
// expected; the reconciler skips the soft pull while true so we don't
// yank the body into the obstacle the host's replay didn't see.
let lastGuestPredictionWedged = false;
// Fixed-step accumulator (Phase C1b). Sim runs at a deterministic
// 60 Hz cadence regardless of display refresh rate. On fast displays
// we may run 0-1 sim steps per rAF; on slow displays we catch up by
// running multiple steps, bounded by MAX_SIM_STEPS_PER_FRAME to avoid
// spiral-of-death on background-throttled tabs. Remaining accumulator
// is discarded when we hit the cap — the next frame starts fresh.
const SIM_STEP_MS = 1000 / 60;
const SIM_STEP_SEC = SIM_STEP_MS / 1000;
const MAX_SIM_STEPS_PER_FRAME = 5;
const MAX_FRAME_DT_MS = 250;
let simAccumulatorMs = 0;
let startGhostPreviewRaf = 0;
let gameOverShown = false;
let boonRerolls = 1;
// D18.12 — guest's own reroll counter (online coop only). Tracked separately
// from `boonRerolls` because the host's run state is authoritative for slot
// 0; the guest manages slot 1's reroll economy locally. Reset to 1 on each
// fresh coop run start (see installOnlineCoopGuestSlot1 / coop teardown).
let guestBoonRerolls = 1;
let damagelessRooms = 0;
let tookDamageThisRoom = false;
let lastStallSpawnAt = -99999;
// R0.4 step 1.5 — slot timers now live in simState.slots[0].timers (the
// rollback-canonical location). The previous closure lets were aliased
// here as a transition step; this commit removes them entirely. All
// reads/writes go through slot0Timers, which is a thin getter/setter
// proxy onto simState.slots[0].timers so existing call sites keep
// working unchanged. Identity of the underlying timers object is
// preserved across resetSimState/restoreState (R0.4 step 1), so the
// proxy always reads the current canonical value.
let _orbFireTimers = [];
let _orbCooldown = [];
let boonHistory = [];
let pendingLegendary = null;
let legendaryOffered = false;
let legendaryRejectedIds = []; // R0.5 — converted from Set to array for determinism (no iteration-order ambiguity)
let legendaryRoomsSinceRejection = {}; // R0.5 — converted from Map to plain object dict

// Room system
let roomIndex = 0;
let roomPhase = 'intro';
let roomTimer = 0;
// R0.4 chunk 4 — bridge roomIndex/roomPhase/roomTimer into simState.run via
// the same getter/setter pattern established in chunk 3 (score/kills). The
// `let` bindings stay canonical storage so the ~88 bare-identifier read/write
// sites across script.js need no churn; rollback serialize reads the values
// off simState.run, restore writes through the setter back into the let.
Object.defineProperty(simState.run, 'roomIndex', {
  get() { return roomIndex; },
  set(v) { roomIndex = v; },
  enumerable: true,
  configurable: true,
});
Object.defineProperty(simState.run, 'roomPhase', {
  get() { return roomPhase; },
  set(v) { roomPhase = v; },
  enumerable: true,
  configurable: true,
});
Object.defineProperty(simState.run, 'roomTimer', {
  get() { return roomTimer; },
  set(v) { roomTimer = v; },
  enumerable: true,
  configurable: true,
});
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

// R3 rollback combat resim mutates these run-scope fields through simState.
// Bridge them to the legacy lets so restoreState()/hostSimStep corrections
// are visible to the live game loop after a rollback.
Object.defineProperty(simState.run, 'runElapsedMs', {
  get() { return runElapsedMs; },
  set(v) { runElapsedMs = v; },
  enumerable: true,
  configurable: true,
});
Object.defineProperty(simState.run, 'gameOverShown', {
  get() { return gameOverShown; },
  set(v) { gameOverShown = v; },
  enumerable: true,
  configurable: true,
});
Object.defineProperty(simState.run, 'boonRerolls', {
  get() { return boonRerolls; },
  set(v) { boonRerolls = v; },
  enumerable: true,
  configurable: true,
});
Object.defineProperty(simState.run, 'damagelessRooms', {
  get() { return damagelessRooms; },
  set(v) { damagelessRooms = v; },
  enumerable: true,
  configurable: true,
});
Object.defineProperty(simState.run, 'tookDamageThisRoom', {
  get() { return tookDamageThisRoom; },
  set(v) { tookDamageThisRoom = !!v; },
  enumerable: true,
  configurable: true,
});
Object.defineProperty(simState.run, 'lastStallSpawnAt', {
  get() { return lastStallSpawnAt; },
  set(v) { lastStallSpawnAt = v; },
  enumerable: true,
  configurable: true,
});
Object.defineProperty(simState.run, 'bossClears', {
  get() { return bossClears; },
  set(v) { bossClears = v; },
  enumerable: true,
  configurable: true,
});

// ── PLAYER SLOT 0 BRIDGE (Phase C2a) ─────────────────────────────────────────
// Slot 0 = host. For solo play and pre-C2b callsites, everything still reads
// the legacy singletons (`player`, `UPG`, `score`, `slot0Timers.slipCooldown`, ...). The
// slot exposes LIVE getters/setters so future slot-aware code can route
// through `slot.metrics.score` etc. without forcing a big-bang refactor.
// When C2b migrates callsites slot-by-slot, this bridge keeps solo working.
const slot0Metrics = Object.freeze({
  get score() { return score; }, set score(v) { score = v; },
  get kills() { return kills; }, set kills(v) { kills = v; },
  get charge() { return charge; }, set charge(v) { charge = v; },
  get fireT() { return fireT; }, set fireT(v) { fireT = v; },
  get stillTimer() { return stillTimer; }, set stillTimer(v) { stillTimer = v; },
  get prevStill() { return prevStill; }, set prevStill(v) { prevStill = v; },
  get hp() { return hp; }, set hp(v) { hp = v; },
  get maxHp() { return maxHp; }, set maxHp(v) { maxHp = v; },
});
const slot0Timers = Object.freeze({
  get barrierPulseTimer() { return simState.slots[0].timers.barrierPulseTimer; }, set barrierPulseTimer(v) { simState.slots[0].timers.barrierPulseTimer = v; },
  get slipCooldown() { return simState.slots[0].timers.slipCooldown; }, set slipCooldown(v) { simState.slots[0].timers.slipCooldown = v; },
  get absorbComboCount() { return simState.slots[0].timers.absorbComboCount; }, set absorbComboCount(v) { simState.slots[0].timers.absorbComboCount = v; },
  get absorbComboTimer() { return simState.slots[0].timers.absorbComboTimer; }, set absorbComboTimer(v) { simState.slots[0].timers.absorbComboTimer = v; },
  get chainMagnetTimer() { return simState.slots[0].timers.chainMagnetTimer; }, set chainMagnetTimer(v) { simState.slots[0].timers.chainMagnetTimer = v; },
  get echoCounter() { return simState.slots[0].timers.echoCounter; }, set echoCounter(v) { simState.slots[0].timers.echoCounter = v; },
  get vampiricRestoresThisRoom() { return simState.slots[0].timers.vampiricRestoresThisRoom; }, set vampiricRestoresThisRoom(v) { simState.slots[0].timers.vampiricRestoresThisRoom = v; },
  get killSustainHealedThisRoom() { return simState.slots[0].timers.killSustainHealedThisRoom; }, set killSustainHealedThisRoom(v) { simState.slots[0].timers.killSustainHealedThisRoom = v; },
  get colossusShockwaveCd() { return simState.slots[0].timers.colossusShockwaveCd; }, set colossusShockwaveCd(v) { simState.slots[0].timers.colossusShockwaveCd = v; },
  get volatileOrbGlobalCooldown() { return simState.slots[0].timers.volatileOrbGlobalCooldown; }, set volatileOrbGlobalCooldown(v) { simState.slots[0].timers.volatileOrbGlobalCooldown = v; },
});
const slot0Aim = Object.freeze({
  get angle() { return playerAimAngle; }, set angle(v) { playerAimAngle = v; },
  get hasTarget() { return playerAimHasTarget; }, set hasTarget(v) { playerAimHasTarget = v; },
});
function installPlayerSlot0() {
  resetPlayerSlots();
  registerPlayerSlot(createPlayerSlot({
    id: 0,
    getBody: () => player,
    getUpg: () => UPG,
    metrics: slot0Metrics,
    timers: slot0Timers,
    aim: slot0Aim,
    input: createHostInputAdapter(joy),
  }));
  if (COOP_DEBUG) installGuestDebugSlot();
}

// ── COOP DEBUG SLOT 1 (Phase C2c, dev-only) ──────────────────────────────────
// `?coopdebug=1` spins up a second visible player slot controlled by the
// arrow keys. It exists ONLY so multi-slot rendering/movement/scoring can be
// validated without also bringing up the full Supabase transport. It is
// never exposed in the UI and must be removed once real online co-op ships.
const COOP_DEBUG = (typeof window !== 'undefined' && window.location)
  ? new URLSearchParams(window.location.search).get('coopdebug') === '1'
  : false;
// D12.3 — `?coopdiag=1` enables verbose periodic logging of the input/snapshot
// chain so we can pinpoint where slot-1 movement breaks down. No gameplay
// effect; safe to leave shipped (it just no-ops when the flag is absent).
const COOP_DIAG = (typeof window !== 'undefined' && window.location)
  ? new URLSearchParams(window.location.search).get('coopdiag') === '1'
  : false;
// R3 — `?rollback=1` enables rollback netcode coordinator (experimental).
// Currently runs in parallel with D-series snapshot path.
// Once R0.4 (simStep carving) is complete, this will be the primary path.
const ROLLBACK_ENABLED = (typeof window !== 'undefined' && window.location)
  ? new URLSearchParams(window.location.search).get('rollback') === '1'
  : false;
let coopDiagInterval = null;
const guestKeyState = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
let _guestKeysBound = false;
function bindGuestKeys() {
  if (_guestKeysBound || typeof document === 'undefined') return;
  _guestKeysBound = true;
  document.addEventListener('keydown', (e) => {
    if (!(e.key in guestKeyState)) return;
    guestKeyState[e.key] = true;
    e.preventDefault();
  });
  document.addEventListener('keyup', (e) => {
    if (!(e.key in guestKeyState)) return;
    guestKeyState[e.key] = false;
    e.preventDefault();
  });
}
function installGuestDebugSlot() {
  if (!COOP_DEBUG) return;
  bindGuestKeys();
  const body = createInitialPlayerState(WORLD_W, WORLD_H);
  body.x = Math.min(WORLD_W - 24, body.x + 60);
  body.invincible = 1.5; // brief spawn-in invuln; drops after that so C2d-1b damage applies
  body.distort = 0;
  body.spawnX = body.x;
  body.spawnY = body.y;
  const upg = getDefaultUpgrades();
  const metrics = { score: 0, kills: 0, charge: 0, fireT: 0, stillTimer: 0, prevStill: false, hp: BASE_PLAYER_HP, maxHp: BASE_PLAYER_HP };
  const timers = {
    barrierPulseTimer: 0, slipCooldown: 0, absorbComboCount: 0, absorbComboTimer: 0,
    chainMagnetTimer: 0, echoCounter: 0, vampiricRestoresThisRoom: 0,
    killSustainHealedThisRoom: 0, colossusShockwaveCd: 0, volatileOrbGlobalCooldown: 0,
  };
  const aim = { angle: -Math.PI * 0.5, hasTarget: false };
  registerPlayerSlot(createPlayerSlot({
    id: 1,
    getBody: () => body,
    getUpg: () => upg,
    metrics, timers, aim,
    input: createArrowKeysInputAdapter(guestKeyState),
  }));
  try { console.info('[coopdebug] guest slot 1 spawned. Arrow keys to move.'); } catch (_) {}
}

// ── PHASE D3: GUEST→HOST INPUT UPLINK ────────────────────────────────────────
// Wires `createCoopInputSync` to the active coop session. Idempotent: safe to
// call multiple times (tears down any prior instance first). Bails cleanly
// for solo, COOP_DEBUG same-device (role='local'), and coop runs without a
// live session (should not happen in practice; guarded for tests).
//
// Host: registers an onGameplay listener that forwards {kind:'input'} payloads
//       into the ring buffer. Slot-1 sim in D4 will drain the buffer.
// Guest: starts batching local input frames each sim tick via sampleFrame,
//        flushing to host over session.sendGameplay. Guest's sampleFrame call
//        lives in update() — see `isCoopGuest` branch. Uses the same
//        createHostInputAdapter(joy) instance slot 0 uses, because on guest
//        the joystick IS the player-1 input.
function teardownCoopInputUplink() {
  stopCoopDiagnostics();
  if (coopInputUnsubscribe) {
    try { coopInputUnsubscribe(); } catch (_) {}
    coopInputUnsubscribe = null;
  }
  if (coopInputSync) {
    try { coopInputSync.dispose(); } catch (_) {}
    coopInputSync = null;
  }
  // R3 — tear down rollback coordinator
  try { teardownRollback(); } catch (_) {}
  if (coopSnapshotBroadcaster) {
    try { coopSnapshotBroadcaster.dispose(); } catch (_) {}
    coopSnapshotBroadcaster = null;
  }
  coopSnapshotSequencer = null;
  latestRemoteSnapshot = null;
  latestRemoteSnapshotSeq = null;
  latestRemoteSnapshotRecvAtMs = 0;
  coopEnemyDamageEvents.length = 0;
  coopPickupEvents.length = 0;
  // Phase D4.5: tear down host-side slot 1 + processor.
  hostRemoteInputProcessor = null;
  if (onlineHostSlot1Installed) {
    // Slot 1 was installed by us (online host). Remove it. Slot 0 is left
    // intact — installPlayerSlot0 owns its lifecycle. We just delete the
    // index-1 entry so playerSlots no longer iterates a dead body.
    try { delete playerSlots[1]; } catch (_) {}
    onlineHostSlot1Installed = false;
  }
  // Phase D5b: tear down guest-side slot 1 + applier.
  guestSnapshotApplier = null;
  // D19.1: tear down bullet local-advance pool + seq tracker.
  if (guestBulletLocalAdvance) {
    try { guestBulletLocalAdvance.clear(); } catch (_) {}
  }
  guestBulletLocalAdvance = null;
  lastBulletReconciledSnapshotSeq = null;
  // D19.4: tear down guest spawn detector.
  if (guestBulletSpawnDetector) {
    try { guestBulletSpawnDetector.clear(); } catch (_) {}
  }
  guestBulletSpawnDetector = null;
  // D19.3: tear down host grey lag-comp tracker.
  if (hostGreyLagComp) {
    try { hostGreyLagComp.clear(); } catch (_) {}
  }
  hostGreyLagComp = null;
  // Phase D5e: tear down reconciler + correction tracker.
  guestPredictionReconciler = null;
  lastReconciledSnapshotSeq = null;
  if (onlineGuestSlot1Installed) {
    try { delete playerSlots[1]; } catch (_) {}
    onlineGuestSlot1Installed = false;
  }
  // Phase D10: drop session ref + boon-phase state + guest overlay.
  activeCoopSession = null;
  onlineCoopBoonPhase = null;
  hideCoopGuestWaitOverlay();
  // D18.11 — stop heartbeat + clear disconnect state. Visibility listeners
  // stay installed (one-shot at module load level via installCoopVisibilityListeners)
  // since they self-gate on `activeCoopSession` being non-null.
  try { stopCoopHeartbeat(); } catch (_) {}
  coopLastInboundAtMs = 0;
  coopSoftDisconnectActive = false;
  coopSoftDisconnectShownAtMs = 0;
  coopHardDisconnectTripped = false;
  coopByeSentForHidden = false;
  coopHiddenAtMs = 0;
  // D12.1 — release the world pin so a subsequent solo run resizes
  // its sim world from the local canvas again.
  if (coopWorldPinned) {
    coopWorldPinned = false;
    try { syncWorldFromCanvas(); } catch (_) {}
  }
}

// D18.3 — Unified coop teardown. Always-safe to call from any exit path
// (game-over, leaveCoopGame, pause→menu, watchdog trip, transport error,
// defensive start-screen entry). Idempotent: every step is null-guarded so
// double-calls are no-ops. Centralizing here prevents the "menu can't
// start solo without an app restart" leak class — historically each exit
// path cleaned up a different subset of state and one missing dispose
// would zombify the next solo run.
function teardownCoopRunFully(reason) {
  try { if (reason) console.info('[coop] teardown:', reason); } catch (_) {}
  // Rematch listener + session refs (post-game lobby state).
  try { disposeCoopRematchSession(); } catch (_) {}
  // Active coop run (uplink / applier / broadcaster / slot 1 / world pin /
  // wait overlay / boon-phase). teardownCoopInputUplink is already
  // idempotent and handles the bulk of the live-run state.
  try { teardownCoopInputUplink(); } catch (_) {}
  // AFK timer + boon-phase tracking that lives outside teardownCoopInputUplink.
  if (coopBoonAfkTimer) {
    try { clearTimeout(coopBoonAfkTimer); } catch (_) {}
    coopBoonAfkTimer = null;
  }
  currentBoonPhaseId = null;
  pendingCoopBoonPicks = { hostDone: false, guestDone: false };
  try { coopBoonPickBuffer.clear(); } catch (_) {}
  // Coop run-state module (consumePendingCoopRun guards isCoopRun()).
  try { clearCoopRun(); } catch (_) {}
  // Reset watchdog so a future run starts clean.
  coopWatchdogTripped = false;
  latestRemoteSnapshotRecvAtMs = 0;
  // D18.6 — clear guest-only render-side maps so a future run starts fresh.
  try { guestGreyDecayStartByBulletId.clear(); } catch (_) {}
  try { guestLocalFireTBySlotId.clear(); } catch (_) {}
  // D18.7 — clear partner color so the next coop run re-handshakes.
  coopPartnerColorKey = null;
  coopLocalColorAnnounced = false;
  // D18.14 — same for partner hat key.
  coopPartnerHatKey = null;
  coopLocalHatAnnounced = false;
  // Hide coop-only UI overlays.
  try { hideCoopGuestWaitOverlay(); } catch (_) {}
}

// D18.3 — fire once when guest's transport goes silent. Shows a brief
// banner via the wait overlay (already a fullscreen-friendly element),
// runs unified teardown, and returns the user to the start screen.
function tripCoopDisconnectWatchdog() {
  if (coopWatchdogTripped) return;
  coopWatchdogTripped = true;
  try { console.warn('[coop] disconnect watchdog tripped'); } catch (_) {}
  try { showCoopGuestWaitOverlay('CONNECTION LOST · returning to menu'); } catch (_) {}
  // Auto-dismiss the overlay + run teardown after a short visible delay so
  // the user reads the message rather than seeing the menu blink in.
  setTimeout(() => {
    try { hideCoopGuestWaitOverlay(); } catch (_) {}
    try { cancelAnimationFrame(raf); } catch (_) {}
    teardownCoopRunFully('disconnect-watchdog');
    gstate = 'start';
    try { setMenuChromeVisible(true); } catch (_) {}
    try { document.getElementById('s-start')?.classList.remove('off'); } catch (_) {}
    try { document.getElementById('s-up')?.classList.add('off'); } catch (_) {}
    try { document.getElementById('s-go')?.classList.add('off'); } catch (_) {}
    try { document.getElementById('s-go-coop')?.classList.add('off'); } catch (_) {}
    try { document.getElementById('s-coop-lobby')?.classList.add('off'); } catch (_) {}
    try { btnPause.style.display = 'none'; } catch (_) {}
    try { btnPatchNotes.style.display = 'inline-flex'; } catch (_) {}
  }, 1200);
}

// D18.11 — Coop disconnect monitor. Symmetric on host + guest. Gated on
// `activeCoopSession` so solo / canary runs are inert (no listeners, no
// liveness ticking). Called once per RAF from the main loop *before* sim
// stepping; soft state freezes sim updates without cancelling RAF (keeps
// recovery + hard-trip checks alive). Resets on teardown.
function stampCoopInboundActivity() {
  try {
    const now = (typeof performance !== 'undefined' && performance.now)
      ? performance.now() : Date.now();
    coopLastInboundAtMs = now;
  } catch (_) {}
  // Any inbound activity recovers from soft pause.
  if (coopSoftDisconnectActive) recoverCoopSoftDisconnect();
}

function showCoopDisconnectOverlay(text) {
  try { showCoopGuestWaitOverlay(text || 'PARTNER DISCONNECTED · waiting…'); } catch (_) {}
}

function tripCoopSoftDisconnect() {
  if (coopSoftDisconnectActive) return;
  coopSoftDisconnectActive = true;
  try {
    coopSoftDisconnectShownAtMs = (typeof performance !== 'undefined' && performance.now)
      ? performance.now() : Date.now();
  } catch (_) { coopSoftDisconnectShownAtMs = Date.now(); }
  try { console.info('[coop] soft-disconnect: pausing sim, awaiting partner'); } catch (_) {}
  showCoopDisconnectOverlay('PARTNER DISCONNECTED · waiting for reconnect…');
}

function recoverCoopSoftDisconnect() {
  if (!coopSoftDisconnectActive) return;
  coopSoftDisconnectActive = false;
  coopSoftDisconnectShownAtMs = 0;
  // Drain any RAF time that accumulated while paused so the next sim step
  // doesn't fire a catch-up burst (which would jump entities and break
  // guest reconciliation).
  simAccumulatorMs = 0;
  // Only clear the overlay if it isn't being claimed by a higher-priority
  // boon-phase wait. Boon-phase entry/exit re-shows it as needed.
  if (currentBoonPhaseId === null && gstate !== 'upgrade') {
    try { hideCoopGuestWaitOverlay(); } catch (_) {}
  }
  try { console.info('[coop] soft-disconnect: recovered, resuming sim'); } catch (_) {}
}

function tripCoopHardDisconnect() {
  if (coopHardDisconnectTripped) return;
  coopHardDisconnectTripped = true;
  try { console.warn('[coop] hard-disconnect: ending run'); } catch (_) {}
  // Fall through to the existing watchdog teardown path. It already
  // cancels RAF, runs unified teardown, and returns to the start screen
  // with a CONNECTION LOST banner.
  try { tripCoopDisconnectWatchdog(); } catch (_) {}
}

function startCoopHeartbeat() {
  if (coopHeartbeatTimer) return;
  coopHeartbeatTimer = setInterval(() => {
    try {
      if (!activeCoopSession || typeof activeCoopSession.sendGameplay !== 'function') return;
      activeCoopSession.sendGameplay({ kind: 'coop-heartbeat' });
    } catch (_) {}
    // D18.11 — also run a freshness check on this independent timer so the
    // hard-disconnect path fires even when RAF is paused (boon-phase /
    // upgrade gstate cancels RAF). The main-loop gate handles soft pause
    // visualization while RAF is live; this catch-up handles boon-phase.
    try {
      if (!activeCoopSession || coopHardDisconnectTripped) return;
      if (coopLastInboundAtMs <= 0) return;
      const now = (typeof performance !== 'undefined' && performance.now)
        ? performance.now() : Date.now();
      const elapsed = now - coopLastInboundAtMs;
      if (elapsed >= COOP_HARD_DISCONNECT_MS) {
        tripCoopHardDisconnect();
      } else if (elapsed >= COOP_SOFT_DISCONNECT_MS && !coopSoftDisconnectActive) {
        // During boon-phase the wait overlay is already showing partner-pick
        // text. Replace it with the disconnect message so the user knows
        // why their partner has been silent. Boon flow's exit paths
        // (handleCoopRoomAdvanceGuest / tryResumeCoopBoonPhase / teardown)
        // will reset the overlay as needed.
        tripCoopSoftDisconnect();
      }
    } catch (_) {}
  }, COOP_HEARTBEAT_INTERVAL_MS);
}

function stopCoopHeartbeat() {
  if (!coopHeartbeatTimer) return;
  try { clearInterval(coopHeartbeatTimer); } catch (_) {}
  coopHeartbeatTimer = null;
}

function sendCoopBye() {
  try {
    if (!activeCoopSession || typeof activeCoopSession.sendGameplay !== 'function') return;
    activeCoopSession.sendGameplay({ kind: 'coop-bye' });
  } catch (_) {}
}

// Per-RAF liveness gate. Returns true if the local sim should be skipped
// this frame (soft-paused). Side-effects: trips soft / hard transitions.
function checkCoopLivenessGate(nowMs) {
  if (!activeCoopSession || coopHardDisconnectTripped) return coopSoftDisconnectActive;
  if (coopLastInboundAtMs <= 0) return false;
  const elapsed = nowMs - coopLastInboundAtMs;
  if (elapsed >= COOP_HARD_DISCONNECT_MS) {
    tripCoopHardDisconnect();
    return true;
  }
  if (elapsed >= COOP_SOFT_DISCONNECT_MS) {
    if (!coopSoftDisconnectActive) tripCoopSoftDisconnect();
    return true;
  }
  return false;
}

function installCoopVisibilityListeners() {
  if (coopVisibilityListenersInstalled) return;
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  coopVisibilityListenersInstalled = true;
  const onHidden = () => {
    if (!activeCoopSession) return;
    if (coopByeSentForHidden) return;
    coopByeSentForHidden = true;
    try {
      coopHiddenAtMs = (typeof performance !== 'undefined' && performance.now)
        ? performance.now() : Date.now();
    } catch (_) { coopHiddenAtMs = Date.now(); }
    // Best-effort accelerator only; partner still falls through to the
    // wall-clock soft/hard timers if this packet never lands (mobile
    // Safari often suspends JS before sendGameplay's async send fires).
    sendCoopBye();
  };
  const onVisible = () => {
    coopByeSentForHidden = false;
    if (!activeCoopSession) return;
    // If we were hidden longer than the hard timeout, we're definitely
    // beyond recovery — trip teardown immediately rather than racing the
    // watchdog. Else force a freshness re-check on the next loop tick by
    // letting the existing gate run; if elapsed already exceeds soft, the
    // overlay will appear right away.
    let elapsedHidden = 0;
    if (coopHiddenAtMs > 0) {
      try {
        const now = (typeof performance !== 'undefined' && performance.now)
          ? performance.now() : Date.now();
        elapsedHidden = now - coopHiddenAtMs;
      } catch (_) {}
    }
    coopHiddenAtMs = 0;
    if (elapsedHidden >= COOP_HARD_DISCONNECT_MS) {
      tripCoopHardDisconnect();
    }
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) onHidden(); else onVisible();
  });
  window.addEventListener('pagehide', onHidden);
  window.addEventListener('pageshow', onVisible);
}

// Phase D10 — multi-room boon handshake state. D14 (v1.20.46) overhauls
// this from team-boons (host picks for both) to per-peer picks: host picks
// for slot 0 from the full pool; guest picks for slot 1 from a slot-1-safe
// whitelist (boons whose effects are purely numeric mutations of slot.upg
// fields consumed by firePlayer / collisions, not global hooks). Both peers
// apply each pick locally to keep slot UPGs in sync. Resume gates on both
// picks complete OR an AFK timeout (host auto-resolves slot 1).
let activeCoopSession = null;
let onlineCoopBoonPhase = null;
let coopGuestWaitOverlayEl = null;

// D14 — per-phase pick tracking. phaseId is roomIndex at the moment the
// host enters the boon phase (room transitions are 1:1 with phases). Both
// peers tag every coop-boon-* message with phaseId so out-of-order or
// late-arriving picks from the previous phase are rejected.
let currentBoonPhaseId = null;
let pendingCoopBoonPicks = { hostDone: false, guestDone: false };
// Buffer for picks that arrive before this peer has entered the phase
// (e.g. host's own coop-boon-pick reaches a slow-network guest before that
// guest has processed coop-boon-start). Single-slot per slotId is enough
// because each peer picks once per phase.
const coopBoonPickBuffer = new Map(); // key: phaseId-slotId, val: payload
let coopBoonAfkTimer = null;
const COOP_BOON_AFK_TIMEOUT_MS = 30000;

function isOnlineCoopBoonPhaseActive() {
  return !!onlineCoopBoonPhase;
}

// D14 — slot-1-safe boon whitelist. These boons mutate ONLY slot.upg
// numeric fields that firePlayer / damage-application / charge math already
// read off slot.upg directly, so they work correctly when applied to slot 1
// in isolation. Anything that hooks global state (player.shields,
// slot0Timers.barrierPulseTimer, room-clear regen, kill-attribution, gravityWell2,
// titan/mini player size, mirror/burst shields, escalation, EMP, predator,
// blood pact, phase dash, mirror tide, etc.) is excluded from slot 1 in
// v1 — slot 1 still benefits from slot 0 picks of those (which run on
// host's player), it just can't directly choose them. A future per-slot
// boon-hook refactor (deferred) will expand this whitelist.
const SLOT1_SAFE_BOON_NAMES = new Set([
  'Rapid Fire', 'Ring Blast', 'Backshot', 'Snipe Shot', 'Twin Lance',
  'Bigger Bullets', 'Faster Bullets', 'Critical Hit',
  'Ricochet', 'Homing', 'Pierce',
  'Quick Harvest', 'Decay Extension', 'Capacity Boost', 'Deep Reserve',
  'Wider Absorb', 'Long Reach', 'Kinetic Harvest', 'Steady Aim',
  'Ghost Velocity', 'Extra Life',
]);

function getSlot1SafeBoonPool() {
  return BOONS.filter((b) => b && SLOT1_SAFE_BOON_NAMES.has(b.name));
}

// D14 — boon IDs are stable indices into the BOONS array. Names are NOT
// safe wire identifiers because at least one base name is duplicated
// (`Gravity Well` appears twice — see boonDefinitions.js). Index is stable
// across both peers when their bundle versions match (we already gate
// version mismatches at coop session handshake).
function boonIdFromBoon(boon) {
  if (!boon) return -1;
  // Evolved boons aren't in BOONS — their evolvesFrom base is. The pickers
  // pass base boons into onSelect; getEvolvedBoon is consulted at apply
  // time. So indexOf on BOONS is sufficient for the wire ID.
  return BOONS.indexOf(boon);
}

function boonFromId(id) {
  const i = id | 0;
  if (i < 0 || i >= BOONS.length) return null;
  return BOONS[i];
}

function showCoopGuestWaitOverlay(text) {
  try {
    if (typeof document === 'undefined' || !document.body) return;
    if (!coopGuestWaitOverlayEl) {
      const el = document.createElement('div');
      el.id = 'coop-wait-overlay';
      el.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.55);color:#fff;font:bold 22px system-ui,sans-serif;letter-spacing:0.08em;text-align:center;z-index:9000;pointer-events:none;text-shadow:0 0 12px rgba(0,0,0,0.85);padding:24px;';
      document.body.appendChild(el);
      coopGuestWaitOverlayEl = el;
    }
    coopGuestWaitOverlayEl.textContent = text || '';
    coopGuestWaitOverlayEl.style.display = 'flex';
  } catch (_) {}
}

function hideCoopGuestWaitOverlay() {
  try {
    if (coopGuestWaitOverlayEl) coopGuestWaitOverlayEl.style.display = 'none';
  } catch (_) {}
}

// Sync host's UPG into slot 1's UPG (legacy team-boon mirror). Kept for
// compatibility with the pre-D14 path on initial slot-1 install when no
// boons have been applied yet, but the per-room mirror call has been
// removed in resumePlayAfterBoons (D14 — slot 1 evolves independently).
function mirrorHostUpgToSlot1() {
  try {
    const slot1 = playerSlots[1];
    if (!slot1) return;
    const target = (typeof slot1.getUpg === 'function') ? slot1.getUpg() : slot1.upg;
    if (!target || typeof target !== 'object') return;
    const cloned = JSON.parse(JSON.stringify(UPG));
    for (const k of Object.keys(target)) delete target[k];
    Object.assign(target, cloned);
  } catch (err) {
    try { console.warn('[coop] mirror UPG to slot 1 failed', err); } catch (_) {}
  }
}

function copyObjectInPlace(target, source) {
  if (!target || !source || typeof target !== 'object' || typeof source !== 'object') return;
  for (const k of Object.keys(target)) delete target[k];
  Object.assign(target, source);
}

// R3.2 — rollback restores `simState.slots[1]`, while the D-series online
// slot wrapper exposes a frozen getter-only facade. Bridge slot 1 to the live
// online body/upg so rollback resim corrects the same object the renderer uses.
function ensureRollbackSlot1Bridge() {
  if (!ROLLBACK_ENABLED) return;
  const playerSlot = playerSlots[1];
  if (!playerSlot) return;
  while (simState.slots.length <= 1) {
    simState.slots.push(createSlot(simState.slots.length, BASE_PLAYER_HP));
  }
  const simSlot = simState.slots[1];
  if (!simSlot) return;
  if (!simSlot.__onlineCoopBridge) {
    let fallbackBody = playerSlot.body || createInitialPlayerState(WORLD_W, WORLD_H);
    let fallbackUpg = playerSlot.upg || getDefaultUpgrades();
    Object.defineProperty(simSlot, 'body', {
      configurable: true,
      enumerable: true,
      get() { return (playerSlots[1] && playerSlots[1].body) || fallbackBody; },
      set(value) {
        const live = playerSlots[1] && playerSlots[1].body;
        if (live && value && typeof value === 'object') Object.assign(live, value);
        else fallbackBody = value;
      },
    });
    Object.defineProperty(simSlot, 'upg', {
      configurable: true,
      enumerable: true,
      get() { return (playerSlots[1] && playerSlots[1].upg) || fallbackUpg; },
      set(value) {
        const live = playerSlots[1] && playerSlots[1].upg;
        if (live && value && typeof value === 'object') copyObjectInPlace(live, value);
        else fallbackUpg = value;
      },
    });
    simSlot.__onlineCoopBridge = true;
  }
  simSlot.metrics = playerSlot.metrics || simSlot.metrics;
  simSlot.timers = playerSlot.timers || simSlot.timers;
  simSlot.aim = playerSlot.aim || simSlot.aim;
  simSlot.shields = (playerSlot.body && playerSlot.body.shields) || simSlot.shields || [];
}

// D14 — pure helper: apply a base boon (by id) to the given slot's upg/hp,
// resolving any active evolution. Used on the receiving peer when the
// other peer broadcasts coop-boon-pick.
function applyBoonByIdToSlot(boon, slotIndex) {
  if (!boon) return;
  if (slotIndex === 0) {
    const state = { hp, maxHp };
    const evolved = getEvolvedBoon(boon, UPG);
    evolved.apply(UPG, state);
    syncRunChargeCapacity();
    hp = state.hp;
    maxHp = state.maxHp;
    try { (UPG.boonSelectionOrder = UPG.boonSelectionOrder || []).push(evolved.name); } catch (_) {}
    syncPlayerScale();
  } else {
    const slot = playerSlots[slotIndex];
    if (!slot) return;
    const state = { hp: slot.metrics.hp, maxHp: slot.metrics.maxHp };
    const evolved = getEvolvedBoon(boon, slot.upg);
    evolved.apply(slot.upg, state);
    slot.metrics.hp = state.hp;
    slot.metrics.maxHp = state.maxHp;
    try { (slot.upg.boonSelectionOrder = slot.upg.boonSelectionOrder || []).push(evolved.name); } catch (_) {}
  }
}

// D14 — broadcast our own pick to the other peer.
function sendCoopBoonPick(slotId, boonId, extra) {
  try {
    if (!activeCoopSession || typeof activeCoopSession.sendGameplay !== 'function') return;
    activeCoopSession.sendGameplay(
      Object.assign({ kind: 'coop-boon-pick', phaseId: currentBoonPhaseId, slotId, boonId }, extra || {})
    );
  } catch (err) {
    try { console.warn('[coop] coop-boon-pick send failed', err); } catch (_) {}
  }
}

// D18.7 — broadcast our local player-color key to the partner so their
// drawGuestSlots can render us in the right scheme. Idempotent: safe to
// call multiple times (e.g. on slot install + on every color change).
function sendCoopLocalColor() {
  try {
    if (!activeCoopSession || typeof activeCoopSession.sendGameplay !== 'function') return;
    const colorKey = getPlayerColor();
    if (!colorKey) return;
    activeCoopSession.sendGameplay({ kind: 'coop-color', colorKey });
    coopLocalColorAnnounced = true;
  } catch (err) {
    try { console.warn('[coop] coop-color send failed', err); } catch (_) {}
  }
}

// D18.14 — broadcast our local hat key to the partner so their
// drawGuestSlots can render us with the cosmetic. Idempotent: safe to
// call multiple times (slot install + on every hat change). Mirrors
// sendCoopLocalColor exactly.
function sendCoopLocalHat() {
  try {
    if (!activeCoopSession || typeof activeCoopSession.sendGameplay !== 'function') return;
    const hatKey = playerHat || 'none';
    activeCoopSession.sendGameplay({ kind: 'coop-hat', hatKey });
    coopLocalHatAnnounced = true;
  } catch (err) {
    try { console.warn('[coop] coop-hat send failed', err); } catch (_) {}
  }
}

// D14 — local callback fired from the picker UI's onSelect for online coop
// peers. Returns true when the caller should NOT call resumePlayAfterBoons
// directly (we'll resume after both picks land or AFK timeout fires).
function onLocalBoonPickedOnline(slotId, boon) {
  const isHost = isCoopHost && isCoopHost();
  const isGuest = isCoopGuest && isCoopGuest();
  if (!isHost && !isGuest) return false;
  if (currentBoonPhaseId == null) return false;
  const id = boonIdFromBoon(boon);
  if (id < 0) {
    // Local-only picks (e.g. the heal/Recover boon, which is created
    // dynamically and not in the BOONS array). Guest still needs to signal
    // done to the host so the phase can advance — send boonId=-1 sentinel
    // (host marks guestDone without applying any boon, since guest already
    // applied it locally). Host's own legendary-reject path also uses -1.
    if (isGuest) {
      pendingCoopBoonPicks.guestDone = true;
      // Ship the post-heal HP so host can sync slot1 before revivePartialHpSpectators
      // fires. Without this the host's slot1.metrics.hp stays 0, revive gives only
      // the 25% floor, and the next snapshot overwrites the locally-healed value.
      const slot1 = playerSlots[1];
      const resultHp = (slot1 && slot1.metrics) ? (slot1.metrics.hp | 0) : undefined;
      sendCoopBoonPick(1, -1, resultHp != null ? { resultHp } : undefined);
      showCoopGuestWaitOverlay('WAITING FOR HOST…');
      return true;
    }
    if (isHost) {
      // Host picked a dynamic/local-only boon (e.g. Recover heal). The boon
      // is applied locally by showUpgrades' onSelect before this is called;
      // nothing needs to be mirrored to the guest. Send the -1 sentinel so the
      // guest's handleCoopBoonPickIncoming marks hostDone and updates its wait
      // state, then wait for guestDone before advancing.
      pendingCoopBoonPicks.hostDone = true;
      sendCoopBoonPick(0, -1);
      if (!pendingCoopBoonPicks.guestDone) {
        try { showCoopGuestWaitOverlay('WAITING FOR PARTNER…'); } catch (_) {}
      }
      tryResumeCoopBoonPhase();
      return true;
    }
    return false;
  }
  if (isHost) {
    pendingCoopBoonPicks.hostDone = true;
    sendCoopBoonPick(0, id);
    // D18.8 — if guest hasn't picked yet, show a "WAITING FOR PARTNER…"
    // overlay on host so the screen doesn't appear frozen between picks.
    // Hidden by tryResumeCoopBoonPhase / handleCoopRoomAdvanceGuest /
    // teardown.
    if (!pendingCoopBoonPicks.guestDone) {
      try { showCoopGuestWaitOverlay('WAITING FOR PARTNER…'); } catch (_) {}
    }
    tryResumeCoopBoonPhase();
    return true;
  }
  // Guest:
  pendingCoopBoonPicks.guestDone = true;
  sendCoopBoonPick(1, id);
  showCoopGuestWaitOverlay('WAITING FOR HOST…');
  return true;
}

// D14 — host-side legendary picks don't ship over the wire (slot 1 has no
// legendaries v1) but the host still needs to gate room advance on guest's
// pick. Returns true when caller should NOT advance directly.
function markHostBoonDoneIfOnline() {
  if (!(isCoopHost && isCoopHost())) return false;
  if (currentBoonPhaseId == null) return false;
  pendingCoopBoonPicks.hostDone = true;
  // Notify guest that host picked (boonId=-1 means "host legendary, no
  // mirror needed"). Guest treats this as host-done only.
  try {
    if (activeCoopSession && typeof activeCoopSession.sendGameplay === 'function') {
      activeCoopSession.sendGameplay({
        kind: 'coop-boon-pick',
        phaseId: currentBoonPhaseId,
        slotId: 0,
        boonId: -1,
      });
    }
  } catch (_) {}
  tryResumeCoopBoonPhase();
  return true;
}

function tryResumeCoopBoonPhase() {
  if (!(isCoopHost && isCoopHost())) return;
  if (!pendingCoopBoonPicks.hostDone || !pendingCoopBoonPicks.guestDone) return;
  if (coopBoonAfkTimer) {
    try { clearTimeout(coopBoonAfkTimer); } catch (_) {}
    coopBoonAfkTimer = null;
  }
  // D18.8 — clear any "WAITING FOR PARTNER…" overlay shown on host.
  try { hideCoopGuestWaitOverlay(); } catch (_) {}
  resumePlayAfterBoons();
}

function enterOnlineCoopBoonPhaseHost() {
  onlineCoopBoonPhase = { roomIndex };
  currentBoonPhaseId = roomIndex | 0;
  pendingCoopBoonPicks = { hostDone: false, guestDone: false };
  // Compute slot-1 choices on host so both peers render the same list.
  // pickBoonChoices uses simRng which can drift between host and guest, so
  // shipping explicit ids over the wire is the safe play.
  let slot1BoonIds = [];
  try {
    const slot1 = playerSlots[1];
    if (slot1) {
      const safePool = getSlot1SafeBoonPool().filter((b) => {
        try { return !b.requires || b.requires(slot1.upg); } catch (_) { return false; }
      });
      // Random-shuffle the safe pool with simRng and take 3. We bypass
      // pickBoonChoices' tag-balancing because the whitelist is small and
      // the tag distribution is heavily skewed (mostly UTILITY/OFFENSE).
      const shuffled = safePool.slice();
      for (let i = shuffled.length - 1; i > 0; i--) {
        // R0.2 — was Math.random(); slot-1 boon roster must be deterministic
        // for rollback (host AND guest must produce the same shuffle).
        const j = (simRng.next() * (i + 1)) | 0;
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      slot1BoonIds = shuffled.slice(0, 3).map(boonIdFromBoon).filter((id) => id >= 0);
    }
  } catch (err) {
    try { console.warn('[coop] slot1 choice computation failed', err); } catch (_) {}
  }
  try {
    if (activeCoopSession && typeof activeCoopSession.sendGameplay === 'function') {
      activeCoopSession.sendGameplay({
        kind: 'coop-boon-start',
        roomIndex,
        phaseId: currentBoonPhaseId,
        slot1BoonIds,
      });
    }
  } catch (err) {
    try { console.warn('[coop] coop-boon-start send failed', err); } catch (_) {}
  }
  // AFK timeout: if guest hasn't picked after COOP_BOON_AFK_TIMEOUT_MS (D18.6:
  // 30s, was 60s), auto-resolve to a RANDOM choice from slot1BoonIds and apply
  // on host. Guest will see a coop-boon-pick echo when host applies + still
  // resume on coop-room-advance. A true network disconnect is handled by the
  // 30s watchdog; this AFK path is for "player just isn't paying attention"
  // and should never disconnect — the run continues with a random pick.
  if (slot1BoonIds.length > 0) {
    coopBoonAfkTimer = setTimeout(() => {
      if (pendingCoopBoonPicks.guestDone) return;
      // R0.2 — was Math.random(); auto-pick must be deterministic so a
      // recorded run replays through the same fallback boon at the same tick.
      const pickIdx = Math.floor(simRng.next() * slot1BoonIds.length);
      const fallbackId = slot1BoonIds[pickIdx];
      try { console.warn('[coop] guest AFK on boon pick — auto-resolving slot 1 with random pick', { pickIdx, fallbackId }); } catch (_) {}
      const boon = boonFromId(fallbackId);
      if (boon) applyBoonByIdToSlot(boon, 1);
      pendingCoopBoonPicks.guestDone = true;
      // Tell guest we picked for them (so its slot1.upg stays in sync).
      sendCoopBoonPick(1, fallbackId);
      tryResumeCoopBoonPhase();
    }, COOP_BOON_AFK_TIMEOUT_MS);
  }
  showUpgrades();
}

function handleCoopBoonStartGuest(payload) {
  const phaseId = (payload && payload.phaseId != null) ? (payload.phaseId | 0) : ((payload && payload.roomIndex) | 0);
  onlineCoopBoonPhase = { roomIndex: (payload && payload.roomIndex) | 0 };
  currentBoonPhaseId = phaseId;
  pendingCoopBoonPicks = { hostDone: false, guestDone: false };
  const slot1 = playerSlots[1];
  if (!slot1) {
    showCoopGuestWaitOverlay('PARTNER PICKING A BOON…');
    return;
  }
  // Resolve the choice list shipped from host.
  const ids = Array.isArray(payload && payload.slot1BoonIds) ? payload.slot1BoonIds : [];
  const choices = ids.map(boonFromId).filter(Boolean);
  if (choices.length === 0) {
    // Host couldn't compute a list (e.g. slot 1 missing or bug). Show wait
    // overlay; host will eventually broadcast coop-room-advance.
    showCoopGuestWaitOverlay('PARTNER PICKING A BOON…');
    return;
  }
  // Freeze guest sim to mirror host's pause — without this, guest's
  // predicted body keeps moving while the picker is open and snaps later.
  gstate = 'upgrade';
  try { cancelAnimationFrame(raf); } catch (_) {}
  try { hideCoopGuestWaitOverlay(); } catch (_) {}
  try {
    showBoonSelection({
      upg: slot1.upg,
      hp: slot1.metrics.hp,
      maxHp: slot1.metrics.maxHp,
      // D18.12 — give guest their own reroll button. onReroll returns a
      // freshly shuffled slot1-safe pool so the picker swaps in new
      // choices without round-tripping through the host. Host's pick
      // list (shipped via slot1BoonIds) is unrelated to guest's local
      // pool — guest's final pick is networked via coop-boon-pick.
      rerolls: guestBoonRerolls,
      onReroll: () => {
        if (guestBoonRerolls > 0) guestBoonRerolls--;
        try {
          const safePool = getSlot1SafeBoonPool().filter((b) => {
            try { return !b.requires || b.requires(slot1.upg); } catch (_) { return false; }
          });
          const shuffled = safePool.slice();
          for (let i = shuffled.length - 1; i > 0; i--) {
            // R0.2 — was Math.random(); guest reroll shuffle must be
            // deterministic for rollback parity.
            const j = (simRng.next() * (i + 1)) | 0;
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          return shuffled.slice(0, 3);
        } catch (err) {
          try { console.warn('[coop] guest reroll failed', err); } catch (_) {}
          return null;
        }
      },
      boonsOverride: choices,
      onSelect: (boon) => {
        try {
          const state = { hp: slot1.metrics.hp, maxHp: slot1.metrics.maxHp };
          const evolved = getEvolvedBoon(boon, slot1.upg);
          evolved.apply(slot1.upg, state);
          slot1.metrics.hp = state.hp;
          slot1.metrics.maxHp = state.maxHp;
          try { (slot1.upg.boonSelectionOrder = slot1.upg.boonSelectionOrder || []).push(evolved.name); } catch (_) {}
        } catch (err) {
          try { console.warn('[coop] guest boon apply failed', err); } catch (_) {}
        }
        document.getElementById('s-up').classList.add('off');
        onLocalBoonPickedOnline(1, boon);
      },
    });
  } catch (err) {
    try { console.warn('[coop] guest picker open failed', err); } catch (_) {}
    showCoopGuestWaitOverlay('PARTNER PICKING A BOON…');
  }
  // Drain any buffered picks from the host that arrived before us.
  drainBufferedCoopBoonPicks();
}

// D14 — handle a coop-boon-pick from the OTHER peer.
function handleCoopBoonPickIncoming(payload, role) {
  if (!payload) return;
  const phaseId = (payload.phaseId | 0);
  const slotId = (payload.slotId | 0);
  const boonId = (payload.boonId | 0);
  if (currentBoonPhaseId == null || phaseId !== currentBoonPhaseId) {
    // Either we haven't entered the phase yet (buffer it for drain) or
    // it's stale (drop). Use phaseId as the staleness gate: only buffer
    // if it's >= our currentBoonPhaseId or we have no phase yet.
    if (currentBoonPhaseId == null || phaseId > currentBoonPhaseId) {
      coopBoonPickBuffer.set(phaseId + ':' + slotId, payload);
    }
    return;
  }
  const boon = boonFromId(boonId);
  if (role === 'host' && slotId === 1) {
    if (boon) applyBoonByIdToSlot(boon, 1);
    // D20.3 — guest's local-only picks (e.g. Recover/heal) ship boonId=-1 plus
    // an optional resultHp field. Sync slot1 HP here so revivePartialHpSpectators
    // stacks on top of the heal instead of only applying the 25% floor.
    if (!boon && payload.resultHp != null) {
      try {
        const slot1 = playerSlots[1];
        if (slot1 && slot1.metrics) slot1.metrics.hp = Math.max(0, payload.resultHp | 0);
      } catch (_) {}
    }
    pendingCoopBoonPicks.guestDone = true;
    tryResumeCoopBoonPhase();
  } else if (role === 'guest' && slotId === 0) {
    // boonId=-1 sentinel = host-side legendary pick (no mirror). Otherwise
    // mirror normal slot-0 pick onto guest's local UPG.
    if (boon) applyBoonByIdToSlot(boon, 0);
    pendingCoopBoonPicks.hostDone = true;
  }
}

function drainBufferedCoopBoonPicks() {
  if (currentBoonPhaseId == null) return;
  const role = (isCoopHost && isCoopHost()) ? 'host' : ((isCoopGuest && isCoopGuest()) ? 'guest' : null);
  if (!role) return;
  for (const [key, payload] of Array.from(coopBoonPickBuffer.entries())) {
    if ((payload.phaseId | 0) === currentBoonPhaseId) {
      coopBoonPickBuffer.delete(key);
      handleCoopBoonPickIncoming(payload, role);
    } else if ((payload.phaseId | 0) < currentBoonPhaseId) {
      coopBoonPickBuffer.delete(key);
    }
  }
}

function handleCoopRoomAdvanceGuest(payload) {
  onlineCoopBoonPhase = null;
  currentBoonPhaseId = null;
  pendingCoopBoonPicks = { hostDone: false, guestDone: false };
  hideCoopGuestWaitOverlay();
  // D20.5 — sync guest simTick to host's value so accumulated per-room lag
  // (host RAF starts before coop-room-advance reaches guest) doesn't push
  // guestSimTick > 60 ticks behind hostSimTick, which would cause
  // consumeUpTo(hostSimTick - 60) to trim all incoming guest input frames.
  if (payload && payload.hostSimTick != null) {
    simTick = payload.hostSimTick | 0;
  }
  // If the picker was still open (e.g. AFK timeout fired on host), close
  // it. Then unfreeze guest sim if we paused for the picker.
  try { document.getElementById('s-up').classList.add('off'); } catch (_) {}
  if (gstate === 'upgrade') {
    gstate = 'playing';
    lastT = performance.now();
    simAccumulatorMs = 0;
    try { raf = requestAnimationFrame(loop); } catch (_) {}
  }
}

// ---------------------------------------------------------------------------
// D15 — Coop end-of-run screen + rematch flow.
// ---------------------------------------------------------------------------
// On run end in coop, we want both peers to land on a dedicated end screen
// with both runners' names + the team score, plus REMATCH (one-tap loop back
// into another coop run on the same lobby) and LEAVE buttons. The transport
// session must outlive the gameOver teardown so coop-rematch packets can
// flow; we capture role/code/partnerName + the session ref into a context
// object that's preserved across the teardown.
let coopRematchSession = null;
let coopRematchRole = null;
let coopRematchCode = null;
let coopPartnerName = '';
let coopRematchListenerUnsub = null;
let coopGameOverPayload = null; // { score, roomIndex, hostName, guestName }

function setCoopRematchLobbyContext({ role, code, partnerName }) {
  coopRematchRole = role || null;
  coopRematchCode = code || null;
  coopPartnerName = partnerName || '';
}

function getLocalRunnerName() {
  try { return playerName || 'YOU'; } catch (_) { return 'YOU'; }
}

function buildCoopGameOverPayload() {
  const role = coopRematchRole;
  const local = getLocalRunnerName();
  const partner = coopPartnerName || 'PARTNER';
  return {
    score: score | 0,
    roomIndex: roomIndex | 0,
    hostName: role === 'host' ? local : partner,
    guestName: role === 'guest' ? local : partner,
    breakdown: { ...scoreBreakdown },
    stats: {
      kills: kills | 0,
      rooms: (roomIndex | 0) + 1,
      elapsedMs: runElapsedMs | 0,
      damagelessRooms: damagelessRooms | 0,
    },
    boonIds: (() => {
      try {
        const slot = playerSlots[role === 'guest' ? 1 : 0];
        const upg = slot && (typeof slot.getUpg === 'function' ? slot.getUpg() : slot.upg);
        const order = (upg && upg.boonSelectionOrder) || [];
        return Array.isArray(order) ? order.slice() : [];
      } catch (_) { return []; }
    })(),
  };
}

function showCoopGameOverScreen(payload) {
  const panel = document.getElementById('s-go-coop');
  if (!panel) return;
  // Hide the solo end screen if it slipped in (it shouldn't on the coop path,
  // but defensive).
  try { document.getElementById('s-go')?.classList.add('off'); } catch (_) {}
  const data = payload || coopGameOverPayload || buildCoopGameOverPayload();
  coopGameOverPayload = data;
  try {
    const scoreEl = document.getElementById('go-coop-score');
    if (scoreEl) scoreEl.textContent = String(data.score | 0);
    const hostNameEl = document.getElementById('go-coop-host-name');
    if (hostNameEl) hostNameEl.textContent = (data.hostName || 'HOST').toUpperCase();
    const guestNameEl = document.getElementById('go-coop-guest-name');
    if (guestNameEl) guestNameEl.textContent = (data.guestName || 'GUEST').toUpperCase();
    const metaEl = document.getElementById('go-coop-meta');
    if (metaEl) metaEl.textContent = `Room ${(data.roomIndex | 0) + 1} reached`;
    const status = document.getElementById('go-coop-status');
    if (status) status.textContent = '';
    // D18.8 — solo-style breakdown + note. Use host-shipped breakdown/stats
    // when present (guest has no local sim). Empty/missing → clean hidden via
    // :empty CSS rule.
    if (goCoopBreakdownEl) {
      try {
        renderScoreBreakdown(goCoopBreakdownEl, data.breakdown || null, data.stats || null);
      } catch (err) {
        try { console.warn('[coop] coop breakdown render failed', err); } catch (_) {}
        goCoopBreakdownEl.innerHTML = '';
      }
    }
    if (goCoopNoteEl) goCoopNoteEl.textContent = '';
    // Hide loadout panel by default; user opens via Run Boons button.
    if (goCoopBoonsPanel) goCoopBoonsPanel.classList.add('off');
    try { renderCoopGameOverBoons(); } catch (_) {}
    const rematchBtn = document.getElementById('btn-coop-rematch');
    if (rematchBtn) {
      if (coopRematchRole === 'guest') {
        rematchBtn.textContent = 'Request Rematch';
        rematchBtn.disabled = false;
      } else {
        rematchBtn.textContent = 'Rematch';
        rematchBtn.disabled = false;
      }
    }
    const nameInput = document.getElementById('name-input-go-coop');
    if (nameInput) {
      try { nameInput.value = getLocalRunnerName(); } catch (_) {}
    }
    // D18.10b — solo's gameOver path doesn't toggle menu-chrome-visible
    // (just shows the screen overlay over the live in-game layout). Calling
    // setMenuChromeVisible(true) here on desktop wide screens activates the
    // CSS rule that hides #cv and collapses #wrap to the top-hud's height,
    // leaving the .screen panel inset:0 of that tiny wrap and overflowing
    // its content downward — which is why the PC end screen looked like
    // the HUD was painted ON TOP of the breakdown rows. Mobile escapes
    // because compact-viewport disables the desktop hide-canvas rule.
    panel.classList.remove('off');
  } catch (err) {
    try { console.warn('[coop] showCoopGameOverScreen failed', err); } catch (_) {}
  }
}

function hideCoopGameOverScreen() {
  try { document.getElementById('s-go-coop')?.classList.add('off'); } catch (_) {}
}

// Install a separate gameplay listener that survives teardownCoopInputUplink
// so we can still receive coop-rematch / coop-leave during the post-game
// screen. The main onGameplay listener is torn down with the input uplink.
function installCoopRematchListener() {
  if (!coopRematchSession || typeof coopRematchSession.onGameplay !== 'function') return;
  if (coopRematchListenerUnsub) {
    try { coopRematchListenerUnsub(); } catch (_) {}
    coopRematchListenerUnsub = null;
  }
  try {
    coopRematchListenerUnsub = coopRematchSession.onGameplay((ev) => {
      const payload = ev && ev.payload;
      if (!payload || typeof payload !== 'object') return;
      if (payload.kind === 'coop-rematch') {
        try { handleCoopRematchIncoming(payload); } catch (err) {
          try { console.warn('[coop] coop-rematch handler error', err); } catch (_) {}
        }
        return;
      }
      if (payload.kind === 'coop-rematch-request') {
        try { handleCoopRematchRequest(); } catch (err) {
          try { console.warn('[coop] coop-rematch-request handler error', err); } catch (_) {}
        }
        return;
      }
      if (payload.kind === 'coop-leave') {
        try { handleCoopPartnerLeft(); } catch (err) {
          try { console.warn('[coop] coop-leave handler error', err); } catch (_) {}
        }
        return;
      }
    });
  } catch (err) {
    try { console.warn('[coop] rematch listener install failed', err); } catch (_) {}
  }
}

function teardownCoopRematchListener() {
  if (coopRematchListenerUnsub) {
    try { coopRematchListenerUnsub(); } catch (_) {}
    coopRematchListenerUnsub = null;
  }
}

function disposeCoopRematchSession() {
  teardownCoopRematchListener();
  // The transport session (Supabase realtime channel etc.) is owned by the
  // lobby. Calling dispose here would break a potential second lobby launch
  // in the same page session if the transport is shared. But the lobby
  // creates a NEW transport on each open, so it's safe to release the ref —
  // GC + the transport's own lifecycle rules handle teardown.
  coopRematchSession = null;
  coopRematchRole = null;
  coopRematchCode = null;
  coopPartnerName = '';
  coopGameOverPayload = null;
}

function handleCoopGameOverPacket(payload) {
  if (!payload) return;
  // Mirror the host's payload locally so guest's end screen shows the same
  // score + names + room. roomIndex / score were already mirrored in the
  // existing handler before D15; here we additionally stash names for UI.
  coopGameOverPayload = {
    score: Number.isFinite(payload.score) ? (payload.score | 0) : (score | 0),
    roomIndex: Number.isFinite(payload.roomIndex) ? (payload.roomIndex | 0) : (roomIndex | 0),
    hostName: typeof payload.hostName === 'string' ? payload.hostName : (coopRematchRole === 'host' ? getLocalRunnerName() : (coopPartnerName || 'HOST')),
    guestName: typeof payload.guestName === 'string' ? payload.guestName : (coopRematchRole === 'guest' ? getLocalRunnerName() : (coopPartnerName || 'GUEST')),
    breakdown: (payload.breakdown && typeof payload.breakdown === 'object') ? payload.breakdown : null,
    stats: (payload.stats && typeof payload.stats === 'object') ? payload.stats : null,
    // D18.8 — host's partner-side boons (slot 1 picks). Guest renders its
    // OWN local boon list; this is host-only context, but we keep the
    // payload field consistent for future symmetry.
    boonIds: Array.isArray(payload.boonIds) ? payload.boonIds.slice() : [],
  };
  // D18.10 — if guest's end screen is already showing (its local game-over
  // ran before the host's packet arrived), re-render with the host's
  // authoritative breakdown/stats/boons.
  try {
    const panel = document.getElementById('s-go-coop');
    if (panel && !panel.classList.contains('off')) {
      showCoopGameOverScreen(coopGameOverPayload);
    }
  } catch (_) {}
}

function handleCoopRematchIncoming(payload) {
  // Both peers receive this; only the side that DIDN'T initiate uses the
  // payload's seed to start the new run. Host sends → guest receives & launches.
  // (Guest's "Request Rematch" sends a coop-rematch-request; host responds
  // with the authoritative coop-rematch.)
  if (payload.kind !== 'coop-rematch') return;
  const seed = (payload.seed | 0) >>> 0;
  if (!seed) return;
  const role = coopRematchRole;
  if (!role) return;
  // Update status briefly so the user sees feedback before the screen swaps.
  try {
    const status = document.getElementById('go-coop-status');
    if (status) status.textContent = 'Starting rematch…';
  } catch (_) {}
  startCoopRematchRun(seed);
}

function handleCoopRematchRequest() {
  // Host receives a guest's "Request Rematch" tap. We auto-accept v1 (no
  // confirmation): generate the new seed, broadcast coop-rematch, launch.
  if (coopRematchRole !== 'host') return;
  const newSeed = ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0) || 1;
  broadcastCoopRematch(newSeed);
  startCoopRematchRun(newSeed);
}

function broadcastCoopRematch(seed) {
  if (!coopRematchSession || typeof coopRematchSession.sendGameplay !== 'function') return;
  try {
    Promise.resolve(coopRematchSession.sendGameplay({ kind: 'coop-rematch', seed: seed >>> 0 })).catch((err) => {
      try { console.warn('[coop] coop-rematch send failed', err); } catch (_) {}
    });
  } catch (err) {
    try { console.warn('[coop] coop-rematch send threw', err); } catch (_) {}
  }
}

function broadcastCoopLeave() {
  if (!coopRematchSession || typeof coopRematchSession.sendGameplay !== 'function') return;
  try {
    Promise.resolve(coopRematchSession.sendGameplay({ kind: 'coop-leave' })).catch(() => {});
  } catch (_) {}
}

function handleCoopPartnerLeft() {
  try {
    const status = document.getElementById('go-coop-status');
    if (status) status.textContent = 'Partner left the run.';
    const rematchBtn = document.getElementById('btn-coop-rematch');
    if (rematchBtn) rematchBtn.disabled = true;
  } catch (_) {}
}

// Re-arm a pending coop run with a fresh seed but the SAME session/role/
// code, then run init() + start the loop. Used for both host-initiated and
// guest-confirmed rematches.
function startCoopRematchRun(seed) {
  const session = coopRematchSession;
  const role = coopRematchRole;
  const code = coopRematchCode;
  if (!session || !role) {
    try { console.warn('[coop] rematch missing session/role'); } catch (_) {}
    return;
  }
  // The post-game listener will be torn down + re-installed once init's
  // installCoopInputUplink runs. Drop the old one explicitly so the new
  // install isn't racing a stale subscription.
  teardownCoopRematchListener();
  try {
    armPendingCoopRun({ role, seed: seed >>> 0, code, session });
  } catch (err) {
    try { console.warn('[coop] rematch arm failed', err); } catch (_) {}
    // Re-install listener so we can retry.
    installCoopRematchListener();
    return;
  }
  hideCoopGameOverScreen();
  setMenuChromeVisible(false);
  // Reset DOM bits the solo gameOver path normally clears via "New Run"
  // (e.g. boons panel collapsed), and ensure the legacy s-go is hidden.
  try { document.getElementById('s-go')?.classList.add('off'); } catch (_) {}
  try { document.getElementById('go-boons-panel')?.classList.add('off'); } catch (_) {}
  try { document.getElementById('go-coop-boons-panel')?.classList.add('off'); } catch (_) {}
  init();
  gstate = 'playing';
  lastT = performance.now();
  simAccumulatorMs = 0;
  raf = requestAnimationFrame(loop);
  try { btnPause.style.display = 'inline-flex'; } catch (_) {}
  try { btnPatchNotes.style.display = 'none'; } catch (_) {}
}

function leaveCoopGame() {
  // Notify partner so their UI updates, then tear down EVERYTHING and
  // return to the start screen. The lobby will create a fresh transport
  // on next open.
  broadcastCoopLeave();
  // D18.3 — single call replaces the previous disposeCoopRematchSession +
  // clearCoopRun pair. Idempotent and covers AFK timer + boon-phase state +
  // wait overlay + watchdog reset + any zombie applier/uplink/slot1.
  teardownCoopRunFully('leave-coop-game');
  hideCoopGameOverScreen();
  setMenuChromeVisible(true);
  try { startScreen?.classList.remove('off'); } catch (_) {}
  try { document.getElementById('s-coop-lobby')?.classList.add('off'); } catch (_) {}
  gstate = 'start';
  try { btnPatchNotes.style.display = 'inline-flex'; } catch (_) {}
  try { btnPause.style.display = 'none'; } catch (_) {}
}

// Phase D4: deterministic-ish unique run identifier. Used as the snapshot
// epoch so guests can hard-reset their snapshot tracking when a fresh run
// starts (otherwise a late-arriving packet from a disposed run could
// overwrite freshly-initialized state).
function generateRunId() {
  try {
    if (typeof crypto !== 'undefined' && crypto && typeof crypto.randomUUID === 'function') {
      return 'run-' + crypto.randomUUID();
    }
  } catch (_) {}
  return 'run-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function installCoopInputUplink(armedCoop) {
  teardownCoopInputUplink();
  if (!armedCoop) return;
  const role = armedCoop.role;
  if (role !== 'host' && role !== 'guest') return; // 'local' (COOP_DEBUG) and anything else: skip
  const session = armedCoop.session;
  if (!session || typeof session.sendGameplay !== 'function' || typeof session.onGameplay !== 'function') {
    try { console.warn('[coop] input uplink: missing session transport, skipping'); } catch (_) {}
    return;
  }
  // Phase D10: capture session ref so non-uplink code paths (boon-phase
  // entry/advance) can publish gameplay-channel messages.
  activeCoopSession = session;
  // On host, localSlotIndex=0 (host owns slot 0) and we never sampleFrame;
  // we only ingest. On guest, localSlotIndex=1 — the frames we send describe
  // slot 1's input as owned by this peer.
  const localSlotIndex = role === 'host' ? 0 : 1;
  coopInputSync = createCoopInputSync({
    sendGameplay: (msg) => session.sendGameplay(msg),
    localAdapter: createHostInputAdapter(joy),
    localSlotIndex,
    localPositionProvider: () => {
      const slot = playerSlots[localSlotIndex];
      return slot && slot.body ? slot.body : null;
    },
    // D12 — was 8 (133 ms input lag); 4 cuts the latency in half (~67 ms)
    // while staying well under the Supabase 20 msg/s rate cap (15 msg/s).
    batchSize: 4,
  });

  // Phase D4: host-only snapshot broadcaster. Emits a full state snapshot
  // every 4 sim ticks (60 Hz / 4 = 15 Hz, D12 — was 6/10 Hz). Combined with
  // guest's 4-frame input batch (~15 msg/s) each peer stays within the
  // Supabase 20 msg/s budget with headroom for handshakes and retries.
  if (role === 'host') {
    // Phase D4.5: spin up slot 1 driven by the remote-input ring buffer +
    // a processor that tracks consumed ticks. Must come BEFORE the broadcaster
    // is built so the snapshot's lastProcessedInputSeq[1] reads from a real
    // processor on the very first emit.
    installOnlineCoopHostSlot1(coopInputSync.getRemoteRingBuffer());
    coopSnapshotSequencer = createSnapshotSequencer();
    coopSnapshotBroadcaster = createSnapshotBroadcaster({
      sendGameplay: (msg) => session.sendGameplay(msg),
      sequencer: coopSnapshotSequencer,
      runId: currentRunId,
      // D19.6a — bump 4 → 3 (15 Hz → 20 Hz). Earlier claims of "20 Hz"
      // in code comments and patch notes were incorrect; verified
      // ticksPerSnapshot was still 4 at v1.20.70. The +33% send rate
      // is acceptable per the 2026-04-25 user decision ("shoot for 3
      // immediately"). renderDelayMs stays at 70 ms — that's now ~1.4×
      // the 50 ms snapshot interval, still buffering >1 full interval
      // for smooth interpolation but ~17 ms more current.
      ticksPerSnapshot: 3,
      getState: collectHostSnapshotState,
      logger: (msg, err) => { try { console.warn('[coop] ' + msg, err || ''); } catch (_) {} },
    });
    try { console.info('[coop] snapshot broadcaster armed runId=' + currentRunId); } catch (_) {}
  }
  if (role === 'guest') {
    // Phase D5b: guest installs its OWN slot 1 (placeholder body) so D5a's
    // local-render-slot retargeting has a real target, and so the snapshot
    // applier has somewhere to land the host's view of slot 1's position.
    installOnlineCoopGuestSlot1();
    // Build a snapshot applier with a palette-aware color resolver. Each
    // applier instance keeps its own seq/runId memory so duplicate snapshots
    // don't thrash the entity arrays at 60 Hz against a 10 Hz feed.
    guestSnapshotApplier = createSnapshotApplier({
      enemyTypeDefs: ENEMY_TYPES,
      // D12 — render delay buffers snapshot interpolation. With D19.6a
      // bumping snapshot rate to 20 Hz (50 ms interval), 70 ms still
      // buffers >1 full interval (~1.4×), preserving smooth lerp while
      // making the guest's view of the host ~17 ms more current than
      // the prior 15 Hz feed.
      renderDelayMs: 70,
      // Phase D5d — guest's own slot 1 is locally predicted. The applier
      // skips continuous body x/y/vx/vy writes for slot id 1 so the
      // prediction step (updateOnlineGuestPrediction) owns movement;
      // applier still re-anchors on first snapshot, death, respawn, and
      // runId reset, and still applies aim/hp/charge/invulnT every frame.
      predictedSlotId: 1,
      // D13.3 — host already drew the dmg# + sparks locally on its own
      // screen when it applied the damage; this fires the same effects on
      // the guest's screen when the snapshot's hp delta is observed. Gated
      // inside the applier on snapshot SHIFT so it fires once per fresh
      // snapshot, not every render frame.
      onSlotDamage: ({ slotId, damage, x, y }) => {
        try {
          const dmg = Math.max(1, Math.round(damage));
          spawnDmgNumber(x, y - 18, dmg, '#ff6b9b');
          sparks(x, y, '#ff6b9b', 8, 70);
        } catch (_) {}
      },
      onEnemyDamage: ({ damage, x, y, ownerSlot }) => {
        try {
          const dmg = Math.max(1, Math.round(damage));
          const col = getCoopPlayerColorForSlot(ownerSlot);
          spawnDmgNumber(x, y, dmg, col);
          sparks(x, y, col, 4, 50);
        } catch (_) {}
      },
      onPickupEvent: ({ slotId, x, y, kind }) => {
        try {
          if ((slotId | 0) !== (getLocalSlotIndex() | 0)) return;
          if (kind !== 'grey') return;
          sparks(x, y, C.ghost, 5, 45);
        } catch (_) {}
      },
      resolveColors: (type) => {
        try {
          const def = getEnemyDefinition(type);
          return { col: def && def.col, glowCol: def && def.glowCol };
        } catch (_) { return null; }
      },
    });
    try { console.info('[coop] guest snapshot applier armed'); } catch (_) {}
    // Phase D5e — Build the prediction reconciler. Records local input
    // frames per sim tick and provides replay for drift correction.
    // SPD must match updateOnlineGuestPrediction's (165 * GLOBAL_SPEED_LIFT)
    // or replay drifts by construction. World bounds default to current
    // WORLD_W/WORLD_H; updated whenever the room/world resizes via the
    // existing world-space recomputation path.
    guestPredictionReconciler = ROLLBACK_ENABLED ? null : createPredictionReconciler({
      speedPerSecond: 165 * GLOBAL_SPEED_LIFT,
      worldBounds: { left: M, right: WORLD_W - M, top: M, bottom: WORLD_H - M },
    });
    lastReconciledSnapshotSeq = null;
    try { if (!ROLLBACK_ENABLED) console.info('[coop] guest prediction reconciler armed'); } catch (_) {}
    // D19.1 — bullet local-advance pool, guest only. Wall margin & world
    // bounds match host's bullet bounce constants exactly so reconcile
    // thresholds reflect real divergence rather than constant offset.
    guestBulletLocalAdvance = createBulletLocalAdvance({
      wallMargin: M,
      getWorldSize: () => ({ w: WORLD_W, h: WORLD_H }),
    });
    lastBulletReconciledSnapshotSeq = null;
    try { console.info('[coop] guest bullet local-advance armed'); } catch (_) {}
    // D19.4 — bullet spawn detector for any-owner muzzle flashes.
    guestBulletSpawnDetector = createBulletSpawnDetector({});
    try { console.info('[coop] guest bullet spawn detector armed'); } catch (_) {}
  }
  ensureRollbackSlot1Bridge();
  // R3 — rollback coordinator (experimental). Slot 1 must be installed before
  // setup so the coordinator snapshots/restores the same live body rendered by
  // the D-series coop path.
  if (ROLLBACK_ENABLED) {
    try {
      setupRollback(
        simState,
        localSlotIndex,
        async (frame) => {
          try { await session.sendGameplay({ kind: 'rollback-input', frame }); } catch (_) {}
        },
        // R4-fix: HOST coordinator must not rollback-correct slot 1 position.
        // hostSimStep is a partial sim (remoteX/Y snap lives only in update());
        // any resim correction diverges from the D-series forward path and
        // produces the "choppy guest position on host" symptom. Host coordinator
        // still snapshots state and sends host inputs to the guest; it just
        // never applies rollback corrections for slot 1. GUEST coordinator
        // continues to subscribe to host 'rollback-input' payloads unchanged.
        role === 'host'
          ? (_cb) => () => {}
          : (callback) => session.onGameplay((ev) => {
              const payload = ev && ev.payload;
              if (!payload || payload.kind !== 'rollback-input') return;
              if (payload.frame) callback(payload.frame);
            }),
        {
          simStep: hostSimStep,
          simStepOpts: {
            get worldW() { return simState.world && simState.world.w ? simState.world.w : (W || 800); },
            get worldH() { return simState.world && simState.world.h ? simState.world.h : (H || 600); },
            baseSpeed: BASE_SPD,
            deadzone: JOY_DEADZONE,
            joyMax,
            get gate() { return roomPhase !== 'intro'; },
            get phaseWalk() { return !!UPG.phaseWalk; },
            get bossDamageMultiplier() { return currentBossDamageMultiplier || 1; },
            resolveCollisions: resolveEntityObstacleCollisions,
            isOverlapping: isEntityOverlappingObstacle,
            eject: ejectEntityFromObstacles,
            // R4: enable effectQueue so resim ticks can push visual/audio
            // descriptors; drained in the game loop before coordinatorStep snapshots.
            queueEffects: true,
          },
          logging: true,
        }
      );
      console.info('[coop] rollback coordinator armed (R1: hostSimStep for resim)');
    } catch (err) {
      try { console.warn('[coop] rollback setup failed:', err); } catch (_) {}
    }
  }
  // Ingest any gameplay payload that is an input frame from the peer.
  // coopSession.onGameplay delivers { payload, from, ts } envelopes — we must
  // unwrap before checking kind. (Pre-D3-fix bug: handler treated `ev` as the
  // raw payload, so every input frame was silently dropped.)
  coopInputUnsubscribe = session.onGameplay((ev) => {
    const payload = ev && ev.payload;
    if (!payload) return;
    // D18.11 — any inbound gameplay packet refreshes the liveness clock
    // and recovers from soft-pause. Done unconditionally before kind
    // dispatch so heartbeats and unknown future kinds count too.
    stampCoopInboundActivity();
    if (payload.kind === 'coop-heartbeat') return;
    if (payload.kind === 'coop-bye') {
      // Partner explicitly told us they're going away (e.g. mobile app
      // backgrounded). Treat as immediate soft-disconnect — no need to
      // wait the 7s freshness window. The wall-clock hard timer continues
      // ticking as the source of truth for full teardown.
      try {
        coopLastInboundAtMs = ((typeof performance !== 'undefined' && performance.now)
          ? performance.now() : Date.now()) - COOP_SOFT_DISCONNECT_MS - 1;
      } catch (_) {}
      try { tripCoopSoftDisconnect(); } catch (_) {}
      return;
    }
    if (payload.kind === 'input') {
      if (COOP_DIAG) {
        try {
          const f = payload.frames && payload.frames[0];
          const last = payload.frames && payload.frames[payload.frames.length - 1];
          console.info('[coopdiag] ingest', {
            role,
            slot: payload.slot,
            count: payload.frames ? payload.frames.length : 0,
            firstTick: f && f.tick,
            lastTick: last && last.tick,
            firstStill: f && f.still,
            simTick,
          });
        } catch (_) {}
      }
      try { coopInputSync && coopInputSync.ingest(payload); } catch (err) {
        try { console.warn('[coop] input ingest error', err); } catch (_) {}
      }
      return;
    }
    if (payload.kind === 'coop-boon-start' && role === 'guest') {
      try { handleCoopBoonStartGuest(payload); } catch (err) {
        try { console.warn('[coop] coop-boon-start handler error', err); } catch (_) {}
      }
      return;
    }
    if (payload.kind === 'coop-room-advance' && role === 'guest') {
      try { handleCoopRoomAdvanceGuest(payload); } catch (err) {
        try { console.warn('[coop] coop-room-advance handler error', err); } catch (_) {}
      }
      return;
    }
    if (payload.kind === 'coop-boon-pick') {
      try { handleCoopBoonPickIncoming(payload, role); } catch (err) {
        try { console.warn('[coop] coop-boon-pick handler error', err); } catch (_) {}
      }
      return;
    }
    if (payload.kind === 'coop-color') {
      // D18.7 — partner announced their color key. Store + force a redraw
      // by stamping the slot record (drawGuestSlots reads from this global
      // each frame so no further plumbing is needed). Echo our color back
      // when we haven't yet, so a late-joining peer always learns ours
      // even if their announce raced ahead of our slot install.
      try {
        if (typeof payload.colorKey === 'string') {
          coopPartnerColorKey = payload.colorKey;
        }
        if (!coopLocalColorAnnounced) sendCoopLocalColor();
      } catch (err) {
        try { console.warn('[coop] coop-color handler error', err); } catch (_) {}
      }
      return;
    }
    if (payload.kind === 'coop-hat') {
      // D18.14 — partner announced their hat key (parallel to coop-color).
      // Validate against HAT_OPTIONS so a malformed payload can't crash
      // the renderer. Echo our hat back if we haven't yet, so a late-
      // joining peer always learns ours.
      try {
        if (typeof payload.hatKey === 'string'
            && HAT_OPTIONS.some((option) => option.key === payload.hatKey)) {
          coopPartnerHatKey = payload.hatKey;
        }
        if (!coopLocalHatAnnounced) sendCoopLocalHat();
      } catch (err) {
        try { console.warn('[coop] coop-hat handler error', err); } catch (_) {}
      }
      return;
    }
    if (payload.kind === 'coop-game-over' && role === 'guest') {
      // D12.2 — host died → end the run on guest too. Without this, the
      // guest sits on the last snapshot pose indefinitely. We mirror score
      // from the host's payload so the guest's leaderboard push uses the
      // shared run's final value (host already pushed its own entry).
      // D15 — payload now also carries hostName/guestName for the coop end
      // screen. Stash the rematch session + role for the post-game flow
      // BEFORE gameOver tears down the input uplink (gameOver also captures
      // these but we want them available on both sides, including guests
      // that didn't trigger gameOver themselves).
      try {
        if (Number.isFinite(payload.score)) score = payload.score;
        if (Number.isFinite(payload.roomIndex)) roomIndex = payload.roomIndex;
        coopRematchSession = activeCoopSession;
        handleCoopGameOverPacket(payload);
        gameOver();
      } catch (err) {
        try { console.warn('[coop] coop-game-over handler error', err); } catch (_) {}
      }
      return;
    }
    if (payload.kind === 'snapshot' && role === 'guest') {
      // Phase D5b: validate via decodeSnapshot before storing. Malformed
      // packets are dropped (decoder throws on bad scalars) so they can't
      // wedge the applier mid-frame. Decode is idempotent / pure.
      let decoded;
      try {
        decoded = decodeSnapshot(payload);
      } catch (err) {
        try { console.warn('[coop] dropped malformed snapshot', err && err.message); } catch (_) {}
        return;
      }
      // Epoch gate: if the packet is from a different run (e.g. host
      // restarted, late arrival from a disposed broadcaster), drop our
      // tracker so we don't compare seqs across runs.
      if (latestRemoteSnapshot && latestRemoteSnapshot.runId !== decoded.runId) {
        latestRemoteSnapshot = null;
        latestRemoteSnapshotSeq = null;
        latestRemoteSnapshotRecvAtMs = 0;
      }
      // Newest-wins on snapshotSeq. isNewerSnapshot handles the wrap edge case.
      if (latestRemoteSnapshotSeq != null && !isNewerSnapshot(decoded.snapshotSeq, latestRemoteSnapshotSeq)) {
        return;
      }
      latestRemoteSnapshot = decoded;
      latestRemoteSnapshotSeq = decoded.snapshotSeq;
      // D5c: stamp the wall-clock arrival time. The applier uses this as
      // the curr-snapshot timestamp; rAF's `ts` is the same clock domain.
      try { latestRemoteSnapshotRecvAtMs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }
      catch (_) { latestRemoteSnapshotRecvAtMs = Date.now(); }
      return;
    }
  });
  try { console.info('[coop] input uplink installed role=' + role + ' slot=' + localSlotIndex); } catch (_) {}
  // D18.11 — reset disconnect state and arm liveness/heartbeat/visibility.
  // The first inbound packet from the partner will refresh coopLastInboundAtMs;
  // until then the gate is held open by the lastInbound==0 short-circuit.
  coopLastInboundAtMs = 0;
  coopSoftDisconnectActive = false;
  coopHardDisconnectTripped = false;
  coopByeSentForHidden = false;
  coopHiddenAtMs = 0;
  try { startCoopHeartbeat(); } catch (_) {}
  try { installCoopVisibilityListeners(); } catch (_) {}
  if (COOP_DIAG) startCoopDiagnostics(role);
}

function startCoopDiagnostics(role) {
  stopCoopDiagnostics();
  try { console.info('[coopdiag] starting role=' + role + ' simTick=' + simTick); } catch (_) {}
  coopDiagInterval = setInterval(() => {
    try {
      const stats = coopInputSync ? coopInputSync.getStats() : null;
      const rp = (typeof hostRemoteInputProcessor !== 'undefined' && hostRemoteInputProcessor)
        ? hostRemoteInputProcessor.getStats() : null;
      const slot1 = playerSlots[1] || null;
      const body = slot1 && slot1.body;
      const mv = (slot1 && slot1.input && typeof slot1.input.moveVector === 'function')
        ? slot1.input.moveVector() : null;
      const joySnap = role === 'guest'
        ? { active: !!joy.active, mag: +(joy.mag || 0).toFixed(2), dx: +(joy.dx || 0).toFixed(2), dy: +(joy.dy || 0).toFixed(2) }
        : null;
      console.info('[coopdiag]', {
        role,
        simTick,
        gstate,
        roomPhase,
        sync: stats,
        proc: rp,
        slot1: body ? { x: +body.x.toFixed(1), y: +body.y.toFixed(1), vx: +(body.vx || 0).toFixed(1), vy: +(body.vy || 0).toFixed(1) } : null,
        slot1Move: mv,
        joy: joySnap,
        session: !!activeCoopSession,
      });
    } catch (err) {
      try { console.warn('[coopdiag] error', err); } catch (_) {}
    }
  }, 2000);
}

function stopCoopDiagnostics() {
  if (coopDiagInterval) {
    try { clearInterval(coopDiagInterval); } catch (_) {}
    coopDiagInterval = null;
  }
}

// Phase D4: builds the loose state object passed into encodeSnapshot.
// Called by the broadcaster every ticksPerSnapshot. Defensive defaults on
// every field — encodeSnapshot is strict and any throw is caught and
// counted as a failed send by the broadcaster.
// Phase D4 — host snapshot collection. Phase D4.6 — fixed:
//   - enemy id was `e.id ?? i` (always falls through to array index because
//     runtime uses `eid`); now reads `e.eid`. Stable IDs are required for
//     guest-side upsert in D5.
//   - enemy fire fields were `fireT`/`windup`; runtime has `fT`/`fRate` and
//     no `windup`. Renamed to match runtime so guests see live fire-tells.
//   - bullets need `r` and `state` to render correctly via bulletRenderer,
//     which dispatches on `b.state`.
//   - slot output now writes the full schema (charge/aim/invulnT/etc.); the
//     fields were declared in encodeSlot but never populated, so guests
//     would have decoded zeros.
function collectHostSnapshotState() {
  const slotsOut = [];
  for (let i = 0; i < playerSlots.length; i++) {
    const s = playerSlots[i];
    if (!s) continue;
    const body = (typeof s.getBody === 'function') ? s.getBody() : null;
    const bodyOrSlot = body || (s.body ?? null);
    if (!bodyOrSlot) continue;
    const m = s.metrics || {};
    const upg = (typeof s.getUpg === 'function') ? s.getUpg() : (s.upg || {});
    const aim = s.aim || {};
    // body.shields is an array of active shield records; first entry's
    // remaining time is the canonical "shield timer" for the renderer.
    const shieldT = (Array.isArray(bodyOrSlot.shields) && bodyOrSlot.shields.length > 0)
      ? Number(bodyOrSlot.shields[0].t || bodyOrSlot.shields[0].timer || 0)
      : 0;
    // D19.5 — pack shield count + per-shield hardened/cooldown bitmasks so
    // the partner's screen can render the orbiting shields. body.shields
    // entries have shape { cooldown, hardened, mirrorCooldown }. Mask
    // capped at 8 bits → up to 8 shields visible on partner; legendary
    // tiers max out at ~5 so this is plenty. Slot 1 host-side typically
    // has no shields array (boon mechanics live on slot 0 in v1) → both
    // counts default to 0 cleanly.
    let shieldCount = 0;
    let shieldHardenedMask = 0;
    let shieldCooldownMask = 0;
    if (Array.isArray(bodyOrSlot.shields) && bodyOrSlot.shields.length > 0) {
      const sh = bodyOrSlot.shields;
      shieldCount = Math.min(8, sh.length);
      for (let si = 0; si < shieldCount; si++) {
        if (sh[si] && sh[si].hardened) shieldHardenedMask |= (1 << si);
        if (sh[si] && (sh[si].cooldown | 0) > 0) shieldCooldownMask |= (1 << si);
      }
    }
    // D19.5 — pack orbit-sphere count from the slot's own UPG. Per-orb
    // cooldown isn't synced (host module-level _orbCooldown is slot-0 only;
    // partner doesn't fire orbs anyway in v1). Render uses full opacity.
    const orbCount = Math.min(8, (upg.orbitSphereTier | 0) || 0);
    slotsOut.push({
      id: s.id ?? i,
      x: bodyOrSlot.x ?? 0,
      y: bodyOrSlot.y ?? 0,
      vx: bodyOrSlot.vx ?? 0,
      vy: bodyOrSlot.vy ?? 0,
      hp: m.hp ?? 0,
      maxHp: m.maxHp ?? 0,
      charge: m.charge ?? 0,
      maxCharge: upg.maxCharge ?? 1,
      aimAngle: aim.angle ?? 0,
      invulnT: bodyOrSlot.invincible ?? 0,
      shieldT,
      stillTimer: m.stillTimer ?? 0,
      // body.deadAt > 0 marks a dead player; createInitialPlayerState
      // initializes deadAt:0. m.hp > 0 is a defensive secondary check.
      // D18.15a — spectators are wire-alive so the guest predictor doesn't
      // halt at body.deadAt; the `spectating` flag below carries the dead
      // pose to the partner's render.
      alive: !((bodyOrSlot.deadAt ?? 0) > 0) && (((m.hp ?? 0) > 0) || !!bodyOrSlot.coopSpectating || (m.maxHp ?? 0) === 0),
      // D13.1 / D13.3 / D13.4 — propagate respawn counter, hurt-wobble
      // timer, and aim-target flag so guest renders match host.
      respawnSeq: (bodyOrSlot.respawnSeq | 0),
      distort: bodyOrSlot.distort ?? 0,
      hasTarget: !!aim.hasTarget,
      // D18.15a — coop spectator-on-death. Carried over the wire so the
      // partner renders the dead player translucent + frowning while they
      // walk around. hp=0 on the wire so enemy targeting still skips them.
      spectating: !!bodyOrSlot.coopSpectating,
      // D19.5 — partner cosmetic sync (shields + orbs).
      shieldCount,
      shieldHardenedMask,
      shieldCooldownMask,
      orbCount,
    });
  }
  const bulletsOut = [];
  for (let i = 0; i < bullets.length; i++) {
    const b = bullets[i];
    if (!b) continue;
    const owner = b.ownerId;
    bulletsOut.push({
      id: (b.id != null && b.id >= 0) ? (b.id | 0) : i,
      x: b.x ?? 0,
      y: b.y ?? 0,
      vx: b.vx ?? 0,
      vy: b.vy ?? 0,
      r: b.r ?? 6,
      type: b.kind || (b.danger ? 'd' : 'p'),
      // D4.6: bulletRenderer reads `b.state` directly. Pass through the
      // runtime field; default 'output' keeps any oddly-shaped bullets
      // rendering as player shots rather than crashing the renderer.
      state: b.state || (b.danger ? 'danger' : 'output'),
      // Schema requires u32 ≥ 0. Danger bullets carry no slot owner: clamp
      // to 0 — the `type`/`state` fields carry the player/danger discriminator.
      ownerSlot: (typeof owner === 'number' && owner >= 0) ? (owner | 0) : 0,
      bounces: b.bounces ?? 0,
      spawnTick: b.spawnTick ?? 0,
      doubleBounce: !!b.doubleBounce,
      bounceCount: b.bounceCount ?? 0,
      dangerBounceBudget: b.dangerBounceBudget ?? 0,
      eliteStage: b.eliteStage,
      eliteColor: b.eliteColor,
      eliteCore: b.eliteCore,
      isTriangle: !!b.isTriangle,
    });
  }
  const enemiesOut = [];
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e) continue;
    // D4.6: runtime enemies use `eid` (set by createEnemy). Falling back to
    // array index would make IDs non-stable across snapshots, breaking
    // upsert in the D5 applier.
    const stableId = (e.eid != null && e.eid >= 0) ? (e.eid | 0)
      : (e.id != null && e.id >= 0) ? (e.id | 0)
      : i;
    enemiesOut.push({
      id: stableId,
      x: e.x ?? 0,
      y: e.y ?? 0,
      vx: e.vx ?? 0,
      vy: e.vy ?? 0,
      hp: e.hp ?? 0,
      maxHp: e.maxHp ?? e.hp ?? 0,
      r: e.r ?? 12,
      type: e.type || 'e',
      // D4.6: runtime field names (fT cooldown counter ms, fRate period ms).
      fT: e.fT ?? 0,
      fRate: e.fRate ?? 0,
    });
  }
  return {
    // runId/snapshotSeq/snapshotSimTick are stamped by the broadcaster.
    slots: slotsOut,
    bullets: bulletsOut,
    enemies: enemiesOut,
    room: {
      index: roomIndex | 0,
      phase: roomPhase || 'intro',
      clearTimer: 0,
      spawnQueueLen: spawnQueue.length | 0,
    },
    score: score | 0,
    elapsedMs: runElapsedMs | 0,
    enemyDamageEvents: coopEnemyDamageEvents.splice(0, coopEnemyDamageEvents.length),
    pickupEvents: coopPickupEvents.splice(0, coopPickupEvents.length),
    // Slot 0 is host-owned; we've consumed all our own input up to simTick.
    // Slot 1 ack comes from hostRemoteInputProcessor — null until we've
    // actually consumed a remote-input frame (D4.5). Per rubber-duck #3
    // this MUST be a consumed tick, not "newest received".
    lastProcessedInputSeq: {
      0: simTick | 0,
      1: hostRemoteInputProcessor ? hostRemoteInputProcessor.getLastProcessedTick() : null,
    },
  };
}

// Phase D4.5: install online host slot 1 — its body, metrics, timers, aim,
// and a remote-input adapter that reads from the coop input ring buffer.
// Mirrors the COOP_DEBUG installGuestDebugSlot setup (so it benefits from
// the existing slot-1 movement / contact-damage / respawn paths) but
// substitutes a remote-input adapter for the local arrow-keys adapter.
//
// Idempotent: if a slot 1 is already registered (e.g. COOP_DEBUG path or a
// prior install) we leave it alone. Real online runs never coexist with
// COOP_DEBUG so this branch is conservative.
function installOnlineCoopHostSlot1(remoteRing) {
  if (!remoteRing) return;
  if (playerSlots[1]) return; // already installed (COOP_DEBUG or re-entry)
  const body = createInitialPlayerState(WORLD_W, WORLD_H);
  body.x = Math.min(WORLD_W - 24, body.x + 60);
  body.invincible = 1.5;
  body.distort = 0;
  body.spawnX = body.x;
  body.spawnY = body.y;
  body.respawnSeq = 0;
  const upg = getDefaultUpgrades();
  const metrics = { score: 0, kills: 0, charge: 0, fireT: 0, stillTimer: 0, prevStill: false, hp: BASE_PLAYER_HP, maxHp: BASE_PLAYER_HP };
  const timers = {
    barrierPulseTimer: 0, slipCooldown: 0, absorbComboCount: 0, absorbComboTimer: 0,
    chainMagnetTimer: 0, echoCounter: 0, vampiricRestoresThisRoom: 0,
    killSustainHealedThisRoom: 0, colossusShockwaveCd: 0, volatileOrbGlobalCooldown: 0,
  };
  const aim = { angle: -Math.PI * 0.5, hasTarget: false };
  registerPlayerSlot(createPlayerSlot({
    id: 1,
    getBody: () => body,
    getUpg: () => upg,
    metrics, timers, aim,
    input: createRemoteInputAdapter(remoteRing, { getCurrentTick: () => simTick }),
  }));
  hostRemoteInputProcessor = createHostRemoteInputProcessor({
    remoteRing,
    retainTicks: 60, // ~1s of replay history for D6 reconciliation
    logger: (msg, err) => { try { console.warn('[coop] ' + msg, err || ''); } catch (_) {} },
  });
  onlineHostSlot1Installed = true;
  // D19.3 — arm host-side grey lag-comp when slot 1 (the guest) is on-line.
  // Solo + host-without-guest never instantiate this; no determinism risk.
  try {
    hostGreyLagComp = createGreyLagComp({});
    console.info('[coop] host grey lag-comp armed');
  } catch (_) { hostGreyLagComp = null; }
  try { console.info('[coop] online host slot 1 installed (remote-input adapter)'); } catch (_) {}
  // D18.7 — announce our color to guest. Safe to call before guest's slot
  // install; guest will echo back so we learn theirs in turn.
  try { sendCoopLocalColor(); } catch (_) {}
  // D18.14 — same for hat cosmetic.
  try { sendCoopLocalHat(); } catch (_) {}
}

// Phase D5b: install online guest slot 1 — the LOCAL guest's own player body
// on a guest peer. D5a's getLocalRenderSlot()/HUD code targets slot index 1
// for guest role, so a body has to exist for drawGhost/hudUpdate to read.
// For D5b the body is a placeholder; positions are pulled from the host's
// snapshot via the applier (snapshot.slots[1] → playerSlots[1].body). D5d
// will replace the snapshot-driven position with locally-predicted state.
//
// Idempotent: skips install if a slot 1 already exists (defensive — online
// guest never coexists with COOP_DEBUG, and onlineGuestSlot1Installed gates
// teardown).
function installOnlineCoopGuestSlot1() {
  if (playerSlots[1]) return;
  // D18.12 — fresh coop run starts the guest with one reroll, mirroring the
  // host's `boonRerolls = 1` initial value. Tracked locally on guest device.
  guestBoonRerolls = 1;
  const body = createInitialPlayerState(WORLD_W, WORLD_H);
  body.x = Math.min(WORLD_W - 24, body.x + 60);
  body.invincible = 1.5;
  body.distort = 0;
  body.spawnX = body.x;
  body.spawnY = body.y;
  body.respawnSeq = 0;
  const upg = getDefaultUpgrades();
  const metrics = { score: 0, kills: 0, charge: 0, fireT: 0, stillTimer: 0, prevStill: false, hp: BASE_PLAYER_HP, maxHp: BASE_PLAYER_HP };
  const timers = {
    barrierPulseTimer: 0, slipCooldown: 0, absorbComboCount: 0, absorbComboTimer: 0,
    chainMagnetTimer: 0, echoCounter: 0, vampiricRestoresThisRoom: 0,
    killSustainHealedThisRoom: 0, colossusShockwaveCd: 0, volatileOrbGlobalCooldown: 0,
  };
  const aim = { angle: -Math.PI * 0.5, hasTarget: false };
  registerPlayerSlot(createPlayerSlot({
    id: 1,
    getBody: () => body,
    getUpg: () => upg,
    metrics, timers, aim,
    input: createHostInputAdapter(joy),
  }));
  onlineGuestSlot1Installed = true;
  try { console.info('[coop] online guest slot 1 installed (placeholder body)'); } catch (_) {}
  // D18.7 — announce our color to host (and through host's echo, the host
  // will reciprocate so we render the host in their chosen scheme).
  try { sendCoopLocalColor(); } catch (_) {}
  // D18.14 — same for hat cosmetic.
  try { sendCoopLocalHat(); } catch (_) {}
}


// Phase D5d — Local prediction for the guest's own slot 1 body. Reads the
// joystick adapter installed on the slot and applies movement directly to
// the body each frame. Aim, hp, charge, deadAt, and invincible flag still
// flow from snapshot via the applier (predictedSlotId:1 skips body writes
// only). The applier re-anchors body on first snapshot, death, respawn,
// and runId reset, so prediction never permanently diverges through
// authoritative discontinuities.
//
// Movement constants mirror updateGuestSlotMovement so the predicted feel
// matches what the host's authoritative sim is producing for slot 1.
// Solo / host / COOP_DEBUG never call this — gated on
// onlineGuestSlot1Installed in the caller.
function updateOnlineGuestPrediction(dt) {
  const slot = playerSlots[1];
  if (!slot) return;
  const body = slot.body;
  if (!body) return;
  // Halt local sim while the snapshot says we're dead. Zero velocity so
  // the renderer doesn't show post-mortem drift; the applier re-anchors
  // on respawn (dead→alive edge) before prediction resumes.
  if ((body.deadAt | 0) !== 0) {
    body.vx = 0;
    body.vy = 0;
    return;
  }
  // D20.2 — mirror host's movement gate: no movement allowed during intro.
  if (roomPhase === 'intro') {
    body.vx = 0;
    body.vy = 0;
    return;
  }
  if (!slot.input || typeof slot.input.moveVector !== 'function') return;
  const { dx, dy, t, active } = slot.input.moveVector();
  // Phase D5e — record the input frame BEFORE applying movement so the
  // reconciler's stored frame matches what this tick simulated. Replay
  // can then reproduce this exact step from authoritative state.
  if (guestPredictionReconciler) {
    try {
      guestPredictionReconciler.record({
        tick: simTick | 0,
        dx, dy, t, active,
      });
    } catch (_) {}
  }
  const SPD = 165 * GLOBAL_SPEED_LIFT * Math.min(2.5, (slot.upg?.speedMult || 1));
  if (active) { body.vx = dx * SPD * t; body.vy = dy * SPD * t; }
  else { body.vx = 0; body.vy = 0; }
  // D18.16 — measure expected vs actual travel to detect obstacle wedge.
  // The reconciler's replay is collision-free, so when we're pinned
  // against a wall the auth-replay position diverges by tens of pixels
  // and the soft-correction would jam us into the wall every snapshot.
  // We compare actual position delta after clamping + collision resolve
  // to the unclamped step; if the body actually moved less than 60% of
  // what input demanded, we mark wedged and the reconciler short-circuits.
  const beforeX = body.x;
  const beforeY = body.y;
  const expectDx = body.vx * dt;
  const expectDy = body.vy * dt;
  body.x = Math.max(M + body.r, Math.min(WORLD_W - M - body.r, body.x + expectDx));
  body.y = Math.max(M + body.r, Math.min(WORLD_H - M - body.r, body.y + expectDy));
  resolveEntityObstacleCollisions(body);
  const expectMag = Math.hypot(expectDx, expectDy);
  if (expectMag > 0.5) {
    const actualMag = Math.hypot(body.x - beforeX, body.y - beforeY);
    lastGuestPredictionWedged = actualMag < expectMag * 0.6;
  } else {
    lastGuestPredictionWedged = false;
  }
}


// Called from the main update() right after slot 0's movement block. Slot 0
// is already driven by the legacy joystick block for bit-identity; this only
// moves guests. Simplified movement (no obstacles, no phase-walk nuance) is
// intentional for the C2c milestone — C2d formalizes guest combat.
function updateGuestSlotMovement(dt, W, H) {
  for (let i = 1; i < playerSlots.length; i++) {
    const slot = playerSlots[i];
    if (!slot || !slot.input) continue;
    const body = slot.body;
    const { dx, dy, t, active, x: remoteX, y: remoteY } = slot.input.moveVector();
    // D19.6b — honor slot.upg.speedMult on slot 1+ host-side movement.
    // Previously this used bare 165*GLOBAL_SPEED_LIFT, which silently
    // ignored Ghost Velocity (a slot-1-safe boon) and any other
    // speedMult-affecting boon, so the guest's body moved at base speed
    // even when the boon should have made them faster. Cap matches
    // slot 0's at script.js:5217 (Math.min(2.5, ...)). Other slot-0-only
    // movement modifiers (titanSlow, bloodRushMult, lateBloomMoveMods.speed)
    // are intentionally NOT applied here — those touch UPG-only runtime
    // state that isn't mirrored to slot 1.
    const SPD = 165 * GLOBAL_SPEED_LIFT * Math.min(2.5, (slot.upg?.speedMult || 1));
    if (active) { body.vx = dx * SPD * t; body.vy = dy * SPD * t; }
    else { body.vx = 0; body.vy = 0; }
    // D19.7 — guest body position has priority. Movement intent alone can put
    // the host's slot-1 body several ticks away from where the guest sees
    // themselves, making friendly pickups miss. Fresh input frames now carry
    // the guest's locally displayed position; use it directly when available.
    if (Number.isFinite(remoteX) && Number.isFinite(remoteY)) {
      body.x = Math.max(M + body.r, Math.min(W - M - body.r, remoteX));
      body.y = Math.max(M + body.r, Math.min(H - M - body.r, remoteY));
    } else {
      body.x = Math.max(M + body.r, Math.min(W - M - body.r, body.x + body.vx * dt));
      body.y = Math.max(M + body.r, Math.min(H - M - body.r, body.y + body.vy * dt));
    }
    resolveEntityObstacleCollisions(body);
    // D12.4 — kinetic charge gain for guest slots while moving, mirroring
    // slot 0's flow at script.js:3541. Only fires when the host has the
    // Kinetic Harvest boon (UPG.moveChargeRate > 0, mirrored to slot.upg
    // by mirrorHostUpgToSlot1). Without this, the previous "+dt while
    // still" auto-charge in updateGuestFire let slot 1 fire continuously
    // for free; that was removed and replaced with this gated path.
    if (active && (roomPhase === 'spawning' || roomPhase === 'fighting')) {
      const upg = slot.upg;
      if (upg && (upg.moveChargeRate || 0) > 0) {
        const rate = getKineticChargeRate(upg, slot.metrics.charge || 0) * (upg.fluxState ? 2 : 1);
        const cap = upg.maxCharge || 1;
        slot.metrics.charge = Math.min(cap, (slot.metrics.charge || 0) + rate * dt);
      }
    }
  }
}

// C2d-1b — tick invulnerability/distort timers on guest slot bodies. Host's
// `player.invincible -= dt` block covers slot 0. Without this, guests would
// retain their spawn invuln forever and remain undamageable.
function tickGuestSlotTimers(dt) {
  for (let i = 1; i < playerSlots.length; i++) {
    const slot = playerSlots[i];
    if (!slot) continue;
    const body = slot.body;
    if (!body) continue;
    if (body.invincible > 0 && !body.coopSpectating) body.invincible -= dt;
    if (body.distort > 0) body.distort -= dt;
  }
}

// C2d-1b — simple contact-damage path for guest slots (slot 1+). Slot 0 still
// uses the legacy rusher-contact + aftermath block because it owns the UPG
// boons (lifeline/colossus/blood-pact). Guests have fresh-default UPG so no
// boons fire — keep the path minimal: hp drop, spark, invuln/distort timers,
// respawn-on-death (dev-harness only; coopdebug is for testing, not ship).
function applyContactDamageToGuestSlot(slot, damage) {
  const body = slot.body;
  if (body.coopSpectating) return; // D18.15 — corpse takes no damage.
  const nextHp = Math.max(0, (slot.metrics.hp || 0) - damage);
  slot.metrics.hp = nextHp;
  body.invincible = getPostHitInvulnSeconds('contact');
  body.distort = 0.35;
  spawnDmgNumber(body.x, body.y, damage, C.danger);
  sparks(body.x, body.y, C.danger, 10, 90);
  if (nextHp <= 0 && handleSlotDeathInCoop(slot)) gameOver();
}

function applyDangerDamageToGuestSlot(slot, damage, color) {
  const body = slot.body;
  if (body.coopSpectating) return; // D18.15 — corpse takes no damage.
  const nextHp = Math.max(0, (slot.metrics.hp || 0) - damage);
  slot.metrics.hp = nextHp;
  body.invincible = getPostHitInvulnSeconds('projectile');
  body.distort = 0.3;
  spawnDmgNumber(body.x, body.y, damage, color || C.danger);
  sparks(body.x, body.y, C.danger, 8, 70);
  // D18.16 — slot 1 death paths previously discarded the
  // handleSlotDeathInCoop return. If host (slot 0) died first into
  // spectator state, then guest (slot 1) died, countLiveCoopSlots()
  // correctly returned 0, but nobody fired gameOver — run hung
  // forever with both ghosts walking around.
  if (nextHp <= 0 && handleSlotDeathInCoop(slot)) gameOver();
}

// D18.15 — coop spectator-on-death system. When a player dies in a coop
// run we no longer insta-respawn (slot 1) or fire gameOver immediately
// (slot 0). Instead the dead slot enters spectator mode: body is frozen
// at the death position, becomes translucent, takes no damage, can't
// move/fire/be targeted. The survivor continues the room solo. Only when
// the LAST live slot dies does gameOver fire. On the next room's
// startRoom() spectators are revived to 25% HP (or current HP after any
// HP-boon picks, whichever is higher) and re-enter the world normally.
//
// Implementation choice: rely on body.invincible=Infinity-style sticky
// flag + hp=0 to short-circuit existing damage gates instead of editing
// each damage path. The movement / fire / render gates use the explicit
// body.coopSpectating boolean, set/cleared by these helpers.
const SPECTATOR_INVULN_SECONDS = 1e9;

function isSlotSpectating(slot) {
  return !!(slot && slot.body && slot.body.coopSpectating);
}

function countLiveCoopSlots() {
  let live = 0;
  for (let i = 0; i < playerSlots.length; i++) {
    const s = playerSlots[i];
    if (!s || !s.body) continue;
    if (s.body.coopSpectating) continue;
    if ((s.metrics?.hp || 0) > 0) live++;
  }
  return live;
}

function markSlotSpectating(slot) {
  if (!slot || !slot.body) return;
  const body = slot.body;
  body.coopSpectating = true;
  // D18.15a — spectators can walk around (with a frown). They just can't
  // fire, take damage, or be targeted. The hp=0 + invincible=1e9 combo
  // handles damage/targeting gates; forceFrown render gives the dead
  // expression. Do NOT set deadAt — that would halt the guest predictor.
  body.distort = 0;
  body.invincible = SPECTATOR_INVULN_SECONDS;
  if (slot.metrics) slot.metrics.hp = 0;
  if (slot.aim) slot.aim.hasTarget = false;
  // D13.1 — bump respawnSeq so the snapshot applier re-anchors guest
  // prediction on the dead→spectator pose change.
  body.respawnSeq = ((body.respawnSeq | 0) + 1) >>> 0;
  sparks(body.x, body.y, C.danger, 14, 140);
}

// Returns true if the run should END (no live slots left). Caller is
// responsible for firing gameOver(). In solo (no activeCoopSession), we
// never enter spectator state — solo death always ends the run.
function handleSlotDeathInCoop(slot) {
  if (!slot) return true;
  if (!activeCoopSession) return true; // solo: ends run.
  markSlotSpectating(slot);
  return countLiveCoopSlots() === 0;
}

// D18.15 — called from the 3 slot-0 (host's local player) death sites.
// Returns true if gameOver was fired (so caller can `return;`). Solo
// path is byte-identical: handleSlotDeathInCoop returns true → gameOver
// runs, exactly like before.
function playerSlot0DiedOrGameOver() {
  const slot0 = playerSlots[0] || null;
  const shouldEnd = handleSlotDeathInCoop(slot0);
  if (shouldEnd) {
    gameOver();
    return true;
  }
  // D18.15a — slot 0 is now a spectator that can walk. Don't set deadAt
  // (that would halt guest prediction and kill the legacy "dead pose"
  // renderer). The body's coopSpectating flag and forceFrown render path
  // handle the visual.
  return false;
}

// D18.15 — called from startRoom() to bring spectators back. Each
// spectating slot's hp is set to max(currentHp, max(1, floor(maxHp * 25%)))
// so that any HP-modifying boon picked while dead stacks on top of the
// 25% floor instead of being clobbered. Body is teleported to the
// room's spawn position (already done elsewhere in startRoom) and the
// spectator flag is cleared.
function revivePartialHpSpectators() {
  for (let i = 0; i < playerSlots.length; i++) {
    const s = playerSlots[i];
    if (!s || !s.body) continue;
    if (!s.body.coopSpectating) continue;
    const maxHp = (s.metrics && s.metrics.maxHp) || BASE_PLAYER_HP;
    const floorHp = Math.max(1, Math.floor(maxHp * 0.25));
    const currHp = (s.metrics && s.metrics.hp) || 0;
    if (s.metrics) s.metrics.hp = Math.max(currHp, floorHp);
    s.body.coopSpectating = false;
    s.body.deadAt = 0;
    s.body.invincible = 2.0;
    s.body.distort = 0;
    s.body.vx = 0;
    s.body.vy = 0;
    s.body.respawnSeq = ((s.body.respawnSeq | 0) + 1) >>> 0;
    sparks(s.body.x, s.body.y, '#6ad1ff', 18, 180);
    // Slot 0 mirrors body fields onto the legacy `player` global; sync hp.
    if (i === 0) {
      hp = s.metrics.hp;
      player.deadAt = 0;
    }
  }
}

// C2d-2 — guest slot auto-aim + fire. Slot 1 has fresh-default UPG (no
// boons/crits/pierce/bounce/homing/spread), so the fire path is drastically
// simpler than host's firePlayer(): build charge while still, find nearest
// enemy, fire a single default bullet stamped with ownerId=slot.id.
// Host firing remains the legacy path for bit-identity in solo.
// Phase D0b: removed the simplified `fireGuestSlot` helper. Guest slots now
// fire through the same slot-driven `firePlayer` path as the host, so boon
// effects (shockwave, echo, overload, volleys, ...) apply uniformly once
// guest UPG state is networked in. Solo is byte-identical because slot 0's
// metrics/timers/aim are live getter/setter bridges onto the legacy globals.

function updateGuestFire(dt, combatActive) {
  if (!combatActive) return;
  for (let i = 1; i < playerSlots.length; i++) {
    const slot = playerSlots[i];
    if (!slot) continue;
    const body = slot.body;
    if (!body || (slot.metrics.hp || 0) <= 0) continue;
    const upg = slot.upg;
    const mv = slot.input ? slot.input.moveVector() : { active: false };
    const isStill = !mv.active;
    // D12 — when the remote-input adapter has no fresh frame, treat the slot
    // as "no signal": don't charge, don't autofire, and cap the fire timer
    // exactly as we would for a moving slot. This prevents the host from
    // spamming bullets for slot 1 whenever the guest's input batch is in
    // flight or lost (the pre-D12 behavior locked onto a stale still=1
    // frame and fired continuously).
    const noSignal = !!mv.stale;

    // D12.4 — REMOVED the free "+dt while still" charge build. Pre-D12.4
    // slot 1 charged at 1.0/s automatically just by being still, letting
    // it autofire indefinitely without earning charge through gameplay.
    // Slot 1 now gains charge only through kinetic movement (in
    // updateGuestSlotMovement, gated on UPG.moveChargeRate, mirrored
    // from host) — matching slot 0's design where standing still does
    // NOT regen charge on its own.

    if (enemies.length === 0) { slot.aim.hasTarget = false; continue; }
    const target = pickPlayerAutoTarget(body.x, body.y);
    if (!target) { slot.aim.hasTarget = false; continue; }
    slot.aim.angle = Math.atan2(target.e.y - body.y, target.e.x - body.x);
    slot.aim.hasTarget = true;

    if ((slot.metrics.charge || 0) < 1) continue;
    const interval = 1 / ((upg.sps || 0.8) * 2);
    slot.metrics.fireT = (slot.metrics.fireT || 0) + dt;
    if (!isStill || noSignal) slot.metrics.fireT = Math.min(slot.metrics.fireT, interval);
    if (slot.metrics.fireT >= interval && isStill && !noSignal) {
      slot.metrics.fireT = slot.metrics.fireT % interval;
      firePlayer(slot, target.e.x, target.e.y);
    }
  }
}

// C2d-1b — second pass over danger bullets to hit guest slots. Runs after the
// host's main danger-bullet loop (which already splices any bullet that hit
// slot 0). Any bullet that survived that pass and now overlaps a guest is
// consumed here.
function processGuestDangerBulletHits(ts) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    if (!b || b.state !== 'danger') continue;
    for (let si = 1; si < playerSlots.length; si++) {
      const slot = playerSlots[si];
      if (!slot) continue;
      const body = slot.body;
      if (!body || (slot.metrics.hp || 0) <= 0) continue;
      if (body.invincible > 0) continue;
      const dx = b.x - body.x;
      const dy = b.y - body.y;
      const rr = b.r + body.r;
      if (dx * dx + dy * dy <= rr * rr) {
        applyDangerDamageToGuestSlot(slot, getProjectileHitDamage(), b.col || getThreatPalette().danger.hex);
        bullets.splice(i, 1);
        break;
      }
    }
  }
}

// Phase C2d — Target-selection for enemies. Picks the nearest living slot,
// tie-break by slot.id ASC (canonical ordering so both peers agree once
// networking lands). Dead slots (hp<=0) are skipped so enemies don't camp
// a corpse. Returns null only if every slot is dead.
//
// Determinism: in solo (only slot 0 present), returns slot 0 → behavior is
// bit-identical to the pre-C2d direct-player-singleton code path.
function getEnemyTargetSlot(enemy) {
  let best = null;
  let bestDistSq = Infinity;
  for (let i = 0; i < playerSlots.length; i++) {
    const slot = playerSlots[i];
    if (!slot) continue;
    const body = slot.body;
    if (!body || typeof body.x !== 'number') continue;
    if ((slot.metrics.hp || 0) <= 0) continue;
    const dx = body.x - enemy.x;
    const dy = body.y - enemy.y;
    const d2 = dx * dx + dy * dy;
    if (best === null || d2 < bestDistSq) {
      best = slot;
      bestDistSq = d2;
    } else if (d2 === bestDistSq && slot.id < best.id) {
      best = slot;
    }
  }
  return best;
}

// D5a — pick the slot that represents "this browser's player". For solo /
// host / COOP_DEBUG this collapses to slot 0 (byte-identical). For an online
// guest, this is slot 1 once D5b installs the guest's local body; until then
// it falls back to slot 0 so render code never NPEs.
function getLocalRenderSlot() {
  return getLocalSlot(playerSlots) || playerSlots[0] || null;
}

function drawGuestSlots(ts) {
  const localIdx = getLocalSlotIndex();
  for (let i = 0; i < playerSlots.length; i++) {
    if (i === localIdx) continue;
    const slot = playerSlots[i];
    if (!slot) continue;
    const body = slot.body;
    // D18.15 — coop spectator: dead partner still walks around but at
    // 30% opacity with a frown. No aim arrow / charge ring while dead.
    const isSpectator = !!(body && body.coopSpectating);
    if (!isSpectator) {
      // D13.3 — invuln blink: skip render every other 90ms tick while
      // body.invincible > 0 to mirror the host's slot-0 blink behavior.
      const invuln = (body && body.invincible) ? body.invincible : 0;
      const blinkVisible = invuln <= 0 || Math.floor(ts / 90) % 2 === 0;
      if (!blinkVisible) continue;
    }
    drawGhostSprite(ctx, ts, {
      playerState: body,
      chargeValue: isSpectator ? 0 : slot.metrics.charge,
      maxChargeValue: slot.upg.maxCharge,
      fireProgress: !isSpectator && slot.metrics.charge >= 1 ? (slot.metrics.fireT || 0) / (1 / ((slot.upg.sps || 0.8) * 2)) : 0,
      gameState: gstate,
      // D18.15a — pass real (zero) hp so drawGhostSprite's HP bar fills
      // 0% width. Body still renders normally; forceFrown swaps the
      // smile-eyes for the dead-frown without triggering death pop.
      hpValue: isSpectator ? 0 : slot.metrics.hp,
      maxHpValue: slot.metrics.maxHp,
      forceFrown: isSpectator,
      // D18.16 — internal alpha (set inside drawGhostSprite's save/restore)
      // so iOS Safari can't lose it through nested canvas state changes.
      bodyAlpha: isSpectator ? 0.3 : 1,
      hatKey: coopPartnerHatKey || null,
      colorScheme: coopPartnerColorKey ? getColorSchemeForKey(coopPartnerColorKey) : null,
    });
    if (isSpectator) continue;
    // D19.5 — partner cosmetic sync: orbiting shields. Reads counts/masks
    // off body.coopShield* (populated by snapshotApplier from the wire).
    // Mirrors the local shield draw routine (script.js:6527+) but uses
    // the partner's body and a single canonical hardened/cooldown bit per
    // shield slot. We don't have the precise cooldown timer for the
    // partial-fill regen animation, so cooldown shields just dim — close
    // enough; the partner's shield mechanic is host-arbitrated regardless.
    const pShieldCount = body ? (body.coopShieldCount | 0) : 0;
    if (pShieldCount > 0 && body) {
      const hardenedMask = body.coopShieldHardenedMask | 0;
      const cooldownMask = body.coopShieldCooldownMask | 0;
      for (let si = 0; si < pShieldCount; si++) {
        const sAngle = Math.PI * 2 / pShieldCount * si + simNowMs * SHIELD_ROTATION_SPD;
        const sx = body.x + Math.cos(sAngle) * SHIELD_ORBIT_R;
        const sy = body.y + Math.sin(sAngle) * SHIELD_ORBIT_R;
        const onCooldown = !!(cooldownMask & (1 << si));
        const isHardened = !!(hardenedMask & (1 << si));
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(sAngle + Math.PI * 0.5);
        if (onCooldown) {
          ctx.globalAlpha = 0.3;
          ctx.strokeStyle = C.shieldActive;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(-SHIELD_HALF_W, -SHIELD_HALF_H, SHIELD_HALF_W * 2, SHIELD_HALF_H * 2);
        } else {
          const shieldCol = isHardened ? C.shieldEnhanced : C.shieldActive;
          ctx.shadowColor = shieldCol;
          ctx.shadowBlur = 14;
          ctx.strokeStyle = shieldCol;
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.9;
          ctx.strokeRect(-SHIELD_HALF_W, -SHIELD_HALF_H, SHIELD_HALF_W * 2, SHIELD_HALF_H * 2);
          ctx.shadowBlur = 0;
          ctx.fillStyle = isHardened ? C.getShieldEnhancedRgba(0.18) : C.getShieldActiveRgba(0.18);
          ctx.fillRect(-SHIELD_HALF_W, -SHIELD_HALF_H, SHIELD_HALF_W * 2, SHIELD_HALF_H * 2);
        }
        ctx.restore();
      }
    }
    // D19.5 — partner orb spheres. Use partner color (coopPartnerColorKey)
    // so the host's green orbs and the guest's color orbs visually distinct.
    // No per-orb cooldown over the wire (host-only state) → all rendered
    // at full opacity; close enough since orbs fire rarely and the partner
    // can't predict the fire-cycle anyway.
    const pOrbCount = body ? (body.coopOrbCount | 0) : 0;
    if (pOrbCount > 0 && body) {
      const partnerHexLocal = coopPartnerColorKey ? getColorSchemeForKey(coopPartnerColorKey)?.hex : null;
      const orbCol = partnerHexLocal || C.green;
      const orbR = ORBIT_SPHERE_R; // partner doesn't sync radiusBonus; use base
      const orbVis = 5;            // partner doesn't sync orbSizeMult; use base
      for (let oi = 0; oi < pOrbCount; oi++) {
        const oAngle = Math.PI * 2 / pOrbCount * oi + simNowMs * ORBIT_ROTATION_SPD;
        const ox = body.x + Math.cos(oAngle) * orbR;
        const oy = body.y + Math.sin(oAngle) * orbR;
        ctx.save();
        ctx.shadowColor = orbCol;
        ctx.shadowBlur = 12;
        ctx.fillStyle = orbCol;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(ox, oy, orbVis, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
      }
    }
    // D13.4 — aim arrow for the guest slot. Mirrors the host slot-0
    // triangle drawn near script.js:4759. Hidden when the slot has no
    // current target so guests don't see a stray arrow during downtime.
    const aim = slot.aim;
    if (aim && aim.hasTarget && body) {
      const drift = Math.sin(ts * 0.01) * 0.8;
      const radius = body.r || 14;
      const dist = radius + AIM_ARROW_OFFSET + drift;
      const cx = body.x + Math.cos(aim.angle) * dist;
      const cy = body.y + Math.sin(aim.angle) * dist;
      const triH = AIM_TRI_SIDE * 0.8660254;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(aim.angle);
      // D18.9 — partner's aim reticle is the partner's color, not ours.
      // Falls through to local C.green when the coop-color handshake hasn't
      // landed yet (and for solo COOP_DEBUG split-screen, where there's no
      // partner color anyway).
      const partnerHex = coopPartnerColorKey ? getColorSchemeForKey(coopPartnerColorKey)?.hex : null;
      ctx.fillStyle = partnerHex ? C.getRgba(partnerHex, 0.6) : C.getRgba(C.green, 0.6);
      ctx.beginPath();
      ctx.moveTo((triH * 2) / 3, 0);
      ctx.lineTo(-(triH / 3), AIM_TRI_SIDE / 2);
      ctx.lineTo(-(triH / 3), -(AIM_TRI_SIDE / 2));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}

const telemetryController = createRunTelemetryController({
  getHp: () => hp,
  getMaxHp: () => maxHp,
  getCharge: () => charge,
  getUpg: () => UPG,
  getRoomPhase: () => roomPhase,
  getRoomTimer: () => roomTimer,
  getRoomIndex: () => roomIndex,
  getScore: () => score,
  getTookDamageThisRoom: () => tookDamageThisRoom,
  getEnemies: () => enemies,
  getBullets: () => bullets,
  getPlayerColor: () => getPlayerColor(),
  getViewportModeLabel: () => getViewportModeLabel(),
  getCanvasSize: () => ({ width: WORLD_W, height: WORLD_H }),
  getVersionNum: () => VERSION.num,
  getRequiredShotCount: (u) => getRequiredShotCount(u),
  getKineticChargeRate: (u) => getKineticChargeRate(u),
  onRoomClear: (room) => {
    awardRoomClearBonuses(room);
    awardFiveRoomScoreBonus();
  },
});
const {
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
  createRunTelemetry,
  roundTelemetryValue,
} = telemetryController;

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
    healedThisRoom: slot0Timers.killSustainHealedThisRoom,
    healPlayer,
    source,
    config: KILL_SUSTAIN_CAP_CONFIG,
  });
  slot0Timers.killSustainHealedThisRoom = result.healedThisRoom;
  return result.applied;
}

function awardFiveRoomScoreBonus() {
  const runForStreak = telemetryController.getRun();
  if (!runForStreak) return;
  awardScore(computeFiveRoomCheckpointBonus(runForStreak.rooms), 'streak');
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

// gainCharge / healPlayer live here because they mutate actual game state
// (charge, hp) in addition to calling the telemetry recorders.
function gainCharge(amount, source) {
  if (amount <= 0) return 0;
  const before = charge;
  charge = Math.min(UPG.maxCharge, charge + amount);
  const gained = charge - before;
  const wasted = amount - gained;
  if (wasted > 0) recordChargeWasted(wasted);
  return recordChargeGain(source, gained);
}

function healPlayer(amount, source) {
  if (amount <= 0) return 0;
  const before = hp;
  hp = Math.min(maxHp, hp + amount);
  return recordHeal(source, hp - before);
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
  return createRoomObstaclesImpl(width, height, {
    margin: M,
    gridSize: GRID_SIZE,
    wallCubeSize: WALL_CUBE_SIZE,
  });
}

function resolveEntityObstacleCollisions(entity, maxPasses = 3) {
  return resolveEntityObstacleCollisionsImpl(entity, roomObstacles, maxPasses);
}

function isEntityOverlappingObstacle(entity) {
  return isEntityOverlappingObstacleImpl(entity, roomObstacles);
}

function ejectEntityFromObstacles(entity) {
  return ejectEntityFromObstaclesImpl(entity, roomObstacles);
}

function resolveBulletObstacleCollision(bullet) {
  return resolveBulletObstacleCollisionImpl(bullet, roomObstacles);
}

function hasObstacleLineBlock(ax, ay, bx, by, pad = 1.5) {
  return hasObstacleLineBlockImpl(ax, ay, bx, by, roomObstacles, pad);
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
  player.x = WORLD_W / 2;
  player.y = WORLD_H / 2;
  player.vx = 0;
  player.vy = 0;
  showRoomIntro(`WAVE ${nextWaveIndex + 1}`, false);
}

function startRoom(idx) {
  tookDamageThisRoom = false;
  slot0Timers.vampiricRestoresThisRoom = 0;
  slot0Timers.killSustainHealedThisRoom = 0;
  _orbFireTimers = []; _orbCooldown = [];
  slot0Timers.volatileOrbGlobalCooldown = 0;
  runBoonHook('onRoomStart', { UPG, slot: playerSlots[0] || null });
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
  roomObstacles = createRoomObstacles(WORLD_W, WORLD_H);
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
  player.x = WORLD_W / 2;
  player.y = WORLD_H / 2;
  player.vx = 0;
  player.vy = 0;
  // D12.4 — reset guest slot 1 body alongside host's (slot 0) so the
  // guest's character respawns at the room's center on every transition.
  // Pre-D12.4: slot 1's body retained whatever position it was at when
  // the previous room cleared, leading to a "guest stuck off-spawn" feel
  // after each boon screen. The roomChanged force-anchor in
  // snapshotApplier propagates this reset to the guest's predicted body.
  for (let i = 1; i < playerSlots.length; i++) {
    const s = playerSlots[i];
    if (!s || !s.body) continue;
    const sx = WORLD_W / 2 + (i === 1 ? 60 : -60);
    const sy = WORLD_H / 2;
    s.body.x = sx;
    s.body.y = sy;
    s.body.vx = 0;
    s.body.vy = 0;
    s.body.spawnX = sx;
    s.body.spawnY = sy;
    s.body.invincible = Math.max(s.body.invincible || 0, 1.0);
    s.body.distort = 0;
    // D20.1 — reset position-snap history so the first frame from the new
    // room triggers a fresh snap (not treated as "already snapped").
    if (s.input && typeof s.input.resetSnapHistory === 'function') {
      try { s.input.resetSnapHistory(); } catch (_) {}
    }
  }
  // D20.1 — flush the remote ring buffer on room start so position stamps
  // from the previous room (which can still be inside the buffer and
  // within the stale-tick threshold) don't snap the guest body to the
  // wrong position, causing the visible "blink" at round start.
  if (coopInputSync) {
    try { coopInputSync.getRemoteRingBuffer().clear?.(); } catch (_) {}
  }
  // D18.15 — coop spectator-on-death: revive any slot that died last
  // room at 25% maxHp (or current hp, whichever is higher so HP boons
  // stack). Solo runs have no spectators so this is a no-op.
  revivePartialHpSpectators();
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
          random: () => simRng.next(),
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
    width: WORLD_W,
    height: WORLD_H,
    margin: M,
    roomIndex,
    nextEnemyId: simState.nextEnemyId++,
    isBoss,
    bossScale,
    hpMultiplier: isOnlineCoopRun() ? ONLINE_COOP_ENEMY_HP_MULT : 1,
  });
  if(enemy.forcePurpleShots) roomPurpleShooterAssigned = true;
  resolveEntityObstacleCollisions(enemy);
  enemies.push(enemy);
}

function pickFallbackShooterType() {
  if(roomIndex < 2) return 'chaser';
  if(roomIndex < 5) return simRng.next() < 0.7 ? 'chaser' : 'sniper';
  const pool = ['chaser', 'sniper', 'disruptor', 'zoner'];
  return pool[Math.floor(simRng.next() * pool.length)];
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

function spawnEB(ex,ey, angleOverride = null, target = player) {
  spawnAimedEnemyBullet({
    bullets,
    player: target,
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

function spawnDBB(ex,ey, angleOverride = null, target = player) {
  spawnAimedEnemyBullet({
    bullets,
    player: target,
    x: ex,
    y: ey,
    angleOverride,
    bulletSpeedScale,
    extras: { doubleBounce: true, bounceCount: 0 },
    onSpawn: recordDangerBulletSpawn,
  });
}

function spawnTB(ex,ey, target = player) {
  spawnAimedEnemyBullet({
    bullets,
    player: target,
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
function spawnEliteTriangleBullet(ex, ey, target = player) {
  const a = Math.atan2(target.y - ey, target.x - ex) + (simRng.next() - 0.5) * 0.18;
  const spd = (145 + simRng.next() * 40) * bulletSpeedScale();
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
    // D18.10b — coop bullet color attribution. Returns null for solo /
    // host's own bullets (preserves byte-identical canvas output) and the
    // partner's colorScheme for bullets owned by the remote slot.
    getOwnerColorScheme: (bullet) => {
      try {
        if (!coopPartnerColorKey) return null;
        if (bullet == null || bullet.ownerId == null) return null;
        const localIdx = getLocalSlotIndex();
        if (bullet.ownerId === localIdx) return null;
        return getColorSchemeForKey(coopPartnerColorKey) || null;
      } catch (_) { return null; }
    },
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

function firePlayer(slot, tx, ty) {
  if (!slot) return;
  const body = slot.body;
  // D18.15 — coop spectator: dead player can't fire.
  if (body && body.coopSpectating) return;
  const upg = slot.upg;
  const metrics = slot.metrics;
  const timers = slot.timers;
  const aim = slot.aim;
  const ownerId = slot.id;
  if ((metrics.charge || 0) < 1) return;
  const aimDx = tx - body.x;
  const aimDy = ty - body.y;
  if (Math.abs(aimDx) > 0.001 || Math.abs(aimDy) > 0.001) {
    aim.angle = Math.atan2(aimDy, aimDx);
    aim.hasTarget = true;
  }
  const angs = buildPlayerShotPlan({
    tx,
    ty,
    player: body,
    upg,
  });

  const availableShots = Math.min(Math.floor(metrics.charge), angs.length);
  if (availableShots <= 0) return;

  const snipeScale = 1 + upg.snipePower * 0.18;
  const bspd = 230 * GLOBAL_SPEED_LIFT * Math.min(2.0, upg.shotSpd) * snipeScale;
  const baseRadius = 4.5 * Math.min(2.5, upg.shotSize) * (1 + upg.snipePower * 0.15);
  // Predator's Instinct: apply kill streak damage multiplier (25% per kill, max +125%)
  const predatorBonus = upg.predatorInstinct && upg.predatorKillStreak >= 2 ? 1 + Math.min(upg.predatorKillStreak * 0.25, 1.25) : 1;
  // Dense Core desperation bonus: extra damage at critical charge (1 cap)
  const denseDesperationBonus = (upg.denseTier > 0 && upg.maxCharge === 1) ? DENSE_DESPERATION_BONUS : 1;
  const lateBloomMods = getLateBloomMods(roomIndex || 0);
  // Escalation: per-kill damage in current room (max +40%)
  const escalationBonus = upg.escalation ? 1 + Math.min((upg.escalationKills || 0) * ESCALATION_KILL_PCT, ESCALATION_MAX_BONUS) : 1;
  // Fire-rate scaling penalty: -4% damage per SPS tier so speed builds trade individual power for volume
  const spsFireRateScaling = Math.max(0.5, 1 - (upg.spsTier || 0) * 0.04);
  // Sustained Fire bonus: +3% damage per consecutive shot, max +45%, decays 1s after last shot
  const sustainedFireBonus = Math.min(1.45, 1 + Math.min(upg.sustainedFireShots || 0, 15) * 0.03);
  const baseDmg = (1 + upg.snipePower * 0.35) * (upg.playerDamageMult || 1) * (upg.denseDamageMult || 1) * (upg.heavyRoundsDamageMult || 1) * predatorBonus * denseDesperationBonus * lateBloomMods.damage * escalationBonus * sustainedFireBonus * spsFireRateScaling * 10;
  const lifeMs = PLAYER_SHOT_LIFE_MS * (upg.shotLifeMult || 1) * (upg.phantomRebound ? 2.0 : 1.0);
  const now = simNowMs;
  const overchargeBonus = (upg.overchargeVent && metrics.charge >= upg.maxCharge) ? 1.6 : 1;
  const volleyTotalDamageMult = getVolleyTotalDamageMultiplier(availableShots);
  const volleyPerBulletDamageMult = volleyTotalDamageMult / availableShots;
  
  // Overload converts the full bank into one scaled volley worth the charge it burns.
  let overloadBonus = 1;
  let overloadSizeScale = 1;
  let chargeSpent = availableShots;
  if (upg.overload && upg.overloadActive && metrics.charge >= upg.maxCharge) {
    chargeSpent = Math.max(availableShots, Math.floor(metrics.charge));
    overloadBonus = chargeSpent / availableShots;
    overloadSizeScale = getOverloadSizeScale(chargeSpent);
    upg.overloadActive = false;
    upg.overloadCooldown = 3000;
  }

  const volleySpecs = buildPlayerVolleySpecs({
    shots: angs,
    availableShots,
    player: body,
    upg,
    bulletSpeed: bspd,
    baseRadius,
    baseDamage: baseDmg * volleyPerBulletDamageMult,
    lifeMs,
    overchargeBonus,
    overloadBonus,
    overloadSizeScale,
    getPierceLeft: (shot) => upg.pierceTier + ((shot.isRing && upg.corona) ? 1 : 0),
    getBloodPactHealCap,
    now,
    ownerId,
  });
  volleySpecs.forEach((spec) => pushOutputBullet({ bullets, ...spec }));
  const shotsVolleyRoom = telemetryController.getCurrentRoom();
  if (shotsVolleyRoom) shotsVolleyRoom.shotsFired = (shotsVolleyRoom.shotsFired || 0) + volleySpecs.length;
  metrics.charge = Math.max(0, metrics.charge - chargeSpent);
  recordShotSpend(chargeSpent);
  sparks(body.x, body.y, C.green, 4 + Math.min(6, availableShots + Math.floor((chargeSpent - availableShots) / Math.max(1, availableShots))), 55);
  
  // Shockwave: fire a radial push on full-charge fire
  if (upg.shockwave && availableShots === Math.floor(upg.maxCharge) && upg.shockwaveCooldown <= 0) {
    upg.shockwaveCooldown = 2250;
    for (const e of enemies) {
      const dx = e.x - body.x;
      const dy = e.y - body.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0) {
        e.vx = (dx / dist) * 300;
        e.vy = (dy / dist) * 300;
      }
    }
    sparks(body.x, body.y, '#ffaa00', 20, 250);
    shockwaves.push({ x: body.x, y: body.y, r: 10, maxR: 220, life: 1, color: getPlayerColorScheme().hex });
  }
  
  if (upg.echoFire) {
    const nextEcho = (timers && typeof timers.echoCounter === 'number') ? timers.echoCounter + 1 : 1;
    if (nextEcho >= 5) {
      if (timers) timers.echoCounter = 0;
      const eNow = simNowMs;
      const echoSpecs = buildPlayerVolleySpecs({
        shots: angs,
        availableShots,
        player: body,
        upg: { ...upg, critChance: 0 },
        bulletSpeed: bspd,
        baseRadius,
        baseDamage: baseDmg * volleyPerBulletDamageMult,
        lifeMs,
        overchargeBonus: 1,
        overloadBonus: 1,
        overloadSizeScale: 1,
        getPierceLeft: (shot) => upg.pierceTier + ((shot.isRing && upg.corona) ? 1 : 0),
        getBloodPactHealCap,
        now: eNow,
        ownerId,
        random: () => 1,
        damageVarianceMin: 1,
        damageVarianceMax: 1,
      });
      echoSpecs.forEach((spec) => pushOutputBullet({ bullets, ...spec }));
      const shotsEchoRoom = telemetryController.getCurrentRoom();
      if (shotsEchoRoom) shotsEchoRoom.shotsFired = (shotsEchoRoom.shotsFired || 0) + echoSpecs.length;
    } else if (timers) {
      timers.echoCounter = nextEcho;
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

// R4: dispatch effect descriptors produced by hostSimStep during rollback resim.
// Only fires for corrected (post-rollback) ticks — non-rollback ticks leave the
// queue empty because skipSimStepOnForward=true skips hostSimStep on the forward path.
function dispatchSimEffects(effects) {
  if (!effects || effects.length === 0) return;
  const threat = getThreatPalette();
  const playerCol = getPlayerColorScheme().hex;
  for (const fx of effects) {
    const x = fx.x ?? 0;
    const y = fx.y ?? 0;
    switch (fx.kind) {
      case 'danger.directHit':
      case 'danger.phaseDashHit':
      case 'contact.rusherHit':
        if (Number.isFinite(fx.damage)) spawnDmgNumber(x, y, fx.damage, threat.danger.hex);
        sparks(x, y, C.danger, 10, 85);
        break;
      case 'output.enemyHit':
        if (Number.isFinite(fx.damage)) spawnDmgNumber(x, y, fx.damage, playerCol);
        sparks(x, y, playerCol, 5, 55);
        break;
      case 'output.enemyKilled':
        sparks(x, y, threat.elite.hex, 14, 95);
        break;
      case 'danger.lifelineTriggered':
        sparks(x, y, C.lifelineEffect, 16, 100);
        break;
      case 'danger.colossusShockwave':
        sparks(x, y, threat.advanced.hex, 14, 120);
        break;
      case 'danger.empRemovedBullet':
        sparks(x, y, '#fbbf24', 4, 100);
        break;
      case 'output.volatileBurst':
        sparks(x, y, playerCol, 8, 100);
        break;
      default:
        break;
    }
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

function resumePlayAfterBoons() {
  // D18.5 — if the user bailed to the main menu while the boon picker was
  // open (via the pause-controller's exitToMenu), gstate is already 'start'.
  // Any deferred boon-click that fires after that exit must NOT restart the
  // sim or flip pause-button visibility, otherwise the start screen ends up
  // showing the in-run pause button and the loop ticks behind the menu.
  if (gstate === 'start' || gstate === 'gameover') {
    onlineCoopBoonPhase = null;
    currentBoonPhaseId = null;
    pendingCoopBoonPicks = { hostDone: false, guestDone: false };
    if (coopBoonAfkTimer) {
      try { clearTimeout(coopBoonAfkTimer); } catch (_) {}
      coopBoonAfkTimer = null;
    }
    try { document.getElementById('s-up')?.classList.add('off'); } catch (_) {}
    return;
  }
  // Phase D10/D14 — multi-room boon handshake. Online host: when both peers
  // have picked their boon (or AFK auto-resolved), advance the room. Slot 1's
  // UPG evolves independently from per-peer picks — no mirror call. Broadcast
  // coop-room-advance so guest's picker / wait overlay clears even before the
  // next snapshot lands.
  if (onlineCoopBoonPhase && isCoopHost && isCoopHost()) {
    try {
      if (activeCoopSession && typeof activeCoopSession.sendGameplay === 'function') {
        activeCoopSession.sendGameplay({ kind: 'coop-room-advance', roomIndex: roomIndex + 1, hostSimTick: simTick });
      }
    } catch (err) {
      try { console.warn('[coop] coop-room-advance send failed', err); } catch (_) {}
    }
    onlineCoopBoonPhase = null;
    currentBoonPhaseId = null;
    pendingCoopBoonPicks = { hostDone: false, guestDone: false };
    if (coopBoonAfkTimer) {
      try { clearTimeout(coopBoonAfkTimer); } catch (_) {}
      coopBoonAfkTimer = null;
    }
  }
  startRoom(roomIndex + 1);
  gstate = 'playing';
  lastT = performance.now();
  simAccumulatorMs = 0;
  raf = requestAnimationFrame(loop);
  btnPause.style.display = 'inline-flex';
  btnPatchNotes.style.display = 'none';
}

// C2e — per-player boon picker queue. Host picks first (via the legacy
// showUpgrades flow), then each guest slot picks from its own UPG pool before
// play resumes. Guest picks are simpler: fresh-default UPG, no legendaries,
// no reroll economy — just 3 standard choices applied to slot.upg.
let pendingBoonSlotQueue = [];

function advanceCoopBoonQueue() {
  if (!COOP_DEBUG) return false;
  while (pendingBoonSlotQueue.length > 0) {
    const nextSlot = pendingBoonSlotQueue.shift();
    if (!nextSlot || (nextSlot.metrics.hp || 0) <= 0) continue;
    showUpgradesForGuestSlot(nextSlot);
    return true;
  }
  return false;
}

function showUpgradesForGuestSlot(slot) {
  gstate = 'upgrade';
  cancelAnimationFrame(raf);
  showBoonSelection({
    upg: slot.upg,
    hp: slot.metrics.hp,
    maxHp: slot.metrics.maxHp,
    rerolls: 0,
    onSelect: (boon) => {
      const state = { hp: slot.metrics.hp, maxHp: slot.metrics.maxHp };
      const evolvedBoon = getEvolvedBoon(boon, slot.upg);
      evolvedBoon.apply(slot.upg, state);
      slot.metrics.hp = state.hp;
      slot.metrics.maxHp = state.maxHp;
      try { (slot.upg.boonSelectionOrder = slot.upg.boonSelectionOrder || []).push(evolvedBoon.name); } catch (_) {}
      document.getElementById('s-up').classList.add('off');
      if (advanceCoopBoonQueue()) return;
      resumePlayAfterBoons();
    },
  });
}

function showUpgrades() {
  gstate='upgrade'; cancelAnimationFrame(raf);
  saveRunState();
  UPG._roomIndex = roomIndex;
  // C2e — enqueue guest slots so they pick after host. Guests share the same
  // between-room trigger but apply choices to their own UPG clone.
  if (COOP_DEBUG) {
    pendingBoonSlotQueue = playerSlots.filter((s) => s && s.id !== 0 && (s.metrics.hp || 0) > 0);
  } else {
    pendingBoonSlotQueue = [];
  }
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
      // R0.5 — remove from rejected list when accepted (array.filter instead of Set.delete)
      legendaryRejectedIds = legendaryRejectedIds.filter(id => id !== leg.id);
      syncRunChargeCapacity(); boonHistory.push(leg.name);
      document.getElementById('s-up').classList.add('off');
      UPG._boonAppliedForRoom = roomIndex + 1;
      saveRunState();
      if (advanceCoopBoonQueue()) return;
      if (markHostBoonDoneIfOnline()) return;
      resumePlayAfterBoons();
    },
    onLegendaryReject: (leg) => {
      // R0.5 — add to rejected array and record room (instead of Set.add / Map.set)
      if (!legendaryRejectedIds.includes(leg.id)) {
        legendaryRejectedIds.push(leg.id);
      }
      legendaryRoomsSinceRejection[leg.id] = roomIndex;
      pendingLegendary = null;
      boonHistory.push('Reject-' + leg.name);
      document.getElementById('s-up').classList.add('off');
      if (advanceCoopBoonQueue()) return;
      if (markHostBoonDoneIfOnline()) return;
      resumePlayAfterBoons();
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
      if (advanceCoopBoonQueue()) return;
      if (onLocalBoonPickedOnline(0, boon)) return;
      resumePlayAfterBoons();
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
  // C2f — coop runs don't submit to the solo leaderboard.
  // C3a-pre-1: key off isCoopRun() (unified gate for COOP_DEBUG + online).
  if (isCoopRun()) {
    clearLegacyRunRecovery();
    return;
  }
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
// Controller owns the overlay state, DOM wiring, Escape toggle, and confirm dialog.
// See src/ui/pauseController.js for the implementation.
// Module-level refs kept here so game-state paths (game over, win, restart, etc.)
// can still toggle the pause button visibility without routing through the controller.
const btnPause = document.getElementById('btn-pause');
const btnPatchNotes = document.getElementById('btn-patch-notes');
const pausePanel = document.getElementById('pause-panel');
const pauseBoonsPanel = document.getElementById('pause-boons-panel');
const pauseControls = createPauseController({
  getGameState: () => gstate,
  setGameState: (next) => { gstate = next; },
  getUpg: () => UPG,
  cancelLoop: () => cancelAnimationFrame(raf),
  restartLoop: () => {
    lastT=performance.now(); simAccumulatorMs=0;
    raf = requestAnimationFrame(loop);
  },
  clearSavedRun: () => clearSavedRun(),
  setMenuChromeVisible: (v) => setMenuChromeVisible(v),
  openLeaderboard: () => openLeaderboardScreen(),
  openPatchNotes: () => setPatchNotesOpen(true),
  // D18.3 — unified coop teardown so exit-to-menu during a coop run never
  // leaks listeners/timers into the menu chrome.
  onExitToMenu: () => teardownCoopRunFully('pause-exit-to-menu'),
});
const pauseGame = pauseControls.pauseGame;
const resumeGame = pauseControls.resumeGame;
const showPauseConfirm = pauseControls.showPauseConfirm;

// ── RUN PERSISTENCE ────────────────────────────────────────────────────────────
const SAVED_RUN_KEY = STORAGE_KEYS.savedRun;

function saveRunState() {
  // C2f — coop runs don't persist (save path assumes solo globals only).
  // C3a-pre-1: key off isCoopRun() so both COOP_DEBUG and real online trip
  // the same gate.
  if (isCoopRun()) return;
  const state = {
    UPG: { ...UPG },
    score, kills, hp, maxHp, charge,
    roomIndex, runElapsedMs,
    boonRerolls, damagelessRooms,
    boonHistory: [...boonHistory],
    legendaryOffered,
    pendingLegendaryId: pendingLegendary ? pendingLegendary.id : null,
    bossClears,
    runTelemetry: (() => {
      const rt = telemetryController.getRun() || {};
      return { ...rt, roomHistory: [...(rt.roomHistory || [])] };
    })(),
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
    telemetryController.setRun(saved.runTelemetry);
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
  player = createInitialPlayerState(WORLD_W, WORLD_H);
  installPlayerSlot0();
  bullets.length = 0; enemies.length = 0; clearParticles(); shockwaves.length = 0;
  resetBulletIds();
  currentRunId = generateRunId();
  _orbFireTimers = []; _orbCooldown = [];
  resetJoystickState(joy);
  fireT = 0; stillTimer = 0; prevStill = false;
  gameOverShown = false;
  tookDamageThisRoom = false;
  clearSavedRun();
}

// Phase D10 superseded C3a-min-1's single-room termination — endCoopDemoRun
// has been removed. Online coop now flows through enterOnlineCoopBoonPhaseHost
// → showUpgrades → resumePlayAfterBoons every room. Solo / COOP_DEBUG paths
// continue to use showUpgrades directly.

function gameOver(){
  if(gameOverShown) return;
  gameOverShown = true;
  clearSavedRun();
  finalizeCurrentRoomTelemetry('death');
  gstate='dying';
  player.deadAt = simNowMs;
  player.popAt = player.deadAt + GAME_OVER_ANIM_MS * 0.72;
  player.deadPulse = 0;
  player.deadPop = false;
  pushLeaderboardEntry();
  // D15 — coop end-of-run handoff. Capture the coop transport session +
  // role/code BEFORE teardownCoopInputUplink nulls activeCoopSession, so the
  // post-game screen can still send/receive coop-rematch / coop-leave.
  const wasCoopRun = (() => { try { return isCoopRun(); } catch (_) { return false; } })();
  if (wasCoopRun) {
    coopRematchSession = activeCoopSession;
    // D18.10 — guest has no authoritative sim, so its locally-built payload
    // has empty scoreBreakdown / 0 kills. The host's coop-game-over packet
    // (handled in handleCoopGameOverPacket) is the source of truth for
    // breakdown/stats/boonIds. Only rebuild on host, or as a fallback if
    // the host packet hasn't arrived yet.
    const isLocalHost = coopRematchRole === 'host' || (() => { try { return isCoopHost(); } catch (_) { return false; } })();
    if (isLocalHost || !coopGameOverPayload) {
      coopGameOverPayload = buildCoopGameOverPayload();
    }
  }
  // D12.2 — propagate game-over to the partner peer BEFORE we tear down the
  // input uplink (which disposes the gameplay channel). Otherwise the guest
  // sits forever watching the host's last-snapshot pose with no game-over UI.
  // Host broadcasts; guest mirrors via the existing onGameplay listener.
  // D15 — extended payload: include both peers' display names so the coop
  // end screen can render the same roster on both sides.
  try {
    if (isCoopHost()) {
      if (activeCoopSession && typeof activeCoopSession.sendGameplay === 'function') {
        const overPayload = wasCoopRun ? coopGameOverPayload : { score, roomIndex };
        Promise.resolve(activeCoopSession.sendGameplay({ kind: 'coop-game-over', ...overPayload })).catch((err) => {
          try { console.warn('[coop] coop-game-over send failed', err); } catch (_) {}
        });
      }
    }
  } catch (err) {
    try { console.warn('[coop] coop-game-over send threw', err); } catch (_) {}
  }
  // C3a-pre-1: disarm coop run flag so subsequent solo starts aren't treated
  // as coop. pushLeaderboardEntry above already consulted isCoopRun().
  try { clearCoopRun(); } catch (_) {}
  teardownCoopInputUplink();
  // D15 — after teardown, install the standalone post-game listener so we
  // can still receive coop-rematch / coop-leave from the partner. Solo runs
  // skip this entirely (no rematch session captured).
  if (wasCoopRun && coopRematchSession) {
    installCoopRematchListener();
  }
}

function init() {
  const runMetrics = createInitialRunMetrics(BASE_PLAYER_HP);
  const runtimeTimers = createInitialRuntimeTimers();
  clearLegacyRunRecovery();
  clearSavedRun();
  // If COOP_DEBUG is set and no real-online coop is armed, arm a local-role
  // coop run so the same C2f gates (save/continue/leaderboard) and future
  // lockstep plumbing treat the same-device harness identically to online.
  // The seed still comes from URL/time below — this is a local-only arm
  // that real online coop would replace via `armPendingCoopRun` from the
  // lobby onReady path.
  if (COOP_DEBUG) {
    const debugSeed = ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0) || 1;
    try { armPendingCoopRun({ role: 'local', seed: debugSeed, code: null, session: null }); } catch (_) {}
  }
  // Seed the simulation RNG.
  // Precedence (highest first):
  //   1. Armed coop run seed (online lobby handshake, or COOP_DEBUG same-device)
  //   2. ?seed=N URL param (deterministic replay pin)
  //   3. Time-based seed (solo default)
  // See docs/coop-multiplayer-plan.md §2 and src/net/coopRunConfig.js.
  const armedCoop = consumePendingCoopRun();
  const urlSeed = (typeof window !== 'undefined' && window.location)
    ? parseSeedParam(new URLSearchParams(window.location.search).get('seed'))
    : null;
  let runSeed;
  if (armedCoop) {
    // URL seed still wins for coop debug (local arm) so `?seed=N&coopdebug=1`
    // can pin replays. Real online coop won't have URL seed contention
    // because join-room flow is UI-driven, not URL-driven.
    runSeed = (armedCoop.role === 'local' && urlSeed != null) ? urlSeed : armedCoop.seed;
    try { console.info('[seed] coop run seed', runSeed, 'role', armedCoop.role); } catch (_) {}
  } else if (urlSeed != null) {
    runSeed = urlSeed;
    try { console.info('[seed] run pinned to seed', runSeed); } catch (_) {}
  } else {
    runSeed = ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0) || 1;
  }
  simRng.reseed(runSeed);
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
  simState.nextEnemyId = runMetrics.enemyIdSeq;
  resetBulletIds();
  currentRunId = generateRunId();
  bossClears = runMetrics.bossClears;
  playerAimAngle = -Math.PI * 0.5;
  playerAimHasTarget = false;
  player = createInitialPlayerState(WORLD_W, WORLD_H);
  installPlayerSlot0();
  slot0Timers.barrierPulseTimer = runtimeTimers.barrierPulseTimer;
  slot0Timers.slipCooldown = runtimeTimers.slipCooldown;
  slot0Timers.absorbComboCount = runtimeTimers.absorbComboCount;
  slot0Timers.absorbComboTimer = runtimeTimers.absorbComboTimer;
  slot0Timers.chainMagnetTimer = runtimeTimers.chainMagnetTimer;
  slot0Timers.echoCounter = runtimeTimers.echoCounter;
  slot0Timers.vampiricRestoresThisRoom = runtimeTimers.vampiricRestoresThisRoom;
  slot0Timers.killSustainHealedThisRoom = runtimeTimers.killSustainHealedThisRoom;
  slot0Timers.colossusShockwaveCd = runtimeTimers.colossusShockwaveCd;
  slot0Timers.volatileOrbGlobalCooldown = runtimeTimers.volatileOrbGlobalCooldown;
  _orbFireTimers=[]; _orbCooldown=[];
  boonHistory=[]; pendingLegendary=null; legendaryOffered=false;
  legendaryRejectedIds=[]; legendaryRoomsSinceRejection={}; // R0.5 — reset to plain array/object
  telemetryController.resetRun();
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
  // Phase D3: install coop input uplink after run state is live.
  // armedCoop was consumed at the top of init() and used only for seeding.
  // The session reference is preserved on the consumed record so we can
  // re-install here. No-op for solo runs. simTick reset to 0 so guest's
  // first frame tags clientTick=0.
  simTick = 0;
  installCoopInputUplink(armedCoop);
}

// ── MAIN LOOP ─────────────────────────────────────────────────────────────────
function loop(ts){
  if(gstate!=='playing' && gstate!=='dying') return;
  try {
    const frameMs = Math.min(ts - lastT, MAX_FRAME_DT_MS);
    lastT = ts;
    simAccumulatorMs += frameMs;
    const frameStartTs = ts;
    // D18.11 — coop disconnect gate. Returns true while soft-paused; in
    // that state we still keep RAF alive (so this very check + recovery
    // continue to run + the snapshot/heartbeat handlers continue to fire)
    // but skip the sim-step loop and any host snapshot broadcast for this
    // frame. simAccumulatorMs is reset by recoverCoopSoftDisconnect on
    // resume so we don't fire a catch-up burst. Inert outside coop runs
    // (gate short-circuits when activeCoopSession is null).
    const coopFrozen = checkCoopLivenessGate(frameStartTs);
    if (coopFrozen) {
      simAccumulatorMs = 0;
      try { draw(simNowMs); } catch (_) {}
      try { hudUpdate(); } catch (_) {}
      raf = requestAnimationFrame(loop);
      return;
    }
    let steps = 0;
    while (simAccumulatorMs >= SIM_STEP_MS && steps < MAX_SIM_STEPS_PER_FRAME) {
      simNowMs += SIM_STEP_MS;
      simTick++;
      update(SIM_STEP_SEC, simNowMs);
      // Phase D4.5: after update() finishes, ack the remote input frame
      // for this sim tick (if any). MUST come before broadcaster.tick so
      // the snapshot's lastProcessedInputSeq[1] reflects the just-consumed
      // tick rather than lagging by one cadence period.
      if (hostRemoteInputProcessor) {
        try { hostRemoteInputProcessor.tick(simTick); } catch (err) {
          try { console.warn('[coop] remote input processor error', err); } catch (_) {}
        }
      }
      // R1 — rollback coordinator input capture + snapshot (after update()).
      // skipSimStepOnForward=true means the coordinator does NOT re-run movement
      // here; it only records inputs, buffers a post-update snapshot, and checks
      // for remote-input divergence (triggering hostSimStep-based resim if needed).
      // Gated by ROLLBACK_ENABLED so there is zero cost in solo / D-series runs.
      if (ROLLBACK_ENABLED) {
        // R4 pause/intro safety: only snapshot/resim during active combat phases.
        // During intro, both peers are in the same deterministic pre-combat state,
        // but intro-phase snapshots can cause cross-boundary resims where the gate
        // property (which reads current roomPhase) disagrees with the snapshotted
        // phase, producing movement that never happened live. gstate !== 'playing'
        // already short-circuits the RAF loop during boon-select and pause;
        // this gate handles the in-room intro window.
        const _rollbackActive = roomPhase === 'spawning' || roomPhase === 'fighting';
        // Drain effectQueue regardless of phase so async rollback corrections from
        // the previous frame never accumulate into the next snapshot. Only dispatch
        // visual effects when we're in a phase that makes them meaningful.
        try {
          const _fx = drainSimEffectQueue(simState);
          if (_fx.length > 0 && _rollbackActive) dispatchSimEffects(_fx);
        } catch (err) {
          try { console.warn('[rollback] effect drain error', err); } catch (_) {}
        }
        if (_rollbackActive) {
          try {
            const _stepResult = coordinatorStep({
              joy: {
                dx:     joy.dx     || 0,
                dy:     joy.dy     || 0,
                active: !!joy.active,
                mag:    joy.mag    || 0,
              },
            }, SIM_STEP_SEC);
            if (_stepResult && _stepResult.stalled) {
              try { console.warn('[rollback] coordinator stalled — remote input age exceeds maxRollbackTicks'); } catch (_) {}
            }
          } catch (err) {
            try { console.warn('[rollback] coordinatorStep error', err); } catch (_) {}
          }
        }
      }
      // Phase D4: host emits a snapshot every ticksPerSnapshot sim ticks.
      // No-op on guest/solo. Tick-cadence (not ms) so behavior is
      // deterministic and resilient to rAF jitter / tab unfreeze bursts.
      if (coopSnapshotBroadcaster) {
        try { coopSnapshotBroadcaster.tick(simTick); } catch (err) {
          try { console.warn('[coop] snapshot tick error', err); } catch (_) {}
        }
      }
      simAccumulatorMs -= SIM_STEP_MS;
      steps++;
    }
    if (steps >= MAX_SIM_STEPS_PER_FRAME) {
      // Hit the catch-up cap — drop any further backlog so we don't
      // fall further behind on the next frame. This sacrifices a few
      // ms of sim time during heavy stalls (tab switch, GC pause) to
      // keep the loop responsive.
      simAccumulatorMs = 0;
    }
    // Phase D5c: guest applies the latest remote snapshot once per frame
    // with interpolation. The applier holds a 2-snapshot buffer and renders
    // entities at `renderTimeMs - renderDelayMs`, lerping between prev and
    // curr by id. Solo / host: applier is null, hook skipped.
    // Order: AFTER sim ticks (host's update path is a no-op on guest), and
    // BEFORE draw, so this frame's render reflects the interpolated state.
    if (guestSnapshotApplier && latestRemoteSnapshot) {
      // D18.3 — disconnect watchdog. If we've received at least one snapshot
      // (recvAtMs > 0) but it's older than the timeout, the host's transport
      // is dead. Trip once, run unified teardown. Skipped while no snapshots
      // have arrived yet (initial connection) so a slow handshake doesn't
      // bounce us back to the menu prematurely.
      // D18.6 — also skipped while we're in the boon-phase / upgrade gstate
      // because the host intentionally cancels its RAF + stops emitting
      // snapshots until both peers pick. A 30s timeout is plenty long for a
      // real network drop, but unconditional ticking here would still trip
      // on a fast boon picker if either peer takes >30s.
      const inBoonOrUpgrade = (currentBoonPhaseId !== null) || (gstate === 'upgrade');
      if (
        !coopWatchdogTripped &&
        !inBoonOrUpgrade &&
        latestRemoteSnapshotRecvAtMs > 0 &&
        (frameStartTs - latestRemoteSnapshotRecvAtMs) > COOP_WATCHDOG_TIMEOUT_MS
      ) {
        tripCoopDisconnectWatchdog();
      }
      try {
        const result = guestSnapshotApplier.apply(latestRemoteSnapshot, {
          enemies,
          bullets,
          slotsById: { 0: playerSlots[0] || null, 1: playerSlots[1] || null },
        }, {
          renderTimeMs: frameStartTs,
          snapshotRecvAtMs: latestRemoteSnapshotRecvAtMs,
        });
        if (result && result.applied) {
          // Mirror room phase + score from authoritative state. Intentionally
          // NOT runElapsedMs (advanced locally on guest in update()'s
          // isCoopGuest branch — overwriting at ~10 Hz would jitter the HUD).
          if (result.room) {
            const prevRoomIndex = roomIndex;
            const prevRoomPhase = roomPhase;
            roomIndex = result.room.index;
            roomPhase = result.room.phase;
            // D12.2 — sync the room intro overlay on guest. Host runs the
            // advanceRoomIntroPhase state machine in update() (skipped on
            // guest), so without this the "READY?" panel would stick on
            // screen for the whole run. Show on entering 'intro' (new room),
            // hide on leaving it.
            if (roomPhase === 'intro' && (prevRoomPhase !== 'intro' || roomIndex !== prevRoomIndex)) {
              try { showRoomIntro('READY?', false); } catch (_) {}
            } else if (prevRoomPhase === 'intro' && roomPhase !== 'intro') {
              // D20.2 — show GO! briefly before hiding, matching host's intro state machine.
              try { showRoomIntro('GO!', true); } catch (_) {}
              try { setTimeout(() => { try { hideRoomIntro(); } catch (_) {} }, 600); } catch (_) {}
            }
            // D18.13 — sync the ROOM CLEAR flash overlay on guest. Host
            // calls finalizeRoomClearState → showRoomClear() inside its
            // update path (skipped on guest), so without this the guest
            // never sees the "ROOM CLEAR" message between rooms. Trigger
            // once on the prevRoomPhase!=='clear' → 'clear' edge. Use the
            // boss overlay for boss-room indices (9, 19, 29, 39+).
            if (roomPhase === 'clear' && prevRoomPhase !== 'clear') {
              try {
                const isBossRoom = !!(BOSS_ROOMS && BOSS_ROOMS[roomIndex]);
                if (isBossRoom) showBossDefeated();
                else showRoomClear();
              } catch (_) {}
            }
          }
          if (Number.isFinite(result.score)) score = result.score;
          // Phase D5e — reconciliation. Once per fresh snapshot, compare our
          // predicted slot 1 body against an authoritative replay from the
          // host's state-at-snapshot, replaying our locally-buffered inputs
          // forward to current simTick. The applier left body x/y untouched
          // (predictedSlotId=1 → skipBody) so we can correct it directly.
          const snap = latestRemoteSnapshot;
          const snapSeq = snap && snap.snapshotSeq;
          if (
            !ROLLBACK_ENABLED &&
            guestPredictionReconciler &&
            snap &&
            Number.isFinite(snapSeq) &&
            snapSeq !== lastReconciledSnapshotSeq
          ) {
            try {
              const slot1 = playerSlots[1];
              const body = slot1 && slot1.body;
              const authSlot = snap.slots && snap.slots.find(s => s && s.id === 1);
              const fromTick = snap.lastProcessedInputSeq && snap.lastProcessedInputSeq[1];
              // Skip if guest body absent, slot 1 not yet known to host, or
              // host hasn't ack'd any of our input ticks yet — nothing to
              // anchor the replay on. The next snapshot may carry it.
              if (
                body &&
                authSlot &&
                authSlot.alive &&
                (body.deadAt | 0) === 0 &&
                Number.isFinite(fromTick) &&
                fromTick !== null
              ) {
                const toTick = simTick | 0;
                if (toTick >= fromTick) {
                  // D19.6b — pass current slot speedMult-derived speed so
                  // a guest with Ghost Velocity replays at the right speed.
                  const slotUpg = slot1 && slot1.upg;
                  const replaySpeed = 165 * GLOBAL_SPEED_LIFT * Math.min(2.5, (slotUpg?.speedMult || 1));
                  // D19.6c — collision-aware replay: each replayed tick
                  // resolves against current room obstacles so corrected
                  // targets respect walls/corners. resolveEntityObstacleCollisions
                  // mutates the entity in-place (matches reconciler API).
                  const corrected = guestPredictionReconciler.replay(
                    { x: authSlot.x, y: authSlot.y, vx: authSlot.vx, vy: authSlot.vy },
                    fromTick | 0,
                    toTick,
                    SIM_STEP_SEC,
                    body.r || 0,
                    replaySpeed,
                    resolveEntityObstacleCollisions,
                  );
                  if (corrected) {
                    const ex = corrected.x - body.x;
                    const ey = corrected.y - body.y;
                    const errMag = Math.hypot(ex, ey);
                    if (errMag >= RECONCILE_HARD_SNAP_PX) {
                      // Hard snap always fires — large drift means
                      // prediction is genuinely unrecoverable (input
                      // dropped, host re-anchored, etc.) and a wedge
                      // can't account for >96 px error.
                      body.x = corrected.x;
                      body.y = corrected.y;
                    } else if (errMag > RECONCILE_SOFT_DEAD_ZONE_PX && !lastGuestPredictionWedged) {
                      // D18.16 — skip soft pull when the predicted body
                      // is clamped against an obstacle. Replay has no
                      // collisions so the auth target sits inside/past
                      // the wall; pulling toward it would re-jam every
                      // snapshot. Next tick where input clears the wall
                      // contact, drift converges normally.
                      body.x += ex * RECONCILE_SOFT_FACTOR;
                      body.y += ey * RECONCILE_SOFT_FACTOR;
                    }
                  }
                }
              }
              lastReconciledSnapshotSeq = snapSeq;
            } catch (recErr) {
              try { console.warn('[coop] reconcile error', recErr); } catch (_) {}
              lastReconciledSnapshotSeq = snapSeq;
            }
          }
          // D19.1 — bullet local-advance reconcile. Once per fresh snapshot,
          // age each authoritative predictable bullet ('output'/'danger')
          // forward by (simTick - snapshotSimTick) ticks of linear+bounce
          // motion, then snap/soft-pull/leave the local pool. Despawns any
          // pool entry whose id no longer appears in the snapshot.
          if (
            guestBulletLocalAdvance &&
            snap &&
            Number.isFinite(snapSeq) &&
            snapSeq !== lastBulletReconciledSnapshotSeq
          ) {
            try {
              const snapSimTick = Number.isFinite(snap.snapshotSimTick) ? (snap.snapshotSimTick | 0) : (simTick | 0);
              const ticksElapsed = (simTick | 0) - snapSimTick;
              guestBulletLocalAdvance.reconcile(snap.bullets || [], ticksElapsed);
              lastBulletReconciledSnapshotSeq = snapSeq;
            } catch (bRecErr) {
              try { console.warn('[coop] bullet reconcile error', bRecErr); } catch (_) {}
              lastBulletReconciledSnapshotSeq = snapSeq;
            }
          }
        }
        // D19.1 — splice the local pool's predicted bullets into the
        // render-time bullets[] array. The applier just rebuilt the array
        // with snapshot-lerped entries for ALL bullet states. We strip
        // out the predictable states and replace them with our locally
        // advanced versions so they render at sim-time-now (matching the
        // body) instead of sim-time-now-renderDelayMs.
        if (guestBulletLocalAdvance) {
          try {
            for (let bi = bullets.length - 1; bi >= 0; bi--) {
              const b = bullets[bi];
              if (b && b.state && BULLET_PREDICTABLE_STATES.has(b.state)) {
                bullets.splice(bi, 1);
              }
            }
            const advanced = guestBulletLocalAdvance.getBullets();
            for (let bi = 0; bi < advanced.length; bi++) bullets.push(advanced[bi]);
          } catch (spliceErr) {
            try { console.warn('[coop] bullet splice error', spliceErr); } catch (_) {}
          }
        }
        // D18.6 — stamp decayStart on grey bullets locally. The wire format
        // does NOT carry decayStart (it's a render-only value on host); the
        // bullet renderer's age math collapses to NaN without it and orbs
        // never fade out on guest. We track when each grey bullet id was
        // first seen and write it back so the renderer can compute alpha
        // identically to host. Also GC entries whose bullet ids are no
        // longer present so the map can't grow unbounded across rooms.
        try {
          const liveIds = new Set();
          for (let bi = 0; bi < bullets.length; bi++) {
            const b = bullets[bi];
            if (!b) continue;
            const id = b.id;
            if (id == null) continue;
            liveIds.add(id);
            if (b.state === 'grey') {
              let stamp = guestGreyDecayStartByBulletId.get(id);
              if (stamp == null) {
                stamp = simNowMs;
                guestGreyDecayStartByBulletId.set(id, stamp);
              }
              b.decayStart = stamp;
            } else {
              // Re-arm: a bullet that exits grey should re-stamp on next
              // grey transition. Drop any prior stamp.
              if (guestGreyDecayStartByBulletId.has(id)) {
                guestGreyDecayStartByBulletId.delete(id);
              }
            }
          }
          if (guestGreyDecayStartByBulletId.size > 0) {
            for (const id of guestGreyDecayStartByBulletId.keys()) {
              if (!liveIds.has(id)) guestGreyDecayStartByBulletId.delete(id);
            }
          }
        } catch (decayErr) {
          try { console.warn('[coop] grey-decay stamp error', decayErr); } catch (_) {}
        }
        // D19.4 — any-owner bullet spawn muzzle. Detect bullet ids that
        // weren't in any prior snapshot we processed and emit a small
        // spark burst at their position so they don't materialize from
        // thin air. Dispatcher routes color by ownerSlot/state:
        //   • state==='danger' (enemy shot) → C.red
        //   • ownerSlot===0 (host's player shot, partner on guest screen)
        //     → coopPartnerColorKey hex if known, else C.green fallback
        //   • ownerSlot===1 (guest's own shot) → C.green, but skipped if
        //     D19.2's local fireT-wrap already fired the muzzle this
        //     fire-cycle. Conservative dedup: skip slot==1 entirely;
        //     D19.2 owns that slot. Drift between charge clocks is rare
        //     and the missed muzzle is the lesser evil vs double-flash.
        //   • Charge orbs (state==='grey' from a player) → light ghost
        //     spark so harvested orbs visually emerge from the kill.
        try {
          if (guestBulletSpawnDetector) {
            const fresh = guestBulletSpawnDetector.detectNewSpawns(bullets, simTick);
            for (let fi = 0; fi < fresh.length; fi++) {
              const b = fresh[fi];
              if (!b || typeof b !== 'object') continue;
              let col = null;
              let count = 4;
              const owner = b.ownerSlot | 0;
              if (b.state === 'danger') {
                col = C.red;
                count = 5;
              } else if (b.state === 'grey') {
                // Greys don't really "spawn" — they're harvested from
                // killed enemies. A subtle ghost spark on first sight
                // gives the orb visual continuity instead of popping in.
                col = C.ghost || C.grey;
                count = 3;
              } else if (owner === 1) {
                // D19.2 owns the local guest's muzzle. Skip to avoid
                // double-flash; markSeen so eviction still ages out.
                continue;
              } else if (owner === 0) {
                const partnerHex = coopPartnerColorKey ? (getColorSchemeForKey(coopPartnerColorKey)?.hex || null) : null;
                col = partnerHex || C.green;
                count = 4;
              } else {
                col = C.green;
              }
              try { spawnSparks(b.x, b.y, col, count, 50); } catch (_) {}
            }
          }
        } catch (spawnErr) {
          try { console.warn('[coop] spawn-muzzle dispatch error', spawnErr); } catch (_) {}
        }
      } catch (err) {
        try { console.warn('[coop] snapshot apply error', err); } catch (_) {}
      }
    }
    draw(simNowMs); hudUpdate();
    raf=requestAnimationFrame(loop);
  } catch(error) {
    handleGameLoopCrash(error);
  }
}

// ── UPDATE ────────────────────────────────────────────────────────────────────
function finalizeRoomClearState(){
  roomPhase = 'clear';
  roomClearTimer = 0;
  bullets.length = 0;
  clearParticles();
  runBoonHook('onRoomClear', { UPG, healPlayer, slot: playerSlots[0] || null });
  finalizeCurrentRoomTelemetry('clear');
  applyRoomClearProgression();
  showRoomClear();
}

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
      // D15 — coop runs land on the dedicated end screen with REMATCH/LEAVE.
      // gameOver() captures coopRematchSession before clearing the coop run
      // flag, so isCoopRun() can't be used here; presence of the session +
      // role is the canonical "this was a coop run" signal.
      if (coopRematchSession && coopRematchRole) {
        showCoopGameOverScreen(coopGameOverPayload || buildCoopGameOverPayload());
        return;
      }
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

  // ── PHASE D2: GUEST GATE ─────────────────────────────────────────────────
  // When our role is 'guest', the host peer owns the authoritative simulation.
  // We skip the entire local sim; enemies/bullets/scoring/room-progression are
  // driven by host snapshots (applied in D4+). The guest still advances its
  // own frame-clock (for interpolation), collects local input (D3 uplink),
  // and renders via draw(). Solo (no active coop run) and COOP_DEBUG
  // (role:'local') keep the full sim — never negate; always check === 'guest'.
  if (isCoopGuest()) {
    runElapsedMs += dt * 1000;
    simNowMs += dt * 1000;
    prevStill = true;
    // D20.2 — joystick drift anchor runs for guest too. Without this,
    // sweeping touches cause the virtual thumb to walk away from its anchor
    // point over time, making the guest feel sluggish compared to host.
    if (roomPhase === 'fighting' || roomPhase === 'spawning') {
      try { tickJoystick(joy, dt); } catch (_) {}
    }
    // Phase D3: guest samples local input once per sim tick and batches
    // quantized frames to the host. sampleFrame auto-flushes when the
    // batch hits size 4 (~15 msg/s at 60 Hz, well under Supabase's
    // 20 msg/s cap). Errors inside sendGameplay are logged and do not
    // interrupt the guest's render loop.
    try { coopInputSync && coopInputSync.sampleFrame(simTick); } catch (err) {
      try { console.warn('[coop] sampleFrame error', err); } catch (_) {}
    }
    // Phase D5d — predict slot 1 movement locally for instant input
    // response. Applier (predictedSlotId:1) won't clobber body x/y/vx/vy
    // continuously, but will still re-anchor on death/respawn/runId reset.
    // Aim, hp, charge, invulnT continue to come from snapshot.
    if (onlineGuestSlot1Installed) {
      try { updateOnlineGuestPrediction(dt); } catch (err) {
        try { console.warn('[coop] guest prediction error', err); } catch (_) {}
      }
    }
    // D19.1 — advance the guest's local bullet pool by dt seconds. Runs
    // every frame so 'output'/'danger' bullets travel on the same clock
    // as the predicted body, eliminating the body-vs-world misalignment
    // that made grey/danger contact feel mistimed pre-D19.
    if (guestBulletLocalAdvance) {
      try { guestBulletLocalAdvance.advance(dt); } catch (err) {
        try { console.warn('[coop] bullet advance error', err); } catch (_) {}
      }
    }
    // D18.6 — tick guest-local cosmetics. Without this, particles +
    // dmgNumbers + shockwaves + payloadCooldownMs are spawned (via the
    // applier's onSlotDamage callback at hit time) but never decay/fade,
    // freezing the bullet+number at the hit location forever. This block
    // mirrors the host's tick block at ~5350 below; identical math so guest
    // and host see the same visual lifetimes.
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= Math.pow(.84, dt * 60); p.vy *= Math.pow(.84, dt * 60);
      p.life -= p.decay * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = dmgNumbers.length - 1; i >= 0; i--) {
      const d = dmgNumbers[i];
      d.y -= 40 * dt;
      d.life -= 1.8 * dt;
      if (d.life <= 0) dmgNumbers.splice(i, 1);
    }
    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const s = shockwaves[i];
      s.r += (s.maxR - s.r) * Math.min(1, dt * 4.5);
      s.life -= dt * 1.4;
      if (s.life <= 0 || s.r >= s.maxR - 0.5) shockwaves.splice(i, 1);
    }
    if (payloadCooldownMs > 0) payloadCooldownMs = Math.max(0, payloadCooldownMs - dt * 1000);
    // D18.6 — animate per-slot fire-ready ring locally on guest. Snapshots
    // omit fireT (intentional, cosmetic-only on host), so without ticking
    // here the charge ring sits empty even when the slot is fully charged.
    // Reset to 0 on charge<1 so the ring starts from the top of the cycle
    // each time the slot crests full charge.
    try {
      for (let si = 0; si < playerSlots.length; si++) {
        const sl = playerSlots[si];
        if (!sl) continue;
        const m = sl.metrics;
        if (!m) continue;
        const maxC = m.maxCharge || 1;
        const chargeFrac = (m.charge || 0) / maxC;
        if (chargeFrac < 1) {
          m.fireT = 0;
          guestLocalFireTBySlotId.set(sl.id, 0);
        } else {
          // D18.12 — match solo player's fireT logic (script.js:4933-4947):
          //   const mobileChargeMult = isStill ? 1.0 : (UPG.mobileChargeRate || 0.10);
          //   fireT += dt * mobileChargeMult;
          //   if (!isStill) fireT = min(fireT, interval);  // cap while moving
          //   if (fireT >= interval && isStill && hasTarget) fireT %= interval;
          // While moving, the ring still ADVANCES (just at ~10% rate) up to
          // the interval cap, matching the solo "ring slowly fills while
          // running" feel. While still + has-target, it wraps and the host
          // would actually be firing. isStill from snapshot velocity;
          // hasTarget from snapshot aim.hasTarget.
          const sps = (sl.upg && sl.upg.sps) || 0.8;
          const interval = 1 / Math.max(0.001, sps * 2);
          const body = sl.body || {};
          const speed2 = (body.vx || 0) * (body.vx || 0) + (body.vy || 0) * (body.vy || 0);
          const isStill = speed2 < 1; // ~1 px/s threshold
          const hasTarget = !!(sl.aim && sl.aim.hasTarget);
          const mobileChargeMult = isStill ? 1.0 : ((sl.upg && sl.upg.mobileChargeRate) || 0.10);
          const prev = guestLocalFireTBySlotId.get(sl.id) || 0;
          let next = prev + dt * mobileChargeMult;
          if (!isStill) {
            if (next > interval) next = interval;
          } else if (hasTarget && next >= interval) {
            next = next % interval;
            // D19.2 — guest muzzle prediction. The wrap edge above is
            // exactly when host's updateGuestFire would call firePlayer
            // for this slot. Emit cosmetic muzzle VFX (sparks + a short
            // directional streak in the aim direction) so pressing fire
            // feels instant on guest. The actual bullet still arrives
            // ~RTT later via snapshot+local-advance — no predicted bullet
            // is spawned here, so there's no rollback risk and no chance
            // of a phantom bullet that never matches an auth shot.
            // Gated to slot 1 (the guest's own player); slot 0 is the
            // host's body — predicting their muzzle would risk drift
            // between guest's mirrored-charge clock and host's real one.
            if (sl.id === 1 && body && sl.aim) {
              try {
                spawnSparks(body.x, body.y, C.green, 4, 55);
                spawnMuzzleStreak(body.x, body.y, sl.aim.angle || 0, C.green);
              } catch (_) {}
            }
          } else if (!hasTarget && next > interval) {
            // still + no target: cap (host wouldn't fire either)
            next = interval;
          }
          guestLocalFireTBySlotId.set(sl.id, next);
          m.fireT = next;
        }
      }
    } catch (fireErr) {
      try { console.warn('[coop] guest fireT tick error', fireErr); } catch (_) {}
    }
    return;
  }

  const W=WORLD_W,H=WORLD_H;
  recordRoomPeakState();
  const titanSlow = UPG.colossus ? 1 - (1 - (UPG.titanSlowMult || 1)) * 0.5 : (UPG.titanSlowMult || 1);
  const bloodRushMult = UPG.bloodRush && UPG.bloodRushTimer > ts ? 1 + ((UPG.bloodRushStacks || 0) * 0.10) : 1;
  const lateBloomMoveMods = getLateBloomMods(roomIndex || 0);
  const BASE_SPD=165*GLOBAL_SPEED_LIFT*Math.min(2.5,(UPG.speedMult || 1) * titanSlow * bloodRushMult * lateBloomMoveMods.speed);
  const joyMax = joy.max || JOY_MAX;

  // Drift anchor when thumb wanders far past max radius
  if(roomPhase === 'fighting' || roomPhase === 'spawning') tickJoystick(joy, dt);

  // ── Player movement — virtual joystick (R0.4 chunk 1: extracted to src/sim/playerMovement.js)
  applyJoystickVelocity(player, joy, BASE_SPD, JOY_DEADZONE, joyMax, roomPhase !== 'intro');
  // R0.4 chunk 2: substep position integration with phase-walk obstacle handling.
  tickBodyPosition(player, dt, { W, H, M }, {
    phaseWalk: !!UPG.phaseWalk,
    phaseWalkMaxOverlapMs: PHASE_WALK_MAX_OVERLAP_MS,
    phaseWalkIdleEjectMs: PHASE_WALK_IDLE_EJECT_MS,
    resolveCollisions: resolveEntityObstacleCollisions,
    isOverlapping: isEntityOverlappingObstacle,
    eject: ejectEntityFromObstacles,
  });
  // R0.4 step 3 — post-movement deterministic decrements (body transients,
  // shield array sync, slot timer block, volatile orb global cooldown,
  // per-orb cooldown loop) extracted to src/sim/postMovementTick.js.
  tickPostMovementTimers(player, player.shields, slot0Timers, _orbCooldown, dt, {
    shieldTier: UPG.shieldTier,
    shieldTempered: !!UPG.shieldTempered,
    colossusActive: !!UPG.colossus,
  });
  updateGuestSlotMovement(dt, W, H);
  tickGuestSlotTimers(dt);

  // Shield cooldown tick (separate helper). runBoonHook touches only UPG.*
  // cooldowns, not slot timers/orb cooldowns, so its order vs the helper
  // above is behavior-irrelevant (verified in src/systems/boonHooks.js).
  tickShieldCooldowns(player.shields, dt, UPG.shieldTempered);
  runBoonHook('onTick', { UPG, dt, ts, slot: playerSlots[0] || null });
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
      finalizeRoomClearState();
    }
  }

  if(shouldForceClearFromCombat({
    roomPhase,
    enemiesCount: enemies.length,
    spawnQueueLen: spawnQueue.length,
  })){
    finalizeRoomClearState();
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
    if (isOnlineCoopRun()) {
      // Phase D10: enter the multi-room boon handshake. Host runs the
      // standard picker, then mirrors the resulting UPG to slot 1 + signals
      // advance on the gameplay channel (handled in resumePlayAfterBoons).
      enterOnlineCoopBoonPhaseHost();
    } else {
      showUpgrades();
    }
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
        // C3a-core-1: local browser's auto-fire drives the local slot.
        // Solo/host/COOP_DEBUG → slot 0 (byte-identical). Online guest → slot 1.
        firePlayer(getLocalSlot(playerSlots) || playerSlots[0] || null, autoTarget.e.x,autoTarget.e.y);
        UPG.sustainedFireShots = (UPG.sustainedFireShots || 0) + 1;
        UPG.sustainedFireLastShotTime = simNowMs;
      }
    }
  }

  // Decay sustained fire when not actively firing (always checked)
  {
    const now = simNowMs;
    if((UPG.sustainedFireLastShotTime || 0) > 0 && now - UPG.sustainedFireLastShotTime > 1000) {
      UPG.sustainedFireShots = 0;
      UPG.sustainedFireBonus = 1;
    }
  }

  // C2d-2 — guest slots auto-aim + fire using their own charge/UPG.
  if (playerSlots.length > 1) updateGuestFire(dt, combatActive);

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
      // C2d — pick target once per enemy per frame so movement, contact,
      // siphon, and fire aftermath all reference the same slot.
      const targetSlot = getEnemyTargetSlot(e) || playerSlots[0] || null;
      const targetBody = targetSlot ? targetSlot.body : player;
      const targetIsHost = targetBody === player;
      const combatStep = stepEnemyCombatState(e, {
        player: targetBody,
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
        // C2d-1b — drain target slot's charge (bridge-backed for slot 0,
        // own metric for guests). Siphon visual anchors on the target body.
        if(combatStep.shouldDrainCharge){
          const newCharge = Math.max(0, (targetSlot?.metrics.charge || 0) - 2.8*dt);
          if(targetSlot) targetSlot.metrics.charge = newCharge;
          sparks(targetBody.x, targetBody.y, C.siphon, 1, 35);
        }
      } else if(combatStep.kind === 'rusher'){
        // C2d-1b — route contact damage through the target slot. Host retains
        // the full UPG aftermath path; guests use the simplified helper.
        if(combatStep.distanceToPlayer<targetBody.r+e.r+2 && targetBody.invincible<=0){
          if(targetIsHost){
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
            colossusShockwaveCd: slot0Timers.colossusShockwaveCd,
            enableShockwave: true,
            shouldTriggerLastStand: rusherHit.shouldTriggerLastStand,
            playerX: player.x,
            playerY: player.y,
            shotSpeed: 220 * GLOBAL_SPEED_LIFT,
            now: simNowMs,
            bloodPactHealCap: getBloodPactHealCap(),
          });
          if(rusherAftermath.triggerColossusShockwave){
            slot0Timers.colossusShockwaveCd = rusherAftermath.nextColossusShockwaveCd;
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
            if (playerSlot0DiedOrGameOver()) return;
          }
          } else {
            // C2d-1b — guest rusher contact: simple damage + respawn-on-death.
            applyContactDamageToGuestSlot(targetSlot, 18);
          }
        }
      } else {
        if(combatStep.shouldFire){
          fireEnemyBurst(e, {
            player: targetBody,
            bulletSpeedScale,
            obstacles: roomObstacles,
            random: () => simRng.next(),
            canEnemyUsePurpleShots: (enemy) => canEnemyUsePurpleShots(enemy, roomIndex),
            spawnZoner: (idx, total) => spawnZB(e.x, e.y, idx, total),
            spawnEliteZoner: (idx, total, stage) => spawnEliteZB(e.x, e.y, idx, total, stage),
            spawnDoubleBounce: (angle) => spawnDBB(e.x, e.y, angle, targetBody),
            spawnTriangle: () => spawnTB(e.x, e.y, targetBody),
            spawnEliteTriangle: () => spawnEliteTriangleBullet(e.x, e.y, targetBody),
            spawnEliteBullet: (angle, speed, stage) => spawnEliteBullet(e.x, e.y, angle, speed, stage),
            spawnEnemyBullet: (angle) => spawnEB(e.x, e.y, angle, targetBody),
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
        now: simNowMs,
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
        now: simNowMs,
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
  const absorbR = player.r + 5 + UPG.absorbRange + (slot0Timers.barrierPulseTimer > 0 ? UPG.absorbRange + 40 : 0) + (slot0Timers.chainMagnetTimer > 0 ? UPG.absorbRange + 30 : 0);
  const decayMS = DECAY_BASE + UPG.decayBonus;

  // D19.3 — host grey lag-comp: snapshot every grey's pre-update position so
  // the guest-slot pickup check below can match against where the guest's
  // delayed view actually drew the orb. Solo and host-without-guest leave
  // hostGreyLagComp null; this no-ops in that case.
  if (hostGreyLagComp) {
    try { hostGreyLagComp.record(bullets, simTick); } catch (_) {}
  }

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
    // Homing for output bullets — R0.4 step 4a: extracted to bulletRuntime.applyBulletHoming
    if(b.state==='output'&&b.homing&&enemies.length>0){
      applyBulletHoming(b, enemies, dt, {
        homingTier: UPG.homingTier || 1,
        shotSpd: UPG.shotSpd,
        snipePower: UPG.snipePower,
        globalSpeedLift: GLOBAL_SPEED_LIFT,
      });
    }

    if(b.state==='danger'){
      // R0.4 step 4b: gravity-well steering extracted to bulletRuntime.applyDangerGravityWell
      applyDangerGravityWell(b, player, dt, {
        gravityWell: !!UPG.gravityWell,
        range: 96,
      });
    }

    let bounced=false;
    // R0.4 step 4c: sub-stepped integration + wall bounce extracted to bulletRuntime.advanceBulletWithSubsteps
    bounced = advanceBulletWithSubsteps(b, dt, {
      W, H, M,
      resolveObstacleCollision: resolveBulletObstacleCollision,
    });

    // R0.4 step 4d: near-miss telemetry detection extracted to bulletRuntime.detectBulletNearMiss
    detectBulletNearMiss(b, player, telemetryController.getCurrentRoom(), {
      playerInvincible: player.invincible,
    });

    if(bounced){
      // R0.4 step 6: bounce dispatch carved into src/sim/bulletBounceDispatch.js.
      // The pure dispatcher returns {effects, removeSourceBullet, skipRestOfFrame,
      // followUp}. Effects are translated back to the legacy side-effect calls
      // here in caller-land; the descriptor shape matches the effect-queue
      // contract documented in src/sim/simState.js so a future commit-phase
      // resolver can replace this translator without changing the dispatcher.
      const bounceResult = dispatchBulletBounce(b, ts, {
        splitShot: UPG.splitShot,
        splitShotEvolved: UPG.splitShotEvolved,
        phantomRebound: UPG.phantomRebound,
        bounceTier: UPG.bounceTier,
        colors: { grey: C.grey, ghost: C.ghost },
      });
      for(let ei = 0; ei < bounceResult.effects.length; ei++){
        const ef = bounceResult.effects[ei];
        if(ef.kind === 'burstBlueDissipate'){
          burstBlueDissipate(ef.x, ef.y);
        } else if(ef.kind === 'eliteStageAdvanced'){
          applyEliteBulletStage(b, ef.stage);
        } else if(ef.kind === 'sparks'){
          // colorSource='eliteColor' resolves AFTER applyEliteBulletStage has
          // mutated b.eliteColor — descriptor ordering pins this invariant.
          const color = ef.color != null
            ? ef.color
            : (ef.colorSource === 'eliteColor' ? b.eliteColor : C.grey);
          sparks(ef.x, ef.y, color, ef.count, ef.size);
        }
      }
      const fu = bounceResult.followUp;
      if(fu){
        if(fu.kind === 'split'){
          spawnSplitOutputBullets({
            bullets,
            sourceBullet: b,
            splitDeltas: fu.splitDeltas,
            damageFactor: fu.splitDamageFactor,
            expireAt: simNowMs + fu.lifetimeMs,
            fallbackBloodPactHealCap: getBloodPactHealCap(),
          });
        } else if(fu.kind === 'triangle-burst'){
          spawnTriangleBurst(fu.x, fu.y, fu.vx, fu.vy);
        } else if(fu.kind === 'payload-blast'){
          triggerPayloadBlast(b, enemies, ts);
        }
      }
      if(bounceResult.removeSourceBullet){
        bullets.splice(i, 1);
      }
      if(bounceResult.skipRestOfFrame){
        continue;
      }
    }

    if(b.state==='grey'){
      // R0.4 step 4e: decay + expiry extracted to bulletRuntime.tickGreyBulletDecay
      const greyTick = tickGreyBulletDecay(b, ts, dt, { decayMS });
      if(greyTick.expired){ bullets.splice(i,1); continue; }

      // R0.4 step 10 — Region C carved into greyAbsorbDispatch.js.
      // Pre-compute orbit scalars outside the pure dispatcher so it doesn't
      // close over UPG globals (per rubber-duck critique).
      if(UPG.absorbOrbs && UPG.orbitSphereTier>0){
        syncOrbRuntimeArrays(_orbFireTimers, _orbCooldown, UPG.orbitSphereTier);
      }
      const greyResult = detectGreyAbsorb(b, {
        player,
        absorbR,
        slot0Timers,
        UPG,
        simNowMs,
        playerSlots,
        simTick,
        lagComp: hostGreyLagComp,  // null in solo/resim — see greyAbsorbDispatch.js
        ts,
        ORBIT_ROTATION_SPD,
        getOrbitSlotPosition,
        orbitRadius: getOrbitRadius(),
        orbVisualRadius: getOrbVisualRadius(),
        orbCooldowns: _orbCooldown,
        GLOBAL_SPEED_LIFT,
        ghostColor: C.ghost,
      });
      if(greyResult){
        // Apply cosmetic effects (sparks)
        for(const fx of greyResult.effects){
          if(fx.kind==='sparks') sparks(fx.x,fx.y,fx.color,fx.count,fx.size);
        }
        if(greyResult.kind==='slot0'){
          const s0 = greyResult.slot0;
          gainCharge(s0.absorbGain, 'greyAbsorb');
          if(s0.resonantIncrement){
            slot0Timers.absorbComboTimer=1500;
            slot0Timers.absorbComboCount++;
            if(s0.resonantBonusGain>0){
              gainCharge(s0.resonantBonusGain, 'resonantAbsorb');
              slot0Timers.absorbComboCount=0;
            }
          }
          if(s0.refractionSpec){
            pushOutputBullet({ bullets, ...s0.refractionSpec });
          }
          if(s0.refractionCooldownReset){
            UPG.refractionCooldown=900;
            UPG.refractionCount=0;
          } else if(s0.newRefractionCount!==undefined){
            UPG.refractionCount=s0.newRefractionCount;
          }
          if(s0.chainMagnetDuration>0){
            slot0Timers.chainMagnetTimer=s0.chainMagnetDuration;
          }
        } else if(greyResult.kind==='guest'){
          const g = greyResult.guest;
          playerSlots[g.slotIdx].metrics.charge=g.newCharge;
          queueCoopPickupEvent({ slotId: g.slotIdx, x: b.x, y: b.y, kind: 'grey' });
        } else if(greyResult.kind==='orb'){
          const o = greyResult.orb;
          gainCharge(o.absorbGain, 'orbAbsorb');
        }
        bullets.splice(i,1); continue;
      }
    }

    // Volatile Orbs: a danger bullet near any alive orbit sphere destroys the sphere + bullet.
    // R0.4 step 7: collision logic carved into src/sim/volatileOrbDispatch.js.
    if(b.state==='danger' && UPG.volatileOrbs && UPG.orbitSphereTier>0 && slot0Timers.volatileOrbGlobalCooldown<=0){
      syncOrbRuntimeArrays(_orbFireTimers, _orbCooldown, UPG.orbitSphereTier);
      const orbResult = detectVolatileOrbHit(b, {
        orbCooldowns: _orbCooldown,
        orbitSphereTier: UPG.orbitSphereTier,
        ts,
        rotationSpeed: ORBIT_ROTATION_SPD,
        radius: getOrbitRadius(),
        originX: player.x,
        originY: player.y,
        orbHitRadius: getOrbVisualRadius() + 2,
        sparksColor: C.green,
        sparksCount: 10,
        sparksSize: 80,
        orbCooldownValue: VOLATILE_ORB_COOLDOWN,
        globalCooldownValue: VOLATILE_ORB_SHARED_COOLDOWN,
      });
      if(orbResult.hitIndex >= 0){
        _orbCooldown[orbResult.hitIndex] = orbResult.orbCooldownValue;
        slot0Timers.volatileOrbGlobalCooldown = orbResult.globalCooldownValue;
        for(let ei = 0; ei < orbResult.effects.length; ei++){
          const ef = orbResult.effects[ei];
          if(ef.kind === 'sparks') sparks(ef.x, ef.y, ef.color, ef.count, ef.size);
        }
        if(orbResult.removeSourceBullet) bullets.splice(i, 1);
        if(orbResult.skipRestOfFrame) continue;
      }
    }

    // Region E — shield collision (R0.4 step 11; pure dispatcher in src/sim/shieldHitDispatch.js)
    if(b.state==='danger' && player.shields.length>0){
      const shieldResult = detectShieldHit(b, {
        player,
        ts,
        UPG,
        simNowMs,
        shieldOrbitR: SHIELD_ORBIT_R,
        shieldRotationSpd: SHIELD_ROTATION_SPD,
        shieldCooldown: getShieldCooldown(),
        aegisBatteryDamageMult: getAegisBatteryDamageMult(),
        playerShotLifeMs: PLAYER_SHOT_LIFE_MS,
        mirrorShieldDamageFactor: MIRROR_SHIELD_DAMAGE_FACTOR,
        aegisNovaDamageFactor: AEGIS_NOVA_DAMAGE_FACTOR,
        globalSpeedLift: GLOBAL_SPEED_LIFT,
        shieldActiveColor: C.shieldActive,
        shieldEnhancedColor: C.shieldEnhanced,
      });
      if(shieldResult){
        // Telemetry — commit-phase only (never in rollback resim)
        const shieldRoom = telemetryController.getCurrentRoom();
        if(shieldRoom) shieldRoom.safety.shieldBlocks += 1;
        // Apply cosmetic effects
        for(const fx of shieldResult.effects){
          if(fx.kind==='sparks') sparks(fx.x, fx.y, fx.color, fx.count, fx.size);
        }
        const s = player.shields[shieldResult.hitShieldIdx];
        // Mirror reflection output bullet
        if(shieldResult.mirrorCooldown !== null) s.mirrorCooldown = shieldResult.mirrorCooldown;
        if(shieldResult.mirrorReflectionSpec) pushOutputBullet({ bullets, ...shieldResult.mirrorReflectionSpec });
        if(shieldResult.kind === 'temperedAbsorb'){
          s.hardened = false;
        } else {
          // pop path
          if(shieldResult.shieldBurstSpec) spawnRadialOutputBurst({ bullets, ...shieldResult.shieldBurstSpec });
          if(shieldResult.barrierPulseGain > 0){ gainCharge(shieldResult.barrierPulseGain, 'barrierPulse'); slot0Timers.barrierPulseTimer=800; }
          s.cooldown = shieldResult.shieldCooldown; s.maxCooldown = shieldResult.shieldCooldown;
          if(shieldResult.aegisTitanCdShare){ for(const os of player.shields){ if(os!==s && os.cooldown<=0){ os.cooldown=shieldResult.shieldCooldown; os.maxCooldown=shieldResult.shieldCooldown; os.hardened=false; } } }
        }
        bullets.splice(i,1); continue;
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
        const phaseRoom = telemetryController.getCurrentRoom();
        if (phaseRoom) phaseRoom.safety.phaseDashProcs += 1;
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
          if (playerSlot0DiedOrGameOver()) return;
        }
        continue;
      }

      if(dangerHit.kind === 'mirror-tide'){
        const mirrorRoom = telemetryController.getCurrentRoom();
        if (mirrorRoom) mirrorRoom.safety.mirrorTideProcs += 1;
        UPG.mirrorTideRoomUses = dangerHit.nextMirrorTideRoomUses;
        UPG.mirrorTideCooldown = dangerHit.nextMirrorTideCooldown;
        const mNow = simNowMs;
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
          colossusShockwaveCd: slot0Timers.colossusShockwaveCd,
          enableShockwave: true,
          shouldTriggerLastStand: Boolean(UPG.lastStand && dangerHit.lifelineTriggered),
          playerX: player.x,
          playerY: player.y,
          shotSpeed: 220 * GLOBAL_SPEED_LIFT,
          now: simNowMs,
          bloodPactHealCap: getBloodPactHealCap(),
        });
        if(directHitAftermath.triggerColossusShockwave){
          slot0Timers.colossusShockwaveCd = directHitAftermath.nextColossusShockwaveCd;
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
          if (playerSlot0DiedOrGameOver()) return;
        }
        continue;
      }

      const slipstream = resolveSlipstreamNearMiss({
        bullet: b,
        player,
        upgrades: UPG,
        slipCooldown: slot0Timers.slipCooldown,
      });
      if(slipstream.shouldTrigger){
        gainCharge(slipstream.chargeGain, 'slipstream');
        slot0Timers.slipCooldown = slipstream.nextSlipCooldown;
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
          const hitOwnerSlot = b.ownerId ?? b.ownerSlot ?? 0;
          const hitColor = b.crit ? C.ghost : getCoopPlayerColorForSlot(hitOwnerSlot);
          sparks(b.x,b.y,b.crit?C.ghost:C.green,b.crit?8:5,b.crit?70:55);
          spawnDmgNumber(e.x, e.y - e.r, hitResolution.damage, hitColor);
          queueCoopEnemyDamageEvent({
            enemyId: e.eid,
            damage: hitResolution.damage,
            x: e.x,
            y: e.y - e.r,
            ownerSlot: hitOwnerSlot,
          });
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
              random: () => simRng.next(),
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
              const vNow=simNowMs;
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

  // C2d-1b — guest slots take damage from surviving danger bullets.
  if (playerSlots.length > 1) processGuestDangerBulletHits(ts);

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
  const W=WORLD_W,H=WORLD_H;
  // D0a (Phase D world-space): scale world coordinates onto the canvas viewport.
  // Identity when cv.width === WORLD_W (solo + ?coopdebug=1). Only non-identity
  // once online coop (Phase D2+) pins a fixed world size on differently-sized
  // guest devices.
  const renderScale = worldSpace.getRenderScale(cv.width, cv.height);
  ctx.setTransform(renderScale.x, 0, 0, renderScale.y, 0, 0);
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
  // D18.2 — source position + UPG/aim/invuln from the local render slot.
  // On host/solo this collapses to slot 0 (player + UPG + playerAim*) so
  // the determinism canary is unaffected. On the online guest, localIdx is
  // 1, so the ring + blink + aim triangle now anchor to the GUEST's own
  // body using the GUEST's predicted aim instead of the host's slot-0
  // globals (which on a guest reflect the host, not the local player).
  const localRenderSlot = getLocalRenderSlot();
  const localBody = (localRenderSlot && localRenderSlot.body) || player;
  const localUpg = (localRenderSlot && localRenderSlot.upg) || UPG;
  const localAim = (localRenderSlot && localRenderSlot.aim) || null;
  const localAimAngle = localAim ? (localAim.angle || 0) : playerAimAngle;
  const localAimHasTarget = localAim ? !!localAim.hasTarget : playerAimHasTarget;
  const localPayloadCooldown = (localRenderSlot && localRenderSlot.metrics && Number.isFinite(localRenderSlot.metrics.payloadCooldownMs))
    ? localRenderSlot.metrics.payloadCooldownMs
    : payloadCooldownMs;
  if(localUpg.payload && localPayloadCooldown <= 0){
    const hex = getPlayerColorScheme().hex;
    const rr = parseInt(hex.slice(1,3),16), gg = parseInt(hex.slice(3,5),16), bb = parseInt(hex.slice(5,7),16);
    const compR = 255 - rr, compG = 255 - gg, compB = 255 - bb;
    const pulse = 0.4 + 0.3 * Math.sin(ts * 0.006);
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = `rgb(${compR},${compG},${compB})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(localBody.x, localBody.y, localBody.r + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  // D18.15a — coop spectator: never blink. Their body.invincible is the
  // sticky 1e9 sentinel, so the legacy blink would strobe forever. We
  // want a steady 30% alpha render via drawGhost's spectator branch.
  const isLocalSpectator = !!(localBody && localBody.coopSpectating);
  const show = isLocalSpectator || (localBody.invincible || 0)<=0 || Math.floor(ts/90)%2===0;
  if(show){ drawGhost(ts); }
  drawGuestSlots(ts);
  if(show && localAimHasTarget && !isLocalSpectator){
    const drift = Math.sin(ts * 0.01) * 0.8;
    const dist = localBody.r + AIM_ARROW_OFFSET + drift;
    const cx = localBody.x + Math.cos(localAimAngle) * dist;
    const cy = localBody.y + Math.sin(localAimAngle) * dist;
    const triH = AIM_TRI_SIDE * 0.8660254;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(localAimAngle);
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
      const sAngle=Math.PI*2/total*si+simNowMs*SHIELD_ROTATION_SPD;
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
      const sAngle=Math.PI*2/UPG.orbitSphereTier*si+simNowMs*ORBIT_ROTATION_SPD;
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
  if(UPG.voidWalker && UPG.voidZoneActive && UPG.voidZoneTimer > simNowMs){
    ctx.save();
    const frac = Math.max(0, (UPG.voidZoneTimer - simNowMs) / 2000);
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

  // Joystick anchor — tiny subtle dot where finger landed (canvas-pixel coords)
  // D0a: reset transform so joystick UI is drawn in canvas-pixel space, not
  // scaled world space. Solo: identity anyway, so no-op.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
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
// D5a — read body/charge/hp/upg through the local render slot so the online
// guest sees its OWN ghost (slot 1) once the guest body lands in D5b. For
// solo/host/COOP_DEBUG the local slot is slot 0 → bridges to the legacy
// `player`/`UPG`/`charge`/`hp` globals → byte-identical to pre-D5a.
function drawGhost(ts){
  const slot = getLocalRenderSlot();
  const body = slot ? slot.body : player;
  // D18.15 — coop spectator: render local player at 30% alpha + frown
  // when dead but still walking.
  const isSpectator = !!(body && body.coopSpectating);
  const slotUpg = slot ? slot.upg : UPG;
  const slotMetrics = slot ? slot.metrics : null;
  const chargeValue = slotMetrics ? slotMetrics.charge : charge;
  const maxChargeValue = slotUpg ? slotUpg.maxCharge : UPG.maxCharge;
  const fireTValue = slotMetrics ? (slotMetrics.fireT || 0) : fireT;
  const hpValue = slotMetrics ? slotMetrics.hp : hp;
  const maxHpValue = slotMetrics ? slotMetrics.maxHp : maxHp;
  const sps = (slotUpg && slotUpg.sps) || UPG.sps;
  const heavyMult = (slotUpg && slotUpg.heavyRoundsFireMult) || 1;
  const shotInterval = 1 / (sps * 2 * heavyMult);
  drawGhostSprite(ctx, ts, {
    playerState: body,
    chargeValue: isSpectator ? 0 : chargeValue,
    maxChargeValue,
    fireProgress: isSpectator ? 0 : (chargeValue >= 1 ? fireTValue / shotInterval : 0),
    gameState: gstate,
    hpValue: isSpectator ? 0 : hpValue,
    maxHpValue,
    forceFrown: isSpectator,
    bodyAlpha: isSpectator ? 0.3 : 1,
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
  // D5a — charge/sps come from the local render slot so the online guest
  // sees its OWN bar/sps once D5b ships the guest body. roomIndex/score/
  // runElapsedMs are game-wide and stay global. Solo/host/COOP_DEBUG: local
  // slot is slot 0, whose metrics/upg bridge to globals → unchanged.
  const slot = getLocalRenderSlot();
  const slotMetrics = slot ? slot.metrics : null;
  const slotUpg = slot ? slot.upg : UPG;
  const localCharge = slotMetrics ? slotMetrics.charge : charge;
  const localMaxCharge = (slotUpg && slotUpg.maxCharge) || UPG.maxCharge;
  const localSps = ((slotUpg && slotUpg.sps) || UPG.sps) * ((slotUpg && slotUpg.heavyRoundsFireMult) || 1);
  renderHud({
    roomIndex,
    runElapsedMs,
    score,
    charge: localCharge,
    maxCharge: localMaxCharge,
    sps: localSps,
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
  openButtons: [lbOpenBtn, lbOpenBtnGo, lbOpenBtnGoCoop],
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

// D15 — coop end-of-run controls. Both buttons are inert until a coop run
// has set up the rematch context; safe to wire unconditionally.
{
  const coopGoNameInput = document.getElementById('name-input-go-coop');
  if (coopGoNameInput) {
    coopGoNameInput.addEventListener('input', () => {
      try { setPlayerName(coopGoNameInput.value, { syncInputs: true }); } catch (_) {}
    });
    coopGoNameInput.addEventListener('change', () => {
      try { setPlayerName(coopGoNameInput.value, { syncInputs: true }); } catch (_) {}
    });
  }
  const rematchBtn = document.getElementById('btn-coop-rematch');
  if (rematchBtn) {
    rematchBtn.addEventListener('click', () => {
      if (!coopRematchSession || !coopRematchRole) return;
      if (coopRematchRole === 'host') {
        const seed = ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0) || 1;
        try {
          const status = document.getElementById('go-coop-status');
          if (status) status.textContent = 'Starting rematch…';
        } catch (_) {}
        broadcastCoopRematch(seed);
        startCoopRematchRun(seed);
      } else {
        // Guest "Request Rematch" → ask host. v1 host auto-accepts on receipt.
        try {
          if (coopRematchSession && typeof coopRematchSession.sendGameplay === 'function') {
            Promise.resolve(coopRematchSession.sendGameplay({ kind: 'coop-rematch-request' })).catch(() => {});
          }
        } catch (_) {}
        try {
          rematchBtn.disabled = true;
          const status = document.getElementById('go-coop-status');
          if (status) status.textContent = 'Waiting for host…';
        } catch (_) {}
      }
    });
  }
  const leaveBtn = document.getElementById('btn-coop-leave');
  if (leaveBtn) {
    leaveBtn.addEventListener('click', () => {
      try { leaveCoopGame(); } catch (err) {
        try { console.warn('[coop] leave failed', err); } catch (_) {}
      }
    });
  }
}

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
    lastT=performance.now(); simAccumulatorMs=0;
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

bindBoonsPanelControls({
  toggleButton: goCoopBoonsBtn,
  panelEl: goCoopBoonsPanel,
  closeButton: goCoopBoonsCloseBtn,
});

bindCoopLobby({
  coopButton: document.getElementById('btn-coop'),
  lobbyScreen: document.getElementById('s-coop-lobby'),
  startScreen,
  getPlayerName: () => playerName,
  getPlayerColor: () => null,
  setMenuChromeVisible,
  transportFactory: supabaseTransportFactory,
  // Phase D9 — when both peers are ready in the lobby, arm the pending coop
  // run record (role/seed/code/session) so init() can pick it up.
  // Phase D11 — synchronized start. The HOST's Start Run click broadcasts
  // `coop-run-start` over the gameplay channel and launches its own loop;
  // the GUEST'S button is replaced with a "Waiting for host…" label and the
  // guest auto-launches when the start message arrives. Without this, host
  // and guest had independent simTick clocks (host ran ahead by however
  // long it took the guest to also click Start), and the host's slot-1
  // remote-input adapter peekAt(simTick) never matched any guest frames
  // (guest frames were tagged with guest's far-behind tick), leaving the
  // guest's player frozen on the host's screen. Tick-tolerant fallback in
  // the adapter (peekLatestUpTo / peekOldest) is the secondary safety net.
  onReady: ({ seed, partnerIdentity, role, code, session }) => {
    try { console.info('[coop] lobby ready', { seed, role, code, partner: partnerIdentity?.name }); } catch (_) {}
    try { armPendingCoopRun({ role, seed, code, session: session || null }); } catch (err) {
      try { console.warn('[coop] arm pending run failed', err); } catch (_) {}
      return;
    }
    // D15 — stash partner display name + lobby code for the coop end-of-run
    // screen and rematch flow. armPendingCoopRun already keeps role + session.
    try { setCoopRematchLobbyContext({ role, code, partnerName: partnerIdentity?.name || '' }); } catch (_) {}
    const startBtn = document.getElementById('coop-ready-start');
    if (!startBtn) return;
    const lobbyScreen = document.getElementById('s-coop-lobby');
    let launched = false;
    let unsubStartListener = null;

    const launchCoopRun = () => {
      if (launched) return;
      launched = true;
      try { unsubStartListener && unsubStartListener(); } catch (_) {}
      unsubStartListener = null;
      // Restore default label/state for the next time the lobby is opened.
      try { startBtn.textContent = 'Start Run'; startBtn.disabled = false; } catch (_) {}
      if (lobbyScreen) lobbyScreen.classList.add('off');
      setMenuChromeVisible(false);
      init();
      gstate = 'playing';
      lastT = performance.now();
      simAccumulatorMs = 0;
      raf = requestAnimationFrame(loop);
      btnPause.style.display = 'inline-flex';
      if (typeof btnPatchNotes !== 'undefined' && btnPatchNotes) btnPatchNotes.style.display = 'none';
    };

    if (role === 'guest') {
      // Guest waits for host's broadcast. Replace the button visually so the
      // user understands they're not the one starting the run.
      try {
        startBtn.textContent = 'Waiting for host…';
        startBtn.disabled = true;
      } catch (_) {}
      if (session && typeof session.onGameplay === 'function') {
        unsubStartListener = session.onGameplay((ev) => {
          const payload = ev && ev.payload;
          if (payload && payload.kind === 'coop-run-start') {
            // D12.1 — pin our sim world to the host's dimensions BEFORE init()
            // so room generation, obstacle layout, spawn picks, and bullet
            // bounds all use the same arena as the host. Without this, the
            // guest sim would use its own canvas size as the world, causing
            // entities at host coordinates to clip/teleport.
            if (Number.isFinite(payload.worldW) && Number.isFinite(payload.worldH)) {
              setCoopWorldFromHost(payload.worldW, payload.worldH);
            }
            launchCoopRun();
          }
        });
      } else {
        // No session transport: degrade gracefully — let the guest tap to start.
        const onClick = () => { startBtn.removeEventListener('click', onClick); launchCoopRun(); };
        startBtn.addEventListener('click', onClick);
      }
      return;
    }

    // Host path: click broadcasts the start signal then launches.
    const onClick = () => {
      startBtn.removeEventListener('click', onClick);
      try { startBtn.disabled = true; } catch (_) {}
      try {
        if (session && typeof session.sendGameplay === 'function') {
          // D12.1 — include world dimensions in the start packet so the guest
          // can pin its sim arena to ours before its first frame runs.
          // Fire-and-forget; lobby is already in 'ready' phase.
          Promise.resolve(session.sendGameplay({
            kind: 'coop-run-start',
            worldW: WORLD_W,
            worldH: WORLD_H,
          })).catch((err) => {
            try { console.warn('[coop] coop-run-start send failed', err); } catch (_) {}
          });
        }
      } catch (err) {
        try { console.warn('[coop] coop-run-start send threw', err); } catch (_) {}
      }
      launchCoopRun();
    };
    startBtn.addEventListener('click', onClick);
  },
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

// Continue Run — show button if saved run exists (solo only).
// C3a-pre-1: hide if URL indicates a coop session will be opened
// (?coopdebug=1, ?coop=1, or ?room=<code>). isCoopRun() can't be checked here
// because the run isn't armed yet at page-load time.
const continueRunBtn = document.getElementById('btn-continue-run');
const _urlWillOpenCoop = (typeof window !== 'undefined' && window.location)
  ? (() => {
      const p = new URLSearchParams(window.location.search);
      return p.get('coopdebug') === '1' || p.get('coop') === '1' || p.has('room');
    })()
  : false;
const savedRun = _urlWillOpenCoop ? null : loadSavedRun();
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
      lastT=performance.now(); simAccumulatorMs=0;
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
