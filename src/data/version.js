const VERSION = { num: '1.20.153', label: 'COOP SNAPSHOT PHASE FIX' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
