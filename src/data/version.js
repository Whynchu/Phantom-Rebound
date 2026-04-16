const VERSION = { num: '1.16.75', label: 'LATE ROOM TUNING' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






