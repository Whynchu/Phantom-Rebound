const VERSION = { num: '1.20.7', label: 'COOP PHASE C2C: SECOND PLAYER (DEV)' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






