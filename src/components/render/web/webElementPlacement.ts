import type { WebMenuElement } from '../video/shared/types';
import { webShapeAspectRatio } from './webShapes';

export type WebPlacementTool = {
  kind: WebMenuElement['kind'];
  shapeType?: WebMenuElement['shapeType'];
};
export type PlacementPoint = { x: number; y: number };
export type PlacementGeometry = Pick<WebMenuElement, 'x' | 'y' | 'width' | 'height' | 'rotation'>;

export function placementGeometry(
  tool: WebPlacementTool,
  start: PlacementPoint,
  end: PlacementPoint | null,
  canvasWidth: number,
  canvasHeight: number,
): PlacementGeometry {
  if (end && tool.kind === 'shape' && tool.shapeType === 'line') {
    const dx = ((end.x - start.x) * canvasWidth) / 100;
    const dy = ((end.y - start.y) * canvasHeight) / 100;
    const width = (Math.max(1, Math.hypot(dx, dy)) / canvasWidth) * 100;
    const height = (6 / canvasHeight) * 100;
    return {
      x: (start.x + end.x - width) / 2,
      y: (start.y + end.y - height) / 2,
      width,
      height,
      rotation: (Math.atan2(dy, dx) * 180) / Math.PI,
    };
  }
  const ratio = tool.kind === 'shape' ? webShapeAspectRatio(tool) : null;
  if (ratio !== null) {
    const defaultWidth = Math.min(canvasWidth, canvasHeight) * 0.2;
    const widthPixels = end
      ? Math.min(
          canvasWidth,
          canvasHeight / ratio,
          Math.max(
            1,
            (Math.abs(end.x - start.x) * canvasWidth) / 50,
            (Math.abs(end.y - start.y) * canvasHeight) / 50 / ratio,
          ),
        )
      : defaultWidth;
    const width = (widthPixels / canvasWidth) * 100,
      height = ((widthPixels * ratio) / canvasHeight) * 100;
    return { x: start.x - width / 2, y: start.y - height / 2, width, height, rotation: 0 };
  }
  const defaults =
    tool.kind === 'text' || tool.kind === 'button'
      ? { width: 24, height: 8 }
      : { width: 20, height: tool.shapeType === 'line' ? (6 / canvasHeight) * 100 : 20 };
  const width = end ? Math.min(100, Math.max(1, 2 * Math.abs(end.x - start.x))) : defaults.width;
  const height = end ? Math.min(100, Math.max(1, 2 * Math.abs(end.y - start.y))) : defaults.height;
  return {
    x: start.x - width / 2,
    y: start.y - height / 2,
    width,
    height,
    rotation: 0,
  };
}
