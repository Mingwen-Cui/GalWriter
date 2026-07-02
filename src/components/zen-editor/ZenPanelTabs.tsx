import { FileText, SlidersHorizontal, Volume2, X } from 'lucide-react';

import type { ZenRightPanel } from './types';

export function ZenPanelTabs({
  rightPanel,
  onPanelChange,
  onClose,
}: {
  rightPanel: ZenRightPanel;
  onPanelChange: (panel: ZenRightPanel) => void;
  onClose: () => void;
}) {
  return (
    <div className="zen-editor-panel-header flex items-center justify-between border-b border-[var(--card-border)] px-4 py-3">
      <div className="flex rounded-xl bg-[var(--app-bg)] p-1">
        <button
          type="button"
          onClick={() => onPanelChange('presentation')}
          className={`rounded-lg px-3 py-2 text-xs font-black ${
            rightPanel === 'presentation'
              ? 'bg-[var(--card-bg)] text-indigo-500 shadow-sm'
              : 'text-[var(--text-muted)]'
          }`}
        >
          <SlidersHorizontal className="zen-editor-panel-tab-icon hidden h-4 w-4" />
          <span className="zen-editor-panel-label-full">演出设置</span>
          <span className="zen-editor-panel-label-short hidden">演出</span>
        </button>
        <button
          type="button"
          onClick={() => onPanelChange('audio')}
          className={`rounded-lg px-3 py-2 text-xs font-black ${
            rightPanel === 'audio'
              ? 'bg-[var(--card-bg)] text-sky-500 shadow-sm'
              : 'text-[var(--text-muted)]'
          }`}
        >
          <Volume2 className="zen-editor-panel-tab-icon hidden h-4 w-4" />
          <span className="zen-editor-panel-label-full">音频列表</span>
          <span className="zen-editor-panel-label-short hidden">音频</span>
        </button>
        <button
          type="button"
          onClick={() => onPanelChange('text')}
          className={`zen-editor-mobile-text-tab hidden rounded-lg px-3 py-2 text-xs font-black ${
            rightPanel === 'text'
              ? 'bg-[var(--card-bg)] text-emerald-500 shadow-sm'
              : 'text-[var(--text-muted)]'
          }`}
        >
          <FileText className="zen-editor-panel-tab-icon hidden h-4 w-4" />
          <span>文字</span>
        </button>
      </div>
      <button
        onClick={onClose}
        className="rounded-xl border border-rose-400/50 bg-rose-500/10 px-5 py-2.5 text-sm font-black text-rose-500 shadow-sm hover:bg-rose-500 hover:text-white"
      >
        <X className="zen-editor-panel-tab-icon hidden h-4 w-4" />
        <span className="zen-editor-panel-label-full">退出专注</span>
        <span className="zen-editor-panel-label-short hidden">退出</span>
      </button>
    </div>
  );
}
