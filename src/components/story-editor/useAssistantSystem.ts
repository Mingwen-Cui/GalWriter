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
import type { SettingLibraryItem } from '../../domain/settingLibrary';
import {
  type AssistantCardPlacementResult,
  useAssistantPanel,
} from '../../editor-features/assistant/useAssistantPanel';
import type { AITextResult, AITextStreamHandlers } from '../../editor-services/aiClient';
import { assistantPanelCopy } from '../../editor-shell/i18n/assistant';
import type { Language } from '../../lib/i18n';
import {
  applyAssistantStoryTags,
  type AssistantMentionReference,
  buildAssistantMentionReferencesFromNodes,
  resolveAssistantStorySceneMedia,
} from './assistantMentions';
import { isDefaultInitialStoryNode } from './colorUtils';
import {
  AI_CHARACTER_CARD_LAYOUT_HEIGHT,
  AI_SCENE_CARD_LAYOUT_HEIGHT,
  AI_STORY_CARD_HEIGHT,
  AI_STORY_CARD_WIDTH,
  SETTING_NODE_CARD_WIDTH,
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
  getViewportZoom: () => number;
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
  settingLibraryContext: string;
  savedSettingLibraryItems: SettingLibraryItem[];
  presetSettingLibraryItems: SettingLibraryItem[];

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
    getViewportZoom,
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
    settingLibraryContext,
    savedSettingLibraryItems,
    presetSettingLibraryItems,
    selectedAssistantTargetNodes,
    showToast,
    requestSettingsAttention,
  } = params;
  const assistantCopy = assistantPanelCopy(language);
  const streamingHeightReflowTimerRef = React.useRef<number | null>(null);

  const { fitView, getNodes, setCenter } = useReactFlow();

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
          cleanText(card.identity) ||
          cleanText(card.appearance) ||
          cleanText(card.personality) ||
          cleanText(card.habits) ||
          cleanText(card.speechStyle) ||
          cleanText(card.experience) ||
          cleanText(card.relationships) ||
          cleanText(card.notes)
        )
          return 'character';
        if (
          cleanText(card.sceneName) ||
          cleanText(card.location) ||
          cleanText(card.time) ||
          cleanText(card.weather) ||
          cleanText(card.visual) ||
          cleanText(card.sound) ||
          cleanText(card.items) ||
          cleanText(card.atmosphere)
        )
          return 'scene';
        return 'story';
      };

      // Library cards are selected by their short ID in the AI response. Their
      // complete fields stay local and are restored only when the card is
      // actually placed on the canvas.
      const libraryItemsById = new Map(
        [...savedSettingLibraryItems, ...presetSettingLibraryItems].map((item) => [item.id, item]),
      );
      const resolveLibraryReference = (card: AssistantCardDraft): AssistantCardDraft => {
        const libraryItemId = cleanText(card.libraryItemId);
        const item = libraryItemId ? libraryItemsById.get(libraryItemId) : undefined;
        if (!item) return card;

        if (item.kind === 'character') {
          const libraryData = item.data as CharacterNodeData;
          return {
            ...libraryData,
            ...card,
            type: 'character',
            characterName: cleanText(card.characterName) || libraryData.characterName || item.name,
            libraryItemId: item.id,
          };
        }

        const libraryData = item.data as SceneNodeData;
        return {
          ...libraryData,
          ...card,
          type: 'scene',
          sceneName: cleanText(card.sceneName) || libraryData.sceneName || item.name,
          libraryItemId: item.id,
        };
      };

      const cardTypePriority = { character: 0, scene: 1, story: 2, 'number-condition': 3 } as const;
      const validCards = cards
        .map(resolveLibraryReference)
        .map((card) => ({
          ...card,
          type: getDraftType(card),
          key: cleanText(card.key),
          chapterTitle: cleanText(card.chapterTitle),
          batchTitle: cleanText(card.batchTitle),
          title: cleanText(card.title),
          text: cleanText(card.text),
          nodeValue:
            typeof card.nodeValue === 'number' && Number.isFinite(card.nodeValue)
              ? card.nodeValue
              : undefined,
          characterName: cleanText(card.characterName),
          identity: cleanText(card.identity),
          appearance: cleanText(card.appearance),
          traits: cleanText(card.traits),
          personality: cleanText(card.personality),
          habits: cleanText(card.habits),
          speechStyle: cleanText(card.speechStyle),
          experience: cleanText(card.experience),
          relationships: cleanText(card.relationships),
          notes: cleanText(card.notes),
          avatarUrl: cleanText(card.avatarUrl) || undefined,
          threeViewUrl: cleanText(card.threeViewUrl) || undefined,
          tagSpriteUrl: cleanText(card.tagSpriteUrl) || undefined,
          outfits: Array.isArray(card.outfits) ? card.outfits.map((outfit) => ({ ...outfit })) : undefined,
          features: cleanText(card.features),
          background: cleanText(card.background),
          sceneName: cleanText(card.sceneName),
          time: cleanText(card.time),
          weather: cleanText(card.weather),
          visual: cleanText(card.visual),
          sound: cleanText(card.sound),
          description: cleanText(card.description),
          location: cleanText(card.location),
          items: cleanText(card.items),
          atmosphere: cleanText(card.atmosphere),
          other: cleanText(card.other),
          coverImageUrl: cleanText(card.coverImageUrl) || undefined,
          images: Array.isArray(card.images) ? card.images.map((image) => ({ ...image })) : undefined,
          libraryItemId: cleanText(card.libraryItemId) || undefined,
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
              card.time ||
              card.weather ||
              card.visual ||
              card.sound ||
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
        })
        // Every generated batch is shown as three uninterrupted sections:
        // character settings, scene settings, and finally story cards.
        .sort((left, right) => cardTypePriority[left.type] - cardTypePriority[right.type]);

      if (validCards.length === 0) return { count: 0 };

      const explicitFillTargetIds = new Set(options?.targetNodeIds || []);
      const selectedFillTargets = nodes.filter(
        (n) =>
          (explicitFillTargetIds.size > 0 ? explicitFillTargetIds.has(n.id) : n.selected) &&
          (n.type === 'storyNode' || n.type === 'characterNode' || n.type === 'sceneNode'),
      );
      const shouldSetGeneratedRoot =
        mode === 'append' &&
        options?.setFirstStoryAsRoot === true &&
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
                  identity: draft.identity || node.data.identity || '',
                  appearance:
                    draft.appearance || draft.features || node.data.appearance || node.data.features || '',
                  personality: draft.personality || node.data.personality || '',
                  habits: draft.habits || node.data.habits || '',
                  speechStyle: draft.speechStyle || node.data.speechStyle || '',
                  experience:
                    draft.experience || draft.background || node.data.experience || node.data.background || '',
                  relationships: draft.relationships || node.data.relationships || '',
                  notes:
                    draft.notes ||
                    draft.other ||
                    draft.traits ||
                    draft.text ||
                    node.data.notes ||
                    node.data.other ||
                    '',
                },
              };
            }

            if (compatibleType === 'scene') {
              return {
                ...node,
                data: {
                  ...node.data,
                  sceneName: draft.sceneName || draft.title || node.data.sceneName,
                  location: draft.location || node.data.location || '',
                  time: draft.time || node.data.time || '',
                  weather: draft.weather || node.data.weather || '',
                  visual:
                    draft.visual ||
                    draft.description ||
                    draft.text ||
                    node.data.visual ||
                    node.data.description ||
                    '',
                  sound: draft.sound || node.data.sound || '',
                  items: draft.items || node.data.items || '',
                  notes:
                    draft.notes ||
                    draft.other ||
                    node.data.notes ||
                    node.data.other ||
                    node.data.atmosphere ||
                    '',
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
      const explicitCanvasTarget = options?.targetNodeIds?.length
        ? nodes.find((node) => node.id === options.targetNodeIds?.[0])
        : undefined;
      const selectedCanvasTarget =
        explicitCanvasTarget ||
        nodes.find(
          (node) =>
            node.selected &&
            (node.type === 'storyNode' ||
              node.type === 'characterNode' ||
              node.type === 'sceneNode'),
        );
      const center = getCenterPosition();
      const currentCanvasNodes = options?.setupNodeIds?.length ? getNodes() : nodes;
      const setupNodeIdSet = new Set(options?.setupNodeIds || []);
      const stagedSetupNodes = currentCanvasNodes.filter(
        (node) =>
          setupNodeIdSet.has(node.id) &&
          (node.type === 'characterNode' || node.type === 'sceneNode'),
      );
      const stagedCharacterNodes = stagedSetupNodes.filter(
        (node) => node.type === 'characterNode',
      );
      const stagedSceneNodes = stagedSetupNodes.filter((node) => node.type === 'sceneNode');
      const targetNode =
        mode === 'bridge-to-target' && options?.targetNodeId
          ? nodes.find((node) => node.id === options.targetNodeId) || null
          : null;
      const terminalStories = nodes.filter(
        (node) =>
          node.type === 'storyNode' &&
          node.id !== targetNode?.id &&
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
        (mode === 'adjacent-revision' || (mode === 'append' && explicitCanvasTarget)
          ? selectedCanvasTarget
          : null) ||
        selectedStories.find(
          (node) => node.id !== targetNode?.id,
        ) ||
        terminalStories[terminalStories.length - 1] ||
        null;
      // A fresh AI "generate cards" action should create an independent story
      // sequence. Only attach its first card when the user explicitly chose a
      // canvas card to continue from, or when this is a dedicated continuation
      // / branch workflow.
      const shouldConnectToSource = mode !== 'append' || Boolean(explicitCanvasTarget);
      const getSettingCardLayoutHeight = (card: (typeof remainingCards)[number]) => {
        if (card.type === 'character') {
          return (
            AI_CHARACTER_CARD_LAYOUT_HEIGHT +
            Math.max(0, (card.outfits?.length || 0) - 1) * 54
          );
        }

        if (card.type === 'scene') {
          return (
            AI_SCENE_CARD_LAYOUT_HEIGHT +
            Math.max(0, (card.images?.length || 0) - 1) * 54
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
              : SETTING_NODE_CARD_WIDTH,
        height: card.type === 'story' ? AI_STORY_CARD_HEIGHT : getSettingCardLayoutHeight(card),
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
      const rootReplacementStoryIndex = shouldSetGeneratedRoot ? storyIndexes[0] : -1;
      // Setting cards are wide and tall after their content is rendered. Keep
      // enough breathing room that the story column cannot overlap them.
      const columnGap = 240;
      const storyCardsPerColumn = 10;
      const storyColumnGap = 180;
      const storyColumnCount = Math.max(1, Math.ceil(storyIndexes.length / storyCardsPerColumn));
      const storyLayoutWidth =
        AI_STORY_CARD_WIDTH * storyColumnCount + storyColumnGap * (storyColumnCount - 1);
      const rowGap = 200;
      const layoutColumns = [
        { type: 'character' as const, indexes: characterIndexes, width: SETTING_NODE_CARD_WIDTH },
        { type: 'scene' as const, indexes: sceneIndexes, width: SETTING_NODE_CARD_WIDTH },
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
              rowGap +
              bridgeIndex * (AI_STORY_CARD_HEIGHT + rowGap),
          };
        }
        if (card.type === 'character') {
          return {
            id,
            type: 'characterNode',
            position,
            selected: !options?.lockPlacedNodes && !card.assistantCandidateGroupId,
            deletable: !options?.lockPlacedNodes,
            data: {
              id,
              locked: options?.lockPlacedNodes === true,
              characterName:
                card.characterName ||
                card.title ||
                (language === 'zh' ? 'AI 角色' : 'AI Character'),
              traits: card.traits || card.text || '',
              identity: card.identity || '',
              appearance: card.appearance || '',
              personality: card.personality || '',
              habits: card.habits || '',
              speechStyle: card.speechStyle || '',
              experience: card.experience || '',
              relationships: card.relationships || '',
              notes: card.notes || card.other || card.traits || card.text || '',
              avatarUrl: card.avatarUrl,
              threeViewUrl: card.threeViewUrl,
              tagSpriteUrl: card.tagSpriteUrl,
              features: card.features || '',
              background: card.background || '',
              other: card.other || '',
              libraryItemId: card.libraryItemId,
              outfits: card.outfits?.map((outfit) => ({ ...outfit })),
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
            selected: !options?.lockPlacedNodes && !card.assistantCandidateGroupId,
            deletable: !options?.lockPlacedNodes,
            data: {
              id,
              locked: options?.lockPlacedNodes === true,
              sceneName:
                card.sceneName || card.title || (language === 'zh' ? 'AI 场景' : 'AI Scene'),
              description: card.description || card.text || '',
              location: card.location || '',
              time: card.time || '',
              weather: card.weather || '',
              visual: card.visual || card.description || card.text || '',
              sound: card.sound || '',
              items: card.items || '',
              notes: card.notes || card.other || card.atmosphere || '',
              atmosphere: card.atmosphere || '',
              other: card.other || '',
              coverImageUrl: card.coverImageUrl,
              images: card.images?.map((image) => ({ ...image })),
              libraryItemId: card.libraryItemId,
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
            assistantHeightState: 'streaming',
            isRoot: index === rootReplacementStoryIndex,
            nodeValue: card.nodeValue,
            assistantFutureGoal: mode === 'future-targets',
            presentation: taggedStory.presentation,
            ...sceneMedia,
          } satisfies StoryNodeData,
        };
      });

      const stagedSetupPositions = new Map<string, { x: number; y: number }>();
      const stagedSetupRegionUpdates = new Map<
        string,
        { position: { x: number; y: number }; style: Record<string, unknown> }
      >();
      const hasStagedSetupLayout =
        stagedSetupNodes.length > 0 && storyIndexes.length > 0 && mode === 'append';
      if (hasStagedSetupLayout) {
        const setupColumnGap = 180;
        const setupRowGap = 120;
        const getExistingNodeSize = (node: Node) => ({
          width:
            Number(node.measured?.width) ||
            Number(node.style?.width) ||
            (node.type === 'storyNode' ? AI_STORY_CARD_WIDTH : SETTING_NODE_CARD_WIDTH),
          height:
            Number(node.measured?.height) ||
            Number(node.style?.height) ||
            (node.type === 'characterNode'
              ? AI_CHARACTER_CARD_LAYOUT_HEIGHT
              : node.type === 'sceneNode'
                ? AI_SCENE_CARD_LAYOUT_HEIGHT
                : AI_STORY_CARD_HEIGHT),
        });
        const getSetupColumnHeight = (columnNodes: Node[]) =>
          columnNodes.reduce(
            (height, node, index) =>
              height + getExistingNodeSize(node).height + (index > 0 ? setupRowGap : 0),
            0,
          );
        const storyColumnHeight = getColumnHeight(storyIndexes, 'story');
        const setupColumns = [
          { type: 'character', nodes: stagedCharacterNodes, width: SETTING_NODE_CARD_WIDTH },
          { type: 'scene', nodes: stagedSceneNodes, width: SETTING_NODE_CARD_WIDTH },
          { type: 'story', nodes: [], width: storyLayoutWidth },
        ].filter((column) => column.nodes.length > 0 || column.type === 'story');
        const setupTotalWidth =
          setupColumns.reduce((width, column) => width + column.width, 0) +
          Math.max(0, setupColumns.length - 1) * setupColumnGap;
        const setupTop =
          center.y -
          Math.max(
            storyColumnHeight,
            getSetupColumnHeight(stagedCharacterNodes),
            getSetupColumnHeight(stagedSceneNodes),
          ) /
            2;
        const setupColumnX = new Map<string, number>();
        setupColumns.reduce((x, column) => {
          setupColumnX.set(column.type, x);
          return x + column.width + setupColumnGap;
        }, center.x - setupTotalWidth / 2);

        const stagedSetupColumns: Array<[string, Node[]]> = [
          ['character', stagedCharacterNodes],
          ['scene', stagedSceneNodes],
        ];
        stagedSetupColumns.forEach(([type, columnNodes]) => {
          let y = setupTop;
          columnNodes.forEach((node) => {
            const size = getExistingNodeSize(node);
            stagedSetupPositions.set(node.id, {
              x: setupColumnX.get(type) ?? center.x - size.width / 2,
              y,
            });
            y += size.height + setupRowGap;
          });
        });

        const storyX = setupColumnX.get('story') ?? center.x - AI_STORY_CARD_WIDTH / 2;
        storyIndexes.forEach((cardIndex) => {
          const storyIndex = storyIndexes.indexOf(cardIndex);
          const columnIndex = Math.floor(storyIndex / storyCardsPerColumn);
          const rowIndex = storyIndex % storyCardsPerColumn;
          const columnStart = columnIndex * storyCardsPerColumn;
          const y =
            setupTop +
            storyIndexes
              .slice(columnStart, columnStart + rowIndex)
              .reduce(
                (offset, previousIndex) =>
                  offset + cardLayouts[previousIndex].height + rowGap,
                0,
              );
          newNodes[cardIndex].position = {
            x: storyX + columnIndex * (AI_STORY_CARD_WIDTH + storyColumnGap),
            y,
          };
        });

        currentCanvasNodes.forEach((node) => {
          if (node.type !== 'backgroundNode' && node.type !== 'groupNode') return;
          const childIds = Array.isArray(node.data?.assistantAutoFitChildIds)
            ? node.data.assistantAutoFitChildIds.filter(
                (childId): childId is string => typeof childId === 'string',
              )
            : [];
          const children = childIds
            .map((childId) => {
              const child = stagedSetupNodes.find((item) => item.id === childId);
              const position = stagedSetupPositions.get(childId);
              return child && position ? { child, position } : null;
            })
            .filter((item): item is { child: Node; position: { x: number; y: number } } => Boolean(item));
          if (!children.length) return;
          const padding = Number(node.data?.assistantAutoFitPadding) || 48;
          const bounds = children.reduce(
            (result, { child, position }) => {
              const size = getExistingNodeSize(child);
              return {
                left: Math.min(result.left, position.x),
                top: Math.min(result.top, position.y),
                right: Math.max(result.right, position.x + size.width),
                bottom: Math.max(result.bottom, position.y + size.height),
              };
            },
            { left: Number.POSITIVE_INFINITY, top: Number.POSITIVE_INFINITY, right: 0, bottom: 0 },
          );
          stagedSetupRegionUpdates.set(node.id, {
            position: { x: bounds.left - padding, y: bounds.top - padding },
            style: {
              ...node.style,
              width: Math.max(280, bounds.right - bounds.left + padding * 2),
              height: Math.max(220, bounds.bottom - bounds.top + padding * 2),
            },
          });
        });
      }

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
          const chapterStoryRowGap = rowGap;

          chapterStoryIndexes.forEach((storyIndex, rowIndex) => {
            const node = newNodes[storyIndex];
            if (!node) return;
            const chapterColumnIndex = Math.floor(rowIndex / storyCardsPerColumn);
            const chapterRowIndex = rowIndex % storyCardsPerColumn;
            const chapterColumnStart = chapterColumnIndex * storyCardsPerColumn;
            const rowOffset = chapterStoryIndexes
              .slice(chapterColumnStart, chapterColumnStart + chapterRowIndex)
              .reduce(
                (offset, previousStoryIndex) =>
                  offset + cardLayouts[previousStoryIndex].height + chapterStoryRowGap,
                0,
              );
            node.position = {
              x: storyX + chapterColumnIndex * (AI_STORY_CARD_WIDTH + chapterColumnGap),
              y: chapterTop + chapterPadding + rowOffset,
            };
          });

          const chapterColumnHeights = Array.from({ length: chapterColumnCount }, (_, columnIndex) =>
            chapterStoryIndexes
              .slice(
                columnIndex * storyCardsPerColumn,
                (columnIndex + 1) * storyCardsPerColumn,
              )
              .reduce(
                (height, storyIndex, rowIndex) =>
                  height +
                  cardLayouts[storyIndex].height +
                  (rowIndex > 0 ? chapterStoryRowGap : 0),
                0,
              ),
          );
          const chapterHeight =
            chapterPadding * 2 +
            Math.max(0, ...chapterColumnHeights);
          const backgroundId = uuidv4();
          // Dynamic wrappers use a saturated color because GroupNode renders
          // its fill translucently; pastel background colors become nearly
          // invisible against the canvas.
          const chapterWrapperColor = '#4f46e5';
          chapterBackgroundNodes.push({
            id: backgroundId,
            type: 'groupNode',
            position: { x: 0, y: 0 },
            dragHandle: '.custom-drag-handle',
            style: {
              width: 100,
              height: 100,
              zIndex: -2,
            },
            data: {
              id: backgroundId,
              title: chapterTitle,
              color: chapterWrapperColor,
              language,
              gap: chapterPadding,
              childIds: chapterStoryIndexes
                .map((storyIndex) => newNodes[storyIndex]?.id)
                .filter((nodeId): nodeId is string => Boolean(nodeId)),
              assistantAutoFitPending: true,
              assistantAutoFitChildIds: chapterStoryIndexes
                .map((storyIndex) => newNodes[storyIndex]?.id)
                .filter((nodeId): nodeId is string => Boolean(nodeId)),
              assistantAutoFitPadding: chapterPadding,
            },
          });

          chapterTop += chapterHeight + chapterGap;
        });
      }

      const defaultBatchTitle = (type: (typeof remainingCards)[number]['type']) => {
        if (type === 'character') {
          return assistantCopy.profileFlow.batchBackgrounds.character;
        }
        if (type === 'scene') {
          return assistantCopy.profileFlow.batchBackgrounds.scene;
        }
        if (type === 'number-condition') {
          return assistantCopy.profileFlow.batchBackgrounds.logic;
        }
        return assistantCopy.profileFlow.batchBackgrounds.story;
      };
      const chapterStoryIndexes = new Set(
        storyIndexes.filter((index) => Boolean(remainingCards[index].chapterTitle)),
      );
      const batchGroups = new Map<
        string,
        { title: string; type: (typeof remainingCards)[number]['type']; indexes: number[] }
      >();
      remainingCards.forEach((card, index) => {
        if (card.type === 'story' && chapterStoryIndexes.has(index)) return;
        const title = card.batchTitle || defaultBatchTitle(card.type);
        const key = `${card.type}:${title}`;
        const group = batchGroups.get(key) || { title, type: card.type, indexes: [] };
        group.indexes.push(index);
        batchGroups.set(key, group);
      });
      const batchBackgroundColors = ['#eef2ff', '#ecfeff', '#f0fdf4', '#fff7ed', '#fdf2f8'];
      const batchBackgroundNodes = Array.from(batchGroups.values()).map((group, groupIndex) => {
        const padding = 48;
        const isStoryGroup = group.type === 'story';
        const bounds = group.indexes.reduce(
          (result, index) => {
            const node = newNodes[index];
            const layout = cardLayouts[index];
            if (!node || !layout) return result;
            return {
              left: Math.min(result.left, node.position.x),
              top: Math.min(result.top, node.position.y),
              right: Math.max(result.right, node.position.x + layout.width),
              bottom: Math.max(result.bottom, node.position.y + layout.height),
            };
          },
          { left: Number.POSITIVE_INFINITY, top: Number.POSITIVE_INFINITY, right: 0, bottom: 0 },
        );
        const id = uuidv4();
        return {
          id,
          type: isStoryGroup ? 'groupNode' : 'backgroundNode',
          position: isStoryGroup ? { x: 0, y: 0 } : { x: bounds.left - padding, y: bounds.top - padding },
          dragHandle: '.custom-drag-handle',
          style: {
            width: isStoryGroup ? 100 : Math.max(280, bounds.right - bounds.left + padding * 2),
            height: isStoryGroup ? 100 : Math.max(220, bounds.bottom - bounds.top + padding * 2),
            zIndex: isStoryGroup ? -2 : -3,
          },
          data: {
            id,
            title: group.title,
            color: isStoryGroup ? '#4f46e5' : batchBackgroundColors[groupIndex % batchBackgroundColors.length],
            ...(isStoryGroup
              ? {
                  language,
                  gap: padding,
                  childIds: group.indexes
                    .map((index) => newNodes[index]?.id)
                    .filter((nodeId): nodeId is string => Boolean(nodeId)),
                }
              : {}),
            assistantAutoFitPending: true,
            assistantAutoFitChildIds: group.indexes
              .map((index) => newNodes[index]?.id)
              .filter((nodeId): nodeId is string => Boolean(nodeId)),
            assistantAutoFitPadding: padding,
          },
        } satisfies Node;
      });

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
        if (shouldConnectToSource && sourceNode && preBranchNodes[0]) {
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
          shouldConnectToSource &&
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
        if (shouldConnectToSource && sourceNode && flowNodesToLink[0]) {
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
          shouldConnectToSource &&
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
            data: shouldSetGeneratedRoot ? { ...node.data, isRoot: false } : node.data,
            position:
              stagedSetupRegionUpdates.get(node.id)?.position ||
              stagedSetupPositions.get(node.id) ||
              (bridgeTargetPosition && node.id === targetNode?.id
                ? bridgeTargetPosition
                : node.position),
            style: stagedSetupRegionUpdates.get(node.id)?.style || node.style,
          })),
        ...newNodes,
        ...chapterBackgroundNodes,
        ...batchBackgroundNodes,
      ]);
      // Character and scene setup cards are created in earlier short-drama
      // steps. Re-read the actual canvas state after this story batch has
      // been appended, then align all three sections from the same top edge.
      // This avoids retaining the scene card's old, independently centered
      // position when React commits the preceding step asynchronously.
      if (options?.setupNodeIds?.length && storyNodesToLink.length > 0 && mode === 'append') {
        const storyNodeIdSet = new Set(storyNodesToLink.map((node) => node.id));
        const setupNodeIds = new Set(options.setupNodeIds);
        setNodes((currentNodes) => {
          const getNodeSize = (node: Node) => ({
            width:
              Number(node.measured?.width) ||
              Number(node.style?.width) ||
              (node.type === 'storyNode' ? AI_STORY_CARD_WIDTH : SETTING_NODE_CARD_WIDTH),
            height:
              Number(node.measured?.height) ||
              Number(node.style?.height) ||
              (node.type === 'characterNode'
                ? AI_CHARACTER_CARD_LAYOUT_HEIGHT
                : node.type === 'sceneNode'
                  ? AI_SCENE_CARD_LAYOUT_HEIGHT
                  : AI_STORY_CARD_HEIGHT),
          });
          const characterNodes = currentNodes.filter(
            (node) => setupNodeIds.has(node.id) && node.type === 'characterNode',
          );
          const sceneNodes = currentNodes.filter(
            (node) => setupNodeIds.has(node.id) && node.type === 'sceneNode',
          );
          const storyNodes = currentNodes.filter(
            (node) => storyNodeIdSet.has(node.id) && node.type === 'storyNode',
          );
          if (!characterNodes.length || !sceneNodes.length || !storyNodes.length) return currentNodes;

          const settingRowGap = 120;
          const storyRowGap = 140;
          const columnGap = 200;
          const storyColumns = Math.max(1, Math.ceil(storyNodes.length / storyCardsPerColumn));
          const storyWidth =
            storyColumns * AI_STORY_CARD_WIDTH + Math.max(0, storyColumns - 1) * storyColumnGap;
          const getColumnHeight = (items: Node[], gap: number) =>
            items.reduce(
              (height, node, index) => height + getNodeSize(node).height + (index ? gap : 0),
              0,
            );
          const storyColumnHeight = Math.max(
            ...Array.from({ length: storyColumns }, (_, index) =>
              getColumnHeight(
                storyNodes.slice(index * storyCardsPerColumn, (index + 1) * storyCardsPerColumn),
                storyRowGap,
              ),
            ),
          );
          const layoutHeight = Math.max(
            getColumnHeight(characterNodes, settingRowGap),
            getColumnHeight(sceneNodes, settingRowGap),
            storyColumnHeight,
          );
          const layoutTop = center.y - layoutHeight / 2;
          const layoutLeft =
            center.x - (SETTING_NODE_CARD_WIDTH * 2 + storyWidth + columnGap * 2) / 2;
          const positions = new Map<string, { x: number; y: number }>();
          const positionColumn = (items: Node[], x: number, gap: number) => {
            let y = layoutTop;
            items.forEach((node) => {
              positions.set(node.id, { x, y });
              y += getNodeSize(node).height + gap;
            });
          };
          positionColumn(characterNodes, layoutLeft, settingRowGap);
          positionColumn(sceneNodes, layoutLeft + SETTING_NODE_CARD_WIDTH + columnGap, settingRowGap);
          storyNodes.forEach((node, index) => {
            const columnIndex = Math.floor(index / storyCardsPerColumn);
            const rowIndex = index % storyCardsPerColumn;
            const earlierStories = storyNodes.slice(
              columnIndex * storyCardsPerColumn,
              columnIndex * storyCardsPerColumn + rowIndex,
            );
            positions.set(node.id, {
              x:
                layoutLeft +
                SETTING_NODE_CARD_WIDTH * 2 +
                columnGap * 2 +
                columnIndex * (AI_STORY_CARD_WIDTH + storyColumnGap),
              y:
                layoutTop +
                earlierStories.reduce(
                  (offset, item) => offset + getNodeSize(item).height + storyRowGap,
                  0,
                ),
            });
          });

          return currentNodes.map((node) => {
            const position = positions.get(node.id);
            if (position) return { ...node, position };
            if (node.type !== 'backgroundNode' && node.type !== 'groupNode') return node;
            const childIds = Array.isArray(node.data?.assistantAutoFitChildIds)
              ? node.data.assistantAutoFitChildIds.filter(
                  (childId): childId is string => typeof childId === 'string',
                )
              : [];
            const children = childIds
              .map((childId) => {
                const child = currentNodes.find((item) => item.id === childId);
                const childPosition = positions.get(childId);
                return child && childPosition ? { child, childPosition } : null;
              })
              .filter(
                (item): item is { child: Node; childPosition: { x: number; y: number } } =>
                  Boolean(item),
              );
            if (!children.length) return node;
            const padding = Number(node.data?.assistantAutoFitPadding) || 48;
            const bounds = children.reduce(
              (result, { child, childPosition }) => {
                const size = getNodeSize(child);
                return {
                  left: Math.min(result.left, childPosition.x),
                  top: Math.min(result.top, childPosition.y),
                  right: Math.max(result.right, childPosition.x + size.width),
                  bottom: Math.max(result.bottom, childPosition.y + size.height),
                };
              },
              { left: Number.POSITIVE_INFINITY, top: Number.POSITIVE_INFINITY, right: 0, bottom: 0 },
            );
            return {
              ...node,
              position: { x: bounds.left - padding, y: bounds.top - padding },
              style: {
                ...node.style,
                width: Math.max(280, bounds.right - bounds.left + padding * 2),
                height: Math.max(220, bounds.bottom - bounds.top + padding * 2),
              },
            };
          });
        });
      }
      if (newEdges.length > 0) setEdges((eds) => [...eds, ...newEdges]);
      return {
        count: filledCount + remainingCards.length,
        position: { x: center.x, y: center.y, zoom: getViewportZoom() },
        nodeIds: [...filledTargetNodeIds, ...newNodes.map((node) => node.id)],
      };
    },
    [
      assistantCopy.profileFlow.batchBackgrounds,
      edges,
      nodes,
      setNodes,
      setEdges,
      getCenterPosition,
      getNodes,
      getViewportZoom,
      language,
      presetSettingLibraryItems,
      savedSettingLibraryItems,
    ],
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
        cleanText(card.time) ||
        cleanText(card.weather) ||
        cleanText(card.visual) ||
        cleanText(card.sound) ||
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
            visual: '',
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
          identity: card.identity,
          appearance: card.appearance,
          personality: card.personality,
          habits: card.habits,
          'speech-style': card.speechStyle,
          experience: card.experience,
          relationships: card.relationships,
          notes: card.notes || card.traits || card.text,
        };
        return values[fieldKey] || '';
      }
      if (type === 'scene') {
        const values: Record<string, string | undefined> = {
          'scene-name': card.sceneName || card.title,
          location: card.location,
          time: card.time,
          weather: card.weather,
          visual: card.visual || card.description || card.text,
          sound: card.sound,
          items: card.items,
          notes: card.notes || card.other,
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
            if (fieldKey === 'identity') updates.identity = value;
            if (fieldKey === 'appearance') updates.appearance = value;
            if (fieldKey === 'personality') {
              updates.personality = value;
            }
            if (fieldKey === 'habits') {
              updates.habits = value;
            }
            if (fieldKey === 'speech-style' || fieldKey === 'speechStyle') {
              updates.speechStyle = value;
            }
            if (fieldKey === 'experience') {
              updates.experience = value;
            }
            if (fieldKey === 'relationships') {
              updates.relationships = value;
            }
            if (fieldKey === 'notes') {
              updates.notes = value;
            }
            return { ...node, data: { ...node.data, ...updates } };
          }

          if (node.type === 'sceneNode') {
            const updates: Record<string, unknown> = {};
            if (fieldKey === 'scene-name') updates.sceneName = value;
            if (fieldKey === 'location') updates.location = value;
            if (fieldKey === 'time') updates.time = value;
            if (fieldKey === 'weather') updates.weather = value;
            if (fieldKey === 'visual' || fieldKey === 'description') updates.visual = value;
            if (fieldKey === 'sound') updates.sound = value;
            if (fieldKey === 'items') updates.items = value;
            if (fieldKey === 'notes' || fieldKey === 'other' || fieldKey === 'atmosphere') {
              updates.notes = value;
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

  const finalizeAssistantStoryHeights = useCallback(
    (nodeIds: string[] | undefined, keepStreaming = false) => {
      if (!nodeIds?.length) return;
      const nodeIdSet = new Set(nodeIds);
      const nonce = Date.now();

      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (node.type !== 'storyNode' || !nodeIdSet.has(node.id)) return node;
          const storyData = node.data as StoryNodeData;
          if (
            keepStreaming ||
            storyData.assistantHeightState !== 'streaming' ||
            storyData.sizeMode === 'custom'
          ) {
            return node;
          }
          return {
            ...node,
            data: {
              ...storyData,
              assistantHeightState: 'settled',
              assistantAutoHeightNonce: nonce,
            },
          };
        }),
      );

      const fitPendingAssistantBackgrounds = () => {
        setNodes((currentNodes) => {
          const readDimension = (value: unknown) => {
            if (typeof value === 'number' && Number.isFinite(value)) return value;
            if (typeof value === 'string') {
              const parsed = Number.parseFloat(value);
              return Number.isFinite(parsed) ? parsed : 0;
            }
            return 0;
          };
          const nodeById = new Map(currentNodes.map((node) => [node.id, node]));
          const storyPositionById = new Map<string, { x: number; y: number }>();

          // Initial placement uses a deliberately large estimate so streamed
          // cards cannot collide. Once their final DOM height is available,
          // pack each story column using the real measured height instead of
          // leaving those estimates as permanent blank space.
          currentNodes.forEach((region) => {
            if (region.type !== 'backgroundNode' && region.type !== 'groupNode') return;
            const regionData = region.data as Record<string, unknown>;
            const childIds = Array.isArray(regionData.assistantAutoFitChildIds)
              ? regionData.assistantAutoFitChildIds.filter(
                  (childId): childId is string => typeof childId === 'string',
                )
              : [];
            const shouldReflowRegion =
              regionData.assistantAutoFitPending === true ||
              childIds.some((childId) => nodeIdSet.has(childId));
            if (!shouldReflowRegion) return;
            const children = childIds.map((childId) => nodeById.get(childId)).filter(Boolean) as Node[];
            if (children.length < 2 || !children.every((child) => child.type === 'storyNode')) return;

            const columns: Node[][] = [];
            [...children]
              .sort((left, right) => left.position.x - right.position.x || left.position.y - right.position.y)
              .forEach((child) => {
                const column = columns.find(
                  (items) => Math.abs(items[0].position.x - child.position.x) < 1,
                );
                if (column) column.push(child);
                else columns.push([child]);
              });

            const top = Math.min(...children.map((child) => child.position.y));
            const storyGap = 140;
            columns.forEach((column) => {
              let nextY = top;
              column
                .sort((left, right) => left.position.y - right.position.y)
                .forEach((child) => {
                  storyPositionById.set(child.id, { x: child.position.x, y: nextY });
                  const measuredHeight =
                    readDimension(child.measured?.height) ||
                    readDimension(child.style?.height) ||
                    AI_STORY_CARD_HEIGHT;
                  nextY += measuredHeight + storyGap;
                });
            });
          });

          const reflowedNodes = currentNodes.map((node) => {
            const position = storyPositionById.get(node.id);
            return position ? { ...node, position } : node;
          });
          const reflowedNodeById = new Map(reflowedNodes.map((node) => [node.id, node]));

          return reflowedNodes.map((node) => {
            if (node.type !== 'backgroundNode' && node.type !== 'groupNode') return node;
            const regionData = node.data as Record<string, unknown>;
            const childIds = Array.isArray(regionData.assistantAutoFitChildIds)
              ? regionData.assistantAutoFitChildIds.filter(
                  (childId): childId is string => typeof childId === 'string',
                )
              : [];
            const shouldReflowRegion =
              regionData.assistantAutoFitPending === true ||
              childIds.some((childId) => nodeIdSet.has(childId));
            if (!shouldReflowRegion) return node;
            const children = childIds
              .map((childId) => reflowedNodeById.get(childId))
              .filter(Boolean) as Node[];
            if (!children.length) return node;

            const bounds = children.reduce(
              (result, child) => {
                const width =
                  readDimension(child.style?.width) || readDimension(child.measured?.width);
                const height =
                  readDimension(child.style?.height) || readDimension(child.measured?.height);
                if (!width || !height) return result;
                return {
                  left: Math.min(result.left, child.position.x),
                  top: Math.min(result.top, child.position.y),
                  right: Math.max(result.right, child.position.x + width),
                  bottom: Math.max(result.bottom, child.position.y + height),
                };
              },
              {
                left: Number.POSITIVE_INFINITY,
                top: Number.POSITIVE_INFINITY,
                right: Number.NEGATIVE_INFINITY,
                bottom: Number.NEGATIVE_INFINITY,
              },
            );
            if (!Number.isFinite(bounds.left) || !Number.isFinite(bounds.top)) return node;

            const padding =
              typeof regionData.assistantAutoFitPadding === 'number'
                ? regionData.assistantAutoFitPadding
                : 48;
            return {
              ...node,
              position: { x: bounds.left - padding, y: bounds.top - padding },
              style: {
                ...node.style,
                width: Math.max(280, bounds.right - bounds.left + padding * 2),
                height: Math.max(220, bounds.bottom - bounds.top + padding * 2),
              },
              data: {
                ...regionData,
                assistantAutoFitPending: keepStreaming
                  ? regionData.assistantAutoFitPending
                  : false,
              },
            };
          });
        });
      };

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          window.setTimeout(fitPendingAssistantBackgrounds, 420);
        });
      });
    },
    [setNodes],
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
      // A library reference contains only an ID in the assistant message, but
      // executeAssistantCardPlacement resolves that ID to the complete local
      // setting. It must not go through the Agent skeleton/typing pipeline:
      // that pipeline would write the short reference's empty fields back over
      // the resolved data.
      if (options?.placeLibraryReferencesDirectly) {
        const placement = executeAssistantCardPlacement(cards, mode, options);
        if (!options.keepAssistantHeightStreaming) {
          finalizeAssistantStoryHeights(placement.nodeIds);
        }
        return placement;
      }

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

      if (!options?.keepAssistantHeightStreaming) {
        finalizeAssistantStoryHeights(placement.nodeIds);
      }

      return placement;
    },
    [
      allowAssistantImageGeneration,
      createAgentSkeletonCards,
      executeAssistantCardPlacement,
      finalizeAssistantStoryHeights,
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
    (nodeIds: string[] | undefined, cards: AssistantCardDraft[], completed = false) => {
      if (!nodeIds || nodeIds.length === 0 || cards.length === 0) return;
      const completionNonce = completed ? Date.now() : undefined;
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
                identity: card.identity || node.data.identity || '',
                appearance:
                  card.appearance || card.features || node.data.appearance || node.data.features || '',
                personality: card.personality || node.data.personality || '',
                habits: card.habits || node.data.habits || '',
                speechStyle: card.speechStyle || node.data.speechStyle || '',
                experience:
                  card.experience || card.background || node.data.experience || node.data.background || '',
                relationships: card.relationships || node.data.relationships || '',
                notes:
                  card.notes ||
                  card.other ||
                  card.traits ||
                  card.text ||
                  node.data.notes ||
                  node.data.other ||
                  '',
              },
            };
          }

          if (node.type === 'sceneNode' && type === 'scene') {
            return {
              ...node,
              data: {
                ...node.data,
                sceneName: card.sceneName || card.title || node.data.sceneName,
                location: card.location || node.data.location || '',
                time: card.time || node.data.time || '',
                weather: card.weather || node.data.weather || '',
                visual:
                  card.visual ||
                  card.description ||
                  card.text ||
                  node.data.visual ||
                  node.data.description ||
                  '',
                sound: card.sound || node.data.sound || '',
                items: card.items || node.data.items || '',
                notes:
                  card.notes ||
                  card.other ||
                  node.data.notes ||
                  node.data.other ||
                  node.data.atmosphere ||
                  '',
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
              // Keep the seven-line floor while text is streaming. Write the
              // completion state and its measuring nonce in this same update
              // so the final DOM content cannot miss the resize pass.
              assistantHeightState: completed ? 'settled' : 'streaming',
              ...(completed ? { assistantAutoHeightNonce: completionNonce } : {}),
              title: card.title || node.data.title,
              text: taggedStory.text,
              nodeValue: card.nodeValue,
              ...(taggedStory.presentation ? { presentation: taggedStory.presentation } : {}),
              ...sceneMedia,
            },
          };
        }),
      );

      if (completed) {
        window.requestAnimationFrame(() => finalizeAssistantStoryHeights(nodeIds));
      } else if (streamingHeightReflowTimerRef.current === null) {
        streamingHeightReflowTimerRef.current = window.setTimeout(() => {
          streamingHeightReflowTimerRef.current = null;
          finalizeAssistantStoryHeights(nodeIds, true);
        }, 100);
      }
    },
    [finalizeAssistantStoryHeights, getAgentDraftType, setNodes],
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
        zoom: target.position.zoom ?? getViewportZoom(),
        duration: 450,
      });
    },
    [fitView, getViewportZoom, nodes, setCenter, setNodes],
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

  const setAssistantNodesLocked = useCallback(
    (nodeIds: string[], locked: boolean) => {
      if (nodeIds.length === 0) return;
      const nodeIdSet = new Set(nodeIds);
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          nodeIdSet.has(node.id)
            ? {
                ...node,
                deletable: !locked,
                data: { ...node.data, locked },
              }
            : node,
        ),
      );
    },
    [setNodes],
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
    assistantInputContexts,
    setAssistantInputContexts,
    assistantLoading,
    assistantListening,
    assistantDocuments,
    assistantDocumentLoading,
    assistantArticleAnalysis,
    assistantTasks,
    setAssistantTasks,
    activeAssistantTaskId,
    setActiveAssistantTaskId,
    handleSelectAssistantTask,
    assistantMessages,
    assistantMessagesRef,
    handleNewAssistantTask,
    handleStartCardReview,
    handleRenameAssistantTask,
    handleRequestCloseAssistantTask,
    handleConfirmCloseAssistantTask,
    handleCancelCloseAssistantTask,
    assistantTaskPendingCloseId,
    handleAssistantSend,
    handleStopAssistantGeneration,
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
    setAssistantNodesLocked,
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
    settingLibraryContext,
    savedSettingLibraryItems,
    presetSettingLibraryItems,
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
    assistantInputContexts,
    setAssistantInputContexts,
    assistantLoading,
    assistantListening,
    assistantDocuments,
    assistantDocumentLoading,
    assistantArticleAnalysis,
    assistantTasks,
    setAssistantTasks,
    activeAssistantTaskId,
    setActiveAssistantTaskId,
    handleSelectAssistantTask,
    assistantMessages,
    assistantMessagesRef,
    handleNewAssistantTask,
    handleStartCardReview,
    handleRenameAssistantTask,
    handleRequestCloseAssistantTask,
    handleConfirmCloseAssistantTask,
    handleCancelCloseAssistantTask,
    assistantTaskPendingCloseId,
    handleAssistantSend,
    handleStopAssistantGeneration,
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
