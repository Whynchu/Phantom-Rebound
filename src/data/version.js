const VERSION = { num: '1.20.117', label: 'D20 GUEST POS SMOOTH' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };