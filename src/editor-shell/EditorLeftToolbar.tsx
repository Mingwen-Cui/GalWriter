import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import {
  AudioLines,
  BookOpen,
  Calculator,
  ChevronDown,
  Eye,
  FileText,
  GitFork,
  Heading1,
  Image as ImageIcon,
  Layers,
  MapPin,
  MousePointer2,
  Replace,
  Square,
  SquareDashedMousePointer,
  Type,
  UserCircle2,
  Video,
} from 'lucide-react';
import type { ChangeEvent, Dispatch, MutableRefObject, SetStateAction } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import characterCardAnimation from '../animation/character card.lottie';
import numberConditionAnimation from '../animation/math.lottie';
import batchReplaceAnimation from '../animation/patch place.lottie';
import plotStructureAnimation from '../animation/plot structure.lottie';
import sceneSettingCardAnimation from '../animation/scence setting card.lottie';
import textSummaryAnimation from '../animation/test summary.lottie';
import type { StoryCardVisualShape } from '../domain/project';
import type { Language } from '../lib/i18n';
import { MEDIA_FILE_ACCEPT, VIDEO_FILE_ACCEPT } from '../lib/mediaImport';
import { getSideToolbarStrings } from './i18n/side-toolbar';

type HoverGuideKind =
  | 'character'
  | 'scene'
  | 'plotStructure'
  | 'textSummary'
  | 'batchReplace'
  | 'numberCondition';

const GUIDE_VIEWPORT_MARGIN = 16;
const QUICK_MENU_ITEM_WIDTH = 82;
const QUICK_MENU_HEIGHT = 88;
const QUICK_MENU_GAP = 12;

const hoverGuideDataCache = new Map<string, Promise<ArrayBuffer>>();

