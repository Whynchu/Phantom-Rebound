const VERSION = { num: '1.20.0', label: 'COOP PHASE A: SEEDED SIM' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






