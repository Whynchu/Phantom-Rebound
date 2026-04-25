// ── PAUSE CONTROLLER ─────────────────────────────────────────────────────────
// Owns pause overlay state, DOM wiring, Escape-key toggle, in-game confirm dialog,
// and pause-time timestamp adjustments for bullets/boons.
//
// All internal state (prePauseState, pauseStartedAt, pendingConfirmAction) lives
// in the closure. The controller reads/writes outer game state via the deps
// passed to createPauseController — no hidden globals.

import { bullets } from '../core/gameState.js';
import { iconHTML } from './iconRenderer.js';
import { getActiveBoonEntries } from '../data/boons.js';
import { runBoonHook } from '../systems/boonHooks.js';

export function createPauseController({
  getGameState,
  setGameState,
  getUpg,
  cancelLoop,
  restartLoop,
  clearSavedRun,
  setMenuChromeVisible,
  openLeaderboard,
  openPatchNotes,
  doc = document,
} = {}) {
  const pausePanel = doc.getElementById('pause-panel');
  const btnPause = doc.getElementById('btn-pause');
  const btnPatchNotes = doc.getElementById('btn-patch-notes');
  const pauseBoonsPanel = doc.getElementById('pause-boons-panel');
  const pauseConfirmPanel = doc.getElementById('pause-confirm-panel');
  const pauseConfirmMsg = doc.getElementById('pause-confirm-msg');
  const btnConfirmYes = doc.getElementById('btn-pause-confirm-yes');
  const btnConfirmNo = doc.getElementById('btn-pause-confirm-no');

  let prePauseState = null;
  let pendingConfirmAction = null;

  // Sim-clock note (Phase C1a): simNowMs is advanced only inside the
  // game loop. When cancelLoop() runs on pause, simNowMs freezes, so
  // bullet expireAt/decayStart (sim-clock values) are naturally
  // correct on resume without any offset shifting. Boon onPauseAdjust
  // hooks are still invoked with pauseDuration=0 so any future hooks
  // that react to pauses keep working.

  function offsetAbsoluteTimestamps(pauseDuration) {
    // Left as no-op for bullet timers: simNowMs freezes during pause.
    runBoonHook('onPauseAdjust', { UPG: getUpg(), pauseDuration });
  }

  function pauseGame() {
    const gstate = getGameState();
    if (gstate !== 'playing' && gstate !== 'upgrade') return;
    prePauseState = gstate;
    setGameState('paused');
    cancelLoop();
    pausePanel.classList.remove('off');
    pausePanel.setAttribute('aria-hidden', 'false');
    btnPause.style.display = 'none';
  }

  function resumeGame() {
    if (getGameState() !== 'paused') return;
    offsetAbsoluteTimestamps(0);
    const next = prePauseState || 'playing';
    setGameState(next);
    pausePanel.classList.add('off');
    pausePanel.setAttribute('aria-hidden', 'true');
    pauseBoonsPanel.classList.add('off');
    pauseConfirmPanel?.classList.add('off');
    btnPause.style.display = 'inline-flex';
    if (next === 'playing') restartLoop();
  }

  function renderPauseBoons() {
    const list = doc.getElementById('pause-boons-list');
    if (!list) return;
    const entries = getActiveBoonEntries(getUpg());
    list.innerHTML = entries.map(e =>
      `<div class="up-active-row">${iconHTML(e.icon, 'up-active-icon')} ${e.label}</div>`
    ).join('');
  }

  function showPauseConfirm(message, onConfirm) {
    pauseConfirmMsg.textContent = message;
    pendingConfirmAction = onConfirm;
    pauseBoonsPanel.classList.add('off');
    pauseConfirmPanel.classList.remove('off');
  }

  function exitToMenu() {
    clearSavedRun();
    resumeGame();
    setGameState('start');
    cancelLoop();
    pausePanel.classList.add('off');
    // D18.5 — hide the boon picker if the user came in from the upgrade
    // phase. Without this, s-up overlays s-start and the user's "Main Menu"
    // tap looks broken; then any subsequent boon click leaks pause-button
    // visibility back over the menu chrome.
    try { doc.getElementById('s-up')?.classList.add('off'); } catch (_) {}
    setMenuChromeVisible(true);
    doc.getElementById('s-start').classList.remove('off');
    if (btnPatchNotes) btnPatchNotes.style.display = 'inline-flex';
    btnPause.style.display = 'none';
  }

  btnPause.addEventListener('click', pauseGame);
  doc.getElementById('btn-pause-continue').addEventListener('click', resumeGame);
  doc.getElementById('btn-pause-boons').addEventListener('click', () => {
    renderPauseBoons();
    pauseBoonsPanel.classList.remove('off');
  });

  btnConfirmYes.addEventListener('click', () => {
    pauseConfirmPanel.classList.add('off');
    if (pendingConfirmAction) pendingConfirmAction();
    pendingConfirmAction = null;
  });
  btnConfirmNo.addEventListener('click', () => {
    pauseConfirmPanel.classList.add('off');
    pendingConfirmAction = null;
  });

  doc.getElementById('btn-pause-restart').addEventListener('click', () => {
    showPauseConfirm('Restart this run?', exitToMenu);
  });
  doc.getElementById('btn-pause-main-menu').addEventListener('click', () => {
    showPauseConfirm('Return to main menu?', exitToMenu);
  });
  doc.getElementById('btn-pause-lb').addEventListener('click', () => {
    // Leaderboard overlay covers a still-paused game; restore pause panel on close.
    pausePanel.classList.add('off');
    openLeaderboard();
    const lbClose = doc.getElementById('btn-lb-close');
    const restore = () => {
      if (getGameState() === 'paused') pausePanel.classList.remove('off');
      lbClose.removeEventListener('click', restore);
    };
    if (lbClose) lbClose.addEventListener('click', restore);
  });
  doc.getElementById('btn-pause-patch-notes').addEventListener('click', () => {
    pausePanel.classList.add('off');
    openPatchNotes();
  });

  doc.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const gstate = getGameState();
    if (gstate === 'playing' || gstate === 'upgrade') pauseGame();
    else if (gstate === 'paused') resumeGame();
  });

  return { pauseGame, resumeGame, showPauseConfirm, renderPauseBoons };
}
