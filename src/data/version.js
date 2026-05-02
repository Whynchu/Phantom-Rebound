const VERSION = { num: '1.5.4', label: 'BASE SPEEDS' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
