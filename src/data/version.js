const VERSION = { num: '1.20.17', label: 'COOP PHASE C3A-CORE-3: LOCKSTEP GATE' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






