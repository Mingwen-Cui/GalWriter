import { Bot, Captions, CaptionsOff, ChevronDown, Redo2, Settings, Undo2 } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { StoryTitlePlacement } from '../domain/project';
import type { ToolbarLayout } from '../editor-state/editorConfig';
import type { Language } from '../lib/i18n';
import { getSideToolbarStrings } from './i18n/side-toolbar';

interface EditorRightToolbarProps {
  isMobile: boolean;
  language: Language;
  assistantOpen: boolean;
  assistantPanelWidth: number;
  assistantResizing: boolean;
  bubbleStyle: 'glass' | 'flat';
  rightToolbarCollapsed: boolean;
  toolbarLayout: ToolbarLayout;
  showSideToolbarLabels: boolean;
  showTitles: boolean;
  storyTitlePlacement: StoryTitlePlacement;
  canvasBg: string;
  presetColors: string[];
  showPresetColors: boolean;
  historyPastLength: number;
  historyFutureLength: number;
  missingTextApiKey: boolean;
  settingsAttention: boolean;
  settingsAttentionTarget?: 'text' | 'image' | 'background-removal' | 'voice' | null;
  setAssistantOpen: Dispatch<SetStateAction<boolean>>;
  setRightToolbarCollapsed: Dispatch<SetStateAction<boolean>>;
  setShowSettings: Dispatch<SetStateAction<boolean>>;
  setShowTitles: Dispatch<SetStateAction<boolean>>;
  setStoryTitlePlacement: Dispatch<SetStateAction<StoryTitlePlacement>>;
  setCanvasBg: Dispatch<SetStateAction<string>>;
  undo: () => void;
  redo: () => void;
  t: {
    settings: string;
    hideTitles: string;
    showTitles: string;
  };
}

