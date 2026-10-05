export type WebFlowView = {
  x: number;
  y: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  zoom: number;
  minZoom: number;
  maxZoom: number;
  gapX: number;
  gapY: number;
  cardWidth: number;
  cardHeight: number;
};

export const defaultWebFlowView: WebFlowView = {
  x: 8,
  y: 18,
  width: 90,
  height: 78,
  offsetX: 0,
  offsetY: 0,
  zoom: 1,
  minZoom: 0.35,
  maxZoom: 1.85,
  gapX: 260,
  gapY: 116,
  cardWidth: 208,
  cardHeight: 132,
};

// Kept self-contained so the exported player uses the same bounds as the editor.
export function normalizeWebFlowView(value?: Partial<WebFlowView>): WebFlowView {
  const number = (input: number | undefined, fallback: number, min: number, max: number) =>
    Math.max(
      min,
      Math.min(max, typeof input === 'number' && Number.isFinite(input) ? input : fallback),
    );
  const x = number(value?.x, 8, 0, 95);
  const y = number(value?.y, 18, 0, 95);
  const minZoom = number(value?.minZoom, 0.35, 0.1, 3);
  const maxZoom = number(value?.maxZoom, 1.85, minZoom, 5);
  return {
    x,
    y,
    width: number(value?.width, 90, 5, 100 - x),
    height: number(value?.height, 78, 5, 100 - y),
    offsetX: number(value?.offsetX, 0, -1000, 1000),
    offsetY: number(value?.offsetY, 0, -1000, 1000),
    zoom: number(value?.zoom, 1, minZoom, maxZoom),
    minZoom,
    maxZoom,
    gapX: number(value?.gapX, 260, 0, 1000),
    gapY: number(value?.gapY, 116, 0, 1000),
    cardWidth: number(value?.cardWidth, 208, 140, 420),
    cardHeight: number(value?.cardHeight, 132, 90, 260),
  };
}
