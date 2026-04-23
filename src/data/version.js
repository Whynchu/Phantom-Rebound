const VERSION = { num: '1.20.1', label: 'COOP PHASE B: LOBBY (WIP)' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






