const VERSION = { num: '1.16.60', label: 'READABILITY PASS' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






