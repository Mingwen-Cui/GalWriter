const PLAYTEST_ROTATE_HINT_KEY = 'playtest-immersive-rotate-hint-dismissed';

export function readRotateHintDismissed() {
  try {
    return window.localStorage.getItem(PLAYTEST_ROTATE_HINT_KEY) === '1';
  } catch {
    return false;
  }
}

export function persistRotateHintDismissed() {
  try {
    window.localStorage.setItem(PLAYTEST_ROTATE_HINT_KEY, '1');
  } catch {
    // ignore storage failures
  }
}

// Helper: HTML-Aware Safe Slicing for Typewriter Effect
export function sliceHtmlByTextLength(
  html: string,
  maxTextLength: number,
): { slicedHtml: string; totalTextLength: number } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const container = doc.body.firstChild as HTMLElement;

  let currentTextLength = 0;

  function cloneNodeLimit(node: Node): Node | null {
    if (node.nodeType === Node.TEXT_NODE) {
      const textContent = node.textContent || '';
      const remaining = maxTextLength - currentTextLength;
      if (remaining <= 0) {
        return null;
      }
      if (textContent.length <= remaining) {
        currentTextLength += textContent.length;
        return document.createTextNode(textContent);
      } else {
        currentTextLength += remaining;
        return document.createTextNode(textContent.slice(0, remaining));
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const clonedEl = el.cloneNode(false) as HTMLElement;

      for (let i = 0; i < el.childNodes.length; i++) {
        const child = el.childNodes[i];
        const clonedChild = cloneNodeLimit(child);
        if (clonedChild) {
          clonedEl.appendChild(clonedChild);
        }
        if (currentTextLength >= maxTextLength) {
          break;
        }
      }
      const isVoidTag = ['br', 'img', 'hr', 'input'].includes(clonedEl.tagName.toLowerCase());
      if (clonedEl.childNodes.length > 0 || isVoidTag) {
        return clonedEl;
      }
      return null;
    }
    return null;
  }

  const resultContainer = document.createElement('div');
  if (container) {
    for (let i = 0; i < container.childNodes.length; i++) {
      const clonedChild = cloneNodeLimit(container.childNodes[i]);
      if (clonedChild) {
        resultContainer.appendChild(clonedChild);
      }
      if (currentTextLength >= maxTextLength) {
        break;
      }
    }
  }

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  const totalTextLength = tempDiv.textContent?.length || 0;

  return {
    slicedHtml: resultContainer.innerHTML,
    totalTextLength,
  };
}
