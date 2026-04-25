const VERSION = { num: '1.20.66', label: 'D18.16 - guest prediction wall-wedge fix' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






