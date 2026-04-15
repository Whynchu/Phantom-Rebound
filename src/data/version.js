const VERSION = { num: '1.16.61', label: 'SURVIVAL READABILITY' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






