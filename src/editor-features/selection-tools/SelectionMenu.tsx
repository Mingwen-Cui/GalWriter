import { Copy, EyeOff, FileText, Grid3X3, Layers, Square, Trash2, Volume2 } from 'lucide-react';
import type { RefObject } from 'react';

import type { Language } from '../../lib/i18n';
import { translations } from '../../lib/i18n';

interface SelectionMenuProps {
  selectionMenuRef: RefObject<HTMLDivElement | null>;
  selectionMenuLayout: 'horizontal' | 'vertical';
  isMobile?: boolean;
  language: Language;
  ttsLoading: boolean;
  onWrapDynamicGroup: () => void;
  onWrapBackground: () => void;
  onBatchExport: () => void;
  onArrange: () => void;
  onNarrate: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onHide: () => void;
}

const Divider = ({ horizontal, isMobile }: { horizontal: boolean; isMobile: boolean }) =>
  isMobile && !horizontal ? null : horizontal ? (
    <div
      className={`${isMobile ? 'h-3' : 'h-4'} w-px shrink-0 bg-slate-200 dark:bg-slate-700 ${isMobile ? 'mx-0.5' : 'mx-1'}`}
    />
  ) : (
    <div className="my-0.5 h-px w-full bg-slate-200 dark:bg-slate-700" />
  );

