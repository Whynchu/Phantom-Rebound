const VERSION = { num: '1.16.62', label: 'ROOM PREVIEW' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






