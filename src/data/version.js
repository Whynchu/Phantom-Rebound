const VERSION = { num: '1.20.14', label: 'COOP PHASE C3A-PRE-2: GAMEPLAY CHANNEL' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






