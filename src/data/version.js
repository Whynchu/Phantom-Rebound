const VERSION = { num: '1.20.22', label: 'COOP PHASE D2: HOST-AUTHORITATIVE SIM' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






