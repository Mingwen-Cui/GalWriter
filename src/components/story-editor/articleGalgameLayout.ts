import type { Node } from '@xyflow/react';
import type { AssistantCardDraft } from '../../agent/planning/agentCardDraft';
import { resolveAssistantAppendLayoutOrigin } from './assistantCardPlacementLayout';
import { AI_STORY_CARD_WIDTH, SETTING_NODE_CARD_WIDTH } from './constants';

export type ArticleGalgameLayout = {
  cards: AssistantCardDraft[];
  nodeIds: string[];
  setupNodeIds?: string[];
};

/** Arrange the completed article batch by chapter and graph depth, then select it. */
export const arrangeArticleGalgameNodes = (nodes: Node[], batch: ArticleGalgameLayout): Node[] => {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const stories = batch.cards.flatMap((card, index) => {
    const node = byId.get(batch.nodeIds[index]);
    return card.type === 'story' && node ? [{ card, node }] : [];
  });
  if (!stories.length) return nodes;
  const selectedIds = new Set([...batch.nodeIds, ...(batch.setupNodeIds || [])]);
  const wrappers = nodes.filter((node) => {
    if (node.type !== 'groupNode' && node.type !== 'backgroundNode') return false;
    const children = node.data.assistantAutoFitChildIds;
    return Array.isArray(children) && children.length > 0 && children.every((id) => selectedIds.has(id));
  });
  wrappers.forEach((node) => selectedIds.add(node.id));
  const size = (node: Node) => ({
    width: Number(node.measured?.width) || Number(node.style?.width) ||
      (node.type === 'storyNode' ? AI_STORY_CARD_WIDTH : SETTING_NODE_CARD_WIDTH),
    height: Number(node.measured?.height) || Number(node.style?.height) ||
      (node.type === 'storyNode' ? 200 : 420),
  });
  const positions = new Map<string, { x: number; y: number }>();
  let setupBottom = 0;
  [0, 1].forEach((column) => {
    let y = 0;
    nodes.filter((node) => selectedIds.has(node.id) &&
      node.type === (column === 0 ? 'characterNode' : 'sceneNode')).forEach((node) => {
      positions.set(node.id, { x: column * (SETTING_NODE_CARD_WIDTH + 160), y });
      y += size(node).height + 100;
    });
    setupBottom = Math.max(setupBottom, y);
  });
  const storyX = SETTING_NODE_CARD_WIDTH * 2 + 320;
  const keys = new Map(stories.map(({ card }, index) => [card.key, index]));
  const depths = stories.map(() => 0);
  stories.forEach(({ card }, index) => {
    [...(card.connectTo || []), ...(card.branchTargets || []).map((branch) => branch.target)]
      .forEach((ref) => {
        const target = keys.get(ref);
        if (target !== undefined && target > index) depths[target] = Math.max(depths[target], depths[index] + 1);
      });
  });
  let y = 56;
  [...new Set(stories.map(({ card }) => card.chapterTitle))].forEach((chapter) => {
    const indexes = stories.flatMap(({ card }, index) => card.chapterTitle === chapter ? [index] : []);
    [...new Set(indexes.map((index) => depths[index]))].sort((a, b) => a - b).forEach((depth) => {
      const row = indexes.filter((index) => depths[index] === depth);
      row.forEach((index, column) => positions.set(stories[index].node.id, {
        x: storyX + column * (AI_STORY_CARD_WIDTH + 140), y,
      }));
      y += Math.max(...row.map((index) => size(stories[index].node).height)) + 140;
    });
    y += 112;
  });
  const width = Math.max(...[...positions].map(([id, pos]) => pos.x + size(byId.get(id)!).width)) + 56;
  const origin = resolveAssistantAppendLayoutOrigin({
    existingNodes: nodes,
    batchWidth: width,
    batchHeight: Math.max(y, setupBottom),
    viewportCenter: {
      x: Math.min(...nodes.filter((node) => positions.has(node.id)).map((node) => node.position.x)) + width / 2,
      y: Math.min(...nodes.filter((node) => positions.has(node.id)).map((node) => node.position.y)) + Math.max(y, setupBottom) / 2,
    },
    spawnCursor: null,
    excludeIds: selectedIds,
  });
  positions.forEach((pos, id) => positions.set(id, {
    x: pos.x + origin.layoutLeft, y: pos.y + origin.layoutTop,
  }));
  const result = nodes.map((node) => ({
    ...node,
    selected: selectedIds.has(node.id),
    position: positions.get(node.id) || node.position,
  }));
  return result.map((node) => {
    if (!wrappers.some((wrapper) => wrapper.id === node.id)) return node;
    const children = (node.data.assistantAutoFitChildIds as string[])
      .map((id) => result.find((child) => child.id === id)!).filter(Boolean);
    const padding = Number(node.data.assistantAutoFitPadding) || 56;
    const left = Math.min(...children.map((child) => child.position.x));
    const top = Math.min(...children.map((child) => child.position.y));
    const right = Math.max(...children.map((child) => child.position.x + size(child).width));
    const bottom = Math.max(...children.map((child) => child.position.y + size(child).height));
    return {
      ...node,
      position: { x: left - padding, y: top - padding },
      style: { ...node.style, width: right - left + padding * 2, height: bottom - top + padding * 2 },
      data: { ...node.data, assistantAutoFitPending: false },
    };
  });
};
