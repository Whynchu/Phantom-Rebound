const VERSION = { num: '1.20.13', label: 'COOP PHASE C3A-PRE-1: ISCOOPRUN FLAG' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






