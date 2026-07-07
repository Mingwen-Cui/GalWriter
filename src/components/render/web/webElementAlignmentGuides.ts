import type { WebMenuElement } from '../video/shared/types';

export type WebAlignmentGuideLine = {
  axis: 'x' | 'y';
  value: number;
};

type Axis = WebAlignmentGuideLine['axis'];
type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const getElementGuideValues = (element: WebMenuElement, axis: Axis) => {
  const start = axis === 'x' ? element.x : element.y;
  const size = axis === 'x' ? element.width : element.height;
  return [start, start + size / 2, start + size];
};

export const getElementSnapGuides = (
  elements: WebMenuElement[],
  movingId: string,
  axis: Axis,
) => {
  const guides: number[] = [];
  elements.forEach((element) => {
    if (element.id === movingId || !element.visible) return;
    guides.push(...getElementGuideValues(element, axis));
  });
  return guides;
};

const findClosestGuide = (value: number, guides: number[], tolerance: number) => {
  let best: number | null = null;
  let bestDelta = tolerance;
  guides.forEach((guide) => {
    const delta = Math.abs(value - guide);
    if (delta <= bestDelta) {
      best = guide;
      bestDelta = delta;
    }
  });
  return best;
};

const collectMatchedGuideLines = ({
  axis,
  values,
  guides,
  tolerance,
}: {
  axis: Axis;
  values: number[];
  guides: number[];
  tolerance: number;
}) => {
  const matched: Array<WebAlignmentGuideLine & { delta: number }> = [];
  values.forEach((value) => {
    guides.forEach((guide) => {
      const delta = Math.abs(value - guide);
      if (delta > tolerance) return;
      matched.push({ axis, value: guide, delta });
    });
  });
  return matched
    .sort((a, b) => a.delta - b.delta)
    .reduce<WebAlignmentGuideLine[]>((lines, line) => {
      if (lines.some((existing) => Math.abs(existing.value - line.value) <= tolerance)) {
        return lines;
      }
      lines.push({ axis: line.axis, value: line.value });
      return lines;
    }, []);
};

const findBestBoxSnap = ({
  start,
  size,
  guides,
  tolerance,
}: {
  start: number;
  size: number;
  guides: number[];
  tolerance: number;
}) => {
  const candidates = [
    { nextStart: start, line: null as number | null, delta: tolerance },
    ...[start, start + size / 2, start + size]
      .map((value, index) => {
        const line = findClosestGuide(value, guides, tolerance);
        if (line === null) return null;
        const offset = index === 0 ? 0 : index === 1 ? size / 2 : size;
        return {
          nextStart: line - offset,
          line,
          delta: Math.abs(value - line),
        };
      })
      .filter((candidate): candidate is { nextStart: number; line: number; delta: number } =>
        Boolean(candidate),
      ),
  ];
  return candidates.reduce((best, candidate) => (candidate.delta < best.delta ? candidate : best));
};

export const snapElementBoxToElementGuides = ({
  x,
  y,
  width,
  height,
  rect,
  elements,
  movingId,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  rect: DOMRect;
  elements: WebMenuElement[];
  movingId: string;
}) => {
  const toleranceX = (2 / rect.width) * 100;
  const toleranceY = (2 / rect.height) * 100;
  const xGuides = getElementSnapGuides(elements, movingId, 'x');
  const yGuides = getElementSnapGuides(elements, movingId, 'y');
  const xSnap = findBestBoxSnap({
    start: x,
    size: width,
    guides: xGuides,
    tolerance: toleranceX,
  });
  const ySnap = findBestBoxSnap({
    start: y,
    size: height,
    guides: yGuides,
    tolerance: toleranceY,
  });
  return {
    x: xSnap.nextStart,
    y: ySnap.nextStart,
    lines: [
      ...collectMatchedGuideLines({
        axis: 'x',
        values: [xSnap.nextStart, xSnap.nextStart + width / 2, xSnap.nextStart + width],
        guides: xGuides,
        tolerance: toleranceX,
      }),
      ...collectMatchedGuideLines({
        axis: 'y',
        values: [ySnap.nextStart, ySnap.nextStart + height / 2, ySnap.nextStart + height],
        guides: yGuides,
        tolerance: toleranceY,
      }),
    ],
  };
};

export const snapResizeBoxToElementGuides = ({
  x,
  y,
  width,
  height,
  handle,
  rect,
  elements,
  movingId,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  handle: ResizeHandle;
  rect: DOMRect;
  elements: WebMenuElement[];
  movingId: string;
}) => {
  let nextX = x;
  let nextY = y;
  let nextWidth = width;
  let nextHeight = height;
  const toleranceX = (2 / rect.width) * 100;
  const toleranceY = (2 / rect.height) * 100;
  const xGuides = getElementSnapGuides(elements, movingId, 'x');
  const yGuides = getElementSnapGuides(elements, movingId, 'y');

  if (handle.includes('e')) {
    const line = findClosestGuide(nextX + nextWidth, xGuides, toleranceX);
    if (line !== null) {
      nextWidth += line - (nextX + nextWidth);
    }
  }
  if (handle.includes('w')) {
    const line = findClosestGuide(nextX, xGuides, toleranceX);
    if (line !== null) {
      nextWidth += nextX - line;
      nextX = line;
    }
  }
  if (handle.includes('s')) {
    const line = findClosestGuide(nextY + nextHeight, yGuides, toleranceY);
    if (line !== null) {
      nextHeight += line - (nextY + nextHeight);
    }
  }
  if (handle.includes('n')) {
    const line = findClosestGuide(nextY, yGuides, toleranceY);
    if (line !== null) {
      nextHeight += nextY - line;
      nextY = line;
    }
  }

  const xValues = [
    ...(handle.includes('w') ? [nextX] : []),
    ...(handle.includes('e') ? [nextX + nextWidth] : []),
  ];
  const yValues = [
    ...(handle.includes('n') ? [nextY] : []),
    ...(handle.includes('s') ? [nextY + nextHeight] : []),
  ];
  const lines = [
    ...collectMatchedGuideLines({
      axis: 'x',
      values: xValues,
      guides: xGuides,
      tolerance: toleranceX,
    }),
    ...collectMatchedGuideLines({
      axis: 'y',
      values: yValues,
      guides: yGuides,
      tolerance: toleranceY,
    }),
  ];

  return { x: nextX, y: nextY, width: nextWidth, height: nextHeight, lines };
};
