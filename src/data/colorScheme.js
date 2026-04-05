// Player color customization system
// 8 player-selectable color schemes with full theme adaptation

const PLAYER_COLORS = {
  green: {
    name: 'Ghostly Green',
    hex: '#4ade80',
    light: '#b8ffcc',
    dark: '#22c55e',
    dangerHex: '#60a5fa',
    icon: '🟢'
  },
  blue: {
    name: 'Azure',
    hex: '#60a5fa',
    light: '#93c5fd',
    dark: '#2563eb',
    dangerHex: '#f87171',
    icon: '🔵'
  },
  purple: {
    name: 'Phantom',
    hex: '#c084fc',
    light: '#e9d5ff',
    dark: '#9333ea',
    dangerHex: '#fbbf24',
    icon: '🟣'
  },
  pink: {
    name: 'Neon Rose',
    hex: '#f472b6',
    light: '#fbcfe8',
    dark: '#ec4899',
    dangerHex: '#22d3ee',
    icon: '💗'
  },
  gold: {
    name: 'Gilded',
    hex: '#fbbf24',
    light: '#fef3c7',
    dark: '#d97706',
    dangerHex: '#4ade80',
    icon: '⭐'
  },
  red: {
    name: 'Crimson',
    hex: '#f87171',
    light: '#fecaca',
    dark: '#dc2626',
    dangerHex: '#93c5fd',
    icon: '🔴'
  },
  cyan: {
    name: 'Ice',
    hex: '#67e8f9',
    light: '#a5f3fc',
    dark: '#06b6d4',
    dangerHex: '#f87171',
    icon: '🧊'
  },
  orange: {
    name: 'Ember',
    hex: '#fb923c',
    light: '#fed7aa',
    dark: '#ea580c',
    dangerHex: '#4ade80',
    icon: '🔥'
  }
};

let activePlayerColor = 'green';

function setPlayerColor(colorKey) {
  if (!PLAYER_COLORS[colorKey]) {
    console.warn(`Invalid color: ${colorKey}, using default green`);
    colorKey = 'green';
  }
  activePlayerColor = colorKey;
  
  // Update CSS variables for DOM elements (HUD, buttons, etc.)
  const root = document.documentElement;
  const scheme = PLAYER_COLORS[activePlayerColor];
  root.style.setProperty('--player-accent', scheme.hex);
  root.style.setProperty('--player-accent-light', scheme.light);
  root.style.setProperty('--player-accent-dark', scheme.dark);
  root.style.setProperty('--player-danger', scheme.dangerHex);
  
  // Persist to localStorage
  localStorage.setItem('phantom-player-color', colorKey);
}

function getPlayerColorScheme() {
  return PLAYER_COLORS[activePlayerColor];
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
  setPlayerColor,
  getPlayerColorScheme,
  getPlayerColor,
  loadPlayerColorFromStorage,
  getColorOptions
};
