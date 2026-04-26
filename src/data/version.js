const VERSION = { num: '1.20.96', label: 'R2 finish: two-peer rollback harness green; rollback prediction + buffer-update bugs fixed' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






