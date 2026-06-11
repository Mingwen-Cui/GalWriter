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
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ChangeEvent, Dispatch, MutableRefObject, SetStateAction } from 'react';

import characterCardAnimation from '../animation/character card.lottie';
import plotStructureAnimation from '../animation/plot structure.lottie';
import sceneSettingCardAnimation from '../animation/scence setting card.lottie';
import textSummaryAnimation from '../animation/test summary.lottie';
import type { Language } from '../lib/i18n';

type HoverGuideKind = 'character' | 'scene' | 'plotStructure' | 'textSummary';

const hoverGuideAnimations: Record<
  HoverGuideKind,
  {
    src: string;
    width: number;
    animationHeight: number;
    visibleHeight: number;
  }
> = {
  character: {
    src: characterCardAnimation,
    width: 500,
    animationHeight: 650,
    visibleHeight: 600,
  },
  scene: {
    src: sceneSettingCardAnimation,
    width: 500,
    animationHeight: 650,
    visibleHeight: 600,
  },
  plotStructure: {
    src: plotStructureAnimation,
    width: 650,
    animationHeight: 700,
    visibleHeight: 650,
  },
  textSummary: {
    src: textSummaryAnimation,
    width: 700,
    animationHeight: 650,
    visibleHeight: 600,
  },
};

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
  const guideHoverDelayMs = 600;
  const guideDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeHoverGuide, setActiveHoverGuide] = useState<HoverGuideKind | null>(null);
  const [shouldRenderHoverGuide, setShouldRenderHoverGuide] = useState(false);
  const [showHoverGuide, setShowHoverGuide] = useState(false);
  const [hoverGuidePosition, setHoverGuidePosition] = useState({
    left: 0,
    top: 0,
  });

  const showCardHoverGuide = (kind: HoverGuideKind, button: HTMLButtonElement) => {
    const rect = button.getBoundingClientRect();
    const { width, visibleHeight } = hoverGuideAnimations[kind];
    const nextLeft = Math.min(Math.max(rect.right + 16, 16), window.innerWidth - width - 16);
    const nextTop = Math.min(
      Math.max(rect.top + rect.height / 2 - visibleHeight / 2, 16),
      window.innerHeight - visibleHeight - 16,
    );

    setHoverGuidePosition({
      left: nextLeft,
      top: nextTop,
    });
    setActiveHoverGuide(kind);
    setShouldRenderHoverGuide(true);
    setShowHoverGuide(false);

    if (guideDelayTimerRef.current) {
      clearTimeout(guideDelayTimerRef.current);
    }
    guideDelayTimerRef.current = setTimeout(() => {
      setShowHoverGuide(true);
    }, guideHoverDelayMs);
  };

  const hideCardHoverGuide = () => {
    if (guideDelayTimerRef.current) {
      clearTimeout(guideDelayTimerRef.current);
      guideDelayTimerRef.current = null;
    }
    setShowHoverGuide(false);
    setShouldRenderHoverGuide(false);
    setActiveHoverGuide(null);
  };

  useEffect(() => {
    return () => {
      if (guideDelayTimerRef.current) {
        clearTimeout(guideDelayTimerRef.current);
      }
    };
  }, []);

  const activeHoverGuideConfig = activeHoverGuide ? hoverGuideAnimations[activeHoverGuide] : null;

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
              onMouseEnter={(event) => showCardHoverGuide('character', event.currentTarget)}
              onMouseLeave={hideCardHoverGuide}
              onFocus={(event) => showCardHoverGuide('character', event.currentTarget)}
              onBlur={hideCardHoverGuide}
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
              onMouseEnter={(event) => showCardHoverGuide('scene', event.currentTarget)}
              onMouseLeave={hideCardHoverGuide}
              onFocus={(event) => showCardHoverGuide('scene', event.currentTarget)}
              onBlur={hideCardHoverGuide}
              title={t.toolScene}
            >
              <MapPin strokeWidth={2.5} className="h-5 w-5" />
            </button>

            <button
              className="flex items-center justify-center rounded-xl p-2.5 text-[var(--icon-color)] transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
              onClick={addNewPlotStructureNode}
              onMouseEnter={(event) => showCardHoverGuide('plotStructure', event.currentTarget)}
              onMouseLeave={hideCardHoverGuide}
              onFocus={(event) => showCardHoverGuide('plotStructure', event.currentTarget)}
              onBlur={hideCardHoverGuide}
              title={t.toolPlotStructure}
            >
              <BookOpen strokeWidth={2.5} className="h-5 w-5" />
            </button>

            <div className="my-1 h-px w-full bg-[var(--toolbar-border)]/50" />

            <button
              className="flex items-center justify-center rounded-xl p-2.5 text-[var(--icon-color)] transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
              onClick={addNewSummaryNode}
              onMouseEnter={(event) => showCardHoverGuide('textSummary', event.currentTarget)}
              onMouseLeave={hideCardHoverGuide}
              onFocus={(event) => showCardHoverGuide('textSummary', event.currentTarget)}
              onBlur={hideCardHoverGuide}
              title={
                language === 'zh'
                  ? '文本转换/汇总'
                  : language === 'ja'
                    ? 'テキスト変換/要約'
                    : 'Text Summary'
              }
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
              title={
                language === 'zh'
                  ? '数字判断卡片'
                  : language === 'ja'
                    ? '数値判定カード'
                    : 'Number Condition'
              }
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

      {shouldRenderHoverGuide &&
        activeHoverGuide &&
        activeHoverGuideConfig &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className={`pointer-events-none fixed z-[9999] overflow-hidden rounded-xl border border-white/30 bg-white/20 shadow-2xl backdrop-blur-xl transition-opacity duration-150 ${
              showHoverGuide ? 'opacity-100' : 'opacity-0'
            }`}
            data-testid={`${activeHoverGuide}-card-guide-lottie`}
            style={{
              left: `${hoverGuidePosition.left}px`,
              top: `${hoverGuidePosition.top}px`,
              width: `${activeHoverGuideConfig.width}px`,
              height: `${activeHoverGuideConfig.visibleHeight}px`,
            }}
          >
            <DotLottieReact
              src={activeHoverGuideConfig.src}
              loop
              autoplay
              width={activeHoverGuideConfig.width}
              height={activeHoverGuideConfig.animationHeight}
              className="block max-w-none"
              renderConfig={{ autoResize: false }}
              style={{
                width: `${activeHoverGuideConfig.width}px`,
                height: `${activeHoverGuideConfig.animationHeight}px`,
              }}
              aria-hidden="true"
            />
          </div>,
          document.body,
        )}
    </>
  );
}
