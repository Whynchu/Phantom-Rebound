const VERSION = { num: '1.20.107', label: 'R3 COMBAT RESIM SLICE' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };