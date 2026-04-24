const VERSION = { num: '1.20.16', label: 'COOP PHASE C3A-CORE-2: INPUT SYNC' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






