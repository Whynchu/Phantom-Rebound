const VERSION = { num: '1.5.2', label: 'GLASS CANNON' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
