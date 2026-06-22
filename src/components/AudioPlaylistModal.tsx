import { Pause, Play, X } from 'lucide-react';

export type AudioPlaylistItem = {
  nodeId: string;
  title: string;
  url: string;
};

type AudioPlaylistModalProps = {
  open: boolean;
  items: AudioPlaylistItem[];
  activeUrl: string | null;
  isPlaying: boolean;
  title: string;
  hint: string;
  emptyText: string;
  closeLabel: string;
  dark?: boolean;
  scope?: 'viewport' | 'container';
  onClose: () => void;
  onToggleAudio: (item: AudioPlaylistItem) => void;
};

export function AudioPlaylistModal({
  open,
  items,
  activeUrl,
  isPlaying,
  title,
  hint,
  emptyText,
  closeLabel,
  dark = true,
  scope = 'viewport',
  onClose,
  onToggleAudio,
}: AudioPlaylistModalProps) {
  if (!open) return null;

  const shellClass = dark
    ? 'border-white/12 bg-slate-950/94 text-white shadow-black/50'
    : 'border-slate-200 bg-white text-slate-900 shadow-slate-900/18';
  const mutedClass = dark ? 'text-white/48' : 'text-slate-500';
  const emptyClass = dark
    ? 'border-white/15 text-white/42'
    : 'border-slate-200 text-slate-400';
  const inactiveItemClass = dark
    ? 'border-white/10 bg-white/[0.05]'
    : 'border-slate-200 bg-slate-50';
  const activeItemClass = dark
    ? 'border-sky-400/50 bg-sky-500/15'
    : 'border-indigo-300 bg-indigo-50';
  const playButtonClass = dark
    ? 'bg-sky-500 text-white hover:bg-sky-400'
    : 'bg-indigo-600 text-white hover:bg-indigo-500';
  const overlayClass =
    scope === 'container'
      ? 'absolute inset-0 z-[9999] grid place-items-center bg-black/42 px-4 py-4 backdrop-blur-sm'
      : 'fixed inset-0 z-[9999] grid place-items-center bg-black/42 px-4 py-6 backdrop-blur-sm';
  const modalSizeClass =
    scope === 'container'
      ? 'h-[min(26rem,calc(100%_-_2rem))] w-[min(32rem,calc(100%_-_2rem))]'
      : 'h-[min(26rem,calc(100vh-4rem))] w-[min(32rem,calc(100vw-2rem))]';

  return (
    <div
      className={overlayClass}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`flex ${modalSizeClass} flex-col overflow-hidden rounded-2xl border p-4 shadow-2xl ${shellClass}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="truncate text-base font-black">{title}</div>
            <div className={`mt-1 text-[11px] font-medium ${mutedClass}`}>{hint}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition ${
              dark
                ? 'text-white/58 hover:bg-white/10 hover:text-white'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
            }`}
            aria-label={closeLabel}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {items.length === 0 ? (
            <div
              className={`flex h-full items-center justify-center rounded-xl border border-dashed px-6 text-center text-xs ${emptyClass}`}
            >
              {emptyText}
            </div>
          ) : (
            items.map((item) => {
              const active = activeUrl === item.url && isPlaying;
              return (
                <div
                  key={`${item.nodeId}-${item.url}`}
                  className={`flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2 ${
                    active ? activeItemClass : inactiveItemClass
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate text-center text-sm font-bold">
                    {item.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => onToggleAudio(item)}
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition active:scale-95 ${playButtonClass}`}
                    aria-label={active ? 'Pause' : 'Play'}
                  >
                    {active ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="ml-0.5 h-4 w-4" />
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
