const VERSION = { num: '1.18.5', label: 'PAUSE MENU POLISH' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






