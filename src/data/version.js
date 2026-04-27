const VERSION = { num: '1.20.145', label: 'DR-2: fix bullet bounce dispatch in kinematic resim — grey conversion, split, triangle burst' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };