import type { Node as FlowNode } from '@xyflow/react';
import type { Language } from '../../../lib/i18n';
import type { InteractiveSegmentDraft } from '../video/interactive/interactiveSegments';

/** Illustrative choices live only in the editor's graph data, never in the script. */
export function buildWebFlowChoicePreview(
  actual: InteractiveSegmentDraft[],
  nodes: FlowNode[],
  language: Language,
  fallbackImageUrl?: string,
) {
  const titles = language === 'zh' ? ['沿着山路前行', '去村庄打听', '留下等候']
    : language === 'ja' ? ['山道を進む', '村で尋ねる', 'ここで待つ']
      : ['Follow the mountain path', 'Ask in the village', 'Stay and wait'];
  const images = nodes.map((node) => node.data?.imageUrl).filter((url): url is string => typeof url === 'string' && Boolean(url));
  const previewNodes: FlowNode[] = titles.map((title, index) => ({
    id: `web-flow-demo-node-${index + 1}`, type: 'storyNode', position: { x: 0, y: 0 },
    data: { title, imageUrl: images[index % Math.max(1, images.length)] || fallbackImageUrl || '' },
  }));
  const branches: InteractiveSegmentDraft[] = previewNodes.map((node, index) => ({
    id: `web-flow-demo-branch-${index + 1}`, name: titles[index], enabled: true, source: 'auto', nodeIds: [node.id], choices: [],
  }));
  let root = actual[0];
  if (!root) {
    const node: FlowNode = { id: 'web-flow-demo-root', type: 'storyNode', position: { x: 0, y: 0 },
      data: { title: language === 'zh' ? '故事开始' : language === 'ja' ? '物語の始まり' : 'Story begins', imageUrl: images[0] || fallbackImageUrl || '' } };
    previewNodes.unshift(node);
    root = { id: 'web-flow-demo-start', name: String(node.data.title), enabled: true, source: 'auto', nodeIds: [node.id], choices: [] };
  }
  return {
    nodes: [...nodes, ...previewNodes],
    segments: [{ ...root, choices: branches.map((branch, index) => ({
      id: `web-flow-demo-choice-${index + 1}`, label: titles[index], targetSegmentId: branch.id, targetNodeId: branch.nodeIds[0],
    })) }, ...branches],
  };
}
