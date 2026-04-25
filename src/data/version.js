const VERSION = { num: '1.20.42', label: 'D12.3 SLOT-1 DRIFT FIX' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






