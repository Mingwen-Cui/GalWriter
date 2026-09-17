/** Converts a viewport vector to authored canvas coordinates, including ancestor rotation/scale. */
export function presentationPointerDelta(element: HTMLElement, dx: number, dy: number) {
  const root = element.closest<HTMLElement>('[data-presentation-width]');
  let transform = new DOMMatrix();
  for (let parent: HTMLElement | null = element.parentElement; parent; parent = parent.parentElement) {
    const css = getComputedStyle(parent).transform;
    if (css && css !== 'none') transform = new DOMMatrix(css).multiply(transform);
  }
  const inverse = transform.inverse();
  const point = new DOMPoint(dx, dy, 0, 0).matrixTransform(inverse);
  return { x: point.x * (root ? Number(root.dataset.presentationWidth) / Math.max(1, root.clientWidth) : 1),
    y: point.y * (root ? Number(root.dataset.presentationHeight) / Math.max(1, root.clientHeight) : 1) };
}
