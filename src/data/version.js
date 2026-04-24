const VERSION = { num: '1.20.31', label: 'D5b SNAP-TO-LATEST APPLIER' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






