const VERSION = { num: '1.20.15', label: 'COOP PHASE C3A-CORE-1: LOCAL SLOT RUNTIME' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






