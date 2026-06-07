import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import {
  BookOpen,
  Calculator,
  ChevronDown,
  Eye,
  FileText,
  Image as ImageIcon,
  MapPin,
  Redo2,
  Replace,
  Square,
  Type,
  Undo2,
  UserCircle2,
} from 'lucide-react';
import { useState } from 'react';
import type {
  ChangeEvent,
  Dispatch,
  MouseEvent as ReactMouseEvent,
  MutableRefObject,
  SetStateAction,
} from 'react';

import characterCardAnimation from '../animation/character card.lottie';
import type { Language } from '../lib/i18n';

interface EditorLeftToolbarProps {
  isMobile: boolean;
  language: Language;
  toolbarCollapsed: boolean;
  historyPastLength: number;
  historyFutureLength: number;
  hasHiddenNodes: boolean;
  fileInputRef: MutableRefObject<HTMLInputElement | null>;
  setToolbarCollapsed: Dispatch<SetStateAction<boolean>>;
  addNewShape: (shape: 'square' | 'diamond' | 'rounded-rectangle') => void;
  addNewTextNode: () => void;
  addNewCharacterNode: () => void;
  addNewSceneNode: () => void;
  addNewPlotStructureNode: () => void;
  addNewSummaryNode: () => void;
  addNewBatchReplaceNode: () => void;
  addNewNumberConditionNode: () => void;
  handleMediaUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  undo: () => void;
  redo: () => void;
  unhideAllNodes: () => void;
  t: {
    toolSquare: string;
    toolText: string;
    toolScene: string;
    toolPlotStructure: string;
    toolBatchReplace: string;
    toolMedia: string;
    unhideAll: string;
  };
}

