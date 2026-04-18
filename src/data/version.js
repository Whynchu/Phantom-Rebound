const VERSION = { num: '1.16.94', label: 'HORN HAT POLISH' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






