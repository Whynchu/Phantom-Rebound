// Player color customization system
// 8 player-selectable color schemes with full theme adaptation

const PLAYER_COLORS = {
  green: {
    name: 'Ghostly Green',
    hex: '#4ade80',
    light: '#b8ffcc',
    dark: '#22c55e',
    dangerHex: '#60a5fa',
    dangerLabel: 'blue',
    icon: '🟢'
  },
  blue: {
    name: 'Azure',
    hex: '#60a5fa',
    light: '#93c5fd',
    dark: '#2563eb',
    dangerHex: '#f87171',
    dangerLabel: 'red',
    icon: '🔵'
  },
  purple: {
    name: 'Phantom',
    hex: '#c084fc',
    light: '#e9d5ff',
    dark: '#9333ea',
    dangerHex: '#fbbf24',
    dangerLabel: 'gold',
    icon: '🟣'
  },
  pink: {
    name: 'Neon Rose',
    hex: '#f472b6',
    light: '#fbcfe8',
    dark: '#ec4899',
    dangerHex: '#22d3ee',
    dangerLabel: 'cyan',
    icon: '💗'
  },
  gold: {
    name: 'Gilded',
    hex: '#fbbf24',
    light: '#fef3c7',
    dark: '#d97706',
    dangerHex: '#4ade80',
    dangerLabel: 'green',
    icon: '⭐'
  },
  red: {
    name: 'Crimson',
    hex: '#f87171',
    light: '#fecaca',
    dark: '#dc2626',
    dangerHex: '#93c5fd',
    dangerLabel: 'blue',
    icon: '🔴'
  },
  cyan: {
    name: 'Ice',
    hex: '#67e8f9',
    light: '#a5f3fc',
    dark: '#06b6d4',
    dangerHex: '#f87171',
    dangerLabel: 'red',
    icon: '🧊'
  },
  orange: {
    name: 'Ember',
    hex: '#fb923c',
    light: '#fed7aa',
    dark: '#ea580c',
    dangerHex: '#4ade80',
    dangerLabel: 'green',
    icon: '🔥'
  }
};

// Color key order for cycling
const COLOR_KEYS = Object.keys(PLAYER_COLORS);

let activePlayerColor = 'green';

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `${r},${g},${b}`;
}

function setPlayerColor(colorKey) {
  if (!PLAYER_COLORS[colorKey]) {
    console.warn(`Invalid color: ${colorKey}, using default green`);
    colorKey = 'green';
  }
  activePlayerColor = colorKey;
  
  // Update ALL CSS variables so the entire UI adapts
  if (document.documentElement) {
    const s = PLAYER_COLORS[activePlayerColor];
    const root = document.documentElement.style;
    // Primary theme variables (used throughout CSS)
    root.setProperty('--accent', s.hex);
    root.setProperty('--accent2', s.dark);
    root.setProperty('--ghost', s.light);
    // RGB triplets for rgba() usage in CSS
    root.setProperty('--accent-rgb', hexToRgb(s.hex));
    root.setProperty('--ghost-rgb', hexToRgb(s.light));
    root.setProperty('--danger-rgb', hexToRgb(s.dangerHex));
    // Named player variables (kept for clarity)
    root.setProperty('--player-accent', s.hex);
    root.setProperty('--player-accent-light', s.light);
    root.setProperty('--player-accent-dark', s.dark);
    root.setProperty('--player-danger', s.dangerHex);
  }
  
  try {
    localStorage.setItem('phantom-player-color', colorKey);
  } catch (e) {
    console.warn('Could not save color to localStorage:', e);
  }

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
    window.dispatchEvent(new CustomEvent('phantom:player-color-change', {
      detail: {
        key: activePlayerColor,
        scheme: PLAYER_COLORS[activePlayerColor]
      }
    }));
  }
}

function cyclePlayerColor() {
  const idx = COLOR_KEYS.indexOf(activePlayerColor);
  const next = COLOR_KEYS[(idx + 1) % COLOR_KEYS.length];
  setPlayerColor(next);
  return PLAYER_COLORS[next];
}

function getPlayerColorScheme() {
  return PLAYER_COLORS[activePlayerColor] || PLAYER_COLORS['green'];
}

function getPlayerColor() {
  return activePlayerColor;
}

function loadPlayerColorFromStorage() {
  const saved = localStorage.getItem('phantom-player-color');
  if (saved && PLAYER_COLORS[saved]) {
    setPlayerColor(saved);
  } else {
    setPlayerColor('green');
  }
}

function getColorOptions() {
  return Object.entries(PLAYER_COLORS).map(([key, scheme]) => ({
    key,
    name: scheme.name,
    hex: scheme.hex,
    icon: scheme.icon
  }));
}

export {
  PLAYER_COLORS,
  COLOR_KEYS,
  setPlayerColor,
  cyclePlayerColor,
  getPlayerColorScheme,
  getPlayerColor,
  loadPlayerColorFromStorage,
  getColorOptions,
  hexToRgb
};
