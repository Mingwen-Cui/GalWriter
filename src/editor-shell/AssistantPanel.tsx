import {
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  Download,
  FileText,
  Image,
  Lightbulb,
  Loader2,
  MapPin,
  Mic,
  Pause,
  PencilLine,
  Plus,
  PlusCircle,
  Redo2,
  RefreshCw,
  SearchCheck,
  Send,
  Trash2,
  Undo2,
  UploadCloud,
  UserRound,
  Video,
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

import type {
  AssistantArticleAnalysisState,
  AssistantInputContext,
} from '../editor-features/assistant/useAssistantPanel';
import type { AssistantMessage, AssistantTask } from '../editor-state/editorConfig';
import type { AssistantDocument } from '../lib/documentReader';
import type { Language } from '../lib/i18n';
import { assistantPanelCopy } from './i18n/assistant';

interface AssistantPanelProps {
  assistantOpen: boolean;
  isMobile: boolean;
  assistantPanelWidth: number;
  assistantLoading: boolean;
  assistantListening: boolean;
  assistantDocuments: AssistantDocument[];
  assistantDocumentLoading: boolean;
  assistantArticleAnalysis: AssistantArticleAnalysisState;
  assistantInput: string;
  assistantInputContexts: AssistantInputContext[];
  assistantTasks: AssistantTask[];
  activeAssistantTaskId: string;
  assistantMessages: AssistantMessage[];
  assistantMessagesRef: MutableRefObject<HTMLDivElement | null>;
  setAssistantOpen: Dispatch<SetStateAction<boolean>>;
  setAssistantInput: Dispatch<SetStateAction<string>>;
  setAssistantInputContexts: Dispatch<SetStateAction<AssistantInputContext[]>>;
  handleSelectAssistantTask: (taskId: string) => void;
  handleNewAssistantTask: () => void;
  handleRenameAssistantTask: (taskId: string, title: string) => void;
  handleCloseAssistantTask: (taskId: string) => void;
  handleAssistantSend: (overrideText?: string) => Promise<void>;
  handleStopAssistantGeneration: () => void;
  handleAssistantOptionSelect: (value: string) => Promise<void>;
  handleStartAssistantFlow: (
    flow: 'idea' | 'profile' | 'starter' | 'revision' | 'future',
  ) => Promise<void>;
  handleAssistantDocumentUpload: (
    files: FileList | null,
    intent?: 'article-to-galgame',
  ) => Promise<void>;
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

const SHORT_DRAMA_TEST_PROMPTS = {
  zh: [
    '生成一个关于失忆少女在雨夜便利店遇见未来自己的短剧。',
    '生成一个关于落魄编剧和过气偶像被迫同居三天的短剧。',
    '生成一个关于外卖员误送一封来自十年后的信的短剧。',
    '生成一个关于天才黑客发现自己的恋人是AI客服的短剧。',
    '生成一个关于小镇医生隐瞒末日倒计时真相的短剧。',
    '生成一个关于婚礼当天新郎突然变成陌生人的短剧。',
    '生成一个关于高中同桌在同一天循环里互相拯救的短剧。',
    '生成一个关于职场新人发现老板每天都会重启记忆的短剧。',
    '生成一个关于咖啡店老板只接待失恋者的奇幻短剧。',
    '生成一个关于退役刑警和网络主播联手追查旧案的短剧。',
  ],
  ja: [
    '雨の夜のコンビニで記憶喪失の少女が未来の自分に出会う短編ドラマを生成してください。',
    '落ちぶれた脚本家と元人気アイドルが三日間だけ同居する短編ドラマを生成してください。',
    '配達員が十年後から届いた手紙を誤配する短編ドラマを生成してください。',
    '天才ハッカーが恋人はAIカスタマーサポートだと知る短編ドラマを生成してください。',
    '田舎町の医師が終末へのカウントダウンを隠す短編ドラマを生成してください。',
    '結婚式当日に新郎が突然別人になる短編ドラマを生成してください。',
    '高校時代の同級生二人が同じ一日を繰り返しながら救い合う短編ドラマを生成してください。',
    '新人社員が上司の記憶は毎日リセットされると気づく短編ドラマを生成してください。',
    '失恋した人だけを迎える喫茶店のファンタジー短編ドラマを生成してください。',
    '元刑事と配信者が未解決事件を追う短編ドラマを生成してください。',
  ],
  en: [
    'Generate a short drama about an amnesiac girl meeting her future self in a convenience store on a rainy night.',
    'Generate a short drama about a washed-up screenwriter and a fading idol forced to live together for three days.',
    'Generate a short drama about a delivery rider accidentally delivering a letter from ten years in the future.',
    'Generate a short drama about a genius hacker discovering their lover is an AI support agent.',
    'Generate a short drama about a small-town doctor hiding the truth about a countdown to the end of the world.',
    'Generate a short drama about a groom suddenly becoming a stranger on his wedding day.',
    'Generate a short drama about two former classmates saving each other inside the same repeating day.',
    'Generate a short drama about a new employee discovering their boss resets their memory every day.',
    'Generate a fantasy short drama about a cafe owner who only serves people with broken hearts.',
    'Generate a short drama about a retired detective and a livestreamer investigating a cold case together.',
  ],
};

const getShortDramaTestPrompts = (language: Language) =>
  language === 'zh'
    ? SHORT_DRAMA_TEST_PROMPTS.zh
    : language === 'ja'
      ? SHORT_DRAMA_TEST_PROMPTS.ja
      : SHORT_DRAMA_TEST_PROMPTS.en;

type AssistantContextPreviewCardProps = {
  title: string;
  contextBadge: string;
  imageUrl?: string;
  text?: string;
  onShowCards?: () => void;
  showCardsLabel?: string;
  onRemove?: () => void;
  removeLabel?: string;
};

const AssistantContextPreviewCard = ({
  title,
  contextBadge,
  imageUrl,
  text,
  onShowCards,
  showCardsLabel,
  onRemove,
  removeLabel,
}: AssistantContextPreviewCardProps) => (
  <article className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <header className="flex items-center justify-between gap-3 px-3.5 py-3">
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-500">
          {contextBadge}
        </div>
        <h3 className="mt-0.5 truncate text-sm font-black text-slate-900 dark:text-slate-100">
          {title}
        </h3>
      </div>
      {(onShowCards || onRemove) && (
        <div className="flex shrink-0 flex-col items-center gap-1">
          {onShowCards && (
            <button
              type="button"
              onClick={onShowCards}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
              title={showCardsLabel}
              aria-label={showCardsLabel}
            >
              <MapPin className="h-4 w-4" />
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              title={removeLabel}
              aria-label={removeLabel}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </header>
    {imageUrl && (
      <img src={imageUrl} alt="" className="aspect-video w-full bg-slate-100 object-cover" />
    )}
    {text && (
      <p className="m-0 whitespace-pre-wrap px-3.5 py-3 text-xs leading-5 text-slate-600 dark:text-slate-300">
        {text}
      </p>
    )}
  </article>
);

export function AssistantPanel({
  assistantOpen,
  isMobile,
  assistantPanelWidth,
  assistantLoading,
  assistantListening,
  assistantDocuments,
  assistantDocumentLoading,
  assistantArticleAnalysis,
  assistantInput,
  assistantInputContexts,
  assistantTasks,
  activeAssistantTaskId,
  assistantMessages,
  assistantMessagesRef,
  setAssistantOpen,
  setAssistantInput,
  setAssistantInputContexts,
  handleSelectAssistantTask,
  handleNewAssistantTask,
  handleRenameAssistantTask,
  handleCloseAssistantTask,
  handleAssistantSend,
  handleStopAssistantGeneration,
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
  const ui = assistantPanelCopy(language);
  const activeAssistantTask = assistantTasks.find((task) => task.id === activeAssistantTaskId);
  const isCardReviewTask = activeAssistantTask?.kind === 'card-review';
  const [shouldRender, setShouldRender] = useState(assistantOpen);
  const [panelVisible, setPanelVisible] = useState(assistantOpen);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState('');
  const [documentUploadOpen, setDocumentUploadOpen] = useState(false);
  const [documentUploadIntent, setDocumentUploadIntent] = useState<'article-to-galgame' | null>(
    null,
  );
  const [articleUploadStage, setArticleUploadStage] = useState<'upload' | 'analyzing' | 'ready'>(
    'upload',
  );
  const [expandedArticleAnalysisSteps, setExpandedArticleAnalysisSteps] = useState<Set<string>>(
    () => new Set(),
  );
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
  const [shortDramaPromptIndex, setShortDramaPromptIndex] = useState<number | null>(null);
  const [assistantInputFocused, setAssistantInputFocused] = useState(false);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const assistantInputRef = useRef<HTMLTextAreaElement | null>(null);
  const cardGenerateButtonRef = useRef<HTMLButtonElement | null>(null);
  const suggestButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeAnimationTimerRef = useRef<number | null>(null);
  const welcomeGradientTimerRef = useRef<number | null>(null);
  const showArticleUploadPage = documentUploadOpen && documentUploadIntent === 'article-to-galgame';
  const assistantInputExpanded =
    assistantInputFocused || assistantInput.trim().length > 0 || assistantInputContexts.length > 0;
  const selectedCardContexts = assistantInputContexts.filter(
    (context) => context.source === 'selection',
  );
  const composerInputContexts = assistantInputContexts.filter(
    (context) => context.source !== 'selection',
  );
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

  useEffect(() => {
    const input = assistantInputRef.current;
    if (!input) return;

    if (!assistantInputExpanded) {
      input.style.height = '36px';
      input.style.overflowY = 'hidden';
      return;
    }

    const maxHeight = 192;
    input.style.height = 'auto';
    const nextHeight = Math.min(input.scrollHeight, maxHeight);
    input.style.height = `${nextHeight}px`;
    input.style.overflowY = input.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [assistantInput, assistantInputExpanded, assistantOpen]);

  useEffect(() => {
    if (!assistantInputExpanded || !assistantInputFocused) return;
    window.requestAnimationFrame(() => {
      assistantInputRef.current?.focus();
    });
  }, [assistantInputExpanded, assistantInputFocused]);

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

  const handleDocumentFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setDocumentDragActive(false);
    const isArticleUpload = documentUploadIntent === 'article-to-galgame';

    if (isArticleUpload) {
      setArticleUploadStage('analyzing');
      await handleAssistantDocumentUpload(files, 'article-to-galgame');
      setArticleUploadStage('ready');
      return;
    }

    await handleAssistantDocumentUpload(files);
    setDocumentUploadOpen(false);
    setDocumentUploadIntent(null);
  };

  const applyAssistantTemplate = (template: string) => {
    const cursorIndex = template.indexOf('_');
    setAssistantInput(template);
    setShortDramaPromptIndex(null);
    setCardGenerateOpen(false);
    setSuggestMenuOpen(false);
    window.requestAnimationFrame(() => {
      const input = assistantInputRef.current;
      if (!input) return;
      input.focus();
      if (cursorIndex >= 0) input.setSelectionRange(cursorIndex, cursorIndex + 1);
    });
  };

  const applyShortDramaTestPrompt = (nextIndex?: number) => {
    const prompts = getShortDramaTestPrompts(language);
    const index =
      typeof nextIndex === 'number' ? nextIndex : Math.floor(Math.random() * prompts.length);
    const prompt = prompts[index];
    const bundleInstruction =
      language === 'zh'
        ? `${prompt}\n\n请像“我有一个新脑洞”一样扩展：先生成主要人物设定卡和核心场景设定卡，再生成 6 到 10 张按顺序推进的剧情卡。人物、场景和剧情要互相对应。`
        : language === 'ja'
          ? `${prompt}\n\n「新しいアイデア」と同じように展開してください。主要キャラクター設定カードと中心シーン設定カードを先に作り、その後に順番に進む6から10枚のストーリーカードを生成してください。人物、場所、剧情が互いに対応するようにしてください。`
          : `${prompt}\n\nExpand this like a new story idea: create the main character setting cards and core scene setting cards first, then generate 6 to 10 ordered story cards. The characters, scenes, and plot beats should match each other.`;
    setShortDramaPromptIndex(index);
    setAssistantInput(bundleInstruction);
    window.requestAnimationFrame(() => {
      assistantInputRef.current?.focus();
    });
  };

  const replaceShortDramaTestPrompt = () => {
    const prompts = getShortDramaTestPrompts(language);
    if (prompts.length <= 1) {
      applyShortDramaTestPrompt(0);
      return;
    }

    let nextIndex = Math.floor(Math.random() * prompts.length);
    if (shortDramaPromptIndex !== null && nextIndex === shortDramaPromptIndex) {
      nextIndex = (nextIndex + 1) % prompts.length;
    }
    applyShortDramaTestPrompt(nextIndex);
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

  const welcomePrompts = [
    {
      icon: <UserRound className="h-4 w-4" />,
      action: 'profile' as const,
      ...ui.profileFlow.welcome,
    },
    {
      icon: <PencilLine className="h-4 w-4" />,
      action: 'continue' as const,
      ...ui.welcomePrompts.continue,
    },
    {
      icon: <SearchCheck className="h-4 w-4" />,
      action: 'article' as const,
      ...ui.welcomePrompts.article,
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
    setShortDramaPromptIndex(null);
    return handleAssistantSend(overrideText);
  };

  const startAssistantFlowWithGradientExit = (
    flow: 'idea' | 'profile' | 'starter' | 'revision' | 'future',
  ) => {
    fadeOutWelcomeGradient();
    return handleStartAssistantFlow(flow);
  };

  const openArticleUploadFlow = () => {
    fadeOutWelcomeGradient();
    setDocumentUploadIntent('article-to-galgame');
    setArticleUploadStage('upload');
    setDocumentUploadOpen(true);
  };

  const closeDocumentUpload = () => {
    setDocumentUploadOpen(false);
    setDocumentDragActive(false);
    setDocumentUploadIntent(null);
    setArticleUploadStage('upload');
    setExpandedArticleAnalysisSteps(new Set());
  };

  const selectArticleTeachingMode = (mode: 'interactive' | 'lecture') => {
    setDocumentUploadOpen(false);
    setDocumentDragActive(false);
    setDocumentUploadIntent(null);
    setArticleUploadStage('upload');
    setExpandedArticleAnalysisSteps(new Set());
    void handleAssistantOptionSelect(`__article_teach__:${mode}`);
  };

  const toggleArticleAnalysisStep = (stepTitle: string) => {
    setExpandedArticleAnalysisSteps((current) => {
      const next = new Set(current);
      if (next.has(stepTitle)) {
        next.delete(stepTitle);
      } else {
        next.add(stepTitle);
      }
      return next;
    });
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

  const articleDocumentCount = assistantDocuments.length;
  const articleDocumentCharCount = assistantDocuments.reduce(
    (sum, document) => sum + document.charCount,
    0,
  );
  const articleDocumentSummary =
    articleDocumentCount > 0
      ? ui.articleFlow.documentSummary
          .replace('{count}', String(articleDocumentCount))
          .replace('{characters}', articleDocumentCharCount.toLocaleString())
      : ui.articleFlow.documentSummaryEmpty;
  const articleAnalysisSteps = assistantArticleAnalysis.steps;
  const effectiveArticleStage =
    assistantArticleAnalysis.status === 'ready'
      ? 'ready'
      : assistantArticleAnalysis.status === 'reading' ||
          assistantArticleAnalysis.status === 'analyzing' ||
          assistantArticleAnalysis.status === 'error'
        ? 'analyzing'
        : articleUploadStage;
  const articleAnalysisSummary = assistantArticleAnalysis.summary || articleDocumentSummary;

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
            title={ui.newConversation}
          >
            <PlusCircle className="h-3.5 w-3.5" />
            {ui.newConversation}
          </button>
          {assistantLoading && (
            <button
              type="button"
              onClick={handleStopAssistantGeneration}
              className="assistant-glass-action flex h-8 shrink-0 items-center justify-center gap-1 rounded-lg bg-rose-50 px-2 text-xs font-black text-rose-600 transition-colors hover:bg-rose-100 dark:bg-rose-500/15 dark:text-rose-200 dark:hover:bg-rose-500/25"
              title={language === 'zh' ? '停止生成' : language === 'ja' ? '生成を停止' : 'Stop generation'}
            >
              <Pause className="h-3.5 w-3.5" />
              <span>{language === 'zh' ? '停止' : language === 'ja' ? '停止' : 'Stop'}</span>
            </button>
          )}
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
                    onClick={() => handleSelectAssistantTask(task.id)}
                    onDoubleClick={() => startRenamingTask(task)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-black">
                      {task.loading ? (
                        <Loader2
                          className="h-3 w-3 shrink-0 animate-spin"
                          aria-label={ui.cardReview.analyzing}
                        />
                      ) : task.unread ? (
                        <span
                          className="h-2 w-2 shrink-0 rounded-full bg-indigo-500"
                          aria-label={ui.cardReview.complete}
                        />
                      ) : null}
                      <span className="truncate">{task.title}</span>
                    </div>
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

      <div
        ref={assistantMessagesRef}
        className={`assistant-message-area custom-scrollbar flex-1 space-y-3 overflow-y-auto px-4 py-4 ${
          showTransparentWelcomeGradient && !showArticleUploadPage
            ? `assistant-message-transparent-gradient assistant-message-gradient-${welcomeGradientState}`
            : ''
        }`}
      >
        {showArticleUploadPage ? (
          <section className="assistant-article-upload-page">
            <div className="assistant-article-upload-topbar">
              <button
                type="button"
                onClick={closeDocumentUpload}
                className="assistant-article-upload-back"
                title={ui.back}
              >
                <ChevronDown className="h-4 w-4 rotate-90" />
              </button>
              <button
                type="button"
                onClick={closeDocumentUpload}
                className="assistant-article-upload-close"
                title={ui.close}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="assistant-article-upload-hero">
              <div className="assistant-article-upload-icon">
                {effectiveArticleStage === 'upload' ? (
                  <FileText className="h-7 w-7" />
                ) : effectiveArticleStage === 'analyzing' ? (
                  <Loader2 className="h-7 w-7 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-7 w-7" />
                )}
              </div>
              <p className="assistant-article-upload-kicker">{ui.articleToGalgame}</p>
              <h2>
                {effectiveArticleStage === 'upload'
                  ? ui.articleFlow.uploadTitle
                  : effectiveArticleStage === 'analyzing'
                    ? assistantArticleAnalysis.status === 'error'
                      ? ui.articleFlow.errorTitle
                      : ui.articleFlow.analyzingTitle
                    : ui.articleFlow.readyTitle}
              </h2>
              <p>
                {effectiveArticleStage === 'upload'
                  ? ui.articleFlow.uploadDescription
                  : articleAnalysisSummary}
              </p>
            </div>
            {effectiveArticleStage === 'upload' ? (
              <>
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
                    void handleDocumentFiles(event.dataTransfer.files);
                  }}
                  disabled={assistantDocumentLoading}
                  className={`assistant-article-upload-dropzone ${
                    documentDragActive ? 'assistant-article-upload-dropzone-active' : ''
                  }`}
                >
                  <UploadCloud className="h-9 w-9" />
                  <span className="assistant-article-upload-drop-title">
                    {ui.articleFlow.dropTitle}
                  </span>
                  <span className="assistant-article-upload-drop-subtitle">
                    {ui.articleFlow.dropDescription}
                  </span>
                </button>
                <div className="assistant-article-upload-steps">
                  <div>
                    <span>1</span>
                    <p>{ui.uploadArticle}</p>
                  </div>
                  <div>
                    <span>2</span>
                    <p>{ui.showAnalysis}</p>
                  </div>
                  <div>
                    <span>3</span>
                    <p>{ui.generateChapterRegions}</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="assistant-article-analysis-card">
                  <div className="assistant-article-analysis-card-title">
                    <BrainCircuit className="h-4 w-4" />
                    <span>
                      {effectiveArticleStage === 'analyzing'
                        ? assistantArticleAnalysis.status === 'error'
                          ? ui.articleFlow.analysisFailed
                          : ui.articleFlow.analysisRunning
                        : ui.articleFlow.analysisComplete}
                    </span>
                  </div>
                  <div className="assistant-article-analysis-timeline">
                    {articleAnalysisSteps.map((step, index) => {
                      const state = step.status;
                      const lastDoneStepIndex = articleAnalysisSteps.reduce(
                        (lastIndex, currentStep, currentIndex) =>
                          currentStep.status === 'done' ? currentIndex : lastIndex,
                        -1,
                      );
                      const isAutoExpanded =
                        state === 'active' ||
                        state === 'error' ||
                        (state === 'done' && index === lastDoneStepIndex);
                      const isExpanded =
                        isAutoExpanded || expandedArticleAnalysisSteps.has(step.title);
                      const canToggle = state === 'done' || state === 'error';
                      return (
                        <div
                          key={step.title}
                          className={`assistant-article-analysis-step assistant-article-analysis-step-${state} ${
                            isExpanded ? 'assistant-article-analysis-step-expanded' : ''
                          }`}
                        >
                          <span className="assistant-article-analysis-marker">
                            {state === 'done' ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : state === 'active' ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : state === 'error' ? (
                              <X className="h-4 w-4" />
                            ) : null}
                          </span>
                          <div>
                            <button
                              type="button"
                              onClick={() => canToggle && toggleArticleAnalysisStep(step.title)}
                              disabled={!canToggle}
                              className="assistant-article-analysis-step-title"
                            >
                              <strong>{step.title}</strong>
                              {canToggle && (
                                <ChevronDown
                                  className={`h-3.5 w-3.5 transition-transform ${
                                    isExpanded ? 'rotate-180' : ''
                                  }`}
                                />
                              )}
                            </button>
                            {isExpanded && (
                              <>
                                <p>{step.detail}</p>
                                {step.evidence && (
                                  <p className="assistant-article-analysis-evidence">
                                    {step.evidence}
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {effectiveArticleStage === 'ready' && (
                  <div className="assistant-article-teach-choice">
                    <p>{ui.articleFlow.learningPrompt}</p>
                    <button
                      type="button"
                      onClick={() => void handleAssistantOptionSelect('__article_roles_create__')}
                    >
                      <span>{ui.generateCharacters}</span>
                      <small>{ui.articleFlow.characterDescription}</small>
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        ) : visibleAssistantMessages.length === 0 &&
          selectedCardContexts.length === 0 &&
          !assistantLoading ? (
          <section className="assistant-welcome-card">
            <div className="assistant-welcome-hero">
              <div className="assistant-welcome-copy">
                <p className="assistant-welcome-kicker">{ui.storyPartner}</p>
                <h2>{ui.heroTitle}</h2>
              </div>
              <img src="./glass.png" alt="" className="assistant-welcome-logo" />
            </div>
            <div className="assistant-welcome-prompts">
              <div className="assistant-welcome-prompt-title">{ui.tryAsking}</div>
              <div className="assistant-welcome-options">
                {welcomePrompts.map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => {
                      if (item.action === 'profile') {
                        void startAssistantFlowWithGradientExit('profile');
                        return;
                      }
                      if (item.action === 'article') {
                        openArticleUploadFlow();
                        return;
                      }
                      void sendAssistantMessage(item.prompt);
                    }}
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
        ) : null}
        {!showArticleUploadPage &&
          visibleAssistantMessages.map((message) =>
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
                  className={`assistant-message-bubble whitespace-pre-wrap text-sm leading-relaxed ${
                    message.contextPreviews?.length
                      ? 'w-full max-w-[94%]'
                      : message.role === 'user'
                        ? 'assistant-message-user rounded-br-md bg-indigo-600 text-white'
                        : 'assistant-message-ai rounded-bl-md border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100'
                  } ${message.contextPreviews?.length ? '' : 'max-w-[88%] rounded-2xl px-3.5 py-2.5'}`}
                >
                  {message.contextPreviews && message.contextPreviews.length > 0 && (
                    <div className="grid gap-2">
                      {message.contextPreviews.map((preview) => (
                        <AssistantContextPreviewCard
                          key={preview.id}
                          title={preview.title}
                          contextBadge={preview.label || ui.cardReview.contextBadge}
                          imageUrl={preview.imageUrl}
                          text={preview.text}
                        />
                      ))}
                    </div>
                  )}
                  {message.contextPreviews?.length && !isCardReviewTask ? (
                    <div className="mt-2 ml-auto w-fit max-w-[88%] rounded-2xl rounded-br-md bg-indigo-600 px-3.5 py-2.5 text-white">
                      {message.content}
                    </div>
                  ) : (
                    message.content
                  )}
                  {message.role === 'assistant' &&
                    message.options &&
                    message.options.length > 0 && (
                      <div className={`grid gap-2 ${isCardReviewTask ? 'mt-2' : 'mt-3'}`}>
                        {message.options.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => void handleAssistantOptionSelect(option.value)}
                            disabled={assistantLoading}
                            className={`rounded-xl border px-3 py-2 text-left transition-colors disabled:opacity-50 dark:border-indigo-800 dark:bg-slate-950 dark:hover:bg-indigo-950/60 ${
                              option.selected
                                ? 'border-indigo-500 bg-indigo-50 text-indigo-800 dark:border-indigo-500 dark:bg-indigo-950/70 dark:text-indigo-100'
                                : 'border-indigo-200 bg-white hover:border-indigo-400 hover:bg-indigo-50'
                            }`}
                          >
                            <span className="flex items-center justify-between gap-2 text-xs font-black text-indigo-700 dark:text-indigo-200">
                              <span className="flex items-center gap-1.5">
                              {option.selected && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
                              {option.label}
                              </span>
                              {isCardReviewTask && (
                                <span className="shrink-0 text-[10px] font-bold text-indigo-500 dark:text-indigo-300">
                                  {ui.cardReview.useSuggestion} ›
                                </span>
                              )}
                            </span>
                            {option.description && (
                              <span className="mt-1 block line-clamp-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
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
                        {ui.position}
                      </button>
                    )}
                </div>
              </div>
            ),
          )}
        {!showArticleUploadPage && assistantLoading && (
          <div className="flex justify-start">
            <div className="assistant-message-bubble assistant-message-loading flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              {activeAssistantTask?.kind === 'card-review'
                ? ui.cardReview.analyzing
                : language === 'zh'
                  ? '正在思考和整理卡片...'
                  : language === 'ja'
                    ? '考え中およびカード整理中...'
                    : 'Thinking and organizing cards...'}
            </div>
          </div>
        )}
      </div>

      {!showArticleUploadPage && (
        <div className="assistant-input-panel shrink-0 border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
          <div className="mb-2 flex items-center gap-2">
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
              <span>{ui.documents}</span>
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
          <div className="assistant-quick-actions mb-2 flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => applyShortDramaTestPrompt()}
              disabled={assistantLoading}
              className="assistant-bottom-glass-action assistant-bottom-action-short-drama flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-orange-100 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:bg-orange-50 disabled:opacity-50 dark:border-orange-400/20 dark:bg-slate-900/80 dark:text-slate-100 dark:hover:bg-orange-950/40"
            >
              <PencilLine className="h-3.5 w-3.5 text-orange-500" />
              {ui.shortDrama}
            </button>
            <div className="relative shrink-0">
              <button
                ref={cardGenerateButtonRef}
                type="button"
                onClick={toggleCardGenerateMenu}
                disabled={assistantLoading}
                className="assistant-bottom-glass-action assistant-bottom-action-generate flex items-center justify-center gap-1 rounded-full border border-indigo-100 bg-white px-3.5 py-1.5 text-xs font-bold text-indigo-600 shadow-sm transition-colors hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-400/20 dark:bg-slate-900/80 dark:text-indigo-300 dark:hover:bg-indigo-950/50"
              >
                {ui.generateCards}
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${cardGenerateOpen ? 'rotate-180' : ''}`}
                />
              </button>
            </div>
            <button
              ref={suggestButtonRef}
              type="button"
              onClick={toggleSuggestMenu}
              disabled={assistantLoading}
              className="assistant-bottom-glass-action assistant-bottom-action-suggest flex shrink-0 items-center justify-center gap-1 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {ui.suggestions}
              <ChevronDown
                className={`h-3 w-3 transition-transform ${suggestMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>
          </div>
          <div
            className={`assistant-input-box overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 transition-all duration-300 ease-out dark:border-slate-800 dark:bg-slate-900 ${
              assistantInputExpanded ? 'flex flex-col gap-2 p-3' : 'flex items-center gap-2 p-2'
            }`}
          >
            {assistantInputExpanded ? (
              <>
                {selectedCardContexts.length > 0 && (
                  <div className="custom-scrollbar flex min-w-0 gap-2 overflow-x-auto pb-1">
                    {selectedCardContexts.map((context) => (
                      <div key={`pending:${context.id}`} className="w-56 shrink-0">
                        <AssistantContextPreviewCard
                          title={context.title}
                          contextBadge={context.previewLabel || ui.cardReview.contextBadge}
                          imageUrl={context.previewImageUrl}
                          text={context.previewText}
                          onShowCards={
                            context.nodeIds?.length
                              ? () => onAssistantMessagePositionClick({ nodeIds: context.nodeIds })
                              : undefined
                          }
                          showCardsLabel={ui.cardReview.showSelectedCards}
                          onRemove={() =>
                            setAssistantInputContexts((contexts) =>
                              contexts.filter((item) => item.id !== context.id),
                            )
                          }
                          removeLabel={ui.cardReview.removeAttachment}
                        />
                      </div>
                    ))}
                  </div>
                )}
                {composerInputContexts.length > 0 && (
                  <div className="custom-scrollbar flex min-w-0 items-center gap-2 overflow-x-auto pb-1">
                    {composerInputContexts.map((context) => (
                      <div
                        key={context.id}
                        className="flex shrink-0 items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-2.5 py-2 text-xs text-indigo-900 dark:border-indigo-400/30 dark:bg-indigo-500/10 dark:text-indigo-100"
                      >
                        <span className="max-w-28 truncate font-semibold">{context.title}</span>
                        {context.cardCount > 0 && (
                          <span className="flex items-center gap-1 text-indigo-600/80 dark:text-indigo-200/75">
                            <FileText className="h-3.5 w-3.5" />×{context.cardCount}
                          </span>
                        )}
                        {context.assetCounts.images > 0 && (
                          <span className="flex items-center gap-1 text-indigo-600/80 dark:text-indigo-200/75">
                            <Image className="h-3.5 w-3.5" />×{context.assetCounts.images}
                          </span>
                        )}
                        {context.assetCounts.videos > 0 && (
                          <span className="flex items-center gap-1 text-indigo-600/80 dark:text-indigo-200/75">
                            <Video className="h-3.5 w-3.5" />×{context.assetCounts.videos}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setAssistantInputContexts((contexts) =>
                              contexts.filter((item) => item.id !== context.id),
                            )
                          }
                          className="-mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-indigo-600 transition-colors hover:bg-indigo-100 hover:text-indigo-800 dark:text-indigo-200 dark:hover:bg-indigo-400/20 dark:hover:text-white"
                          title={
                            language === 'zh'
                              ? '移除区域内容'
                              : language === 'ja'
                                ? 'エリア内容を削除'
                                : 'Remove area content'
                          }
                          aria-label={
                            language === 'zh'
                              ? '移除区域内容'
                              : language === 'ja'
                                ? 'エリア内容を削除'
                                : 'Remove area content'
                          }
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <textarea
                  ref={assistantInputRef}
                  value={assistantInput}
                  onChange={(event) => {
                    setAssistantInput(event.target.value);
                    setShortDramaPromptIndex(null);
                  }}
                  onFocus={() => setAssistantInputFocused(true)}
                  onBlur={() => setAssistantInputFocused(false)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void sendAssistantMessage();
                    }
                  }}
                  placeholder={ui.inputPlaceholder}
                  rows={3}
                  className="custom-scrollbar max-h-48 min-h-[4.75rem] w-full flex-1 resize-none bg-transparent text-sm text-slate-800 outline-none transition-[height] duration-300 ease-out placeholder:text-slate-400 dark:text-white"
                />
                <div className="flex w-full shrink-0 items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDocumentUploadIntent(null);
                      setDocumentUploadOpen(true);
                    }}
                    disabled={assistantLoading || assistantDocumentLoading}
                    className="assistant-input-icon-button flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:text-indigo-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:text-white"
                    aria-label={
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
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleAssistantVoiceInput}
                      disabled={assistantLoading || assistantListening}
                      className={`hidden h-9 w-9 shrink-0 rounded-xl transition-colors ${
                        assistantListening
                          ? 'animate-pulse bg-rose-500 text-white'
                          : 'assistant-input-icon-button border border-slate-200 bg-white text-slate-500 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:text-white'
                      } flex items-center justify-center disabled:opacity-50`}
                      title={
                        language === 'zh'
                          ? '语音输入'
                          : language === 'ja'
                            ? '音声入力'
                            : 'Voice input'
                      }
                    >
                      <Mic className="h-4 w-4" />
                    </button>
                    {shortDramaPromptIndex !== null && (
                      <button
                        type="button"
                        onClick={replaceShortDramaTestPrompt}
                        disabled={assistantLoading}
                        className="assistant-input-icon-button flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:text-indigo-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:text-white"
                        aria-label={
                          language === 'zh'
                            ? '换一个测试句'
                            : language === 'ja'
                              ? '別のテスト文に変更'
                              : 'Try another prompt'
                        }
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => void sendAssistantMessage()}
                      disabled={
                        assistantLoading ||
                        (!assistantInput.trim() && assistantInputContexts.length === 0)
                      }
                      className="assistant-send-button flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600"
                      title={ui.send}
                    >
                      {assistantLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setDocumentUploadIntent(null);
                    setDocumentUploadOpen(true);
                  }}
                  disabled={assistantLoading || assistantDocumentLoading}
                  className="assistant-input-icon-button flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:text-indigo-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:text-white"
                  aria-label={
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
                  onChange={(event) => {
                    setAssistantInput(event.target.value);
                    setShortDramaPromptIndex(null);
                  }}
                  onFocus={() => setAssistantInputFocused(true)}
                  onBlur={() => setAssistantInputFocused(false)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void sendAssistantMessage();
                    }
                  }}
                  placeholder={ui.inputPlaceholder}
                  rows={1}
                  className="custom-scrollbar h-9 min-h-9 flex-1 resize-none bg-transparent text-sm leading-9 text-slate-800 outline-none transition-[height] duration-300 ease-out placeholder:text-slate-400 dark:text-white"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAssistantVoiceInput}
                    disabled={assistantLoading || assistantListening}
                    className={`hidden h-9 w-9 shrink-0 rounded-xl transition-colors ${
                      assistantListening
                        ? 'animate-pulse bg-rose-500 text-white'
                        : 'assistant-input-icon-button border border-slate-200 bg-white text-slate-500 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:text-white'
                    } flex items-center justify-center disabled:opacity-50`}
                    title={
                      language === 'zh'
                        ? '语音输入'
                        : language === 'ja'
                          ? '音声入力'
                          : 'Voice input'
                    }
                  >
                    <Mic className="h-4 w-4" />
                  </button>
                  {shortDramaPromptIndex !== null && (
                    <button
                      type="button"
                      onClick={replaceShortDramaTestPrompt}
                      disabled={assistantLoading}
                      className="assistant-input-icon-button flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:text-indigo-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:text-white"
                      aria-label={
                        language === 'zh'
                          ? '换一个测试句'
                          : language === 'ja'
                            ? '別のテスト文に変更'
                            : 'Try another prompt'
                      }
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => void sendAssistantMessage()}
                    disabled={
                      assistantLoading ||
                      (!assistantInput.trim() && assistantInputContexts.length === 0)
                    }
                    className="assistant-send-button flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600"
                    title={ui.send}
                  >
                    {assistantLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
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
              <span>{ui.futureWriting}</span>
            </button>
          </div>,
          document.body,
        )}
      {documentUploadOpen &&
        !showArticleUploadPage &&
        createPortal(
          <div className="fixed inset-0 z-[420] flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm">
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
                  onClick={closeDocumentUpload}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-900 dark:hover:text-white"
                  title={ui.close}
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
          </div>,
          document.body,
        )}
    </aside>
  );
}
