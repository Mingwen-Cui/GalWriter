type Point = { x: number; y: number };
type Rect = { x: number; y: number; width: number; height: number };

export type RegionInfo = {
  id: string;
  type: 'dynamicGroup' | 'background';
  title: string;
  area: number;
  origin?: Point;
  points?: Point[];
  rect?: Rect;
};

const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 80;
const DEFAULT_BACKGROUND_WIDTH = 600;
const DEFAULT_BACKGROUND_HEIGHT = 400;
const DEFAULT_TOOL_WIDTH = 260;
const DEFAULT_TOOL_HEIGHT = 300;
const DEFAULT_GROUP_GAP = 38;

function asNumber(value: unknown, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function getNodeType(node: any) {
  return String(node?.type || '');
}

function isBackgroundNode(node: any) {
  return getNodeType(node) === 'backgroundNode';
}

function isDynamicGroupNode(node: any) {
  return getNodeType(node) === 'groupNode';
}

function getInternalNode(state: any, nodeId: string) {
  return state?.nodeLookup?.get?.(nodeId);
}

function getAbsolutePosition(state: any, node: any): Point {
  const internalNode = getInternalNode(state, node.id);
  const absolutePosition = internalNode?.internals?.positionAbsolute;
  return {
    x: absolutePosition?.x ?? node?.position?.x ?? 0,
    y: absolutePosition?.y ?? node?.position?.y ?? 0,
  };
}

function getNodeSize(
  state: any,
  node: any,
  fallbackWidth = DEFAULT_NODE_WIDTH,
  fallbackHeight = DEFAULT_NODE_HEIGHT
) {
  const internalNode = getInternalNode(state, node.id);
  const measured = internalNode?.measured ?? node?.measured;
  return {
    width: measured?.width ?? node?.width ?? asNumber(node?.style?.width, fallbackWidth),
    height: measured?.height ?? node?.height ?? asNumber(node?.style?.height, fallbackHeight),
  };
}

function getNodeCenter(
  state: any,
  node: any,
  fallbackWidth = DEFAULT_NODE_WIDTH,
  fallbackHeight = DEFAULT_NODE_HEIGHT
): Point {
  const position = getAbsolutePosition(state, node);
  const size = getNodeSize(state, node, fallbackWidth, fallbackHeight);
  return {
    x: position.x + size.width / 2,
    y: position.y + size.height / 2,
  };
}

function getRectForNode(
  state: any,
  node: any,
  fallbackWidth = DEFAULT_BACKGROUND_WIDTH,
  fallbackHeight = DEFAULT_BACKGROUND_HEIGHT
): Rect {
  const position = getAbsolutePosition(state, node);
  const size = getNodeSize(state, node, fallbackWidth, fallbackHeight);
  return {
    x: position.x,
    y: position.y,
    width: size.width,
    height: size.height,
  };
}

function pointInRect(point: Point, rect: Rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

function polygonArea(points: Point[]) {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }
  return area / 2;
}

function pointInPolygon(point: Point, polygon: Point[]) {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const current = polygon[i];
    const previous = polygon[j];
    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) /
          ((previous.y - current.y) || 0.00001) +
          current.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function cross(o: Point, a: Point, b: Point) {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function getConvexHull(points: Point[]): Point[] {
  if (points.length <= 3) return points;
  const sorted = [...points].sort((a, b) => {
    if (a.x === b.x) return a.y - b.y;
    return a.x - b.x;
  });
  const lower: Point[] = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  }
  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const point = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

function lineIntersection(p1: Point, d1: Point, p2: Point, d2: Point): Point | null {
  const denominator = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(denominator) < 0.00001) return null;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const t = (dx * d2.y - dy * d2.x) / denominator;
  return { x: p1.x + d1.x * t, y: p1.y + d1.y * t };
}

function inflateConvexPolygon(points: Point[], gap: number): Point[] {
  if (points.length < 3) return points;
  const area = polygonArea(points);
  const isClockwise = area < 0;
  const offsetLines = points.map((current, index) => {
    const next = points[(index + 1) % points.length];
    const dx = next.x - current.x;
    const dy = next.y - current.y;
    const length = Math.hypot(dx, dy) || 1;
    const normal = isClockwise
      ? { x: -dy / length, y: dx / length }
      : { x: dy / length, y: -dx / length };
    return {
      point: { x: current.x + normal.x * gap, y: current.y + normal.y * gap },
      direction: { x: dx, y: dy },
      normal,
    };
  });
  const inflated: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const previousLine = offsetLines[(i - 1 + points.length) % points.length];
    const currentLine = offsetLines[i];
    const intersection = lineIntersection(
      previousLine.point,
      previousLine.direction,
      currentLine.point,
      currentLine.direction
    );
    if (intersection) {
      inflated.push(intersection);
    } else {
      const originalPoint = points[i];
      const nx = previousLine.normal.x + currentLine.normal.x;
      const ny = previousLine.normal.y + currentLine.normal.y;
      const normalLength = Math.hypot(nx, ny) || 1;
      inflated.push({
        x: originalPoint.x + (nx / normalLength) * gap,
        y: originalPoint.y + (ny / normalLength) * gap,
      });
    }
  }
  return inflated;
}

