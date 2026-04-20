const VERSION = { num: '1.19.8', label: 'NEW ICON & SMILE FIX' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






