const VERSION = { num: '1.16.36', label: 'PLAYER FIRE PRIORITY' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
