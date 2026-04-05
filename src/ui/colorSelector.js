// Color selector UI component
// Inline color picker for player to choose from 8 color schemes

import { getColorOptions, setPlayerColor, getPlayerColor } from '../data/colorScheme.js';

function renderColorSelector(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const options = getColorOptions();
  const current = getPlayerColor();

  container.innerHTML = '';
  container.className = 'color-selector';

  options.forEach(opt => {
    const swatch = document.createElement('button');
    swatch.className = `color-swatch ${opt.key === current ? 'active' : ''}`;
    swatch.style.setProperty('--swatch-hex', opt.hex);
    swatch.setAttribute('data-color', opt.key);
    swatch.setAttribute('title', opt.name);
    swatch.setAttribute('aria-label', `Select ${opt.name}`);
    swatch.setAttribute('role', 'radio');
    swatch.setAttribute('aria-checked', opt.key === current ? 'true' : 'false');

    swatch.innerHTML = `<span class="swatch-icon">${opt.icon}</span><span class="swatch-name">${opt.name}</span>`;

    swatch.addEventListener('click', (e) => {
      e.preventDefault();
      setPlayerColor(opt.key);
      // Update UI
      container.querySelectorAll('.color-swatch').forEach(s => {
        s.classList.remove('active');
        s.setAttribute('aria-checked', 'false');
      });
      swatch.classList.add('active');
      swatch.setAttribute('aria-checked', 'true');
      // Trigger visual feedback
      onColorChanged(opt);
    });

    container.appendChild(swatch);
  });
}

function onColorChanged(colorOpt) {
  // Visual feedback: briefly highlight the choice
  const indicator = document.getElementById('color-indicator');
  if (indicator) {
    indicator.style.background = colorOpt.hex;
    indicator.style.boxShadow = `0 0 16px ${colorOpt.hex}`;
  }
}

export { renderColorSelector };
