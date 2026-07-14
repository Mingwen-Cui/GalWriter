import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react';

import { resolveCharacterImageUrl, resolveSceneMedia } from '../../../lib/inlineAssetSwitch';
import { normalizeStoryPresentation } from '../../../lib/presentation';
import type {
  CharacterNodeData,
  CharacterPresentation,
  SceneNodeData,
  StoryPresentation,
} from '../../../domain/project';
import { filterMentionTags, stripHtml } from '../video/shared/storyNodes';
import type { RenderStyle, WebExportSettings } from '../video/shared/types';

export type PptChoice = { label: string; targetId?: string };
export type PptCharacter = Pick<
  CharacterPresentation,
  'sourceNodeId' | 'position' | 'offsetX' | 'offsetY' | 'scale' | 'flipX' | 'layer'
> & {
  imageUrl?: string;
  name?: string;
};
export type PptScene = {
  id: string;
  title: string;
  text: string;
  backgroundUrl?: string;
  backgroundVideoUrl?: string;
  characters: PptCharacter[];
  choices: PptChoice[];
};

type StoryData = {
  title?: string;
  text?: string;
  imageUrl?: string;
  videoUrl?: string;
  presentation?: StoryPresentation;
};

/**
 * Mirrors the story-test navigation's graph walk instead of trusting the
 * React Flow node array (which only reflects creation/canvas order).
 *
 * Branches are kept in their edge order, matching the choice order presented
 * by PlayTestModal.  Unreachable cards stay at the end so exporting never
 * silently loses authored content.
 */
const getPlaytestOrderedStoryNodes = (nodes: FlowNode[], edges: FlowEdge[]) => {
  const storyNodes = nodes.filter((node) => node.type === 'storyNode' && !node.data?.hidden);
  const root = storyNodes.find((node) => node.data?.isRoot) || storyNodes[0];
  if (!root) return [];

  const byId = new Map(storyNodes.map((node) => [node.id, node]));
  const visited = new Set<string>();
  const ordered: FlowNode[] = [];
  const visit = (nodeId: string) => {
    if (visited.has(nodeId)) return;
    const node = byId.get(nodeId);
    if (!node) return;
    visited.add(nodeId);
    ordered.push(node);
    edges.filter((edge) => edge.source === nodeId).forEach((edge) => visit(edge.target));
  };

  visit(root.id);
  storyNodes
    .filter((node) => !visited.has(node.id))
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
    .forEach((node) => ordered.push(node));
  return ordered;
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
  const visibleStoryNodes = getPlaytestOrderedStoryNodes(nodes, edges);
  const nodeIds = new Set(visibleStoryNodes.map((node) => node.id));
  return visibleStoryNodes.map((node, index) => {
    const data = node.data as StoryData;
    const choices = edges
      .filter((edge) => edge.source === node.id && nodeIds.has(edge.target))
      .map((edge, choiceIndex) => ({
        label:
          typeof edge.label === 'string'
            ? edge.label.trim() || `选项 ${choiceIndex + 1}`
            : `选项 ${choiceIndex + 1}`,
        targetId: edge.target,
      }));
    const presentation = normalizeStoryPresentation(data.presentation);
    const sceneSource = presentation.scene
      ? nodes.find(
          (candidate) =>
            candidate.id === presentation.scene?.sourceNodeId && candidate.type === 'sceneNode',
        )
      : undefined;
    const sceneMedia = resolveSceneMedia({
      data: sceneSource?.data as SceneNodeData | undefined,
      scene: presentation.scene,
      fallbackImageUrl: data.imageUrl || settings.sceneBackgroundImageUrl,
      fallbackVideoUrl: data.videoUrl,
    });
    const characters = presentation.characters
      .map((config) => {
        const source = nodes.find(
          (candidate) => candidate.id === config.sourceNodeId && candidate.type === 'characterNode',
        );
        if (!source) return null;
        const characterData = source.data as CharacterNodeData;
        const imageUrl = resolveCharacterImageUrl(characterData, config);
        if (!imageUrl) return null;
        return { ...config, imageUrl, name: characterData.characterName };
      })
      .filter(Boolean) as PptCharacter[];
    characters.sort((a, b) => (a.layer || 1) - (b.layer || 1));
    return {
      id: node.id,
      // Do not invent a title for the presentation canvas. Web and video keep
      // this field empty, so a fallback here created an extra line only in PPT.
      title: data.title?.trim() || '',
      text: stripHtml(filterMentionTags(data.text || '', true, true)),
      backgroundUrl: sceneMedia.imageUrl || settings.sceneBackgroundImageUrl,
      backgroundVideoUrl: sceneMedia.videoUrl,
      characters,
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
