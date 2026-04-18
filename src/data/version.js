const VERSION = { num: '1.16.95', label: 'HELMET REWORK' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






