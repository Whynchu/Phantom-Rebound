const VERSION = { num: '1.20.156', label: 'COOP SMOOTH INTERP + ENEMY COLORS' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
