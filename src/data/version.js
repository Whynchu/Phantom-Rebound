const VERSION = { num: '1.20.70', label: 'D19.4/D19.5 - any-owner muzzle + partner cosmetic sync' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






