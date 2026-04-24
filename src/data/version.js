const VERSION = { num: '1.20.8', label: 'COOP PHASE C2D-1A: ENEMY TARGETING' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






