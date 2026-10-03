import type PptxGenJS from 'pptxgenjs';
import type {
  PptManualElement,
  PptManualShapeElement,
  WebMenuElement,
} from '../video/shared/types';
import type { PlacementGeometry } from '../web/webElementPlacement';
import { webShapeMarkup, constrainWebShapeSize } from '../web/webShapes';
import { toPptManualElementPatch, toPptWebInspectorElement } from './pptWebInspectorAdapter';
import { PPT_CONTENT_WIDTH, PPT_CONTENT_HEIGHT } from './pptWorkspaceModel';

export function createPptShape(
  shapeType: WebMenuElement['shapeType'],
  geometry: PlacementGeometry,
): PptManualShapeElement {
  return {
    id: `manual-shape-${crypto.randomUUID()}`,
    kind: 'shape',
    x: (geometry.x * PPT_CONTENT_WIDTH) / 100,
    y: (geometry.y * PPT_CONTENT_HEIGHT) / 100,
    width: (geometry.width * PPT_CONTENT_WIDTH) / 100,
    height: (geometry.height * PPT_CONTENT_HEIGHT) / 100,
    rotation: geometry.rotation,
    webStyle: {
      shapeType,
      polygonSides: 3,
      backgroundColor: '#e0e7ff',
      borderColor: '#6366f1',
      borderWidth: shapeType === 'line' ? 4 : 2,
      fillEnabled: shapeType !== 'line',
      strokeEnabled: true,
      borderRadius: 0,
    },
  };
}

export function constrainPptShape(
  element: PptManualShapeElement,
  patch: Partial<PptManualElement>,
  canvasHeight: number,
  handle?: string,
) {
  const web = toPptWebInspectorElement(element);
  const next = toPptWebInspectorElement({
    ...element,
    ...patch,
    webStyle: { ...element.webStyle, ...patch.webStyle },
    kind: 'shape',
  });
  const update: Partial<WebMenuElement> = { ...patch.webStyle };
  for (const key of ['x', 'y', 'width', 'height'] as const)
    if (patch[key] !== undefined) update[key] = next[key];
  return {
    ...patch,
    ...toPptManualElementPatch(
      element,
      constrainWebShapeSize(web, update, PPT_CONTENT_WIDTH, canvasHeight, handle),
    ),
  };
}

export function pptShapeSvg(element: PptManualShapeElement, canvasHeight = PPT_CONTENT_HEIGHT) {
  const web = toPptWebInspectorElement(element);
  const height = (element.height * canvasHeight) / PPT_CONTENT_HEIGHT;
  return webShapeMarkup(web, PPT_CONTENT_WIDTH, canvasHeight).replace(
    'width="100%" height="100%"',
    `width="${element.width}" height="${height}"`,
  );
}

/** Use the shared vector artwork so polygon rounding and gradients survive export. */
export function addPptShape(
  slide: PptxGenJS.Slide,
  element: PptManualShapeElement,
  frame: { x: number; y: number; w: number; h: number },
  canvasHeight: number,
) {
  const svg = pptShapeSvg(element, canvasHeight);
  const data = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  slide.addImage({
    data,
    ...frame,
    rotate: element.rotation || 0,
    transparency: 100 - (element.webStyle?.opacity ?? 100),
    objectName: element.id,
  });
}
