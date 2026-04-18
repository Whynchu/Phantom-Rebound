const VERSION = { num: '1.16.100', label: 'FIRE RATE DAMAGE SCALING' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






