function bindPatchNotesControls({
  button,
  closeButton,
  panelEl,
  onOpenChange,
  doc = document,
} = {}) {
  button?.addEventListener('click', () => onOpenChange?.(true));
  closeButton?.addEventListener('click', () => onOpenChange?.(false));
  panelEl?.addEventListener('click', (event) => {
    if(event.target === panelEl) onOpenChange?.(false);
  });
  doc.addEventListener('keydown', (event) => {
    if(event.key === 'Escape') onOpenChange?.(false);
  });
}

function bindLeaderboardControls({
  openButtons = [],
  closeButton,
  periodButtons = [],
  scopeButtons = [],
  modeButtons = [],
  onOpen,
  onClose,
  onPeriodChange,
  onScopeChange,
  onModeChange,
} = {}) {
  openButtons.forEach((button) => {
    button?.addEventListener('click', () => onOpen?.());
  });
  closeButton?.addEventListener('click', () => onClose?.());
  periodButtons.forEach((button) => {
    button.addEventListener('click', () => onPeriodChange?.(button.dataset.lbPeriod));
  });
  scopeButtons.forEach((button) => {
    button.addEventListener('click', () => onScopeChange?.(button.dataset.lbScope));
  });
  modeButtons.forEach((button) => {
    button.addEventListener('click', () => onModeChange?.(button.dataset.lbMode));
  });
}

function bindBoonsPanelControls({
  toggleButton,
  panelEl,
  closeButton,
} = {}) {
  toggleButton?.addEventListener('click', () => panelEl?.classList.toggle('off'));
  closeButton?.addEventListener('click', () => panelEl?.classList.add('off'));
}

function bindPopupClose({
  closeButton,
  panelEl,
} = {}) {
  closeButton?.addEventListener('click', () => panelEl?.classList.add('off'));
}

export {
  bindPatchNotesControls,
  bindLeaderboardControls,
  bindBoonsPanelControls,
  bindPopupClose,
};
