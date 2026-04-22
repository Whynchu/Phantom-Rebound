const VERSION = { num: '1.19.21', label: 'SCORE BREAKDOWN ENCAPSULATION' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






