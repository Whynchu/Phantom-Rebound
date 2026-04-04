const VERSION = { num: '1.05', label: 'Active Boons Panel Fix' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
