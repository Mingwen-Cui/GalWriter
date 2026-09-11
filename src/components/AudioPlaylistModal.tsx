import {
  ChevronsDown,
  ChevronsUp,
  GitBranch,
  LocateFixed,
  Maximize2,
  Pause,
  Play,
  X,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';

export type AudioPlaylistItem = {
  nodeId: string;
  title: string;
  description?: string;
  url?: string;
  status: 'current' | 'played' | 'unplayed';
  minimized: boolean;
};

type AudioPlaylistModalProps = {
  open: boolean;
  items: AudioPlaylistItem[];
  activeUrl: string | null;
  isPlaying: boolean;
  title: string;
  hint?: string;
  emptyText: string;
  closeLabel: string;
  expandAllLabel: string;
  collapseAllLabel: string;
  autoExpandOnJump: boolean;
  autoExpandOnJumpLabel: string;
  autoPlayOnJump: boolean;
  autoPlayOnJumpLabel: string;
  showCurrentBranchOnly: boolean;
  showCurrentBranchOnlyLabel: string;
  dark?: boolean;
  scope?: 'viewport' | 'container' | 'panel';
  onClose: () => void;
  onToggleAudio: (item: AudioPlaylistItem) => void;
  onJumpToItem: (item: AudioPlaylistItem) => void;
  onAutoExpandOnJumpChange: () => void;
  onAutoPlayOnJumpChange: () => void;
  onShowCurrentBranchOnlyChange: () => void;
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
  expandAllLabel,
  collapseAllLabel,
  autoExpandOnJump,
  autoExpandOnJumpLabel,
  autoPlayOnJump,
  autoPlayOnJumpLabel,
  showCurrentBranchOnly,
  showCurrentBranchOnlyLabel,
  dark = true,
  scope = 'viewport',
  onClose,
  onToggleAudio,
  onJumpToItem,
  onAutoExpandOnJumpChange,
  onAutoPlayOnJumpChange,
  onShowCurrentBranchOnlyChange,
}: AudioPlaylistModalProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(() => new Set());
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  if (!open) return null;

  const allExpanded = items.length > 0 && items.every((item) => expandedItems.has(item.nodeId));
  const toggleAllDescriptions = () =>
    setExpandedItems(allExpanded ? new Set() : new Set(items.map((item) => item.nodeId)));

  const shellClass =
    scope === 'panel'
      ? dark
        ? 'border-transparent bg-transparent text-white shadow-none'
        : 'border-transparent bg-transparent text-slate-900 shadow-none'
      : dark
        ? 'border-white/12 bg-slate-950/94 text-white shadow-black/50'
        : 'border-slate-200 bg-white text-slate-900 shadow-slate-900/18';
  const mutedClass = dark ? 'text-white/48' : 'text-slate-500';
  const emptyClass = dark ? 'border-white/15 text-white/42' : 'border-slate-200 text-slate-400';
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
    scope === 'panel'
      ? 'h-full w-full'
      : scope === 'container'
        ? 'absolute inset-0 z-[9999] grid place-items-center bg-black/42 px-4 py-4 backdrop-blur-sm'
        : 'fixed inset-0 z-[9999] grid place-items-center bg-black/42 px-4 py-6 backdrop-blur-sm';
  const modalSizeClass =
    scope === 'panel'
      ? 'h-full w-full'
      : scope === 'container'
        ? 'h-[min(26rem,calc(100%_-_2rem))] w-[min(32rem,calc(100%_-_2rem))]'
        : 'h-[min(26rem,calc(100vh-4rem))] w-[min(32rem,calc(100vw-2rem))]';

  return (
    <div
      className={overlayClass}
      onClick={scope === 'panel' ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`flex ${modalSizeClass} flex-col overflow-hidden ${scope === 'panel' ? 'rounded-none border-0 p-0 shadow-none' : 'rounded-2xl border p-4 shadow-2xl'} ${shellClass}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="truncate text-base font-black">{title}</div>
              <button
                type="button"
                onClick={toggleAllDescriptions}
                className={`grid h-7 w-7 shrink-0 place-items-center transition ${
                  dark ? 'text-white/65 hover:text-white' : 'text-indigo-600 hover:text-indigo-800'
                }`}
                title={allExpanded ? collapseAllLabel : expandAllLabel}
                aria-label={allExpanded ? collapseAllLabel : expandAllLabel}
              >
                {allExpanded ? (
                  <ChevronsUp className="h-[18px] w-[18px]" />
                ) : (
                  <ChevronsDown className="h-[18px] w-[18px]" />
                )}
              </button>
            </div>
            {hint ? (
              <div className={`mt-1 text-[11px] font-medium ${mutedClass}`}>{hint}</div>
            ) : null}
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
              const active = Boolean(item.url && activeUrl === item.url && isPlaying);
              const expanded =
                !item.minimized &&
                (allExpanded || expandedItems.has(item.nodeId) || hoveredItemId === item.nodeId);
              const itemClass =
                item.status === 'current'
                  ? dark
                    ? 'border-sky-300/40 bg-sky-400/15'
                    : 'border-indigo-300 bg-indigo-50'
                  : item.status === 'played'
                    ? dark
                      ? 'border-violet-300/20 bg-violet-400/[0.08]'
                      : 'border-violet-200 bg-violet-50/70'
                    : active
                      ? activeItemClass
                      : inactiveItemClass;
              return (
                <div
                  key={item.nodeId}
                  onClick={() =>
                    !item.minimized &&
                    setExpandedItems((current) => {
                      const next = new Set(current);
                      if (next.has(item.nodeId)) next.delete(item.nodeId);
                      else next.add(item.nodeId);
                      return next;
                    })
                  }
                  onMouseEnter={() => setHoveredItemId(item.nodeId)}
                  onMouseLeave={() => setHoveredItemId(null)}
                  className={`group rounded-xl border px-3 py-2 ${itemClass} ${
                    item.minimized ? 'cursor-default opacity-45' : 'cursor-pointer'
                  }`}
                >
                  <div className="flex min-h-9 items-center gap-2">
                    <span
                      className={`min-w-0 flex-1 truncate text-left text-sm font-bold transition-colors ${
                        dark ? 'group-hover:text-white' : 'group-hover:text-indigo-600'
                      }`}
                    >
                      {item.title}
                    </span>
                    {item.url && !item.minimized ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleAudio(item);
                        }}
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition active:scale-95 ${playButtonClass}`}
                        aria-label={active ? 'Pause' : 'Play'}
                      >
                        {active ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="ml-0.5 h-4 w-4" />
                        )}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onJumpToItem(item);
                      }}
                      className={`group/jump grid h-9 w-9 shrink-0 place-items-center transition duration-200 active:scale-95 ${
                        dark
                          ? 'text-sky-200 hover:text-sky-100'
                          : 'text-indigo-600 hover:text-indigo-800'
                      }`}
                      title="跳转到此段"
                      aria-label="跳转到此段"
                    >
                      <LocateFixed className="h-[18px] w-[18px] transition-transform duration-200 group-hover/jump:scale-110" />
                    </button>
                  </div>
                  {expanded && item.description ? (
                    <p className={`mt-1 text-left text-xs leading-5 ${mutedClass}`}>
                      {item.description}
                    </p>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
        <div className="mt-3 shrink-0 space-y-2">
          <PlaylistToggle
            active={autoExpandOnJump}
            dark={dark}
            icon={<Maximize2 className="h-4 w-4" />}
            label={autoExpandOnJumpLabel}
            onClick={onAutoExpandOnJumpChange}
          />
          <PlaylistToggle
            active={autoPlayOnJump}
            dark={dark}
            icon={<Play className="h-4 w-4" />}
            label={autoPlayOnJumpLabel}
            onClick={onAutoPlayOnJumpChange}
          />
          <PlaylistToggle
            active={showCurrentBranchOnly}
            dark={dark}
            icon={<GitBranch className="h-4 w-4" />}
            label={showCurrentBranchOnlyLabel}
            onClick={onShowCurrentBranchOnlyChange}
          />
        </div>
      </div>
    </div>
  );
}

function PlaylistToggle({
  active,
  dark,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  dark: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition ${
        dark
          ? active
            ? 'border-sky-300/30 bg-sky-400/15 text-sky-100'
            : 'border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.07]'
          : active
            ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
            : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
      }`}
      aria-pressed={active}
    >
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span
        className={`relative h-5 w-9 rounded-full transition-colors ${
          active ? 'bg-indigo-600' : dark ? 'bg-white/20' : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            active ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  );
}
