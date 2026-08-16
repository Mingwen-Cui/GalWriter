import type { Node } from '@xyflow/react';

import {
  AI_CHARACTER_CARD_LAYOUT_HEIGHT,
  AI_SCENE_CARD_LAYOUT_HEIGHT,
  AI_STORY_CARD_HEIGHT,
  AI_STORY_CARD_WIDTH,
  SETTING_NODE_CARD_WIDTH,
} from './constants';

export type PlacementPoint = { x: number; y: number };
export type PlacementBounds = { minX: number; minY: number; maxX: number; maxY: number };

/** Gap between a new assistant batch and existing canvas content. */
export const ASSISTANT_PLACEMENT_GAP = 200;

const CONTENT_NODE_TYPES = new Set([
  'storyNode',
  'characterNode',
  'sceneNode',
  'numberConditionNode',
]);

export const isAssistantPlacementContentNode = (node: Node) => CONTENT_NODE_TYPES.has(node.type || '');

export const getAssistantPlacementNodeSize = (node: Node) => {
  const width =
    Number(node.measured?.width) ||
    Number(node.style?.width) ||
    (node.type === 'storyNode'
      ? AI_STORY_CARD_WIDTH
      : node.type === 'numberConditionNode'
        ? 300
        : SETTING_NODE_CARD_WIDTH);
  const height =
    Number(node.measured?.height) ||
    Number(node.style?.height) ||
    (node.type === 'characterNode'
      ? AI_CHARACTER_CARD_LAYOUT_HEIGHT
      : node.type === 'sceneNode'
        ? AI_SCENE_CARD_LAYOUT_HEIGHT
        : AI_STORY_CARD_HEIGHT);
  return { width, height };
};

export const getNodePlacementBounds = (node: Node): PlacementBounds => {
  const size = getAssistantPlacementNodeSize(node);
  return {
    minX: node.position.x,
    minY: node.position.y,
    maxX: node.position.x + size.width,
    maxY: node.position.y + size.height,
  };
};

export const getContentPlacementBounds = (
  nodes: Node[],
  excludeIds?: ReadonlySet<string>,
): PlacementBounds | null => {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let found = false;

  nodes.forEach((node) => {
    if (!isAssistantPlacementContentNode(node)) return;
    if (excludeIds?.has(node.id)) return;
    const bounds = getNodePlacementBounds(node);
    found = true;
    minX = Math.min(minX, bounds.minX);
    minY = Math.min(minY, bounds.minY);
    maxX = Math.max(maxX, bounds.maxX);
    maxY = Math.max(maxY, bounds.maxY);
  });

  return found ? { minX, minY, maxX, maxY } : null;
};

export const collectContentPlacementRects = (
  nodes: Node[],
  excludeIds?: ReadonlySet<string>,
): PlacementBounds[] =>
  nodes
    .filter(
      (node) => isAssistantPlacementContentNode(node) && !excludeIds?.has(node.id),
    )
    .map(getNodePlacementBounds);

export const rectsOverlap = (a: PlacementBounds, b: PlacementBounds, padding = 0) =>
  !(
    a.maxX + padding <= b.minX ||
    b.maxX + padding <= a.minX ||
    a.maxY + padding <= b.minY ||
    b.maxY + padding <= a.minY
  );

/**
 * Resolve the top-left origin for a new assistant card batch.
 * Prefers the session spawn cursor, then the right edge of existing content,
 * then the viewport center. Scans right/down when the candidate rect overlaps.
 */
export const resolveAssistantAppendLayoutOrigin = ({
  existingNodes,
  batchWidth,
  batchHeight,
  viewportCenter,
  spawnCursor,
  excludeIds,
  gap = ASSISTANT_PLACEMENT_GAP,
}: {
  existingNodes: Node[];
  batchWidth: number;
  batchHeight: number;
  viewportCenter: PlacementPoint;
  spawnCursor?: PlacementPoint | null;
  excludeIds?: ReadonlySet<string>;
  gap?: number;
}): { layoutLeft: number; layoutTop: number } => {
  const occupied = collectContentPlacementRects(existingNodes, excludeIds);
  const existingBounds = getContentPlacementBounds(existingNodes, excludeIds);

  let layoutLeft = viewportCenter.x - batchWidth / 2;
  let layoutTop = viewportCenter.y - batchHeight / 2;

  if (spawnCursor) {
    layoutLeft = spawnCursor.x + gap;
    layoutTop = spawnCursor.y;
  } else if (existingBounds) {
    layoutLeft = existingBounds.maxX + gap;
    layoutTop = existingBounds.minY;
  }

  if (occupied.length === 0) {
    return { layoutLeft, layoutTop };
  }

  const stepX = Math.max(160, Math.min(batchWidth || AI_STORY_CARD_WIDTH, 420));
  const stepY = Math.max(160, Math.min(batchHeight || AI_STORY_CARD_HEIGHT, 360));
  const startLeft = layoutLeft;
  const startTop = layoutTop;

  for (let attempt = 0; attempt < 48; attempt += 1) {
    const candidate: PlacementBounds = {
      minX: layoutLeft,
      minY: layoutTop,
      maxX: layoutLeft + batchWidth,
      maxY: layoutTop + batchHeight,
    };
    const overlaps = occupied.some((rect) => rectsOverlap(candidate, rect, gap * 0.35));
    if (!overlaps) return { layoutLeft, layoutTop };

    if (attempt % 4 === 3) {
      layoutLeft = startLeft;
      layoutTop += stepY;
    } else {
      layoutLeft += stepX;
    }
  }

  // Fallback: park clearly below all existing content.
  if (existingBounds) {
    return {
      layoutLeft: existingBounds.minX,
      layoutTop: existingBounds.maxY + gap,
    };
  }
  return { layoutLeft: startLeft, layoutTop: startTop + stepY };
};

export const boundsFromOriginAndSize = (
  layoutLeft: number,
  layoutTop: number,
  width: number,
  height: number,
): PlacementBounds => ({
  minX: layoutLeft,
  minY: layoutTop,
  maxX: layoutLeft + width,
  maxY: layoutTop + height,
});

/** Next append batch should start just past the right edge of this batch. */
export const spawnCursorFromBounds = (bounds: PlacementBounds): PlacementPoint => ({
  x: bounds.maxX,
  y: bounds.minY,
});

export const spawnCursorFromNodes = (nodes: Node[]): PlacementPoint | null => {
  const bounds = getContentPlacementBounds(nodes);
  return bounds ? spawnCursorFromBounds(bounds) : null;
};
