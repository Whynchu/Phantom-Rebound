const VERSION = { num: '1.20.69', label: 'D19.2/D19.3 - muzzle prediction + grey lag-comp' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






