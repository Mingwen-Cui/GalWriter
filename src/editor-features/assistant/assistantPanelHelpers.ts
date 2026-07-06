import type { Node } from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';

import type {
  AssistantCardDraft,
  AssistantCardPlacementMode,
} from '../../agent/planning/agentCardDraft';
import type { AssistantMessage, AssistantTask } from '../../editor-state/editorConfig';
import type { Language } from '../../lib/i18n';
import { htmlToSpeechText } from '../../lib/tts';
import { createArticleTeachingRoleTemplateCards } from './article-card-templates';

export type AssistantSpeechRecognitionResult = {
  transcript?: string;
};

export type AssistantSpeechRecognitionEvent = {
  results?: ArrayLike<ArrayLike<AssistantSpeechRecognitionResult>>;
};

export type AssistantSpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: AssistantSpeechRecognitionEvent) => void) | null;
  start: () => void;
};

export type AssistantSpeechRecognitionCtor = new () => AssistantSpeechRecognitionInstance;

export type AssistantHistorySnapshot = {
  tasks: AssistantTask[];
  activeTaskId: string;
  input: string;
};

export type AssistantWorkflowState =
  | { type: 'idle' }
  | { type: 'idea-awaiting' }
  | { type: 'starter-theme' }
  | { type: 'starter-style'; theme: string; style?: string; supplement?: string }
  | { type: 'starter-supplement'; theme: string; style: string }
  | { type: 'starter-generate'; theme: string; style: string; supplement?: string }
  | { type: 'revision-awaiting-opinion' }
  | { type: 'future-awaiting-count'; targetNodeId: string }
  | { type: 'future-generate-bridge'; targetNodeId: string; count: number }
  | { type: 'article-role-awaiting'; candidateNodeIds: string[] }
  | {
      type: 'article-role-selected';
      characterNodeId: string;
      characterName: string;
      templateInstruction?: string;
      templateTeachingMode?: 'interactive' | 'lecture';
      templateIsUserOwned?: boolean;
    }
  | {
      type: 'article-scene-custom-awaiting';
      characterNodeId: string;
      characterName: string;
    }
  | {
      type: 'article-scene-awaiting';
      characterNodeId: string;
      characterName: string;
      candidateNodeIds: string[];
    }
  | {
      type: 'article-ready-to-teach';
      characterNodeId: string;
      characterName: string;
      sceneNodeId?: string;
      sceneName?: string;
      useScene: boolean;
      templateInstruction?: string;
      templateTeachingMode?: 'interactive' | 'lecture';
      templateIsUserOwned?: boolean;
    }
  | {
      type: 'article-teach-generate';
      teachingMode: 'interactive' | 'lecture';
      characterNodeId?: string;
      characterName?: string;
      sceneNodeId?: string;
      sceneName?: string;
      useScene?: boolean;
      templateInstruction?: string;
      templateIsUserOwned?: boolean;
    };

export type AssistantArticleAnalysisStep = {
  title: string;
  status: 'pending' | 'active' | 'done' | 'error';
  detail: string;
  evidence?: string;
};

export type AssistantArticleAnalysisState = {
  status: 'idle' | 'reading' | 'analyzing' | 'ready' | 'error';
  summary: string;
  steps: AssistantArticleAnalysisStep[];
};

export type AssistantCardPlacementResult = {
  count: number;
  position?: { x: number; y: number; zoom?: number };
  nodeIds?: string[];
};

export const createAssistantWelcomeMessage = (language: Language): AssistantMessage => ({
  id: uuidv4(),
  role: 'assistant',
  content:
    language === 'zh'
      ? '你好，我可以帮你生成故事、整理设定和续写剧情。'
      : language === 'ja'
        ? 'こんにちは！ストーリーの生成、設定の整理、プロットの継続をお手伝いできます。'
        : 'Hello! I can help you generate stories, organize settings, and continue writing plots.',
});

export const createInitialAssistantTask = (language: Language): AssistantTask => {
  const now = Date.now();
  return {
    id: uuidv4(),
    title: language === 'zh' ? '对话 1' : language === 'ja' ? '対話 1' : 'Conversation 1',
    createdAt: now,
    updatedAt: now,
    messages: [createAssistantWelcomeMessage(language)],
  };
};

export const cloneAssistantTasks = (tasks: AssistantTask[]): AssistantTask[] =>
  tasks.map((task) => ({
    ...task,
    messages: task.messages.map((message) => ({ ...message })),
  }));

export type AssistantGeneratedOption = {
  label: string;
  description?: string;
};

