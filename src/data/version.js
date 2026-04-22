const VERSION = { num: '1.19.16', label: 'SCORING REWORK' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






