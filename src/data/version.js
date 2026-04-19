const VERSION = { num: '1.17.5', label: 'SPRITE ICONS' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






