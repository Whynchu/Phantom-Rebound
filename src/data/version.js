const VERSION = { num: '1.16.88', label: 'HATS UI POLISH' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






