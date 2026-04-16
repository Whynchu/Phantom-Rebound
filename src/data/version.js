const VERSION = { num: '1.16.70', label: 'AIM CLARITY PASS' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






