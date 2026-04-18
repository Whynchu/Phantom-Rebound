const VERSION = { num: '1.16.81', label: 'ICON + RING GEOMETRY' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






