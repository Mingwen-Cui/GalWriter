import type { LayoutDirection } from '../video/interactive/interactiveSegmentGraphLayout';

// Self-contained so the exported player uses exactly the same spacing rules.
export function buildWebFlowLayout(
  cards: Array<{ id: string; targets: string[]; width: number; height: number }>,
  direction: LayoutDirection,
  gapX: number,
  gapY: number,
) {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const incoming = new Set(cards.flatMap((card) => card.targets.filter((id) => byId.has(id))));
  const roots = cards.filter((card) => !incoming.has(card.id));
  const queue = (roots.length ? roots : cards.slice(0, 1)).map((card) => ({ id: card.id, depth: 0 }));
  const depths = new Map<string, number>();
  for (let index = 0; index < queue.length; index++) {
    const item = queue[index];
    if (depths.has(item.id)) continue;
    depths.set(item.id, item.depth);
    byId.get(item.id)?.targets.forEach((id) => { if (byId.has(id) && !depths.has(id)) queue.push({ id, depth: item.depth + 1 }); });
  }
  const lanes = new Map<number, typeof cards>();
  cards.forEach((card) => {
    const depth = depths.get(card.id) || 0;
    lanes.set(depth, [...(lanes.get(depth) || []), card]);
  });
  const horizontal = direction === 'right' || direction === 'left';
  const reverse = direction === 'left' || direction === 'up';
  const levels = Array.from(lanes.keys()).sort((a, b) => reverse ? b - a : a - b);
  const positions = new Map<string, { x: number; y: number; width: number; height: number }>();
  let depthOffset = 120;
  levels.forEach((depth) => {
    const lane = lanes.get(depth)!;
    let laneOffset = 120;
    lane.forEach((card) => {
      positions.set(card.id, { x: horizontal ? depthOffset : laneOffset, y: horizontal ? laneOffset : depthOffset, width: card.width, height: card.height });
      laneOffset += horizontal ? card.height + gapY : card.width + gapX;
    });
    depthOffset += Math.max(...lane.map((card) => horizontal ? card.width : card.height)) + (horizontal ? gapX : gapY);
  });
  return positions;
}
