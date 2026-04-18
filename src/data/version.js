const VERSION = { num: '1.16.86', label: 'HATS + GHOST PREVIEW' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






