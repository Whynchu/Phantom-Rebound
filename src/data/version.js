const VERSION = { num: '1.20.53', label: 'D18.7 — guest movement restore + partner color sync' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






