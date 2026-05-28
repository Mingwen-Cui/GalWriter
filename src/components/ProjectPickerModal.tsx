import { Clock3, FilePlus2, FolderOpen, Pencil, Sparkles, Trash2, X } from 'lucide-react';
import { type WheelEvent, useEffect, useState } from 'react';

import type { LocalProjectSummary } from '../lib/db';
import type { Language } from '../lib/i18n';

interface ProjectPickerModalProps {
  visible: boolean;
  language: Language;
  projects: LocalProjectSummary[];
  loading: boolean;
  showCloseButton?: boolean;
  onClose: () => void;
  onCreateProject: () => void;
  onOpenProject: (projectId: string) => void;
  onImportProject: () => void;
  onRenameProject: (projectId: string, projectName: string) => Promise<void> | void;
  onDeleteProject: (projectId: string) => Promise<void> | void;
}

const formatUpdatedAt = (timestamp: number, language: Language) =>
  new Date(timestamp).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export function ProjectPickerModal({
  visible,
  language,
  projects,
  loading,
  showCloseButton = false,
  onClose,
  onCreateProject,
  onOpenProject,
  onImportProject,
  onRenameProject,
  onDeleteProject,
}: ProjectPickerModalProps) {
  const isZh = language === 'zh';
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');

  useEffect(() => {
    if (!visible) {
      setEditingProjectId(null);
      setEditingProjectName('');
    }
  }, [visible]);

  if (!visible) return null;

  const commitRename = async () => {
    if (!editingProjectId) return;
    const nextName = editingProjectName.trim();
    if (!nextName) {
      setEditingProjectId(null);
      setEditingProjectName('');
      return;
    }
    await onRenameProject(editingProjectId, nextName);
    setEditingProjectId(null);
    setEditingProjectName('');
  };

  const handleRecentProjectsWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  return (
    <div className="fixed inset-0 z-[350] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm">
      <div className="flex max-h-[min(85vh,920px)] w-full max-w-5xl flex-col overflow-hidden rounded-[30px] border border-white/60 bg-[linear-gradient(135deg,_rgba(255,255,255,0.95),_rgba(241,245,249,0.92))] shadow-[0_32px_120px_rgba(15,23,42,0.26)] dark:border-white/10 dark:bg-[linear-gradient(135deg,_rgba(15,23,42,0.96),_rgba(2,6,23,0.92))]">
        <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-5 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg dark:bg-white dark:text-slate-900">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.28em] text-indigo-500">
                GalWriter AI
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-white">
                {isZh ? '选择项目' : 'Choose a project'}
              </div>
            </div>
          </div>
          {showCloseButton ? (
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white/80 text-slate-500 transition-colors hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:text-white"
              title={isZh ? '关闭项目窗口' : 'Close project picker'}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-hidden p-6">
          <div className="grid h-full min-h-0 gap-6 lg:grid-cols-[0.95fr_1.35fr]">
            <section className="rounded-[26px] border border-white/60 bg-white/80 p-5 shadow-xl shadow-slate-200/60 dark:border-white/10 dark:bg-slate-900/70 dark:shadow-none">
            <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
              {isZh
                ? showCloseButton
                  ? '你可以继续当前项目，也可以创建新项目、导入现有工程，或直接切换到最近的项目。'
                  : '请选择创建一个新项目、导入现有工程，或直接继续最近的项目。'
                : showCloseButton
                  ? 'Continue the current project, create a new one, import an existing bundle, or switch to a recent project.'
                  : 'Create a new project, import an existing bundle, or continue a recent project to get started.'}
            </p>

            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={onCreateProject}
                className="flex items-center justify-between rounded-2xl bg-slate-900 px-5 py-4 text-left text-white transition-transform hover:-translate-y-0.5 dark:bg-white dark:text-slate-900"
              >
                <div>
                  <div className="text-base font-black">
                    {isZh ? '创建新项目' : 'Create new project'}
                  </div>
                  <div className="mt-1 text-xs font-medium text-white/70 dark:text-slate-500">
                    {isZh ? '从空白画布开始新的故事。' : 'Start from a blank canvas.'}
                  </div>
                </div>
                <FilePlus2 className="h-5 w-5 shrink-0" />
              </button>

              <button
                type="button"
                onClick={onImportProject}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-left transition-transform hover:-translate-y-0.5 dark:border-slate-800 dark:bg-slate-950"
              >
                <div>
                  <div className="text-base font-black text-slate-900 dark:text-white">
                    {isZh ? '导入现有工程' : 'Import existing project'}
                  </div>
                  <div className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                    {isZh ? '导入后会直接进入编辑。' : 'Import and jump straight into editing.'}
                  </div>
                </div>
                <FolderOpen className="h-5 w-5 shrink-0 text-indigo-500" />
              </button>
            </div>
            </section>

            <section className="flex min-h-0 flex-col rounded-[26px] border border-white/60 bg-white/80 p-5 shadow-xl shadow-slate-200/60 dark:border-white/10 dark:bg-slate-900/70 dark:shadow-none">
              <div className="mb-4 flex items-center justify-between shrink-0">
                <div>
                  <div className="text-lg font-black text-slate-900 dark:text-white">
                    {isZh ? '最近项目' : 'Recent projects'}
                  </div>
                  <div className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                    {isZh
                      ? '点击项目打开，或直接在这里重命名、删除。'
                      : 'Open a project, or rename and delete it right here.'}
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500 dark:bg-indigo-500/10 dark:text-indigo-300">
                  <Clock3 className="h-4 w-4" />
                </div>
              </div>

              <div
                className="min-h-0 max-h-[min(48vh,520px)] flex-1 overflow-y-auto overscroll-contain pr-1 custom-scrollbar lg:max-h-[min(54vh,560px)]"
                onWheel={handleRecentProjectsWheel}
              >
                {loading ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    {isZh ? '正在读取本地项目...' : 'Loading local projects...'}
                  </div>
                ) : projects.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    {isZh
                      ? '还没有本地项目。请先创建一个新项目或导入已有工程。'
                      : 'No local projects yet. Create a new project or import an existing one first.'}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {projects.map((project) => (
                      <div
                        key={project.id}
                        className="rounded-2xl border border-slate-200 bg-white/85 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/70"
                      >
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            {editingProjectId === project.id ? (
                              <input
                                value={editingProjectName}
                                onChange={(event) => setEditingProjectName(event.target.value)}
                                onBlur={() => void commitRename()}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    event.preventDefault();
                                    void commitRename();
                                  }
                                  if (event.key === 'Escape') {
                                    event.preventDefault();
                                    setEditingProjectId(null);
                                    setEditingProjectName('');
                                  }
                                }}
                                autoFocus
                                className="w-full rounded-lg border border-indigo-200 bg-white px-2 py-1 text-sm font-black text-slate-900 outline-none focus:border-indigo-400 dark:border-indigo-500/40 dark:bg-slate-900 dark:text-white"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => onOpenProject(project.id)}
                                className="block w-full truncate text-left text-sm font-black text-slate-900 transition-colors hover:text-indigo-600 dark:text-white dark:hover:text-indigo-200"
                              >
                                {project.projectName}
                              </button>
                            )}
                            <div className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                              {isZh ? '最近编辑' : 'Updated'} {formatUpdatedAt(project.updatedAt, language)}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingProjectId(project.id);
                                setEditingProjectName(project.projectName);
                              }}
                              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-indigo-200"
                              title={isZh ? '重命名项目' : 'Rename project'}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void onDeleteProject(project.id)}
                              className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-500 transition-colors hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
                              title={isZh ? '删除项目' : 'Delete project'}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
