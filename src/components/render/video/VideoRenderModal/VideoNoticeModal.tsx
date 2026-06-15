import { Download, X } from 'lucide-react';

export type RenderNoticeModalState = {
  title: string;
  description: string;
  primaryLabel: string;
  secondaryLabel: string;
  onPrimary: () => void;
  onSecondary?: () => void;
};

export function VideoNoticeModal({
  notice,
  onClose,
}: {
  notice: RenderNoticeModalState | null;
  onClose: () => void;
}) {
  if (!notice) return null;

  return (
    <div className="fixed inset-0 z-[1600] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-[var(--vr-border)] bg-[var(--vr-surface)] p-7 shadow-[0_32px_90px_rgba(15,23,42,0.34)]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--vr-accent-soft)] text-[var(--vr-accent)]">
              <Download className="h-7 w-7" />
            </div>
            <div>
              <h3 className="text-xl font-black text-[var(--vr-text)]">{notice.title}</h3>
              <p className="mt-1 text-sm leading-6 text-[var(--vr-text-soft)]">
                {notice.description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-[var(--vr-text-muted)] transition-colors hover:bg-[var(--vr-surface-soft)] hover:text-[var(--vr-text)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-7 flex gap-3">
          <button
            type="button"
            onClick={notice.onSecondary ?? onClose}
            className="flex-1 rounded-2xl border border-[var(--vr-border)] px-4 py-3 text-sm font-bold text-[var(--vr-text-soft)] transition-colors hover:bg-[var(--vr-surface-soft)] hover:text-[var(--vr-text)]"
          >
            {notice.secondaryLabel}
          </button>
          <button
            type="button"
            onClick={notice.onPrimary}
            className="flex-1 rounded-2xl bg-[var(--vr-accent)] px-4 py-3 text-sm font-black text-white shadow-[0_14px_30px_rgba(37,99,235,0.24)] transition-colors hover:brightness-110"
          >
            {notice.primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
