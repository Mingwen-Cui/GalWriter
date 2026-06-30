import { AlertTriangle, Info } from 'lucide-react';

import type { Language } from '../lib/i18n';

type DialogTone = 'info' | 'warning' | 'danger';

interface DialogModalProps {
  visible: boolean;
  language: Language;
  title: string;
  description: string;
  tone?: DialogTone;
  confirmLabel?: string;
  cancelLabel?: string;
  showCancel?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

export function DialogModal({
  visible,
  language,
  title,
  description,
  tone = 'info',
  confirmLabel,
  cancelLabel,
  showCancel = false,
  onConfirm,
  onCancel,
}: DialogModalProps) {
  if (!visible) return null;

  const iconClassName =
    tone === 'danger'
      ? 'bg-rose-50 text-rose-500 dark:bg-rose-500/15 dark:text-rose-300'
      : tone === 'warning'
        ? 'bg-amber-50 text-amber-500 dark:bg-amber-500/15 dark:text-amber-300'
        : 'bg-sky-50 text-sky-500 dark:bg-sky-500/15 dark:text-sky-300';
  const resolvedConfirmLabel =
    confirmLabel ||
    (language === 'zh'
      ? '确定'
      : language === 'ja'
        ? '確認'
        : 'OK');
  const resolvedCancelLabel =
    cancelLabel ||
    (language === 'zh'
      ? '取消'
      : language === 'ja'
        ? 'キャンセル'
        : 'Cancel');
  const Icon = tone === 'info' ? Info : AlertTriangle;

  return (
    <div className="fixed inset-0 z-[1500] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-7 shadow-[0_32px_80px_rgba(15,23,42,0.28)] dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center gap-4">
          <div
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${iconClassName}`}
          >
            <Icon className="h-7 w-7" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">{title}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
              {description}
            </p>
          </div>
        </div>

        <div className="mt-7 flex gap-3">
          {showCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
            >
              {resolvedCancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-2xl px-4 py-3 text-sm font-black text-white transition-colors ${
              showCancel
                ? tone === 'danger'
                  ? 'flex-1 bg-rose-500 hover:bg-rose-600 dark:bg-rose-500 dark:hover:bg-rose-400'
                  : 'flex-1 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100'
                : 'ml-auto min-w-32 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100'
            }`}
          >
            {resolvedConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
