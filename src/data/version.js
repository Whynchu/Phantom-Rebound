const VERSION = { num: '1.19.23', label: 'BOON HOOK REGISTRY' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };






