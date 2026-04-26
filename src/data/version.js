const VERSION = { num: '1.20.125', label: 'R3 SHIELD PARITY' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };