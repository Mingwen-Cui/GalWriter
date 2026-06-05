import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react';

import { htmlToSpeechText } from '../../../../lib/tts';
import type { TextAnimation } from './types';

export const normalizeAssetPath = (path?: string) => {
  if (!path || !path.startsWith('assets/')) return undefined;
  return path.replace(/\\/g, '/');
};

export const stripHtml = (html: string) => htmlToSpeechText(html || '');

export const drawCoverImage = (
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number,
) => {
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
};

export const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  const lines: string[] = [];
  const paragraphs = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  paragraphs.forEach((paragraph) => {
    let current = '';
    Array.from(paragraph).forEach((char) => {
      const next = current + char;
      if (ctx.measureText(next).width > maxWidth && current) {
        lines.push(current);
        current = char;
      } else {
        current = next;
      }
    });
    if (current) lines.push(current);
  });

  return lines;
};

export const getOrderedStoryNodes = (nodes: FlowNode[], edges: FlowEdge[]) => {
  const storyNodes = nodes.filter((node) => node.type === 'storyNode' && !node.data?.hidden);
  const root = storyNodes.find((node) => node.data?.isRoot) || storyNodes[0];
  if (!root) return [];

  const visited = new Set<string>();
  const ordered: FlowNode[] = [];

  const visit = (nodeId: string) => {
    if (visited.has(nodeId)) return;
    const node = storyNodes.find((item) => item.id === nodeId);
    if (!node) return;
    visited.add(nodeId);
    ordered.push(node);
    edges
      .filter((edge) => edge.source === nodeId)
      .sort((a, b) => String(a.data?.label || '').localeCompare(String(b.data?.label || '')))
      .forEach((edge) => visit(edge.target));
  };

  visit(root.id);
  storyNodes
    .filter((node) => !visited.has(node.id))
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
    .forEach((node) => ordered.push(node));

  return ordered;
};

export const getNodeDisplayTitle = (node?: FlowNode | null) =>
  String(
    node?.data?.title ||
      node?.data?.characterName ||
      node?.data?.sceneName ||
      node?.data?.label ||
      'Untitled',
  );

export const getNodeDisplayText = (node?: FlowNode | null) =>
  String(node?.data?.text || node?.data?.description || node?.data?.content || '');

export const webAnimationStyle = (animation: TextAnimation): React.CSSProperties => {
  if (animation === 'fade' || animation === 'typewriter') {
    return { animation: 'webPreviewFade 360ms ease both' };
  }
  if (animation === 'slideUp') {
    return { animation: 'webPreviewSlideUp 360ms ease both' };
  }
  return {};
};
