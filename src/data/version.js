const VERSION = { num: '1.16.82', label: 'SETTINGS RING PREVIEW FIX' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






