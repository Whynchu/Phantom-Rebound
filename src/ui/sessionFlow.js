function setPlayerNameState({
  value,
  sanitizePlayerName,
  fallbackName = 'RUNNER',
  persistName,
  inputs = [],
  syncInputs = false,
  onNameChange,
} = {}) {
  const sanitized = sanitizePlayerName(value);
  const playerName = sanitized || fallbackName;
  persistName?.(sanitized);
  if(syncInputs) {
    inputs.forEach((input) => {
      if(input) input.value = sanitized;
    });
  }
  onNameChange?.(playerName);
  return playerName;
}

function bindNameInputs({
  inputs = [],
  setPlayerName,
} = {}) {
  inputs.forEach((input) => {
    input?.addEventListener('input', (event) => setPlayerName?.(event.target.value));
  });
}

function bindSessionFlow({
  startButton,
  restartButton,
  mainMenuButton,
  startInput,
  gameOverInput,
  setPlayerName,
  setMenuChromeVisible,
  startScreen,
  gameOverScreen,
  boonsPanelEl,
  leaderboardScreen,
  initRun,
  beginLoop,
  setGameState,
} = {}) {
  startButton && (startButton.onclick = () => {
    setPlayerName?.(startInput?.value || '', { syncInputs: true });
    setMenuChromeVisible?.(false);
    startScreen?.classList.add('off');
    initRun?.();
    setGameState?.('playing');
    beginLoop?.();
  });

  restartButton && (restartButton.onclick = () => {
    setPlayerName?.(gameOverInput?.value || '', { syncInputs: true });
    setMenuChromeVisible?.(false);
    gameOverScreen?.classList.add('off');
    boonsPanelEl?.classList.add('off');
    initRun?.();
    setGameState?.('playing');
    beginLoop?.();
  });

  mainMenuButton?.addEventListener('click', () => {
    setPlayerName?.(gameOverInput?.value || '', { syncInputs: true });
    gameOverScreen?.classList.add('off');
    boonsPanelEl?.classList.add('off');
    leaderboardScreen?.classList.add('off');
    setMenuChromeVisible?.(true);
    startScreen?.classList.remove('off');
    setGameState?.('start');
  });
}

export {
  setPlayerNameState,
  bindNameInputs,
  bindSessionFlow,
};
