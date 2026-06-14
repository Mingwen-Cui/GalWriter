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

export type AssistantCardPlacementMode =
  | 'append'
  | 'fill-selected'
  | 'adjacent-revision'
  | 'future-targets'
  | 'bridge-to-target';

export type AssistantCardPlacementOptions = {
  targetNodeId?: string;
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

type AssistantWorkflowState =
  | { type: 'idle' }
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

interface UseAssistantPanelParams {
  language: Language;
  isMobile: boolean;
  flowWidth: number;
  selectedAssistantTargetNodes: Node[];
  nodes: Node[];
  callAIForTextResult: (prompt: string) => Promise<AITextResult>;
  createAssistantCards: (
    cards: AssistantCardDraft[],
    mode?: AssistantCardPlacementMode,
    options?: AssistantCardPlacementOptions,
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
  handleAssistantOptionSelect: (value: string) => Promise<void>;
  handleStartAssistantFlow: (flow: 'starter' | 'revision' | 'future') => Promise<void>;
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
  const assistantWorkflowRef = useRef<AssistantWorkflowState>({ type: 'idle' });
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

      const workflow = assistantWorkflowRef.current;
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

      let effectiveUserText = userText;
      let forcedMode: AssistantCardPlacementMode | undefined;
      let placementOptions: AssistantCardPlacementOptions | undefined;
      if (workflow.type === 'revision-awaiting-opinion') {
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
        /卡片|节点|生成|布置|填充|续写|创建|安排|人物|角色|场景|地点|设定|修改|更新|layout|card|node|continue|character|scene|setting/i.test(
          effectiveUserText,
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
${effectiveUserText}

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
          mode?: AssistantCardPlacementMode;
        };

        try {
          parsed = JSON.parse(jsonText);
        } catch {
          parsed = { reply: raw, cards: [] };
        }

        const cards = Array.isArray(parsed.cards) ? parsed.cards : [];
        const mode = forcedMode || parsed.mode || (fillSelected ? 'fill-selected' : 'append');
        const shouldPlaceCards = wantsCards || cards.length > 0;
        const placement = shouldPlaceCards
          ? createAssistantCards(cards, mode, placementOptions)
          : { count: 0 };
        const actionText =
          placement.count > 0 ? `\n\n已在画布上处理 ${placement.count} 张卡片。` : '';

        const assistantMessage: AssistantMessage = {
          id: uuidv4(),
          role: 'assistant',
          content: `${parsed.reply || raw}${actionText}`,
          cardPosition: placement.position,
          cardNodeIds: placement.nodeIds,
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
    async (flow: 'starter' | 'revision' | 'future') => {
      if (assistantLoading) return;

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
          .map((node) => `${String(node.data?.title || '')}\n${String(node.data?.text || '')}`)
          .join('\n---\n');
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
        const cards = (parsed.cards || []).slice(0, 3);
        const placement = createAssistantCards(cards, 'future-targets');
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
      onMissingTextApiKeyRequest,
      selectedAssistantTargetNodes,
      setAssistantMessages,
    ],
  );

  const handleAssistantOptionSelect = useCallback(
    async (value: string) => {
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
    [handleAssistantSend, requestAssistantOptions, setAssistantMessages],
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
