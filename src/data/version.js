const VERSION = { num: '1.20.116', label: 'R4 HOST NO-ROLLBACK FIX' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };