const VERSION = { num: '1.20.138', label: 'DR-2: retire coopSnapshotBroadcaster and snapshotApplier' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };