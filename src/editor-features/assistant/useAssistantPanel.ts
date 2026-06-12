import type { Node } from '@xyflow/react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import type { AITextResult } from '../../editor-services/aiClient';
import {
  buildAssistantDocumentContext,
  readAssistantDocument,
  type AssistantDocument,
} from '../../lib/documentReader';
import { formatCharacterNodeText, formatSceneNodeText } from '../../lib/export';
import { htmlToSpeechText } from '../../lib/tts';
import type { AssistantMessage, AssistantTask } from '../../editor-state/editorConfig';
import type { Language } from '../../lib/i18n';

export type AssistantCardDraft = {
  type?: 'story' | 'character' | 'scene';
  title?: string;
  text?: string;
  characterName?: string;
  traits?: string;
  personality?: string;
  features?: string;
  background?: string;
  sceneName?: string;
  description?: string;
  location?: string;
  items?: string;
  atmosphere?: string;
  other?: string;
};

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

export type AssistantCardPlacementResult = {
  count: number;
  position?: { x: number; y: number; zoom?: number };
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

interface UseAssistantPanelParams {
  language: Language;
  isMobile: boolean;
  flowWidth: number;
  selectedAssistantTargetNodes: Node[];
  nodes: Node[];
  callAIForTextResult: (prompt: string) => Promise<AITextResult>;
  createAssistantCards: (
    cards: AssistantCardDraft[],
    mode?: 'append' | 'fill-selected',
  ) => AssistantCardPlacementResult;
  hasTextApiKey: boolean;
  onMissingTextApiKeyRequest?: () => void;
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
  createAssistantCards,
  hasTextApiKey,
  onMissingTextApiKeyRequest,
}: UseAssistantPanelParams): UseAssistantPanelResult => {
  const [assistantOpen, setAssistantOpen] = useState(true);
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

  const handleAssistantSend = useCallback(
    async (overrideText?: string) => {
      const userText = (overrideText ?? assistantInput).trim();
      if (!userText || assistantLoading) return;

      pushAssistantHistory();
      setAssistantInput('');
      setAssistantLoading(true);
      const userMessage: AssistantMessage = { id: uuidv4(), role: 'user', content: userText };
      setAssistantMessages((messages) => [...messages, userMessage]);

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
        .map((node, index) => describeAssistantNode(node, index))
        .join('\n\n---\n\n');

      const canvasContext = nodes
        .filter(
          (node) =>
            node.type === 'storyNode' || node.type === 'characterNode' || node.type === 'sceneNode',
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

      const wantsCards =
        /卡片|节点|生成|布置|填充|续写|创建|安排|人物|角色|场景|地点|设定|修改|更新|layout|card|node|continue|character|scene|setting/i.test(
          userText,
        );
      const fillSelected = /填充|改写选中|覆盖|补全选中|fill/i.test(userText);

      const prompt = `你是 GalWriter AI 的右侧创作助手，帮助用户构思视觉小说/互动剧本，并且可以规划节点卡片。
请根据用户请求、选中卡片和画布摘要给出简洁建议。若用户要求生成、布置或填充卡片，请同时给出可落到画布上的卡片草稿。

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
如果用户请求里写了“回复格式：...”，reply 必须严格按该格式组织可见回复；cards 仍然按上面的 JSON 结构返回。

用户请求：
${userText}

选中卡片：
${selectedContext || '无'}

用户上传的参考文档：
${documentContext || '无'}

画布摘要：
${canvasContext || '无'}`;

      try {
        const aiResult = await callAIForTextResult(prompt);
        await playAssistantThought(aiResult.reasoning);
        const raw = aiResult.content;
        const jsonText = raw.match(/\{[\s\S]*\}/)?.[0] || raw;

        let parsed: {
          reply?: string;
          cards?: AssistantCardDraft[];
          mode?: 'append' | 'fill-selected';
        };

        try {
          parsed = JSON.parse(jsonText);
        } catch {
          parsed = { reply: raw, cards: [] };
        }

        const cards = Array.isArray(parsed.cards) ? parsed.cards : [];
        const mode = parsed.mode || (fillSelected ? 'fill-selected' : 'append');
        const shouldPlaceCards = wantsCards || cards.length > 0;
        const placement = shouldPlaceCards ? createAssistantCards(cards, mode) : { count: 0 };
        const actionText =
          placement.count > 0 ? `\n\n已在画布上处理 ${placement.count} 张卡片。` : '';

        const assistantMessage: AssistantMessage = {
          id: uuidv4(),
          role: 'assistant',
          content: `${parsed.reply || raw}${actionText}`,
          cardPosition: placement.position,
        };
        setAssistantMessages((messages) => [...messages, assistantMessage]);
      } catch (error: any) {
        console.error('AI Assistant failed:', error);
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
      callAIForTextResult,
      createAssistantCards,
      hasTextApiKey,
      language,
      nodes,
      onMissingTextApiKeyRequest,
      playAssistantThought,
      pushAssistantHistory,
      selectedAssistantTargetNodes,
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
