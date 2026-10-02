import type { Edge, Node } from '@xyflow/react';

import {
  AI_STORY_CARD_WIDTH,
  SETTING_NODE_CARD_WIDTH,
} from './constants';
import {
  estimateStoryCardLayoutHeight,
  getAssistantPlacementNodeSize,
  resolveAssistantAppendLayoutOrigin,
} from './assistantCardPlacementLayout';

type LayoutDirection = 'up' | 'down' | 'left' | 'right';
type StoryLayoutResult = { nodes: Node[]; backgrounds: Node[] };

const normalizeDirection = (value: unknown): LayoutDirection =>
  value === 'up' || value === 'left' || value === 'right' ? value : 'down';

const getStoryCardHeight = (node: Node) => {
  const text = typeof node.data?.text === 'string' ? node.data.text : '';
  return Math.max(
    getAssistantPlacementNodeSize(node).height,
    estimateStoryCardLayoutHeight(text, true, AI_STORY_CARD_WIDTH),
  );
};

const getStoryRanks = (storyNodes: Node[], edges: Edge[]) => {
  const ids = new Set(storyNodes.map((node) => node.id));
  const rankById = new Map(storyNodes.map((node) => [node.id, 0]));
  const externalIncoming = new Set(
    edges.filter((edge) => !ids.has(edge.source) && ids.has(edge.target)).map((edge) => edge.target),
  );
  const outgoing = new Map(storyNodes.map((node) => [node.id, [] as string[]]));
  const indegree = new Map(storyNodes.map((node) => [node.id, 0]));

  edges.forEach((edge) => {
    if (!ids.has(edge.source) || !ids.has(edge.target)) return;
    outgoing.get(edge.source)?.push(edge.target);
    indegree.set(edge.target, (indegree.get(edge.target) || 0) + 1);
  });

  if (!edges.some((edge) => ids.has(edge.source) && ids.has(edge.target))) {
    if (externalIncoming.size > 0) {
      let nextRank = 1;
      storyNodes.forEach((node) => {
        if (!externalIncoming.has(node.id)) rankById.set(node.id, nextRank++);
      });
    } else {
      storyNodes.forEach((node, index) => rankById.set(node.id, index));
    }
    return rankById;
  }

  const queue = storyNodes
    .filter((node) => indegree.get(node.id) === 0)
    .map((node) => node.id);
  const visited = new Set<string>();
  while (queue.length) {
    const sourceId = queue.shift()!;
    visited.add(sourceId);
    (outgoing.get(sourceId) || []).forEach((targetId) => {
      rankById.set(targetId, Math.max(rankById.get(targetId) || 0, (rankById.get(sourceId) || 0) + 1));
      const nextDegree = (indegree.get(targetId) || 0) - 1;
      indegree.set(targetId, nextDegree);
      if (nextDegree === 0) queue.push(targetId);
    });
  }

  // Cycles cannot be layered by graph depth; keep unresolved cards in a stable
  // creation-order tail so the layout remains predictable.
  let fallbackRank = Math.max(0, ...rankById.values()) + 1;
  storyNodes.forEach((node) => {
    if (!visited.has(node.id)) rankById.set(node.id, fallbackRank++);
  });
  return rankById;
};

