import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react';

import { stripHtml } from '../video/shared/storyNodes';
import type { RenderStyle, WebExportSettings } from '../video/shared/types';

export type PptChoice = { label: string; targetId?: string };
export type PptCharacter = {
  imageUrl?: string;
  name?: string;
  position: 'left' | 'center' | 'right';
  offsetX: number;
  offsetY: number;
  scale: number;
  flipX: boolean;
};
export type PptScene = {
  id: string;
  title: string;
  text: string;
  backgroundUrl?: string;
  characters: PptCharacter[];
  choices: PptChoice[];
};

type StoryData = {
  title?: string;
  text?: string;
  imageUrl?: string;
  presentation?: { characters?: PptCharacter[] };
};

/**
 * The one shared scene contract for the PPT preview and .pptx output.
 * It intentionally consumes the existing story graph and web visual settings.
 */
export function resolvePptScenes(
  nodes: FlowNode[],
  edges: FlowEdge[],
  settings: WebExportSettings,
): PptScene[] {
  const visibleStoryNodes = nodes.filter((node) => node.type === 'storyNode' && !node.data?.hidden);
  const nodeIds = new Set(visibleStoryNodes.map((node) => node.id));
  return visibleStoryNodes.map((node, index) => {
    const data = node.data as StoryData;
    const choices = edges
      .filter((edge) => edge.source === node.id && nodeIds.has(edge.target))
      .map((edge, choiceIndex) => ({
        label: typeof edge.label === 'string' ? edge.label.trim() || `选项 ${choiceIndex + 1}` : `选项 ${choiceIndex + 1}`,
        targetId: edge.target,
      }));
    return {
      id: node.id,
      title: data.title?.trim() || `场景 ${index + 1}`,
      text: stripHtml(data.text || ''),
      backgroundUrl: data.imageUrl || settings.sceneBackgroundImageUrl,
      characters: data.presentation?.characters || [],
      choices,
    };
  });
}

export const pptSceneColors = (style: RenderStyle, settings: WebExportSettings) => ({
  background: settings.sceneBackgroundColor || '#0f172a',
  panel: style.panelColor || '#111827',
  title: style.titleColor || '#ffffff',
  body: style.bodyColor || '#f8fafc',
  choice: '#6366f1',
});
