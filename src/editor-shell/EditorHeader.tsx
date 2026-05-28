import { Film, PlayCircle, Save, Sparkles, Upload } from 'lucide-react';
import type { ChangeEvent, Dispatch, MutableRefObject, SetStateAction } from 'react';

import type { BubbleStyle } from '../domain/project';
import type { Language } from '../lib/i18n';

interface EditorHeaderProps {
  projectTitle: string;
  projectTitleInputWidth: string;
  language: Language;
  bubbleStyle: BubbleStyle;
  isMobile: boolean;
  isDirty: boolean;
  canRenderVideo: boolean;
  assistantOpen: boolean;
  jsonInputRef: MutableRefObject<HTMLInputElement | null>;
  setProjectTitle: Dispatch<SetStateAction<string>>;
  setShowPlayTest: Dispatch<SetStateAction<boolean>>;
  setShowVideoRender: Dispatch<SetStateAction<boolean>>;
  setAssistantOpen: Dispatch<SetStateAction<boolean>>;
  handleExportJSON: () => void;
  handleImportZIP: (event: ChangeEvent<HTMLInputElement>) => void;
  t: {
    playTest: string;
    save: string;
    import: string;
  };
}

export function EditorHeader({
  projectTitle,
  projectTitleInputWidth,
  language,
  bubbleStyle,
  isMobile,
  isDirty,
  canRenderVideo,
  assistantOpen,
  jsonInputRef,
  setProjectTitle,
  setShowPlayTest,
  setShowVideoRender,
  setAssistantOpen,
  handleExportJSON,
  handleImportZIP,
  t,
}: EditorHeaderProps) {
  return (
    <div className="pointer-events-none absolute left-6 top-3 z-30 flex items-center gap-3">
      <div className="toolbar-bubble-surface editor-header-bubble pointer-events-auto min-w-0 flex items-center gap-2 rounded-2xl border border-[var(--header-border)] bg-white/80 px-2.5 py-1.5 shadow-sm backdrop-blur-xl dark:bg-slate-900/80">
        <img
          src={bubbleStyle === 'glass' ? './glass.png' : './icon.png'}
          className="editor-header-logo h-8 w-8 theme-invert"
          alt="Logo"
        />
        <input
          value={projectTitle}
          onChange={(event) => setProjectTitle(event.target.value)}
          placeholder={language === 'zh' ? '项目标题' : 'Project title'}
          className="editor-header-title min-w-[8rem] max-w-[18rem] bg-transparent text-sm font-bold tracking-tight text-slate-900 outline-none placeholder:text-slate-400 transition-[width] dark:text-white md:text-base"
          style={{ width: projectTitleInputWidth }}
          aria-label={language === 'zh' ? '项目标题' : 'Project title'}
        />
        <div className="editor-header-divider mx-0.5 h-5 w-px bg-slate-200 dark:bg-slate-700" />
        <button
          onClick={() => setShowPlayTest(true)}
          className="header-glass-action header-glass-action-play flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-white transition-colors hover:bg-slate-900 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-50"
          title={t.playTest}
        >
          <PlayCircle className="h-4 w-4" />
        </button>

        {canRenderVideo && (
          <button
            onClick={() => setShowVideoRender(true)}
            className="header-glass-action header-glass-action-video flex h-9 w-9 items-center justify-center rounded-xl bg-sky-600 text-white transition-colors hover:bg-sky-700"
            title={language === 'zh' ? '一键导出视频' : 'Export Video'}
          >
            <Film className="h-4 w-4" />
          </button>
        )}

        <button
          onClick={handleExportJSON}
          className={`header-glass-action header-glass-action-save relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
            isDirty
              ? 'header-glass-action-active bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-white'
              : 'text-[var(--icon-color)] hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title={
            isDirty
              ? language === 'zh'
                ? '有未保存的更改 - 点击保存'
                : 'Unsaved changes - Click to save'
              : t.save
          }
        >
          <Save className="h-4 w-4" />
          {isDirty && (
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-indigo-500" />
          )}
        </button>

        <button
          onClick={() => jsonInputRef.current?.click()}
          className="header-glass-action header-glass-action-import flex h-9 w-9 items-center justify-center rounded-xl text-[var(--icon-color)] transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
          title={t.import}
        >
          <Upload className="h-4 w-4" />
        </button>
        <input
          type="file"
          accept=".zip,.json"
          className="hidden"
          ref={jsonInputRef}
          onChange={handleImportZIP}
        />
      </div>

      <div className="hidden">
        <div className="toolbar-bubble-surface pointer-events-auto flex items-center gap-1.5 rounded-2xl border border-[var(--header-border)] bg-white/80 px-2 py-1 shadow-sm backdrop-blur-xl dark:bg-slate-900/80">
          <button
            onClick={() => setAssistantOpen((open) => !open)}
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
              assistantOpen
                ? 'bg-indigo-600 text-white'
                : 'text-[var(--icon-color)] hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title={language === 'zh' ? 'AI 助手' : 'AI Assistant'}
          >
            <Sparkles className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