export function SelectionMenu({
  selectionMenuRef,
  selectionMenuLayout,
  isMobile = false,
  language,
  ttsLoading,
  onWrapDynamicGroup,
  onWrapBackground,
  onBatchExport,
  onArrange,
  onNarrate,
  onDelete,
  onCopy,
  onHide,
}: SelectionMenuProps) {
  const t = translations[language];
  const isHorizontal = selectionMenuLayout === 'horizontal';
  const isMobileGrid = isMobile && !isHorizontal;
  const itemWidthClass = isHorizontal || isMobileGrid ? '' : 'w-full';
  const nowrapClass = isHorizontal || isMobileGrid ? 'whitespace-nowrap' : '';
  const shellLayoutClass = isHorizontal
    ? `flex flex-row items-center flex-nowrap shrink-0 ${isMobile ? 'h-11' : 'h-[52px]'}`
    : isMobileGrid
      ? 'grid w-56 grid-cols-2 gap-0.5'
      : 'flex flex-col w-40';
  const shellSizeClass = isMobile ? 'p-1 rounded-lg' : 'p-1.5 rounded-xl';
  const buttonSizeClass = isMobile
    ? 'px-1.5 py-1 text-[10px] gap-1 rounded-md'
    : 'px-3 py-1.5 text-xs gap-2 rounded-lg';
  const iconSizeClass = isMobile ? 'h-3 w-3' : 'h-4 w-4';
  const buttonBaseClass = `${buttonSizeClass} flex items-center font-bold transition-all shrink-0 ${itemWidthClass}`;

  const dynamicWrapLabel = language === 'zh' ? '\u52a8\u6001\u5305\u88f9' : t.dynamicWrap;
  const bgCardLabel = language === 'zh' ? '\u80cc\u666f\u5361\u7247' : t.bgCard;
  const batchExportLabel = language === 'zh' ? '\u6279\u91cf\u6587\u672c\u5bfc\u51fa' : 'Batch Export';
  const narrationLabel = language === 'zh' ? '\u751f\u6210\u6717\u8bfb\u97f3\u9891' : 'Narration';
  const narrationTitle = language === 'zh' ? '\u751f\u6210\u6717\u8bfb\u97f3\u9891' : 'Generate narration audio';
  const arrangeLabel = language === 'zh' ? '\u6574\u7406\u5361\u7247' : 'Arrange';
  const arrangeTitle = language === 'zh' ? '\u6574\u7406\u9009\u4e2d\u7684\u5361\u7247' : 'Arrange selected cards';
  const deleteLabel = language === 'zh' ? '\u5220\u9664' : 'Delete';
  const copyLabel = language === 'zh' ? '\u590d\u5236' : 'Copy';
  const hideLabel = language === 'zh' ? '\u9690\u85cf' : 'Hide';

  return (
    <div
      ref={selectionMenuRef}
      className={`toolbar-bubble-surface glass-toolbar fixed left-0 top-0 z-[100] ${shellLayoutClass} bg-[var(--toolbar-bg)] backdrop-blur-md ${shellSizeClass} shadow-2xl border border-[var(--toolbar-border)] overflow-hidden`}
      style={{
        transform:
          'translate3d(var(--selection-menu-x, -9999px), var(--selection-menu-y, -9999px), 0) translate(-50%, -100%)',
        willChange: 'transform',
      }}
    >
      <button
        onClick={onWrapDynamicGroup}
        className={`${buttonBaseClass} text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30`}
        title={dynamicWrapLabel}
      >
        <Layers className={`${iconSizeClass} shrink-0`} />
        <span className={nowrapClass}>{dynamicWrapLabel}</span>
      </button>

      <Divider horizontal={isHorizontal} isMobile={isMobile} />

      <button
        onClick={onWrapBackground}
        className={`${buttonBaseClass} text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 dark:text-white dark:hover:bg-indigo-900/30 dark:hover:text-[var(--accent)]`}
        title={bgCardLabel}
      >
        <Square className={`${iconSizeClass} shrink-0`} />
        <span className={nowrapClass}>{bgCardLabel}</span>
      </button>

      <Divider horizontal={isHorizontal} isMobile={isMobile} />

      <button
        onClick={onBatchExport}
        className={`${buttonBaseClass} text-[var(--icon-color)] hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/30 dark:hover:text-[var(--accent)]`}
        title={batchExportLabel}
      >
        <FileText className={`${iconSizeClass} shrink-0`} />
        <span className={nowrapClass}>{batchExportLabel}</span>
      </button>

      <Divider horizontal={isHorizontal} isMobile={isMobile} />

      <button
        onClick={onNarrate}
        disabled={ttsLoading}
        className={`${buttonBaseClass} text-sky-600 hover:bg-sky-50 disabled:opacity-50 dark:text-sky-400 dark:hover:bg-sky-900/30`}
        title={narrationTitle}
      >
        <Volume2 className={`${iconSizeClass} shrink-0 ${ttsLoading ? 'animate-pulse' : ''}`} />
        <span className={nowrapClass}>{narrationLabel}</span>
      </button>

      <Divider horizontal={isHorizontal} isMobile={isMobile} />

      <button
        onClick={onArrange}
        className={`${buttonBaseClass} text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/30`}
        title={arrangeTitle}
      >
        <Grid3X3 className={`${iconSizeClass} shrink-0`} />
        <span className={nowrapClass}>{arrangeLabel}</span>
      </button>

      <button
        onClick={onDelete}
        className={`${buttonBaseClass} text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30`}
        title={deleteLabel}
      >
        <Trash2 className={`${iconSizeClass} shrink-0`} />
        <span className={nowrapClass}>{deleteLabel}</span>
      </button>

      <button
        onClick={onCopy}
        className={`${buttonBaseClass} text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 dark:text-white dark:hover:bg-indigo-900/30 dark:hover:text-[var(--accent)]`}
        title={copyLabel}
      >
        <Copy className={`${iconSizeClass} shrink-0`} />
        <span className={nowrapClass}>{copyLabel}</span>
      </button>

      <button
        onClick={onHide}
        className={`${buttonBaseClass} text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 dark:text-white dark:hover:bg-indigo-900/30 dark:hover:text-[var(--accent)]`}
        title={hideLabel}
      >
        <EyeOff className={`${iconSizeClass} shrink-0`} />
        <span className={nowrapClass}>{hideLabel}</span>
      </button>
    </div>
  );
}
