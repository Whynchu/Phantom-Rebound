const VERSION = { num: '1.18.2', label: 'BUTTON LAYOUT SWAP' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






