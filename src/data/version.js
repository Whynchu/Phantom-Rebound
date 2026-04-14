const VERSION = { num: '1.16.57', label: 'ENGINEERING STABILIZATION' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };




