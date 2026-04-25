const VERSION = { num: '1.20.77', label: 'R0.4 chunk 4 - bridge roomIndex/roomPhase/roomTimer into SimState' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






