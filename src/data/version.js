const VERSION = { num: '1.20.43', label: 'D12.4 SLOT-1 ROOM-RESET + CHARGE FIX' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






