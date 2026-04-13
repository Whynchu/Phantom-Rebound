const overlayTimeouts = new WeakMap();

function clearOverlayTimer(panelEl, clearTimer = clearTimeout) {
  const timeoutId = overlayTimeouts.get(panelEl);
  if(timeoutId) {
    clearTimer(timeoutId);
    overlayTimeouts.delete(panelEl);
  }
}

function scheduleOverlayReset({
  panelEl,
  textEl,
  text = 'ROOM CLEAR',
  delayMs,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  clearOverlayTimer(panelEl, clearTimer);
  const timeoutId = setTimer(() => {
    panelEl.classList.remove('show', 'boss-clear');
    if(textEl) textEl.textContent = text;
    overlayTimeouts.delete(panelEl);
  }, delayMs);
  overlayTimeouts.set(panelEl, timeoutId);
}

function showRoomClearOverlay({
  panelEl,
  textEl,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  if(!panelEl) return;
  if(textEl) textEl.textContent = 'ROOM CLEAR';
  panelEl.classList.remove('boss-clear');
  panelEl.classList.add('show');
  scheduleOverlayReset({ panelEl, textEl, delayMs: 1400, setTimer, clearTimer });
}

function showBossDefeatedOverlay({
  panelEl,
  textEl,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  if(!panelEl) return;
  if(textEl) textEl.textContent = 'BOSS DEFEATED';
  panelEl.classList.add('show', 'boss-clear');
  scheduleOverlayReset({ panelEl, textEl, delayMs: 2000, setTimer, clearTimer });
}

function showRoomIntroOverlay({ panelEl, textEl, text, isGo = false } = {}) {
  if(!panelEl) return;
  if(textEl) textEl.textContent = text;
  panelEl.classList.toggle('go', Boolean(isGo));
  panelEl.classList.add('show');
}

function hideRoomIntroOverlay({ panelEl } = {}) {
  if(!panelEl) return;
  panelEl.classList.remove('show', 'go');
}

export {
  showRoomClearOverlay,
  showBossDefeatedOverlay,
  showRoomIntroOverlay,
  hideRoomIntroOverlay,
};
