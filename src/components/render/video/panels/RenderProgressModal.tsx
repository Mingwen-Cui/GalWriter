import { Loader2, X } from 'lucide-react';

import type { Language } from '../../../../lib/i18n';
import { renderCopy } from '../shared/renderCopy';

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
  const t = (zh: string, ja: string, en: string) => renderCopy(language, zh, ja, en);
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
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
          <div className="min-w-0">
            <h3
              id="video-render-progress-title"
              className="text-xl font-black text-[var(--vr-text)]"
            >
              {cancelling
                ? t('正在取消渲染', 'レンダリングをキャンセル中', 'Cancelling render')
                : t('正在渲染视频', '動画をレンダリング中', 'Rendering video')}
            </h3>
            <p className="mt-1 text-sm leading-6 text-[var(--vr-text-soft)]">
              {t(
                '渲染期间暂时无法操作其他内容，请保持应用运行。',
                'レンダリング中は他の操作を行えません。アプリを起動したままにしてください。',
                'Other controls are locked while rendering. Please keep the app running.',
              )}
            </p>
          </div>
        </div>

        <div className="mt-7">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold">
            <span className="min-w-0 truncate text-[var(--vr-text-soft)]">
              {progress || t('正在准备渲染...', 'レンダリングを準備中...', 'Preparing render...')}
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
          {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
          {cancelling
            ? t('正在取消...', 'キャンセル中...', 'Cancelling...')
            : t('取消渲染', 'レンダリングをキャンセル', 'Cancel render')}
        </button>
      </div>
    </div>
  );
}