const loadHoverGuideData = (src: string) => {
  const cached = hoverGuideDataCache.get(src);
  if (cached) return cached;

  const request = fetch(src)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to preload hover guide: ${response.status}`);
      }
      return response.arrayBuffer();
    })
    .catch((error) => {
      hoverGuideDataCache.delete(src);
      throw error;
    });

  hoverGuideDataCache.set(src, request);
  return request;
};

type MediaPickerKind = 'all' | 'image' | 'video' | 'audio';
type QuickMenuKind = 'card' | 'text' | 'media';

const hoverGuideAnimations: Record<
  HoverGuideKind,
  {
    src: string;
    width: number;
    animationHeight: number;
  }
> = {
  character: {
    src: characterCardAnimation,
    width: 500,
    animationHeight: 650,
  },
  scene: {
    src: sceneSettingCardAnimation,
    width: 500,
    animationHeight: 650,
  },
  plotStructure: {
    src: plotStructureAnimation,
    width: 650,
    animationHeight: 700,
  },
  textSummary: {
    src: textSummaryAnimation,
    width: 700,
    animationHeight: 650,
  },
  batchReplace: {
    src: batchReplaceAnimation,
    width: 650,
    animationHeight: 650,
  },
  numberCondition: {
    src: numberConditionAnimation,
    width: 650,
    animationHeight: 800,
  },
};

interface EditorLeftToolbarProps {
  isMobile: boolean;
  language: Language;
  toolbarCollapsed: boolean;
  interactionMode: 'select' | 'box';
  showHoverButtonAnimations: boolean;
  showSideToolbarLabels: boolean;
  historyPastLength: number;
  historyFutureLength: number;
  hasHiddenNodes: boolean;
  fileInputRef: MutableRefObject<HTMLInputElement | null>;
  setToolbarCollapsed: Dispatch<SetStateAction<boolean>>;
  setInteractionMode: Dispatch<SetStateAction<'select' | 'box'>>;
  addNewShape: (shape: StoryCardVisualShape) => void;
  startCardPlacement: (kind: 'story' | 'background' | 'dynamicWrap') => void;
  addNewBackgroundCard: () => void;
  addNewDynamicWrap: () => void;
  addNewTextNode: () => void;
  addNewHeadingTextNode: () => void;
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
  interactionMode,
  showHoverButtonAnimations,
  showSideToolbarLabels,
  historyPastLength,
  historyFutureLength,
  hasHiddenNodes,
  fileInputRef,
  setToolbarCollapsed,
  setInteractionMode,
  addNewShape,
  startCardPlacement,
  addNewBackgroundCard,
  addNewDynamicWrap,
  addNewTextNode,
  addNewHeadingTextNode,
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
  const sideToolbarStrings = getSideToolbarStrings(language);
  const showDesktopLabels = showSideToolbarLabels && !isMobile;
  const renderToolbarLabel = (label: string) =>
    showDesktopLabels ? <span className="side-toolbar-action-label">{label}</span> : null;
  const guideHoverDelayMs = 400;
  const guideDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guideRequestIdRef = useRef(0);
  const guideAnchorRef = useRef<HTMLButtonElement | null>(null);
  const quickMenuAnchorRef = useRef<HTMLButtonElement | null>(null);
  const quickMenuRef = useRef<HTMLDivElement | null>(null);
  const quickMenuCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeHoverGuide, setActiveHoverGuide] = useState<HoverGuideKind | null>(null);
  const [shouldRenderHoverGuide, setShouldRenderHoverGuide] = useState(false);
  const [showHoverGuide, setShowHoverGuide] = useState(false);
  const [hoverGuideData, setHoverGuideData] = useState<
    Partial<Record<HoverGuideKind, ArrayBuffer | null>>
  >({});
  const [hoverGuidePosition, setHoverGuidePosition] = useState({
    left: 0,
    top: 0,
  });
  const [activeQuickMenu, setActiveQuickMenu] = useState<QuickMenuKind | null>(null);
  const [quickMenuPosition, setQuickMenuPosition] = useState({ left: 0, top: 0 });

  const cancelQuickMenuClose = () => {
    if (quickMenuCloseTimerRef.current !== null) {
      clearTimeout(quickMenuCloseTimerRef.current);
      quickMenuCloseTimerRef.current = null;
    }
  };

  const openQuickMenu = (kind: QuickMenuKind, button: HTMLButtonElement) => {
    if (isMobile) return;

    cancelQuickMenuClose();
    quickMenuAnchorRef.current = button;
    const itemCount = kind === 'text' ? 2 : 3;
    const menuWidth = itemCount * QUICK_MENU_ITEM_WIDTH + 16;
    const rect = button.getBoundingClientRect();
    const rightSideLeft = rect.right + QUICK_MENU_GAP;
    const left =
      rightSideLeft + menuWidth <= window.innerWidth - GUIDE_VIEWPORT_MARGIN
        ? rightSideLeft
        : Math.max(GUIDE_VIEWPORT_MARGIN, rect.left - menuWidth - QUICK_MENU_GAP);
    const top = Math.max(
      GUIDE_VIEWPORT_MARGIN,
      Math.min(
        rect.top + rect.height / 2 - QUICK_MENU_HEIGHT / 2,
        window.innerHeight - QUICK_MENU_HEIGHT - GUIDE_VIEWPORT_MARGIN,
      ),
    );

    setQuickMenuPosition({ left, top });
    setActiveQuickMenu(kind);
  };

  const scheduleQuickMenuClose = () => {
    cancelQuickMenuClose();
    quickMenuCloseTimerRef.current = setTimeout(() => {
      setActiveQuickMenu(null);
      quickMenuAnchorRef.current = null;
      quickMenuCloseTimerRef.current = null;
    }, 180);
  };

  const openMediaPicker = (kind: MediaPickerKind) => {
    const input = fileInputRef.current;
    if (!input) return;

    input.accept =
      kind === 'all'
        ? MEDIA_FILE_ACCEPT
        : kind === 'image'
          ? 'image/*'
          : kind === 'video'
            ? VIDEO_FILE_ACCEPT
            : 'audio/*';
    setActiveQuickMenu(null);
    input.click();
  };

  const updateHoverGuidePosition = useCallback(
    (kind: HoverGuideKind, button: HTMLButtonElement) => {
      const rect = button.getBoundingClientRect();
      const { width } = hoverGuideAnimations[kind];
      const maxLeft = Math.max(
        GUIDE_VIEWPORT_MARGIN,
        window.innerWidth - width - GUIDE_VIEWPORT_MARGIN,
      );
      const nextLeft = Math.min(
        Math.max(rect.right + GUIDE_VIEWPORT_MARGIN, GUIDE_VIEWPORT_MARGIN),
        maxLeft,
      );

      setHoverGuidePosition({
        left: nextLeft,
        top: GUIDE_VIEWPORT_MARGIN,
      });
    },
    [],
  );

  const showCardHoverGuide = (kind: HoverGuideKind, button: HTMLButtonElement) => {
    if (!showHoverButtonAnimations || isMobile) return;

    const requestId = guideRequestIdRef.current + 1;
    guideRequestIdRef.current = requestId;
    guideAnchorRef.current = button;
    updateHoverGuidePosition(kind, button);
    setActiveHoverGuide(kind);
    setShouldRenderHoverGuide(true);
    setShowHoverGuide(false);

    if (guideDelayTimerRef.current) {
      clearTimeout(guideDelayTimerRef.current);
    }
    guideDelayTimerRef.current = setTimeout(() => {
      if (guideRequestIdRef.current === requestId && guideAnchorRef.current === button) {
        setShowHoverGuide(true);
      }
    }, guideHoverDelayMs);
  };

  const hideCardHoverGuide = (button: HTMLButtonElement) => {
    if (guideAnchorRef.current !== button) return;

    guideRequestIdRef.current += 1;
    if (guideDelayTimerRef.current) {
      clearTimeout(guideDelayTimerRef.current);
      guideDelayTimerRef.current = null;
    }
    setShowHoverGuide(false);
    setShouldRenderHoverGuide(false);
    setActiveHoverGuide(null);
    guideAnchorRef.current = null;
  };

  useEffect(() => {
    if (showHoverButtonAnimations) return;

    guideRequestIdRef.current += 1;
    if (guideDelayTimerRef.current) {
      clearTimeout(guideDelayTimerRef.current);
      guideDelayTimerRef.current = null;
    }
    setShowHoverGuide(false);
    setShouldRenderHoverGuide(false);
    setActiveHoverGuide(null);
    guideAnchorRef.current = null;
  }, [showHoverButtonAnimations]);

  useEffect(() => {
    if (!showHoverButtonAnimations || isMobile) return;

    let cancelled = false;
    const entries = Object.entries(hoverGuideAnimations) as Array<
      [HoverGuideKind, (typeof hoverGuideAnimations)[HoverGuideKind]]
    >;

    for (const [kind, config] of entries) {
      void loadHoverGuideData(config.src).then(
        (data) => {
          if (!cancelled) {
            setHoverGuideData((current) => ({ ...current, [kind]: data }));
          }
        },
        () => {
          if (!cancelled) {
            // A direct URL remains as a fallback if preloading is rejected by the host.
            setHoverGuideData((current) => ({ ...current, [kind]: null }));
          }
        },
      );
    }

    return () => {
      cancelled = true;
    };
  }, [isMobile, showHoverButtonAnimations]);

  useEffect(() => {
    const handleResize = () => {
      if (activeHoverGuide && guideAnchorRef.current) {
        updateHoverGuidePosition(activeHoverGuide, guideAnchorRef.current);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [activeHoverGuide, updateHoverGuidePosition]);

  useEffect(() => {
    return () => {
      if (guideDelayTimerRef.current) {
        clearTimeout(guideDelayTimerRef.current);
      }
      if (quickMenuCloseTimerRef.current !== null) {
        clearTimeout(quickMenuCloseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!activeQuickMenu) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (quickMenuAnchorRef.current?.contains(target) || quickMenuRef.current?.contains(target)) {
        return;
      }
      setActiveQuickMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveQuickMenu(null);
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [activeQuickMenu]);

  const activeHoverGuideConfig = activeHoverGuide ? hoverGuideAnimations[activeHoverGuide] : null;
  const activeHoverGuideData = activeHoverGuide ? hoverGuideData[activeHoverGuide] : undefined;
  const hoverGuideText: Record<HoverGuideKind, string> = {
    character:
      language === 'zh'
        ? '添加人物设定卡片'
        : language === 'ja'
          ? '人物設定カードを追加'
          : 'Add Character Card',
    scene: t.toolScene,
    plotStructure: t.toolPlotStructure,
    textSummary:
      language === 'zh'
        ? '文本转换/汇总'
        : language === 'ja'
          ? 'テキスト変換/要約'
          : 'Text Summary',
    batchReplace: t.toolBatchReplace,
    numberCondition:
      language === 'zh'
        ? '数字判断卡片'
        : language === 'ja'
          ? '数値判定カード'
          : 'Number Condition',
  };
  const quickMenuOptions =
    activeQuickMenu === 'card'
      ? [
          {
            id: 'standard-card',
            label: sideToolbarStrings.standardCard,
            Icon: Square,
            onSelect: () => startCardPlacement('story'),
          },
          {
            id: 'background-card',
            label: sideToolbarStrings.backgroundCard,
            Icon: Layers,
            onSelect: () => startCardPlacement('background'),
          },
          {
            id: 'dynamic-wrap',
            label: sideToolbarStrings.dynamicWrap,
            Icon: GitFork,
            onSelect: () => startCardPlacement('dynamicWrap'),
          },
        ]
      : activeQuickMenu === 'text'
        ? [
            {
              id: 'body-text',
              label: sideToolbarStrings.bodyText,
              Icon: Type,
              onSelect: addNewTextNode,
            },
            {
              id: 'heading-text',
              label: sideToolbarStrings.headingText,
              Icon: Heading1,
              onSelect: addNewHeadingTextNode,
            },
          ]
        : activeQuickMenu === 'media'
          ? [
              {
                id: 'image',
                label: sideToolbarStrings.image,
                Icon: ImageIcon,
                onSelect: () => openMediaPicker('image'),
              },
              {
                id: 'video',
                label: sideToolbarStrings.video,
                Icon: Video,
                onSelect: () => openMediaPicker('video'),
              },
              {
                id: 'audio',
                label: sideToolbarStrings.audio,
                Icon: AudioLines,
                onSelect: () => openMediaPicker('audio'),
              },
            ]
          : [];
  const quickMenuLabel =
    activeQuickMenu === 'card'
      ? sideToolbarStrings.card
      : activeQuickMenu === 'text'
        ? sideToolbarStrings.text
        : sideToolbarStrings.media;

  return (
    <>
      <div
        className={`toolbar-bubble-surface glass-toolbar ${showDesktopLabels ? 'side-toolbar-with-labels w-[64px]' : 'w-[52px]'} absolute left-6 top-20 z-20 flex flex-col rounded-2xl border border-[var(--toolbar-border)] bg-[var(--toolbar-bg)] p-1 shadow-xl backdrop-blur transition-all duration-500 ease-in-out ${
          // NOTE: 移动端折叠时保留3个按钮（选择+框选+最小化），高度约156px；桌面端仅显示最小化按钮52px
          isMobile && toolbarCollapsed
            ? 'h-[156px] overflow-hidden'
            : !isMobile && toolbarCollapsed
              ? 'h-[52px] overflow-hidden'
              : 'overflow-visible'
        }`}
      >
        {/* 桌面端：最小化按钮在最顶部（原始位置） */}
        {!isMobile && (
          <button
            onClick={() => setToolbarCollapsed((value) => !value)}
            className="side-toolbar-collapse-button mx-auto flex shrink-0 items-center justify-center p-2.5 text-slate-400 transition-colors duration-300 hover:text-slate-600 dark:text-slate-200 dark:hover:text-white"
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
        )}

        {/* 移动端：选择/框选按钮始终显示，不受折叠影响 */}
        {isMobile && (
          <>
            <button
              className={`group relative flex items-center justify-center rounded-xl p-2.5 transition-all duration-300 ${
                interactionMode === 'select'
                  ? 'mobile-action-active-brand'
                  : 'text-[var(--icon-color)] hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              onClick={() => setInteractionMode('select')}
              title={
                language === 'zh'
                  ? '选择/连接卡片'
                  : language === 'ja'
                    ? '選択/接続'
                    : 'Select / connect cards'
              }
            >
              <MousePointer2 strokeWidth={2.5} className="h-5 w-5" />
            </button>
            <button
              className={`group relative flex items-center justify-center rounded-xl p-2.5 transition-all duration-300 ${
                interactionMode === 'box'
                  ? 'mobile-action-active-brand'
                  : 'text-[var(--icon-color)] hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              onClick={() => setInteractionMode('box')}
              title={
                language === 'zh' ? '框选卡片' : language === 'ja' ? '範囲選択' : 'Box select cards'
              }
            >
              <SquareDashedMousePointer strokeWidth={2.5} className="h-5 w-5" />
            </button>
            {/* 移动端：最小化按钮在框选下方 */}
            <button
              onClick={() => setToolbarCollapsed((value) => !value)}
              className="side-toolbar-collapse-button mx-auto flex shrink-0 items-center justify-center p-2.5 text-slate-400 transition-colors duration-300 hover:text-slate-600 dark:text-slate-200 dark:hover:text-white"
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
          </>
        )}

        {!toolbarCollapsed && (
          <div className="toolbar-flat-content animate-in fade-in slide-in-from-top-2 flex flex-col duration-300">
            {/* 移动端的选择/框选已在上方始终渲染，这里加分隔线即可 */}
            {isMobile && <div className="my-1 h-px w-full bg-[var(--toolbar-border)]/50" />}

            <button
              className="group relative flex items-center justify-center rounded-xl p-2.5 text-[var(--icon-color)] transition-colors hover:bg-indigo-500/12 hover:text-indigo-600 dark:hover:bg-indigo-400/15 dark:hover:text-indigo-300"
              onClick={() => (isMobile ? addNewShape('square') : startCardPlacement('story'))}
              onPointerEnter={(event) => openQuickMenu('card', event.currentTarget)}
              onPointerLeave={scheduleQuickMenuClose}
              aria-label={t.toolSquare}
              aria-haspopup="menu"
              aria-expanded={activeQuickMenu === 'card'}
            >
              <Square strokeWidth={3} className="h-5 w-5" />
              {renderToolbarLabel(sideToolbarStrings.card)}
            </button>

            {!isMobile && (
              <button
                className="group relative flex items-center justify-center rounded-xl p-2.5 text-[var(--icon-color)] transition-colors hover:bg-indigo-500/12 hover:text-indigo-600 dark:hover:bg-indigo-400/15 dark:hover:text-indigo-300"
                onClick={addNewTextNode}
                onPointerEnter={(event) => openQuickMenu('text', event.currentTarget)}
                onPointerLeave={scheduleQuickMenuClose}
                aria-label={t.toolText}
                aria-haspopup="menu"
                aria-expanded={activeQuickMenu === 'text'}
              >
                <Type strokeWidth={2.5} className="h-5 w-5" />
                {renderToolbarLabel(sideToolbarStrings.text)}
              </button>
            )}

            <div className="my-1 h-px w-full bg-[var(--toolbar-border)]/50" />

            <button
              className="relative flex items-center justify-center rounded-xl p-2.5 text-[var(--icon-color)] transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
              onClick={addNewCharacterNode}
              onMouseEnter={(event) => showCardHoverGuide('character', event.currentTarget)}
              onMouseLeave={(event) => hideCardHoverGuide(event.currentTarget)}
              onFocus={(event) => showCardHoverGuide('character', event.currentTarget)}
              onBlur={(event) => hideCardHoverGuide(event.currentTarget)}
              aria-label={hoverGuideText.character}
            >
              <UserCircle2 strokeWidth={2.5} className="h-5 w-5" />
              {renderToolbarLabel(sideToolbarStrings.character)}
            </button>

            <button
              className="flex items-center justify-center rounded-xl p-2.5 text-[var(--icon-color)] transition-colors hover:bg-indigo-500/12 hover:text-indigo-600 dark:hover:bg-indigo-400/15 dark:hover:text-indigo-300"
              onClick={addNewSceneNode}
              onMouseEnter={(event) => showCardHoverGuide('scene', event.currentTarget)}
              onMouseLeave={(event) => hideCardHoverGuide(event.currentTarget)}
              onFocus={(event) => showCardHoverGuide('scene', event.currentTarget)}
              onBlur={(event) => hideCardHoverGuide(event.currentTarget)}
              aria-label={hoverGuideText.scene}
            >
              <MapPin strokeWidth={2.5} className="h-5 w-5" />
              {renderToolbarLabel(sideToolbarStrings.scene)}
            </button>

            <button
              className="flex items-center justify-center rounded-xl p-2.5 text-[var(--icon-color)] transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
              onClick={addNewPlotStructureNode}
              onMouseEnter={(event) => showCardHoverGuide('plotStructure', event.currentTarget)}
              onMouseLeave={(event) => hideCardHoverGuide(event.currentTarget)}
              onFocus={(event) => showCardHoverGuide('plotStructure', event.currentTarget)}
              onBlur={(event) => hideCardHoverGuide(event.currentTarget)}
              aria-label={hoverGuideText.plotStructure}
            >
              <BookOpen strokeWidth={2.5} className="h-5 w-5" />
              {renderToolbarLabel(sideToolbarStrings.plot)}
            </button>

            <button
              className="flex items-center justify-center rounded-xl p-2.5 text-[var(--icon-color)] transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
              onClick={addNewNumberConditionNode}
              onMouseEnter={(event) => showCardHoverGuide('numberCondition', event.currentTarget)}
              onMouseLeave={(event) => hideCardHoverGuide(event.currentTarget)}
              onFocus={(event) => showCardHoverGuide('numberCondition', event.currentTarget)}
              onBlur={(event) => hideCardHoverGuide(event.currentTarget)}
              aria-label={hoverGuideText.numberCondition}
            >
              <Calculator strokeWidth={2.5} className="h-5 w-5" />
              {renderToolbarLabel(sideToolbarStrings.condition)}
            </button>

            {!isMobile && <div className="my-1 h-px w-full bg-[var(--toolbar-border)]/50" />}

            {!isMobile && (
              <button
                className="flex items-center justify-center rounded-xl p-2.5 text-[var(--icon-color)] transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
                onClick={addNewSummaryNode}
                onMouseEnter={(event) => showCardHoverGuide('textSummary', event.currentTarget)}
                onMouseLeave={(event) => hideCardHoverGuide(event.currentTarget)}
                onFocus={(event) => showCardHoverGuide('textSummary', event.currentTarget)}
                onBlur={(event) => hideCardHoverGuide(event.currentTarget)}
                aria-label={hoverGuideText.textSummary}
              >
                <FileText strokeWidth={2.5} className="h-5 w-5" />
                {renderToolbarLabel(sideToolbarStrings.summary)}
              </button>
            )}

            {!isMobile && (
              <button
                className="flex items-center justify-center rounded-xl p-2.5 text-[var(--icon-color)] transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
                onClick={addNewBatchReplaceNode}
                onMouseEnter={(event) => showCardHoverGuide('batchReplace', event.currentTarget)}
                onMouseLeave={(event) => hideCardHoverGuide(event.currentTarget)}
                onFocus={(event) => showCardHoverGuide('batchReplace', event.currentTarget)}
                onBlur={(event) => hideCardHoverGuide(event.currentTarget)}
                aria-label={hoverGuideText.batchReplace}
              >
                <Replace strokeWidth={2.5} className="h-5 w-5" />
                {renderToolbarLabel(sideToolbarStrings.replace)}
              </button>
            )}

            <div className="my-1 h-px w-full bg-[var(--toolbar-border)]/50" />

            <button
              className="flex items-center justify-center rounded-xl p-2.5 text-[var(--icon-color)] transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
              onClick={() => openMediaPicker('all')}
              onPointerEnter={(event) => openQuickMenu('media', event.currentTarget)}
              onPointerLeave={scheduleQuickMenuClose}
              aria-label={t.toolMedia}
              aria-haspopup="menu"
              aria-expanded={activeQuickMenu === 'media'}
            >
              <ImageIcon strokeWidth={2.5} className="h-5 w-5" />
              {renderToolbarLabel(sideToolbarStrings.media)}
            </button>
          </div>
        )}

        <input
          type="file"
          accept={MEDIA_FILE_ACCEPT}
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
              {renderToolbarLabel(sideToolbarStrings.restore)}
            </button>
          </div>
        )}
      </div>

      {showHoverButtonAnimations &&
        !isMobile &&
        shouldRenderHoverGuide &&
        activeHoverGuide &&
        activeHoverGuideConfig &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            key={activeHoverGuide}
            className={`pointer-events-none fixed z-[9999] overflow-hidden rounded-xl border border-white/30 bg-white/20 shadow-2xl backdrop-blur-xl transition-opacity duration-150 ${
              showHoverGuide ? 'opacity-100' : 'opacity-0'
            }`}
            data-testid={`${activeHoverGuide}-card-guide-lottie`}
            style={{
              left: `${hoverGuidePosition.left}px`,
              top: `${hoverGuidePosition.top}px`,
              width: `${activeHoverGuideConfig.width}px`,
              height: `${activeHoverGuideConfig.animationHeight}px`,
            }}
          >
            <div
              className="absolute inset-x-0 top-0 overflow-hidden"
              style={{
                height: `${activeHoverGuideConfig.animationHeight - 50}px`,
              }}
            >
              {activeHoverGuideData !== undefined && (
                <DotLottieReact
                  key={`${activeHoverGuide}-${activeHoverGuideConfig.src}`}
                  {...(activeHoverGuideData === null
                    ? { src: activeHoverGuideConfig.src }
                    : { data: activeHoverGuideData })}
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
              )}
            </div>
            <div className="absolute inset-x-0 bottom-0 z-10 flex h-[50px] items-center justify-center border-t border-slate-200 bg-white px-5 text-center text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
              {hoverGuideText[activeHoverGuide]}
            </div>
          </div>,
          document.body,
        )}

      {activeQuickMenu &&
        !isMobile &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={quickMenuRef}
            role="menu"
            aria-label={quickMenuLabel}
            onPointerEnter={cancelQuickMenuClose}
            onPointerLeave={scheduleQuickMenuClose}
            className="animate-in fade-in zoom-in-95 fixed z-[10050] grid gap-1.5 rounded-2xl border border-[var(--toolbar-border)] bg-[var(--toolbar-bg)]/95 p-2 shadow-2xl shadow-slate-950/20 backdrop-blur-xl duration-150 dark:shadow-black/40"
            style={{
              left: quickMenuPosition.left,
              top: quickMenuPosition.top,
              width: quickMenuOptions.length * QUICK_MENU_ITEM_WIDTH + 16,
              gridTemplateColumns: `repeat(${quickMenuOptions.length}, minmax(0, 1fr))`,
            }}
          >
            {quickMenuOptions.map(({ id, label, Icon, onSelect }) => (
              <button
                key={id}
                type="button"
                role="menuitem"
                onClick={() => {
                  onSelect();
                  setActiveQuickMenu(null);
                }}
                className="flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[var(--text-muted)] transition-colors hover:bg-indigo-500/12 hover:text-indigo-600 focus-visible:bg-indigo-500/12 focus-visible:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] dark:hover:bg-indigo-400/15 dark:hover:text-indigo-300 dark:focus-visible:bg-indigo-400/15 dark:focus-visible:text-indigo-300"
              >
                <Icon className="h-7 w-7" strokeWidth={1.9} />
                <span className="truncate text-[10px] font-black leading-3">{label}</span>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
