import { Edge, Node } from '@xyflow/react';

import { formatCharacterNodeText, formatSceneNodeText } from './export';

export type RegionStoryItem = {
  id: string;
  type: string;
  title: string;
  text: string;
};

function compareByPosition(nodes: Node[], a: string, b: string) {
  const nodeA = nodes.find((n) => n.id === a);
  const nodeB = nodes.find((n) => n.id === b);
  if (!nodeA || !nodeB) return 0;
  if (Math.abs(nodeA.position.y - nodeB.position.y) > 30) {
    return nodeA.position.y - nodeB.position.y;
  }
  return nodeA.position.x - nodeB.position.x;
}

function stripHtml(html: string) {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  return (tempDiv.textContent || '').trim();
}

export function sortContentNodesInRegion(
  nodeIds: string[],
  nodes: Node[],
  edges: Edge[],
): string[] {
  const idSet = new Set(nodeIds);
  const inDegree = new Map<string, number>();
  const graph = new Map<string, string[]>();

  for (const id of nodeIds) {
    inDegree.set(id, 0);
    graph.set(id, []);
  }

  for (const edge of edges) {
    if (idSet.has(edge.source) && idSet.has(edge.target)) {
      graph.get(edge.source)!.push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }
  }

  const sorted: string[] = [];
  const queue = nodeIds.filter((id) => (inDegree.get(id) || 0) === 0);
  queue.sort((a, b) => compareByPosition(nodes, a, b));

  while (queue.length > 0) {
    queue.sort((a, b) => compareByPosition(nodes, a, b));
    const current = queue.shift()!;
    sorted.push(current);
    for (const next of graph.get(current) || []) {
      inDegree.set(next, (inDegree.get(next) || 0) - 1);
      if (inDegree.get(next) === 0) {
        queue.push(next);
      }
    }
  }

  const remaining = nodeIds.filter((id) => !sorted.includes(id));
  remaining.sort((a, b) => compareByPosition(nodes, a, b));
  sorted.push(...remaining);

  return sorted;
}

export function buildRegionStoryItems(
  nodes: Node[],
  edges: Edge[],
  orderedIds: string[],
): RegionStoryItem[] {
  return orderedIds
    .map((nodeId) => nodes.find((n) => n.id === nodeId))
    .filter((node): node is Node => !!node)
    .map((node) => {
      if (node.type === 'characterNode') {
        const charName = (node.data?.characterName as string) || '未命名角色';
        return {
          id: node.id,
          type: node.type || 'characterNode',
          title: charName,
          text: formatCharacterNodeText(node.data as Record<string, unknown>),
        };
      }

      if (node.type === 'sceneNode') {
        const sceneName = (node.data?.sceneName as string) || '未命名场景';
        return {
          id: node.id,
          type: node.type || 'sceneNode',
          title: sceneName,
          text: formatSceneNodeText(node.data as Record<string, unknown>),
        };
      }

      const title = String(node.data?.title || '卡片');
      const rawText = typeof node.data?.text === 'string' ? node.data.text : '';
      return {
        id: node.id,
        type: node.type || 'storyNode',
        title,
        text: stripHtml(rawText),
      };
    });
}

export function formatRegionStoryForPrompt(items: RegionStoryItem[]): string {
  return items
    .map((item, index) => {
      const header = `### ${index + 1}. ${item.title}`;
      return `${header}\n${item.text || '（空）'}`;
    })
    .join('\n\n');
}

export type GeneratedPlotCard = {
  title: string;
  text: string;
};

export function parseGeneratedPlotCards(raw: string): GeneratedPlotCard[] {
  const cards: GeneratedPlotCard[] = [];
  const sections = raw.split(/^###\s+/m).filter(Boolean);

  for (const section of sections) {
    const lines = section.trim().split('\n');
    if (lines.length === 0) continue;
    const titleLine = lines[0].replace(/^[\d.]+\s*/, '').trim();
    const body = lines.slice(1).join('\n').trim();
    if (titleLine || body) {
      cards.push({
        title: titleLine || `续写 ${cards.length + 1}`,
        text: body,
      });
    }
  }

  if (cards.length === 0 && raw.trim()) {
    cards.push({ title: '续写 1', text: raw.trim() });
  }

  return cards;
}

export function expandBackgroundToFitNodes(
  nodes: Node[],
  backgroundId: string,
  containedNodeIds: string[],
  padding = 60,
): Node[] {
  const background = nodes.find((n) => n.id === backgroundId);
  if (!background) return nodes;

  let newX = background.position.x;
  let newY = background.position.y;
  let newW = (background.style?.width as number) || background.measured?.width || 600;
  let newH = (background.style?.height as number) || background.measured?.height || 400;

  for (const nodeId of containedNodeIds) {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) continue;
    const w = node.measured?.width || (node.style?.width as number) || 300;
    const h = node.measured?.height || (node.style?.height as number) || 200;

    const nodeLeft = node.position.x - padding;
    const nodeTop = node.position.y - padding;
    const nodeRight = node.position.x + w + padding;
    const nodeBottom = node.position.y + h + padding;

    if (nodeLeft < newX) {
      newW += newX - nodeLeft;
      newX = nodeLeft;
    }
    if (nodeTop < newY) {
      newH += newY - nodeTop;
      newY = nodeTop;
    }
    if (nodeRight > newX + newW) {
      newW = nodeRight - newX;
    }
    if (nodeBottom > newY + newH) {
      newH = nodeBottom - newY;
    }
  }

  return nodes.map((node) => {
    if (node.id !== backgroundId) return node;
    return {
      ...node,
      position: { x: newX, y: newY },
      style: { ...node.style, width: newW, height: newH },
    };
  });
}
