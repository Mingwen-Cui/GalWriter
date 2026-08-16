import { Maximize2, Minimize2, X } from 'lucide-react';
import { createPortal } from 'react-dom';

import type { PptExportSettings } from '../video/shared/types';
import type { PptCopy } from './i18n';

type ContentMode = NonNullable<PptExportSettings['layoutContentMode']>;

export function PptLayoutChangeDialog({
  copy,
  onChoose,
  onCancel,
}: {
  copy: Pick<
    PptCopy,
    | 'resizeSlideTitle'
    | 'resizeSlideMessage'
    | 'maximize'
    | 'maximizeDescription'
    | 'ensureFit'
    | 'ensureFitDescription'
    | 'cancel'
  >;
  onChoose: (mode: ContentMode) => void;
  onCancel: () => void;
}) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="video-render-workspace fixed inset-0 z-[700] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="ppt-layout-change-title"
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--vr-border)] bg-[var(--vr-surface-strong)] text-[var(--vr-text)] shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-[var(--vr-border)] px-5 py-4">
          <h2 id="ppt-layout-change-title" className="text-sm font-black">
            {copy.resizeSlideTitle}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="grid h-8 w-8 place-items-center rounded-lg text-[var(--vr-text-muted)] transition-colors hover:bg-[var(--vr-surface-soft)] hover:text-[var(--vr-text)]"
            aria-label={copy.cancel}
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="space-y-5 px-5 py-5">
          <p className="text-sm leading-6 text-[var(--vr-text-muted)]">{copy.resizeSlideMessage}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <LayoutChoice
              icon={Maximize2}
              title={copy.maximize}
              description={copy.maximizeDescription}
              onClick={() => onChoose('maximize')}
            />
            <LayoutChoice
              icon={Minimize2}
              title={copy.ensureFit}
              description={copy.ensureFitDescription}
              onClick={() => onChoose('fit')}
            />
          </div>
        </div>
        <footer className="flex justify-end border-t border-[var(--vr-border)] px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-lg px-4 text-xs font-black text-[var(--vr-text-muted)] transition-colors hover:bg-[var(--vr-surface-soft)] hover:text-[var(--vr-text)]"
          >
            {copy.cancel}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

function LayoutChoice({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: typeof Maximize2;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-40 flex-col items-center rounded-xl border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-4 text-center transition-colors hover:border-[var(--vr-accent)] hover:bg-[var(--vr-accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vr-accent)]"
    >
      <span className="mb-3 grid h-12 w-16 place-items-center rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-strong)] text-[var(--vr-accent-strong)] shadow-sm transition-transform group-hover:scale-105">
        <Icon className="h-6 w-6" />
      </span>
      <span className="text-sm font-black text-[var(--vr-text)]">{title}</span>
      <span className="mt-1.5 text-xs leading-5 text-[var(--vr-text-muted)]">{description}</span>
    </button>
  );
}
