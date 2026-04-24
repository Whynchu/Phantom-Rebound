const VERSION = { num: '1.20.18', label: 'COOP PHASE C3A-MIN-1: SINGLE-ROOM TERMINATION' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






