const VERSION = { num: '1.16.63', label: 'PAYLOAD BLOOM' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






