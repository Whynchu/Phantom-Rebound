const VERSION = { num: '1.20.28', label: 'D4.5 HOST DRIVES SLOT 1' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






