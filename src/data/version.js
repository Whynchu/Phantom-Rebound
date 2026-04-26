const VERSION = { num: '1.20.130', label: 'R3 TWO-SLOT GUARDS' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };