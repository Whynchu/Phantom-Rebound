const VERSION = { num: '1.16.10', label: 'PATCH NOTES SCREEN FIT' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };
