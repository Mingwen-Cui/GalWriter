import { formatVideoText } from '../i18n';
import { X } from 'lucide-react';

import type { Language } from '../../../../lib/i18n';
import { LoadingAnimation } from '../../../LoadingAnimation';

type RenderProgressModalProps = {
  language: Language;
  progress: string;
  progressValue: number;
  cancelling: boolean;
  onCancel: () => void;
};

export function RenderProgressModal({
  language,
  progress,
  progressValue,
  cancelling,
  onCancel,
}: RenderProgressModalProps) {
  const safeProgress = Math.min(100, Math.max(0, progressValue));

  return (
    <div
      className="fixed inset-0 z-[1800] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="video-render-progress-title"
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="w-full max-w-md rounded-[28px] border border-[var(--vr-border)] bg-[var(--vr-surface)] p-7 shadow-[0_32px_90px_rgba(15,23,42,0.42)]">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--vr-accent-soft)] text-[var(--vr-accent)]">
            <LoadingAnimation className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <h3
              id="video-render-progress-title"
              className="text-xl font-black text-[var(--vr-text)]"
            >
              {cancelling
                ? formatVideoText(language, 'componentsrendervideopanelsRenderProgressModalText44')
                : formatVideoText(language, 'componentsrendervideopanelsRenderProgressModalText45')}
            </h3>
            <p className="mt-1 text-sm leading-6 text-[var(--vr-text-soft)]">
              {formatVideoText(language, 'componentsrendervideopanelsRenderProgressModalText48')}
            </p>
          </div>
        </div>

        <div className="mt-7">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold">
            <span className="min-w-0 truncate text-[var(--vr-text-soft)]">
              {progress ||
                formatVideoText(language, 'componentsrendervideopanelsRenderProgressModalText60')}
            </span>
            <span className="shrink-0 tabular-nums text-[var(--vr-accent-strong)]">
              {Math.round(safeProgress)}%
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[var(--vr-surface-soft)]">
            <div
              className="h-full rounded-full bg-[var(--vr-accent)] transition-[width] duration-200"
              style={{ width: `${safeProgress}%` }}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={onCancel}
          disabled={cancelling}
          className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-300/70 px-4 py-3 text-sm font-black text-rose-500 transition-colors hover:bg-rose-500/10 disabled:cursor-wait disabled:opacity-55"
        >
          {cancelling ? <LoadingAnimation className="h-4 w-4" /> : <X className="h-4 w-4" />}
          {cancelling
            ? formatVideoText(language, 'componentsrendervideopanelsRenderProgressModalText82')
            : formatVideoText(language, 'componentsrendervideopanelsRenderProgressModalText83')}
        </button>
      </div>
    </div>
  );
}
