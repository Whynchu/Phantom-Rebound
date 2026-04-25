const VERSION = { num: '1.20.58', label: 'D18.11 - coop disconnect resilience: soft pause + hard timeout + heartbeat' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






