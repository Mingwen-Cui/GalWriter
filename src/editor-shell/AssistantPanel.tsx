import {
  BrainCircuit,
  ChevronDown,
  Download,
  FileText,
  Lightbulb,
  Loader2,
  MapPin,
  Mic,
  PencilLine,
  Plus,
  PlusCircle,
  Redo2,
  SearchCheck,
  Send,
  Trash2,
  Undo2,
  UploadCloud,
  UserRound,
  X,
} from 'lucide-react';
import type {
  Dispatch,
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
  SetStateAction,
  TransitionEvent as ReactTransitionEvent,
} from 'react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { AssistantMessage, AssistantTask } from '../editor-state/editorConfig';
import type { AssistantDocument } from '../lib/documentReader';
import type { Language } from '../lib/i18n';

interface AssistantPanelProps {
  assistantOpen: boolean;
  isMobile: boolean;
  assistantPanelWidth: number;
  assistantLoading: boolean;
  assistantListening: boolean;
  assistantDocuments: AssistantDocument[];
  assistantDocumentLoading: boolean;
  assistantInput: string;
  selectedAssistantTargetNodesCount: number;
  assistantTasks: AssistantTask[];
  activeAssistantTaskId: string;
  assistantMessages: AssistantMessage[];
  assistantMessagesRef: MutableRefObject<HTMLDivElement | null>;
  setAssistantOpen: Dispatch<SetStateAction<boolean>>;
  setAssistantInput: Dispatch<SetStateAction<string>>;
  setActiveAssistantTaskId: Dispatch<SetStateAction<string>>;
  handleNewAssistantTask: () => void;
  handleRenameAssistantTask: (taskId: string, title: string) => void;
  handleCloseAssistantTask: (taskId: string) => void;
  handleAssistantSend: (overrideText?: string) => Promise<void>;
  handleAssistantOptionSelect: (value: string) => Promise<void>;
  handleStartAssistantFlow: (flow: 'idea' | 'starter' | 'revision' | 'future') => Promise<void>;
  handleAssistantDocumentUpload: (files: FileList | null) => Promise<void>;
  handleRemoveAssistantDocument: (documentId: string) => void;
  handleAssistantVoiceInput: () => void;
  toggleAssistantThought: (messageId: string) => void;
  handleAssistantResizePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handleAssistantResizePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handleAssistantResizePointerUp: () => void;
  handleAssistantUndo: () => void;
  handleAssistantRedo: () => void;
  canAssistantUndo: boolean;
  canAssistantRedo: boolean;
  onAssistantMessagePositionClick: (target: {
    position?: { x: number; y: number; zoom?: number };
    nodeIds?: string[];
  }) => void;
  showStats: boolean;
  language: Language;
}

