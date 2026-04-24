const VERSION = { num: '1.20.34', label: 'D5e RECONCILIATION (INPUT REPLAY)' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






