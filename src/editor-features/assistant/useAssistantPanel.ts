import type { Node } from '@xyflow/react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import type { AITextResult, AITextStreamHandlers } from '../../editor-services/aiClient';
import type {
  AssistantCardDraft,
  AssistantCardPlacementMode,
  AssistantCardPlacementOptions,
} from '../../agent/planning/agentCardDraft';
import {
  buildAssistantDocumentContext,
  readAssistantDocument,
  type AssistantDocument,
} from '../../lib/documentReader';
import { formatCharacterNodeText, formatSceneNodeText } from '../../lib/export';
import { htmlToSpeechText } from '../../lib/tts';
import type { AssistantMessage, AssistantTask } from '../../editor-state/editorConfig';
import type { Language } from '../../lib/i18n';

type AssistantSpeechRecognitionResult = {
  transcript?: string;
};

type AssistantSpeechRecognitionEvent = {
  results?: ArrayLike<ArrayLike<AssistantSpeechRecognitionResult>>;
};

type AssistantSpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: AssistantSpeechRecognitionEvent) => void) | null;
  start: () => void;
};

type AssistantSpeechRecognitionCtor = new () => AssistantSpeechRecognitionInstance;

type AssistantHistorySnapshot = {
  tasks: AssistantTask[];
  activeTaskId: string;
  input: string;
};

type AssistantWorkflowState =
  | { type: 'idle' }
  | { type: 'idea-awaiting' }
  | { type: 'starter-theme' }
  | { type: 'starter-style'; theme: string; style?: string; supplement?: string }
  | { type: 'starter-supplement'; theme: string; style: string }
  | { type: 'starter-generate'; theme: string; style: string; supplement?: string }
  | { type: 'revision-awaiting-opinion' }
  | { type: 'future-awaiting-count'; targetNodeId: string }
  | { type: 'future-generate-bridge'; targetNodeId: string; count: number };

export type AssistantCardPlacementResult = {
  count: number;
  position?: { x: number; y: number; zoom?: number };
  nodeIds?: string[];
};

const createAssistantWelcomeMessage = (language: Language): AssistantMessage => ({
  id: uuidv4(),
  role: 'assistant',
  content:
    language === 'zh'
      ? '你好，我可以帮你生成故事、整理设定和续写剧情。'
      : language === 'ja'
        ? 'こんにちは！ストーリーの生成、設定の整理、プロットの継続をお手伝いできます。'
        : 'Hello! I can help you generate stories, organize settings, and continue writing plots.',
});

const createInitialAssistantTask = (language: Language): AssistantTask => {
  const now = Date.now();
  return {
    id: uuidv4(),
    title: language === 'zh' ? '对话 1' : language === 'ja' ? '対話 1' : 'Conversation 1',
    createdAt: now,
    updatedAt: now,
    messages: [createAssistantWelcomeMessage(language)],
  };
};

const cloneAssistantTasks = (tasks: AssistantTask[]): AssistantTask[] =>
  tasks.map((task) => ({
    ...task,
    messages: task.messages.map((message) => ({ ...message })),
  }));

type AssistantGeneratedOption = {
  label: string;
  description?: string;
};

const ASSISTANT_VISUALIZE_OPTION_PREFIX = '__assistant_visualize__:';

const DEFAULT_ROOT_STORY_TEXT = '从前有座山';

const normalizeAssistantPlainText = (value: unknown) =>
  htmlToSpeechText(String(value || ''))
    .replace(/\s+/g, '')
    .replace(/[.。…]+$/g, '');

const isDefaultRootStoryNode = (node: Node) =>
  node.type === 'storyNode' &&
  node.id === 'root' &&
  String(node.data?.title || '') === '开头' &&
  normalizeAssistantPlainText(node.data?.text) === DEFAULT_ROOT_STORY_TEXT;

const isNarrativeSceneRequest = (text: string) =>
  /(?:表白|告白|相遇|重逢|争吵|和好|离别|约会|亲吻|牵手|毕业|课堂|放学|雨天|天台|图书馆|校园|爱情|恋爱).{0,12}场景/.test(
    text,
  ) || /场景.{0,12}(?:片段|桥段|剧情|故事|正文|对话|表白|告白|爱情|恋爱)/.test(text);

