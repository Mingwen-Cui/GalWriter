import type { Node } from '@xyflow/react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import type {
  AssistantCardDraft,
  AssistantCardPlacementMode,
  AssistantCardPlacementOptions,
} from '../../agent/planning/agentCardDraft';
import type { AITextResult, AITextStreamHandlers } from '../../editor-services/aiClient';
import { useDialog } from '../../editor-shell/DialogProvider';
import type { AssistantMessage, AssistantTask } from '../../editor-state/editorConfig';
import {
  type AssistantDocument,
  buildAssistantDocumentContext,
  readAssistantDocument,
} from '../../lib/documentReader';
import { formatCharacterNodeText, formatSceneNodeText } from '../../lib/export';
import type { Language } from '../../lib/i18n';
import { htmlToSpeechText } from '../../lib/tts';
import {
  alignAssistantCardsToPlaceholders,
  ASSISTANT_VISUALIZE_OPTION_PREFIX,
  type AssistantArticleAnalysisState,
  type AssistantArticleAnalysisStep,
  type AssistantCardPlacementResult,
  type AssistantCardStreamEvent,
  assistantCardStreamProtocol,
  type AssistantHistorySnapshot,
  type AssistantSpeechRecognitionCtor,
  type AssistantSpeechRecognitionEvent,
  type AssistantWorkflowState,
  buildAssistantPlaceholderCards,
  cloneAssistantTasks,
  createArticleCustomSceneCards,
  createArticleDefaultSceneCards,
  createArticleRoleCandidateCards,
  createArticleRoleSelectionOptions,
  createArticleSelfDrawRoleCard,
  createArticleTeachingModeOptions,
  createAssistantWelcomeMessage,
  createInitialAssistantTask,
  extractFirstJsonObject,
  getAssistantDraftType,
  hasAssistantCardContent,
  inferAssistantMemoryNote,
  isDefaultRootStoryNode,
  isGenericStoryIdeaRequest,
  LEGACY_ASSISTANT_VISUALIZE_OPTION_PREFIX,
  markArticleCandidateCards,
  mergeAssistantMemoryNote,
  normalizeAssistantStoryDraftText,
  orderAssistantCardsForCreation,
  parseAssistantGeneratedOptions,
} from './assistantPanelHelpers';
export type {
  AssistantArticleAnalysisState,
  AssistantCardPlacementResult,
} from './assistantPanelHelpers';

