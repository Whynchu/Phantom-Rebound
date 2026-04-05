import { formatVersionTag } from '../data/version.js';

function renderVersionTag(version, element = document.getElementById('version-tag')) {
  if (!element) return;
  element.textContent = formatVersionTag(version);
  document.title = `Phantom Rebound - v${version.num}`;
}

export { renderVersionTag };
