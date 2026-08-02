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

      if (regionStoryNodes.length === 0) {
        await showDialogAlert({
          title: copy.plotUnable,
          description: copy.plotNoCards,
          tone: 'warning',
        });
        return;
      }

      const existingContent = formatRegionStoryForPrompt(regionStoryNodes);
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

        const lastNodeId = regionStoryNodes[regionStoryNodes.length - 1].id;
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
          const cardHeight = 200;
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

          const newNodes: Node[] = cards.map((card, index) => {
            const newId = newIds[index];
            const isOccupied = (x: number, y: number) =>
              currentNodes.some(
                (node) => Math.abs(node.position.x - x) < 50 && Math.abs(node.position.y - y) < 50,
              );

            let attempts = 0;
            while (isOccupied(currentX, currentY) && attempts < 10) {
              if (layoutConfig.collisionAxis === 'x') currentX += layoutConfig.collisionStep;
              else currentY += layoutConfig.collisionStep;
              attempts += 1;
            }

            const node: Node = {
              id: newId,
              type: 'storyNode',
              position: { x: currentX, y: currentY },
              style: { width: cardWidth, height: cardHeight },
              data: {
                id: newId,
                title: card.title,
                text: card.text,
                shape: 'square',
                color: '#ffffff',
                sizeMode: 'auto',
              } satisfies StoryNodeData,
            };

            if (layoutConfig.primaryAxis === 'x') currentX += layoutConfig.primaryDelta;
            else currentY += layoutConfig.primaryDelta;
            return node;
          });

          let updatedNodes = [...currentNodes, ...newNodes];
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
