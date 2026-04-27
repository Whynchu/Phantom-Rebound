const VERSION = { num: '1.20.141', label: 'DR-2: fix joyMax ReferenceError in installCoopInputUplink' };

function formatVersionTag(version = VERSION) {
  return `// prototype v${version.num} - ${version.label}`;
}

export { VERSION, formatVersionTag };