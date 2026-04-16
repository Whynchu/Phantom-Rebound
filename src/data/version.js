const VERSION = { num: '1.16.71', label: 'POINTER POLISH' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






