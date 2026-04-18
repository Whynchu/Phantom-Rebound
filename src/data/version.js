const VERSION = { num: '1.16.83', label: 'SCREENSHOT ICON UPDATE' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






