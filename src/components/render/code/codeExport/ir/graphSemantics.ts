import type { Edge, Node } from '@xyflow/react';

import { sanitizeRenpyIdentifier, stableHash } from '../model';
import type { RenpyExportSettings } from '../types';

export const isRuntimeNode = (node: Node) =>
  (node.type === 'storyNode' || node.type === 'numberConditionNode') && node.data?.hidden !== true;
export const stableLabelForNode = (id: string) =>
  `gw_${sanitizeRenpyIdentifier(id, 'story').slice(0, 34)}_${stableHash(id).slice(0, 6)}`;

const containingRegion = (node: Node, nodes: Node[], type: 'groupNode' | 'backgroundNode') => {
  const candidates = nodes.filter((region) => region.type === type && region.data?.hidden !== true);
  const direct = candidates.find(
    (region) =>
      Array.isArray(region.data?.childIds) && (region.data.childIds as string[]).includes(node.id),
  );
  if (direct) return direct;
  const x = node.position.x + Number(node.measured?.width || node.width || 0) / 2;
  const y = node.position.y + Number(node.measured?.height || node.height || 0) / 2;
  return candidates.find((region) => {
    const width = Number(region.measured?.width || region.width || region.style?.width || 0);
    const height = Number(region.measured?.height || region.height || region.style?.height || 0);
    return (
      x >= region.position.x &&
      x <= region.position.x + width &&
      y >= region.position.y &&
      y <= region.position.y + height
    );
  });
};

export const chapterForNode = (node: Node, nodes: Node[], settings: RenpyExportSettings) => {
  if (settings.splitMode === 'single') return { id: 'story', title: 'Story' };
  const region = containingRegion(
    node,
    nodes,
    settings.splitMode === 'group' ? 'groupNode' : 'backgroundNode',
  );
  if (!region) return { id: 'ungrouped', title: 'Ungrouped' };
  const title =
    typeof region.data?.title === 'string' && region.data.title.trim()
      ? region.data.title.trim()
      : settings.splitMode;
  return {
    id: `${settings.splitMode}-${stableHash(region.id).slice(0, 8)}`,
    title,
    sourceRegionId: region.id,
  };
};

export const runtimeGraph = (nodes: Node[], edges: Edge[]) => {
  const runtimeNodes = nodes.filter(isRuntimeNode);
  const runtimeIds = new Set(runtimeNodes.map((node) => node.id));
  const outgoing = new Map<string, Edge[]>();
  edges
    .filter((edge) => runtimeIds.has(edge.source) && runtimeIds.has(edge.target))
    .forEach((edge) => outgoing.set(edge.source, [...(outgoing.get(edge.source) || []), edge]));
  const entry =
    runtimeNodes.find((node) => node.data?.isRoot) ||
    runtimeNodes.find((node) => node.type === 'storyNode');
  return { runtimeNodes, runtimeIds, outgoing, entry };
};

export const selectConditionHandle = (
  value: number,
  threshold: number,
  ranges: Array<{ id: string; min: number; max: number }>,
) => {
  const matched = ranges.find(
    (range) => range.min <= range.max && value >= range.min && value <= range.max,
  );
  return matched
    ? `out-range-${matched.id}`
    : value >= threshold
      ? 'out-greater'
      : 'out-less-equal';
};
