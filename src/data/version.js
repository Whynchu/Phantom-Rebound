const VERSION = { num: '1.20.150', label: 'ROLLBACK PEER POSITION ANCHORS' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };