import { ChevronDown, Eye, EyeOff, Redo2, Settings, Sparkles, Undo2 } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';

import type { ToolbarLayout } from '../editor-state/editorConfig';
import type { Language } from '../lib/i18n';

interface EditorRightToolbarProps {
  isMobile: boolean;
  language: Language;
  assistantOpen: boolean;
  rightToolbarCollapsed: boolean;
  toolbarLayout: ToolbarLayout;
  showTitles: boolean;
  canvasBg: string;
  presetColors: string[];
  historyPastLength: number;
  historyFutureLength: number;
  setAssistantOpen: Dispatch<SetStateAction<boolean>>;
  setRightToolbarCollapsed: Dispatch<SetStateAction<boolean>>;
  setShowSettings: Dispatch<SetStateAction<boolean>>;
  setShowTitles: Dispatch<SetStateAction<boolean>>;
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
  rightToolbarCollapsed,
  toolbarLayout,
  showTitles,
  canvasBg,
  presetColors,
  historyPastLength,
  historyFutureLength,
  setAssistantOpen,
  setRightToolbarCollapsed,
  setShowSettings,
  setShowTitles,
  setCanvasBg,
  undo,
  redo,
  t,
}: EditorRightToolbarProps) {
  if (isMobile) return null;

  return (
    <div
      className={`toolbar-bubble-surface glass-toolbar absolute right-6 top-4 z-20 flex ${
        toolbarLayout === 'horizontal' ? 'h-[52px] flex-row-reverse' : 'w-[52px] flex-col'
      } overflow-hidden rounded-2xl border border-[var(--toolbar-border)] bg-[var(--toolbar-bg)] p-1.5 shadow-xl backdrop-blur transition-all duration-500 ease-in-out ${
        rightToolbarCollapsed ? (toolbarLayout === 'horizontal' ? 'w-[104px]' : 'h-[104px]') : ''
      }`}
    >
      <button
        onClick={() => setAssistantOpen((open) => !open)}
        className={`exclude-glass shrink-0 rounded-xl transition-colors ${
          toolbarLayout === 'horizontal' ? 'mx-1.5 my-auto h-10 w-10' : 'mx-auto my-1.5 h-10 w-10'
        } ${
          assistantOpen
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'text-[var(--icon-color)] hover:bg-slate-100 dark:hover:bg-slate-700'
        } flex items-center justify-center`}
        title={language === 'zh' ? 'AI 助手' : 'AI Assistant'}
      >
        <Sparkles className="h-5 w-5" />
      </button>

      <div
        className={`bg-[var(--toolbar-border)]/50 ${
          toolbarLayout === 'horizontal' ? 'h-8 w-px' : 'h-px w-full'
        }`}
      />

      <button
        onClick={() => setRightToolbarCollapsed((value) => !value)}
        className="mx-auto flex h-10 w-10 shrink-0 items-center justify-center text-slate-400 transition-all duration-300 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-white"
        title={
          rightToolbarCollapsed
            ? language === 'zh'
              ? '展开工具栏'
              : 'Expand Toolbar'
            : language === 'zh'
              ? '折叠工具栏'
              : 'Collapse Toolbar'
        }
      >
        <div
          className={`transition-transform duration-500 ${
            rightToolbarCollapsed
              ? 'rotate-0'
              : toolbarLayout === 'horizontal'
                ? '-rotate-90'
                : 'rotate-180'
          }`}
        >
          <ChevronDown className="h-6 w-6" />
        </div>
      </button>

      {!rightToolbarCollapsed && (
        <div
          className={`animate-in fade-in slide-in-from-top-2 flex duration-300 ${
            toolbarLayout === 'horizontal' ? 'flex-row-reverse items-center pr-2' : 'flex-col'
          }`}
        >
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center justify-center rounded-xl p-2.5 text-[var(--icon-color)] transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
            title={t.settings}
          >
            <Settings className="h-5 w-5" />
          </button>

          <button
            onClick={() => setShowTitles((value) => !value)}
            className="flex items-center justify-center rounded-xl p-2.5 text-[var(--icon-color)] transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
            title={showTitles ? t.hideTitles : t.showTitles}
          >
            {showTitles ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>

          <div className="my-1 h-px w-full bg-[var(--toolbar-border)]/50" />

          <button
            onClick={undo}
            disabled={historyPastLength === 0}
            className="flex items-center justify-center rounded-xl p-2.5 text-[var(--icon-color)] transition-colors disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700"
            title="撤销 (Ctrl+Z)"
          >
            <Undo2 className="h-5 w-5" />
          </button>

          <button
            onClick={redo}
            disabled={historyFutureLength === 0}
            className="flex items-center justify-center rounded-xl p-2.5 text-[var(--icon-color)] transition-colors disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700"
            title="重做 (Ctrl+Y)"
          >
            <Redo2 className="h-5 w-5" />
          </button>

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
                title={`${language === 'zh' ? '背景颜色' : 'BG Color'} ${index + 1}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
