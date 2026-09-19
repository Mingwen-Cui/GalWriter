import type { InteractiveSegmentDraft } from './interactiveSegments';

export type LayoutDirection = 'right' | 'down' | 'left' | 'up';

export type GraphPoint = { x: number; y: number };

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const isGeneratedChoiceLabel = (label: string) => /^choice\s+\d+$/i.test(label.trim());

export const colorWithAlpha = (color: string, alpha: number) => {
  const normalizedAlpha = clamp(alpha, 0, 1);
  const trimmed = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) {
    const red = Number.parseInt(trimmed.slice(1, 3), 16);
    const green = Number.parseInt(trimmed.slice(3, 5), 16);
    const blue = Number.parseInt(trimmed.slice(5, 7), 16);
    return `rgba(${red}, ${green}, ${blue}, ${normalizedAlpha})`;
  }
  const rgb = trimmed.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${normalizedAlpha})`;
  return trimmed;
};

export const buildSegmentLayout = (
  segments: InteractiveSegmentDraft[],
  direction: LayoutDirection,
  cardWidth: number,
  cardHeight: number,
) => {
  const incoming = new Map<string, number>();
  const byId = new Map(segments.map((segment) => [segment.id, segment]));
  segments.forEach((segment) => {
    segment.choices.forEach((choice) => {
      if (byId.has(choice.targetSegmentId)) {
        incoming.set(choice.targetSegmentId, (incoming.get(choice.targetSegmentId) || 0) + 1);
      }
    });
  });

  const roots = segments.filter((segment) => !incoming.has(segment.id));
  const queue = (roots.length > 0 ? roots : segments.slice(0, 1)).map((segment) => ({
    id: segment.id,
    depth: 0,
  }));
  const depthById = new Map<string, number>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    const existingDepth = depthById.get(current.id);
    if (existingDepth !== undefined && existingDepth <= current.depth) continue;
    depthById.set(current.id, current.depth);
    const segment = byId.get(current.id);
    if (!segment) continue;
    segment.choices.forEach((choice) => {
      if (byId.has(choice.targetSegmentId)) {
        queue.push({ id: choice.targetSegmentId, depth: current.depth + 1 });
      }
    });
  }

  segments.forEach((segment) => {
    if (!depthById.has(segment.id)) depthById.set(segment.id, 0);
  });

  const lanesByDepth = new Map<number, InteractiveSegmentDraft[]>();
  segments.forEach((segment) => {
    const depth = depthById.get(segment.id) || 0;
    lanesByDepth.set(depth, [...(lanesByDepth.get(depth) || []), segment]);
  });

  const columnGap = 260;
  const rowGap = 116;
  const branchGap = 96;
  const positions = new Map<string, GraphPoint>();
  const sortedDepths = [...lanesByDepth.keys()].sort((a, b) => a - b);
  const maxDepth = sortedDepths.length > 0 ? sortedDepths[sortedDepths.length - 1] : 0;
  const isHorizontal = direction === 'right' || direction === 'left';
  const isForward = direction === 'right' || direction === 'down';
  sortedDepths.forEach((depth) => {
    const laneItems = lanesByDepth.get(depth) || [];
    laneItems.forEach((segment, laneIndex) => {
      const previousSegment = laneIndex > 0 ? laneItems[laneIndex - 1] : null;
      const sameParent =
        previousSegment &&
        segments.some(
          (candidate) =>
            candidate.choices.some((choice) => choice.targetSegmentId === previousSegment.id) &&
            candidate.choices.some((choice) => choice.targetSegmentId === segment.id),
        );
      const laneOffset = laneIndex * (isHorizontal ? cardHeight + rowGap : cardWidth + columnGap);
      const branchOffset = sameParent ? branchGap : 0;
      const depthOffset = isHorizontal ? cardWidth + columnGap : cardHeight + rowGap;
      positions.set(segment.id, {
        x: isHorizontal
          ? 96 + (isForward ? depth : maxDepth - depth) * depthOffset
          : 96 + laneOffset + branchOffset,
        y: isHorizontal
          ? 92 + laneOffset + branchOffset
          : 92 + (isForward ? depth : maxDepth - depth) * depthOffset,
      });
    });
  });

  return positions;
};

export const segmentLinkPath = (
  from: GraphPoint,
  to: GraphPoint,
  cardWidth: number,
  cardHeight: number,
  direction: LayoutDirection,
  radius: number,
  toCardWidth = cardWidth,
  toCardHeight = cardHeight,
) => {
  if (direction === 'down' || direction === 'up') {
    const startX = from.x + cardWidth / 2;
    const startY = direction === 'down' ? from.y + cardHeight : from.y;
    const endX = to.x + toCardWidth / 2;
    const endY = direction === 'down' ? to.y : to.y + toCardHeight;
    const verticalDirection = endY >= startY ? 1 : -1;
    const handle = Math.max(radius * 2, Math.min(180, Math.abs(endY - startY) * 0.46));
    return `M${startX},${startY} C${startX},${startY + verticalDirection * handle} ${endX},${endY - verticalDirection * handle} ${endX},${endY}`;
  }

  const startX = direction === 'right' ? from.x + cardWidth : from.x;
  const startY = from.y + cardHeight / 2;
  const endX = direction === 'right' ? to.x : to.x + toCardWidth;
  const endY = to.y + toCardHeight / 2;
  const horizontalDirection = endX >= startX ? 1 : -1;
  const handle = Math.max(radius * 2, Math.min(180, Math.abs(endX - startX) * 0.46));
  return `M${startX},${startY} C${startX + horizontalDirection * handle},${startY} ${endX - horizontalDirection * handle},${endY} ${endX},${endY}`;
};

export const graphBoundsFromPositions = (
  positions: Map<string, GraphPoint>,
  cardWidth: number,
  cardHeight: number,
) => {
  if (positions.size === 0) return { minX: 0, minY: 0, maxX: cardWidth, maxY: cardHeight };
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  positions.forEach((position) => {
    minX = Math.min(minX, position.x);
    minY = Math.min(minY, position.y);
    maxX = Math.max(maxX, position.x + cardWidth);
    maxY = Math.max(maxY, position.y + cardHeight);
  });
  return { minX, minY, maxX, maxY };
};
