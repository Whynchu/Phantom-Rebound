const VERSION = { num: '1.20.106', label: 'R2 — bullet + enemy kinematic resim in hostSimStep' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };