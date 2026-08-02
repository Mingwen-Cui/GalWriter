import { v4 as uuidv4 } from 'uuid';

import type { AgentCardPlacementRequest, AgentPlan, AgentStep } from '../core/agentTypes';
import type { AssistantCardDraft } from './agentCardDraft';

const hasValue = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

const inferCardType = (card: AssistantCardDraft): 'story' | 'character' | 'scene' | 'number-condition' => {
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
    hasValue(card.characterName) ||
    hasValue(card.identity) ||
    hasValue(card.appearance) ||
    hasValue(card.personality) ||
    hasValue(card.habits) ||
    hasValue(card.speechStyle) ||
    hasValue(card.experience) ||
    hasValue(card.relationships) ||
    hasValue(card.notes)
  ) {
    return 'character';
  }
  if (
    hasValue(card.sceneName) ||
    hasValue(card.location) ||
    hasValue(card.time) ||
    hasValue(card.weather) ||
    hasValue(card.visual) ||
    hasValue(card.sound) ||
    hasValue(card.items) ||
    hasValue(card.atmosphere)
  ) {
    return 'scene';
  }
  return 'story';
};

const getTypingFields = (card: AssistantCardDraft): Array<[string, string, string]> => {
  const type = inferCardType(card);
  if (type === 'character') {
    return [
      ['character-name', '人物名', card.characterName || card.title],
      ['identity', '身份', card.identity],
      ['appearance', '外表', card.appearance],
      ['personality', '性格', card.personality],
      ['habits', '习惯', card.habits],
      ['speech-style', '说话', card.speechStyle],
      ['experience', '经历', card.experience],
      ['relationships', '关系', card.relationships],
      ['notes', '补充', card.notes || card.traits || card.text],
    ].filter((field): field is [string, string, string] => hasValue(field[2]));
  }

  if (type === 'scene') {
    return [
      ['scene-name', '场景名', card.sceneName || card.title],
      ['location', '位置'],
      ['time', '时间'],
      ['weather', '天气'],
      ['visual', '画面', card.visual || card.description || card.text],
      ['sound', '声音'],
      ['items', '物品'],
      ['notes', '补充', card.notes || card.other],
    ]
      .map(([fieldKey, label]) => [
        fieldKey,
        label,
        fieldKey === 'scene-name'
          ? card.sceneName
          : fieldKey === 'visual'
            ? card.visual || card.description || card.text
            : fieldKey === 'notes'
              ? card.notes || card.other
              : card[fieldKey as keyof AssistantCardDraft],
      ])
      .filter((field): field is [string, string, string] => hasValue(field[2]));
  }

  if (type === 'number-condition') {
    return [
      ['title', '数字判断', card.title],
      ['threshold', '阈值', String(card.threshold ?? '')],
      [
        'ranges',
        '范围分支',
        Array.isArray(card.ranges)
          ? card.ranges.map((range) => `${range.min}-${range.max}`).join(', ')
          : '',
      ],
    ].filter((field): field is [string, string, string] => hasValue(field[2]));
  }

  return [
    ['title', '标题', card.title],
    ['story-text', '正文', card.text],
  ].filter((field): field is [string, string, string] => hasValue(field[2]));
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

  const steps: AgentStep[] = [];

  if (isFill && request.selectedCount > 0) {
    steps.push(
      createStep({
        type: 'focus',
        label: `定位 ${request.selectedCount} 张选中的卡片`,
        durationMs: 0,
        cardIndex: 0,
      }),
    );
  }

  cards.forEach((card, index) => {
    const baseCursor = getCursorForStep(index);

    if (!isFill) {
      steps.push(
        createStep({
          type: 'create-card',
          label: '创建卡片',
          durationMs: 0,
          cursor: baseCursor,
          cardIndex: index,
        }),
      );
    } else {
      steps.push(
        createStep({
          type: 'focus',
          label: '打开可编辑区域',
          durationMs: 0,
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
          label: '连接剧情卡片',
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
    title: isFill ? 'AI Agent 正在填充卡片' : 'AI Agent 正在处理卡片',
    steps,
  };
};
