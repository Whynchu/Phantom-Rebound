const VERSION = { num: '1.19.17', label: 'DYNAMIC SCORING' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






