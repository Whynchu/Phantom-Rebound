const VERSION = { num: '1.16.20', label: 'TELEMETRY TIMER FIX' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