type ChildSnapshot = { id: string; x: number; y: number; width: number; height: number };

function buildLiveHullPoints(childNodes: ChildSnapshot[], groupX: number, groupY: number, gap: number): Point[] {
  if (childNodes.length === 0) return [];
  const cardCornerPoints: Point[] = [];
  childNodes.forEach((node) => {
    const x1 = node.x - groupX;
    const y1 = node.y - groupY;
    const x2 = node.x - groupX + node.width;
    const y2 = node.y - groupY + node.height;
    cardCornerPoints.push({ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 });
  });
  const baseHull = getConvexHull(cardCornerPoints);
  if (baseHull.length < 3) return baseHull;
  return inflateConvexPolygon(baseHull, gap);
}

function buildDynamicGroupRegion(state: any, groupNode: any): RegionInfo | null {
  const childIds = ((groupNode.data?.childIds as string[]) || []).filter(Boolean);
  const groupPosition = getAbsolutePosition(state, groupNode);
  const groupGap = typeof groupNode.data?.gap === 'number' ? groupNode.data.gap : DEFAULT_GROUP_GAP;
  const childIdSet = new Set(childIds);
  const childNodes: ChildSnapshot[] = state.nodes
    .filter((node: any) => childIdSet.has(node.id))
    .map((node: any) => {
      const position = getAbsolutePosition(state, node);
      const size = getNodeSize(state, node);
      return { id: node.id, x: position.x, y: position.y, width: size.width, height: size.height };
    });
  let points = buildLiveHullPoints(childNodes, groupPosition.x, groupPosition.y, groupGap);
  if (points.length < 3) {
    points = (groupNode.data?.hullPoints as Point[]) || [];
  }
  if (points.length < 3) return null;
  return {
    id: groupNode.id,
    type: 'dynamicGroup',
    title: (groupNode.data?.title as string) || '动态包裹',
    area: Math.abs(polygonArea(points)),
    origin: groupPosition,
    points,
  };
}

function buildBackgroundRegion(state: any, backgroundNode: any): RegionInfo {
  const rect = getRectForNode(state, backgroundNode, DEFAULT_BACKGROUND_WIDTH, DEFAULT_BACKGROUND_HEIGHT);
  return {
    id: backgroundNode.id,
    type: 'background',
    title: (backgroundNode.data?.title as string) || '背景区域',
    area: rect.width * rect.height,
    rect,
  };
}

function isPointInsideRegion(point: Point, region: RegionInfo) {
  if (region.type === 'background' && region.rect) {
    return pointInRect(point, region.rect);
  }
  if (region.type === 'dynamicGroup' && region.origin && region.points) {
    return pointInPolygon(
      { x: point.x - region.origin.x, y: point.y - region.origin.y },
      region.points
    );
  }
  return false;
}

export function findContainingRegion(state: any, nodeId: string): RegionInfo | null {
  const thisNode = state.nodes.find((node: any) => node.id === nodeId);
  if (!thisNode) return null;

  const center = getNodeCenter(state, thisNode, DEFAULT_TOOL_WIDTH, DEFAULT_TOOL_HEIGHT);
  const regions: RegionInfo[] = [];

  state.nodes.forEach((node: any) => {
    if (node.id === nodeId) return;
    if (isDynamicGroupNode(node)) {
      const region = buildDynamicGroupRegion(state, node);
      if (region && isPointInsideRegion(center, region)) {
        regions.push(region);
      }
    }
    if (isBackgroundNode(node)) {
      const region = buildBackgroundRegion(state, node);
      if (isPointInsideRegion(center, region)) {
        regions.push(region);
      }
    }
  });

  if (regions.length === 0) return null;
  return regions.sort((a, b) => a.area - b.area)[0];
}

export function isNodeInsideRegion(state: any, node: any, region: RegionInfo) {
  const center = getNodeCenter(state, node);
  return isPointInsideRegion(center, region);
}

export function isStoryContentNode(node: any) {
  const type = getNodeType(node);
  return type === 'storyNode' || type === 'characterNode' || type === 'sceneNode';
}

export function isPlotStructureNode(node: any) {
  const type = getNodeType(node);
  return type === 'plotStructureNode';
}

export function isBatchReplaceNode(node: any) {
  const type = getNodeType(node);
  return (
    type === 'batchReplaceNode' ||
    type === 'batchReplace' ||
    type === 'batchReplaceTool' ||
    type === 'BatchReplaceNode'
  );
}

export function isRegionToolNode(node: any) {
  return isBatchReplaceNode(node) || isPlotStructureNode(node);
}

export function getNodeRect(state: any, node: any, fallbackWidth: number, fallbackHeight: number): Rect {
  return getRectForNode(state, node, fallbackWidth, fallbackHeight);
}

export function getNodeCenterPoint(state: any, node: any, fallbackWidth?: number, fallbackHeight?: number): Point {
  return getNodeCenter(state, node, fallbackWidth, fallbackHeight);
}
