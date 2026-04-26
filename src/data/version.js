const VERSION = { num: '1.20.124', label: 'COOP ENEMY HP' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };