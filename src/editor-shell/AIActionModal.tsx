import type { AIButtonsConfig } from '../editor-state/editorConfig';

interface AIActionModalProps {
  visible: boolean;
  pendingAINodeId: string | null;
  aiButtonsConfig: AIButtonsConfig;
  language: 'zh' | 'en';
  onClose: () => void;
  onGenerate: (
    nodeId: string,
    action: 'continue' | 'creative' | 'rewrite' | 'interpolate' | 'scene_only' | 'dialogue_only',
  ) => void;
  t: {
    aiAssistant: string;
    aiChooseMethod: string;
    aiContinue: string;
    aiContinueDesc: string;
    aiCreative: string;
    aiCreativeDesc: string;
    aiRewrite: string;
    aiRewriteDesc: string;
    aiInterpolate: string;
    aiInterpolateDesc: string;
    aiSceneOnly: string;
    aiSceneOnlyDesc: string;
    aiDialogueOnly: string;
    aiDialogueOnlyDesc: string;
    cancel: string;
  };
}

const BUTTONS = [
  {
    key: 'continue' as const,
    id: 'ai-action-continue',
    emoji: '✍️',
    borderClass:
      'border-indigo-100 hover:border-indigo-400 hover:bg-indigo-50 dark:border-indigo-900/50 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/30',
    titleClass: 'group-hover:text-indigo-700 dark:group-hover:text-indigo-400',
    titleKey: 'aiContinue' as const,
    descKey: 'aiContinueDesc' as const,
  },
  {
    key: 'creative' as const,
    id: 'ai-action-creative',
    emoji: '💡',
    borderClass:
      'border-purple-100 hover:border-purple-400 hover:bg-purple-50 dark:border-purple-900/50 dark:hover:border-purple-500 dark:hover:bg-purple-950/30',
    titleClass: 'group-hover:text-purple-700 dark:group-hover:text-purple-400',
    titleKey: 'aiCreative' as const,
    descKey: 'aiCreativeDesc' as const,
  },
  {
    key: 'rewrite' as const,
    id: 'ai-action-rewrite',
    emoji: '🔄',
    borderClass:
      'border-amber-100 hover:border-amber-400 hover:bg-amber-50 dark:border-amber-900/50 dark:hover:border-amber-500 dark:hover:bg-amber-950/30',
    titleClass: 'group-hover:text-amber-700 dark:group-hover:text-amber-400',
    titleKey: 'aiRewrite' as const,
    descKey: 'aiRewriteDesc' as const,
  },
  {
    key: 'interpolate' as const,
    id: 'ai-action-interpolate',
    emoji: '🧩',
    borderClass:
      'border-green-100 hover:border-green-400 hover:bg-green-50 dark:border-green-900/50 dark:hover:border-green-500 dark:hover:bg-green-950/30',
    titleClass: 'group-hover:text-green-700 dark:group-hover:text-green-400',
    titleKey: 'aiInterpolate' as const,
    descKey: 'aiInterpolateDesc' as const,
  },
  {
    key: 'scene_only' as const,
    id: 'ai-action-scene',
    emoji: '🏞',
    borderClass:
      'border-sky-100 hover:border-sky-400 hover:bg-sky-50 dark:border-sky-900/50 dark:hover:border-sky-500 dark:hover:bg-sky-950/30',
    titleClass: 'group-hover:text-sky-700 dark:group-hover:text-sky-400',
    titleKey: 'aiSceneOnly' as const,
    descKey: 'aiSceneOnlyDesc' as const,
  },
  {
    key: 'dialogue_only' as const,
    id: 'ai-action-dialogue',
    emoji: '💬',
    borderClass:
      'border-rose-100 hover:border-rose-400 hover:bg-rose-50 dark:border-rose-900/50 dark:hover:border-rose-500 dark:hover:bg-rose-950/30',
    titleClass: 'group-hover:text-rose-700 dark:group-hover:text-rose-400',
    titleKey: 'aiDialogueOnly' as const,
    descKey: 'aiDialogueOnlyDesc' as const,
  },
];

export function AIActionModal({
  visible,
  pendingAINodeId,
  aiButtonsConfig,
  onClose,
  onGenerate,
  t,
}: AIActionModalProps) {
  if (!(visible && pendingAINodeId)) return null;

  return (
    <div
      className="animate-in fade-in fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm duration-200"
      onClick={onClose}
    >
      <div
        className="animate-in slide-in-from-bottom-4 w-full max-w-sm rounded-2xl border border-transparent bg-white p-5 shadow-md duration-300 dark:border-slate-800 dark:bg-slate-900 md:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="mb-1 text-base font-bold text-slate-800 dark:text-slate-100">
          {t.aiAssistant}
        </h3>
        <p className="mb-5 text-xs text-slate-500 dark:text-slate-400">{t.aiChooseMethod}</p>
        <div className="flex flex-col gap-3">
          {BUTTONS.filter((button) => aiButtonsConfig[button.key]).map((button) => (
            <button
              key={button.key}
              id={button.id}
              onClick={() => onGenerate(pendingAINodeId, button.key)}
              className={`group flex w-full items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all ${button.borderClass}`}
            >
              <span className="mt-0.5 text-xl">{button.emoji}</span>
              <div>
                <div
                  className={`text-sm font-semibold text-slate-800 dark:text-slate-200 ${button.titleClass}`}
                >
                  {t[button.titleKey]}
                </div>
                <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {t[button.descKey]}
                </div>
              </div>
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full py-2 text-sm text-slate-500 transition-colors hover:text-slate-700"
        >
          {t.cancel}
        </button>
      </div>
    </div>
  );
}