export function EditorRightToolbar({
  isMobile,
  language,
  assistantOpen,
  assistantPanelWidth,
  assistantResizing,
  bubbleStyle,
  rightToolbarCollapsed,
  toolbarLayout,
  showSideToolbarLabels,
  showTitles,
  storyTitlePlacement,
  canvasBg,
  presetColors,
  showPresetColors,
  historyPastLength,
  historyFutureLength,
  missingTextApiKey,
  settingsAttention,
  settingsAttentionTarget,
  setAssistantOpen,
  setRightToolbarCollapsed,
  setShowSettings,
  setShowTitles,
  setStoryTitlePlacement,
  setCanvasBg,
  undo,
  redo,
  t,
}: EditorRightToolbarProps) {
  const sideToolbarStrings = getSideToolbarStrings(language);
  const showDesktopLabels = showSideToolbarLabels && !isMobile;
  const renderToolbarLabel = (label: string) =>
    showDesktopLabels ? <span className="side-toolbar-action-label">{label}</span> : null;
  const titleButtonRef = useRef<HTMLButtonElement | null>(null);
  const titleMenuRef = useRef<HTMLDivElement | null>(null);
  const titleMenuCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showTitleMenu, setShowTitleMenu] = useState(false);
  const [titleMenuPosition, setTitleMenuPosition] = useState({ left: 0, top: 0 });
  const [hoveredTitleMenuItemId, setHoveredTitleMenuItemId] = useState<string | null>(null);

  const cancelTitleMenuClose = () => {
    if (titleMenuCloseTimerRef.current !== null) {
      clearTimeout(titleMenuCloseTimerRef.current);
      titleMenuCloseTimerRef.current = null;
    }
  };

  const openTitleMenu = () => {
    cancelTitleMenuClose();
    setHoveredTitleMenuItemId(null);
    if (titleButtonRef.current) {
      const rect = titleButtonRef.current.getBoundingClientRect();
      const menuWidth = 420;
      const menuHeight = 122;
      const margin = 12;
      const left = Math.max(
        margin,
        Math.min(rect.left - menuWidth - margin, window.innerWidth - menuWidth - margin),
      );
      const top = Math.max(
        margin,
        Math.min(
          rect.top + rect.height / 2 - menuHeight / 2,
          window.innerHeight - menuHeight - margin,
        ),
      );
      setTitleMenuPosition({ left, top });
    }
    setShowTitleMenu(true);
  };

  const scheduleTitleMenuClose = () => {
    cancelTitleMenuClose();
    titleMenuCloseTimerRef.current = setTimeout(() => {
      setShowTitleMenu(false);
      setHoveredTitleMenuItemId(null);
      titleMenuCloseTimerRef.current = null;
    }, 180);
  };

  useEffect(
    () => () => {
      if (titleMenuCloseTimerRef.current !== null) {
        clearTimeout(titleMenuCloseTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!showTitleMenu) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (titleButtonRef.current?.contains(target) || titleMenuRef.current?.contains(target))
        return;
      setShowTitleMenu(false);
      setHoveredTitleMenuItemId(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowTitleMenu(false);
        setHoveredTitleMenuItemId(null);
      }
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [showTitleMenu]);

  return (
    <div
      className={`toolbar-bubble-surface glass-toolbar ${showDesktopLabels ? 'side-toolbar-with-labels' : ''} absolute right-6 top-4 z-20 flex max-[510px]:top-20 ${
        toolbarLayout === 'horizontal'
          ? `${showDesktopLabels ? 'h-[60px]' : 'h-[52px]'} flex-row-reverse`
          : `${showDesktopLabels ? 'w-[64px]' : 'w-[52px]'} flex-col`
      } overflow-hidden rounded-2xl border border-[var(--toolbar-border)] bg-[var(--toolbar-bg)] p-1.5 shadow-xl backdrop-blur transition-all duration-500 ease-in-out ${
        rightToolbarCollapsed
          ? toolbarLayout === 'horizontal'
            ? bubbleStyle === 'flat'
              ? 'w-[104px]'
              : 'w-[104px]'
            : 'h-[104px]'
          : ''
      }`}
      style={
        assistantOpen && bubbleStyle === 'glass'
          ? {
              right: assistantPanelWidth + 24,
              transition: assistantResizing ? 'none' : undefined,
            }
          : undefined
      }
    >
      <button
        onClick={() => setAssistantOpen((open) => !open)}
        className={`glass-toolbar-ai shrink-0 rounded-xl transition-colors ${
          toolbarLayout === 'horizontal' ? 'mx-1.5 my-auto h-10 w-10' : 'mx-auto my-1.5 h-10 w-10'
        } ${
          assistantOpen
            ? 'glass-toolbar-active bg-indigo-600 text-white shadow-sm'
            : 'text-[var(--icon-color)] hover:bg-slate-100 dark:hover:bg-slate-700'
        } flex items-center justify-center`}
        title={
          language === 'zh' ? 'AI 助手' : language === 'ja' ? 'AIアシスタント' : 'AI Assistant'
        }
      >
        <Bot className="h-5 w-5" />
        {renderToolbarLabel(sideToolbarStrings.assistant)}
      </button>

      <button
        onClick={() => setRightToolbarCollapsed((value) => !value)}
        className={`side-toolbar-collapse-button flex h-10 w-10 shrink-0 items-center justify-center text-slate-400 transition-all duration-300 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-white ${
          bubbleStyle === 'flat'
            ? 'm-0'
            : toolbarLayout === 'horizontal'
              ? 'mx-1.5 my-auto'
              : 'mx-auto'
        }`}
        title={
          rightToolbarCollapsed
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
          className={`transition-transform duration-500 ${
            rightToolbarCollapsed
              ? toolbarLayout === 'horizontal'
                ? 'rotate-90'
                : 'rotate-0'
              : toolbarLayout === 'horizontal'
                ? 'rotate-[270deg]'
                : 'rotate-180'
          }`}
        >
          <ChevronDown className="h-6 w-6" />
        </div>
      </button>

      {!rightToolbarCollapsed && (
        <div
          className={`toolbar-flat-content animate-in fade-in slide-in-from-top-2 flex duration-300 ${
            toolbarLayout === 'horizontal' ? 'flex-row-reverse items-center pr-2' : 'flex-col'
          }`}
        >
          <button
            onClick={() => setShowSettings(true)}
            className={`relative flex items-center justify-center rounded-xl p-2.5 text-[var(--icon-color)] transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 ${
              settingsAttention ? 'settings-attention-pulse' : ''
            }`}
            title={t.settings}
          >
            <Settings className="h-5 w-5" />
            {renderToolbarLabel(sideToolbarStrings.settings)}
            {(missingTextApiKey || settingsAttentionTarget) && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 shadow-sm" />
            )}
          </button>

          <button
            ref={titleButtonRef}
            onClick={() => setShowTitles((visible) => !visible)}
            onPointerEnter={openTitleMenu}
            onPointerLeave={scheduleTitleMenuClose}
            className="flex items-center justify-center rounded-xl p-2.5 text-[var(--icon-color)] transition-colors hover:bg-indigo-500/12 hover:text-indigo-600 dark:hover:bg-indigo-400/15 dark:hover:text-indigo-300"
            aria-label={showTitles ? t.hideTitles : t.showTitles}
            aria-haspopup="dialog"
            aria-expanded={showTitleMenu}
          >
            {showTitles ? <CaptionsOff className="h-5 w-5" /> : <Captions className="h-5 w-5" />}
            {renderToolbarLabel(sideToolbarStrings.titles)}
          </button>

          <div
            className={`my-1 h-px w-full bg-[var(--toolbar-border)]/50 ${toolbarLayout === 'horizontal' ? 'hidden' : ''}`}
          />

          <button
            onClick={undo}
            disabled={historyPastLength === 0}
            className="flex items-center justify-center rounded-xl p-2.5 text-[var(--icon-color)] transition-colors disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700"
            title="撤销 (Ctrl+Z)"
          >
            <Undo2 className="h-5 w-5" />
            {renderToolbarLabel(sideToolbarStrings.undo)}
          </button>

          <button
            onClick={redo}
            disabled={historyFutureLength === 0}
            className="flex items-center justify-center rounded-xl p-2.5 text-[var(--icon-color)] transition-colors disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700"
            title="重做 (Ctrl+Y)"
          >
            <Redo2 className="h-5 w-5" />
            {renderToolbarLabel(sideToolbarStrings.redo)}
          </button>

          {!isMobile && showPresetColors && (
            <>
              <div className="my-1 h-px w-full bg-[var(--toolbar-border)]/50" />

              <div
                className={`flex items-center gap-2 py-1 ${
                  toolbarLayout === 'horizontal' ? 'mx-1.5 flex-row' : 'my-1.5 flex-col'
                }`}
              >
                {presetColors.map((color, index) => (
                  <button
                    key={index}
                    onClick={() => setCanvasBg(color)}
                    className={`exclude-glass h-6 w-6 rounded-full border border-slate-200 transition-all hover:scale-110 dark:border-slate-700 ${
                      canvasBg === color
                        ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900'
                        : ''
                    }`}
                    style={{ backgroundColor: color }}
                    title={`${language === 'zh' ? '背景颜色' : language === 'ja' ? '背景色' : 'BG Color'} ${index + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {showTitleMenu &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={titleMenuRef}
            role="dialog"
            aria-label={t.showTitles}
            onPointerEnter={cancelTitleMenuClose}
            onPointerLeave={() => {
              setHoveredTitleMenuItemId(null);
              scheduleTitleMenuClose();
            }}
            className="animate-in fade-in zoom-in-95 fixed z-[10050] w-[420px] rounded-2xl border border-[var(--toolbar-border)] bg-[var(--toolbar-bg)]/95 p-2 shadow-2xl shadow-slate-950/20 backdrop-blur-xl duration-150 dark:shadow-black/40"
            style={{ left: titleMenuPosition.left, top: titleMenuPosition.top }}
          >
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'hidden', label: sideToolbarStrings.hideTitles },
                { id: 'inside', label: sideToolbarStrings.titleInside },
                { id: 'outside-left', label: sideToolbarStrings.titleOutsideLeft },
                { id: 'outside-right', label: sideToolbarStrings.titleOutsideRight },
              ].map((item) => {
                const active =
                  item.id === 'hidden'
                    ? !showTitles
                    : showTitles && storyTitlePlacement === item.id;
                const emphasized = hoveredTitleMenuItemId
                  ? hoveredTitleMenuItemId === item.id
                  : active;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (item.id === 'hidden') {
                        setShowTitles(false);
                      } else {
                        setShowTitles(true);
                        setStoryTitlePlacement(item.id as StoryTitlePlacement);
                      }
                      setShowTitleMenu(false);
                      setHoveredTitleMenuItemId(null);
                    }}
                    onPointerEnter={() => setHoveredTitleMenuItemId(item.id)}
                    onFocus={() => setHoveredTitleMenuItemId(item.id)}
                    className={`flex min-w-0 flex-col items-center gap-1.5 rounded-xl px-1.5 py-2 text-center transition-colors ${
                      emphasized
                        ? 'bg-indigo-500/12 text-indigo-600 dark:bg-indigo-400/15 dark:text-indigo-300'
                        : 'text-[var(--text-muted)] hover:bg-indigo-500/12 hover:text-indigo-600 focus-visible:bg-indigo-500/12 focus-visible:text-indigo-600 dark:hover:bg-indigo-400/15 dark:hover:text-indigo-300 dark:focus-visible:bg-indigo-400/15 dark:focus-visible:text-indigo-300'
                    }`}
                    aria-current={active ? 'true' : undefined}
                  >
                    {item.id === 'hidden' ? (
                      <div className="flex h-12 items-center justify-center">
                        <CaptionsOff className="h-8 w-8" strokeWidth={1.8} />
                      </div>
                    ) : (
                      <svg
                        viewBox="0 0 88 64"
                        className="h-12 w-full overflow-visible"
                        fill="none"
                        aria-hidden="true"
                      >
                        <rect
                          x="13"
                          y="17"
                          width="62"
                          height="42"
                          rx="6"
                          fill="currentColor"
                          fillOpacity="0.08"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                        <path
                          d="M24 38H64M24 45H56M24 52H48"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          opacity="0.45"
                        />
                        {item.id === 'inside' && (
                          <path
                            d="M24 27H52"
                            stroke="currentColor"
                            strokeWidth="4"
                            strokeLinecap="round"
                          />
                        )}
                        {item.id === 'outside-left' && (
                          <>
                            <path
                              d="M13 8H41"
                              stroke="currentColor"
                              strokeWidth="4"
                              strokeLinecap="round"
                            />
                            <path
                              d="M13 12V17"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              opacity="0.55"
                            />
                          </>
                        )}
                        {item.id === 'outside-right' && (
                          <>
                            <path
                              d="M47 8H75"
                              stroke="currentColor"
                              strokeWidth="4"
                              strokeLinecap="round"
                            />
                            <path
                              d="M75 12V17"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              opacity="0.55"
                            />
                          </>
                        )}
                      </svg>
                    )}
                    <span className="truncate text-[10px] font-black leading-3">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
