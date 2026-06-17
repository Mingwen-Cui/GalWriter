import { v4 as uuidv4 } from 'uuid';

import type { AgentCardPlacementRequest, AgentPlan, AgentStep } from '../core/agentTypes';
import type { AssistantCardDraft } from './agentCardDraft';

const inferCardType = (card: AssistantCardDraft): 'story' | 'character' | 'scene' => {
  if (card.type === 'character' || card.type === 'scene' || card.type === 'story') {
    return card.type;
  }
  if (
    hasValue(card.characterName) ||
    hasValue(card.personality) ||
    hasValue(card.features) ||
    hasValue(card.background)
  ) {
    return 'character';
  }
  if (
    hasValue(card.sceneName) ||
    hasValue(card.location) ||
    hasValue(card.items) ||
    hasValue(card.atmosphere)
  ) {
    return 'scene';
  }
  return 'story';
};

const getCardKindLabel = (card: AssistantCardDraft) => {
  const type = inferCardType(card);
  if (type === 'character') return '人物卡片';
  if (type === 'scene') return '场景卡片';
  return '剧情卡片';
};

const getCardTitle = (card: AssistantCardDraft, index: number) =>
  card.characterName ||
  card.sceneName ||
  card.title ||
    (inferCardType(card) === 'character'
    ? `人物 ${index + 1}`
    : inferCardType(card) === 'scene'
      ? `场景 ${index + 1}`
      : `剧情 ${index + 1}`);

const hasValue = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

const getTypingFields = (card: AssistantCardDraft) => {
  const type = inferCardType(card);
  if (type === 'character') {
    return [
      ['character-name', '人物名', card.characterName || card.title],
      ['traits', '综合设定', card.traits || card.text],
      ['personality', '性格', card.personality],
      ['features', '人物特点', card.features],
      ['background', '人物背景', card.background],
      ['other', '其他设定', card.other],
    ].filter(([, , value]) => hasValue(value));
  }

  if (type === 'scene') {
    return [
      ['scene-name', '场景名', card.sceneName || card.title],
      ['description', '综合描述', card.description || card.text],
      ['location', '位置', card.location],
      ['items', '物品', card.items],
      ['atmosphere', '氛围', card.atmosphere],
      ['other', '其他设定', card.other],
    ].filter(([, , value]) => hasValue(value));
  }

  return [
    ['title', '标题', card.title],
    ['story-text', '正文', card.text],
  ].filter(([, , value]) => hasValue(value));
};

const getCursorForStep = (index: number) => ({
  x: 120 + (index % 4) * 140,
  y: 150 + Math.floor(index / 4) * 92,
});

const createStep = (step: Omit<AgentStep, 'id'>): AgentStep => ({
  id: uuidv4(),
  ...step,
});

export const buildAgentCardPlacementPlan = (
  request: AgentCardPlacementRequest<AssistantCardDraft>,
): AgentPlan => {
  const cards = request.cards.filter(Boolean);
  const isFill = request.mode === 'fill-selected';
  const isFuture = request.mode === 'future-targets' || request.mode === 'bridge-to-target';
  const title =
    isFill && request.selectedCount > 0
      ? 'AI Agent 正在填充选中的卡片'
      : isFuture
        ? 'AI Agent 正在布置后续剧情'
        : 'AI Agent 正在创建卡片';

  const steps: AgentStep[] = [
    createStep({
      type: 'think',
      label: '分析用户请求与画布上下文',
      durationMs: 420,
      cursor: { x: 84, y: 92 },
    }),
  ];

  if (isFill && request.selectedCount > 0) {
    steps.push(
      createStep({
        type: 'focus',
        label: `定位 ${request.selectedCount} 张选中的卡片`,
        durationMs: 420,
        cursor: { x: 180, y: 180 },
      }),
    );
  } else {
    steps.push(
      createStep({
        type: 'move-pointer',
        label: '移动到新增卡片工具',
        durationMs: 460,
        cursor: { x: 72, y: 280 },
      }),
      createStep({
        type: 'click',
        label: '点击新增卡片',
        durationMs: 240,
        cursor: { x: 72, y: 280 },
      }),
    );
  }

  cards.forEach((card, index) => {
    const cardLabel = `${getCardKindLabel(card)}「${getCardTitle(card, index)}」`;
    const baseCursor = getCursorForStep(index);

    if (!isFill) {
      steps.push(
        createStep({
          type: 'create-card',
          label: `创建${cardLabel}`,
          durationMs: 360,
          cursor: baseCursor,
          cardIndex: index,
        }),
      );
    } else {
      steps.push(
        createStep({
          type: 'focus',
          label: `打开${cardLabel}的可编辑区域`,
          durationMs: 320,
          cursor: baseCursor,
          cardIndex: index,
        }),
      );
    }

    getTypingFields(card).forEach(([fieldKey, field], fieldIndex) => {
      steps.push(
        createStep({
          type: 'type-field',
          label: `填写${field}`,
          durationMs: fieldIndex === 0 ? 300 : 420,
          cardIndex: index,
          fieldKey,
          cursor: {
            x: baseCursor.x + 88,
            y: baseCursor.y + 42 + fieldIndex * 26,
          },
        }),
      );
    });

    if (isFuture && index > 0) {
      steps.push(
        createStep({
          type: 'connect',
          label: `连接第 ${index} 张与第 ${index + 1} 张剧情卡片`,
          durationMs: 320,
          cursor: {
            x: baseCursor.x - 36,
            y: baseCursor.y + 52,
          },
        }),
      );
    }
  });

  steps.push(
    createStep({
      type: 'arrange',
      label: isFuture ? '整理后续剧情布局' : '整理卡片位置',
      durationMs: 420,
      cursor: { x: 460, y: 320 },
    }),
    createStep({
      type: 'complete',
      label: 'Agent 操作完成',
      durationMs: 320,
      cursor: { x: 520, y: 360 },
    }),
  );

  return {
    id: uuidv4(),
    title,
    steps,
  };
};
