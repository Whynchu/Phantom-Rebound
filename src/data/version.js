const VERSION = { num: '1.20.146', label: 'DR-2: rollback partial resync + 20-tick window (was 8) — prevents permanent guest divergence' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };