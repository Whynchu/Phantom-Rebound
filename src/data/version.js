const VERSION = { num: '1.20.5', label: 'COOP PHASE C2A: PLAYER SLOTS' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






