const VERSION = { num: '1.7.0', label: 'DAMAGE READOUT' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
