const VERSION = { num: '1.20.92', label: 'R0.4 step 4d: bullet near-miss telemetry detection extracted to pure helper' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






