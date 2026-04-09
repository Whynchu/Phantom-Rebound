const VERSION = { num: '1.16.18', label: 'ROOM TELEMETRY' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
