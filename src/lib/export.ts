import { Edge, Node } from '@xyflow/react';

export interface StoryNodeData extends Record<string, unknown> {
  text: string;
}

export function exportPaths(nodes: Node<StoryNodeData>[], edges: Edge[]) {
  // Find roots (in-degree 0, but must have at least one outgoing edge to be considered a connected root)
  // 如果没有任何连接（没有入边也没有出边），则忽略该孤立节点
  const roots = nodes.filter((n) => {
    const hasIn = edges.some((e) => e.target === n.id);
    const hasOut = edges.some((e) => e.source === n.id);
    // 允许有出边无入边的作为根节点；如果是孤立节点(没有入边也没有出边)则忽略
    return !hasIn && hasOut;
  });

  if (roots.length === 0) return 'No story found.';

  let out = '';
  let endingIndex = 1;

  function dfs(currId: string, path: string[], visited: Set<string>) {
    if (visited.has(currId)) {
      out += `# Ending ${endingIndex} (Loop Detected)\n\n`;
      out += path.join('\n\n---\n\n');
      out += '\n\n========================================\n\n';
      endingIndex++;
      return;
    }

    const node = nodes.find((n) => n.id === currId);
    if (!node) return;

    path.push(String(node.data.text || ''));

    const newVisited = new Set(visited);
    newVisited.add(currId);

    const outEdges = edges.filter((e) => e.source === currId);
    if (outEdges.length === 0) {
      // Leaf node, write to output
      out += `# Ending ${endingIndex}\n\n`;
      out += path.join('\n\n---\n\n');
      out += '\n\n========================================\n\n';
      endingIndex++;
    } else {
      // For each edge, follow the choice it represents
      for (const e of outEdges) {
        const tNode = nodes.find((n) => n.id === e.target);
        const pathName = tNode?.data.title || 'Next Segment';
        dfs(e.target, [...path, `> [Player Chose: ${pathName}]`], newVisited);
      }
    }
  }

  for (const root of roots) {
    dfs(root.id, [], new Set());
  }

  return out;
}

export interface CharacterOutfit {
  id: string;
  name: string;
  imageUrl?: string;
}

export interface SceneImage {
  id: string;
  name: string;
  imageUrl?: string;
  isPanorama?: boolean;
}

/** 将人物设定节点 data 格式化为可导出的 Markdown 纯文本 */
export function formatCharacterNodeText(data: Record<string, unknown>): string {
  const parts: string[] = [];

  const addSection = (label: string, value: unknown) => {
    const text = typeof value === 'string' ? value.trim() : '';
    if (text) parts.push(`**${label}**\n${text}`);
  };

  const useSplitTraits =
    !!data.showPersonality || !!data.showFeatures || !!data.showBackground || !!data.showOther;

  if (useSplitTraits) {
    if (data.showPersonality) addSection('性格', data.personality);
    if (data.showFeatures) addSection('人物特点', data.features);
    if (data.showBackground) addSection('人物背景', data.background);
    if (data.showOther) addSection('其他', data.other);
  } else {
    addSection('综合设定', data.traits);
  }

  const outfits = (data.outfits as CharacterOutfit[] | undefined) || [];
  if (outfits.length > 0) {
    const outfitLines = outfits.map((o) => `- ${(o.name || '未命名穿着').trim()}`).join('\n');
    parts.push(`**三视图 / 穿着**\n${outfitLines}`);
  }

  if (parts.length === 0) return '（暂无设定内容）';
  return parts.join('\n\n');
}

/** 将场景设定节点 data 格式化为可导出的 Markdown 纯文本 */
export function formatSceneNodeText(data: Record<string, unknown>): string {
  const parts: string[] = [];

  const addSection = (label: string, value: unknown) => {
    const text = typeof value === 'string' ? value.trim() : '';
    if (text) parts.push(`**${label}**\n${text}`);
  };

  const useSplitDetails =
    !!data.showLocation || !!data.showItems || !!data.showAtmosphere || !!data.showOther;

  if (useSplitDetails) {
    if (data.showLocation) addSection('位置描写', data.location);
    if (data.showItems) addSection('场景物品', data.items);
    if (data.showAtmosphere) addSection('氛围环境', data.atmosphere);
    if (data.showOther) addSection('其他', data.other);
  } else {
    addSection('综合描述', data.description);
  }

  const images = (data.images as SceneImage[] | undefined) || [];
  if (images.length > 0) {
    const imageLines = images
      .map((img) => {
        const label = (img.name || '未命名图片').trim();
        return img.isPanorama ? `- ${label}（360°全景图）` : `- ${label}`;
      })
      .join('\n');
    parts.push(`**场景图片**\n${imageLines}`);
  }

  if (parts.length === 0) return '（暂无设定内容）';
  return parts.join('\n\n');
}

export function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
