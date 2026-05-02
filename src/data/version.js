const VERSION = { num: '1.4.6', label: 'LATE GAME' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
