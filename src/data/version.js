const VERSION = { num: '1.20.48', label: 'Pause-from-boon menu exit + button leak fix' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






