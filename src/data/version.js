const VERSION = { num: '1.16.67', label: 'FLANK HOTFIX' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






