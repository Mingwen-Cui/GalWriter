import type { Edge, Node } from '@xyflow/react';
import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

import type { PlotStructureGenerateDirection, StoryNodeData } from '../../domain/project';
import type { Language } from '../../lib/i18n';
import {
  expandBackgroundToFitNodes,
  formatRegionStoryForPrompt,
  parseGeneratedPlotCards,
} from '../../lib/plotStructure';
import type { PlotStructureGenerateParams } from '../PlotStructureNode';
import {
  estimateStoryCardLayoutHeight,
  getNodePlacementBounds,
  rectsOverlap,
} from './assistantCardPlacementLayout';
import {
  applyAssistantStoryTags,
  buildAssistantMentionReferencesFromNodes,
  createAssistantFallbackScene,
  resolveAssistantStorySceneMedia,
} from './assistantMentions';
import { MIN_STORY_CARD_HEIGHT } from './constants';
import { formatStoryEditorText, getStoryEditorCopy } from './i18n';
import { PLOT_STRUCTURE_DIRECTION_CONFIG } from './plotStructureDirection';

type AlertOptions = {
  title: string;
  description: string;
  tone?: 'info' | 'warning' | 'danger';
};

type UsePlotStructureGenerationOptions = {
  callAIForText: (prompt: string) => Promise<string>;
  generateLength: string;
  language: Language;
  plotStructureGenerateDirection: PlotStructureGenerateDirection;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  showDialogAlert: (options: AlertOptions) => Promise<void>;
};

const getDirectionLabel = (language: Language, direction: PlotStructureGenerateDirection) => {
  const copy = getStoryEditorCopy(language);
  return {
    right: copy.plotDirectionRight,
    left: copy.plotDirectionLeft,
    down: copy.plotDirectionDown,
    up: copy.plotDirectionUp,
  }[direction];
};

