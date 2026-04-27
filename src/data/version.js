const VERSION = { num: '1.20.144', label: 'DR-2: fix host _rollbackActive gate — include intro so both peers sync from tick 0' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };