const VERSION = { num: '1.20.78', label: 'R0.4 chunk 5 - share bullets/enemies arrays into SimState' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






