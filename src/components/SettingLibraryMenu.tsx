import { BookOpen, BookmarkPlus, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type {
  SettingLibraryKind,
  SettingLibraryListItem,
  SettingLibrarySource,
} from '../domain/project';

type SettingLibraryMenuProps = {
  kind: SettingLibraryKind;
  sourceItemId?: string;
  savedItems?: SettingLibraryListItem[];
  presetItems?: SettingLibraryListItem[];
  onSave?: (mode: 'new' | 'update') => Promise<void> | void;
  onUse?: (itemId: string, source: SettingLibrarySource) => Promise<void> | void;
  onDelete?: (itemId: string) => Promise<void> | void;
};

export function SettingLibraryMenu({
  kind,
  sourceItemId,
  savedItems = [],
  presetItems = [],
  onSave,
  onUse,
  onDelete,
}: SettingLibraryMenuProps) {
  const [open, setOpen] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const isCharacter = kind === 'character';
  const colorClass = isCharacter ? 'text-purple-500' : 'text-blue-700';
  const hoverClass = isCharacter ? 'hover:bg-purple-500/10' : 'hover:bg-blue-700/10';
  const libraryItems = [...savedItems, ...presetItems];
  const kindLabel = isCharacter ? '人物' : '场景';

  const run = async (itemId: string, action: () => Promise<void> | void) => {
    setBusyItemId(itemId);
    try {
      await action();
    } finally {
      setBusyItemId(null);
    }
  };

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutsidePointerDown);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointerDown);
  }, [open]);

  return (
    <div ref={menuRef} className="relative nodrag nowheel">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className={`px-1.5 py-1 rounded transition-colors flex items-center justify-center ${colorClass} ${hoverClass}`}
        title={`${kindLabel}设定库`}
      >
        <BookOpen className="w-3 h-3" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-[120] mt-2 w-[272px] overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-[var(--card-border)] px-3 py-2">
            <div className="text-xs font-bold text-[var(--text-primary)]">{kindLabel}设定库</div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void run('save', () => onSave?.(sourceItemId ? 'update' : 'new'))}
                disabled={!onSave || busyItemId !== null}
                className={`flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-bold ${colorClass} ${hoverClass} disabled:cursor-wait disabled:opacity-50`}
              >
                <BookmarkPlus className="h-3.5 w-3.5" />
                <span>{'\u4fdd\u5b58\u5f53\u524d'}</span>
              </button>
              <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--app-bg)] hover:text-[var(--text-primary)]"
              title="关闭"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            </div>
          </div>

          {sourceItemId && (
            <div className="border-b border-[var(--card-border)] p-2">
              <button
                type="button"
                onClick={() => void run('new', () => onSave?.('new'))}
                disabled={!onSave || busyItemId !== null}
                className="flex w-full items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-bold text-[var(--text-secondary)] hover:bg-[var(--app-bg)] hover:text-[var(--text-primary)] disabled:cursor-wait disabled:opacity-50"
              >
                <BookmarkPlus className="h-3.5 w-3.5" /> 另存为新设定
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 px-3 pb-1 pt-2 text-[10px] font-bold text-[var(--text-muted)]">
            <span>已保存 {savedItems.length}</span>
            <span className="h-1 w-1 rounded-full bg-current opacity-50" />
            <span>预设 {presetItems.length}</span>
          </div>

          <div className="max-h-60 space-y-1 overflow-y-auto p-2 pt-1 custom-scrollbar">
            {libraryItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--card-border)] bg-[var(--app-bg)] px-3 py-5 text-center text-[11px] text-[var(--text-muted)]">
                还没有可用的{kindLabel}设定
              </div>
            ) : (
              libraryItems.map((item) => (
                <div
                  key={`${item.source}-${item.id}`}
                  className="flex items-center gap-2 rounded-lg border border-transparent bg-[var(--app-bg)] p-1.5 transition-colors hover:border-[var(--card-border)]"
                >
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md bg-gradient-to-br from-purple-500/25 to-blue-500/25">
                    {item.thumbnailUrl ? (
                      <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className={`flex h-full w-full items-center justify-center text-[10px] font-black ${colorClass}`}>
                        {isCharacter ? '人' : '景'}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-bold text-[var(--text-primary)]">{item.name}</div>
                    <div className="mt-0.5 text-[9px] font-medium text-[var(--text-muted)]">
                      {item.source === 'saved' ? '已保存' : '预设'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void run(item.id, () => onUse?.(item.id, item.source))}
                    disabled={!onUse || busyItemId !== null}
                    className={`shrink-0 rounded p-1 ${colorClass} ${hoverClass} disabled:cursor-wait disabled:opacity-50`}
                    title="添加到当前项目"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  {item.source === 'saved' && (
                    <button
                      type="button"
                      onClick={() => void run(item.id, () => onDelete?.(item.id))}
                      disabled={!onDelete || busyItemId !== null}
                      className="shrink-0 rounded p-1 text-red-400 hover:bg-red-500/10 hover:text-red-500 disabled:cursor-wait disabled:opacity-50"
                      title="删除设定"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