export const ASSISTANT_VISUALIZE_OPTION_PREFIX = '__assistant_visualize__:';
export const LEGACY_ASSISTANT_VISUALIZE_OPTION_PREFIX = '__generate_visuals__:';

export const DEFAULT_ROOT_STORY_TEXT = '从前有座山';

export const createArticleRoleCandidateCards = (): AssistantCardDraft[] =>
  createArticleTeachingRoleTemplateCards();

export const createArticleSelfDrawRoleCard = (): AssistantCardDraft => ({
  type: 'character',
  characterName: '自绘教学角色',
  traits: '用户自绘或自行上传的教学角色。完成绘制后选中这张卡并确认。',
  personality: '由用户后续补充。',
  features: '请在人物卡中放入用户绘制或上传的角色图。',
  background: '作为本次文章教学 Galgame 的唯一出场人物。',
  other: '确认后会删除其他候选人物卡。',
  assistantTemplateId: 'user-self-draw-role',
  assistantTemplateName: '自绘教学角色',
  assistantTemplateInstruction:
    '使用用户自绘或自行上传的人物模板作为唯一教学角色。优先保留用户在人物卡中填写的性格、特征、背景和图片设定，并围绕这个角色生成教学剧情。',
  assistantTemplateTeachingMode: 'interactive',
  assistantTemplateIsUserOwned: true,
});

export const createArticleDefaultSceneCards = (): AssistantCardDraft[] => [
  {
    type: 'scene',
    sceneName: '安静教室',
    description: '适合章节讲解和课堂式提问的默认教学空间。',
    location: '明亮教室，前方有白板和讲台。',
    items: '白板、课桌、投影幕、笔记本。',
    atmosphere: '清楚、专注、适合系统化学习。',
    other: '候选场景，确认后会删除其他候选场景卡。',
  },
  {
    type: 'scene',
    sceneName: '书桌学习角',
    description: '适合一对一陪读和文章细读的默认教学空间。',
    location: '靠窗书桌旁，桌面摆着资料和水杯。',
    items: '台灯、资料夹、便签、打开的文章。',
    atmosphere: '安静、贴近读者、适合逐段拆解。',
    other: '候选场景，确认后会删除其他候选场景卡。',
  },
  {
    type: 'scene',
    sceneName: '资料室',
    description: '适合整理概念、证据和章节结构的默认教学空间。',
    location: '资料柜与长桌围成的学习区域。',
    items: '档案盒、索引卡、白板、文件夹。',
    atmosphere: '理性、有条理、适合分析型文章。',
    other: '候选场景，确认后会删除其他候选场景卡。',
  },
  {
    type: 'scene',
    sceneName: '白板前',
    description: '适合用图示、关键词和小结推进教学的默认教学空间。',
    location: '一面大白板前，旁边有简洁讲台。',
    items: '马克笔、板擦、流程图、章节标题。',
    atmosphere: '明快、聚焦、适合讲课式推进。',
    other: '候选场景，确认后会删除其他候选场景卡。',
  },
];

export const createArticleCustomSceneCards = (request: string): AssistantCardDraft[] => {
  const sceneRequest = request.trim() || '用户自定义教学场景';
  return ['A', 'B', 'C', 'D'].map((suffix) => ({
    type: 'scene',
    sceneName: `新场景 ${suffix}`,
    description: `根据用户描述创建的候选场景：${sceneRequest}`,
    location: `围绕“${sceneRequest}”设计的教学空间 ${suffix}。`,
    items: '可后续在场景卡中补充具体物品。',
    atmosphere: '贴合用户自定义方向，适合文章教学演出。',
    other: '候选场景，确认后会删除其他候选场景卡。',
  }));
};

export const createArticleRoleSelectionOptions = () => [
  { id: uuidv4(), label: '确认当前选中的人物卡', value: '__article_role_confirm__' },
  {
    id: uuidv4(),
    label: '使用当前选中的人物模板',
    value: '__article_role_use_selected_template__',
  },
  { id: uuidv4(), label: '添加自绘角色卡', value: '__article_role_self_draw__' },
];

export const createArticleSceneChoiceOptions = () => [
  { id: uuidv4(), label: '添加默认场景候选卡', value: '__article_scenes_create__:default' },
  { id: uuidv4(), label: '添加新场景候选卡', value: '__article_scenes_custom_prompt__' },
  { id: uuidv4(), label: '不添加场景，继续选择教学方式', value: '__article_scene_skip__' },
];

