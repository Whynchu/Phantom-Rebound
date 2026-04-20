const VERSION = { num: '1.18.3', label: 'PAUSE MENU REFACTOR' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






