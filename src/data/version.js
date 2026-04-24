const VERSION = { num: '1.20.33', label: 'D5d LOCAL PREDICTION (GUEST SLOT 1)' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






