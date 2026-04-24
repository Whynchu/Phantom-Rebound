const VERSION = { num: '1.20.30', label: 'D5a RENDER/HUD TO LOCAL SLOT' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






