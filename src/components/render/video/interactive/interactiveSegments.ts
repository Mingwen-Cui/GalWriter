import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react';

import { getNodeDisplayTitle } from '../shared/storyNodes';

export type InteractiveChoiceDraft = {
  id: string;
  label: string;
  targetSegmentId: string;
  targetNodeId: string;
};

export type InteractiveSegmentDraft = {
  id: string;
  name: string;
  enabled: boolean;
  source: 'auto' | 'edited';
  nodeIds: string[];
  choices: InteractiveChoiceDraft[];
};

const storyNodes = (nodes: FlowNode[]) =>
  nodes.filter((node) => node.type === 'storyNode' && !node.data?.hidden);

const visibleNodes = (nodes: FlowNode[]) => nodes.filter((node) => !node.data?.hidden);

const isStoryNode = (node?: FlowNode | null) => node?.type === 'storyNode';

const isNumberSwitchNode = (node?: FlowNode | null) => node?.type === 'numberConditionNode';

const isAuxiliaryNode = (node?: FlowNode | null) =>
  Boolean(node) && !isStoryNode(node) && !isNumberSwitchNode(node);

const edgeLabel = (edge: FlowEdge, fallback: string) =>
  String(edge.data?.label || edge.label || fallback).trim();

const segmentId = (index: number) => `segment-${String(index).padStart(3, '0')}`;

export const sanitizeExportName = (value: string) => {
  const trimmed = value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return trimmed || 'untitled';
};

export const buildInteractiveSegments = (
  nodes: FlowNode[],
  edges: FlowEdge[],
): InteractiveSegmentDraft[] => {
  const visibleStoryNodes = storyNodes(nodes);
  const nodeById = new Map(visibleNodes(nodes).map((node) => [node.id, node]));
  const storyNodeById = new Map(visibleStoryNodes.map((node) => [node.id, node]));
  const root = visibleStoryNodes.find((node) => node.data?.isRoot) || visibleStoryNodes[0];
  if (!root) return [];

  const rawOutgoing = new Map<string, FlowEdge[]>();
  edges.forEach((edge) => {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) return;
    rawOutgoing.set(edge.source, [...(rawOutgoing.get(edge.source) || []), edge]);
  });
  rawOutgoing.forEach((items) =>
    items.sort((a, b) => edgeLabel(a, '').localeCompare(edgeLabel(b, ''))),
  );

  type ResolvedExit = {
    label: string;
    targetNodeId: string;
  };

  const resolveStoryExits = (
    sourceNodeId: string,
    fallbackLabel = '',
    visiting = new Set<string>(),
  ): ResolvedExit[] => {
    if (visiting.has(sourceNodeId)) return [];
    visiting.add(sourceNodeId);
    const exits = rawOutgoing.get(sourceNodeId) || [];
    const branchable: ResolvedExit[] = [];
    const auxiliary: ResolvedExit[] = [];

    exits.forEach((edge, index) => {
      const target = nodeById.get(edge.target);
      if (!target) return;
      const label = edgeLabel(edge, fallbackLabel || `Choice ${index + 1}`);
      if (isStoryNode(target)) {
        branchable.push({ label, targetNodeId: target.id });
        return;
      }

      const passthroughExits = resolveStoryExits(target.id, label, new Set(visiting));
      if (passthroughExits.length === 0) return;
      passthroughExits.forEach((exit, exitIndex) => {
        const resolvedExit = {
          label: isNumberSwitchNode(target) ? exit.label || label || `Choice ${exitIndex + 1}` : label || exit.label,
          targetNodeId: exit.targetNodeId,
        };
        if (isNumberSwitchNode(target)) {
          branchable.push(resolvedExit);
        } else if (isAuxiliaryNode(target)) {
          auxiliary.push(resolvedExit);
        }
      });
    });

    const resolved = branchable.length > 0 ? branchable : auxiliary.slice(0, 1);
    const seen = new Set<string>();
    return resolved.filter((exit) => {
      const key = `${exit.label}::${exit.targetNodeId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const effectiveOutgoing = new Map<string, ResolvedExit[]>();
  visibleStoryNodes.forEach((node) => effectiveOutgoing.set(node.id, resolveStoryExits(node.id)));
  const incomingCount = new Map<string, number>();
  effectiveOutgoing.forEach((items) => {
    items.forEach((item) => incomingCount.set(item.targetNodeId, (incomingCount.get(item.targetNodeId) || 0) + 1));
  });

  const segments: InteractiveSegmentDraft[] = [];
  const segmentByStartNode = new Map<string, InteractiveSegmentDraft>();

  const createSegment = (startNodeId: string): InteractiveSegmentDraft | null => {
    if (segmentByStartNode.has(startNodeId)) return segmentByStartNode.get(startNodeId)!;
    const startNode = nodeById.get(startNodeId);
    if (!startNode) return null;

    const id = segmentId(segments.length + 1);
    const draft: InteractiveSegmentDraft = {
      id,
      name: getNodeDisplayTitle(startNode),
      enabled: true,
      source: 'auto',
      nodeIds: [],
      choices: [],
    };
    segmentByStartNode.set(startNodeId, draft);
    segments.push(draft);

    const localVisited = new Set<string>();
    let cursor: FlowNode | undefined = startNode;
    while (cursor && !localVisited.has(cursor.id)) {
      localVisited.add(cursor.id);
      draft.nodeIds.push(cursor.id);

      const exits = effectiveOutgoing.get(cursor.id) || [];
      if (exits.length !== 1) break;

      const next = storyNodeById.get(exits[0].targetNodeId);
      if (!next) break;
      if ((incomingCount.get(next.id) || 0) > 1) break;
      cursor = next;
    }

    const endNodeId = draft.nodeIds[draft.nodeIds.length - 1];
    const exits = effectiveOutgoing.get(endNodeId) || [];
    if (exits.length > 0) {
      draft.choices = exits
        .map((exit, index) => {
          const target = createSegment(exit.targetNodeId);
          if (!target) return null;
          return {
            id: `${draft.id}-choice-${index + 1}`,
            label: exit.label || `Choice ${index + 1}`,
            targetSegmentId: target.id,
            targetNodeId: exit.targetNodeId,
          };
        })
        .filter(Boolean) as InteractiveChoiceDraft[];
    }

    return draft;
  };

  createSegment(root.id);
  visibleStoryNodes
    .filter((node) => !segments.some((segment) => segment.nodeIds.includes(node.id)))
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
    .forEach((node) => createSegment(node.id));

  return segments;
};

export const makeInteractiveSegmentFileName = (segment: InteractiveSegmentDraft, index: number) =>
  `${segmentId(index + 1)}-${sanitizeExportName(segment.name)}`;
