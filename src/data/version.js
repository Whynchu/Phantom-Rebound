const VERSION = { num: '1.20.108', label: 'ROLLBACK INPUT DRIFT FIX' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };