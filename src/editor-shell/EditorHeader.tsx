import { Film, FolderOpen, PlayCircle, Save, Sparkles, Upload } from 'lucide-react';
import type { ChangeEvent, Dispatch, MutableRefObject, SetStateAction } from 'react';
import { useEffect, useRef, useState } from 'react';

import type { BubbleStyle } from '../domain/project';
import type { Language } from '../lib/i18n';

interface EditorHeaderProps {
  appTitle: string;
  projectName: string;
  projectNamePlaceholder?: string;
  onProjectNameChange: (value: string) => void;
  onProjectNameCommit: (value: string) => Promise<void> | void;
  showLastSavedTime?: boolean;
  lastSavedTime?: number | null;
  language: Language;
  bubbleStyle: BubbleStyle;
  isMobile: boolean;
  isDirty: boolean;
  isSavingProject?: boolean;
  canRenderVideo: boolean;
  assistantOpen: boolean;
  jsonInputRef: MutableRefObject<HTMLInputElement | null>;
  setShowPlayTest: Dispatch<SetStateAction<boolean>>;
  setShowVideoRender: Dispatch<SetStateAction<boolean>>;
  setAssistantOpen: Dispatch<SetStateAction<boolean>>;
  openProjectHome: () => void;
  openImportPicker: () => void;
  handleExportJSON: () => void;
  handleImportZIP: (event: ChangeEvent<HTMLInputElement>) => void;
  t: {
    playTest: string;
    save: string;
    import: string;
  };
}

export function EditorHeader({
  projectName,
  projectNamePlaceholder,
  onProjectNameChange,
  onProjectNameCommit,
  showLastSavedTime,
  lastSavedTime,
  language,
  bubbleStyle,
  isMobile,
  isDirty,
  isSavingProject = false,
  canRenderVideo,
  assistantOpen,
  jsonInputRef,
  setShowPlayTest,
  setShowVideoRender,
  setAssistantOpen,
  openProjectHome,
  openImportPicker,
  handleExportJSON,
  handleImportZIP,
  t,
}: EditorHeaderProps) {
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [editingProjectName, setEditingProjectName] = useState(projectName);
  const projectNameInputRef = useRef<HTMLInputElement | null>(null);
  const projectNameSizerRef = useRef<HTMLSpanElement | null>(null);
  const [projectNameWidth, setProjectNameWidth] = useState(120);

  const displayProjectName = projectName.trim() || projectNamePlaceholder || '';

  const formatLastSavedTime = (timestamp: number) => {
    const now = Date.now();
    const diff = Math.max(0, now - timestamp);
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(days / 7);

    if (days < 1) {
      if (hours >= 1) return `${hours}小时前`;
      return `${Math.max(1, minutes)}分钟前`;
    }
    if (days < 7) {
      return `${days}天前`;
    }
    if (days < 30) {
      return `${weeks}周前`;
    }

    const date = new Date(timestamp);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  useEffect(() => {
    if (!isEditingProjectName) {
      setEditingProjectName(projectName);
    }
  }, [isEditingProjectName, projectName]);

  useEffect(() => {
    if (isEditingProjectName) {
      projectNameInputRef.current?.focus();
      projectNameInputRef.current?.select();
    }
  }, [isEditingProjectName]);

  useEffect(() => {
    const sizer = projectNameSizerRef.current;
    if (!sizer) return;

    const nextWidth = Math.min(Math.max(sizer.offsetWidth + 6, 72), 220);
    setProjectNameWidth(nextWidth);
  }, [
    displayProjectName,
    editingProjectName,
    isEditingProjectName,
    projectNamePlaceholder,
    projectName,
  ]);

  const commitProjectName = async () => {
    await onProjectNameCommit(editingProjectName);
    setIsEditingProjectName(false);
  };

  return (
    <div className="pointer-events-none absolute left-4 top-3 z-30 md:left-6">
      <div
        className={`toolbar-bubble-surface editor-header-bubble pointer-events-auto inline-flex max-w-[min(calc(100vw-2rem),1400px)] items-center rounded-2xl border border-[var(--header-border)] bg-white/80 shadow-sm backdrop-blur-xl dark:bg-slate-900/80 md:max-w-[calc(100vw-3rem)] ${bubbleStyle === 'glass' ? '' : 'gap-3 px-2.5 py-1.5'}`}
      >
        <img
          src={bubbleStyle === 'glass' ? './glass.png' : './icon.png'}
          className="editor-header-logo h-8 w-8 shrink-0 theme-invert"
          alt="Logo"
        />
        <div
          className={`min-w-0 flex items-center overflow-hidden ${bubbleStyle === 'glass' ? '' : 'gap-4'}`}
        >
          <div
            className={`min-w-0 flex shrink items-center overflow-hidden ${bubbleStyle === 'glass' ? '' : 'gap-3'}`}
          >
            <div className="flex items-center gap-2 px-1">
              <button
                type="button"
                onClick={() => {
                  setEditingProjectName(projectName);
                  setIsEditingProjectName(true);
                }}
                className={`min-w-0 rounded-md px-1 py-0.5 text-left text-sm md:text-base font-bold transition-colors ${
                  projectName.trim()
                    ? 'text-black dark:text-white hover:text-slate-700 dark:hover:text-slate-200'
                    : 'text-black dark:text-white hover:text-slate-700 dark:hover:text-slate-200'
                }`}
                title={displayProjectName}
              >
                {isEditingProjectName ? (
                  <input
                    ref={projectNameInputRef}
                    value={editingProjectName}
                    onChange={(event) => {
                      setEditingProjectName(event.target.value);
                      onProjectNameChange(event.target.value);
                    }}
                    onBlur={() => {
                      void commitProjectName();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void commitProjectName();
                        (event.currentTarget as HTMLInputElement).blur();
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        setEditingProjectName(projectName);
                        onProjectNameChange(projectName);
                        setIsEditingProjectName(false);
                        (event.currentTarget as HTMLInputElement).blur();
                      }
                    }}
                    placeholder="新建项目"
                    className="bg-transparent text-black outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
                    style={{ width: `${projectNameWidth}px` }}
                  />
                ) : (
                  <span className="inline-block max-w-[220px] truncate align-middle">
                    {projectName.trim() ? projectName : '新建项目'}
                  </span>
                )}
              </button>
              <span
                ref={projectNameSizerRef}
                className="pointer-events-none absolute -left-[9999px] top-auto whitespace-pre px-1 py-0.5 text-sm font-bold md:text-base"
                aria-hidden="true"
              >
                {editingProjectName || '新建项目'}
              </span>
              {showLastSavedTime && (
                <span className="text-xs text-slate-500 whitespace-nowrap ml-2">
                  {lastSavedTime ? `上次保存: ${formatLastSavedTime(lastSavedTime)}` : '尚未保存'}
                </span>
              )}
            </div>
          </div>
          <div
            className={`flex shrink-0 items-center ${bubbleStyle === 'glass' ? '' : 'gap-1 pl-2'}`}
          >
            <button
              type="button"
              onClick={handleExportJSON}
              disabled={isSavingProject}
              className={`header-glass-action header-glass-action-save relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                isDirty
                  ? 'header-glass-action-active bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-white'
                  : 'text-[var(--icon-color)] hover:bg-slate-100 dark:hover:bg-slate-800'
              } ${isSavingProject ? 'cursor-wait opacity-70' : ''}`}
              title={
                isSavingProject
                  ? language === 'zh'
                    ? '正在保存...'
                    : 'Saving...'
                  : isDirty
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
              onClick={openProjectHome}
              className="header-glass-action flex h-9 w-9 items-center justify-center rounded-xl text-[var(--icon-color)] transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              title={language === 'zh' ? '项目列表' : 'Project home'}
            >
              <FolderOpen className="h-4 w-4" />
            </button>
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
                title={language === 'zh' ? '导出为视频' : 'Export Video'}
              >
                <Film className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
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