/** Lay out only cards created in this MCP transaction, leaving the existing canvas intact. */
export const layoutMcpGeneratedCards = (
  allNodes: Node[],
  edges: Edge[],
  createdIds: string[],
  directionValue: unknown,
  language: string,
  preservePositionIds: string[] = [],
): StoryLayoutResult => {
  const generated = createdIds
    .map((id) => allNodes.find((node) => node.id === id))
    .filter((node): node is Node => Boolean(node) && ['storyNode', 'characterNode', 'sceneNode'].includes(node.type || ''));
  if (generated.length < 2) return { nodes: allNodes, backgrounds: [] };

  const preserveIds = new Set(preservePositionIds);
  const layoutTargets = generated.filter((node) => !preserveIds.has(node.id));
  const layoutTargetIds = new Set(layoutTargets.map((node) => node.id));
  const direction = normalizeDirection(directionValue);
  const storyNodes = layoutTargets.filter((node) => node.type === 'storyNode');
  const characterNodes = layoutTargets.filter((node) => node.type === 'characterNode');
  const sceneNodes = layoutTargets.filter((node) => node.type === 'sceneNode');
  const anchor = (layoutTargets[0] || generated[0]).position;
  const horizontalFlow = direction === 'left' || direction === 'right';
  const settingGap = 180;
  const rowGap = 120;
  const layerGap = 160;
  const branchGap = 120;
  const padding = 48;
  const updates = new Map<string, { x: number; y: number }>();

  const placeSettingColumn = (items: Node[], x: number, top: number) => {
    let y = top;
    items.forEach((node) => {
      updates.set(node.id, { x, y });
      y += getAssistantPlacementNodeSize(node).height + rowGap;
    });
    return Math.max(0, y - top - rowGap);
  };

  let contentWidth = 0;
  let contentHeight = 0;

  if (!horizontalFlow) {
    let settingX = 0;
    const characterWidth = characterNodes.length ? SETTING_NODE_CARD_WIDTH : 0;
    const sceneWidth = sceneNodes.length ? SETTING_NODE_CARD_WIDTH : 0;
    const characterHeight = placeSettingColumn(characterNodes, settingX, 0);
    if (characterNodes.length) settingX += characterWidth + settingGap;
    const sceneHeight = placeSettingColumn(sceneNodes, settingX, 0);
    if (sceneNodes.length) settingX += sceneWidth + settingGap;

    const ranks = getStoryRanks(storyNodes, edges);
    const layers = new Map<number, Node[]>();
    storyNodes.forEach((node) => {
      const rank = ranks.get(node.id) || 0;
      layers.set(rank, [...(layers.get(rank) || []), node]);
    });
    const orderedRanks = Array.from(layers.keys()).sort((a, b) => a - b);
    let layerY = 0;
    const layerPositions = new Map<number, number>();
    orderedRanks.forEach((rank) => {
      layerPositions.set(rank, layerY);
      const layerHeight = Math.max(...(layers.get(rank) || []).map(getStoryCardHeight));
      layerY += layerHeight + layerGap;
    });
    const storyDepth = Math.max(0, layerY - layerGap);
    const storyBranchWidth = Math.max(1, ...Array.from(layers.values()).map((items) => items.length)) * AI_STORY_CARD_WIDTH + Math.max(0, ...Array.from(layers.values()).map((items) => items.length - 1)) * branchGap;
    storyNodes.forEach((node) => {
      const rank = ranks.get(node.id) || 0;
      const siblings = layers.get(rank) || [node];
      const branchIndex = siblings.findIndex((item) => item.id === node.id);
      const crossOffset = (storyBranchWidth - (siblings.length * AI_STORY_CARD_WIDTH + Math.max(0, siblings.length - 1) * branchGap)) / 2;
      const x = settingX + crossOffset + branchIndex * (AI_STORY_CARD_WIDTH + branchGap);
      const y = layerPositions.get(rank) || 0;
      updates.set(node.id, {
        x,
        y: direction === 'up' ? storyDepth - y - getStoryCardHeight(node) : y,
      });
    });
    contentWidth = settingX + (storyNodes.length ? storyBranchWidth : 0);
    contentHeight = Math.max(characterHeight, sceneHeight, storyDepth);
  } else {
    const characterHeight = placeSettingColumn(characterNodes, 0, 0);
    const sceneHeight = placeSettingColumn(
      sceneNodes,
      characterNodes.length ? SETTING_NODE_CARD_WIDTH + settingGap : 0,
      0,
    );
    const settingsHeight = Math.max(characterHeight, sceneHeight);
    const ranks = getStoryRanks(storyNodes, edges);
    const layers = new Map<number, Node[]>();
    storyNodes.forEach((node) => {
      const rank = ranks.get(node.id) || 0;
      layers.set(rank, [...(layers.get(rank) || []), node]);
    });
    const orderedRanks = Array.from(layers.keys()).sort((a, b) => a - b);
    let layerX = 0;
    const layerPositions = new Map<number, number>();
    orderedRanks.forEach((rank) => {
      layerPositions.set(rank, layerX);
      layerX += AI_STORY_CARD_WIDTH + layerGap;
    });
    const storyWidth = Math.max(0, layerX - layerGap);
    const maxBranchHeight = Math.max(
      1,
      ...Array.from(layers.values()).map((items) =>
        items.reduce((height, node, index) => height + getStoryCardHeight(node) + (index ? branchGap : 0), 0),
      ),
    );
    storyNodes.forEach((node) => {
      const rank = ranks.get(node.id) || 0;
      const siblings = layers.get(rank) || [node];
      const x = layerPositions.get(rank) || 0;
      const siblingHeight = siblings.reduce(
        (height, sibling, index) => height + getStoryCardHeight(sibling) + (index ? branchGap : 0),
        0,
      );
      const layerHeight = Math.max(...siblings.map(getStoryCardHeight));
      let y = settingsHeight + (settingsHeight ? settingGap : 0) + Math.max(0, (layerHeight - siblingHeight) / 2);
      for (const sibling of siblings) {
        if (sibling.id === node.id) break;
        y += getStoryCardHeight(sibling) + branchGap;
      }
      updates.set(node.id, {
        x: direction === 'left' ? storyWidth - x - AI_STORY_CARD_WIDTH : x,
        y,
      });
    });
    contentWidth = Math.max(
      characterNodes.length ? SETTING_NODE_CARD_WIDTH : 0,
      sceneNodes.length ? SETTING_NODE_CARD_WIDTH + (characterNodes.length ? settingGap : 0) : 0,
      storyWidth,
    );
    contentHeight = settingsHeight + (settingsHeight ? settingGap : 0) + maxBranchHeight;
  }

  const occupied = allNodes.filter((node) => !layoutTargetIds.has(node.id));
  const origin = resolveAssistantAppendLayoutOrigin({
    existingNodes: occupied,
    batchWidth: Math.max(contentWidth, 1),
    batchHeight: Math.max(contentHeight, 1),
    viewportCenter: anchor,
    spawnCursor: { x: anchor.x - 200, y: anchor.y },
    gap: 200,
  });
  const deltaX = origin.layoutLeft;
  const deltaY = origin.layoutTop;
  const laidOutNodes = allNodes.map((node) => {
    const local = updates.get(node.id);
    return local ? { ...node, position: { x: deltaX + local.x, y: deltaY + local.y } } : node;
  });

  const palette = [
    { type: 'storyNode', title: language === 'zh' ? '故事卡片' : 'Story Cards', color: '#e0e7ff' },
    { type: 'characterNode', title: language === 'zh' ? '人物设定' : 'Characters', color: '#fce7f3' },
    { type: 'sceneNode', title: language === 'zh' ? '场景设定' : 'Scenes', color: '#cffafe' },
  ];
  const backgrounds = palette.flatMap((group) => {
    const children = generated.filter((node) => node.type === group.type);
    if (!children.length) return [];
    const bounds = children.reduce(
      (result, node) => {
        const localPosition = updates.get(node.id);
        const position = localPosition
          ? { x: localPosition.x + deltaX, y: localPosition.y + deltaY }
          : node.position;
        const size = group.type === 'storyNode'
          ? { width: AI_STORY_CARD_WIDTH, height: getStoryCardHeight(node) }
          : getAssistantPlacementNodeSize(node);
        return {
          left: Math.min(result.left, position.x),
          top: Math.min(result.top, position.y),
          right: Math.max(result.right, position.x + size.width),
          bottom: Math.max(result.bottom, position.y + size.height),
        };
      },
      { left: Number.POSITIVE_INFINITY, top: Number.POSITIVE_INFINITY, right: 0, bottom: 0 },
    );
    const baseId = `mcp-background-${children[0].id}`;
    let id = baseId;
    let suffix = 1;
    while (allNodes.some((node) => node.id === id)) id = `${baseId}-${suffix++}`;
    return [{
      id,
      type: 'backgroundNode',
      position: { x: bounds.left - padding, y: bounds.top - padding },
      dragHandle: '.custom-drag-handle',
      style: {
        width: Math.max(280, bounds.right - bounds.left + padding * 2),
        height: Math.max(220, bounds.bottom - bounds.top + padding * 2),
        zIndex: -3,
      },
      data: { id, title: group.title, color: group.color },
    } satisfies Node];
  });

  return { nodes: laidOutNodes, backgrounds };
};
