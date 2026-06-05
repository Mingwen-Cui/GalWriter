import {
  Feather,
  Lightbulb,
  MessageCircle,
  PanelTopDashed,
  PenLine,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';

import type { Language } from '../lib/i18n';
import type { AIButtonsConfig } from '../editor-state/editorConfig';

interface AIActionModalProps {
  visible: boolean;
  pendingAINodeId: string | null;
  aiButtonsConfig: AIButtonsConfig;
  language: Language;
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
    Icon: PenLine,
    toneClass:
      'bg-indigo-50 text-indigo-600 ring-indigo-100 group-hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/20',
    titleKey: 'aiContinue' as const,
    descKey: 'aiContinueDesc' as const,
  },
  {
    key: 'creative' as const,
    id: 'ai-action-creative',
    Icon: Lightbulb,
    toneClass:
      'bg-violet-50 text-violet-600 ring-violet-100 group-hover:bg-violet-100 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/20',
    titleKey: 'aiCreative' as const,
    descKey: 'aiCreativeDesc' as const,
  },
  {
    key: 'rewrite' as const,
    id: 'ai-action-rewrite',
    Icon: RefreshCw,
    toneClass:
      'bg-amber-50 text-amber-600 ring-amber-100 group-hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20',
    titleKey: 'aiRewrite' as const,
    descKey: 'aiRewriteDesc' as const,
  },
  {
    key: 'interpolate' as const,
    id: 'ai-action-interpolate',
    Icon: PanelTopDashed,
    toneClass:
      'bg-emerald-50 text-emerald-600 ring-emerald-100 group-hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20',
    titleKey: 'aiInterpolate' as const,
    descKey: 'aiInterpolateDesc' as const,
  },
  {
    key: 'scene_only' as const,
    id: 'ai-action-scene',
    Icon: Feather,
    toneClass:
      'bg-sky-50 text-sky-600 ring-sky-100 group-hover:bg-sky-100 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/20',
    titleKey: 'aiSceneOnly' as const,
    descKey: 'aiSceneOnlyDesc' as const,
  },
  {
    key: 'dialogue_only' as const,
    id: 'ai-action-dialogue',
    Icon: MessageCircle,
    toneClass:
      'bg-rose-50 text-rose-600 ring-rose-100 group-hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20',
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
      className="animate-in fade-in fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm duration-200"
      onClick={onClose}
    >
      <div
        className="animate-in slide-in-from-bottom-4 w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20 duration-300 dark:border-slate-800 dark:bg-slate-950"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800 md:px-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                {t.aiAssistant}
              </h3>
              <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">
                {t.aiChooseMethod}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t.cancel}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-900 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid max-h-[62vh] grid-cols-1 gap-3 overflow-y-auto p-4 md:grid-cols-2 md:p-5">
          {BUTTONS.filter((button) => aiButtonsConfig[button.key]).map((button) => (
            <button
              key={button.key}
              id={button.id}
              onClick={() => onGenerate(pendingAINodeId, button.key)}
              className="group flex min-h-28 w-full items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-lg hover:shadow-slate-200/70 active:translate-y-0 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700 dark:hover:bg-slate-900 dark:hover:shadow-black/20"
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 transition-colors ${button.toneClass}`}
              >
                <button.Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-bold leading-5 text-slate-900 dark:text-slate-100">
                  {t[button.titleKey]}
                </div>
                <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {t[button.descKey]}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
