const VERSION = { num: '0.92', label: 'Vampire Route Expansion' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