export const createArticleTeachingModeOptions = () => [
  { id: uuidv4(), label: '对话式教学', value: '__article_teach__:interactive' },
  { id: uuidv4(), label: '讲课式教学', value: '__article_teach__:lecture' },
];

export const markArticleCandidateCards = (
  cards: AssistantCardDraft[],
  kind: 'article-role' | 'article-scene',
  groupId = uuidv4(),
) =>
  cards.map((card) => ({
    ...card,
    assistantCandidateKind: kind,
    assistantCandidateGroupId: groupId,
  }));

export const normalizeAssistantPlainText = (value: unknown) =>
  htmlToSpeechText(String(value || ''))
    .replace(/\s+/g, '')
    .replace(/[.。…]+$/g, '');

export const extractFirstJsonObject = (value: string) => {
  const text = value
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();
  const start = text.indexOf('{');
  if (start < 0) return text;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }

  return text.slice(start);
};

export const isDefaultRootStoryNode = (node: Node) =>
  node.type === 'storyNode' &&
  node.id === 'root' &&
  String(node.data?.title || '') === '开头' &&
  normalizeAssistantPlainText(node.data?.text) === DEFAULT_ROOT_STORY_TEXT;

export const isNarrativeSceneRequest = (text: string) =>
  /(?:表白|告白|相遇|重逢|争吵|和好|离别|约会|亲吻|牵手|毕业|课堂|放学|雨天|天台|图书馆|校园|爱情|恋爱).{0,12}场景/.test(
    text,
  ) || /场景.{0,12}(?:片段|桥段|剧情|故事|正文|对话|表白|告白|爱情|恋爱)/.test(text);

export const shouldCreateStoryBundle = (text: string) => {
  const asksSpecificCardOnly =
    /只(?:要|生成|添加|创建|做)?(?:人物|角色|人设|场景设定|地点设定|场设|剧情)卡?/.test(text) ||
    /(?:只|仅|单独).{0,8}(?:人物|角色|人设|场景设定|地点设定|场设|剧情)/.test(text);
  if (asksSpecificCardOnly) return false;

  return (
    isNarrativeSceneRequest(text) ||
    /脑洞|完整故事|故事大纲|故事开端|短篇故事|剧情片段|桥段|开场|开篇|梗概|扩展成.*故事|生成.*故事|写.*故事|构思.*故事/i.test(
      text,
    )
  );
};

