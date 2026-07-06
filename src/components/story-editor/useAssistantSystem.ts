import type { Edge, Node } from '@xyflow/react';
import { useReactFlow } from '@xyflow/react';
import React, { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

import type {
  AssistantCardDraft,
  AssistantCardPlacementMode,
  AssistantCardPlacementOptions,
} from '../../agent/planning/agentCardDraft';
import type {
  CharacterNodeData,
  NumberConditionNodeData,
  SceneNodeData,
  StoryNodeData,
} from '../../domain/project';
import {
  type AssistantCardPlacementResult,
  useAssistantPanel,
} from '../../editor-features/assistant/useAssistantPanel';
import type { AITextResult, AITextStreamHandlers } from '../../editor-services/aiClient';
import type { Language } from '../../lib/i18n';
import {
  applyAssistantStoryTags,
  type AssistantMentionReference,
  buildAssistantMentionReferencesFromNodes,
  resolveAssistantStorySceneMedia,
} from './assistantMentions';
import { isDefaultInitialStoryNode } from './colorUtils';
import {
  AI_SETTING_CARD_LAYOUT_FIELD_HEIGHT,
  AI_SETTING_CARD_LAYOUT_HEIGHT,
  AI_STORY_CARD_HEIGHT,
  AI_STORY_CARD_WIDTH,
} from './constants';

// ---------------------------------------------------------------------------
// Params
// ---------------------------------------------------------------------------

interface UseAssistantSystemParams {
  nodes: Node[];
  edges: Edge[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;

  getCenterPosition: () => { x: number; y: number };
  tzoom: number;
  language: Language;
  isMobile: boolean;
  effectiveFlowWidth: number;
  bubbleStyle: 'glass' | 'flat';
  miniMapPosition: 'left' | 'right';

  runAgentCardPlacement: (options: any) => Promise<any>;
  startAgentWaiting?: (title: string, label: string, nodeIds?: string[]) => void;
  stopAgentWaiting: () => void;

  handleGenerateSettingNodeImage: (nodeId: string, type: 'character' | 'scene') => Promise<void>;
  handleGenerateStoryNodeImage: (nodeId: string) => Promise<void>;

  callAIForTextResult: (prompt: string) => Promise<AITextResult>;
  callAIForTextStream?: (prompt: string, handlers?: AITextStreamHandlers) => Promise<AITextResult>;

  allowAssistantImageGeneration: boolean;
  skipAssistantAgentAnimation: boolean;
  missingImageApiKey: boolean;
  missingTextApiKey: boolean;
  assistantMemorySkillEnabled: boolean;
  assistantMemoryNotes: string[];
  setAssistantMemoryNotes: React.Dispatch<React.SetStateAction<string[]>>;

  selectedAssistantTargetNodes: Node[];

  showToast: (message: string, tone?: 'success' | 'error') => void;
  requestSettingsAttention: (target: 'text' | 'image' | 'background-removal' | 'voice') => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAssistantSystem(params: UseAssistantSystemParams) {
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    getCenterPosition,
    tzoom,
    language,
    isMobile,
    effectiveFlowWidth,
    bubbleStyle,
    miniMapPosition,
    runAgentCardPlacement,
    startAgentWaiting,
    stopAgentWaiting,
    handleGenerateSettingNodeImage,
    handleGenerateStoryNodeImage,
    callAIForTextResult,
    callAIForTextStream,
    allowAssistantImageGeneration,
    skipAssistantAgentAnimation,
    missingImageApiKey,
    missingTextApiKey,
    assistantMemorySkillEnabled,
    assistantMemoryNotes,
    setAssistantMemoryNotes,
    selectedAssistantTargetNodes,
    showToast,
    requestSettingsAttention,
  } = params;

  const { fitView, setCenter } = useReactFlow();

  // =========================================================================
  // executeAssistantCardPlacement
  // =========================================================================
  const executeAssistantCardPlacement = useCallback(
    (
      cards: AssistantCardDraft[],
      mode: AssistantCardPlacementMode = 'append',
      options?: AssistantCardPlacementOptions,
    ): AssistantCardPlacementResult => {
      const cleanText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
      const getDraftType = (
        card: AssistantCardDraft,
      ): 'story' | 'character' | 'scene' | 'number-condition' => {
        if (card.type === 'character' || card.type === 'scene' || card.type === 'story')
          return card.type;
        if (card.type === 'number-condition') return card.type;
        if (
          typeof card.threshold === 'number' ||
          (Array.isArray(card.ranges) && card.ranges.length > 0)
        )
          return 'number-condition';
        if (
          cleanText(card.characterName) ||
          cleanText(card.personality) ||
          cleanText(card.features) ||
          cleanText(card.background)
        )
          return 'character';
        if (
          cleanText(card.sceneName) ||
          cleanText(card.location) ||
          cleanText(card.items) ||
          cleanText(card.atmosphere)
        )
          return 'scene';
        return 'story';
      };

      const validCards = cards
        .map((card) => ({
          ...card,
          type: getDraftType(card),
          key: cleanText(card.key),
          chapterTitle: cleanText(card.chapterTitle),
          title: cleanText(card.title),
          text: cleanText(card.text),
          nodeValue:
            typeof card.nodeValue === 'number' && Number.isFinite(card.nodeValue)
              ? card.nodeValue
              : undefined,
          characterName: cleanText(card.characterName),
          traits: cleanText(card.traits),
          personality: cleanText(card.personality),
          features: cleanText(card.features),
          background: cleanText(card.background),
          sceneName: cleanText(card.sceneName),
          description: cleanText(card.description),
          location: cleanText(card.location),
          items: cleanText(card.items),
          atmosphere: cleanText(card.atmosphere),
          other: cleanText(card.other),
          threshold:
            typeof card.threshold === 'number' && Number.isFinite(card.threshold)
              ? card.threshold
              : undefined,
          ranges: Array.isArray(card.ranges)
            ? card.ranges
                .map((range) => ({
                  min: typeof range.min === 'number' && Number.isFinite(range.min) ? range.min : 0,
                  max: typeof range.max === 'number' && Number.isFinite(range.max) ? range.max : 0,
                }))
                .filter((range) => range.min <= range.max)
            : undefined,
          connectTo: Array.isArray(card.connectTo)
            ? card.connectTo.map(cleanText).filter(Boolean)
            : undefined,
          branchTargets: Array.isArray(card.branchTargets)
            ? card.branchTargets
                .map((branch) => ({
                  target: cleanText(branch.target),
                  handle: cleanText(branch.handle),
                  label: cleanText(branch.label),
                }))
                .filter((branch) => branch.target)
            : undefined,
          assistantCandidateKind: card.assistantCandidateKind,
          assistantCandidateGroupId: cleanText(card.assistantCandidateGroupId),
          assistantTemplateId: cleanText(card.assistantTemplateId),
          assistantTemplateName: cleanText(card.assistantTemplateName),
          assistantTemplateInstruction: cleanText(card.assistantTemplateInstruction),
          assistantTemplateTeachingMode: card.assistantTemplateTeachingMode,
          assistantTemplateIsUserOwned: card.assistantTemplateIsUserOwned === true,
        }))
        .filter((card) => {
          if (card.type === 'character') {
            return (
              card.characterName ||
              card.traits ||
              card.personality ||
              card.features ||
              card.background ||
              card.other ||
              card.title ||
              card.text
            );
          }
          if (card.type === 'scene') {
            return (
              card.sceneName ||
              card.description ||
              card.location ||
              card.items ||
              card.atmosphere ||
              card.other ||
              card.title ||
              card.text
            );
          }
          if (card.type === 'number-condition') {
            return (
              typeof card.threshold === 'number' ||
              (Array.isArray(card.ranges) && card.ranges.length > 0) ||
              card.title
            );
          }
          return card.text || card.title;
        });

      if (validCards.length === 0) return { count: 0 };

      const explicitFillTargetIds = new Set(options?.targetNodeIds || []);
      const selectedFillTargets = nodes.filter(
        (n) =>
          (explicitFillTargetIds.size > 0 ? explicitFillTargetIds.has(n.id) : n.selected) &&
          (n.type === 'storyNode' || n.type === 'characterNode' || n.type === 'sceneNode'),
      );
      const defaultInitialRootNode = nodes.find(isDefaultInitialStoryNode);
      const hasNonDefaultStoryNode = nodes.some(
        (node) => node.type === 'storyNode' && !isDefaultInitialStoryNode(node),
      );
      const shouldReplaceInitialRoot =
        mode === 'append' &&
        edges.length === 0 &&
        Boolean(defaultInitialRootNode) &&
        !hasNonDefaultStoryNode &&
        validCards.some((draft) => draft.type === 'story');
      const usedDraftIndexes = new Set<number>();
      const usedTargetIds = new Set<string>();
      let filledCount = 0;

      if (mode === 'fill-selected' && selectedFillTargets.length > 0) {
        setNodes((nds) =>
          nds.map((node) => {
            if (
              !selectedFillTargets.some((target) => target.id === node.id) ||
              usedTargetIds.has(node.id)
            )
              return node;
            const compatibleType =
              node.type === 'characterNode'
                ? 'character'
                : node.type === 'sceneNode'
                  ? 'scene'
                  : 'story';
            const draftIndex = validCards.findIndex(
              (draft, index) => draft.type === compatibleType && !usedDraftIndexes.has(index),
            );
            if (draftIndex === -1) return node;

            const draft = validCards[draftIndex];
            usedDraftIndexes.add(draftIndex);
            usedTargetIds.add(node.id);
            filledCount += 1;

            if (compatibleType === 'character') {
              return {
                ...node,
                data: {
                  ...node.data,
                  characterName: draft.characterName || draft.title || node.data.characterName,
                  traits: draft.traits || draft.text || node.data.traits || '',
                  personality: draft.personality || node.data.personality || '',
                  features: draft.features || node.data.features || '',
                  background: draft.background || node.data.background || '',
                  other: draft.other || node.data.other || '',
                  showPersonality: !!(draft.personality || node.data.showPersonality),
                  showFeatures: !!(draft.features || node.data.showFeatures),
                  showBackground: !!(draft.background || node.data.showBackground),
                  showOther: !!(draft.other || node.data.showOther),
                },
              };
            }

            if (compatibleType === 'scene') {
              return {
                ...node,
                data: {
                  ...node.data,
                  sceneName: draft.sceneName || draft.title || node.data.sceneName,
                  description: draft.description || draft.text || node.data.description || '',
                  location: draft.location || node.data.location || '',
                  items: draft.items || node.data.items || '',
                  atmosphere: draft.atmosphere || node.data.atmosphere || '',
                  other: draft.other || node.data.other || '',
                  showLocation: !!(draft.location || node.data.showLocation),
                  showItems: !!(draft.items || node.data.showItems),
                  showAtmosphere: !!(draft.atmosphere || node.data.showAtmosphere),
                  showOther: !!(draft.other || node.data.showOther),
                },
              };
            }

            return {
              ...node,
              data: {
                ...node.data,
                title: node.data.isRoot ? node.data.title : draft.title || node.data.title,
                text: draft.text || node.data.text || '',
              },
            };
          }),
        );
      }
      const filledTargetNodeIds =
        mode === 'fill-selected' ? selectedFillTargets.map((node) => node.id) : [];

      const remainingCards = validCards.filter((_, index) => !usedDraftIndexes.has(index));
      if (remainingCards.length === 0) return { count: filledCount, nodeIds: filledTargetNodeIds };

      const selectedStories = nodes.filter((n) => n.selected && n.type === 'storyNode');
      const selectedCanvasTarget = nodes.find(
        (node) =>
          node.selected &&
          (node.type === 'storyNode' || node.type === 'characterNode' || node.type === 'sceneNode'),
      );
      const center = getCenterPosition();
      const targetNode =
        mode === 'bridge-to-target' && options?.targetNodeId
          ? nodes.find((node) => node.id === options.targetNodeId) || null
          : null;
      const terminalStories = nodes.filter(
        (node) =>
          node.type === 'storyNode' &&
          node.id !== targetNode?.id &&
          !(shouldReplaceInitialRoot && isDefaultInitialStoryNode(node)) &&
          node.data?.assistantFutureGoal !== true &&
          !edges.some(
            (edge) =>
              edge.source === node.id &&
              nodes.some(
                (candidate) => candidate.id === edge.target && candidate.type === 'storyNode',
              ),
          ),
      );
      const sourceNode =
        (mode === 'adjacent-revision' ? selectedCanvasTarget : null) ||
        selectedStories.find(
          (node) =>
            node.id !== targetNode?.id &&
            !(shouldReplaceInitialRoot && isDefaultInitialStoryNode(node)),
        ) ||
        terminalStories[terminalStories.length - 1] ||
        null;
      const getSettingCardLayoutHeight = (card: (typeof remainingCards)[number]) => {
        if (card.type === 'character') {
          const expandedFieldCount = [
            card.personality,
            card.features,
            card.background,
            card.other,
          ].filter(Boolean).length;
          return (
            AI_SETTING_CARD_LAYOUT_HEIGHT +
            Math.max(0, expandedFieldCount - 1) * AI_SETTING_CARD_LAYOUT_FIELD_HEIGHT
          );
        }

        if (card.type === 'scene') {
          const expandedFieldCount = [
            card.location,
            card.items,
            card.atmosphere,
            card.other,
          ].filter(Boolean).length;
          return (
            AI_SETTING_CARD_LAYOUT_HEIGHT +
            Math.max(0, expandedFieldCount - 1) * AI_SETTING_CARD_LAYOUT_FIELD_HEIGHT
          );
        }

        if (card.type === 'number-condition') {
          return 260 + Math.max(0, (card.ranges?.length || 0) - 1) * 56;
        }

        return AI_STORY_CARD_HEIGHT;
      };
      const cardLayouts = remainingCards.map((card) => ({
        width:
          card.type === 'story'
            ? AI_STORY_CARD_WIDTH
            : card.type === 'number-condition'
              ? 300
              : 280,
        height: getSettingCardLayoutHeight(card),
      }));
      const characterIndexes = remainingCards
        .map((card, index) => (card.type === 'character' ? index : -1))
        .filter((index) => index >= 0);
      const sceneIndexes = remainingCards
        .map((card, index) => (card.type === 'scene' ? index : -1))
        .filter((index) => index >= 0);
      const storyIndexes = remainingCards
        .map((card, index) => (card.type === 'story' ? index : -1))
        .filter((index) => index >= 0);
      const numberConditionIndexes = remainingCards
        .map((card, index) => (card.type === 'number-condition' ? index : -1))
        .filter((index) => index >= 0);
      const rootReplacementStoryIndex = shouldReplaceInitialRoot ? storyIndexes[0] : -1;
      const columnGap = 150;
      const storyCardsPerColumn = 10;
      const storyColumnGap = 120;
      const storyColumnCount = Math.max(1, Math.ceil(storyIndexes.length / storyCardsPerColumn));
      const storyLayoutWidth =
        AI_STORY_CARD_WIDTH * storyColumnCount + storyColumnGap * (storyColumnCount - 1);
      const rowGap = 200;
      const layoutColumns = [
        { type: 'character' as const, indexes: characterIndexes, width: 280 },
        { type: 'scene' as const, indexes: sceneIndexes, width: 280 },
        { type: 'story' as const, indexes: storyIndexes, width: storyLayoutWidth },
        { type: 'number-condition' as const, indexes: numberConditionIndexes, width: 300 },
      ].filter((column) => column.indexes.length > 0);
      const getColumnHeight = (indexes: number[], type?: (typeof layoutColumns)[number]['type']) =>
        type === 'story'
          ? Math.max(
              0,
              ...Array.from({ length: storyColumnCount }, (_, columnIndex) =>
                storyIndexes
                  .slice(columnIndex * storyCardsPerColumn, (columnIndex + 1) * storyCardsPerColumn)
                  .reduce(
                    (height, cardIndex, rowIndex) =>
                      height + cardLayouts[cardIndex].height + (rowIndex > 0 ? rowGap : 0),
                    0,
                  ),
              ),
            )
          : indexes.reduce(
              (height, cardIndex, rowIndex) =>
                height + cardLayouts[cardIndex].height + (rowIndex > 0 ? rowGap : 0),
              0,
            );
      const totalLayoutWidth =
        layoutColumns.reduce((width, column) => width + column.width, 0) +
        Math.max(0, layoutColumns.length - 1) * columnGap;
      const maxColumnHeight = Math.max(
        0,
        ...layoutColumns.map((column) => getColumnHeight(column.indexes, column.type)),
      );
      const layoutLeft = center.x - totalLayoutWidth / 2;
      const layoutTop = center.y - maxColumnHeight / 2;
      const columnXByType = new Map<'character' | 'scene' | 'story' | 'number-condition', number>();
      layoutColumns.reduce((x, column) => {
        columnXByType.set(column.type, x);
        return x + column.width + columnGap;
      }, layoutLeft);
      const getVerticalColumnPosition = (columnIndexes: number[], cardIndex: number, x: number) => {
        const rowIndex = Math.max(0, columnIndexes.indexOf(cardIndex));
        const y =
          layoutTop +
          columnIndexes
            .slice(0, rowIndex)
            .reduce(
              (offset, previousIndex) => offset + cardLayouts[previousIndex].height + rowGap,
              0,
            );
        return { x, y };
      };
      const getStoryColumnPosition = (cardIndex: number, x: number) => {
        const storyIndex = Math.max(0, storyIndexes.indexOf(cardIndex));
        const columnIndex = Math.floor(storyIndex / storyCardsPerColumn);
        const rowIndex = storyIndex % storyCardsPerColumn;
        const columnStartIndex = columnIndex * storyCardsPerColumn;
        const y =
          layoutTop +
          storyIndexes
            .slice(columnStartIndex, columnStartIndex + rowIndex)
            .reduce(
              (offset, previousIndex) => offset + cardLayouts[previousIndex].height + rowGap,
              0,
            );
        return {
          x: x + columnIndex * (AI_STORY_CARD_WIDTH + storyColumnGap),
          y,
        };
      };

      const cardIds = remainingCards.map(() => uuidv4());
      const existingMentionReferences = buildAssistantMentionReferencesFromNodes(nodes);
      const generatedMentionReferences: AssistantMentionReference[] = remainingCards
        .map((card, index): AssistantMentionReference | null => {
          if (card.type === 'character') {
            const name =
              card.characterName || card.title || (language === 'zh' ? 'AI 角色' : 'AI Character');
            return { id: cardIds[index], kind: 'character' as const, name, prependIfMissing: true };
          }
          if (card.type === 'scene') {
            const name =
              card.sceneName || card.title || (language === 'zh' ? 'AI 场景' : 'AI Scene');
            return { id: cardIds[index], kind: 'scene' as const, name, prependIfMissing: true };
          }
          return null;
        })
        .filter((reference): reference is AssistantMentionReference => Boolean(reference));
      const assistantMentionReferences = [
        ...generatedMentionReferences,
        ...existingMentionReferences,
      ];
      const isAssistantCandidateLayout =
        remainingCards.length > 1 &&
        remainingCards.every((card) => Boolean(card.assistantCandidateGroupId)) &&
        new Set(remainingCards.map((card) => card.assistantCandidateGroupId)).size === 1;
      const candidateGap = 96;
      const candidateTotalWidth =
        remainingCards.reduce(
          (width, _card, cardIndex) => width + cardLayouts[cardIndex].width,
          0,
        ) +
        Math.max(0, remainingCards.length - 1) * candidateGap;
      const candidateLeft = center.x - candidateTotalWidth / 2;
      const getAssistantCandidatePosition = (cardIndex: number) => ({
        x:
          candidateLeft +
          remainingCards
            .slice(0, cardIndex)
            .reduce(
              (offset, _card, previousIndex) =>
                offset + cardLayouts[previousIndex].width + candidateGap,
              0,
            ),
        y: center.y - cardLayouts[cardIndex].height / 2,
      });

      const newNodes: Node[] = remainingCards.map((card, index) => {
        const id = cardIds[index];
        const layout = cardLayouts[index];
        let position =
          card.type === 'character'
            ? getVerticalColumnPosition(
                characterIndexes,
                index,
                columnXByType.get('character') ?? center.x - layout.width / 2,
              )
            : card.type === 'scene'
              ? getVerticalColumnPosition(
                  sceneIndexes,
                  index,
                  columnXByType.get('scene') ?? center.x - layout.width / 2,
                )
              : card.type === 'number-condition'
                ? getVerticalColumnPosition(
                    numberConditionIndexes,
                    index,
                    columnXByType.get('number-condition') ?? center.x - layout.width / 2,
                  )
                : getStoryColumnPosition(
                    index,
                    columnXByType.get('story') ?? center.x - layout.width / 2,
                  );
        if (isAssistantCandidateLayout) {
          position = getAssistantCandidatePosition(index);
        } else if (mode === 'adjacent-revision' && sourceNode) {
          position = {
            x: sourceNode.position.x + (sourceNode.measured?.width || 300) + 80,
            y: sourceNode.position.y + index * (layout.height + 60),
          };
        } else if (mode === 'future-targets') {
          const anchorX = sourceNode
            ? sourceNode.position.x - Math.max(0, remainingCards.length - 1) * 190
            : center.x - Math.max(0, remainingCards.length - 1) * 190;
          const anchorY = sourceNode
            ? sourceNode.position.y + (sourceNode.measured?.height || 200) + 300
            : center.y;
          position = { x: anchorX + index * 380, y: anchorY };
        } else if (mode === 'bridge-to-target' && sourceNode && targetNode) {
          const bridgeIndex =
            card.type === 'story' ? Math.max(0, storyIndexes.indexOf(index)) : index;
          position = {
            x: sourceNode.position.x,
            y:
              sourceNode.position.y +
              (sourceNode.measured?.height || (sourceNode.style?.height as number) || 200) +
              100 +
              bridgeIndex * 280,
          };
        }
        if (card.type === 'character') {
          return {
            id,
            type: 'characterNode',
            position,
            selected: !card.assistantCandidateGroupId,
            data: {
              id,
              characterName:
                card.characterName ||
                card.title ||
                (language === 'zh' ? 'AI 角色' : 'AI Character'),
              traits: card.traits || card.text || '',
              personality: card.personality || '',
              features: card.features || '',
              background: card.background || '',
              other: card.other || '',
              showPersonality: !!card.personality,
              showFeatures: !!card.features,
              showBackground: !!card.background,
              showOther: !!card.other,
              assistantCandidateKind: card.assistantCandidateKind,
              assistantCandidateGroupId: card.assistantCandidateGroupId,
              assistantTemplateId: card.assistantTemplateId,
              assistantTemplateName: card.assistantTemplateName,
              assistantTemplateInstruction: card.assistantTemplateInstruction,
              assistantTemplateTeachingMode: card.assistantTemplateTeachingMode,
              assistantTemplateIsUserOwned: card.assistantTemplateIsUserOwned,
            } satisfies CharacterNodeData,
          };
        }

        if (card.type === 'scene') {
          return {
            id,
            type: 'sceneNode',
            position,
            selected: !card.assistantCandidateGroupId,
            data: {
              id,
              sceneName:
                card.sceneName || card.title || (language === 'zh' ? 'AI 场景' : 'AI Scene'),
              description: card.description || card.text || '',
              location: card.location || '',
              items: card.items || '',
              atmosphere: card.atmosphere || '',
              other: card.other || '',
              showLocation: !!card.location,
              showItems: !!card.items,
              showAtmosphere: !!card.atmosphere,
              showOther: !!card.other,
              assistantCandidateKind: card.assistantCandidateKind,
              assistantCandidateGroupId: card.assistantCandidateGroupId,
              assistantTemplateId: card.assistantTemplateId,
              assistantTemplateName: card.assistantTemplateName,
              assistantTemplateInstruction: card.assistantTemplateInstruction,
              assistantTemplateTeachingMode: card.assistantTemplateTeachingMode,
              assistantTemplateIsUserOwned: card.assistantTemplateIsUserOwned,
            } satisfies SceneNodeData,
          };
        }

        if (card.type === 'number-condition') {
          return {
            id,
            type: 'numberConditionNode',
            position,
            selected: true,
            data: {
              id,
              threshold: card.threshold ?? 0,
              ranges: card.ranges?.map((range) => ({
                id: uuidv4(),
                min: range.min,
                max: range.max,
              })),
            } satisfies NumberConditionNodeData,
          };
        }

        const taggedStory = applyAssistantStoryTags(card.text, assistantMentionReferences);
        const sceneMedia = resolveAssistantStorySceneMedia(taggedStory.presentation, nodes);

        return {
          id,
          type: 'storyNode',
          position,
          selected: true,
          style: { width: AI_STORY_CARD_WIDTH, height: AI_STORY_CARD_HEIGHT },
          data: {
            id,
            title: card.title || (language === 'zh' ? 'AI 剧情卡片' : 'AI Story Card'),
            text: taggedStory.text,
            shape: 'square',
            color: '#ffffff',
            sizeMode: 'auto',
            isRoot: index === rootReplacementStoryIndex,
            nodeValue: card.nodeValue,
            assistantFutureGoal: mode === 'future-targets',
            presentation: taggedStory.presentation,
            ...sceneMedia,
          } satisfies StoryNodeData,
        };
      });

      const storyNodesToLink = newNodes.filter((node) => node.type === 'storyNode');
      const numberConditionNodesToLink = newNodes.filter(
        (node) => node.type === 'numberConditionNode',
      );
      const flowNodesToLink =
        numberConditionNodesToLink.length > 0
          ? newNodes.filter(
              (node) => node.type === 'storyNode' || node.type === 'numberConditionNode',
            )
          : storyNodesToLink;
      const getFlowSourceHandle = (node: Node) =>
        node.type === 'numberConditionNode' ? 'out-greater' : 'bottom';
      const getFlowTargetHandle = (source: Node | null, target: Node) => {
        if (target.type === 'numberConditionNode') return 'in-top';
        if (source?.type === 'numberConditionNode') return 'left';
        return 'top';
      };
      const newEdges: Edge[] = [];
      const hasExplicitConnections = remainingCards.some(
        (card) => (card.connectTo?.length || 0) > 0 || (card.branchTargets?.length || 0) > 0,
      );
      const isEndingDraft = (card: (typeof remainingCards)[number]) => {
        if (card.type !== 'story') return false;
        const searchable = `${card.key || ''} ${card.title || ''} ${card.text || ''}`;
        return /ending|good\s*end|bad\s*end|true\s*end|结局|真结局|好结局|坏结局/i.test(searchable);
      };
      const inferredEndingIndexes = remainingCards
        .map((card, index) => (isEndingDraft(card) ? index : -1))
        .filter((index) => index >= 0);
      const inferredEndingNodes = inferredEndingIndexes
        .map((index) => newNodes[index])
        .filter((node): node is Node => Boolean(node) && node.type === 'storyNode');
      const firstEndingIndex = inferredEndingIndexes[0] ?? -1;
      const inferredBranchSource =
        !hasExplicitConnections && inferredEndingNodes.length >= 2
          ? newNodes
              .slice(0, Math.max(0, firstEndingIndex))
              .reverse()
              .find((node) => node.type === 'storyNode') || sourceNode
          : null;
      if (inferredBranchSource && inferredEndingNodes.length >= 2) {
        const branchWidth = 380;
        const branchTop =
          inferredBranchSource.position.y +
          (inferredBranchSource.measured?.height ||
            (inferredBranchSource.style?.height as number) ||
            200) +
          260;
        const branchLeft =
          inferredBranchSource.position.x - ((inferredEndingNodes.length - 1) * branchWidth) / 2;
        inferredEndingNodes.forEach((node, index) => {
          node.position = {
            x: branchLeft + index * branchWidth,
            y: branchTop,
          };
        });
      }

      const storyChapterTitles = storyIndexes
        .map((index) => remainingCards[index].chapterTitle)
        .filter((title): title is string => Boolean(title));
      const uniqueStoryChapterTitles = Array.from(new Set(storyChapterTitles));
      const chapterBackgroundNodes: Node[] = [];
      if (uniqueStoryChapterTitles.length > 0) {
        const storyX = columnXByType.get('story') ?? center.x - AI_STORY_CARD_WIDTH / 2;
        const chapterGap = 140;
        const chapterPadding = 56;
        let chapterTop = layoutTop;

        uniqueStoryChapterTitles.forEach((chapterTitle, chapterIndex) => {
          const chapterStoryIndexes = storyIndexes.filter(
            (storyIndex) => remainingCards[storyIndex].chapterTitle === chapterTitle,
          );
          if (chapterStoryIndexes.length === 0) return;
          const chapterColumnCount = Math.max(
            1,
            Math.ceil(chapterStoryIndexes.length / storyCardsPerColumn),
          );
          const chapterColumnGap = storyColumnGap;

          chapterStoryIndexes.forEach((storyIndex, rowIndex) => {
            const node = newNodes[storyIndex];
            if (!node) return;
            const chapterColumnIndex = Math.floor(rowIndex / storyCardsPerColumn);
            const chapterRowIndex = rowIndex % storyCardsPerColumn;
            node.position = {
              x: storyX + chapterColumnIndex * (AI_STORY_CARD_WIDTH + chapterColumnGap),
              y: chapterTop + chapterPadding + chapterRowIndex * (AI_STORY_CARD_HEIGHT + 72),
            };
          });

          const rowsInTallestChapterColumn = Math.min(
            storyCardsPerColumn,
            chapterStoryIndexes.length,
          );
          const chapterHeight =
            chapterPadding * 2 +
            rowsInTallestChapterColumn * AI_STORY_CARD_HEIGHT +
            Math.max(0, rowsInTallestChapterColumn - 1) * 72;
          const backgroundId = uuidv4();
          const chapterColors = ['#eef2ff', '#ecfeff', '#f0fdf4', '#fff7ed', '#fdf2f8'];
          chapterBackgroundNodes.push({
            id: backgroundId,
            type: 'backgroundNode',
            position: { x: storyX - chapterPadding, y: chapterTop },
            dragHandle: '.custom-drag-handle',
            style: {
              width:
                chapterColumnCount * AI_STORY_CARD_WIDTH +
                Math.max(0, chapterColumnCount - 1) * chapterColumnGap +
                chapterPadding * 2,
              height: chapterHeight,
              zIndex: -3,
            },
            data: {
              id: backgroundId,
              title: chapterTitle,
              color: chapterColors[chapterIndex % chapterColors.length],
            },
          });

          chapterTop += chapterHeight + chapterGap;
        });
      }

      const nodeByDraftRef = new Map<string, Node>();
      remainingCards.forEach((card, index) => {
        const node = newNodes[index];
        if (!node || (node.type !== 'storyNode' && node.type !== 'numberConditionNode')) return;
        [card.key, card.title].filter(Boolean).forEach((ref) => {
          nodeByDraftRef.set(String(ref).trim().toLowerCase(), node);
        });
      });
      const resolveDraftNode = (ref: string) =>
        nodeByDraftRef.get(ref.trim().toLowerCase()) || null;
      const normalizeBranchHandle = (source: Node, handle?: string) => {
        if (source.type !== 'numberConditionNode') return handle === 'right' ? 'right' : 'bottom';
        const normalized = (handle || '').trim().toLowerCase();
        if (normalized === 'less' || normalized === 'less-equal' || normalized === 'lt') {
          return 'out-less-equal';
        }
        if (normalized.startsWith('range:')) {
          const rangeIndex = Number.parseInt(normalized.slice(6), 10);
          const ranges = (source.data.ranges as Array<{ id: string }> | undefined) || [];
          return ranges[rangeIndex]?.id ? `out-range-${ranges[rangeIndex].id}` : 'out-greater';
        }
        if (normalized.startsWith('out-')) return normalized;
        return 'out-greater';
      };
      const pushFlowEdge = (source: Node, target: Node, sourceHandle: string, label?: string) => {
        newEdges.push({
          id: `e-${source.id}-${target.id}-${newEdges.length}`,
          source: source.id,
          sourceHandle,
          target: target.id,
          targetHandle: getFlowTargetHandle(source, target),
          type: 'customEdge',
          data: label ? { label } : undefined,
        });
      };

      if (inferredBranchSource && inferredEndingNodes.length >= 2 && mode !== 'adjacent-revision') {
        const preBranchNodes = flowNodesToLink.filter((node) => {
          const nodeIndex = newNodes.findIndex((candidate) => candidate.id === node.id);
          return (
            nodeIndex >= 0 && nodeIndex < firstEndingIndex && node.id !== inferredBranchSource.id
          );
        });
        if (sourceNode && preBranchNodes[0]) {
          pushFlowEdge(sourceNode, preBranchNodes[0], 'bottom');
        }
        for (let index = 0; index < preBranchNodes.length - 1; index += 1) {
          pushFlowEdge(
            preBranchNodes[index],
            preBranchNodes[index + 1],
            getFlowSourceHandle(preBranchNodes[index]),
          );
        }
        if (
          sourceNode &&
          inferredBranchSource.id !== sourceNode.id &&
          preBranchNodes.length === 0
        ) {
          pushFlowEdge(sourceNode, inferredBranchSource, 'bottom');
        }
        inferredEndingNodes.forEach((endingNode, index) => {
          pushFlowEdge(
            inferredBranchSource,
            endingNode,
            inferredBranchSource.type === 'storyNode'
              ? 'bottom'
              : getFlowSourceHandle(inferredBranchSource),
            (endingNode.data.title as string | undefined) ||
              `${language === 'zh' ? '结局' : 'Ending'} ${index + 1}`,
          );
        });
      } else if (hasExplicitConnections && mode !== 'adjacent-revision') {
        if (sourceNode && flowNodesToLink[0]) {
          pushFlowEdge(sourceNode, flowNodesToLink[0], 'bottom');
        }
        remainingCards.forEach((card, index) => {
          const sourceFlowNode = newNodes[index];
          if (
            !sourceFlowNode ||
            (sourceFlowNode.type !== 'storyNode' && sourceFlowNode.type !== 'numberConditionNode')
          ) {
            return;
          }
          (card.connectTo || []).forEach((targetRef) => {
            const targetFlowNode = resolveDraftNode(targetRef);
            if (targetFlowNode) {
              pushFlowEdge(sourceFlowNode, targetFlowNode, getFlowSourceHandle(sourceFlowNode));
            }
          });
          (card.branchTargets || []).forEach((branch) => {
            const targetFlowNode = resolveDraftNode(branch.target);
            if (targetFlowNode) {
              pushFlowEdge(
                sourceFlowNode,
                targetFlowNode,
                normalizeBranchHandle(sourceFlowNode, branch.handle),
                branch.label,
              );
            }
          });
        });
      } else {
        if (
          sourceNode &&
          flowNodesToLink[0] &&
          mode !== 'future-targets' &&
          mode !== 'adjacent-revision'
        ) {
          newEdges.push({
            id: `e-${sourceNode.id}-${flowNodesToLink[0].id}`,
            source: sourceNode.id,
            sourceHandle: 'bottom',
            target: flowNodesToLink[0].id,
            targetHandle: getFlowTargetHandle(sourceNode, flowNodesToLink[0]),
            type: 'customEdge',
          });
        }
        for (
          let i = 0;
          mode !== 'future-targets' &&
          mode !== 'adjacent-revision' &&
          i < flowNodesToLink.length - 1;
          i += 1
        ) {
          const sourceFlowNode = flowNodesToLink[i];
          const targetFlowNode = flowNodesToLink[i + 1];
          newEdges.push({
            id: `e-${sourceFlowNode.id}-${targetFlowNode.id}`,
            source: sourceFlowNode.id,
            sourceHandle: getFlowSourceHandle(sourceFlowNode),
            target: targetFlowNode.id,
            targetHandle: getFlowTargetHandle(sourceFlowNode, targetFlowNode),
            type: 'customEdge',
          });
        }
      }
      if (mode === 'bridge-to-target' && targetNode && flowNodesToLink.length > 0) {
        const lastBridgeNode = flowNodesToLink[flowNodesToLink.length - 1];
        newEdges.push({
          id: `e-${lastBridgeNode.id}-${targetNode.id}`,
          source: lastBridgeNode.id,
          sourceHandle: getFlowSourceHandle(lastBridgeNode),
          target: targetNode.id,
          targetHandle: getFlowTargetHandle(lastBridgeNode, targetNode),
          type: 'customEdge',
        });
      }

      const bridgeTargetPosition =
        mode === 'bridge-to-target' && sourceNode && targetNode
          ? {
              x: sourceNode.position.x,
              y:
                sourceNode.position.y +
                (sourceNode.measured?.height || (sourceNode.style?.height as number) || 200) +
                100 +
                storyNodesToLink.length * 280,
            }
          : null;
      setNodes((nds) => [
        ...nds
          .map((node) => ({
            ...node,
            selected: false,
            data: shouldReplaceInitialRoot ? { ...node.data, isRoot: false } : node.data,
            position:
              bridgeTargetPosition && node.id === targetNode?.id
                ? bridgeTargetPosition
                : node.position,
          }))
          .filter((node) => !(shouldReplaceInitialRoot && isDefaultInitialStoryNode(node))),
        ...newNodes,
        ...chapterBackgroundNodes,
      ]);
      if (newEdges.length > 0) setEdges((eds) => [...eds, ...newEdges]);
      return {
        count: filledCount + remainingCards.length,
        position: { x: center.x, y: center.y, zoom: tzoom },
        nodeIds: [...filledTargetNodeIds, ...newNodes.map((node) => node.id)],
      };
    },
    [edges, nodes, setNodes, setEdges, getCenterPosition, language, tzoom],
  );

  // =========================================================================
  // Agent helpers
  // =========================================================================
  const getAgentDraftType = useCallback(
    (card: AssistantCardDraft): 'story' | 'character' | 'scene' | 'number-condition' => {
      const cleanText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
      if (
        card.type === 'character' ||
        card.type === 'scene' ||
        card.type === 'story' ||
        card.type === 'number-condition'
      ) {
        return card.type;
      }
      if (
        typeof card.threshold === 'number' ||
        (Array.isArray(card.ranges) && card.ranges.length > 0)
      ) {
        return 'number-condition';
      }
      if (
        cleanText(card.characterName) ||
        cleanText(card.personality) ||
        cleanText(card.features) ||
        cleanText(card.background)
      ) {
        return 'character';
      }
      if (
        cleanText(card.sceneName) ||
        cleanText(card.location) ||
        cleanText(card.items) ||
        cleanText(card.atmosphere)
      ) {
        return 'scene';
      }
      return 'story';
    },
    [],
  );

  const createAgentSkeletonCards = useCallback(
    (cards: AssistantCardDraft[]): AssistantCardDraft[] =>
      cards.map((card) => {
        const type = getAgentDraftType(card);
        const graphMetadata = {
          key: card.key || card.title,
          connectTo: card.connectTo,
          branchTargets: card.branchTargets,
          assistantCandidateKind: card.assistantCandidateKind,
          assistantCandidateGroupId: card.assistantCandidateGroupId,
          assistantTemplateId: card.assistantTemplateId,
          assistantTemplateName: card.assistantTemplateName,
          assistantTemplateInstruction: card.assistantTemplateInstruction,
          assistantTemplateTeachingMode: card.assistantTemplateTeachingMode,
          assistantTemplateIsUserOwned: card.assistantTemplateIsUserOwned,
        };
        if (type === 'character') {
          return {
            type,
            ...graphMetadata,
            characterName: language === 'zh' ? 'AI 角色' : 'AI Character',
            traits: '',
          };
        }
        if (type === 'scene') {
          return {
            type,
            ...graphMetadata,
            sceneName: language === 'zh' ? 'AI 场景' : 'AI Scene',
            description: '',
          };
        }
        if (type === 'number-condition') {
          return {
            type,
            ...graphMetadata,
            title: card.title,
            threshold: card.threshold,
            ranges: card.ranges,
          };
        }
        return {
          type,
          ...graphMetadata,
          title: language === 'zh' ? 'AI 剧情卡片' : 'AI Story Card',
          text: '',
        };
      }),
    [getAgentDraftType, language],
  );

  const getAgentFieldValue = useCallback(
    (card: AssistantCardDraft, fieldKey?: string) => {
      if (!fieldKey) return '';
      const type = getAgentDraftType(card);
      if (type === 'character') {
        const values: Record<string, string | undefined> = {
          'character-name': card.characterName || card.title,
          traits: card.traits || card.text,
          personality: card.personality,
          features: card.features,
          background: card.background,
          other: card.other,
        };
        return values[fieldKey] || '';
      }
      if (type === 'scene') {
        const values: Record<string, string | undefined> = {
          'scene-name': card.sceneName || card.title,
          description: card.description || card.text,
          location: card.location,
          items: card.items,
          atmosphere: card.atmosphere,
          other: card.other,
        };
        return values[fieldKey] || '';
      }
      const values: Record<string, string | undefined> = {
        title: card.title,
        'story-text': card.text,
      };
      return values[fieldKey] || '';
    },
    [getAgentDraftType],
  );

  const applyAgentFieldValue = useCallback(
    (nodeId: string, fieldKey: string | undefined, value: string, finalized = false) => {
      if (!fieldKey) return;
      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (node.id !== nodeId) return node;

          if (node.type === 'characterNode') {
            const updates: Record<string, unknown> = {};
            if (fieldKey === 'character-name') updates.characterName = value;
            if (fieldKey === 'traits') updates.traits = value;
            if (fieldKey === 'personality') {
              updates.personality = value;
              updates.showPersonality = true;
            }
            if (fieldKey === 'features') {
              updates.features = value;
              updates.showFeatures = true;
            }
            if (fieldKey === 'background') {
              updates.background = value;
              updates.showBackground = true;
            }
            if (fieldKey === 'other') {
              updates.other = value;
              updates.showOther = true;
            }
            return { ...node, data: { ...node.data, ...updates } };
          }

          if (node.type === 'sceneNode') {
            const updates: Record<string, unknown> = {};
            if (fieldKey === 'scene-name') updates.sceneName = value;
            if (fieldKey === 'description') updates.description = value;
            if (fieldKey === 'location') {
              updates.location = value;
              updates.showLocation = true;
            }
            if (fieldKey === 'items') {
              updates.items = value;
              updates.showItems = true;
            }
            if (fieldKey === 'atmosphere') {
              updates.atmosphere = value;
              updates.showAtmosphere = true;
            }
            if (fieldKey === 'other') {
              updates.other = value;
              updates.showOther = true;
            }
            return { ...node, data: { ...node.data, ...updates } };
          }

          if (node.type === 'storyNode') {
            if (fieldKey === 'title') {
              return { ...node, data: { ...node.data, title: value } };
            }
            if (fieldKey === 'story-text') {
              if (!finalized) {
                return { ...node, data: { ...node.data, text: value } };
              }
              const taggedStory = applyAssistantStoryTags(
                value,
                buildAssistantMentionReferencesFromNodes(currentNodes),
              );
              const sceneMedia = resolveAssistantStorySceneMedia(
                taggedStory.presentation,
                currentNodes,
              );
              return {
                ...node,
                data: {
                  ...node.data,
                  text: taggedStory.text,
                  ...(taggedStory.presentation ? { presentation: taggedStory.presentation } : {}),
                  ...sceneMedia,
                },
              };
            }
          }

          return node;
        }),
      );
    },
    [setNodes],
  );

  const prepareAgentFields = useCallback(
    (nodeIds: string[] | undefined, cards: AssistantCardDraft[]) => {
      if (!nodeIds || nodeIds.length === 0) return;
      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          const cardIndex = nodeIds.indexOf(node.id);
          if (cardIndex < 0) return node;

          const card = cards[cardIndex];
          if (!card) return node;

          if (node.type === 'characterNode') {
            return {
              ...node,
              data: {
                ...node.data,
                showPersonality: !!(card.personality || node.data.showPersonality),
                showFeatures: !!(card.features || node.data.showFeatures),
                showBackground: !!(card.background || node.data.showBackground),
                showOther: !!(card.other || node.data.showOther),
              },
            };
          }

          if (node.type === 'sceneNode') {
            return {
              ...node,
              data: {
                ...node.data,
                showLocation: !!(card.location || node.data.showLocation),
                showItems: !!(card.items || node.data.showItems),
                showAtmosphere: !!(card.atmosphere || node.data.showAtmosphere),
                showOther: !!(card.other || node.data.showOther),
              },
            };
          }

          return node;
        }),
      );
    },
    [setNodes],
  );

  const typeAgentFieldValue = useCallback(
    async (
      nodeId: string | undefined,
      fieldKey: string | undefined,
      value: string,
      shouldSkip: () => boolean,
    ) => {
      if (!nodeId || !fieldKey || !value) return;
      if (shouldSkip()) {
        applyAgentFieldValue(nodeId, fieldKey, value, true);
        return;
      }

      const maxSteps = 80;
      const stride = Math.max(1, Math.ceil(value.length / maxSteps));
      for (let index = stride; index < value.length; index += stride) {
        if (shouldSkip()) break;
        applyAgentFieldValue(nodeId, fieldKey, value.slice(0, index));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 18));
      }
      applyAgentFieldValue(nodeId, fieldKey, value, true);
    },
    [applyAgentFieldValue],
  );

  // =========================================================================
  // createAssistantCards
  // =========================================================================
  const createAssistantCards = useCallback(
    async (
      cards: AssistantCardDraft[],
      mode: AssistantCardPlacementMode = 'append',
      options?: AssistantCardPlacementOptions,
    ): Promise<AssistantCardPlacementResult> => {
      const selectedCount =
        options?.targetNodeIds?.length ??
        nodes.filter(
          (node) =>
            node.selected &&
            (node.type === 'storyNode' ||
              node.type === 'characterNode' ||
              node.type === 'sceneNode'),
        ).length;

      const placement = await runAgentCardPlacement({
        cards,
        mode,
        options,
        selectedCount,
        skipAnimation: skipAssistantAgentAnimation,
        execute: () => {
          if (mode === 'fill-selected' && options?.targetNodeIds?.length) {
            const placement = {
              count: Math.min(cards.length, options.targetNodeIds.length),
              nodeIds: options.targetNodeIds,
            };
            prepareAgentFields(placement.nodeIds, cards);
            return placement;
          }

          if (mode === 'fill-selected' && selectedCount > 0) {
            const placement = {
              count: Math.min(cards.length, selectedCount),
              nodeIds: nodes
                .filter(
                  (node) =>
                    node.selected &&
                    (node.type === 'storyNode' ||
                      node.type === 'characterNode' ||
                      node.type === 'sceneNode'),
                )
                .map((node) => node.id),
            };
            prepareAgentFields(placement.nodeIds, cards);
            return placement;
          }
          const placement = executeAssistantCardPlacement(
            createAgentSkeletonCards(cards),
            mode,
            options,
          );
          prepareAgentFields(placement.nodeIds, cards);
          return placement;
        },
        applyStep: async (step: any, result: any, shouldSkip: () => boolean) => {
          if (step.type !== 'type-field' || typeof step.cardIndex !== 'number') return;
          const card = cards[step.cardIndex];
          const value = getAgentFieldValue(card, step.fieldKey);
          await typeAgentFieldValue(
            result.nodeIds?.[step.cardIndex],
            step.fieldKey,
            value,
            shouldSkip,
          );
        },
      });

      const imageRequests = cards
        .map((card, index) => ({ card, index, type: getAgentDraftType(card) }))
        .filter(
          ({ card, type }) =>
            card.generateImage === true || (type === 'character' && card.generateImage !== false),
        );

      if (imageRequests.length > 0 && !allowAssistantImageGeneration) {
        showToast(
          language === 'zh'
            ? 'AI 助手图片生成已在设置中关闭'
            : language === 'ja'
              ? 'AIアシスタントの画像生成は設定で無効になっています'
              : 'AI assistant image generation is disabled in settings',
        );
      } else if (imageRequests.length > 0 && missingImageApiKey) {
        requestSettingsAttention('image');
        showToast(
          language === 'zh'
            ? '请先在设置 > AI 配置 > 图片 AI 中连接图片 API'
            : language === 'ja'
              ? '設定 > AI設定 > Image AI で画像APIを接続してください'
              : 'Connect an Image AI API in Settings > AI Settings > Image AI first',
        );
      } else if (imageRequests.length > 0) {
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
        for (const request of imageRequests) {
          const nodeId = placement.nodeIds?.[request.index];
          if (!nodeId) continue;
          if (request.type === 'character' || request.type === 'scene') {
            await handleGenerateSettingNodeImage(nodeId, request.type);
          } else {
            await handleGenerateStoryNodeImage(nodeId);
          }
        }
      }

      return placement;
    },
    [
      allowAssistantImageGeneration,
      createAgentSkeletonCards,
      executeAssistantCardPlacement,
      getAgentFieldValue,
      getAgentDraftType,
      handleGenerateSettingNodeImage,
      handleGenerateStoryNodeImage,
      language,
      missingImageApiKey,
      nodes,
      prepareAgentFields,
      requestSettingsAttention,
      runAgentCardPlacement,
      skipAssistantAgentAnimation,
      showToast,
      typeAgentFieldValue,
    ],
  );

  // =========================================================================
  // Streaming card updates
  // =========================================================================
  const updateStreamingAssistantCards = useCallback(
    (nodeIds: string[] | undefined, cards: AssistantCardDraft[]) => {
      if (!nodeIds || nodeIds.length === 0 || cards.length === 0) return;
      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          const cardIndex = nodeIds.indexOf(node.id);
          if (cardIndex < 0) return node;
          const card = cards[cardIndex];
          if (!card) return node;
          const type = getAgentDraftType(card);

          if (node.type === 'characterNode' && type === 'character') {
            return {
              ...node,
              data: {
                ...node.data,
                characterName: card.characterName || card.title || node.data.characterName,
                traits: card.traits || card.text || node.data.traits || '',
                personality: card.personality || node.data.personality || '',
                features: card.features || node.data.features || '',
                background: card.background || node.data.background || '',
                other: card.other || node.data.other || '',
                showPersonality: !!(card.personality || node.data.showPersonality),
                showFeatures: !!(card.features || node.data.showFeatures),
                showBackground: !!(card.background || node.data.showBackground),
                showOther: !!(card.other || node.data.showOther),
              },
            };
          }

          if (node.type === 'sceneNode' && type === 'scene') {
            return {
              ...node,
              data: {
                ...node.data,
                sceneName: card.sceneName || card.title || node.data.sceneName,
                description: card.description || card.text || node.data.description || '',
                location: card.location || node.data.location || '',
                items: card.items || node.data.items || '',
                atmosphere: card.atmosphere || node.data.atmosphere || '',
                other: card.other || node.data.other || '',
                showLocation: !!(card.location || node.data.showLocation),
                showItems: !!(card.items || node.data.showItems),
                showAtmosphere: !!(card.atmosphere || node.data.showAtmosphere),
                showOther: !!(card.other || node.data.showOther),
              },
            };
          }

          if (node.type === 'numberConditionNode' && type === 'number-condition') {
            const currentData = node.data as NumberConditionNodeData;
            return {
              ...node,
              data: {
                ...currentData,
                threshold: card.threshold ?? currentData.threshold ?? 0,
                ranges:
                  card.ranges?.map((range) => ({
                    id: uuidv4(),
                    min: range.min,
                    max: range.max,
                  })) || currentData.ranges,
              } satisfies NumberConditionNodeData,
            };
          }

          if (node.type !== 'storyNode' || type !== 'story') return node;

          const taggedStory = applyAssistantStoryTags(
            card.text || '',
            buildAssistantMentionReferencesFromNodes(currentNodes),
          );
          const sceneMedia = resolveAssistantStorySceneMedia(
            taggedStory.presentation,
            currentNodes,
          );
          return {
            ...node,
            data: {
              ...node.data,
              title: card.title || node.data.title,
              text: taggedStory.text,
              nodeValue: card.nodeValue,
              ...(taggedStory.presentation ? { presentation: taggedStory.presentation } : {}),
              ...sceneMedia,
            },
          };
        }),
      );
    },
    [getAgentDraftType, setNodes],
  );

  // =========================================================================
  // Assistant image generation for nodes
  // =========================================================================
  const handleGenerateAssistantImagesForNodes = useCallback(
    async (nodeIds: string[]) => {
      const visualNodes = nodeIds
        .map((nodeId) => nodes.find((node) => node.id === nodeId))
        .filter(
          (node): node is Node =>
            Boolean(node) && (node?.type === 'characterNode' || node?.type === 'sceneNode'),
        );

      if (visualNodes.length === 0) return;

      if (!allowAssistantImageGeneration) {
        showToast(
          language === 'zh'
            ? 'AI 助手图片生成已在设置中关闭'
            : language === 'ja'
              ? 'AIアシスタントの画像生成は設定で無効になっています'
              : 'AI assistant image generation is disabled in settings',
        );
        return;
      }

      if (missingImageApiKey) {
        requestSettingsAttention('image');
        showToast(
          language === 'zh'
            ? '请先在设置 > AI 配置 > 图片 AI 中连接图片 API'
            : language === 'ja'
              ? '設定 > AI設定 > Image AI で画像APIを接続してください'
              : 'Connect an Image AI API in Settings > AI Settings > Image AI first',
        );
        return;
      }

      for (const node of visualNodes) {
        await handleGenerateSettingNodeImage(
          node.id,
          node.type === 'characterNode' ? 'character' : 'scene',
        );
      }
    },
    [
      allowAssistantImageGeneration,
      handleGenerateSettingNodeImage,
      language,
      missingImageApiKey,
      nodes,
      requestSettingsAttention,
      showToast,
    ],
  );

  // =========================================================================
  // Assistant message position click
  // =========================================================================
  const handleAssistantMessagePositionClick = useCallback(
    (target: { position?: { x: number; y: number; zoom?: number }; nodeIds?: string[] }) => {
      const targetIds = new Set(target.nodeIds || []);
      const targetNodes = nodes.filter((node) => targetIds.has(node.id));

      if (targetNodes.length > 0) {
        setNodes((currentNodes) =>
          currentNodes.map((node) => ({
            ...node,
            selected: targetIds.has(node.id),
          })),
        );
        void fitView({
          nodes: targetNodes,
          padding: 0.3,
          duration: 450,
          maxZoom: 1.2,
        });
        return;
      }

      if (!target.position) return;
      void setCenter(target.position.x, target.position.y, {
        zoom: target.position.zoom ?? tzoom,
        duration: 450,
      });
    },
    [fitView, nodes, setCenter, setNodes, tzoom],
  );

  // =========================================================================
  // Remove assistant nodes
  // =========================================================================
  const removeAssistantNodes = useCallback(
    (nodeIds: string[]) => {
      if (nodeIds.length === 0) return;
      const nodeIdSet = new Set(nodeIds);
      setNodes((currentNodes) => currentNodes.filter((node) => !nodeIdSet.has(node.id)));
      setEdges((currentEdges) =>
        currentEdges.filter((edge) => !nodeIdSet.has(edge.source) && !nodeIdSet.has(edge.target)),
      );
    },
    [setEdges, setNodes],
  );

  // =========================================================================
  // useAssistantPanel integration
  // =========================================================================
  const {
    assistantOpen,
    setAssistantOpen,
    assistantPanelWidth,
    assistantResizing,
    assistantInput,
    setAssistantInput,
    assistantLoading,
    assistantListening,
    assistantDocuments,
    assistantDocumentLoading,
    assistantArticleAnalysis,
    assistantTasks,
    setAssistantTasks,
    activeAssistantTaskId,
    setActiveAssistantTaskId,
    assistantMessages,
    assistantMessagesRef,
    handleNewAssistantTask,
    handleRenameAssistantTask,
    handleRequestCloseAssistantTask,
    handleConfirmCloseAssistantTask,
    handleCancelCloseAssistantTask,
    assistantTaskPendingCloseId,
    handleAssistantSend,
    handleAssistantOptionSelect,
    handleAssistantCandidateNodeSelect,
    handleStartAssistantFlow,
    handleAssistantDocumentUpload,
    handleRemoveAssistantDocument,
    handleAssistantVoiceInput,
    toggleAssistantThought,
    handleAssistantResizePointerDown,
    handleAssistantResizePointerMove,
    handleAssistantResizePointerUp,
    handleAssistantUndo,
    handleAssistantRedo,
    canAssistantUndo,
    canAssistantRedo,
    resetAssistantTasks,
  } = useAssistantPanel({
    language,
    isMobile,
    flowWidth: effectiveFlowWidth,
    selectedAssistantTargetNodes,
    nodes,
    callAIForTextResult,
    callAIForTextStream,
    createAssistantCards,
    updateStreamingAssistantCards,
    removeAssistantNodes,
    onGenerateAssistantImagesRequest: handleGenerateAssistantImagesForNodes,
    startAgentWaiting: skipAssistantAgentAnimation ? undefined : startAgentWaiting,
    stopAgentWaiting,
    hasTextApiKey: !missingTextApiKey,
    onMissingTextApiKeyRequest: () => {
      requestSettingsAttention('text');
    },
    assistantMemorySkillEnabled,
    assistantMemoryNotes,
    setAssistantMemoryNotes,
  });

  const miniMapOverlayStyle =
    !isMobile && bubbleStyle === 'glass' && assistantOpen && miniMapPosition === 'right'
      ? { right: assistantPanelWidth + 16 }
      : undefined;

  // =========================================================================
  // Return
  // =========================================================================
  return {
    // Panel state
    assistantOpen,
    setAssistantOpen,
    assistantPanelWidth,
    assistantResizing,
    assistantInput,
    setAssistantInput,
    assistantLoading,
    assistantListening,
    assistantDocuments,
    assistantDocumentLoading,
    assistantArticleAnalysis,
    assistantTasks,
    setAssistantTasks,
    activeAssistantTaskId,
    setActiveAssistantTaskId,
    assistantMessages,
    assistantMessagesRef,
    handleNewAssistantTask,
    handleRenameAssistantTask,
    handleRequestCloseAssistantTask,
    handleConfirmCloseAssistantTask,
    handleCancelCloseAssistantTask,
    assistantTaskPendingCloseId,
    handleAssistantSend,
    handleAssistantOptionSelect,
    handleAssistantCandidateNodeSelect,
    handleStartAssistantFlow,
    handleAssistantDocumentUpload,
    handleRemoveAssistantDocument,
    handleAssistantVoiceInput,
    toggleAssistantThought,
    handleAssistantResizePointerDown,
    handleAssistantResizePointerMove,
    handleAssistantResizePointerUp,
    handleAssistantUndo,
    handleAssistantRedo,
    canAssistantUndo,
    canAssistantRedo,
    resetAssistantTasks,

    // Card operations
    createAssistantCards,
    updateStreamingAssistantCards,
    removeAssistantNodes,
    handleGenerateAssistantImagesForNodes,
    handleAssistantMessagePositionClick,

    // UI
    miniMapOverlayStyle,
  };
}
