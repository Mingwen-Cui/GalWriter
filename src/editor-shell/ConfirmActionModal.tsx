import { AlertTriangle } from 'lucide-react';

import type { Language } from '../lib/i18n';

interface ConfirmActionModalProps {
  visible: boolean;
  language: Language;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmActionModal({
  visible,
  language,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = 'danger',
  onConfirm,
  onCancel,
}: ConfirmActionModalProps) {
  if (!visible) return null;

  const isDanger = tone === 'danger';
  const resolvedConfirmLabel = confirmLabel || (language === 'zh' ? '确认删除' : 'Delete');
  const resolvedCancelLabel = cancelLabel || (language === 'zh' ? '取消' : 'Cancel');

  return (
    <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-7 shadow-[0_32px_80px_rgba(15,23,42,0.28)] dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center gap-4">
          <div
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${
              isDanger
                ? 'bg-rose-50 text-rose-500 dark:bg-rose-500/15 dark:text-rose-300'
                : 'bg-amber-50 text-amber-500 dark:bg-amber-500/15 dark:text-amber-300'
            }`}
          >
            <AlertTriangle className="h-7 w-7" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">{title}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
              {description}
            </p>
          </div>
        </div>

        <div className="mt-7 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
          >
            {resolvedCancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 rounded-2xl px-4 py-3 text-sm font-black text-white transition-colors ${
              isDanger
                ? 'bg-rose-500 hover:bg-rose-600 dark:bg-rose-500 dark:hover:bg-rose-400'
                : 'bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100'
            }`}
          >
            {resolvedConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
