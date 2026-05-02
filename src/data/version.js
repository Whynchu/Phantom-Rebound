const VERSION = { num: '1.4.9', label: 'PERF PROBE' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