export function AssistantPanel({
  assistantOpen,
  isMobile,
  assistantPanelWidth,
  assistantLoading,
  assistantListening,
  assistantDocuments,
  assistantDocumentLoading,
  assistantInput,
  selectedAssistantTargetNodesCount,
  assistantTasks,
  activeAssistantTaskId,
  assistantMessages,
  assistantMessagesRef,
  setAssistantOpen,
  setAssistantInput,
  setActiveAssistantTaskId,
  handleNewAssistantTask,
  handleRenameAssistantTask,
  handleCloseAssistantTask,
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
  onAssistantMessagePositionClick,
  showStats,
  language,
}: AssistantPanelProps) {
  const [shouldRender, setShouldRender] = useState(assistantOpen);
  const [panelVisible, setPanelVisible] = useState(assistantOpen);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState('');
  const [documentUploadOpen, setDocumentUploadOpen] = useState(false);
  const [documentDragActive, setDocumentDragActive] = useState(false);
  const [cardGenerateOpen, setCardGenerateOpen] = useState(false);
  const [suggestMenuOpen, setSuggestMenuOpen] = useState(false);
  const [welcomeGradientState, setWelcomeGradientState] = useState<
    'visible' | 'exiting' | 'hidden'
  >('visible');
  const [welcomeGradientDismissedTaskId, setWelcomeGradientDismissedTaskId] = useState<
    string | null
  >(null);
  const [cardGenerateMenuPosition, setCardGenerateMenuPosition] = useState({
    left: 0,
    top: 0,
  });
  const [suggestMenuPosition, setSuggestMenuPosition] = useState({
    left: 0,
    top: 0,
  });
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const assistantInputRef = useRef<HTMLTextAreaElement | null>(null);
  const cardGenerateButtonRef = useRef<HTMLButtonElement | null>(null);
  const suggestButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeAnimationTimerRef = useRef<number | null>(null);
  const welcomeGradientTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (closeAnimationTimerRef.current) {
      window.clearTimeout(closeAnimationTimerRef.current);
      closeAnimationTimerRef.current = null;
    }

    if (assistantOpen) {
      setShouldRender(true);
      setPanelVisible(false);
      const frame = window.requestAnimationFrame(() => setPanelVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }

    setPanelVisible(false);
    closeAnimationTimerRef.current = window.setTimeout(() => {
      setShouldRender(false);
      closeAnimationTimerRef.current = null;
    }, 550);

    return () => {
      if (closeAnimationTimerRef.current) {
        window.clearTimeout(closeAnimationTimerRef.current);
        closeAnimationTimerRef.current = null;
      }
    };
  }, [assistantOpen]);

  const handlePanelTransitionEnd = (event: ReactTransitionEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform') return;
    if (!assistantOpen) {
      if (closeAnimationTimerRef.current) {
        window.clearTimeout(closeAnimationTimerRef.current);
        closeAnimationTimerRef.current = null;
      }
      setShouldRender(false);
    }
  };

  const startRenamingTask = (task: AssistantTask) => {
    setEditingTaskId(task.id);
    setEditingTaskTitle(task.title);
  };

  const commitRenamingTask = () => {
    if (!editingTaskId) return;
    handleRenameAssistantTask(editingTaskId, editingTaskTitle);
    setEditingTaskId(null);
    setEditingTaskTitle('');
  };

  const uploadAccept =
    '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.markdown,.csv,.tsv,.json,.xml,.html,.htm,.rtf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/*';

  const handleDocumentFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    void handleAssistantDocumentUpload(files);
    setDocumentUploadOpen(false);
    setDocumentDragActive(false);
  };

  const applyAssistantTemplate = (template: string) => {
    const cursorIndex = template.indexOf('_');
    setAssistantInput(template);
    setCardGenerateOpen(false);
    setSuggestMenuOpen(false);
    window.requestAnimationFrame(() => {
      const input = assistantInputRef.current;
      if (!input) return;
      input.focus();
      if (cursorIndex >= 0) input.setSelectionRange(cursorIndex, cursorIndex + 1);
    });
  };

  const getFloatingMenuPosition = (button: HTMLButtonElement, menuWidth = 256) => {
    const rect = button.getBoundingClientRect();
    const left = Math.min(
      Math.max(12, rect.left + rect.width / 2 - menuWidth / 2),
      window.innerWidth - menuWidth - 12,
    );
    return {
      left,
      top: Math.max(12, rect.top - 12),
    };
  };

  const updateCardGenerateMenuPosition = () => {
    const button = cardGenerateButtonRef.current;
    if (!button) return;
    setCardGenerateMenuPosition(getFloatingMenuPosition(button));
  };

  const updateSuggestMenuPosition = () => {
    const button = suggestButtonRef.current;
    if (!button) return;
    setSuggestMenuPosition(getFloatingMenuPosition(button));
  };

  const toggleCardGenerateMenu = () => {
    if (cardGenerateOpen) {
      setCardGenerateOpen(false);
      return;
    }

    setSuggestMenuOpen(false);
    updateCardGenerateMenuPosition();
    setCardGenerateOpen(true);
  };

  const toggleSuggestMenu = () => {
    if (suggestMenuOpen) {
      setSuggestMenuOpen(false);
      return;
    }

    setCardGenerateOpen(false);
    updateSuggestMenuPosition();
    setSuggestMenuOpen(true);
  };

  const welcomePrompts =
    language === 'zh'
      ? [
          {
            icon: <Lightbulb className="h-4 w-4" />,
            title: '我有一个新脑洞',
            description: '从一句灵感开始，帮你扩展成故事设定、角色和冲突。',
            prompt: '我有一个新脑洞，想让你帮我扩展成一个完整故事。',
          },
          {
            icon: <PencilLine className="h-4 w-4" />,
            title: '我想继续写下去',
            description: '接着当前剧情，帮你推进下一幕、对白或分镜。',
            prompt: '我想继续写下去，请帮我接着当前内容推进剧情。',
          },
          {
            icon: <SearchCheck className="h-4 w-4" />,
            title: '我想把文章转成 Galgame',
            description: '把 PDF、Word 等文档拖拽到 AI 助手页面上传，我来帮你转成可编辑的 galgame。',
            prompt: '我想把文章转化成 galgame。我会上传 PDF 或 Word 文档，请帮我提取内容并转成可编辑的视觉小说卡片。',
          },
        ]
      : [
          {
            icon: <Lightbulb className="h-4 w-4" />,
            title: 'I have a new idea',
            description: 'Turn one spark into a story premise, cast, and conflict.',
            prompt: 'I have a new idea. Help me expand it into a complete story.',
          },
          {
            icon: <PencilLine className="h-4 w-4" />,
            title: 'I want to keep writing',
            description: 'Continue the current plot with the next scene, dialogue, or storyboard.',
            prompt: 'I want to continue writing. Help me move the current story forward.',
          },
          {
            icon: <SearchCheck className="h-4 w-4" />,
            title: 'I am stuck',
            description: 'Break down the problem and find conflict, rhythm, and new directions.',
            prompt: 'I am stuck in the plot. Help me analyze the problem and suggest ways forward.',
          },
        ];

  const isLegacyAssistantWelcomeMessage = (message: AssistantMessage) =>
    message.role === 'assistant' &&
    (message.content.includes('生成故事') ||
      message.content.includes('整理设定') ||
      message.content.includes('续写剧情') ||
      message.content.includes('generate stories') ||
      message.content.includes('organize settings') ||
      message.content.includes('continue writing plots'));

  const visibleAssistantMessages = assistantMessages.filter(
    (message) => !isLegacyAssistantWelcomeMessage(message),
  );
  const showTransparentWelcomeGradient = welcomeGradientState !== 'hidden';

  useEffect(() => {
    if (
      visibleAssistantMessages.length === 0 &&
      !assistantLoading &&
      welcomeGradientDismissedTaskId !== activeAssistantTaskId
    ) {
      if (welcomeGradientTimerRef.current) {
        window.clearTimeout(welcomeGradientTimerRef.current);
        welcomeGradientTimerRef.current = null;
      }
      setWelcomeGradientState('visible');
      return;
    }

    if (visibleAssistantMessages.length > 0 && welcomeGradientState !== 'exiting') {
      setWelcomeGradientState('hidden');
    }
  }, [
    activeAssistantTaskId,
    assistantLoading,
    visibleAssistantMessages.length,
    welcomeGradientDismissedTaskId,
    welcomeGradientState,
  ]);

  useEffect(
    () => () => {
      if (welcomeGradientTimerRef.current) {
        window.clearTimeout(welcomeGradientTimerRef.current);
        welcomeGradientTimerRef.current = null;
      }
    },
    [],
  );

  const fadeOutWelcomeGradient = () => {
    if (welcomeGradientState !== 'visible') return;

    if (welcomeGradientTimerRef.current) {
      window.clearTimeout(welcomeGradientTimerRef.current);
    }

    setWelcomeGradientDismissedTaskId(activeAssistantTaskId);
    setWelcomeGradientState('exiting');
    welcomeGradientTimerRef.current = window.setTimeout(() => {
      setWelcomeGradientState('hidden');
      welcomeGradientTimerRef.current = null;
    }, 520);
  };

  const sendAssistantMessage = (overrideText?: string) => {
    fadeOutWelcomeGradient();
    return handleAssistantSend(overrideText);
  };

  const startAssistantFlowWithGradientExit = (flow: 'idea' | 'starter' | 'revision' | 'future') => {
    fadeOutWelcomeGradient();
    return handleStartAssistantFlow(flow);
  };

  useEffect(() => {
    if (!cardGenerateOpen) return undefined;

    const handleWindowChange = () => updateCardGenerateMenuPosition();
    window.addEventListener('resize', handleWindowChange);
    window.addEventListener('scroll', handleWindowChange, true);
    return () => {
      window.removeEventListener('resize', handleWindowChange);
      window.removeEventListener('scroll', handleWindowChange, true);
    };
  }, [cardGenerateOpen]);

  useEffect(() => {
    if (!suggestMenuOpen) return undefined;

    const handleWindowChange = () => updateSuggestMenuPosition();
    window.addEventListener('resize', handleWindowChange);
    window.addEventListener('scroll', handleWindowChange, true);
    return () => {
      window.removeEventListener('resize', handleWindowChange);
      window.removeEventListener('scroll', handleWindowChange, true);
    };
  }, [suggestMenuOpen]);

  if (!shouldRender) return null;

  return (
    <aside
      className={`${
        isMobile
          ? 'assistant-panel-mobile fixed inset-y-0 right-0 z-[220] w-[min(26rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] shadow-sm'
          : `assistant-panel-desktop relative z-[80] shrink-0 border-l border-[var(--header-border)] shadow-sm ${showStats ? '' : 'assistant-panel-full-height'}`
      } assistant-panel-shell assistant-panel-chat-surface ${
        panelVisible ? 'assistant-panel-entered' : 'assistant-panel-exiting'
      } flex flex-col overflow-hidden bg-white/95 backdrop-blur-xl dark:bg-slate-950/95`}
      style={isMobile ? undefined : { width: assistantPanelWidth }}
      onTransitionEnd={handlePanelTransitionEnd}
    >
      {!isMobile && (
        <div
          onPointerDown={handleAssistantResizePointerDown}
          onPointerMove={handleAssistantResizePointerMove}
          onPointerUp={handleAssistantResizePointerUp}
          className="absolute bottom-0 left-0 top-0 z-20 w-2 -translate-x-1 cursor-ew-resize bg-transparent hover:bg-indigo-400/20"
          title={
            language === 'zh'
              ? '拖拽调整 AI 助手宽度'
              : language === 'ja'
                ? 'ドラッグしてAIアシスタントの幅を調整'
                : 'Drag to resize AI assistant'
          }
        />
      )}
      <div className="assistant-panel-header shrink-0 border-b border-slate-200 bg-slate-50/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="assistant-top-actions mb-2 flex items-center gap-2 overflow-hidden rounded-lg">
          <button
            onClick={handleNewAssistantTask}
            disabled={assistantLoading}
            className="assistant-glass-action assistant-glass-action-new flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-black text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
            title={
              language === 'zh' ? '新对话' : language === 'ja' ? '新しい会話' : 'New conversation'
            }
          >
            <PlusCircle className="h-3.5 w-3.5" />
            {language === 'zh' ? '新对话' : language === 'ja' ? '新しい会話' : 'New conversation'}
          </button>
          <button
            onClick={handleAssistantUndo}
            disabled={!canAssistantUndo || assistantLoading}
            className="assistant-glass-action assistant-glass-action-undo flex h-8 w-8 shrink-0 items-center justify-center text-slate-400 transition-colors hover:text-indigo-600 disabled:opacity-40 dark:hover:text-indigo-300"
            title={
              language === 'zh'
                ? '撤回最近一次助手对话文本'
                : language === 'ja'
                  ? '最後のアシスタントの会話を元に戻す'
                  : 'Undo assistant conversation text'
            }
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            onClick={handleAssistantRedo}
            disabled={!canAssistantRedo || assistantLoading}
            className="assistant-glass-action assistant-glass-action-redo flex h-8 w-8 shrink-0 items-center justify-center text-slate-400 transition-colors hover:text-indigo-600 disabled:opacity-40 dark:hover:text-indigo-300"
            title={
              language === 'zh'
                ? '恢复撤回的助手对话文本'
                : language === 'ja'
                  ? '元に戻したアシスタントの会話をやり直す'
                  : 'Redo assistant conversation text'
            }
          >
            <Redo2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setAssistantOpen(false)}
            className="assistant-glass-action assistant-glass-action-close flex h-8 w-8 shrink-0 items-center justify-center text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-white"
            title={
              language === 'zh'
                ? '关闭 AI 助手'
                : language === 'ja'
                  ? 'AIアシスタントを闭じる'
                  : 'Close AI Assistant'
            }
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="assistant-task-tabs custom-scrollbar flex gap-2 overflow-x-auto pb-1">
          {assistantTasks.map((task) => (
            <div
              key={task.id}
              className={`assistant-task-tab min-w-[128px] max-w-[176px] rounded-lg border px-2.5 py-1.5 transition-colors ${
                task.id === activeAssistantTaskId
                  ? 'border-indigo-300 bg-white text-indigo-700 shadow-sm dark:border-indigo-600 dark:bg-slate-800 dark:text-indigo-200'
                  : 'border-slate-200 bg-transparent text-slate-500 hover:bg-white dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
              title={task.title}
            >
              <div className="flex items-start gap-1.5">
                {editingTaskId === task.id ? (
                  <div className="min-w-0 flex-1 text-left">
                    <input
                      value={editingTaskTitle}
                      onChange={(event) => setEditingTaskTitle(event.target.value)}
                      onBlur={commitRenamingTask}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          commitRenamingTask();
                        }
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          setEditingTaskId(null);
                          setEditingTaskTitle('');
                        }
                      }}
                      autoFocus
                      className="w-full bg-transparent text-[11px] font-black outline-none"
                    />
                    <div className="truncate text-[9px] opacity-60">
                      {new Date(task.updatedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveAssistantTaskId(task.id)}
                    onDoubleClick={() => startRenamingTask(task)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="truncate text-[11px] font-black">{task.title}</div>
                    <div className="truncate text-[9px] opacity-60">
                      {new Date(task.updatedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleCloseAssistantTask(task.id)}
                  className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-slate-400 transition-colors hover:text-rose-500 dark:hover:text-rose-300"
                  title={
                    language === 'zh'
                      ? '关闭对话'
                      : language === 'ja'
                        ? '会話を閉じる'
                        : 'Close conversation'
                  }
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        ref={assistantMessagesRef}
        className={`assistant-message-area custom-scrollbar flex-1 space-y-3 overflow-y-auto px-4 py-4 ${
          showTransparentWelcomeGradient
            ? `assistant-message-transparent-gradient assistant-message-gradient-${welcomeGradientState}`
            : ''
        }`}
      >
        {visibleAssistantMessages.length === 0 && !assistantLoading && (
          <section className="assistant-welcome-card">
            <div className="assistant-welcome-hero">
              <div className="assistant-welcome-copy">
                <p className="assistant-welcome-kicker">
                  {language === 'zh' ? '我是你的 AI 剧本搭子' : 'Your AI story partner'}
                </p>
                <h2>{language === 'zh' ? '随时陪你把脑洞写成作品' : 'Ready to turn ideas into finished work'}</h2>
              </div>
              <img src="./glass.png" alt="" className="assistant-welcome-logo" />
            </div>
            <div className="assistant-welcome-prompts">
              <div className="assistant-welcome-prompt-title">
                {language === 'zh' ? '试试可以这样问我：' : 'Try asking me:'}
              </div>
              <div className="assistant-welcome-options">
                {welcomePrompts.map((item, index) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() =>
                      index === 0
                        ? void startAssistantFlowWithGradientExit('idea')
                        : void sendAssistantMessage(item.prompt)
                    }
                    disabled={assistantLoading}
                    className="assistant-welcome-option"
                  >
                    <span className="assistant-welcome-option-icon">{item.icon}</span>
                    <span className="assistant-welcome-option-copy">
                      <span className="assistant-welcome-option-title">{item.title}</span>
                      <span className="assistant-welcome-option-desc">{item.description}</span>
                    </span>
                    <ChevronDown className="assistant-welcome-option-arrow h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}
        {visibleAssistantMessages.map((message) =>
          message.role === 'thought' ? (
            <div key={message.id} className="flex justify-start">
              <button
                type="button"
                onClick={() => toggleAssistantThought(message.id)}
                className="assistant-message-bubble assistant-message-thought max-w-[88%] rounded-2xl rounded-bl-md border border-indigo-100 bg-indigo-50 px-3.5 py-2.5 text-left text-xs leading-relaxed text-indigo-700 transition-colors dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-200"
              >
                <div className="mb-1 flex items-center gap-2 font-black">
                  <BrainCircuit className="h-3.5 w-3.5" />
                  <span>
                    {message.collapsed
                      ? language === 'zh'
                        ? 'AI 已完成思考'
                        : language === 'ja'
                          ? 'AIの思考が完了しました'
                          : 'AI thought complete'
                      : language === 'zh'
                        ? 'AI 正在思考'
                        : language === 'ja'
                          ? 'AI思考中...'
                          : 'AI is thinking...'}
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${
                      message.collapsed ? '-rotate-90' : ''
                    }`}
                  />
                </div>
                {!message.collapsed && (
                  <div className="whitespace-pre-wrap text-indigo-700/90 dark:text-indigo-100/90">
                    {message.content}
                  </div>
                )}
              </button>
            </div>
          ) : (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`assistant-message-bubble max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  message.role === 'user'
                    ? 'assistant-message-user rounded-br-md bg-indigo-600 text-white'
                    : 'assistant-message-ai rounded-bl-md border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100'
                }`}
              >
                {message.content}
                {message.role === 'assistant' && message.options && message.options.length > 0 && (
                  <div className="mt-3 grid gap-2">
                    {message.options.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => void handleAssistantOptionSelect(option.value)}
                        disabled={assistantLoading}
                        className="rounded-xl border border-indigo-200 bg-white px-3 py-2 text-left transition-colors hover:border-indigo-400 hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-800 dark:bg-slate-950 dark:hover:bg-indigo-950/60"
                      >
                        <span className="block text-xs font-black text-indigo-700 dark:text-indigo-200">
                          {option.label}
                        </span>
                        {option.description && (
                          <span className="mt-1 block text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                            {option.description}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {message.role === 'assistant' &&
                  (message.cardPosition || (message.cardNodeIds?.length ?? 0) > 0) && (
                  <button
                    type="button"
                    onClick={() =>
                      onAssistantMessagePositionClick({
                        position: message.cardPosition,
                        nodeIds: message.cardNodeIds,
                      })
                    }
                    className="mt-2 flex h-7 items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-2.5 text-xs font-black text-indigo-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-slate-950 dark:text-indigo-300 dark:hover:bg-indigo-950/60"
                    title={
                      language === 'zh'
                        ? '跳转到生成卡片的位置'
                        : language === 'ja'
                          ? '生成したカードの位置へ移動'
                          : 'Jump to generated card position'
                    }
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    {language === 'zh' ? '位置' : language === 'ja' ? '位置' : 'Position'}
                  </button>
                )}
              </div>
            </div>
          ),
        )}
        {assistantLoading && (
          <div className="flex justify-start">
            <div className="assistant-message-bubble assistant-message-loading flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              {language === 'zh'
                ? '正在思考和整理卡片...'
                : language === 'ja'
                  ? '考え中およびカード整理中...'
                  : 'Thinking and organizing cards...'}
            </div>
          </div>
        )}
      </div>

      <div className="assistant-input-panel shrink-0 border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
        <div className="mb-2 flex items-center gap-2">
          <input
            ref={documentInputRef}
            type="file"
            multiple
            accept={uploadAccept}
            className="hidden"
            onChange={(event) => {
              handleDocumentFiles(event.target.files);
              event.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => documentInputRef.current?.click()}
            disabled={assistantLoading || assistantDocumentLoading}
            className="hidden"
            title={
              language === 'zh'
                ? '上传 PDF 或 Word 文档作为参考'
                : language === 'ja'
                  ? 'PDFまたはWordドキュメントを参考としてアップロード'
                  : 'Upload PDF or Word reference documents'
            }
          >
            {assistantDocumentLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <UploadCloud className="h-3.5 w-3.5" />
            )}
            <span>
              {language === 'zh' ? '参考文档' : language === 'ja' ? '参考ドキュメント' : 'Docs'}
            </span>
          </button>
          {assistantDocuments.length > 0 && (
            <div className="custom-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
              {assistantDocuments.map((document) => (
                <div
                  key={document.id}
                  className="flex h-8 max-w-[160px] shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                  title={document.name}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                  <span className="truncate">{document.name}</span>
                  <a
                    href={document.objectUrl}
                    download={document.name}
                    className="flex h-4 w-4 shrink-0 items-center justify-center text-slate-400 transition-colors hover:text-indigo-600"
                    title={
                      language === 'zh'
                        ? '下载文档'
                        : language === 'ja'
                          ? 'ドキュメントをダウンロード'
                          : 'Download document'
                    }
                  >
                    <Download className="h-3 w-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleRemoveAssistantDocument(document.id)}
                    className="flex h-4 w-4 shrink-0 items-center justify-center text-slate-400 transition-colors hover:text-rose-500"
                    title={
                      language === 'zh'
                        ? '移除文档'
                        : language === 'ja'
                          ? 'ドキュメントを削除'
                          : 'Remove document'
                    }
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="assistant-quick-actions mb-2 flex gap-2">
          <button
            ref={suggestButtonRef}
            type="button"
            onClick={toggleSuggestMenu}
            disabled={assistantLoading}
            className="assistant-bottom-glass-action assistant-bottom-action-suggest flex items-center justify-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-900/20 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {language === 'zh' ? '建议' : language === 'ja' ? '提案' : 'Suggest'}
            <ChevronDown
              className={`h-3 w-3 transition-transform ${suggestMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>
          <div className="relative flex-1">
            <button
              ref={cardGenerateButtonRef}
              type="button"
              onClick={toggleCardGenerateMenu}
              disabled={assistantLoading}
              className="assistant-bottom-glass-action assistant-bottom-action-generate flex w-full items-center justify-center gap-1 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-600 transition-colors hover:bg-indigo-100 disabled:opacity-50 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900"
            >
              {language === 'zh' ? '生成卡片' : language === 'ja' ? 'カード生成' : 'Generate cards'}
              <ChevronDown
                className={`h-3 w-3 transition-transform ${cardGenerateOpen ? 'rotate-180' : ''}`}
              />
            </button>
          </div>
          <button
            onClick={() =>
              sendAssistantMessage(
                language === 'zh'
                  ? '填充或修改选中的空白卡片。剧情卡片写标题和正文；人物设定卡片写人物名、性格、特点、背景；场景设定卡片写场景名、位置、物品、氛围。回复格式：按【已填字段】【补全理由】【可继续扩写】说明修改结果。'
                  : language === 'ja'
                    ? '選択した空白のカードを埋めるか、修正してください。ストーリーカードはタイトルと本文を書き、キャラクター設定カードはキャラクター名、性格、特徴、背景を書き、シーン設定カードはシーン名、場所、アイテム、雰囲気を書いてください。返答形式は【入力済みフィールド】【補完の理由】【さらなる展開案】に沿って修正結果を説明してください。'
                    : 'Fill in or modify the selected blank cards. Write title and body for story cards; character name, personality, traits, and background for character cards; scene name, location, items, and atmosphere for scene cards. Reply format: Explain the revision results in terms of [Filled Fields] [Reason for Completion] [Can Continue to Expand].',
              )
            }
            disabled={assistantLoading || selectedAssistantTargetNodesCount === 0}
            className="assistant-bottom-glass-action assistant-bottom-action-fill rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-600 transition-colors hover:bg-emerald-100 disabled:opacity-50 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900"
          >
            {language === 'zh' ? '填充选中' : language === 'ja' ? '選択を補完' : 'Fill selected'}
          </button>
        </div>
        <div className="assistant-input-box flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setDocumentUploadOpen(true)}
            disabled={assistantLoading || assistantDocumentLoading}
            className="assistant-input-icon-button flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:text-indigo-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:text-white"
            title={
              language === 'zh'
                ? '上传参考文件'
                : language === 'ja'
                  ? '参考ファイルをアップロード'
                  : 'Upload reference files'
            }
          >
            {assistantDocumentLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </button>
          <textarea
            ref={assistantInputRef}
            value={assistantInput}
            onChange={(event) => setAssistantInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void sendAssistantMessage();
              }
            }}
            placeholder={
              language === 'zh'
                ? '请你给我生成一个故事'
                : language === 'ja'
                  ? 'AIとストーリーを議論するか、キャラクターやシーン、ストーリーカードの生成や修正を依頼してください...'
                  : 'Discuss the story with AI, or ask it to generate or revise characters, scenes, and story cards...'
            }
            rows={2}
            className="custom-scrollbar max-h-28 flex-1 resize-none bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-white"
          />
          <button
            onClick={handleAssistantVoiceInput}
            disabled={assistantLoading || assistantListening}
            className={`hidden h-9 w-9 shrink-0 rounded-xl transition-colors ${
              assistantListening
                ? 'animate-pulse bg-rose-500 text-white'
                : 'assistant-input-icon-button border border-slate-200 bg-white text-slate-500 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:text-white'
            } flex items-center justify-center disabled:opacity-50`}
            title={language === 'zh' ? '语音输入' : language === 'ja' ? '音声入力' : 'Voice input'}
          >
            <Mic className="h-4 w-4" />
          </button>
          <button
            onClick={() => void sendAssistantMessage()}
            disabled={assistantLoading || !assistantInput.trim()}
            className="assistant-send-button flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600"
            title={language === 'zh' ? '发送' : language === 'ja' ? '送信' : 'Send'}
          >
            {assistantLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
      {cardGenerateOpen &&
        createPortal(
          <div
            className="fixed z-[380] w-64 -translate-y-full rounded-xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
            style={{
              left: cardGenerateMenuPosition.left,
              top: cardGenerateMenuPosition.top,
            }}
          >
            <button
              type="button"
              onClick={() =>
                applyAssistantTemplate(
                  language === 'zh'
                    ? '根据选中的卡片，生成并布置_张后续剧情卡片。'
                    : language === 'ja'
                      ? '選択したカードに基づいて、_枚のその後のストーリーカードを生成して配置してください。'
                      : 'Generate and place _ following story cards based on the selected cards.',
                )
              }
              disabled={assistantLoading}
              className="flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-bold text-slate-700 transition-colors hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-200"
            >
              <PlusCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {language === 'zh'
                  ? '生成并布置_张后续剧情卡片'
                  : language === 'ja'
                    ? '後続のストーリーカードを_枚生成して配置'
                    : 'Generate _ following story cards'}
              </span>
            </button>
            <button
              type="button"
              onClick={() =>
                applyAssistantTemplate(
                  language === 'zh'
                    ? '给我生成一个_的人物卡片'
                    : language === 'ja'
                      ? '_のキャラクターカードを1枚生成してください'
                      : 'Generate a character card for _',
                )
              }
              disabled={assistantLoading}
              className="flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-bold text-slate-700 transition-colors hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-200"
            >
              <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {language === 'zh'
                  ? '给我生成一个_的人物卡片'
                  : language === 'ja'
                    ? '_のキャラクターカードを生成'
                    : 'Generate a character card for _'}
              </span>
            </button>
            <button
              type="button"
              onClick={() =>
                applyAssistantTemplate(
                  language === 'zh'
                    ? '给我生成一个_的地点卡片'
                    : language === 'ja'
                      ? '_の場所カードを1枚生成してください'
                      : 'Generate a location card for _',
                )
              }
              disabled={assistantLoading}
              className="flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-bold text-slate-700 transition-colors hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-200"
            >
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {language === 'zh'
                  ? '给我生成一个_的地点卡片'
                  : language === 'ja'
                    ? '_の場所カードを生成'
                    : 'Generate a location card for _'}
              </span>
            </button>
          </div>,
          document.body,
        )}
      {suggestMenuOpen &&
        createPortal(
          <div
            className="fixed z-[380] w-64 -translate-y-full rounded-xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
            style={{
              left: suggestMenuPosition.left,
              top: suggestMenuPosition.top,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setSuggestMenuOpen(false);
                void handleStartAssistantFlow('starter');
              }}
              disabled={assistantLoading}
              className="flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-bold text-slate-700 transition-colors hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-200"
            >
              <SearchCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {language === 'zh'
                  ? '起手式'
                  : language === 'ja'
                    ? 'スタートガイド'
                    : 'Story Starter'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSuggestMenuOpen(false);
                void handleStartAssistantFlow('revision');
              }}
              disabled={assistantLoading}
              className="flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-bold text-slate-700 transition-colors hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-200"
            >
              <PencilLine className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {language === 'zh'
                  ? '修改意见'
                  : language === 'ja'
                    ? '修正意見'
                    : 'Revision Request'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSuggestMenuOpen(false);
                void handleStartAssistantFlow('future');
              }}
              disabled={assistantLoading}
              className="flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-bold text-slate-700 transition-colors hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-200"
            >
              <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {language === 'zh'
                  ? '未来写作建议'
                  : language === 'ja'
                    ? '将来の執筆提案'
                    : 'Future Writing Plan'}
              </span>
            </button>
          </div>,
          document.body,
        )}
      {documentUploadOpen && (
        <div className="fixed inset-0 z-[360] flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-black text-slate-800 dark:text-white">
                  {language === 'zh'
                    ? '上传文章文档'
                    : language === 'ja'
                      ? '参考ファイルをアップロード'
                      : 'Upload reference files'}
                </div>
                <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {language === 'zh'
                    ? '支持 PDF、Word 等文档，上传后可交给 AI 转成 galgame'
                    : language === 'ja'
                      ? 'PDF、Word、Excel、PPT、および一般的なテキストファイルをサポート'
                      : 'Supports PDF, Word, Excel, PPT, and common text files'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDocumentUploadOpen(false);
                  setDocumentDragActive(false);
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-900 dark:hover:text-white"
                title={language === 'zh' ? '关闭' : language === 'ja' ? '閉じる' : 'Close'}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => documentInputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                setDocumentDragActive(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setDocumentDragActive(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setDocumentDragActive(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                handleDocumentFiles(event.dataTransfer.files);
              }}
              disabled={assistantDocumentLoading}
              className={`flex min-h-44 w-full flex-col items-center justify-center rounded-xl border border-dashed p-5 text-center transition-colors disabled:opacity-60 ${
                documentDragActive
                  ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/50 dark:text-indigo-200'
                  : 'border-slate-300 bg-slate-50 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-600 dark:hover:bg-indigo-950/40'
              }`}
            >
              {assistantDocumentLoading ? (
                <Loader2 className="mb-3 h-8 w-8 animate-spin" />
              ) : (
                <UploadCloud className="mb-3 h-8 w-8" />
              )}
              <div className="text-sm font-black">
                {language === 'zh'
                  ? '拖拽 PDF 或 Word 文档到这里，或点击上传'
                  : language === 'ja'
                    ? 'ファイルをここにドラッグするか、クリックしてアップロード'
                    : 'Drop files here, or click to upload'}
              </div>
              <div className="mt-2 max-w-xs text-xs leading-relaxed opacity-80">
                {language === 'zh'
                  ? '为保证安全，只提取可读取的文本内容；不会执行宏、脚本或外部链接。旧版 .doc/.xls/.ppt 可能无法读取，请优先使用新版格式。'
                  : language === 'ja'
                    ? '安全のため、読み取り可能なテキスト内容のみが抽出されます。マクロ、スクリプト、または外部リンクは実行されません。旧バージョンの.doc/.xls/.pptファイルは読み取れない場合があります。新しいフォーマット（docx等）を優先して使用してください。'
                    : 'For safety, only readable text is extracted. Macros, scripts, and external links are not executed. Legacy .doc/.xls/.ppt files may not be readable; modern formats are preferred.'}
              </div>
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
