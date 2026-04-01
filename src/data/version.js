const VERSION = { num: '0.77', label: 'Triangle Ascendant' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
