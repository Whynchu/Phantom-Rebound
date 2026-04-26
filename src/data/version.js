const VERSION = { num: '1.20.122', label: 'DAMAGE VARIANCE FEEDBACK' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };