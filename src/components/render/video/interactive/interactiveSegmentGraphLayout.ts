import type { InteractiveSegmentDraft } from './interactiveSegments';

export type LayoutDirection = 'right' | 'down';

export type GraphPoint = { x: number; y: number };

export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

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
      const laneOffset = laneIndex * (direction === 'right' ? cardHeight + rowGap : cardWidth + columnGap);
      const branchOffset = sameParent ? branchGap : 0;
      positions.set(segment.id, {
        x:
          direction === 'right'
            ? 96 + depth * (cardWidth + columnGap)
            : 96 + laneOffset + branchOffset,
        y:
          direction === 'right'
            ? 92 + laneOffset + branchOffset
            : 92 + depth * (cardHeight + rowGap),
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
) => {
  const rounded = radius > 8;
  if (direction === 'down') {
    const startX = from.x + cardWidth / 2;
    const startY = from.y + cardHeight;
    const endX = to.x + cardWidth / 2;
    const endY = to.y;
    const middleY = startY + Math.max(52, (endY - startY) / 2);
    const curve = Math.min(radius, 32, Math.abs(endX - startX) / 2, Math.abs(endY - startY) / 2);
    if (!rounded || curve <= 2) return `M${startX},${startY} L${startX},${middleY} L${endX},${middleY} L${endX},${endY}`;
    const horizontalDirection = endX >= startX ? 1 : -1;
    const verticalDirection = endY >= middleY ? 1 : -1;
    return [
      `M${startX},${startY}`,
      `L${startX},${middleY - curve}`,
      `Q${startX},${middleY} ${startX + horizontalDirection * curve},${middleY}`,
      `L${endX - horizontalDirection * curve},${middleY}`,
      `Q${endX},${middleY} ${endX},${middleY + verticalDirection * curve}`,
      `L${endX},${endY}`,
    ].join(' ');
  }

  const startX = from.x + cardWidth;
  const startY = from.y + cardHeight / 2;
  const endX = to.x;
  const endY = to.y + cardHeight / 2;
  const middleX = startX + Math.max(56, (endX - startX) / 2);
  const curve = Math.min(radius, 32, Math.abs(endX - startX) / 2, Math.abs(endY - startY) / 2);
  if (!rounded || curve <= 2) return `M${startX},${startY} L${middleX},${startY} L${middleX},${endY} L${endX},${endY}`;
  const verticalDirection = endY >= startY ? 1 : -1;
  const horizontalDirection = endX >= middleX ? 1 : -1;
  return [
    `M${startX},${startY}`,
    `L${middleX - curve},${startY}`,
    `Q${middleX},${startY} ${middleX},${startY + verticalDirection * curve}`,
    `L${middleX},${endY - verticalDirection * curve}`,
    `Q${middleX},${endY} ${middleX + horizontalDirection * curve},${endY}`,
    `L${endX},${endY}`,
  ].join(' ');
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
