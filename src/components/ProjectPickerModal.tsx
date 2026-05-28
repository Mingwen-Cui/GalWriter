import { Clock3, FilePlus2, FolderOpen, Pencil, Sparkles, Trash2, X, Download, Search } from 'lucide-react';
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
  onExportProject?: (projectId: string) => void;
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
  onExportProject,
}: ProjectPickerModalProps) {
  const isZh = language === 'zh';
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

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

  const filteredProjects = projects.filter(p =>
    p.projectName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[350] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="flex h-[min(90vh,960px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-xl shadow-2xl dark:border-slate-800 dark:bg-slate-950/95">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-5 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3">
              <img src="/glass.png" alt="GalWriter AI" className="h-8 w-8 object-contain drop-shadow-sm" />
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.28em] text-indigo-500">
                  GalWriter AI
                </div>
                <div className="text-xl font-black text-slate-900 dark:text-white">
                  {isZh ? '选择项目' : 'Choose a project'}
                </div>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white/80 text-slate-500 transition-colors hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-white"
            title={isZh ? '关闭项目窗口' : 'Close project picker'}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden p-6">
          <div className="grid h-full min-h-0 gap-6 lg:grid-cols-[0.95fr_1.35fr]">
            <div className="grid gap-4 content-start">
              <button
                type="button"
                onClick={onCreateProject}
                className="flex items-center justify-between rounded-xl bg-indigo-600 px-5 py-4 text-left text-white shadow-sm transition-colors hover:bg-indigo-700"
              >
                <div>
                  <div className="text-base font-black">
                    {isZh ? '创建新项目' : 'Create new project'}
                  </div>
                  <div className="mt-1 text-xs font-medium text-indigo-100">
                    {isZh ? '从空白画布开始新的故事。' : 'Start from a blank canvas.'}
                  </div>
                </div>
                <FilePlus2 className="h-5 w-5 shrink-0 text-indigo-100" />
              </button>

              <button
                type="button"
                onClick={onImportProject}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 text-left shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
              >
                <div>
                  <div className="text-base font-black text-slate-900 dark:text-white">
                    {isZh ? '导入现有工程' : 'Import existing project'}
                  </div>
                  <div className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                    {isZh ? '导入后会直接进入编辑。' : 'Import and jump straight into editing.'}
                  </div>
                </div>
                <FolderOpen className="h-5 w-5 shrink-0 text-slate-400 dark:text-slate-500" />
              </button>
            </div>

            <section className="flex min-h-0 flex-col rounded-2xl border border-slate-200/60 bg-white/50 p-5 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/50">
              <div className="mb-4 space-y-3 shrink-0">
                <div className="flex items-center justify-between">
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
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    <Clock3 className="h-4 w-4" />
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={isZh ? '搜索项目名称...' : 'Search projects...'}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
                  />
                </div>
              </div>

              <div
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2 custom-scrollbar"
                onWheel={handleRecentProjectsWheel}
              >
                {loading ? (
                  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    {isZh ? '正在读取本地项目...' : 'Loading local projects...'}
                  </div>
                ) : projects.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    {isZh
                      ? '还没有本地项目。请先创建一个新项目或导入已有工程。'
                      : 'No local projects yet. Create a new project or import an existing one first.'}
                  </div>
                ) : filteredProjects.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    {isZh
                      ? '没有找到相关的项目。'
                      : 'No related projects found.'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredProjects.map((project) => (
                      <div
                        key={project.id}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/80 dark:hover:border-slate-700"
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

                          <div className="flex items-center gap-1.5">
                            {onExportProject && (
                              <button
                                type="button"
                                onClick={() => onExportProject(project.id)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:bg-white hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-indigo-300"
                                title={isZh ? '导出并下载' : 'Export and download'}
                              >
                                <Download className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingProjectId(project.id);
                                setEditingProjectName(project.projectName);
                              }}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:bg-white hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-indigo-300"
                              title={isZh ? '重命名项目' : 'Rename project'}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void onDeleteProject(project.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-rose-900/30 dark:hover:text-rose-400"
                              title={isZh ? '删除项目' : 'Delete project'}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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
