const VERSION = { num: '1.3.0', label: 'CO-OP MODE' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
