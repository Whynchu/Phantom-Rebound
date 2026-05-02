const VERSION = { num: '1.7.2', label: 'DAMAGE NUMBERS' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
