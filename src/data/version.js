const VERSION = { num: '1.20.44', label: 'D16.1 UNIFIED ARENA ASPECT' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






