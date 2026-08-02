import type { Edge, Node } from '@xyflow/react';
import { useCallback } from 'react';

import type { AssistantInputContext } from '../../editor-features/assistant/useAssistantPanel';
import { buildRegionStoryItems, formatRegionStoryForPrompt } from '../../lib/plotStructure';
import { formatStoryEditorText, type StoryEditorCopy } from './i18n';

type UseRegionAssistantContextOptions = {
  assistantInputContexts: AssistantInputContext[];
  backgroundLabel: string;
  dynamicGroupLabel: string;
  edges: Edge[];
  nodes: Node[];
  setAssistantInputContexts: React.Dispatch<React.SetStateAction<AssistantInputContext[]>>;
  setAssistantOpen: React.Dispatch<React.SetStateAction<boolean>>;
  showToast: (message: string, tone?: 'success' | 'error') => void;
  storyEditorCopy: StoryEditorCopy;
};

const isRegionContentNode = (node: Node) =>
  ['storyNode', 'characterNode', 'sceneNode', 'textNode'].includes(node.type || '');

const readSize = (value: unknown, fallback: number) => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const readCardTitle = (node: Node) =>
  String(node.data?.title || node.data?.characterName || node.data?.sceneName || '').trim();

const readCardFirstLine = (node: Node) => {
  const text = String(
    node.data?.text || node.data?.description || node.data?.traits || node.data?.background || '',
  )
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ');
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .find(Boolean);
};

export function useRegionAssistantContext({
  assistantInputContexts,
  backgroundLabel,
  dynamicGroupLabel,
  edges,
  nodes,
  setAssistantInputContexts,
  setAssistantOpen,
  showToast,
  storyEditorCopy,
}: UseRegionAssistantContextOptions) {
  return useCallback(
    (regionIdOrSelectedNodeIds: string | string[]) => {
      const selectedNodeIds = Array.isArray(regionIdOrSelectedNodeIds)
        ? regionIdOrSelectedNodeIds
        : null;
      const region = selectedNodeIds
        ? null
        : nodes.find(
            (node) =>
              node.id === regionIdOrSelectedNodeIds &&
              (node.type === 'backgroundNode' || node.type === 'groupNode'),
          );
      if (!selectedNodeIds && !region) return;

      const regionNodeIds = selectedNodeIds
        ? selectedNodeIds.filter((id) => {
            const node = nodes.find((item) => item.id === id);
            return !!node && isRegionContentNode(node);
          })
        : region?.type === 'groupNode'
          ? (Array.isArray(region!.data?.childIds) ? region!.data.childIds : []).filter((id) => {
              const child = nodes.find((node) => node.id === id);
              return !!child && isRegionContentNode(child);
            })
          : nodes
              .filter(isRegionContentNode)
              .filter((node) => {
                const regionWidth = readSize(region!.measured?.width ?? region!.style?.width, 600);
                const regionHeight = readSize(
                  region!.measured?.height ?? region!.style?.height,
                  400,
                );
                const nodeWidth = readSize(node.measured?.width ?? node.style?.width, 300);
                const nodeHeight = readSize(node.measured?.height ?? node.style?.height, 200);
                const centerX = node.position.x + nodeWidth / 2;
                const centerY = node.position.y + nodeHeight / 2;
                return (
                  centerX >= region!.position.x &&
                  centerX <= region!.position.x + regionWidth &&
                  centerY >= region!.position.y &&
                  centerY <= region!.position.y + regionHeight
                );
              })
              .map((node) => node.id);

      const orderedIds = [...regionNodeIds].sort((leftId, rightId) => {
        const left = nodes.find((node) => node.id === leftId)!;
        const right = nodes.find((node) => node.id === rightId)!;
        return Math.abs(left.position.y - right.position.y) > 30
          ? left.position.y - right.position.y
          : left.position.x - right.position.x;
      });
      const content = formatRegionStoryForPrompt(buildRegionStoryItems(nodes, edges, orderedIds));

      if (!content) {
        showToast(selectedNodeIds ? storyEditorCopy.selectionEmpty : storyEditorCopy.regionEmpty, 'error');
        return;
      }

      const regionTitle = selectedNodeIds
        ? formatStoryEditorText(storyEditorCopy.selectionTitle, { count: orderedIds.length })
        : String(
            region!.data?.title ||
              (region!.type === 'groupNode' ? dynamicGroupLabel : backgroundLabel),
          );
      const selectedPreviewNode = selectedNodeIds
        ? nodes.find((node) => node.id === orderedIds[0])
        : undefined;
      const selectedPreviewLabel = selectedPreviewNode ? readCardTitle(selectedPreviewNode) : '';
      const selectedPreviewText = selectedPreviewNode ? readCardFirstLine(selectedPreviewNode) : '';
      const hasMultipleSelectedCards = Boolean(selectedNodeIds && orderedIds.length > 1);
      const contextId = selectedNodeIds
        ? `selection:${orderedIds.join('|')}`
        : region!.id;
      const message = selectedNodeIds
        ? formatStoryEditorText(storyEditorCopy.selectionContext, { content })
        : formatStoryEditorText(storyEditorCopy.regionContext, {
            regionTitle,
            content,
          });
      const replacingExistingContext = assistantInputContexts.some(
        (context) => context.id === contextId,
      );
      if (!replacingExistingContext && assistantInputContexts.length >= 10) {
        showToast(selectedNodeIds ? storyEditorCopy.selectionLimit : storyEditorCopy.regionLimit, 'error');
        return;
      }

      setAssistantOpen(true);
      const assetUrls = { images: new Set<string>(), videos: new Set<string>() };
      const addAsset = (type: keyof typeof assetUrls, url: unknown) => {
        if (typeof url === 'string' && url.trim()) assetUrls[type].add(url);
      };
      orderedIds.forEach((nodeId) => {
        const node = nodes.find((item) => item.id === nodeId);
        if (!node) return;
        const nodeData = node.data as Record<string, unknown>;
        addAsset('images', nodeData.imageUrl);
        addAsset('videos', nodeData.videoUrl);
        if (Array.isArray(nodeData.outfits)) {
          nodeData.outfits.forEach((outfit) =>
            addAsset('images', (outfit as { imageUrl?: unknown })?.imageUrl),
          );
        }
        if (Array.isArray(nodeData.images)) {
          nodeData.images.forEach((image) => {
            addAsset('images', (image as { imageUrl?: unknown })?.imageUrl);
            addAsset('videos', (image as { videoUrl?: unknown })?.videoUrl);
          });
        }
      });

      const nextContext: AssistantInputContext = {
        id: contextId,
        title: hasMultipleSelectedCards ? regionTitle : selectedPreviewText || regionTitle,
        content: message,
        cardCount: orderedIds.length,
        source: selectedNodeIds ? 'selection' : 'region',
        nodeIds: orderedIds,
        previewLabel: hasMultipleSelectedCards ? undefined : selectedPreviewLabel || undefined,
        assetCounts: { images: assetUrls.images.size, videos: assetUrls.videos.size },
      };
      setAssistantInputContexts((contexts) => [
        ...contexts.filter((context) => context.id !== contextId),
        nextContext,
      ]);
    },
    [
      assistantInputContexts,
      backgroundLabel,
      dynamicGroupLabel,
      edges,
      nodes,
      setAssistantInputContexts,
      setAssistantOpen,
      showToast,
      storyEditorCopy,
    ],
  );
}
