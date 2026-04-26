const VERSION = { num: '1.20.129', label: 'R3 CHARGED ORB + KILL REWARD PARITY' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };