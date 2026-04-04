const VERSION = { num: '0.87a', label: 'Boon Expansion' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
