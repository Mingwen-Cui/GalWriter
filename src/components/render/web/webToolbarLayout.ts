import type { WebMenuElement } from '../video/shared/types';

export function toolbarButtonWidth(
  element: WebMenuElement,
  canvasWidth: number,
  canvasHeight: number,
) {
  const diameter = (element.height * canvasHeight) / canvasWidth;
  if (element.textVisible === false) return diameter;
  const fontSize = element.fontSize || 14;
  const textWidth = Array.from(element.text || '').reduce(
    (width, char) => width + (/[^\x00-\xff]/.test(char) ? fontSize : fontSize * 0.6),
    0,
  );
  return Math.max(diameter, element.width, ((textWidth + fontSize * 1.5 + 30) / canvasWidth) * 100);
}

/** The same authored boxes are used by the preview, selection tools and export. */
export function arrangeToolbarRow(
  elements: WebMenuElement[],
  canvasWidth: number,
  canvasHeight: number,
  gap = 0.8,
  right = 98,
  top?: number,
): WebMenuElement[] {
  const buttons = elements.filter((element) => element.kind === 'button');
  if (!buttons.length) return elements;
  right = Math.max(1, Math.min(100, right));
  const rowTop = top ?? Math.min(...buttons.map((element) => element.y), 2.4);
  const widthById = new Map(
    buttons.map((element) => [element.id, toolbarButtonWidth(element, canvasWidth, canvasHeight)]),
  );
  const totalWidth = buttons.reduce((sum, element) => sum + widthById.get(element.id)!, 0);
  const scale = Math.min(1, right / Math.max(1, totalWidth));
  const actualGap = Math.max(
    0,
    Math.min(gap, (right - totalWidth * scale) / Math.max(1, buttons.length - 1)),
  );
  let cursor = Math.max(
    0,
    right - totalWidth * scale - actualGap * Math.max(0, buttons.length - 1),
  );
  return elements.map((element) => {
    if (element.kind !== 'button') return element;
    const width = widthById.get(element.id)! * scale;
    const result = {
      ...element,
      x: cursor,
      y: rowTop,
      width,
      height: element.height * scale,
      fontSize: (element.fontSize || 14) * scale,
    };
    cursor += width + actualGap;
    return result;
  });
}

export function toolbarRowGap(elements: WebMenuElement[]) {
  const row = elements.filter((element) => element.kind === 'button').sort((a, b) => a.x - b.x);
  if (row.length < 2) return 0.8;
  return Math.max(
    0,
    row
      .slice(1)
      .reduce((sum, element, index) => sum + element.x - row[index].x - row[index].width, 0) /
      (row.length - 1),
  );
}
