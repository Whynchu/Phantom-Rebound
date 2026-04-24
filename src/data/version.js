const VERSION = { num: '1.20.23', label: 'D3 GUEST INPUT UPLINK' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






