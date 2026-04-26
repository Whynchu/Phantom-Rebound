const VERSION = { num: '1.20.97', label: 'R4 polish — listener disposal, bounded history, telemetry, stall status' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






