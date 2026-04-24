const VERSION = { num: '1.20.20', label: 'COOP PHASE D0A: WORLD-SPACE DECOUPLED' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






