import { Copy, EyeOff, FileText, Layers, Square, Trash2, Volume2 } from 'lucide-react';
import type { RefObject } from 'react';

import type { Language } from '../../lib/i18n';
import { translations } from '../../lib/i18n';

interface SelectionMenuProps {
  selectionMenuRef: RefObject<HTMLDivElement | null>;
  selectionMenuLayout: 'horizontal' | 'vertical';
  language: Language;
  ttsLoading: boolean;
  onWrapDynamicGroup: () => void;
  onWrapBackground: () => void;
  onBatchExport: () => void;
  onNarrate: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onHide: () => void;
}

const Divider = ({ horizontal }: { horizontal: boolean }) =>
  horizontal ? (
    <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1 shrink-0" />
  ) : (
    <div className="h-px w-full bg-slate-200 dark:bg-slate-700 my-0.5" />
  );

export function SelectionMenu({
  selectionMenuRef,
  selectionMenuLayout,
  language,
  ttsLoading,
  onWrapDynamicGroup,
  onWrapBackground,
  onBatchExport,
  onNarrate,
  onDelete,
  onCopy,
  onHide,
}: SelectionMenuProps) {
  const t = translations[language];
  const isHorizontal = selectionMenuLayout === 'horizontal';
  const itemWidthClass = isHorizontal ? '' : 'w-full';
  const nowrapClass = isHorizontal ? 'whitespace-nowrap' : '';

  return (
    <div
      ref={selectionMenuRef}
      className={`toolbar-bubble-surface glass-toolbar fixed left-0 top-0 z-[100] flex ${isHorizontal ? 'flex-row items-center flex-nowrap shrink-0 h-[52px]' : 'flex-col w-40'} bg-[var(--toolbar-bg)] backdrop-blur-md p-1.5 rounded-xl shadow-2xl border border-[var(--toolbar-border)] overflow-hidden`}
      style={{
        transform:
          'translate3d(var(--selection-menu-x, -9999px), var(--selection-menu-y, -9999px), 0) translate(-50%, -100%)',
        willChange: 'transform',
      }}
    >
      <button
        onClick={onWrapDynamicGroup}
        className={`px-3 py-1.5 flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all shrink-0 ${itemWidthClass}`}
        title={t.dynamicWrap}
      >
        <Layers className="w-4 h-4 shrink-0" />
        <span className={nowrapClass}>{t.dynamicWrap}</span>
      </button>

      <Divider horizontal={isHorizontal} />

      <button
        onClick={onWrapBackground}
        className={`px-3 py-1.5 flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-white hover:text-indigo-600 dark:hover:text-[var(--accent)] hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all shrink-0 ${itemWidthClass}`}
        title={t.bgCard}
      >
        <Square className="w-4 h-4 shrink-0" />
        <span className={nowrapClass}>{t.bgCard}</span>
      </button>

      <Divider horizontal={isHorizontal} />

      <button
        onClick={onBatchExport}
        className={`px-3 py-1.5 flex items-center gap-2 text-xs font-bold text-[var(--icon-color)] hover:text-indigo-600 dark:hover:text-[var(--accent)] hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all shrink-0 ${itemWidthClass}`}
        title={language === 'zh' ? '批量文本导出' : 'Batch Export'}
      >
        <FileText className="w-4 h-4 shrink-0" />
        <span className={nowrapClass}>{language === 'zh' ? '批量文本导出' : 'Batch Export'}</span>
      </button>

      <Divider horizontal={isHorizontal} />

      <button
        onClick={onNarrate}
        disabled={ttsLoading}
        className={`px-3 py-1.5 flex items-center gap-2 text-xs font-bold text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/30 rounded-lg transition-all shrink-0 disabled:opacity-50 ${itemWidthClass}`}
        title={language === 'zh' ? '生成朗读音频' : 'Generate narration audio'}
      >
        <Volume2 className={`w-4 h-4 shrink-0 ${ttsLoading ? 'animate-pulse' : ''}`} />
        <span className={nowrapClass}>{language === 'zh' ? '生成朗读音频' : 'Narration'}</span>
      </button>

      <Divider horizontal={isHorizontal} />

      <button
        onClick={onDelete}
        className={`px-3 py-1.5 flex items-center gap-2 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all shrink-0 ${itemWidthClass}`}
        title={language === 'zh' ? '删除' : 'Delete'}
      >
        <Trash2 className="w-4 h-4 shrink-0" />
        <span className={nowrapClass}>{language === 'zh' ? '删除' : 'Delete'}</span>
      </button>

      <button
        onClick={onCopy}
        className={`px-3 py-1.5 flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-white hover:text-indigo-600 dark:hover:text-[var(--accent)] hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all shrink-0 ${itemWidthClass}`}
        title={language === 'zh' ? '复制' : 'Copy'}
      >
        <Copy className="w-4 h-4 shrink-0" />
        <span className={nowrapClass}>{language === 'zh' ? '复制' : 'Copy'}</span>
      </button>

      <button
        onClick={onHide}
        className={`px-3 py-1.5 flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-white hover:text-indigo-600 dark:hover:text-[var(--accent)] hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all shrink-0 ${itemWidthClass}`}
        title={language === 'zh' ? '隐藏' : 'Hide'}
      >
        <EyeOff className="w-4 h-4 shrink-0" />
        <span className={nowrapClass}>{language === 'zh' ? '隐藏' : 'Hide'}</span>
      </button>
    </div>
  );
}
