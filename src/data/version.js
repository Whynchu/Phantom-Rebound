const VERSION = { num: '1.20.36', label: 'D10 MULTI-ROOM BOONS' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






