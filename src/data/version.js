const VERSION = { num: '1.20.126', label: 'R3 VOLATILE ORB PARITY' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };