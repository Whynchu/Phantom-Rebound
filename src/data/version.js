const VERSION = { num: '1.20.60', label: 'D18.12b - guest fireT mobileChargeMult parity' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






