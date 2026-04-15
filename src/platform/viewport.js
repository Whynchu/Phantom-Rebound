// Safari mobile reports unstable viewport heights while browser chrome animates.
function fixSafariViewport() {
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  const vh = viewportHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);

  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  if (isSafari && /Mobile/.test(navigator.userAgent)) {
    document.documentElement.style.height = `${viewportHeight}px`;
    document.documentElement.style.minHeight = `${viewportHeight}px`;
    document.body.style.height = `${viewportHeight}px`;
    document.body.style.minHeight = `${viewportHeight}px`;
    document.body.style.position = 'relative';
  }
}

function isTextInputElement(element) {
  if(!element || typeof element.tagName !== 'string') return false;
  const tagName = element.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}

function isKeyboardOpenResize() {
  if(typeof document === 'undefined' || !window.visualViewport) return false;
  if(!isTextInputElement(document.activeElement)) return false;
  const baselineHeight = Math.max(window.innerHeight, document.documentElement?.clientHeight || 0);
  if(baselineHeight <= 0) return false;
  return window.visualViewport.height < baselineHeight * 0.82;
}

function bindResponsiveViewport(onResize) {
  const handleResize = () => {
    if(isKeyboardOpenResize()) {
      document.body?.classList?.add('keyboard-open');
      return;
    }
    document.body?.classList?.remove('keyboard-open');
    fixSafariViewport();
    onResize();
  };

  const handleFocusIn = () => {
    if(isKeyboardOpenResize()) {
      document.body?.classList?.add('keyboard-open');
    }
  };
  const handleFocusOut = () => {
    document.body?.classList?.remove('keyboard-open');
    setTimeout(handleResize, 40);
  };

  window.addEventListener('resize', handleResize);
  window.addEventListener('orientationchange', () => {
    setTimeout(handleResize, 100);
  });
  window.addEventListener('focusin', handleFocusIn);
  window.addEventListener('focusout', handleFocusOut);

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleResize);
  }

  handleResize();
}

export { bindResponsiveViewport };
