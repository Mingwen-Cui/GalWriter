import type { Node } from '@xyflow/react';

type HandleSide = 'top' | 'right' | 'bottom' | 'left';

const HANDLE_SIDES: Array<{
  side: HandleSide;
  normal: { x: number; y: number };
}> = [
  { side: 'top', normal: { x: 0, y: -1 } },
  { side: 'right', normal: { x: 1, y: 0 } },
  { side: 'bottom', normal: { x: 0, y: 1 } },
  { side: 'left', normal: { x: -1, y: 0 } },
];

const getNodeSize = (node: Node) => ({
  width: node.measured?.width || (typeof node.style?.width === 'number' ? node.style.width : 300),
  height:
    node.measured?.height || (typeof node.style?.height === 'number' ? node.style.height : 200),
});

const getHandlePoint = (node: Node, side: HandleSide) => {
  const { width, height } = getNodeSize(node);
  switch (side) {
    case 'top':
      return { x: node.position.x + width / 2, y: node.position.y };
    case 'right':
      return { x: node.position.x + width, y: node.position.y + height / 2 };
    case 'bottom':
      return { x: node.position.x + width / 2, y: node.position.y + height };
    case 'left':
      return { x: node.position.x, y: node.position.y + height / 2 };
  }
};

/** Pick the shortest pair of outward-facing card handles from their layout geometry. */
export const getStoryConnectionHandles = (source: Node, target: Node) => {
  const sourceCenter = getHandlePoint(source, 'top');
  sourceCenter.y += getNodeSize(source).height / 2;
  const targetCenter = getHandlePoint(target, 'top');
  targetCenter.y += getNodeSize(target).height / 2;
  const towardTarget = {
    x: targetCenter.x - sourceCenter.x,
    y: targetCenter.y - sourceCenter.y,
  };
  const towardSource = { x: -towardTarget.x, y: -towardTarget.y };

  let best:
    | { sourceHandle: HandleSide; targetHandle: HandleSide; distance: number }
    | undefined;

  for (const sourceSide of HANDLE_SIDES) {
    if (sourceSide.normal.x * towardTarget.x + sourceSide.normal.y * towardTarget.y <= 0) {
      continue;
    }
    const sourcePoint = getHandlePoint(source, sourceSide.side);
    for (const targetSide of HANDLE_SIDES) {
      if (targetSide.normal.x * towardSource.x + targetSide.normal.y * towardSource.y <= 0) {
        continue;
      }
      const targetPoint = getHandlePoint(target, targetSide.side);
      const distance =
        (targetPoint.x - sourcePoint.x) ** 2 + (targetPoint.y - sourcePoint.y) ** 2;
      if (!best || distance < best.distance) {
        best = { sourceHandle: sourceSide.side, targetHandle: targetSide.side, distance };
      }
    }
  }

  return best
    ? { sourceHandle: best.sourceHandle, targetHandle: best.targetHandle }
    : { sourceHandle: 'bottom' as const, targetHandle: 'top' as const };
};
