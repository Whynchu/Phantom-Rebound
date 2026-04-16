const VERSION = { num: '1.16.69', label: 'TESTER PASS' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