interface UseAssistantPanelParams {
  language: Language;
  isMobile: boolean;
  flowWidth: number;
  selectedAssistantTargetNodes: Node[];
  nodes: Node[];
  callAIForTextResult: (prompt: string) => Promise<AITextResult>;
  callAIForTextStream?: (prompt: string, handlers?: AITextStreamHandlers) => Promise<AITextResult>;
  createAssistantCards: (
    cards: AssistantCardDraft[],
    mode?: AssistantCardPlacementMode,
    options?: AssistantCardPlacementOptions,
  ) => Promise<AssistantCardPlacementResult>;
  updateStreamingAssistantCards?: (
    nodeIds: string[] | undefined,
    cards: AssistantCardDraft[],
  ) => void;
  removeAssistantNodes?: (nodeIds: string[]) => void;
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
  assistantArticleAnalysis: AssistantArticleAnalysisState;
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
  handleAssistantCandidateNodeSelect: (nodeId: string) => Promise<void>;
  handleStartAssistantFlow: (flow: 'idea' | 'starter' | 'revision' | 'future') => Promise<void>;
  handleAssistantDocumentUpload: (
    files: FileList | null,
    intent?: 'article-to-galgame',
  ) => Promise<void>;
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
  removeAssistantNodes,
  onGenerateAssistantImagesRequest,
  startAgentWaiting,
  stopAgentWaiting,
  hasTextApiKey,
  onMissingTextApiKeyRequest,
  assistantMemorySkillEnabled,
  assistantMemoryNotes,
  setAssistantMemoryNotes,
}: UseAssistantPanelParams): UseAssistantPanelResult => {
  const { alert: showDialogAlert } = useDialog();
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
  const [assistantArticleAnalysis, setAssistantArticleAnalysis] =
    useState<AssistantArticleAnalysisState>({
      status: 'idle',
      summary: '',
      steps: [],
    });
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

  const createArticleAnalysisSteps = useCallback(
    (): AssistantArticleAnalysisStep[] => [
      {
        title: language === 'zh' ? '文章内容读取' : 'Reading Article',
        status: 'pending',
        detail:
          language === 'zh'
            ? '等待提取文档中的正文、标题和段落内容。'
            : 'Waiting to extract text, headings, and paragraphs.',
      },
      {
        title: language === 'zh' ? '主题与核心观点识别' : 'Finding Core Ideas',
        status: 'pending',
        detail:
          language === 'zh'
            ? '等待 AI 阅读文章并判断主题、核心观点和关键概念。'
            : 'Waiting for AI to identify topic, claims, and key concepts.',
      },
      {
        title: language === 'zh' ? '章节结构梳理' : 'Structuring Chapters',
        status: 'pending',
        detail:
          language === 'zh'
            ? '等待 AI 根据文章逻辑拆分章节和知识点顺序。'
            : 'Waiting for AI to split chapters and knowledge order.',
      },
      {
        title: language === 'zh' ? '教学路径规划' : 'Planning Teaching Path',
        status: 'pending',
        detail:
          language === 'zh'
            ? '等待 AI 规划提问点、讲解点、反馈节奏和学习路径。'
            : 'Waiting for AI to plan questions, explanations, and feedback flow.',
      },
      {
        title: language === 'zh' ? 'Galgame 场景转化' : 'Converting To Galgame',
        status: 'pending',
        detail:
          language === 'zh'
            ? '等待 AI 规划教学角色、场景、对白节奏和章节背景框。'
            : 'Waiting for AI to plan roles, scenes, dialogue rhythm, and chapter regions.',
      },
      {
        title: language === 'zh' ? '等待教学方式' : 'Choose Teaching Style',
        status: 'pending',
        detail:
          language === 'zh'
            ? '文章真实解析完成后，请选择接下来用哪种方式转成 Galgame。'
            : 'After real analysis completes, choose how to turn it into a Galgame.',
      },
    ],
    [language],
  );

  const updateArticleAnalysisStep = useCallback(
    (
      index: number,
      updates: Partial<AssistantArticleAnalysisStep>,
      status?: AssistantArticleAnalysisState['status'],
      summary?: string,
    ) => {
      setAssistantArticleAnalysis((current) => ({
        status: status || current.status,
        summary: summary ?? current.summary,
        steps: current.steps.map((step, stepIndex) =>
          stepIndex === index ? { ...step, ...updates } : step,
        ),
      }));
    },
    [],
  );

  const parseArticleAnalysisJson = (content: string): Record<string, any> => {
    const jsonText = extractFirstJsonObject(content);
    try {
      return JSON.parse(jsonText) as Record<string, any>;
    } catch {
      return { detail: content.trim() };
    }
  };

  const runArticleAnalysisStage = useCallback(
    async (prompt: string) => parseArticleAnalysisJson((await callAIForTextResult(prompt)).content),
    [callAIForTextResult],
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
      setAssistantArticleAnalysis({ status: 'idle', summary: '', steps: [] });
      setAssistantDocuments((documents) => {
        documents.forEach((document) => URL.revokeObjectURL(document.objectUrl));
        return [];
      });
    },
    [language],
  );

  const handleAssistantDocumentUpload = useCallback(
    async (files: FileList | null, intent?: 'article-to-galgame') => {
      const selectedFiles = Array.from(files || []);
      if (selectedFiles.length === 0) return;

      setAssistantDocumentLoading(true);
      if (intent === 'article-to-galgame') {
        const steps = createArticleAnalysisSteps();
        steps[0] = {
          ...steps[0],
          status: 'active',
          detail:
            language === 'zh'
              ? '正在提取文档正文、标题、段落和可读取文本。'
              : 'Extracting readable text, headings, and paragraphs.',
        };
        setAssistantArticleAnalysis({
          status: 'reading',
          summary: language === 'zh' ? '正在读取上传文档...' : 'Reading uploaded document...',
          steps,
        });
      }

      try {
        const documents = await Promise.all(
          selectedFiles.map((file) => readAssistantDocument(file)),
        );
        let nextDocuments: AssistantDocument[] = [];
        setAssistantDocuments((currentDocuments) => {
          const documentMap = new Map(currentDocuments.map((document) => [document.id, document]));
          documents.forEach((document) => documentMap.set(document.id, document));
          nextDocuments = Array.from(documentMap.values()).slice(-5);
          return nextDocuments;
        });

        if (intent === 'article-to-galgame') {
          const analyzedDocuments = nextDocuments.length > 0 ? nextDocuments : documents;
          const documentCount = analyzedDocuments.length;
          const charCount = analyzedDocuments.reduce(
            (sum, document) => sum + document.charCount,
            0,
          );
          const truncatedCount = analyzedDocuments.filter((document) => document.truncated).length;
          const summary =
            language === 'zh'
              ? `已读取 ${documentCount} 个文档，约 ${charCount.toLocaleString()} 字${
                  truncatedCount > 0 ? `，其中 ${truncatedCount} 个文档因过长已截取前段内容` : ''
                }。`
              : `Read ${documentCount} document(s), about ${charCount.toLocaleString()} characters${
                  truncatedCount > 0 ? `; ${truncatedCount} document(s) were truncated` : ''
                }.`;
          updateArticleAnalysisStep(
            0,
            {
              status: 'done',
              detail:
                language === 'zh'
                  ? `已真实提取 ${documentCount} 个文档的可读文本，共约 ${charCount.toLocaleString()} 字。`
                  : `Extracted readable text from ${documentCount} document(s), about ${charCount.toLocaleString()} characters.`,
              evidence: analyzedDocuments
                .map((document) => `${document.name} · ${document.type.toUpperCase()}`)
                .join(' / '),
            },
            'analyzing',
            summary,
          );

          if (!hasTextApiKey) {
            onMissingTextApiKeyRequest?.();
            updateArticleAnalysisStep(
              1,
              {
                status: 'error',
                detail:
                  language === 'zh'
                    ? '无法进行真实 AI 阅读：还没有配置文本 AI 接口。请先在设置中添加 API Key。'
                    : 'Unable to run real AI reading: no text AI API is configured.',
              },
              'error',
            );
            return;
          }

          const documentContext = buildAssistantDocumentContext(analyzedDocuments).slice(0, 36000);
          const jsonRule =
            '只返回 JSON，不要 Markdown。字段格式：{"detail":"一句阶段结论","evidence":"引用文章中的具体标题、概念或段落线索","items":["要点1","要点2"]}';

          updateArticleAnalysisStep(1, {
            status: 'active',
            detail:
              language === 'zh'
                ? 'AI 正在阅读全文，识别主题、核心观点和关键概念。'
                : 'AI is reading the full text to identify topic, claims, and key concepts.',
          });
          const theme =
            await runArticleAnalysisStage(`你正在真实阅读用户上传的文章。请完成“主题与核心观点识别”阶段。
${jsonRule}
要求：detail 说明文章主要讨论什么；evidence 必须来自文章内容；items 列出 3-5 个关键概念或观点。

文章内容：
${documentContext}`);
          updateArticleAnalysisStep(1, {
            status: 'done',
            detail: String(theme.detail || theme.summary || '已识别文章主题和核心观点。'),
            evidence: String(
              theme.evidence ||
                (Array.isArray(theme.items) ? theme.items.slice(0, 3).join(' / ') : ''),
            ),
          });

          updateArticleAnalysisStep(2, {
            status: 'active',
            detail:
              language === 'zh'
                ? 'AI 正在按文章逻辑拆分章节、层级和知识点顺序。'
                : 'AI is splitting the article into chapters and knowledge order.',
          });
          const chapters =
            await runArticleAnalysisStage(`你正在真实阅读用户上传的文章。请完成“章节结构梳理”阶段。
${jsonRule}
要求：detail 说明你把文章拆成几段/几章以及拆分依据；evidence 必须提到文章中的结构线索；items 列出建议章节标题，3-6 个。

文章内容：
${documentContext}`);
          updateArticleAnalysisStep(2, {
            status: 'done',
            detail: String(chapters.detail || '已根据文章逻辑拆分章节结构。'),
            evidence: String(
              chapters.evidence ||
                (Array.isArray(chapters.items) ? chapters.items.slice(0, 6).join(' / ') : ''),
            ),
          });

          updateArticleAnalysisStep(3, {
            status: 'active',
            detail:
              language === 'zh'
                ? 'AI 正在把文章知识点转成可教学的提问、讲解和反馈路径。'
                : 'AI is turning knowledge points into questions, explanations, and feedback.',
          });
          const teaching =
            await runArticleAnalysisStage(`你正在真实阅读用户上传的文章。请完成“教学路径规划”阶段。
${jsonRule}
要求：detail 说明这篇文章适合怎样教学；evidence 必须说明依据文章中的哪些概念/论证关系；items 列出提问点或讲解顺序。

文章内容：
${documentContext}`);
          updateArticleAnalysisStep(3, {
            status: 'done',
            detail: String(teaching.detail || '已规划文章的教学路径。'),
            evidence: String(
              teaching.evidence ||
                (Array.isArray(teaching.items) ? teaching.items.slice(0, 4).join(' / ') : ''),
            ),
          });

          updateArticleAnalysisStep(4, {
            status: 'active',
            detail:
              language === 'zh'
                ? 'AI 正在规划教学角色、场景、对白节奏和章节背景框。'
                : 'AI is planning roles, scenes, dialogue rhythm, and chapter regions.',
          });
          const galgame =
            await runArticleAnalysisStage(`你正在真实阅读用户上传的文章。请完成“Galgame 场景转化”阶段。
${jsonRule}
要求：detail 说明如何把文章转成 galgame 教学项目；evidence 必须关联文章章节/概念；items 列出建议角色、场景或章节背景框方向。

文章内容：
${documentContext}`);
          updateArticleAnalysisStep(4, {
            status: 'done',
            detail: String(galgame.detail || '已规划 Galgame 化的角色、场景和章节框。'),
            evidence: String(
              galgame.evidence ||
                (Array.isArray(galgame.items) ? galgame.items.slice(0, 5).join(' / ') : ''),
            ),
          });
          updateArticleAnalysisStep(
            5,
            {
              status: 'done',
              detail:
                language === 'zh'
                  ? '真实解析已完成。请选择对话式教学或讲课式教学，我会基于上面的分析生成章节背景框和剧情卡。'
                  : 'Real analysis is complete. Choose interactive or lecture teaching to generate chapter regions and story cards.',
              evidence:
                language === 'zh'
                  ? '后续生成会沿用本次主题、章节、教学路径和 Galgame 转化结论。'
                  : 'Generation will reuse the topic, chapter, teaching path, and Galgame conversion analysis above.',
            },
            'ready',
          );
          setAssistantLoading(true);
          try {
            const placement = await createAssistantCards(
              markArticleCandidateCards(createArticleRoleCandidateCards(), 'article-role'),
              'append',
            );
            assistantWorkflowRef.current = {
              type: 'article-role-awaiting',
              candidateNodeIds: placement.nodeIds || [],
            };
            setAssistantMessages((messages) => [
              ...messages,
              {
                id: uuidv4(),
                role: 'assistant',
                content:
                  language === 'zh'
                    ? '我已经完成文章分析，并在画布上横向生成了 4 张候选人物模板卡。请直接单击你想使用的模板卡，我会立刻按这张卡的风格改写文章。也可以先选中你自己的已有角色卡，再点“使用当前选中的人物模板”。'
                    : 'I finished the article analysis and placed four role template cards on the canvas. Click one template to continue, or select your own character card and use it as the template.',
                cardPosition: placement.position,
                cardNodeIds: placement.nodeIds,
                options: [
                  {
                    id: uuidv4(),
                    label: '使用当前选中的人物模板',
                    value: '__article_role_use_selected_template__',
                  },
                  { id: uuidv4(), label: '添加自绘角色卡', value: '__article_role_self_draw__' },
                ],
              },
            ]);
          } finally {
            setAssistantLoading(false);
          }
          return;
        }

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
        if (intent === 'article-to-galgame') {
          setAssistantArticleAnalysis((current) => ({
            status: 'error',
            summary:
              language === 'zh'
                ? `文章解析失败：${error.message || '请确认文件可读取，并检查 AI 配置。'}`
                : `Article analysis failed: ${error.message || 'Please check the file and AI configuration.'}`,
            steps:
              current.steps.length > 0
                ? current.steps.map((step) =>
                    step.status === 'active'
                      ? {
                          ...step,
                          status: 'error',
                          detail:
                            language === 'zh'
                              ? `此阶段失败：${error.message || '未知错误'}`
                              : `This stage failed: ${error.message || 'Unknown error'}`,
                        }
                      : step,
                  )
                : createArticleAnalysisSteps(),
          }));
        }
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
    [
      createArticleAnalysisSteps,
      createAssistantCards,
      hasTextApiKey,
      language,
      onMissingTextApiKeyRequest,
      runArticleAnalysisStage,
      setAssistantMessages,
      updateArticleAnalysisStep,
    ],
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
    }): Promise<{
      reply: string;
      cards: AssistantCardDraft[];
      placement: AssistantCardPlacementResult;
    }> => {
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
        lines
          .map((line) => line.trim())
          .filter(Boolean)
          .forEach((line) => {
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
            return [
              ...messages,
              { id: uuidv4(), role: 'thought', content: delta, collapsed: false },
            ];
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
          const jsonText = extractFirstJsonObject(result.content);
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
          const jsonText = extractFirstJsonObject(retryResult.content);
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

      if (workflow.type === 'article-scene-custom-awaiting') {
        const placement = await createAssistantCards(
          markArticleCandidateCards(createArticleCustomSceneCards(userText), 'article-scene'),
          'append',
        );
        assistantWorkflowRef.current = {
          type: 'article-scene-awaiting',
          characterNodeId: workflow.characterNodeId,
          characterName: workflow.characterName,
          candidateNodeIds: placement.nodeIds || [],
        };
        setAssistantMessages((messages) => [
          ...messages,
          {
            id: uuidv4(),
            role: 'assistant',
            content:
              '我已经根据你的描述在画布上生成 4 张新场景候选卡。请选中要使用的那张，然后点击确认。',
            cardPosition: placement.position,
            cardNodeIds: placement.nodeIds,
            options: [
              { id: uuidv4(), label: '确认当前选中的场景卡', value: '__article_scene_confirm__' },
              { id: uuidv4(), label: '不使用场景', value: '__article_scene_skip__' },
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
      const isShortDramaBundleRequest = /短剧|短劇|short drama|短編ドラマ/i.test(userText);
      if (isIdeaWorkflow) {
        effectiveUserText = `请把这个新脑洞扩展成可落地的视觉小说开篇。用户脑洞：${userText}。请生成主要人物卡、核心场景卡，并生成6到10张按顺序推进的剧情卡，重点补足故事设定、角色关系、核心冲突和第一幕推进。`;
        assistantWorkflowRef.current = { type: 'idle' };
      } else if (isShortDramaBundleRequest) {
        effectiveUserText = `请把这个短剧脑洞扩展成可落地的视觉小说/互动短剧开篇。用户请求：${userText}。必须像“我有一个新脑洞”一样生成完整组合卡片：先生成主要人物设定卡、核心场景设定卡，再生成 6 到 10 张按顺序推进的剧情卡。人物卡要覆盖剧情里实际出场的人，场景卡要覆盖剧情实际发生的地点，剧情卡正文要自然使用这些人物和场景，并补足故事设定、角色关系、核心冲突和第一幕推进。不要只返回剧情卡。`;
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
      } else if (workflow.type === 'article-teach-generate') {
        const modeInstruction =
          workflow.teachingMode === 'interactive'
            ? '教学方式：对话式教学。强调交互和反馈，把内容拆成提问、用户回应、AI 点评/补充、下一步引导的节拍。每一章都要安排可演出的问答和确认点。'
            : '教学方式：讲课式教学。强调语气和逻辑上的递进，用清楚的讲授口吻组织概念、例子、总结和过渡。每一章都要有讲解层次和重点句。';
        const templateInstruction = workflow.templateInstruction
          ? `\n已选人物模板要求：\n${workflow.templateInstruction}\n${
              workflow.templateIsUserOwned
                ? '这是用户自己的角色模板，必须优先保留该人物卡中的设定、语气和视觉设定，不要改成默认教学角色。'
                : ''
            }`
          : '';
        effectiveUserText = `请把用户上传的文章转化成 galgame/视觉小说教学项目。${modeInstruction}
${templateInstruction}
重点要求：
1. 你必须先自行理清文章的主题、章节结构、关键概念、论证顺序和读者学习路径。
2. 按文章结构拆成 3 到 6 个章节；每张剧情卡都必须带 chapterTitle 字段，chapterTitle 是所属章节标题。
3. 为每个章节生成一组连续 story 卡，落到画布后系统会按 chapterTitle 自动画出对应背景框。
4. 适量生成人物卡和场景卡；人物用于教学者/学习者或旁白角色，场景用于课堂、书桌、资料室等教学空间。
5. 剧情卡要适合 galgame 演出，短句、分步、可交互，不要把整篇文章直接塞进单张卡。
用户补充要求：${userText}`;
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

      const isArticleTeachingWorkflow = workflow.type === 'article-teach-generate';
      const articleTeachingSelectionInstruction = isArticleTeachingWorkflow
        ? `\nArticle teaching selection rule:
- The selected teaching character is "${workflow.characterName || '教学角色'}".
- The selected role template instruction is: ${
            workflow.templateInstruction || 'Use the selected character card as the teaching style.'
          }
- Use exactly this one character in all story cards. Do not create or mention a second teacher, student, narrator, assistant, partner, or extra character.
- Do not return any character cards. The character card already exists on the canvas.
- ${
            workflow.useScene && workflow.sceneName
              ? `The selected scene is "${workflow.sceneName}". Use this scene name naturally in story card text. Do not return any scene cards.`
              : 'The user chose not to add a scene card. Do not return any scene cards.'
          }
- For this workflow, the JSON cards array must contain story cards only.\n`
        : '';

      if (articleTeachingSelectionInstruction) {
        effectiveUserText += articleTeachingSelectionInstruction;
      }

      const prompt = `你是 GalWriter AI 的右侧创作助手，帮助用户构思视觉小说/互动剧本，并且可以规划节点卡片。
${numberLogicInstruction}
请根据用户请求、选中卡片和画布摘要给出简洁建议。若用户要求生成、布置或填充卡片，请同时给出可落到画布上的卡片草稿。
如果用户只说“重新生成”“再来一次”“重写”等简短指令，请结合最近对话理解要重新生成的内容，不要把它当成缺少上下文的新请求。
当用户要扩展脑洞、生成故事、写完整故事片段、开场、桥段或剧情场面时，请按创作需要返回组合卡片；通常至少包含 type=character 的人物卡、type=scene 的场景卡、type=story 的剧情卡。只有用户明确要求只生成某一种卡片时，才只返回该类型。
组合卡片必须互相对应：人物卡要写剧情里实际出场的人，场景卡要写剧情实际发生的地点，剧情卡正文要使用这些人物和场景。不要返回空字段或只有几个字的设定。
剧情卡正文要按视觉小说台本来写：对白优先，少写大段环境描写和心理散文。不要手写裸 @ 前缀，不要写“角色名：台词”，不要用冒号表示说话范围，不要用引号包裹台词，不要把动作或神态放进中文/英文括号里。
剧情正文必须明确写出主要人物名和场景名；每一张 story 普通卡都必须包含对应场景名，让系统插入场景 tag 并把对应场景照片放进卡片内部。只有人物 tag、没有场景 tag 的普通卡会缺少场景照片，必须避免。人物第一次出场、靠近/转身/沉默/离开等关键动作处，都要再次写人物名或场景名，方便系统自动插入人物/场景 tag 并控制入场、中场动作和出场动画。系统自动插入的 tag 是必要的，可以保留；tag 在正文开头或结尾用于入场/出场动画，在正文中央用于角色中场动画。中场人物 tag 要少用，只在需要表现明显神态或情绪反应时使用，例如紧张、惊讶、害怕、激动、兴奋等可以通过抖动或反应动画表达的瞬间；普通叙述和普通台词不要频繁插入中场 tag。人物名或场景名应自然放在句首或句中，例如“艾琳在旧图书馆低声说，隐藏附录怎么可能”，不要写成“@艾琳：‘隐藏附录怎么可能？’”。
拆卡粒度要求：不要把一整个场景塞进一张 story 卡。一个角色的一次发言、一次沉默、一次靠近/离开/转身等短动作，尽量单独写成一张 story 卡。不同人说的话必须拆到不同的 story 卡里；每张 story 卡只承载一个角色的一句或一小组连续台词，或一个短动作节拍。不要害怕生成很多剧情卡，完整片段通常生成 6 到 12 张 story 卡。
文章转 galgame 教学要求：如果用户要求把上传文章转成 galgame，必须先理解文章结构，再把不同章节拆成 story 卡；每张 story 卡必须包含 "chapterTitle" 字段，系统会用 chapterTitle 给对应章节自动画背景框。chapterTitle 要稳定、简短、来自文章结构，不要把所有卡都放在同一个章节。

必须只返回 JSON，不要使用 Markdown 代码块：
{
  "reply": "给用户看的中文回复，说明思路和你做了什么",
  "cards": [
    {"type": "story", "chapterTitle": "章节标题，可选；文章转 galgame 时必填", "title": "剧情卡片标题", "text": "剧情卡片正文"},
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
        startAgentWaiting?.('AI Agent 正在生成内容', '正在设计人物、场景和剧情卡片');
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
        if (
          wantsCards &&
          !fillSelected &&
          !isArticleTeachingWorkflow &&
          callAIForTextStream &&
          updateStreamingAssistantCards
        ) {
          const streamed = await runStructuredCardStream({
            prompt,
            userText: effectiveUserText,
            mode: forcedMode || 'append',
            placementOptions,
          });
          const actionText =
            streamed.placement.count > 0
              ? language === 'zh'
                ? `\n\n已在画布上实时生成 ${streamed.placement.count} 张卡片。`
                : language === 'ja'
                  ? `\n\nキャンバスに ${streamed.placement.count} 枚のカードをリアルタイム生成しました。`
                  : `\n\nGenerated ${streamed.placement.count} card(s) on the canvas in real time.`
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
                  ? language === 'zh'
                    ? '\n\n要继续为这些人物和场景生成对应图片吗？'
                    : language === 'ja'
                      ? '\n\nこの人物とシーンに対応する画像を生成しますか？'
                      : '\n\nGenerate matching images for these characters and scenes?'
                  : ''
              }`,
              cardPosition: streamed.placement.position,
              cardNodeIds: streamed.placement.nodeIds,
              options: visualizationRequestId
                ? [
                    {
                      id: uuidv4(),
                      label:
                        language === 'zh'
                          ? '生成图片'
                          : language === 'ja'
                            ? '画像を生成'
                            : 'Generate images',
                      value: `${ASSISTANT_VISUALIZE_OPTION_PREFIX}${visualizationRequestId}`,
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
        const jsonText = extractFirstJsonObject(raw);

        let parsed: {
          reply?: string;
          cards?: AssistantCardDraft[];
          mode?: AssistantCardPlacementMode;
        };

        try {
          parsed = JSON.parse(jsonText);
        } catch {
          const looksLikeCardJson = /"cards"\s*:/.test(raw) || /"reply"\s*:/.test(raw);
          parsed = {
            reply: looksLikeCardJson
              ? language === 'zh'
                ? 'AI 返回了卡片 JSON，但解析失败。我已拦截原始 JSON，避免直接显示在聊天里。请再点一次生成，或缩短文章后重试。'
                : 'AI returned card JSON, but parsing failed. I blocked the raw JSON from appearing in chat. Please try again.'
              : raw,
            cards: [],
          };
        }

        let cards = orderAssistantCardsForCreation(
          alignAssistantCardsToPlaceholders(
            Array.isArray(parsed.cards)
              ? parsed.cards.map((card) =>
                  getAssistantDraftType(card) === 'story'
                    ? { ...card, text: normalizeAssistantStoryDraftText(card.text || '') }
                    : card,
                )
              : [],
            preparedPlaceholderCards,
          ),
        );
        if (isArticleTeachingWorkflow) {
          cards = cards.filter((card) => getAssistantDraftType(card) === 'story');
        }
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
            const appendedPlacement = await createAssistantCards(
              extraCards,
              'append',
              placementOptions,
            );
            placement = {
              count: filledPlacement.count + appendedPlacement.count,
              position: appendedPlacement.position || filledPlacement.position,
              nodeIds: [...(filledPlacement.nodeIds || []), ...(appendedPlacement.nodeIds || [])],
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

  const continueArticleTeachingWithRole = useCallback(
    async (selectedRole: Node, candidateNodeIds: string[] = []) => {
      const removedIds = candidateNodeIds.filter((candidateId) => candidateId !== selectedRole.id);
      if (removedIds.length > 0) removeAssistantNodes?.(removedIds);

      const characterName = String(selectedRole.data?.characterName || '教学角色');
      const templateInstruction =
        String(selectedRole.data?.assistantTemplateInstruction || '').trim() ||
        [
          `使用用户选择的人物模板「${characterName}」作为唯一教学角色。`,
          selectedRole.data?.traits ? `性格/定位：${selectedRole.data.traits}` : '',
          selectedRole.data?.personality ? `人物性格：${selectedRole.data.personality}` : '',
          selectedRole.data?.features ? `人物特点：${selectedRole.data.features}` : '',
          selectedRole.data?.background ? `人物背景：${selectedRole.data.background}` : '',
          selectedRole.data?.other ? `其他要求：${selectedRole.data.other}` : '',
        ]
          .filter(Boolean)
          .join('\n');
      const templateTeachingMode =
        selectedRole.data?.assistantTemplateTeachingMode === 'lecture' ? 'lecture' : 'interactive';
      const templateIsUserOwned = selectedRole.data?.assistantTemplateIsUserOwned === true;

      assistantWorkflowRef.current = {
        type: 'article-teach-generate',
        teachingMode: templateTeachingMode,
        characterNodeId: selectedRole.id,
        characterName,
        useScene: false,
        templateInstruction,
        templateIsUserOwned,
      };

      setAssistantMessages((messages) => [
        ...messages,
        {
          id: uuidv4(),
          role: 'assistant',
          content: `已选择「${characterName}」作为文章改写模板。我会按这张人物卡的设定和教学风格继续生成 Galgame 教学内容。`,
          cardNodeIds: [selectedRole.id],
        },
      ]);

      await handleAssistantSend(`请根据已选择的人物模板「${characterName}」开始改写文章。`);
    },
    [handleAssistantSend, removeAssistantNodes, setAssistantMessages],
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
        const jsonText = extractFirstJsonObject(result.content);
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
      const visualizeOptionPrefix = value.startsWith(ASSISTANT_VISUALIZE_OPTION_PREFIX)
        ? ASSISTANT_VISUALIZE_OPTION_PREFIX
        : value.startsWith(LEGACY_ASSISTANT_VISUALIZE_OPTION_PREFIX)
          ? LEGACY_ASSISTANT_VISUALIZE_OPTION_PREFIX
          : '';

      if (visualizeOptionPrefix) {
        const requestId = value.slice(visualizeOptionPrefix.length);
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

      if (value === '__article_roles_create__') {
        setAssistantLoading(true);
        try {
          const placement = await createAssistantCards(
            markArticleCandidateCards(createArticleRoleCandidateCards(), 'article-role'),
            'append',
          );
          assistantWorkflowRef.current = {
            type: 'article-role-awaiting',
            candidateNodeIds: placement.nodeIds || [],
          };
          setAssistantMessages((messages) => [
            ...messages,
            {
              id: uuidv4(),
              role: 'assistant',
              content:
                '我已经在画布上摆出 4 张候选人物设定卡。请在画布上选中你要使用的那一张，然后点击确认。也可以添加一张自绘角色卡，完成绘制/上传后再选中确认。',
              cardPosition: placement.position,
              cardNodeIds: placement.nodeIds,
              options: createArticleRoleSelectionOptions(),
            },
          ]);
        } finally {
          setAssistantLoading(false);
        }
        return;
      }

      if (value === '__article_role_use_selected_template__') {
        const workflow = assistantWorkflowRef.current;
        const candidateNodeIds =
          workflow.type === 'article-role-awaiting' ? workflow.candidateNodeIds : [];
        const selectedRole = selectedAssistantTargetNodes.find(
          (node) => node.type === 'characterNode' && !candidateNodeIds.includes(node.id),
        );
        if (!selectedRole) {
          setAssistantMessages((messages) => [
            ...messages,
            {
              id: uuidv4(),
              role: 'assistant',
              content: '请先在画布上选中你自己的人物模板卡，然后再点“使用当前选中的人物模板”。',
            },
          ]);
          return;
        }
        await continueArticleTeachingWithRole(selectedRole, candidateNodeIds);
        return;
      }

      if (value === '__article_role_self_draw__') {
        const workflow = assistantWorkflowRef.current;
        setAssistantLoading(true);
        try {
          const shouldCreateFullSet = workflow.type !== 'article-role-awaiting';
          const cards = shouldCreateFullSet
            ? [...createArticleRoleCandidateCards(), createArticleSelfDrawRoleCard()]
            : [createArticleSelfDrawRoleCard()];
          const placement = await createAssistantCards(
            markArticleCandidateCards(cards, 'article-role'),
            'append',
          );
          const candidateNodeIds =
            workflow.type === 'article-role-awaiting'
              ? [...workflow.candidateNodeIds, ...(placement.nodeIds || [])]
              : placement.nodeIds || [];
          assistantWorkflowRef.current = {
            type: 'article-role-awaiting',
            candidateNodeIds,
          };
          setAssistantMessages((messages) => [
            ...messages,
            {
              id: uuidv4(),
              role: 'assistant',
              content:
                '自绘角色卡已经放到画布上。请在这张人物卡里放入你绘制或上传的角色图，完成后选中它并点击确认。',
              cardPosition: placement.position,
              cardNodeIds: placement.nodeIds,
              options: createArticleRoleSelectionOptions(),
            },
          ]);
        } finally {
          setAssistantLoading(false);
        }
        return;
      }

      if (value === '__article_role_confirm__') {
        const workflow = assistantWorkflowRef.current;
        if (workflow.type !== 'article-role-awaiting') return;
        const candidateIds = new Set(workflow.candidateNodeIds);
        const selectedRole = selectedAssistantTargetNodes.find(
          (node) => candidateIds.has(node.id) && node.type === 'characterNode',
        );
        if (!selectedRole) {
          setAssistantMessages((messages) => [
            ...messages,
            {
              id: uuidv4(),
              role: 'assistant',
              content: '请先在画布上选中一张候选人物设定卡，然后再确认。',
              options: createArticleRoleSelectionOptions(),
            },
          ]);
          return;
        }
        await continueArticleTeachingWithRole(selectedRole, workflow.candidateNodeIds);
        return;
      }

      if (value === '__article_scenes_custom_prompt__') {
        const workflow = assistantWorkflowRef.current;
        if (
          workflow.type !== 'article-role-selected' &&
          workflow.type !== 'article-ready-to-teach'
        ) {
          return;
        }
        assistantWorkflowRef.current = {
          type: 'article-scene-custom-awaiting',
          characterNodeId: workflow.characterNodeId,
          characterName: workflow.characterName,
        };
        setAssistantMessages((messages) => [
          ...messages,
          {
            id: uuidv4(),
            role: 'assistant',
            content: '请直接输入你想要的新场景方向，我会在画布上生成 4 张候选场景卡。',
          },
        ]);
        return;
      }

      if (value.startsWith('__article_scenes_create__:')) {
        const workflow = assistantWorkflowRef.current;
        if (
          workflow.type !== 'article-role-selected' &&
          workflow.type !== 'article-ready-to-teach'
        ) {
          return;
        }
        setAssistantLoading(true);
        try {
          const placement = await createAssistantCards(
            markArticleCandidateCards(createArticleDefaultSceneCards(), 'article-scene'),
            'append',
          );
          assistantWorkflowRef.current = {
            type: 'article-scene-awaiting',
            characterNodeId: workflow.characterNodeId,
            characterName: workflow.characterName,
            candidateNodeIds: placement.nodeIds || [],
          };
          setAssistantMessages((messages) => [
            ...messages,
            {
              id: uuidv4(),
              role: 'assistant',
              content: '我已经在画布上摆出默认场景候选卡。请选中你要使用的场景卡，然后点击确认。',
              cardPosition: placement.position,
              cardNodeIds: placement.nodeIds,
              options: [
                { id: uuidv4(), label: '确认当前选中的场景卡', value: '__article_scene_confirm__' },
                { id: uuidv4(), label: '不使用场景', value: '__article_scene_skip__' },
              ],
            },
          ]);
        } finally {
          setAssistantLoading(false);
        }
        return;
      }

      if (value === '__article_scene_confirm__') {
        const workflow = assistantWorkflowRef.current;
        if (workflow.type !== 'article-scene-awaiting') return;
        const candidateIds = new Set(workflow.candidateNodeIds);
        const selectedScene = selectedAssistantTargetNodes.find(
          (node) => candidateIds.has(node.id) && node.type === 'sceneNode',
        );
        if (!selectedScene) {
          setAssistantMessages((messages) => [
            ...messages,
            {
              id: uuidv4(),
              role: 'assistant',
              content: '请先在画布上选中一张候选场景设定卡，然后再确认。',
              options: [
                { id: uuidv4(), label: '确认当前选中的场景卡', value: '__article_scene_confirm__' },
                { id: uuidv4(), label: '不使用场景', value: '__article_scene_skip__' },
              ],
            },
          ]);
          return;
        }
        const removedIds = workflow.candidateNodeIds.filter(
          (nodeId) => nodeId !== selectedScene.id,
        );
        removeAssistantNodes?.(removedIds);
        const sceneName = String(selectedScene.data?.sceneName || '教学场景');
        assistantWorkflowRef.current = {
          type: 'article-ready-to-teach',
          characterNodeId: workflow.characterNodeId,
          characterName: workflow.characterName,
          sceneNodeId: selectedScene.id,
          sceneName,
          useScene: true,
        };
        setAssistantMessages((messages) => [
          ...messages,
          {
            id: uuidv4(),
            role: 'assistant',
            content: `已选择「${sceneName}」作为教学场景，并清理了其他候选场景卡。请选择教学方式。`,
            cardNodeIds: [workflow.characterNodeId, selectedScene.id],
            options: createArticleTeachingModeOptions(),
          },
        ]);
        return;
      }

      if (value === '__article_scene_skip__') {
        const workflow = assistantWorkflowRef.current;
        if (
          workflow.type !== 'article-role-selected' &&
          workflow.type !== 'article-ready-to-teach' &&
          workflow.type !== 'article-scene-awaiting'
        ) {
          return;
        }
        if (workflow.type === 'article-scene-awaiting') {
          removeAssistantNodes?.(workflow.candidateNodeIds);
        }
        assistantWorkflowRef.current = {
          type: 'article-ready-to-teach',
          characterNodeId: workflow.characterNodeId,
          characterName: workflow.characterName,
          useScene: false,
        };
        setAssistantMessages((messages) => [
          ...messages,
          {
            id: uuidv4(),
            role: 'assistant',
            content: `将使用「${workflow.characterName}」单人生成教学剧情，不额外添加场景卡。请选择教学方式。`,
            cardNodeIds: [workflow.characterNodeId],
            options: createArticleTeachingModeOptions(),
          },
        ]);
        return;
      }

      if (value.startsWith('__article_teach__:')) {
        const teachingMode = value.slice('__article_teach__:'.length);
        const isInteractive = teachingMode === 'interactive';
        const workflow = assistantWorkflowRef.current;
        const articleContext =
          workflow.type === 'article-ready-to-teach'
            ? {
                characterNodeId: workflow.characterNodeId,
                characterName: workflow.characterName,
                sceneNodeId: workflow.sceneNodeId,
                sceneName: workflow.sceneName,
                useScene: workflow.useScene,
              }
            : {};
        assistantWorkflowRef.current = {
          type: 'article-teach-generate',
          teachingMode: isInteractive ? 'interactive' : 'lecture',
          ...articleContext,
        };
        await handleAssistantSend(
          isInteractive
            ? '请用对话式教学把上传文章转化成 galgame。强调交互、提问、反馈和分步确认。'
            : '请用讲课式教学把上传文章转化成 galgame。强调讲解语气、逻辑层次和知识点推进。',
        );
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

  const handleAssistantCandidateNodeSelect = useCallback(
    async (nodeId: string) => {
      const workflow = assistantWorkflowRef.current;
      if (workflow.type === 'article-role-awaiting') {
        if (!workflow.candidateNodeIds.includes(nodeId)) return;
        const selectedRole = nodes.find(
          (node) => node.id === nodeId && node.type === 'characterNode',
        );
        if (!selectedRole) return;
        await continueArticleTeachingWithRole(selectedRole, workflow.candidateNodeIds);
        return;
      }

      if (workflow.type === 'article-scene-awaiting') {
        if (!workflow.candidateNodeIds.includes(nodeId)) return;
        const selectedScene = nodes.find((node) => node.id === nodeId && node.type === 'sceneNode');
        if (!selectedScene) return;
        const removedIds = workflow.candidateNodeIds.filter(
          (candidateId) => candidateId !== nodeId,
        );
        removeAssistantNodes?.(removedIds);
        const sceneName = String(selectedScene.data?.sceneName || '教学场景');
        assistantWorkflowRef.current = {
          type: 'article-ready-to-teach',
          characterNodeId: workflow.characterNodeId,
          characterName: workflow.characterName,
          sceneNodeId: selectedScene.id,
          sceneName,
          useScene: true,
        };
        setAssistantMessages((messages) => [
          ...messages,
          {
            id: uuidv4(),
            role: 'assistant',
            content: `已选择「${sceneName}」作为教学场景，并清理了其他候选场景卡。请选择教学方式。`,
            cardNodeIds: [workflow.characterNodeId, selectedScene.id],
            options: createArticleTeachingModeOptions(),
          },
        ]);
      }
    },
    [continueArticleTeachingWithRole, nodes, removeAssistantNodes, setAssistantMessages],
  );

  const handleAssistantVoiceInput = useCallback(() => {
    const runtimeWindow = window as Window & {
      SpeechRecognition?: AssistantSpeechRecognitionCtor;
      webkitSpeechRecognition?: AssistantSpeechRecognitionCtor;
    };
    const SpeechRecognition =
      runtimeWindow.SpeechRecognition || runtimeWindow.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      void showDialogAlert({
        title:
          language === 'zh'
            ? '语音输入不可用'
            : language === 'ja'
              ? '音声入力は利用できません'
              : 'Speech input unavailable',
        description:
          language === 'zh'
            ? '当前浏览器不支持语音输入。'
            : language === 'ja'
              ? 'お使いのブラウザは音声入力をサポートしていません。'
              : 'Speech recognition is not supported in this browser.',
        tone: 'warning',
      });
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
  };
};
