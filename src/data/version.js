const VERSION = { num: '1.20.4', label: 'COOP PHASE C1B: FIXED STEP' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






