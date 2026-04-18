const VERSION = { num: '1.16.90', label: 'HATS CLEANUP PASS' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






