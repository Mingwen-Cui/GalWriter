import {
  Bot,
  Copy,
  EyeOff,
  FileText,
  Grid3X3,
  Layers,
  Square,
  Trash2,
  Volume2,
} from 'lucide-react';
import type { RefObject } from 'react';

import type { Language } from '../../lib/i18n';
import { translations } from '../../lib/i18n';

interface SelectionMenuProps {
  selectionMenuRef: RefObject<HTMLDivElement | null>;
  selectionMenuLayout: 'horizontal' | 'vertical';
  isMobile?: boolean;
  language: Language;
  selectedNodeCount: number;
  selectedNodeTitle: string;
  canSendToAssistant: boolean;
  ttsLoading: boolean;
  onWrapDynamicGroup: () => void;
  onWrapBackground: () => void;
  onSendToAssistant: () => void;
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
    <div className="my-px h-px w-full bg-slate-200 dark:bg-slate-700" />
  );

export function SelectionMenu({
  selectionMenuRef,
  selectionMenuLayout,
  isMobile = false,
  language,
  selectedNodeCount,
  selectedNodeTitle,
  canSendToAssistant,
  ttsLoading,
  onWrapDynamicGroup,
  onWrapBackground,
  onSendToAssistant,
  onBatchExport,
  onArrange,
  onNarrate,
  onDelete,
  onCopy,
  onHide,
}: SelectionMenuProps) {
  const t = translations[language];
  const isSingleSelection = selectedNodeCount === 1;
  const effectiveSelectionMenuLayout =
    isSingleSelection && !isMobile ? 'vertical' : selectionMenuLayout;
  const isHorizontal = effectiveSelectionMenuLayout === 'horizontal';
  const isMobileGrid = isMobile && !isHorizontal;
  const isDesktopVertical = !isMobile && !isHorizontal;
  const itemWidthClass = isHorizontal || isMobileGrid ? '' : 'w-full';
  const nowrapClass = isHorizontal || isMobileGrid ? 'whitespace-nowrap' : '';
  const shellLayoutClass = isHorizontal
    ? `flex flex-row items-center flex-nowrap shrink-0 ${isMobile ? 'h-11' : 'h-[52px]'}`
    : isMobileGrid
      ? 'grid w-56 grid-cols-2 gap-0.5'
      : 'flex flex-col w-56';
  const shellSizeClass = isMobile
    ? 'p-1 rounded-lg'
    : isHorizontal
      ? 'p-1.5 rounded-xl'
      : 'p-1 rounded-xl';
  const buttonSizeClass = isMobile
    ? 'px-1.5 py-1 text-[10px] gap-1 rounded-md'
    : isHorizontal
      ? 'px-3 py-1.5 text-xs gap-2 rounded-lg'
      : 'px-2.5 py-1 text-xs gap-1.5 rounded-lg';
  const iconSizeClass = isMobile ? 'h-3 w-3' : 'h-4 w-4';
  const buttonBaseClass = `${buttonSizeClass} flex items-center font-bold text-[var(--text-primary)] transition-all shrink-0 hover:bg-slate-100 dark:hover:bg-slate-800 ${itemWidthClass} ${
    isHorizontal || isMobileGrid ? 'justify-center' : 'justify-start text-left'
  }`;

  const tr = (zh: string, ja: string, en: string) =>
    language === 'zh' ? zh : language === 'ja' ? ja : en;
  const selectionMenuSummary = isSingleSelection
    ? selectedNodeTitle || tr('未命名卡片', '名前のないカード', 'Untitled card')
    : '';
  const dynamicWrapLabel = isDesktopVertical
    ? tr('创建动态包裹', '動的ラップを作成', 'Create dynamic wrap')
    : language === 'zh'
      ? '\u52a8\u6001\u5305\u88f9'
      : t.dynamicWrap;
  const bgCardLabel = isDesktopVertical
    ? tr('创建背景卡片', '背景カードを作成', 'Create background card')
    : language === 'zh'
      ? '\u80cc\u666f\u5361\u7247'
      : t.bgCard;
  const sendToAssistantLabel = isDesktopVertical
    ? tr('加入 AI 上下文', 'AI コンテキストに追加', 'Add to AI context')
    : language === 'zh'
      ? '\u53d1\u9001\u7ed9 AI'
      : language === 'ja'
        ? 'AI\u306b\u9001\u4fe1'
        : 'Send to AI';
  const batchExportLabel = isDesktopVertical
    ? tr('汇总为文本', 'テキストにまとめる', 'Compile as text')
    : language === 'zh'
      ? '\u6279\u91cf\u6587\u672c\u5bfc\u51fa'
      : 'Batch Export';
  const narrationLabel = language === 'zh' ? '\u751f\u6210\u6717\u8bfb\u97f3\u9891' : 'Narration';
  const narrationTitle =
    language === 'zh' ? '\u751f\u6210\u6717\u8bfb\u97f3\u9891' : 'Generate narration audio';
  const arrangeLabel = isDesktopVertical
    ? tr('整理布局', 'レイアウトを整理', 'Arrange layout')
    : language === 'zh'
      ? '\u6574\u7406\u5361\u7247'
      : 'Arrange';
  const arrangeTitle =
    language === 'zh' ? '\u6574\u7406\u9009\u4e2d\u7684\u5361\u7247' : 'Arrange selected cards';
  const deleteLabel = isDesktopVertical
    ? tr(
        `删除 ${selectedNodeCount} 张卡片`,
        `${selectedNodeCount} 枚のカードを削除`,
        `Delete ${selectedNodeCount} cards`,
      )
    : language === 'zh'
      ? '\u5220\u9664'
      : 'Delete';
  const copyLabel = language === 'zh' ? '\u590d\u5236' : 'Copy';
  const hideLabel = language === 'zh' ? '\u9690\u85cf' : 'Hide';

  return (
    <div
      ref={selectionMenuRef}
      className={`toolbar-bubble-surface glass-toolbar fixed left-0 top-0 z-[100] ${shellLayoutClass} ${
        !isHorizontal && !isMobileGrid ? 'selection-menu-vertical' : ''
      } bg-[var(--toolbar-bg)] backdrop-blur-md ${shellSizeClass} shadow-2xl border border-[var(--toolbar-border)] overflow-hidden`}
      style={{
        transform:
          'translate3d(var(--selection-menu-x, -9999px), var(--selection-menu-y, -9999px), 0) translate(-50%, var(--selection-menu-translate-y, -100%))',
        willChange: 'transform',
      }}
    >
      {isDesktopVertical ? (
        <>
          <div className="selection-menu-summary px-2.5 py-2 text-xs font-bold text-[var(--text-primary)]">
            {selectionMenuSummary || tr(
              `已选 ${selectedNodeCount} 张卡片`,
              `${selectedNodeCount} 枚を選択中`,
              `${selectedNodeCount} cards selected`,
            )}
          </div>

          <div className="selection-menu-section">
            {tr('组织与布局', '構成とレイアウト', 'Organize & layout')}
          </div>
          {!isSingleSelection && (
            <button
              onClick={onWrapDynamicGroup}
              className={`${buttonBaseClass} selection-menu-action`}
              title={dynamicWrapLabel}
            >
              <Layers className={`${iconSizeClass} shrink-0`} />
              <span>{dynamicWrapLabel}</span>
            </button>
          )}
          <button
            onClick={onWrapBackground}
            className={`${buttonBaseClass} selection-menu-action`}
            title={bgCardLabel}
          >
            <Square className={`${iconSizeClass} shrink-0`} />
            <span>{bgCardLabel}</span>
          </button>

          <div className="selection-menu-section">
            {tr('AI 与输出', 'AI と出力', 'AI & output')}
          </div>
          {canSendToAssistant && (
            <button
              onClick={onSendToAssistant}
              className={`${buttonBaseClass} selection-menu-action selection-menu-ai-action`}
              title={sendToAssistantLabel}
            >
              <Bot className={`${iconSizeClass} shrink-0`} />
              <span>{sendToAssistantLabel}</span>
            </button>
          )}
          <button
            onClick={onBatchExport}
            className={`${buttonBaseClass} selection-menu-action`}
            title={batchExportLabel}
          >
            <FileText className={`${iconSizeClass} shrink-0`} />
            <span>{batchExportLabel}</span>
          </button>
          <button
            onClick={onNarrate}
            disabled={ttsLoading}
            className={`${buttonBaseClass} selection-menu-action disabled:opacity-50`}
            title={narrationTitle}
          >
            <Volume2 className={`${iconSizeClass} shrink-0 ${ttsLoading ? 'animate-pulse' : ''}`} />
            <span>{narrationLabel}</span>
          </button>

          <div className="selection-menu-section">
            {tr('编辑选中项', '選択項目を編集', 'Edit selection')}
          </div>
          {!isSingleSelection && (
            <button
              onClick={onArrange}
              className={`${buttonBaseClass} selection-menu-action`}
              title={arrangeTitle}
            >
              <Grid3X3 className={`${iconSizeClass} shrink-0`} />
              <span>{arrangeLabel}</span>
            </button>
          )}
          <button
            onClick={onCopy}
            className={`${buttonBaseClass} selection-menu-action`}
            title={copyLabel}
          >
            <Copy className={`${iconSizeClass} shrink-0`} />
            <span>{copyLabel}</span>
          </button>
          <button
            onClick={onHide}
            className={`${buttonBaseClass} selection-menu-action`}
            title={hideLabel}
          >
            <EyeOff className={`${iconSizeClass} shrink-0`} />
            <span>{hideLabel}</span>
          </button>

          <div className="selection-menu-danger-divider" />
          <button
            onClick={onDelete}
            className={`${buttonBaseClass} selection-menu-action selection-menu-delete-action`}
            title={deleteLabel}
          >
            <Trash2 className={`${iconSizeClass} shrink-0`} />
            <span>{deleteLabel}</span>
          </button>
        </>
      ) : (
        <>
          <button onClick={onWrapDynamicGroup} className={buttonBaseClass} title={dynamicWrapLabel}>
            <Layers className={`${iconSizeClass} shrink-0`} />
            <span className={nowrapClass}>{dynamicWrapLabel}</span>
          </button>
          <Divider horizontal={isHorizontal} isMobile={isMobile} />
          <button onClick={onWrapBackground} className={buttonBaseClass} title={bgCardLabel}>
            <Square className={`${iconSizeClass} shrink-0`} />
            <span className={nowrapClass}>{bgCardLabel}</span>
          </button>
          <Divider horizontal={isHorizontal} isMobile={isMobile} />
          {canSendToAssistant && (
            <>
              <button
                onClick={onSendToAssistant}
                className={buttonBaseClass}
                title={sendToAssistantLabel}
              >
                <Bot className={`${iconSizeClass} shrink-0`} />
                <span className={nowrapClass}>{sendToAssistantLabel}</span>
              </button>
              <Divider horizontal={isHorizontal} isMobile={isMobile} />
            </>
          )}
          <button onClick={onBatchExport} className={buttonBaseClass} title={batchExportLabel}>
            <FileText className={`${iconSizeClass} shrink-0`} />
            <span className={nowrapClass}>{batchExportLabel}</span>
          </button>
          <Divider horizontal={isHorizontal} isMobile={isMobile} />
          <button
            onClick={onNarrate}
            disabled={ttsLoading}
            className={`${buttonBaseClass} disabled:opacity-50`}
            title={narrationTitle}
          >
            <Volume2 className={`${iconSizeClass} shrink-0 ${ttsLoading ? 'animate-pulse' : ''}`} />
            <span className={nowrapClass}>{narrationLabel}</span>
          </button>
          <Divider horizontal={isHorizontal} isMobile={isMobile} />
          <button onClick={onArrange} className={buttonBaseClass} title={arrangeTitle}>
            <Grid3X3 className={`${iconSizeClass} shrink-0`} />
            <span className={nowrapClass}>{arrangeLabel}</span>
          </button>
          <button onClick={onDelete} className={buttonBaseClass} title={deleteLabel}>
            <Trash2 className={`${iconSizeClass} shrink-0`} />
            <span className={nowrapClass}>{deleteLabel}</span>
          </button>
          <button onClick={onCopy} className={buttonBaseClass} title={copyLabel}>
            <Copy className={`${iconSizeClass} shrink-0`} />
            <span className={nowrapClass}>{copyLabel}</span>
          </button>
          <button onClick={onHide} className={buttonBaseClass} title={hideLabel}>
            <EyeOff className={`${iconSizeClass} shrink-0`} />
            <span className={nowrapClass}>{hideLabel}</span>
          </button>
        </>
      )}
    </div>
  );
}
