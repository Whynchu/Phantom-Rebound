const VERSION = { num: '1.19.24', label: 'BOON HOOKS: TICK + PAUSE' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