export function EditorLeftToolbar({
  isMobile,
  language,
  toolbarCollapsed,
  historyPastLength,
  historyFutureLength,
  hasHiddenNodes,
  fileInputRef,
  setToolbarCollapsed,
  addNewShape,
  addNewTextNode,
  addNewCharacterNode,
  addNewSceneNode,
  addNewPlotStructureNode,
  addNewSummaryNode,
  addNewBatchReplaceNode,
  addNewNumberConditionNode,
  handleMediaUpload,
  undo,
  redo,
  unhideAllNodes,
  t,
}: EditorLeftToolbarProps) {
  const [showCharacterCardGuide, setShowCharacterCardGuide] = useState(false);
  const [characterCardGuidePosition, setCharacterCardGuidePosition] = useState({
    left: 0,
    top: 0,
  });

  const showCharacterCardHoverGuide = (event: ReactMouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const nextTop = Math.min(Math.max(rect.top + rect.height / 2 - 250, 16), window.innerHeight - 516);

    setCharacterCardGuidePosition({
      left: rect.right + 16,
      top: nextTop,
    });
    setShowCharacterCardGuide(true);
  };

  return (
    <>
      <div
      className={`toolbar-bubble-surface glass-toolbar absolute ${
        isMobile ? 'left-4 top-20' : 'left-6 top-20'
      } z-20 flex w-[52px] flex-col rounded-2xl border border-[var(--toolbar-border)] bg-[var(--toolbar-bg)] p-1 shadow-xl backdrop-blur transition-all duration-500 ease-in-out ${
        toolbarCollapsed ? 'h-[52px] overflow-hidden' : 'overflow-visible'
      }`}
    >
      <button
        onClick={() => setToolbarCollapsed((value) => !value)}
        className="mx-auto flex shrink-0 items-center justify-center p-2.5 text-slate-400 transition-colors duration-300 hover:text-slate-600 dark:text-slate-200 dark:hover:text-white"
        title={
          toolbarCollapsed
            ? language === 'zh'
              ? '展开工具栏'
              : language === 'ja'
                ? 'ツールバーを展開'
                : 'Expand Toolbar'
            : language === 'zh'
              ? '折叠工具栏'
              : language === 'ja'
                ? 'ツールバーを折りたたむ'
                : 'Collapse Toolbar'
        }
      >
        <div
          className={`transition-transform duration-500 ${toolbarCollapsed ? 'rotate-0' : 'rotate-180'}`}
        >
          <ChevronDown className="h-6 w-6" />
        </div>
      </button>

      {!toolbarCollapsed && (
        <div className="toolbar-flat-content animate-in fade-in slide-in-from-top-2 flex flex-col duration-300">
          <button
            className="group relative flex items-center justify-center rounded-xl p-2.5 text-[var(--icon-color)] transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
            onClick={() => addNewShape('square')}
            title={t.toolSquare}
          >
            <Square strokeWidth={3} className="h-5 w-5" />
          </button>

          <button
            className="group relative flex items-center justify-center rounded-xl p-2.5 text-[var(--icon-color)] transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
            onClick={addNewTextNode}
            title={t.toolText}
          >
            <Type strokeWidth={2.5} className="h-5 w-5" />
          </button>

          <div className="my-1 h-px w-full bg-[var(--toolbar-border)]/50" />

          <button
            className="relative flex items-center justify-center rounded-xl p-2.5 text-[var(--icon-color)] transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
            onClick={addNewCharacterNode}
            onMouseEnter={showCharacterCardHoverGuide}
            onMouseLeave={() => setShowCharacterCardGuide(false)}
            onFocus={showCharacterCardHoverGuide}
            onBlur={() => setShowCharacterCardGuide(false)}
            aria-label={
              language === 'zh'
                ? '添加人物卡片'
                : language === 'ja'
                  ? '人物カードを追加'
                  : 'Add Character Card'
            }
          >
            <UserCircle2 strokeWidth={2.5} className="h-5 w-5" />
          </button>

          <button
            className="flex items-center justify-center rounded-xl p-2.5 text-[var(--icon-color)] transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
            onClick={addNewSceneNode}
            title={t.toolScene}
          >
            <MapPin strokeWidth={2.5} className="h-5 w-5" />
          </button>

          <button
            className="flex items-center justify-center rounded-xl p-2.5 text-[var(--icon-color)] transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
            onClick={addNewPlotStructureNode}
            title={t.toolPlotStructure}
          >
            <BookOpen strokeWidth={2.5} className="h-5 w-5" />
          </button>

          <div className="my-1 h-px w-full bg-[var(--toolbar-border)]/50" />

          <button
            className="flex items-center justify-center rounded-xl p-2.5 text-[var(--icon-color)] transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
            onClick={addNewSummaryNode}
            title={language === 'zh' ? '文本转换/汇总' : language === 'ja' ? 'テキスト変換/要約' : 'Text Summary'}
          >
            <FileText strokeWidth={2.5} className="h-5 w-5" />
          </button>

          <button
            className="flex items-center justify-center rounded-xl p-2.5 text-[var(--icon-color)] transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
            onClick={addNewBatchReplaceNode}
            title={t.toolBatchReplace}
          >
            <Replace strokeWidth={2.5} className="h-5 w-5" />
          </button>

          <button
            className="flex items-center justify-center rounded-xl p-2.5 text-[var(--icon-color)] transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
            onClick={addNewNumberConditionNode}
            title={language === 'zh' ? '数字判断卡片' : language === 'ja' ? '数値判定カード' : 'Number Condition'}
          >
            <Calculator strokeWidth={2.5} className="h-5 w-5" />
          </button>

          <div className="my-1 h-px w-full bg-[var(--toolbar-border)]/50" />

          <button
            className="flex items-center justify-center rounded-xl p-2.5 text-[var(--icon-color)] transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
            onClick={() => fileInputRef.current?.click()}
            title={t.toolMedia}
          >
            <ImageIcon strokeWidth={2.5} className="h-5 w-5" />
          </button>

          {isMobile && (
            <>
              <div className="my-1 h-px w-full bg-slate-100" />
              <button
                onClick={undo}
                disabled={historyPastLength === 0}
                className="flex items-center justify-center rounded-xl p-2.5 text-[var(--icon-color)] transition-colors disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700"
                title="Undo"
              >
                <Undo2 className="h-5 w-5" />
              </button>
              <button
                onClick={redo}
                disabled={historyFutureLength === 0}
                className="flex items-center justify-center rounded-xl p-2.5 text-[var(--icon-color)] transition-colors disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700"
                title="Redo"
              >
                <Redo2 className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
      )}

      <input
        type="file"
        accept="image/*,video/*,audio/*"
        className="hidden"
        ref={fileInputRef}
        onChange={handleMediaUpload}
        multiple
      />

        {hasHiddenNodes && (
          <div className="mt-2 flex flex-col items-center border-t border-slate-100 pt-2 dark:border-slate-800">
            <button
              className="animate-pulse rounded-xl bg-indigo-50 p-2.5 text-indigo-600 transition-colors hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50"
              onClick={unhideAllNodes}
              title={t.unhideAll}
            >
              <Eye className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      {showCharacterCardGuide && (
        <div
          className="pointer-events-none fixed z-[9999] overflow-hidden rounded-xl border border-[var(--toolbar-border)] bg-[var(--card-bg)] shadow-2xl"
          style={{
            left: `${characterCardGuidePosition.left}px`,
            top: `${characterCardGuidePosition.top}px`,
            width: '500px',
            height: '600px',
          }}
        >
          <DotLottieReact
            src={characterCardAnimation}
            loop
            autoplay
            className="h-full w-full"
            aria-hidden="true"
          />
        </div>
      )}
    </>
  );
}