export function usePlotStructureGeneration({
  callAIForText,
  generateLength,
  language,
  plotStructureGenerateDirection,
  setEdges,
  setNodes,
  showDialogAlert,
}: UsePlotStructureGenerationOptions) {
  return useCallback(
    async (params: PlotStructureGenerateParams) => {
      const copy = getStoryEditorCopy(language);
      const { toolNodeId, cardCount, detailLevel, direction, regionStoryNodes, region } = params;
      const layoutDirection = plotStructureGenerateDirection;
      const layoutConfig = PLOT_STRUCTURE_DIRECTION_CONFIG[layoutDirection];

      const lastStory = regionStoryNodes.filter((node) => node.type === 'storyNode').at(-1);
      if (!lastStory) {
        await showDialogAlert({
          title: copy.plotUnable,
          description: copy.plotNoCards,
          tone: 'warning',
        });
        return;
      }

      // Settings remain context; only a story card can anchor a continuation.
      const existingContent = formatRegionStoryForPrompt([
        ...regionStoryNodes.filter((node) => node.id !== lastStory.id),
        lastStory,
      ]);
      const detailText =
        detailLevel === 'brief'
          ? copy.plotBriefDetail
          : detailLevel === 'detailed'
            ? copy.plotDetailedDetail
            : generateLength;
      const prompt = formatStoryEditorText(copy.plotPrompt, {
        existingContent,
        direction,
        layoutDirection: getDirectionLabel(language, layoutDirection),
        cardCount,
        detailText,
      });

      try {
        const result = await callAIForText(prompt);
        const cards = parseGeneratedPlotCards(result).slice(0, cardCount);

        if (cards.length === 0) {
          await showDialogAlert({
            title: copy.parsingFailed,
            description: copy.parseResponseFailed,
            tone: 'warning',
          });
          return;
        }

        const lastNodeId = lastStory.id;
        const newIds = cards.map(() => uuidv4());
        const newEdges: Edge[] = [];
        let sourceId = lastNodeId;

        for (let index = 0; index < cards.length; index += 1) {
          newEdges.push({
            id: `e-${sourceId}-${newIds[index]}`,
            source: sourceId,
            sourceHandle: layoutConfig.sourceHandle,
            target: newIds[index],
            targetHandle: layoutConfig.targetHandle,
            type: 'customEdge',
          });
          sourceId = newIds[index];
        }

        setNodes((currentNodes) => {
          const lastNode = currentNodes.find((node) => node.id === lastNodeId);
          if (!lastNode) return currentNodes;

          const sourceWidth = lastNode.measured?.width || (lastNode.style?.width as number) || 300;
          const sourceHeight =
            lastNode.measured?.height || (lastNode.style?.height as number) || 200;
          const cardWidth = 300;
          const cardHeight = MIN_STORY_CARD_HEIGHT;
          const offsetDistance = 120;
          const startPosition =
            layoutConfig.primaryAxis === 'x'
              ? {
                  x:
                    layoutDirection === 'left'
                      ? lastNode.position.x - cardWidth - offsetDistance
                      : lastNode.position.x + sourceWidth + offsetDistance,
                  y: lastNode.position.y,
                }
              : {
                  x: lastNode.position.x,
                  y:
                    layoutDirection === 'up'
                      ? lastNode.position.y - cardHeight - offsetDistance
                      : lastNode.position.y + sourceHeight + offsetDistance,
                };
          let currentX = startPosition.x;
          let currentY = startPosition.y;
          const generationNodes = currentNodes.some((node) => node.type === 'sceneNode')
            ? currentNodes
            : [...currentNodes, createAssistantFallbackScene(currentNodes, language)];
          const references = buildAssistantMentionReferencesFromNodes(generationNodes);
          const currentPresentation = (lastNode.data as StoryNodeData).presentation;
          const activeSourceIds = new Set([
            currentPresentation?.scene?.sourceNodeId,
            ...(currentPresentation?.characters || []).map((character) => character.sourceNodeId),
          ]);
          let taggedReferences = references.map((reference) => ({
            ...reference,
            prependIfMissing: activeSourceIds.has(reference.id),
          }));
          const occupied = generationNodes
            .filter((node) => node.id !== region?.id)
            .map(getNodePlacementBounds);

          const newNodes: Node[] = cards.map((card, index) => {
            const newId = newIds[index];
            const tagged = applyAssistantStoryTags(card.text, taggedReferences);
            if (tagged.presentation?.scene) {
              taggedReferences = taggedReferences.map((reference) =>
                reference.kind === 'scene'
                  ? {
                      ...reference,
                      prependIfMissing: reference.id === tagged.presentation?.scene?.sourceNodeId,
                    }
                  : reference,
              );
            }
            const sceneMedia = resolveAssistantStorySceneMedia(
              tagged.presentation,
              generationNodes,
            );
            const layoutHeight = estimateStoryCardLayoutHeight(
              card.text,
              Boolean(tagged.presentation || sceneMedia.imageUrl),
            );
            if (layoutDirection === 'up') currentY -= layoutHeight - cardHeight;
            const isOccupied = (x: number, y: number) =>
              occupied.some((bounds) =>
                rectsOverlap(
                  { minX: x, minY: y, maxX: x + cardWidth, maxY: y + layoutHeight },
                  bounds,
                  40,
                ),
              );

            let attempts = 0;
            while (isOccupied(currentX, currentY) && attempts < 100) {
              if (layoutConfig.collisionAxis === 'x') currentX += layoutConfig.collisionStep;
              else currentY += layoutConfig.collisionStep;
              attempts += 1;
            }
            if (isOccupied(currentX, currentY)) {
              currentY =
                Math.max(currentY, ...occupied.map((bounds) => bounds.maxY)) + offsetDistance;
            }

            const node: Node = {
              id: newId,
              type: 'storyNode',
              position: { x: currentX, y: currentY },
              style: { width: cardWidth, height: layoutHeight },
              data: {
                id: newId,
                title: card.title,
                text: tagged.text,
                presentation: tagged.presentation,
                ...sceneMedia,
                shape: 'square',
                color: '#ffffff',
                sizeMode: 'auto',
              } satisfies StoryNodeData,
            };

            occupied.push({
              minX: currentX,
              minY: currentY,
              maxX: currentX + cardWidth,
              maxY: currentY + layoutHeight,
            });
            if (layoutConfig.primaryAxis === 'x') currentX += layoutConfig.primaryDelta;
            else
              currentY +=
                layoutDirection === 'up'
                  ? -(cardHeight + offsetDistance)
                  : layoutHeight + offsetDistance;
            return node;
          });

          let updatedNodes = [...generationNodes, ...newNodes];
          if (region?.type === 'dynamicGroup') {
            updatedNodes = updatedNodes.map((node) => {
              if (node.id !== region.id || node.type !== 'groupNode') return node;
              const childIds = Array.isArray(node.data.childIds) ? node.data.childIds : [];
              return {
                ...node,
                data: { ...node.data, childIds: Array.from(new Set([...childIds, ...newIds])) },
              };
            });
          }

          if (region?.type === 'background') {
            updatedNodes = expandBackgroundToFitNodes(updatedNodes, region.id, [
              ...regionStoryNodes.map((item) => item.id),
              toolNodeId,
              ...newIds,
            ]);
          }
          return updatedNodes;
        });
        setEdges((currentEdges) => [...currentEdges, ...newEdges]);
      } catch (error) {
        console.error('Plot structure generation failed:', error);
        await showDialogAlert({
          title: copy.plotGenerationFailed,
          description:
            error instanceof Error && error.message ? error.message : copy.checkApiNetwork,
          tone: 'warning',
        });
      }
    },
    [
      callAIForText,
      generateLength,
      language,
      plotStructureGenerateDirection,
      setEdges,
      setNodes,
      showDialogAlert,
    ],
  );
}
