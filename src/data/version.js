const VERSION = { num: '1.20.19', label: 'COOP ARCHITECTURE PIVOT: LOCKSTEP REMOVED' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






