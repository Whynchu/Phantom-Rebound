const VERSION = { num: '1.20.68', label: 'D19.1 - guest bullet local-advance' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






