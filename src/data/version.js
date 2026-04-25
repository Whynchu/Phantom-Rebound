const VERSION = { num: '1.20.61', label: 'D18.13 - guest room-clear overlay + charge lerp jump-snap' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