export const isGenericStoryIdeaRequest = (text: string) => {
  const normalized = text.toLowerCase().replace(/[\s,，.。!！?？;；:"“”'‘’、]/g, '');

  return (
    normalized === '我有一个新脑洞想让你帮我扩展成一个完整故事' ||
    normalized === '我有一个新脑洞想让你帮我扩展成完整故事' ||
    normalized === '我有一个脑洞想让你帮我扩展成一个完整故事' ||
    normalized === '我有一个脑洞想让你帮我扩展成完整故事' ||
    normalized === 'ihaveanewideahelpmeexpanditintoacompletestory' ||
    normalized === 'ihaveanewideahelpmeexpandintoacompletestory'
  );
};

export const normalizeAssistantStoryDraftText = (value: string) =>
  value
    .split(/\r?\n/)
    .map((line) => {
      let nextLine = line.trim();
      nextLine = nextLine.replace(/^[@＠]\s*/, '');
      const wrappedAction = nextLine.match(/^[（(]\s*([\s\S]*?)\s*[）)]$/);
      if (wrappedAction) nextLine = wrappedAction[1].trim();
      nextLine = nextLine.replace(
        /^([^：:\n]{1,36})\s*[：:]\s*[“"‘']?([\s\S]*?)[”"’']?$/,
        (_, speaker: string, speech: string) => `${speaker.trim()}${speech.trim()}`,
      );
      return nextLine.replace(/[“”‘']/g, '');
    })
    .filter((line) => line.length > 0)
    .join('\n');

export const getAssistantDraftType = (
  card: AssistantCardDraft,
): 'story' | 'character' | 'scene' | 'number-condition' => {
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
    cleanText(card.traits) ||
    cleanText(card.personality) ||
    cleanText(card.features) ||
    cleanText(card.background)
  ) {
    return 'character';
  }
  if (
    cleanText(card.sceneName) ||
    cleanText(card.description) ||
    cleanText(card.location) ||
    cleanText(card.items) ||
    cleanText(card.atmosphere)
  ) {
    return 'scene';
  }
  return 'story';
};

export const alignAssistantCardsToPlaceholders = (
  cards: AssistantCardDraft[],
  placeholders: AssistantCardDraft[],
) => {
  if (cards.length === 0 || placeholders.length === 0) return cards;

  const usedIndexes = new Set<number>();
  const alignedCards = placeholders
    .map((placeholder) => {
      const expectedType = getAssistantDraftType(placeholder);
      const matchingIndex = cards.findIndex(
        (card, index) => !usedIndexes.has(index) && getAssistantDraftType(card) === expectedType,
      );
      if (matchingIndex < 0) return null;
      usedIndexes.add(matchingIndex);
      return { ...cards[matchingIndex], type: expectedType };
    })
    .filter((card) => Boolean(card)) as AssistantCardDraft[];

  const remainingCards = cards.filter((_, index) => !usedIndexes.has(index));
  return [...alignedCards, ...remainingCards];
};

export type AssistantCardStreamEvent =
  | { type: 'reply_delta'; delta?: string }
  | { type: 'card_start'; index: number; card?: AssistantCardDraft }
  | { type: 'field_delta'; index: number; field: keyof AssistantCardDraft; delta?: string }
  | { type: 'field_set'; index: number; field: keyof AssistantCardDraft; value?: unknown }
  | { type: 'card_end'; index: number }
  | { type: 'done' };

export const assistantCardStreamProtocol = `Streaming card protocol:
For this streaming request, ignore any earlier instruction that asks for one complete JSON object.
Return ONLY newline-delimited JSON events, one JSON object per line. Do not wrap in Markdown.
Allowed events:
{"type":"reply_delta","delta":"visible assistant reply text"}
{"type":"card_start","index":0,"card":{"type":"story","key":"stable_key"}}
{"type":"field_delta","index":0,"field":"title","delta":"partial title"}
{"type":"field_delta","index":0,"field":"text","delta":"partial body"}
{"type":"field_set","index":0,"field":"connectTo","value":["next_key"]}
{"type":"field_set","index":0,"field":"branchTargets","value":[{"target":"ending_a","label":"Ending A"}]}
{"type":"card_end","index":0}
{"type":"done"}
Use card indexes starting at 0. For character cards stream characterName, traits, personality, features, background, other. For scene cards stream sceneName, description, location, items, atmosphere, other. For story cards stream title and text.`;

export const orderAssistantCardsForCreation = (cards: AssistantCardDraft[]) => {
  const priority = { character: 0, scene: 1, story: 2, 'number-condition': 3 } as const;
  return cards
    .map((card, index) => ({ card, index, type: getAssistantDraftType(card) }))
    .sort((left, right) => priority[left.type] - priority[right.type] || left.index - right.index)
    .map(({ card, type }) => ({ ...card, type }));
};

export const hasAssistantCardContent = (card: AssistantCardDraft) => {
  const type = getAssistantDraftType(card);
  if (type === 'character') {
    return [
      card.characterName,
      card.traits,
      card.personality,
      card.features,
      card.background,
      card.other,
      card.title,
      card.text,
    ].some((value) => typeof value === 'string' && value.trim().length > 0);
  }
  if (type === 'scene') {
    return [
      card.sceneName,
      card.description,
      card.location,
      card.items,
      card.atmosphere,
      card.other,
      card.title,
      card.text,
    ].some((value) => typeof value === 'string' && value.trim().length > 0);
  }
  if (type === 'number-condition') {
    return (
      typeof card.threshold === 'number' ||
      (Array.isArray(card.ranges) && card.ranges.length > 0) ||
      (typeof card.title === 'string' && card.title.trim().length > 0)
    );
  }
  return [card.title, card.text].some(
    (value) => typeof value === 'string' && value.trim().length > 0,
  );
};

export const parseAssistantGeneratedOptions = (content: string): AssistantGeneratedOption[] => {
  const normalized = content
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();
  const jsonText = extractFirstJsonObject(normalized);

  const parseJson = (value: string) => {
    const parsed = JSON.parse(value) as {
      options?: Array<{ label?: unknown; description?: unknown }>;
    };
    return (parsed.options || [])
      .map((option) => ({
        label: typeof option.label === 'string' ? option.label.trim() : '',
        description: typeof option.description === 'string' ? option.description.trim() : undefined,
      }))
      .filter((option) => option.label);
  };

  try {
    return parseJson(jsonText).slice(0, 3);
  } catch {
    try {
      return parseJson(jsonText.replace(/,\s*([}\]])/g, '$1')).slice(0, 3);
    } catch {
      const objectOptions = Array.from(jsonText.matchAll(/\{[^{}]*"label"\s*:[^{}]*\}/g))
        .map((match) => {
          const block = match[0];
          const label =
            block.match(/"label"\s*:\s*"([^"\r\n]*)/)?.[1]?.trim() ||
            block.match(/"label"\s*:\s*([^,\r\n}]+)/)?.[1]?.trim();
          const description =
            block.match(/"description"\s*:\s*"([\s\S]*?)"\s*(?:,|})/)?.[1]?.trim() ||
            block.match(/"description"\s*:\s*([^,\r\n}]+)/)?.[1]?.trim();
          return { label: label || '', description };
        })
        .filter((option) => option.label);

      if (objectOptions.length >= 3) return objectOptions.slice(0, 3);

      return normalized
        .split(/\r?\n/)
        .map((line) =>
          line
            .replace(/^\s*(?:[-*•]|\d+[.)、])\s*/, '')
            .replace(/^["']|["'],?$/g, '')
            .trim(),
        )
        .filter((line) => line.length > 1 && !/^(?:\{|\}|\[|\]|"options"|options|```)/i.test(line))
        .slice(0, 3)
        .map((line) => {
          const [label, ...descriptionParts] = line.split(/[：:]\s*/);
          return {
            label: label.trim(),
            description: descriptionParts.join('：').trim() || undefined,
          };
        });
    }
  }
};

export const parseAssistantRequestedCardCount = (text: string, fallback = 1) => {
  const arabicCount = text.match(/(\d+)/)?.[1];
  if (arabicCount) return Math.max(1, Math.min(16, Number(arabicCount) || fallback));

  const chineseNumbers: Record<string, number> = {
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
  };
  const chineseCount = text.match(/([一二两三四五六七八九十])\s*(?:张|寮犱|个|個)/)?.[1];
  return chineseCount ? chineseNumbers[chineseCount] || fallback : fallback;
};

export const buildAssistantPlaceholderCards = (
  text: string,
  forcedMode?: AssistantCardPlacementMode,
): AssistantCardDraft[] => {
  const fallbackCount = forcedMode === 'future-targets' ? 3 : 1;
  const count = parseAssistantRequestedCardCount(text, fallbackCount);
  const isFutureMode = forcedMode === 'future-targets' || forcedMode === 'bridge-to-target';
  if (isFutureMode) {
    return Array.from({ length: count }, () => ({ type: 'story' }));
  }

  if (shouldCreateStoryBundle(text)) {
    const storyCardCount = parseAssistantRequestedCardCount(text, 8);
    return [
      { type: 'character' },
      { type: 'scene' },
      ...Array.from({ length: storyCardCount }, () => ({ type: 'story' as const })),
    ];
  }

  const wantsCharacter = /人物|角色|人设|角色设定|character/i.test(text);
  const wantsScene = /场景|地点|场设|场景设定|scene|location/i.test(text);
  const wantsStory = /剧情|故事|后续|续写|分支|story|plot|continue/i.test(text);

  if (wantsCharacter && wantsScene) {
    const storyCount = wantsStory ? Math.max(1, Math.min(5, count)) : 0;
    return [
      { type: 'character' },
      { type: 'scene' },
      ...Array.from({ length: storyCount }, () => ({ type: 'story' as const })),
    ];
  }

  if (wantsCharacter) return Array.from({ length: count }, () => ({ type: 'character' }));
  if (wantsScene) return Array.from({ length: count }, () => ({ type: 'scene' }));

  return Array.from({ length: count }, () => ({ type: 'story' }));
};

export const inferAssistantMemoryNote = (text: string) => {
  const normalized = text.trim().replace(/\s+/g, ' ');
  if (normalized.length < 4) return '';

  const looksLikePreference =
    /(?:我|用户|以后|之后|请|希望|尽量|不要|少|多|更|偏好|习惯|喜欢|讨厌|prefer|avoid|more|less)/i.test(
      normalized,
    ) &&
    /(?:对话|动作|描写|剧情|卡片|风格|节奏|台词|对白|生成|写法|习惯|偏好|dialogue|action|style|card|plot)/i.test(
      normalized,
    );

  if (!looksLikePreference) return '';
  return normalized.slice(0, 180);
};

export const mergeAssistantMemoryNote = (notes: string[], note: string) => {
  const cleanNote = note.trim();
  if (!cleanNote) return notes;
  const deduped = notes.filter((item) => item.trim() && item.trim() !== cleanNote);
  return [cleanNote, ...deduped].slice(0, 24);
};