const shouldCreateStoryBundle = (text: string) => {
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

const isGenericStoryIdeaRequest = (text: string) => {
  const normalized = text
    .toLowerCase()
    .replace(/[\s,，.。!！?？;；:"“”'‘’、]/g, '');

  return (
    normalized === '我有一个新脑洞想让你帮我扩展成一个完整故事' ||
    normalized === '我有一个新脑洞想让你帮我扩展成完整故事' ||
    normalized === '我有一个脑洞想让你帮我扩展成一个完整故事' ||
    normalized === '我有一个脑洞想让你帮我扩展成完整故事' ||
    normalized === 'ihaveanewideahelpmeexpanditintoacompletestory' ||
    normalized === 'ihaveanewideahelpmeexpandintoacompletestory'
  );
};

const normalizeAssistantStoryDraftText = (value: string) =>
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

const getAssistantDraftType = (
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

const alignAssistantCardsToPlaceholders = (
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

type AssistantCardStreamEvent =
  | { type: 'reply_delta'; delta?: string }
  | { type: 'card_start'; index: number; card?: AssistantCardDraft }
  | { type: 'field_delta'; index: number; field: keyof AssistantCardDraft; delta?: string }
  | { type: 'field_set'; index: number; field: keyof AssistantCardDraft; value?: unknown }
  | { type: 'card_end'; index: number }
  | { type: 'done' };

const assistantCardStreamProtocol = `Streaming card protocol:
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

const orderAssistantCardsForCreation = (cards: AssistantCardDraft[]) => {
  const priority = { character: 0, scene: 1, story: 2, 'number-condition': 3 } as const;
  return cards
    .map((card, index) => ({ card, index, type: getAssistantDraftType(card) }))
    .sort((left, right) => priority[left.type] - priority[right.type] || left.index - right.index)
    .map(({ card, type }) => ({ ...card, type }));
};

const hasAssistantCardContent = (card: AssistantCardDraft) => {
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

const parseAssistantGeneratedOptions = (content: string): AssistantGeneratedOption[] => {
  const normalized = content
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();
  const jsonText = normalized.match(/\{[\s\S]*\}/)?.[0] || normalized;

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

const parseAssistantRequestedCardCount = (text: string, fallback = 1) => {
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

const buildAssistantPlaceholderCards = (
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

const inferAssistantMemoryNote = (text: string) => {
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

const mergeAssistantMemoryNote = (notes: string[], note: string) => {
  const cleanNote = note.trim();
  if (!cleanNote) return notes;
  const deduped = notes.filter((item) => item.trim() && item.trim() !== cleanNote);
  return [cleanNote, ...deduped].slice(0, 24);
};

interface UseAssistantPanelParams {
  language: Language;
  isMobile: boolean;
  flowWidth: number;
  selectedAssistantTargetNodes: Node[];
  nodes: Node[];
  callAIForTextResult: (prompt: string) => Promise<AITextResult>;
  callAIForTextStream?: (
    prompt: string,
    handlers?: AITextStreamHandlers,
  ) => Promise<AITextResult>;
  createAssistantCards: (
    cards: AssistantCardDraft[],
    mode?: AssistantCardPlacementMode,
    options?: AssistantCardPlacementOptions,
  ) => Promise<AssistantCardPlacementResult>;
  updateStreamingAssistantCards?: (nodeIds: string[] | undefined, cards: AssistantCardDraft[]) => void;
  onGenerateAssistantImagesRequest?: (nodeIds: string[]) => Promise<void>;
  startAgentWaiting?: (title: string, label: string, nodeIds?: string[]) => void;
  stopAgentWaiting?: () => void;
  hasTextApiKey: boolean;
  onMissingTextApiKeyRequest?: () => void;
  assistantMemorySkillEnabled: boolean;
  assistantMemoryNotes: string[];
  setAssistantMemoryNotes: Dispatch<SetStateAction<string[]>>;
}

interface UseAssistantPanelResult {
  assistantOpen: boolean;
  setAssistantOpen: Dispatch<SetStateAction<boolean>>;
  assistantPanelWidth: number;
  assistantResizing: boolean;
  assistantInput: string;
  setAssistantInput: Dispatch<SetStateAction<string>>;
  assistantLoading: boolean;
  assistantListening: boolean;
  assistantDocuments: AssistantDocument[];
  assistantDocumentLoading: boolean;
  assistantTasks: AssistantTask[];
  setAssistantTasks: Dispatch<SetStateAction<AssistantTask[]>>;
  activeAssistantTaskId: string;
  setActiveAssistantTaskId: Dispatch<SetStateAction<string>>;
  assistantMessages: AssistantMessage[];
  assistantMessagesRef: MutableRefObject<HTMLDivElement | null>;
  handleNewAssistantTask: () => void;
  handleRenameAssistantTask: (taskId: string, title: string) => void;
  handleRequestCloseAssistantTask: (taskId: string) => void;
  handleConfirmCloseAssistantTask: () => void;
  handleCancelCloseAssistantTask: () => void;
  assistantTaskPendingCloseId: string | null;
  handleAssistantSend: (overrideText?: string) => Promise<void>;
  handleAssistantOptionSelect: (value: string) => Promise<void>;
  handleStartAssistantFlow: (flow: 'idea' | 'starter' | 'revision' | 'future') => Promise<void>;
  handleAssistantDocumentUpload: (files: FileList | null) => Promise<void>;
  handleRemoveAssistantDocument: (documentId: string) => void;
  handleAssistantVoiceInput: () => void;
  toggleAssistantThought: (messageId: string) => void;
  handleAssistantResizePointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleAssistantResizePointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleAssistantResizePointerUp: () => void;
  handleAssistantUndo: () => void;
  handleAssistantRedo: () => void;
  canAssistantUndo: boolean;
  canAssistantRedo: boolean;
  resetAssistantTasks: (tasks?: AssistantTask[], activeTaskId?: string | null) => void;
}

export const useAssistantPanel = ({
  language,
  isMobile,
  flowWidth,
  selectedAssistantTargetNodes,
  nodes,
  callAIForTextResult,
  callAIForTextStream,
  createAssistantCards,
  updateStreamingAssistantCards,
  onGenerateAssistantImagesRequest,
  startAgentWaiting,
  stopAgentWaiting,
  hasTextApiKey,
  onMissingTextApiKeyRequest,
  assistantMemorySkillEnabled,
  assistantMemoryNotes,
  setAssistantMemoryNotes,
}: UseAssistantPanelParams): UseAssistantPanelResult => {
  const [assistantOpen, setAssistantOpen] = useState(!isMobile);
  const [assistantWidth, setAssistantWidth] = useState(360);
  const [assistantResizing, setAssistantResizing] = useState(false);
  const assistantResizeRef = useRef<{
    startX: number;
    startWidth: number;
    dragged: boolean;
  } | null>(null);
  const [assistantInput, setAssistantInput] = useState('');
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantListening, setAssistantListening] = useState(false);
  const [assistantDocuments, setAssistantDocuments] = useState<AssistantDocument[]>([]);
  const [assistantDocumentLoading, setAssistantDocumentLoading] = useState(false);
  const initialAssistantTaskRef = useRef(createInitialAssistantTask(language));
  const [activeAssistantTaskId, setActiveAssistantTaskId] = useState(
    initialAssistantTaskRef.current.id,
  );
  const [assistantTasks, setAssistantTasks] = useState<AssistantTask[]>(() => [
    initialAssistantTaskRef.current,
  ]);
  const [assistantTaskPendingCloseId, setAssistantTaskPendingCloseId] = useState<string | null>(
    null,
  );
  const assistantMessagesRef = useRef<HTMLDivElement>(null);
  const assistantThoughtTimerRef = useRef<number | null>(null);
  const assistantTasksRef = useRef<AssistantTask[]>([]);
  const activeAssistantTaskIdRef = useRef(activeAssistantTaskId);
  const assistantInputRef = useRef(assistantInput);
  const assistantHistoryPastRef = useRef<AssistantHistorySnapshot[]>([]);
  const assistantHistoryFutureRef = useRef<AssistantHistorySnapshot[]>([]);
  const assistantWorkflowRef = useRef<AssistantWorkflowState>({ type: 'idle' });
  const assistantVisualizationRequestsRef = useRef(new Map<string, string[]>());
  const [assistantHistoryVersion, setAssistantHistoryVersion] = useState(0);

  const assistantPanelWidth = Math.min(
    Math.max(assistantWidth, 300),
    Math.min(560, Math.max(320, flowWidth - 180)),
  );

  const activeAssistantTask = useMemo(
    () => assistantTasks.find((task) => task.id === activeAssistantTaskId) || assistantTasks[0],
    [assistantTasks, activeAssistantTaskId],
  );
  const assistantMessages = activeAssistantTask?.messages || [];

  useEffect(() => {
    assistantTasksRef.current = assistantTasks;
  }, [assistantTasks]);

  useEffect(() => {
    activeAssistantTaskIdRef.current = activeAssistantTaskId;
  }, [activeAssistantTaskId]);

  useEffect(() => {
    assistantInputRef.current = assistantInput;
  }, [assistantInput]);

  const createAssistantHistorySnapshot = useCallback(
    (): AssistantHistorySnapshot => ({
      tasks: cloneAssistantTasks(assistantTasksRef.current),
      activeTaskId: activeAssistantTaskIdRef.current,
      input: assistantInputRef.current,
    }),
    [],
  );

  const restoreAssistantHistorySnapshot = useCallback((snapshot: AssistantHistorySnapshot) => {
    if (assistantThoughtTimerRef.current !== null) {
      window.clearInterval(assistantThoughtTimerRef.current);
      assistantThoughtTimerRef.current = null;
    }

    const restoredTasks = cloneAssistantTasks(snapshot.tasks);
    assistantTasksRef.current = restoredTasks;
    activeAssistantTaskIdRef.current = snapshot.activeTaskId;
    assistantInputRef.current = snapshot.input;
    setAssistantTasks(restoredTasks);
    setActiveAssistantTaskId(snapshot.activeTaskId);
    setAssistantInput(snapshot.input);
    setAssistantLoading(false);
  }, []);

  const pushAssistantHistory = useCallback(() => {
    assistantHistoryPastRef.current = [
      ...assistantHistoryPastRef.current.slice(-39),
      createAssistantHistorySnapshot(),
    ];
    assistantHistoryFutureRef.current = [];
    setAssistantHistoryVersion((version) => version + 1);
  }, [createAssistantHistorySnapshot]);

  const handleAssistantUndo = useCallback(() => {
    if (assistantLoading || assistantHistoryPastRef.current.length === 0) return;

    const previous = assistantHistoryPastRef.current[assistantHistoryPastRef.current.length - 1];
    assistantHistoryPastRef.current = assistantHistoryPastRef.current.slice(0, -1);
    assistantHistoryFutureRef.current = [
      createAssistantHistorySnapshot(),
      ...assistantHistoryFutureRef.current,
    ].slice(0, 40);
    restoreAssistantHistorySnapshot(previous);
    setAssistantHistoryVersion((version) => version + 1);
  }, [assistantLoading, createAssistantHistorySnapshot, restoreAssistantHistorySnapshot]);

  const handleAssistantRedo = useCallback(() => {
    if (assistantLoading || assistantHistoryFutureRef.current.length === 0) return;

    const next = assistantHistoryFutureRef.current[0];
    assistantHistoryFutureRef.current = assistantHistoryFutureRef.current.slice(1);
    assistantHistoryPastRef.current = [
      ...assistantHistoryPastRef.current.slice(-39),
      createAssistantHistorySnapshot(),
    ];
    restoreAssistantHistorySnapshot(next);
    setAssistantHistoryVersion((version) => version + 1);
  }, [assistantLoading, createAssistantHistorySnapshot, restoreAssistantHistorySnapshot]);

  const canAssistantUndo =
    assistantHistoryVersion >= 0 && assistantHistoryPastRef.current.length > 0;
  const canAssistantRedo =
    assistantHistoryVersion >= 0 && assistantHistoryFutureRef.current.length > 0;

  const setAssistantMessages = useCallback(
    (updater: SetStateAction<AssistantMessage[]>) => {
      setAssistantTasks((tasks) =>
        tasks.map((task) => {
          if (task.id !== activeAssistantTaskId) return task;
          const nextMessages =
            typeof updater === 'function'
              ? (updater as (messages: AssistantMessage[]) => AssistantMessage[])(task.messages)
              : updater;
          const firstUserMessage = nextMessages
            .find((message) => message.role === 'user')
            ?.content.trim();
          const nextTitle = firstUserMessage ? firstUserMessage.slice(0, 18) : task.title;
          return {
            ...task,
            title: nextTitle,
            updatedAt: Date.now(),
            messages: nextMessages,
          };
        }),
      );
    },
    [activeAssistantTaskId],
  );

  const handleNewAssistantTask = useCallback(() => {
    if (assistantThoughtTimerRef.current !== null) {
      window.clearInterval(assistantThoughtTimerRef.current);
      assistantThoughtTimerRef.current = null;
    }

    const id = uuidv4();
    const now = Date.now();
    setAssistantTasks((tasks) => [
      {
        id,
        title:
          language === 'zh'
            ? `对话 ${tasks.length + 1}`
            : language === 'ja'
              ? `対話 ${tasks.length + 1}`
              : `Conversation ${tasks.length + 1}`,
        createdAt: now,
        updatedAt: now,
        messages: [createAssistantWelcomeMessage(language)],
      },
      ...tasks,
    ]);
    setActiveAssistantTaskId(id);
    setAssistantInput('');
    assistantHistoryPastRef.current = [];
    assistantHistoryFutureRef.current = [];
    setAssistantHistoryVersion((version) => version + 1);
  }, [language]);

  const resetAssistantTasks = useCallback(
    (tasks?: AssistantTask[], activeTaskId?: string | null) => {
      if (assistantThoughtTimerRef.current !== null) {
        window.clearInterval(assistantThoughtTimerRef.current);
        assistantThoughtTimerRef.current = null;
      }

      const nextTasks = tasks && tasks.length > 0 ? tasks : [createInitialAssistantTask(language)];
      const nextActiveTaskId =
        activeTaskId && nextTasks.some((task) => task.id === activeTaskId)
          ? activeTaskId
          : nextTasks[0].id;

      setAssistantTasks(nextTasks);
      setActiveAssistantTaskId(nextActiveTaskId);
      setAssistantInput('');
      assistantHistoryPastRef.current = [];
      assistantHistoryFutureRef.current = [];
      setAssistantHistoryVersion((version) => version + 1);
      setAssistantLoading(false);
      setAssistantListening(false);
      setAssistantDocuments((documents) => {
        documents.forEach((document) => URL.revokeObjectURL(document.objectUrl));
        return [];
      });
    },
    [language],
  );

  const handleAssistantDocumentUpload = useCallback(
    async (files: FileList | null) => {
      const selectedFiles = Array.from(files || []);
      if (selectedFiles.length === 0) return;

      setAssistantDocumentLoading(true);
      try {
        const documents = await Promise.all(
          selectedFiles.map((file) => readAssistantDocument(file)),
        );
        setAssistantDocuments((currentDocuments) => {
          const documentMap = new Map(currentDocuments.map((document) => [document.id, document]));
          documents.forEach((document) => documentMap.set(document.id, document));
          return Array.from(documentMap.values()).slice(-5);
        });
        setAssistantMessages((messages) => [
          ...messages,
          {
            id: uuidv4(),
            role: 'assistant',
            content:
              language === 'zh'
                ? `已读取 ${documents.length} 个参考文档。接下来我会结合这些文档内容来回答和生成剧情。`
                : language === 'ja'
                  ? `${documents.length}個の参照ドキュメントを読み込みました。今後のストーリー生成のコンテキストとして使用します。`
                  : `Read ${documents.length} reference document(s). I will use them as context for the next story requests.`,
          },
        ]);
      } catch (error: any) {
        setAssistantMessages((messages) => [
          ...messages,
          {
            id: uuidv4(),
            role: 'assistant',
            content:
              language === 'zh'
                ? `文档读取失败：${error.message || '请确认文件是可复制文字的 PDF 或 DOCX。'}`
                : language === 'ja'
                  ? `ドキュメントの読み込みに失敗しました：${error.message || 'テキストコピー可能なPDFまたはDOCXファイルを使用してください。'}`
                  : `Document reading failed: ${error.message || 'Please use a text-based PDF or DOCX file.'}`,
          },
        ]);
      } finally {
        setAssistantDocumentLoading(false);
      }
    },
    [language, setAssistantMessages],
  );

  const handleRemoveAssistantDocument = useCallback((documentId: string) => {
    setAssistantDocuments((documents) => {
      const documentToRemove = documents.find((document) => document.id === documentId);
      if (documentToRemove) URL.revokeObjectURL(documentToRemove.objectUrl);
      return documents.filter((document) => document.id !== documentId);
    });
  }, []);

  const handleRenameAssistantTask = useCallback((taskId: string, title: string) => {
    const nextTitle = title.trim();
    if (!nextTitle) return;

    setAssistantTasks((tasks) =>
      tasks.map((task) =>
        task.id === taskId
          ? { ...task, title: nextTitle.slice(0, 36), updatedAt: Date.now() }
          : task,
      ),
    );
  }, []);

  const closeAssistantTask = useCallback(
    (taskId: string) => {
      if (assistantThoughtTimerRef.current !== null && taskId === activeAssistantTaskId) {
        window.clearInterval(assistantThoughtTimerRef.current);
        assistantThoughtTimerRef.current = null;
      }

      setAssistantTasks((tasks) => {
        if (tasks.length <= 1) {
          const id = uuidv4();
          const now = Date.now();
          setActiveAssistantTaskId(id);
          return [
            {
              id,
              title: language === 'zh' ? '对话 1' : language === 'ja' ? '対話 1' : 'Conversation 1',
              createdAt: now,
              updatedAt: now,
              messages: [createAssistantWelcomeMessage(language)],
            },
          ];
        }

        const taskIndex = tasks.findIndex((item) => item.id === taskId);
        const nextTasks = tasks.filter((item) => item.id !== taskId);
        if (taskId === activeAssistantTaskId) {
          const nextActiveTask = nextTasks[Math.min(Math.max(taskIndex, 0), nextTasks.length - 1)];
          setActiveAssistantTaskId(nextActiveTask.id);
        }
        return nextTasks;
      });
    },
    [activeAssistantTaskId, language],
  );

  const handleRequestCloseAssistantTask = useCallback((taskId: string) => {
    setAssistantTaskPendingCloseId(taskId);
  }, []);

  const handleConfirmCloseAssistantTask = useCallback(() => {
    if (!assistantTaskPendingCloseId) return;
    closeAssistantTask(assistantTaskPendingCloseId);
    setAssistantTaskPendingCloseId(null);
  }, [assistantTaskPendingCloseId, closeAssistantTask]);

  const handleCancelCloseAssistantTask = useCallback(() => {
    setAssistantTaskPendingCloseId(null);
  }, []);

  const playAssistantThought = useCallback(
    (reasoning?: string) => {
      const text = (reasoning || '').trim();
      if (!text) return Promise.resolve();

      if (assistantThoughtTimerRef.current !== null) {
        window.clearInterval(assistantThoughtTimerRef.current);
        assistantThoughtTimerRef.current = null;
      }

      const thoughtId = uuidv4();
      setAssistantMessages((messages) => [
        ...messages,
        { id: thoughtId, role: 'thought', content: '', collapsed: false },
      ]);

      return new Promise<void>((resolve) => {
        let index = 0;
        assistantThoughtTimerRef.current = window.setInterval(() => {
          index += 1;
          const nextContent = text.slice(0, index);
          setAssistantMessages((messages) =>
            messages.map((message) =>
              message.id === thoughtId
                ? { ...message, content: nextContent, collapsed: false }
                : message,
            ),
          );

          if (index >= text.length) {
            if (assistantThoughtTimerRef.current !== null) {
              window.clearInterval(assistantThoughtTimerRef.current);
              assistantThoughtTimerRef.current = null;
            }
            window.setTimeout(() => {
              setAssistantMessages((messages) =>
                messages.map((message) =>
                  message.id === thoughtId ? { ...message, collapsed: true } : message,
                ),
              );
              resolve();
            }, 500);
          }
        }, 18);
      });
    },
    [setAssistantMessages],
  );

  const toggleAssistantThought = useCallback(
    (messageId: string) => {
      setAssistantMessages((messages) =>
        messages.map((message) =>
          message.id === messageId ? { ...message, collapsed: !message.collapsed } : message,
        ),
      );
    },
    [setAssistantMessages],
  );

  const runStructuredCardStream = useCallback(
    async ({
      prompt,
      userText,
      mode,
      placementOptions,
    }: {
      prompt: string;
      userText: string;
      mode: AssistantCardPlacementMode;
      placementOptions?: AssistantCardPlacementOptions;
    }): Promise<{ reply: string; cards: AssistantCardDraft[]; placement: AssistantCardPlacementResult }> => {
      if (!callAIForTextStream || !updateStreamingAssistantCards) {
        throw new Error('Streaming card generation is not available.');
      }

      const placeholderCards = buildAssistantPlaceholderCards(userText, mode).slice(0, 12);
      if (placeholderCards.length === 0) {
        throw new Error('No placeholder cards available for streaming.');
      }

      const placement = await createAssistantCards(placeholderCards, mode, placementOptions);
      const nodeIds = placement.nodeIds || [];
      if (nodeIds.length === 0) {
        throw new Error('Failed to create streaming placeholder cards.');
      }

      startAgentWaiting?.(
        'AI Agent is streaming cards',
        'Cards are ready; receiving live API content',
        nodeIds,
      );

      const cards = placeholderCards.map((card) => ({ ...card }));
      let reply = '';
      let lineBuffer = '';

      const coerceEvent = (line: string): AssistantCardStreamEvent | null => {
        try {
          const parsed = JSON.parse(line) as AssistantCardStreamEvent;
          return parsed && typeof parsed.type === 'string' ? parsed : null;
        } catch {
          return null;
        }
      };

      const applyEvent = (event: AssistantCardStreamEvent) => {
        if (event.type === 'reply_delta') {
          reply += event.delta || '';
          return;
        }
        if (event.type === 'done' || event.type === 'card_end') return;

        const index = Number(event.index);
        if (!Number.isInteger(index) || index < 0 || index >= cards.length) return;

        if (event.type === 'card_start') {
          cards[index] = { ...cards[index], ...(event.card || {}) };
          updateStreamingAssistantCards(nodeIds, cards);
          return;
        }

        const field = event.field;
        if (!field) return;
        if (event.type === 'field_delta') {
          const previous = cards[index][field];
          const previousText = typeof previous === 'string' ? previous : '';
          cards[index] = {
            ...cards[index],
            [field]: `${previousText}${event.delta || ''}`,
          };
        } else if (event.type === 'field_set') {
          cards[index] = {
            ...cards[index],
            [field]: event.value,
          };
        }
        updateStreamingAssistantCards(nodeIds, cards);
      };

      const consumeText = (text: string) => {
        lineBuffer += text;
        const lines = lineBuffer.split(/\r?\n/);
        lineBuffer = lines.pop() || '';
        lines.map((line) => line.trim()).filter(Boolean).forEach((line) => {
          const event = coerceEvent(line);
          if (event) applyEvent(event);
        });
      };

      const placeholderPlan = placeholderCards
        .map((card, index) => `${index}: ${getAssistantDraftType(card)}`)
        .join(', ');
      const streamPrompt = `${prompt}

${assistantCardStreamProtocol}
You must fill every placeholder card index exactly once. Placeholder card plan: ${placeholderPlan}. Keep each card's type aligned with the placeholder type for that same index.`;
      const result = await callAIForTextStream(streamPrompt, {
        onDelta: consumeText,
        onReasoningDelta: (delta) => {
          if (!delta.trim()) return;
          setAssistantMessages((messages) => {
            const last = messages[messages.length - 1];
            if (last?.role === 'thought' && !last.collapsed) {
              return messages.map((message) =>
                message.id === last.id
                  ? { ...message, content: `${message.content}${delta}` }
                  : message,
              );
            }
            return [...messages, { id: uuidv4(), role: 'thought', content: delta, collapsed: false }];
          });
        },
      });
      if (lineBuffer.trim()) {
        const event = coerceEvent(lineBuffer.trim());
        if (event) applyEvent(event);
      }

      const hasIncompleteStreamedCards = cards.some((card) => !hasAssistantCardContent(card));
      if (hasIncompleteStreamedCards) {
        try {
          const jsonText = result.content.match(/\{[\s\S]*\}/)?.[0] || result.content;
          const parsed = JSON.parse(jsonText) as {
            reply?: string;
            cards?: AssistantCardDraft[];
          };
          if (Array.isArray(parsed.cards) && parsed.cards.length > 0) {
            const alignedParsedCards = alignAssistantCardsToPlaceholders(
              parsed.cards,
              placeholderCards,
            );
            alignedParsedCards.slice(0, cards.length).forEach((card, index) => {
              cards[index] = { ...cards[index], ...card };
            });
            updateStreamingAssistantCards(nodeIds, cards);
          }
          if (parsed.reply) reply = parsed.reply;
        } catch {
          // The stream was not valid fallback JSON either; keep whatever partial state exists.
        }
      }

      if (cards.some((card) => !hasAssistantCardContent(card))) {
        try {
          const retryResult = await callAIForTextResult(`${prompt}

The previous streaming response did not complete every placeholder card. Return one normal JSON object only, with cards for this exact placeholder plan: ${placeholderPlan}.`);
          const jsonText = retryResult.content.match(/\{[\s\S]*\}/)?.[0] || retryResult.content;
          const parsed = JSON.parse(jsonText) as {
            reply?: string;
            cards?: AssistantCardDraft[];
          };
          if (Array.isArray(parsed.cards) && parsed.cards.length > 0) {
            const alignedParsedCards = alignAssistantCardsToPlaceholders(
              parsed.cards,
              placeholderCards,
            );
            alignedParsedCards.slice(0, cards.length).forEach((card, index) => {
              if (!hasAssistantCardContent(cards[index])) {
                cards[index] = { ...cards[index], ...card };
              }
            });
            updateStreamingAssistantCards(nodeIds, cards);
          }
          if (!reply.trim() && parsed.reply) reply = parsed.reply;
        } catch {
          // Keep the visible partial result if the recovery request is unavailable.
        }
      }

      if (!reply.trim()) {
        const fallbackReply = result.content
          .split(/\r?\n/)
          .map((line) => coerceEvent(line.trim()))
          .filter((event): event is Extract<AssistantCardStreamEvent, { type: 'reply_delta' }> =>
            Boolean(event && event.type === 'reply_delta'),
          )
          .map((event) => event.delta || '')
          .join('');
        reply = fallbackReply || '已实时生成卡片。';
      }

      updateStreamingAssistantCards(nodeIds, cards);
      stopAgentWaiting?.();
      return { reply, cards, placement };
    },
    [
      callAIForTextStream,
      callAIForTextResult,
      createAssistantCards,
      setAssistantMessages,
      startAgentWaiting,
      stopAgentWaiting,
      updateStreamingAssistantCards,
    ],
  );

  const handleAssistantSend = useCallback(
    async (overrideText?: string) => {
      const userText = (overrideText ?? assistantInput).trim();
      if (!userText || assistantLoading) return;

      pushAssistantHistory();
      setAssistantInput('');
      setAssistantLoading(true);
      const userMessage: AssistantMessage = { id: uuidv4(), role: 'user', content: userText };
      setAssistantMessages((messages) => [...messages, userMessage]);

      const workflow = assistantWorkflowRef.current;
      const isIdeaWorkflow = workflow.type === 'idea-awaiting';
      if (workflow.type === 'starter-theme') {
        assistantWorkflowRef.current = { type: 'starter-style', theme: userText };
        setAssistantMessages((messages) => [
          ...messages,
          {
            id: uuidv4(),
            role: 'assistant',
            content: `主题确定为“${userText}”。你想写成什么样的故事？可以直接输入，也可以让我给出三个方向。`,
            options: [
              {
                id: uuidv4(),
                label: 'AI 给我 3 个故事方向',
                value: '__starter_styles__',
              },
            ],
          },
        ]);
        setAssistantLoading(false);
        return;
      }
      if (workflow.type === 'starter-style' && !workflow.style) {
        assistantWorkflowRef.current = { ...workflow, style: userText };
        setAssistantMessages((messages) => [
          ...messages,
          {
            id: uuidv4(),
            role: 'assistant',
            content: `任务确认\n主题：${workflow.theme}\n故事方向：${userText}\n\n还有补充要求吗？`,
            options: [
              { id: uuidv4(), label: '确认并开始生成', value: '__starter_confirm__' },
              { id: uuidv4(), label: '添加补充要求', value: '__starter_supplement__' },
            ],
          },
        ]);
        setAssistantLoading(false);
        return;
      }
      if (workflow.type === 'starter-supplement') {
        assistantWorkflowRef.current = {
          type: 'starter-style',
          theme: workflow.theme,
          style: workflow.style,
          supplement: userText,
        };
        setAssistantMessages((messages) => [
          ...messages,
          {
            id: uuidv4(),
            role: 'assistant',
            content: `任务确认\n主题：${workflow.theme}\n故事方向：${workflow.style}\n补充要求：${userText}\n\n确认后，我会依次生成人物、场景和剧情卡片。`,
            options: [
              { id: uuidv4(), label: '确认并开始生成', value: '__starter_confirm__' },
              { id: uuidv4(), label: '继续补充', value: '__starter_supplement__' },
            ],
          },
        ]);
        setAssistantLoading(false);
        return;
      }

      if (workflow.type === 'idle' && isGenericStoryIdeaRequest(userText)) {
        assistantWorkflowRef.current = { type: 'idea-awaiting' };
        setAssistantMessages((messages) => [
          ...messages,
          {
            id: uuidv4(),
            role: 'assistant',
            content:
              language === 'zh'
                ? '先把你的脑洞告诉我：可以是一句话、一个角色、一个场景，或者一个冲突。我拿到具体内容后，再帮你扩展成故事设定、人物、场景和剧情卡。'
                : language === 'ja'
                  ? 'まず、そのアイデアの中身を教えてください。一文、キャラクター、場面、対立のどれでも大丈夫です。具体的な内容を受け取ってから、物語設定・人物・場面・プロットカードへ広げます。'
                  : 'Tell me the actual idea first: one sentence, a character, a setting, or a conflict. Once I have that, I will expand it into story premise, characters, scenes, and plot cards.',
          },
        ]);
        setAssistantLoading(false);
        return;
      }

      if (!hasTextApiKey) {
        onMissingTextApiKeyRequest?.();
        setAssistantMessages((messages) => [
          ...messages,
          {
            id: uuidv4(),
            role: 'assistant',
            content:
              language === 'zh'
                ? '还没有配置文本 AI 接口。请点击右侧工具栏 of 设置按钮，在“AI 接口配置”里添加 API Key 后再开始对话。'
                : language === 'ja'
                  ? 'テキストAIプロバイダーが設定されていません。右側のツールバーの設定ボタンをクリックし、「AIサービス設定」でAPIキーを追加してからチャットを開始してください。'
                  : 'No text AI API is configured yet. Click the settings button on the right toolbar, then add an API key in AI Provider Profiles before chatting.',
          },
        ]);
        setAssistantLoading(false);
        return;
      }

      const describeAssistantNode = (node: Node, index: number) => {
        if (node.type === 'characterNode') {
          return `#${index + 1} [character] ${String(node.data?.characterName || 'Unnamed Character')}\n${formatCharacterNodeText(node.data as Record<string, unknown>)}`;
        }
        if (node.type === 'sceneNode') {
          return `#${index + 1} [scene] ${String(node.data?.sceneName || 'Unnamed Scene')}\n${formatSceneNodeText(node.data as Record<string, unknown>)}`;
        }
        return `#${index + 1} [story] ${String(node.data?.title || 'Untitled')}\n${htmlToSpeechText(String(node.data?.text || ''))}`;
      };

      const selectedContext = selectedAssistantTargetNodes
        .filter((node) => !isDefaultRootStoryNode(node))
        .map((node, index) => describeAssistantNode(node, index))
        .join('\n\n---\n\n');

      const canvasContext = nodes
        .filter(
          (node) =>
            (node.type === 'storyNode' ||
              node.type === 'characterNode' ||
              node.type === 'sceneNode') &&
            !isDefaultRootStoryNode(node),
        )
        .slice(0, 20)
        .map((node, index) => {
          if (node.type === 'characterNode') {
            return `${index + 1}. [character] ${String(node.data?.characterName || 'Unnamed Character')}: ${formatCharacterNodeText(node.data as Record<string, unknown>).slice(0, 240)}`;
          }
          if (node.type === 'sceneNode') {
            return `${index + 1}. [scene] ${String(node.data?.sceneName || 'Unnamed Scene')}: ${formatSceneNodeText(node.data as Record<string, unknown>).slice(0, 240)}`;
          }
          return `${index + 1}. [story] ${String(node.data?.title || 'Untitled')}: ${htmlToSpeechText(String(node.data?.text || '')).slice(0, 240)}`;
        })
        .join('\n');

      const documentContext = buildAssistantDocumentContext(assistantDocuments);
      const memoryNote = assistantMemorySkillEnabled ? inferAssistantMemoryNote(userText) : '';
      const effectiveMemoryNotes =
        assistantMemorySkillEnabled && memoryNote
          ? mergeAssistantMemoryNote(assistantMemoryNotes, memoryNote)
          : assistantMemoryNotes;
      const assistantMemoryContext =
        assistantMemorySkillEnabled && effectiveMemoryNotes.length > 0
          ? effectiveMemoryNotes
              .slice(0, 12)
              .map((note, index) => `${index + 1}. ${note}`)
              .join('\n')
          : '';
      if (assistantMemorySkillEnabled && memoryNote) {
        setAssistantMemoryNotes((notes) => mergeAssistantMemoryNote(notes, memoryNote));
      }

      let effectiveUserText = userText;
      let forcedMode: AssistantCardPlacementMode | undefined;
      let placementOptions: AssistantCardPlacementOptions | undefined;
      if (isIdeaWorkflow) {
        effectiveUserText = `请把这个新脑洞扩展成可落地的视觉小说开篇。用户脑洞：${userText}。请生成主要人物卡、核心场景卡，并生成6到10张按顺序推进的剧情卡，重点补足故事设定、角色关系、核心冲突和第一幕推进。`;
        assistantWorkflowRef.current = { type: 'idle' };
      } else if (workflow.type === 'revision-awaiting-opinion') {
        effectiveUserText = `请根据用户的修改意见改写选中的卡片。保留原卡片，并返回一张同类型、已经修改好的新卡片。修改意见：${userText}`;
        forcedMode = 'adjacent-revision';
        assistantWorkflowRef.current = { type: 'idle' };
      } else if (workflow.type === 'starter-generate') {
        effectiveUserText = `请创建一套故事开端。主题：${workflow.theme}。故事方向：${workflow.style}。补充要求：${workflow.supplement || '无'}。先生成主要人物卡片和核心场景卡片，再生成3到5张按顺序推进的剧情卡片。`;
        assistantWorkflowRef.current = { type: 'idle' };
      } else if (workflow.type === 'future-generate-bridge') {
        effectiveUserText = `请生成${workflow.count}张剧情过渡卡片，把当前故事最后一张剧情卡片自然连接到选定的未来目标。只返回过渡剧情卡片，不要重复目标卡片。`;
        forcedMode = 'bridge-to-target';
        placementOptions = { targetNodeId: workflow.targetNodeId };
        assistantWorkflowRef.current = { type: 'idle' };
      }

      const wantsCards =
        /卡片|节点|生成|布置|填充|续写|创建|安排|人物|角色|场景|地点|设定|修改|更新|\u597d\u611f\u5ea6|\u6570\u503c|\u6570\u5b57|\u6761\u4ef6|\u5206\u652f|\u5224\u65ad|\u590d\u6742\u903b\u8f91|layout|card|node|continue|character|scene|setting|affection|value|condition|branch/i.test(
          effectiveUserText,
        );
      const fillSelected = /填充|改写选中|覆盖|补全选中|fill/i.test(userText);
      const recentConversationContext = [...assistantMessages, userMessage]
        .filter((message) => message.role === 'user' || message.role === 'assistant')
        .slice(-8)
        .map(
          (message) =>
            `${message.role === 'user' ? '用户' : '助手'}：${message.content.replace(/\s+/g, ' ').slice(0, 500)}`,
        )
        .join('\n');

      const numberLogicInstruction = `Number logic rule: Only create {"type":"number-condition"} cards when the user explicitly asks for affection, numeric values, value changes, conditional branches, route logic, hidden endings, or other complex logic. Do not use number-condition cards for ordinary story generation or normal setting cards. To control affection or another score, set "nodeValue" on relevant story cards, for example {"type":"story","title":"Affection rises","text":"...","nodeValue":5}. A number-condition card reads the accumulated upstream story nodeValue and may use {"type":"number-condition","key":"check","title":"Affection check","threshold":10,"ranges":[{"min":0,"max":9},{"min":10,"max":99}],"branchTargets":[{"handle":"less","target":"bad_end","label":"low affection"},{"handle":"greater","target":"good_end","label":"high affection"}]}. For any branching story, give cards stable "key" values and use "connectTo":["next_key"] or "branchTargets":[{"target":"ending_a"},{"target":"ending_b"}] so one card can connect to multiple later cards. When the user asks for multiple endings, create several ending story cards and connect the shared parent card to all of them with branchTargets, not a linear chain.`;

      const prompt = `你是 GalWriter AI 的右侧创作助手，帮助用户构思视觉小说/互动剧本，并且可以规划节点卡片。
${numberLogicInstruction}
请根据用户请求、选中卡片和画布摘要给出简洁建议。若用户要求生成、布置或填充卡片，请同时给出可落到画布上的卡片草稿。
如果用户只说“重新生成”“再来一次”“重写”等简短指令，请结合最近对话理解要重新生成的内容，不要把它当成缺少上下文的新请求。
当用户要扩展脑洞、生成故事、写完整故事片段、开场、桥段或剧情场面时，请按创作需要返回组合卡片；通常至少包含 type=character 的人物卡、type=scene 的场景卡、type=story 的剧情卡。只有用户明确要求只生成某一种卡片时，才只返回该类型。
组合卡片必须互相对应：人物卡要写剧情里实际出场的人，场景卡要写剧情实际发生的地点，剧情卡正文要使用这些人物和场景。不要返回空字段或只有几个字的设定。
剧情卡正文要按视觉小说台本来写：对白优先，少写大段环境描写和心理散文。不要手写裸 @ 前缀，不要写“角色名：台词”，不要用冒号表示说话范围，不要用引号包裹台词，不要把动作或神态放进中文/英文括号里。
剧情正文必须明确写出主要人物名和场景名；每一张 story 普通卡都必须包含对应场景名，让系统插入场景 tag 并把对应场景照片放进卡片内部。只有人物 tag、没有场景 tag 的普通卡会缺少场景照片，必须避免。人物第一次出场、靠近/转身/沉默/离开等关键动作处，都要再次写人物名或场景名，方便系统自动插入人物/场景 tag 并控制入场、中场动作和出场动画。系统自动插入的 tag 是必要的，可以保留；tag 在正文开头或结尾用于入场/出场动画，在正文中央用于角色中场动画。中场人物 tag 要少用，只在需要表现明显神态或情绪反应时使用，例如紧张、惊讶、害怕、激动、兴奋等可以通过抖动或反应动画表达的瞬间；普通叙述和普通台词不要频繁插入中场 tag。人物名或场景名应自然放在句首或句中，例如“艾琳在旧图书馆低声说，隐藏附录怎么可能”，不要写成“@艾琳：‘隐藏附录怎么可能？’”。
拆卡粒度要求：不要把一整个场景塞进一张 story 卡。一个角色的一次发言、一次沉默、一次靠近/离开/转身等短动作，尽量单独写成一张 story 卡。不同人说的话必须拆到不同的 story 卡里；每张 story 卡只承载一个角色的一句或一小组连续台词，或一个短动作节拍。不要害怕生成很多剧情卡，完整片段通常生成 6 到 12 张 story 卡。

必须只返回 JSON，不要使用 Markdown 代码块：
{
  "reply": "给用户看的中文回复，说明思路和你做了什么",
  "cards": [
    {"type": "story", "title": "剧情卡片标题", "text": "剧情卡片正文"},
    {"type": "character", "characterName": "人物名", "traits": "综合设定", "personality": "性格", "features": "人物特点", "background": "人物背景", "other": "其他设定"},
    {"type": "scene", "sceneName": "场景名", "description": "综合描述", "location": "位置描写", "items": "场景物品", "atmosphere": "氛围环境", "other": "其他设定"}
  ],
  "mode": "append" 或 "fill-selected"
}

当用户只是咨询建议时，cards 返回空数组。用户要求添加人物/角色设定时返回 type=character；要求添加场景/地点设定时返回 type=scene；要求修改选中的人物或场景设定时返回 mode=fill-selected，并只返回对应类型的字段。剧情卡片正文适合直接放进剧情卡片，保持可编辑、具体、有行动和情绪推进。
字段质量要求：character 的 traits/personality/features/background 至少各写一句具体内容；scene 的 description/location/items/atmosphere 至少各写一句具体内容；单张 story 的 text 保持短而可演出，通常 20 到 80 个中文字符，优先写一个角色的一句或一小组连续台词，同时自然带上当前场景名；尽量避免动作描写、神态描写和环境描写，只有在承接关系必须交代时才写极短的动作节拍；story text 不要以括号开头，不要包含“@人物：”、冒号台词或引号台词；多张 story 连起来组成完整场景，整体以对话推进为主。
如果用户请求里写了“回复格式：...”，reply 必须严格按该格式组织可见回复；cards 仍然按上面的 JSON 结构返回。

用户偏好记忆 skill：
${assistantMemoryContext || '未启用或暂无记录。'}
如果上方有偏好记录，请优先遵守；这些记录只作为写作习惯参考，不要在 reply 中复述“我记得你的习惯”。

用户请求：
${effectiveUserText}

最近对话：
${recentConversationContext || '无'}

选中卡片：
${selectedContext || '无'}

用户上传的参考文档：
${documentContext || '无'}

画布摘要：
${canvasContext || '无'}`;

      let preparedPlacement: AssistantCardPlacementResult | null = null;
      let preparedPlaceholderCards: AssistantCardDraft[] = [];
      if (wantsCards && !fillSelected) {
        startAgentWaiting?.(
          'AI Agent 正在生成内容',
          '正在设计人物、场景和剧情卡片',
        );
        const placeholders: AssistantCardDraft[] = [];
        if (placeholders.length > 0) {
          preparedPlaceholderCards = placeholders;
          preparedPlacement = await createAssistantCards(
            placeholders,
            forcedMode || 'append',
            placementOptions,
          );
          startAgentWaiting?.(
            'AI Agent 正在生成内容',
            '卡片已打开，正在等待 AI 返回可填写的文字',
            preparedPlacement.nodeIds,
          );
        }
      }

      try {
        if (wantsCards && !fillSelected && callAIForTextStream && updateStreamingAssistantCards) {
          const streamed = await runStructuredCardStream({
            prompt,
            userText: effectiveUserText,
            mode: forcedMode || 'append',
            placementOptions,
          });
          const actionText =
            streamed.placement.count > 0
              ? `\n\nGenerated ${streamed.placement.count} card(s) on the canvas in real time.`
              : '';
          const visualNodeIds = (streamed.placement.nodeIds || []).filter((_, index) => {
            const card = streamed.cards[index];
            if (!card) return false;
            const type = getAssistantDraftType(card);
            return type === 'character' || type === 'scene';
          });
          const visualizationRequestId =
            visualNodeIds.length > 0 && onGenerateAssistantImagesRequest ? uuidv4() : '';
          if (visualizationRequestId) {
            assistantVisualizationRequestsRef.current.set(visualizationRequestId, visualNodeIds);
          }
          setAssistantMessages((messages) => [
            ...messages,
            {
              id: uuidv4(),
              role: 'assistant',
              content: `${streamed.reply}${actionText}${
                visualizationRequestId
                  ? '\n\nGenerate matching images for these characters and scenes?'
                  : ''
              }`,
              cardPosition: streamed.placement.position,
              cardNodeIds: streamed.placement.nodeIds,
              options: visualizationRequestId
                ? [
                    {
                      id: uuidv4(),
                      label: 'Generate images',
                      value: `__generate_visuals__:${visualizationRequestId}`,
                    },
                  ]
                : undefined,
            },
          ]);
          pushAssistantHistory();
          return;
        }

        const aiResult = await callAIForTextResult(prompt);
        await playAssistantThought(aiResult.reasoning);
        const raw = aiResult.content;
        const jsonText = raw.match(/\{[\s\S]*\}/)?.[0] || raw;

        let parsed: {
          reply?: string;
          cards?: AssistantCardDraft[];
          mode?: AssistantCardPlacementMode;
        };

        try {
          parsed = JSON.parse(jsonText);
        } catch {
          parsed = { reply: raw, cards: [] };
        }

        const cards = orderAssistantCardsForCreation(alignAssistantCardsToPlaceholders(
          Array.isArray(parsed.cards)
            ? parsed.cards.map((card) =>
                getAssistantDraftType(card) === 'story'
                  ? { ...card, text: normalizeAssistantStoryDraftText(card.text || '') }
                  : card,
              )
            : [],
          preparedPlaceholderCards,
        ));
        const mode = forcedMode || parsed.mode || (fillSelected ? 'fill-selected' : 'append');
        const shouldPlaceCards = wantsCards || cards.length > 0;
        if (preparedPlacement?.count && cards.length === 0) {
          stopAgentWaiting?.();
        }
        let placement: AssistantCardPlacementResult = { count: 0 };
        if (shouldPlaceCards && preparedPlacement?.count && cards.length > 0) {
          const targetNodeIds = preparedPlacement.nodeIds || [];
          const fillCards = cards.slice(0, targetNodeIds.length || cards.length);
          const extraCards = targetNodeIds.length > 0 ? cards.slice(targetNodeIds.length) : [];
          const filledPlacement = await createAssistantCards(fillCards, 'fill-selected', {
            targetNodeIds,
          });
          if (extraCards.length > 0) {
            const appendedPlacement = await createAssistantCards(extraCards, 'append', placementOptions);
            placement = {
              count: filledPlacement.count + appendedPlacement.count,
              position: appendedPlacement.position || filledPlacement.position,
              nodeIds: [
                ...(filledPlacement.nodeIds || []),
                ...(appendedPlacement.nodeIds || []),
              ],
            };
          } else {
            placement = filledPlacement;
          }
        } else if (shouldPlaceCards) {
          placement = await createAssistantCards(cards, mode, placementOptions);
        }
        const actionText =
          placement.count > 0 ? `\n\n已在画布上处理 ${placement.count} 张卡片。` : '';

        const visualNodeIds = (placement.nodeIds || []).filter((_, index) => {
          const card = cards[index];
          if (!card) return false;
          const type = getAssistantDraftType(card);
          return type === 'character' || type === 'scene';
        });
        const visualizationRequestId =
          visualNodeIds.length > 0 && onGenerateAssistantImagesRequest ? uuidv4() : '';
        if (visualizationRequestId) {
          assistantVisualizationRequestsRef.current.set(visualizationRequestId, visualNodeIds);
        }

        const assistantMessage: AssistantMessage = {
          id: uuidv4(),
          role: 'assistant',
          content: `${parsed.reply || raw}${actionText}${
            visualizationRequestId
              ? language === 'zh'
                ? '\n\n要继续为这批人物和场景生成对应图片，完成可视化搭建吗？'
                : language === 'ja'
                  ? '\n\nこの人物とシーンに対応する画像を生成して、ビジュアルを組み立てますか？'
                  : '\n\nGenerate matching images for these characters and scenes to build the visual setup?'
              : ''
          }`,
          cardPosition: placement.position,
          cardNodeIds: placement.nodeIds,
          options: visualizationRequestId
            ? [
                {
                  id: uuidv4(),
                  label:
                    language === 'zh'
                      ? '生成人物/场景图片'
                      : language === 'ja'
                        ? '人物/シーン画像を生成'
                        : 'Generate character/scene images',
                  value: `${ASSISTANT_VISUALIZE_OPTION_PREFIX}${visualizationRequestId}`,
                },
              ]
            : undefined,
        };
        setAssistantMessages((messages) => [...messages, assistantMessage]);
      } catch (error: any) {
        console.error('AI Assistant failed:', error);
        stopAgentWaiting?.();
        setAssistantMessages((messages) => [
          ...messages,
          {
            id: uuidv4(),
            role: 'assistant',
            content:
              language === 'zh'
                ? `AI 助手暂时没能完成请求：${error.message || '请检查 API 配置和网络连接'}`
                : language === 'ja'
                  ? `AIアシスタントがリクエストを完了できませんでした：${error.message || 'API設定とネットワーク接続を確認してください'}`
                  : `AI Assistant failed to complete the request: ${error.message || 'Please check API configuration and network connection'}`,
          },
        ]);
      } finally {
        setAssistantLoading(false);
      }
    },
    [
      assistantInput,
      assistantLoading,
      assistantDocuments,
      assistantMessages,
      callAIForTextResult,
      callAIForTextStream,
      createAssistantCards,
      hasTextApiKey,
      assistantMemorySkillEnabled,
      assistantMemoryNotes,
      language,
      nodes,
      onGenerateAssistantImagesRequest,
      onMissingTextApiKeyRequest,
      playAssistantThought,
      pushAssistantHistory,
      runStructuredCardStream,
      selectedAssistantTargetNodes,
      setAssistantMessages,
      setAssistantMemoryNotes,
      startAgentWaiting,
      stopAgentWaiting,
      updateStreamingAssistantCards,
    ],
  );

  const requestAssistantOptions = useCallback(
    async (prompt: string, heading: string, valuePrefix: string, refreshValue?: string) => {
      if (!hasTextApiKey) {
        onMissingTextApiKeyRequest?.();
        return;
      }
      setAssistantLoading(true);
      try {
        const result = await callAIForTextResult(`${prompt}
只返回 JSON，不要使用 Markdown：
{"options":[{"label":"简短标题","description":"一句具体说明"}]}
options 必须正好有 3 项。`);
        const generatedOptions = parseAssistantGeneratedOptions(result.content);
        if (generatedOptions.length < 3) {
          throw new Error('AI 返回的选项数量不足，请点击“再换三个”重试');
        }
        const options = generatedOptions.map((option) => ({
          id: uuidv4(),
          label: option.label,
          description: option.description,
          value: `${valuePrefix}${option.label}`,
        }));
        if (refreshValue) {
          options.push({
            id: uuidv4(),
            label: '再换三个',
            description: '这批不合适，重新生成一组不同的选项。',
            value: refreshValue,
          });
        }
        setAssistantMessages((messages) => [
          ...messages,
          { id: uuidv4(), role: 'assistant', content: heading, options },
        ]);
      } catch (error: any) {
        setAssistantMessages((messages) => [
          ...messages,
          {
            id: uuidv4(),
            role: 'assistant',
            content: `暂时没能生成选项：${error.message || '请检查 AI 配置'}`,
          },
        ]);
      } finally {
        setAssistantLoading(false);
      }
    },
    [callAIForTextResult, hasTextApiKey, onMissingTextApiKeyRequest, setAssistantMessages],
  );

  const handleStartAssistantFlow = useCallback(
    async (flow: 'idea' | 'starter' | 'revision' | 'future') => {
      if (assistantLoading) return;

      if (flow === 'idea') {
        assistantWorkflowRef.current = { type: 'idea-awaiting' };
        setAssistantMessages((messages) => [
          ...messages,
          {
            id: uuidv4(),
            role: 'assistant',
            content:
              language === 'zh'
                ? '你有一个新脑洞吗？\n从一句灵感开始，我可以帮你扩展成故事设定、角色和冲突。把那句灵感发给我就行。'
                : language === 'ja'
                  ? '新しいアイデアがありますか？\n一文のひらめきから、物語設定・キャラクター・葛藤へ広げます。そのひらめきを送ってください。'
                  : 'Do you have a new idea?\nStart with one spark, and I can expand it into story premise, characters, and conflict. Send me that spark.',
          },
        ]);
        return;
      }

      if (flow === 'starter') {
        assistantWorkflowRef.current = { type: 'starter-theme' };
        setAssistantMessages((messages) => [
          ...messages,
          {
            id: uuidv4(),
            role: 'assistant',
            content: '起手式已启动。你想写什么主题？可以直接输入，也可以让我先给出三个主题。',
            options: [{ id: uuidv4(), label: 'AI 给我 3 个主题', value: '__starter_topics__' }],
          },
        ]);
        return;
      }

      if (flow === 'revision') {
        if (selectedAssistantTargetNodes.length === 0) {
          setAssistantMessages((messages) => [
            ...messages,
            {
              id: uuidv4(),
              role: 'assistant',
              content: '请先在画布上选择一张需要修改的卡片。',
            },
          ]);
          return;
        }
        assistantWorkflowRef.current = { type: 'revision-awaiting-opinion' };
        setAssistantMessages((messages) => [
          ...messages,
          {
            id: uuidv4(),
            role: 'assistant',
            content: '请直接说出修改意见。我会保留原卡片，并在它旁边生成修改后的版本。',
          },
        ]);
        return;
      }

      if (!hasTextApiKey) {
        onMissingTextApiKeyRequest?.();
        return;
      }
      setAssistantLoading(true);
      try {
        const context = selectedAssistantTargetNodes
          .filter((node) => !isDefaultRootStoryNode(node))
          .map((node) => `${String(node.data?.title || '')}\n${String(node.data?.text || '')}`)
          .join('\n---\n');
        const preparedPlacement = await createAssistantCards(
          buildAssistantPlaceholderCards('3 张后续剧情卡片', 'future-targets'),
          'future-targets',
        );
        startAgentWaiting?.(
          'AI Agent 正在生成未来目标',
          '后续剧情卡片已打开，正在等待 AI 返回剧情内容',
          preparedPlacement.nodeIds,
        );
        const result =
          await callAIForTextResult(`根据当前故事，设计三个差异明显、可以作为长期写作方向的未来目标。
当前内容：
${context || '画布当前没有选中卡片，请给出适合故事开篇后的通用目标。'}
只返回 JSON：{"reply":"一句引导语","cards":[{"type":"story","title":"目标标题","text":"目标发生时的具体剧情"}]}
cards 必须正好有 3 张。`);
        const jsonText = result.content.match(/\{[\s\S]*\}/)?.[0] || result.content;
        const parsed = JSON.parse(jsonText) as {
          reply?: string;
          cards?: AssistantCardDraft[];
        };
        const cards = (parsed.cards || [])
          .slice(0, 3)
          .map((card) => ({ ...card, text: normalizeAssistantStoryDraftText(card.text || '') }));
        if (preparedPlacement.count > 0 && cards.length === 0) {
          stopAgentWaiting?.();
        }
        const placement =
          preparedPlacement.count > 0 && cards.length > 0
            ? await createAssistantCards(cards, 'fill-selected', {
                targetNodeIds: preparedPlacement.nodeIds,
              })
            : await createAssistantCards(cards, 'future-targets');
        const nodeIds = placement.nodeIds || [];
        setAssistantMessages((messages) => [
          ...messages,
          {
            id: uuidv4(),
            role: 'assistant',
            content: parsed.reply || '我画出了三个未来目标，请选择一个长期写作方向。',
            cardPosition: placement.position,
            cardNodeIds: placement.nodeIds,
            options: cards.map((card, index) => ({
              id: uuidv4(),
              label: card.title || `目标 ${index + 1}`,
              description: card.text,
              value: `__future_target__:${nodeIds[index] || ''}`,
            })),
          },
        ]);
      } catch (error: any) {
        stopAgentWaiting?.();
        setAssistantMessages((messages) => [
          ...messages,
          {
            id: uuidv4(),
            role: 'assistant',
            content: `未来目标生成失败：${error.message || '请检查 AI 配置'}`,
          },
        ]);
      } finally {
        setAssistantLoading(false);
      }
    },
    [
      assistantLoading,
      callAIForTextResult,
      createAssistantCards,
      hasTextApiKey,
      language,
      onMissingTextApiKeyRequest,
      selectedAssistantTargetNodes,
      setAssistantMessages,
      startAgentWaiting,
      stopAgentWaiting,
    ],
  );

  const handleAssistantOptionSelect = useCallback(
    async (value: string) => {
      if (value.startsWith(ASSISTANT_VISUALIZE_OPTION_PREFIX)) {
        const requestId = value.slice(ASSISTANT_VISUALIZE_OPTION_PREFIX.length);
        const nodeIds = assistantVisualizationRequestsRef.current.get(requestId) || [];
        if (nodeIds.length === 0 || !onGenerateAssistantImagesRequest) return;

        assistantVisualizationRequestsRef.current.delete(requestId);
        setAssistantLoading(true);
        try {
          await onGenerateAssistantImagesRequest(nodeIds);
          setAssistantMessages((messages) => [
            ...messages,
            {
              id: uuidv4(),
              role: 'assistant',
              content:
                language === 'zh'
                  ? `已开始为 ${nodeIds.length} 张人物/场景卡生成图片。`
                  : language === 'ja'
                    ? `${nodeIds.length} 枚の人物/シーンカード画像生成を開始しました。`
                    : `Started generating images for ${nodeIds.length} character/scene cards.`,
            },
          ]);
        } finally {
          setAssistantLoading(false);
        }
        return;
      }

      if (value === '__starter_topics__') {
        await requestAssistantOptions(
          '为视觉小说或互动故事提供三个差异明显、有冲突潜力的主题。',
          '这里有三个主题，选一个继续：',
          '__starter_theme__:',
          '__starter_topics__',
        );
        return;
      }
      if (value.startsWith('__starter_theme__:')) {
        const theme = value.slice('__starter_theme__:'.length);
        assistantWorkflowRef.current = { type: 'starter-style', theme };
        setAssistantMessages((messages) => [
          ...messages,
          { id: uuidv4(), role: 'user', content: theme },
          {
            id: uuidv4(),
            role: 'assistant',
            content: `主题确定为“${theme}”。你想写成什么样的故事？`,
            options: [
              {
                id: uuidv4(),
                label: 'AI 给我 3 个故事方向',
                value: '__starter_styles__',
              },
            ],
          },
        ]);
        return;
      }
      if (value === '__starter_styles__') {
        const workflow = assistantWorkflowRef.current;
        if (workflow.type !== 'starter-style') return;
        await requestAssistantOptions(
          `围绕主题“${workflow.theme}”，提供三个差异明显的故事类型、气质和核心冲突方向。`,
          '选择一种故事方向：',
          '__starter_style__:',
          '__starter_styles__',
        );
        return;
      }
      if (value.startsWith('__starter_style__:')) {
        const workflow = assistantWorkflowRef.current;
        if (workflow.type !== 'starter-style') return;
        const style = value.slice('__starter_style__:'.length);
        assistantWorkflowRef.current = { ...workflow, style };
        setAssistantMessages((messages) => [
          ...messages,
          { id: uuidv4(), role: 'user', content: style },
          {
            id: uuidv4(),
            role: 'assistant',
            content: `任务确认\n主题：${workflow.theme}\n故事方向：${style}\n\n还有补充要求吗？`,
            options: [
              { id: uuidv4(), label: '确认并开始生成', value: '__starter_confirm__' },
              { id: uuidv4(), label: '添加补充要求', value: '__starter_supplement__' },
            ],
          },
        ]);
        return;
      }
      if (value === '__starter_supplement__') {
        const workflow = assistantWorkflowRef.current;
        if (workflow.type !== 'starter-style' || !workflow.style) return;
        assistantWorkflowRef.current = {
          type: 'starter-supplement',
          theme: workflow.theme,
          style: workflow.style,
        };
        setAssistantMessages((messages) => [
          ...messages,
          {
            id: uuidv4(),
            role: 'assistant',
            content: '请直接输入补充要求，例如人物数量、时代背景、禁用元素或结局气质。',
          },
        ]);
        return;
      }
      if (value === '__starter_confirm__') {
        const workflow = assistantWorkflowRef.current;
        if (workflow.type !== 'starter-style' || !workflow.style) return;
        assistantWorkflowRef.current = {
          type: 'starter-generate',
          theme: workflow.theme,
          style: workflow.style,
          supplement: workflow.supplement,
        };
        await handleAssistantSend('确认任务并开始生成');
        return;
      }
      if (value.startsWith('__future_target__:')) {
        const targetNodeId = value.slice('__future_target__:'.length);
        assistantWorkflowRef.current = { type: 'future-awaiting-count', targetNodeId };
        setAssistantMessages((messages) => [
          ...messages,
          {
            id: uuidv4(),
            role: 'assistant',
            content: '目标已选定。要用多少张过渡剧情卡片连接当前故事与目标？',
            options: [3, 5, 7].map((count) => ({
              id: uuidv4(),
              label: `${count} 张过渡卡片`,
              value: `__future_count__:${count}`,
            })),
          },
        ]);
        return;
      }
      if (value.startsWith('__future_count__:')) {
        const workflow = assistantWorkflowRef.current;
        if (workflow.type !== 'future-awaiting-count') return;
        const count = Number(value.slice('__future_count__:'.length)) || 5;
        assistantWorkflowRef.current = {
          type: 'future-generate-bridge',
          targetNodeId: workflow.targetNodeId,
          count,
        };
        await handleAssistantSend(`使用 ${count} 张卡片连接未来目标`);
      }
    },
    [
      handleAssistantSend,
      language,
      onGenerateAssistantImagesRequest,
      requestAssistantOptions,
      setAssistantMessages,
    ],
  );

  const handleAssistantVoiceInput = useCallback(() => {
    const runtimeWindow = window as Window & {
      SpeechRecognition?: AssistantSpeechRecognitionCtor;
      webkitSpeechRecognition?: AssistantSpeechRecognitionCtor;
    };
    const SpeechRecognition =
      runtimeWindow.SpeechRecognition || runtimeWindow.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        language === 'zh'
          ? '当前浏览器不支持语音输入。'
          : language === 'ja'
            ? 'お使いのブラウザは音声入力をサポートしていません。'
            : 'Speech recognition is not supported in this browser.',
      );
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language === 'zh' ? 'zh-CN' : language === 'ja' ? 'ja-JP' : 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setAssistantListening(true);
    recognition.onend = () => setAssistantListening(false);
    recognition.onerror = () => setAssistantListening(false);
    recognition.onresult = (event: AssistantSpeechRecognitionEvent) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      if (transcript) {
        setAssistantInput((value) => (value ? `${value} ${transcript}` : transcript));
      }
    };
    recognition.start();
  }, [language]);

  const handleAssistantResizePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isMobile) return;

      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      assistantResizeRef.current = {
        startX: event.clientX,
        startWidth: assistantPanelWidth,
        dragged: false,
      };
      setAssistantResizing(true);
    },
    [assistantPanelWidth, isMobile],
  );

  const handleAssistantResizePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const resize = assistantResizeRef.current;
      if (!resize || isMobile) return;

      const delta = resize.startX - event.clientX;
      if (Math.abs(delta) > 4) resize.dragged = true;

      const maxWidth = Math.min(560, Math.max(320, flowWidth - 180));
      const nextWidth = Math.min(Math.max(resize.startWidth + delta, 300), maxWidth);
      setAssistantWidth(nextWidth);
    },
    [flowWidth, isMobile],
  );

  const handleAssistantResizePointerUp = useCallback(() => {
    assistantResizeRef.current = null;
    setAssistantResizing(false);
  }, []);

  useEffect(() => {
    const element = assistantMessagesRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [assistantLoading, assistantMessages]);

  useEffect(
    () => () => {
      if (assistantThoughtTimerRef.current !== null) {
        window.clearInterval(assistantThoughtTimerRef.current);
      }
    },
    [],
  );

  return {
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
  };
};
