export type PixelGuideLine = {
  axis: 'x' | 'y';
  value: number;
};

export type PixelGuideBox = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

const guideValues = (box: PixelGuideBox, axis: PixelGuideLine['axis']) => {
  const start = axis === 'x' ? box.x : box.y;
  const size = axis === 'x' ? box.width : box.height;
  return [start, start + size / 2, start + size];
};

const closestGuide = (value: number, guides: number[], tolerance = 4) => {
  let closest: number | null = null;
  let closestDelta = tolerance;
  guides.forEach((guide) => {
    const delta = Math.abs(value - guide);
    if (delta <= closestDelta) {
      closest = guide;
      closestDelta = delta;
    }
  });
  return closest;
};

export const collectPixelGuideBoxes = (
  container: HTMLElement,
  movingId: string,
  selector = '[data-render-object]',
) => {
  const containerRect = container.getBoundingClientRect();
  const boxes: PixelGuideBox[] = [
    {
      id: 'container',
      x: 0,
      y: 0,
      width: containerRect.width,
      height: containerRect.height,
    },
  ];

  container.querySelectorAll<HTMLElement>(selector).forEach((element) => {
    const id = element.dataset.renderObject;
    if (!id || id === movingId) return;
    const rect = element.getBoundingClientRect();
    boxes.push({
      id,
      x: rect.left - containerRect.left,
      y: rect.top - containerRect.top,
      width: rect.width,
      height: rect.height,
    });
  });

  return boxes;
};

export const snapPixelBoxToGuides = ({
  x,
  y,
  width,
  height,
  boxes,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  boxes: PixelGuideBox[];
}) => {
  const snapAxis = (start: number, size: number, axis: PixelGuideLine['axis']) => {
    const guides = boxes.flatMap((box) => guideValues(box, axis));
    const candidates = [start, start + size / 2, start + size]
      .map((value, index) => {
        const line = closestGuide(value, guides);
        if (line === null) return null;
        const offset = index === 0 ? 0 : index === 1 ? size / 2 : size;
        return { start: line - offset, line, delta: Math.abs(value - line) };
      })
      .filter((candidate): candidate is { start: number; line: number; delta: number } =>
        Boolean(candidate),
      );
    return candidates.reduce(
      (best, candidate) => (candidate.delta < best.delta ? candidate : best),
      { start, line: null as number | null, delta: 4 },
    );
  };

  const snappedX = snapAxis(x, width, 'x');
  const snappedY = snapAxis(y, height, 'y');
  const lines: PixelGuideLine[] = [];
  if (snappedX.line !== null) lines.push({ axis: 'x', value: snappedX.line });
  if (snappedY.line !== null) lines.push({ axis: 'y', value: snappedY.line });
  return { x: snappedX.start, y: snappedY.start, lines };
};
