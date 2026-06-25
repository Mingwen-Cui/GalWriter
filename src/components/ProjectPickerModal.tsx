import {
  CheckSquare2,
  Clock3,
  Download,
  EllipsisVertical,
  FilePlus2,
  Image as ImageIcon,
  FolderOpen,
  Pencil,
  Search,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { type MouseEvent, type WheelEvent, useEffect, useState } from 'react';

import type { LocalProjectSummary } from '../lib/db';
import type { Language } from '../lib/i18n';

interface ProjectPickerModalProps {
  visible: boolean;
  language: Language;
  projects: LocalProjectSummary[];
  loading: boolean;
  isMobile?: boolean;
  showCloseButton?: boolean;
  defaultProjectSaveDir?: string | null;
  onClose: () => void;
  onCreateProject: () => void;
  onOpenProject: (projectId: string) => void;
  onImportProject: () => void;
  onChooseDefaultSaveLocation?: () => void;
  onRenameProject: (projectId: string, projectName: string) => Promise<void> | void;
  onDeleteProject: (projectId: string) => Promise<void> | void;
  onDeleteProjects?: (projectIds: string[]) => Promise<void> | void;
  onExportProject?: (projectId: string) => Promise<void> | void;
  onExportProjectsBundle?: (projectIds: string[]) => Promise<void> | void;
}

const formatUpdatedAt = (timestamp: number, language: Language) =>
  new Date(timestamp).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const stripExternalTextFromSvgDataUrl = (dataUrl?: string | null) => {
  if (!dataUrl?.startsWith('data:image/svg+xml')) return dataUrl || '';

  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex < 0) return dataUrl;

  try {
    const prefix = dataUrl.slice(0, commaIndex + 1);
    const encodedSvg = dataUrl.slice(commaIndex + 1);
    const svg = decodeURIComponent(encodedSvg);
    const rects = Array.from(svg.matchAll(/<rect\b[^>]*>/gi))
      .map((match) => {
        const tag = match[0];
        const readAttr = (name: string) => {
          const attr = tag.match(new RegExp(`${name}="([^"]+)"`, 'i'))?.[1];
          if (!attr) return null;
          const parsed = Number.parseFloat(attr);
          return Number.isFinite(parsed) ? parsed : null;
        };
        const x = readAttr('x') ?? 0;
        const y = readAttr('y') ?? 0;
        const width = readAttr('width');
        const height = readAttr('height');
        if (width === null || height === null) return null;
        return { x, y, width, height };
      })
      .filter((rect): rect is { x: number; y: number; width: number; height: number } =>
        Boolean(rect),
      );

    const nextSvg = svg.replace(/<text\b[^>]*>[\s\S]*?<\/text>/gi, (textTag) => {
      const readAttr = (name: string) => {
        const attr = textTag.match(new RegExp(`${name}="([^"]+)"`, 'i'))?.[1];
        if (!attr) return null;
        const parsed = Number.parseFloat(attr);
        return Number.isFinite(parsed) ? parsed : null;
      };
      const x = readAttr('x');
      const y = readAttr('y');
      if (x === null || y === null) return '';
      const isInsideCard = rects.some(
        (rect) =>
          x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height,
      );
      return isInsideCard ? textTag : '';
    });

    return `${prefix}${encodeURIComponent(nextSvg)}`;
  } catch {
    return dataUrl;
  }
};

export function ProjectPickerModal({
  visible,
  language,
  projects,
  loading,
  isMobile = false,
  showCloseButton = false,
  defaultProjectSaveDir,
  onClose,
  onCreateProject,
  onOpenProject,
  onImportProject,
  onChooseDefaultSaveLocation,
  onRenameProject,
  onDeleteProject,
  onDeleteProjects,
  onExportProject,
  onExportProjectsBundle,
}: ProjectPickerModalProps) {
  const isZh = language === 'zh';
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [batchMode, setBatchMode] = useState(false);
  const [projectSortMode, setProjectSortMode] = useState<'time' | 'name'>('time');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [batchExportChoiceOpen, setBatchExportChoiceOpen] = useState(false);
  const [actionMenuProjectId, setActionMenuProjectId] = useState<string | null>(null);
  const [hoverPreview, setHoverPreview] = useState<{
    project: LocalProjectSummary;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (!visible) {
      setEditingProjectId(null);
      setEditingProjectName('');
      setBatchMode(false);
      setSelectedProjectIds([]);
      setBatchExportChoiceOpen(false);
      setActionMenuProjectId(null);
      setHoverPreview(null);
    }
  }, [visible]);

  useEffect(() => {
    const projectIds = new Set(projects.map((project) => project.id));
    setSelectedProjectIds((current) => current.filter((projectId) => projectIds.has(projectId)));
    setActionMenuProjectId((current) => (current && projectIds.has(current) ? current : null));
  }, [projects]);

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

  const filteredProjects = projects.filter((p) =>
    p.projectName.toLowerCase().includes(searchQuery.toLowerCase()),
  );
  const sortedProjects =
    projectSortMode === 'name'
      ? [...filteredProjects].sort((a, b) =>
          a.projectName.localeCompare(b.projectName, language === 'zh' ? 'zh-CN' : 'en-US', {
            numeric: true,
            sensitivity: 'base',
          }),
        )
      : filteredProjects;
  const visibleProjectIds = sortedProjects.map((project) => project.id);
  const selectedVisibleCount = selectedProjectIds.filter((projectId) =>
    visibleProjectIds.includes(projectId),
  ).length;
  const hasSelection = selectedProjectIds.length > 0;

  const toggleProjectSelection = (projectId: string) => {
    setSelectedProjectIds((current) =>
      current.includes(projectId)
        ? current.filter((selectedId) => selectedId !== projectId)
        : [...current, projectId],
    );
  };

  const toggleSelectVisibleProjects = () => {
    setSelectedProjectIds((current) => {
      const visibleIds = new Set(visibleProjectIds);
      const allVisibleSelected =
        visibleProjectIds.length > 0 &&
        visibleProjectIds.every((projectId) => current.includes(projectId));

      if (allVisibleSelected) {
        return current.filter((projectId) => !visibleIds.has(projectId));
      }

      return Array.from(new Set([...current, ...visibleProjectIds]));
    });
  };

  const handleBatchExport = async () => {
    if (!onExportProject || !hasSelection) return;
    if (selectedProjectIds.length > 1 && onExportProjectsBundle) {
      setBatchExportChoiceOpen(true);
      return;
    }
    for (const projectId of selectedProjectIds) {
      await onExportProject(projectId);
    }
  };

  const handleExportMultiplePackages = async () => {
    if (!onExportProject || !hasSelection) return;
    setBatchExportChoiceOpen(false);
    for (const projectId of selectedProjectIds) {
      await onExportProject(projectId);
    }
  };

  const handleExportSingleBundle = async () => {
    if (!onExportProjectsBundle || !hasSelection) return;
    setBatchExportChoiceOpen(false);
    await onExportProjectsBundle(selectedProjectIds);
  };

  const handleBatchDelete = async () => {
    if (!hasSelection) return;
    if (onDeleteProjects) {
      await onDeleteProjects(selectedProjectIds);
      return;
    } else {
      for (const projectId of selectedProjectIds) {
        await onDeleteProject(projectId);
      }
    }
    setSelectedProjectIds([]);
    setBatchMode(false);
  };

  const updateHoverPreview = (project: LocalProjectSummary, event: MouseEvent) => {
    if (!project.thumbnailDataUrl) return;
    setHoverPreview({
      project,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const getProjectThumbnail = (project: LocalProjectSummary) =>
    stripExternalTextFromSvgDataUrl(project.thumbnailDataUrl);
  const actionButtonClass = `flex w-full items-center gap-3 rounded-xl text-left text-sm font-bold text-slate-900 transition-all duration-300 hover:bg-white/70 hover:text-indigo-600 dark:text-slate-100 dark:hover:bg-slate-800/70 dark:hover:text-indigo-300 ${
    isMobile
      ? 'min-h-[58px] flex-col justify-center px-2 py-2 text-center'
      : 'flex-row-reverse justify-end px-4 py-3'
  }`;
  const actionIconClass = `${isMobile ? 'h-5 w-5' : 'h-4 w-4'} shrink-0 text-slate-400`;

  return (
    <div
      className={`fixed inset-0 z-[350] flex bg-slate-950/40 backdrop-blur-sm ${
        isMobile ? 'items-stretch justify-stretch p-0' : 'items-center justify-center p-4'
      }`}
    >
      <div
        className={`flex w-full flex-col overflow-hidden border border-slate-200 bg-white/95 backdrop-blur-xl shadow-2xl dark:border-slate-800 dark:bg-slate-950/95 ${
          isMobile
            ? 'h-dvh max-h-none rounded-none border-0'
            : 'h-[720px] max-h-[90vh] max-w-4xl rounded-2xl'
        }`}
      >
        <div
          className={`flex shrink-0 items-center gap-3 border-b border-slate-200 bg-slate-50/80 px-4 dark:border-slate-800 dark:bg-slate-900/50 ${
            isMobile ? 'min-h-[64px] pb-3 pt-[calc(env(safe-area-inset-top,0px)+12px)]' : 'h-12'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3">
              <div>
                <div
                  className={`${isMobile ? 'text-lg' : 'text-base'} font-black text-slate-900 dark:text-white`}
                >
                  {isZh ? '项目列表' : 'Project list'}
                </div>
                {isMobile && (
                  <div className="mt-0.5 text-xs font-bold text-slate-500 dark:text-slate-400">
                    {isZh ? `${projects.length} 个本地项目` : `${projects.length} local projects`}
                  </div>
                )}
              </div>
            </div>
          </div>
          {onChooseDefaultSaveLocation && (
            <button
              type="button"
              onClick={onChooseDefaultSaveLocation}
              className={`ml-auto inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white/80 text-xs font-black text-slate-500 transition-colors hover:border-indigo-200 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-indigo-500/40 dark:hover:text-indigo-300 ${
                isMobile ? 'h-10 w-10 justify-center px-0 [&>span]:hidden' : 'h-8 px-3'
              }`}
              title={
                defaultProjectSaveDir || (isZh ? '设置默认保存位置' : 'Set default save location')
              }
            >
              <FolderOpen className="h-3.5 w-3.5" />
              <span>{isZh ? '修改保存位置' : 'Change save location'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className={`flex items-center justify-center rounded-lg border border-slate-200 bg-white/80 text-slate-500 transition-colors hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-white ${
              isMobile ? 'h-10 w-10' : 'h-8 w-8'
            }`}
            title={isZh ? '关闭项目窗口' : 'Close project picker'}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          className={`flex min-h-0 flex-1 overflow-hidden ${
            isMobile ? 'flex-col' : 'flex-row'
          }`}
        >
          <div
            className={`shrink-0 border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/30 ${
              isMobile
                ? 'grid grid-cols-3 gap-2 border-b p-3'
                : 'flex h-full min-h-0 w-52 flex-col border-r p-5'
            }`}
          >
            <button
              type="button"
              onClick={onCreateProject}
              className={actionButtonClass}
            >
              <div>
                <div className="text-sm font-bold">
                  {isZh ? '创建新项目' : 'Create new project'}
                </div>
                <div className="hidden">
                  {isZh ? '从空白画布开始新的故事。' : 'Start from a blank canvas.'}
                </div>
              </div>
              <FilePlus2 className={actionIconClass} />
            </button>

            <button
              type="button"
              onClick={onImportProject}
              className={actionButtonClass}
            >
              <div>
                <div className="text-sm font-bold">
                  {isZh ? '导入现有工程' : 'Import existing project'}
                </div>
                <div className="hidden">
                  {isZh ? '导入后会直接进入编辑。' : 'Import and jump straight into editing.'}
                </div>
              </div>
              <FolderOpen className={actionIconClass} />
            </button>

            <button
              type="button"
              onClick={() => {
                setBatchMode((current) => !current);
                setSelectedProjectIds([]);
              }}
              className={`${actionButtonClass} ${
                batchMode
                  ? 'scale-[1.02] border border-indigo-200 bg-white text-indigo-600 shadow-md dark:border-indigo-500/40 dark:bg-slate-800 dark:text-indigo-300'
                  : 'text-slate-900 hover:bg-white/70 hover:text-indigo-600 dark:text-slate-100 dark:hover:bg-slate-800/70 dark:hover:text-indigo-300'
              }`}
            >
              <div>
                <div className="text-sm font-bold">{isZh ? '批量选择' : 'Batch select'}</div>
                <div className="hidden">
                  {isZh
                    ? '选择多个项目后下载或删除。'
                    : 'Select multiple projects to download or delete.'}
                </div>
              </div>
              <CheckSquare2 className={actionIconClass} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`mt-auto w-full rounded-xl bg-slate-900 py-3 text-sm font-black text-white shadow-xl transition-all hover:bg-black active:scale-95 dark:bg-white dark:text-slate-900 dark:shadow-none dark:hover:bg-slate-100 ${
                isMobile ? 'hidden' : ''
              }`}
            >
              {isZh ? '完成' : 'Done'}
            </button>
          </div>

          <section
            className={`flex min-h-0 flex-1 flex-col bg-white/50 dark:bg-slate-900/20 ${
              isMobile ? 'p-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]' : 'p-5'
            }`}
          >
            <div className={`${isMobile ? 'mb-3' : 'mb-4'} space-y-3 shrink-0`}>
              <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={isZh ? '搜索项目名称...' : 'Search projects...'}
                    className={`w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 text-sm text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-400 ${
                      isMobile ? 'h-11' : 'py-2'
                    }`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setProjectSortMode((current) => (current === 'time' ? 'name' : 'time'))
                  }
                  className={`flex shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-colors hover:bg-white hover:text-indigo-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-indigo-300 ${
                    isMobile ? 'h-11 w-11' : 'h-10 w-10'
                  }`}
                  title={
                    projectSortMode === 'time'
                      ? isZh
                        ? '按最近编辑排序，点击改为按名称排序'
                        : 'Sorted by recent edit. Click to sort by name.'
                      : isZh
                        ? '按名称排序，点击改为按最近编辑排序'
                        : 'Sorted by name. Click to sort by recent edit.'
                  }
                >
                  {projectSortMode === 'time' ? (
                    <Clock3 className="h-4 w-4" />
                  ) : (
                    <span className="text-sm font-black leading-none">A</span>
                  )}
                </button>
              </div>
              {batchMode && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                  <button
                    type="button"
                    onClick={toggleSelectVisibleProjects}
                    disabled={filteredProjects.length === 0}
                    className="flex h-8 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-600 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    {selectedVisibleCount === visibleProjectIds.length &&
                    visibleProjectIds.length > 0 ? (
                      <CheckSquare2 className="h-3.5 w-3.5" />
                    ) : (
                      <Square className="h-3.5 w-3.5" />
                    )}
                    {isZh ? '全选' : 'Select all'}
                  </button>
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {isZh
                      ? `已选择 ${selectedProjectIds.length} 个`
                      : `${selectedProjectIds.length} selected`}
                  </div>
                  <div className={`${isMobile ? 'w-full justify-end' : 'ml-auto'} flex items-center gap-2`}>
                    {onExportProject && (
                      <button
                        type="button"
                        onClick={() => void handleBatchExport()}
                        disabled={!hasSelection}
                        className="flex h-8 items-center gap-2 rounded-lg bg-indigo-600 px-3 text-xs font-bold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {isZh ? '下载' : 'Download'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleBatchDelete()}
                      disabled={!hasSelection}
                      className="flex h-8 items-center gap-2 rounded-lg bg-rose-600 px-3 text-xs font-bold text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {isZh ? '删除' : 'Delete'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div
              className={`min-h-0 flex-1 overflow-y-auto overscroll-contain custom-scrollbar ${
                isMobile ? 'px-0 py-1' : 'py-1 pl-1 pr-2'
              }`}
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
                  {isZh ? '没有找到相关的项目。' : 'No related projects found.'}
                </div>
              ) : (
                <div className={isMobile ? 'space-y-3' : 'space-y-2'}>
                  {sortedProjects.map((project) => (
                    <div
                      key={project.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (editingProjectId === project.id) return;
                        if (batchMode) {
                          toggleProjectSelection(project.id);
                          return;
                        }
                        onOpenProject(project.id);
                      }}
                      onMouseEnter={(event) => {
                        if (!isMobile) updateHoverPreview(project, event);
                      }}
                      onMouseMove={(event) => {
                        if (!isMobile) updateHoverPreview(project, event);
                      }}
                      onMouseLeave={() => setHoverPreview(null)}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') return;
                        event.preventDefault();
                        if (editingProjectId === project.id) return;
                        if (batchMode) {
                          toggleProjectSelection(project.id);
                          return;
                        }
                        onOpenProject(project.id);
                      }}
                      className={`group relative rounded-xl border bg-white shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:bg-slate-900/80 ${
                        isMobile ? 'px-3 py-3' : 'px-4 py-3.5'
                      } ${
                        selectedProjectIds.includes(project.id)
                          ? 'border-indigo-300 ring-1 ring-indigo-200 dark:border-indigo-500/70 dark:ring-indigo-500/30'
                          : 'border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700'
                      } ${editingProjectId === project.id ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      <div className={`${isMobile ? 'flex-col gap-3' : 'flex items-start gap-3'}`}>
                        <div className={isMobile ? 'flex items-start gap-3' : 'contents'}>
                        {batchMode && (
                          <div className="pt-0.5 text-indigo-600 dark:text-indigo-300">
                            {selectedProjectIds.includes(project.id) ? (
                              <CheckSquare2 className="h-4 w-4" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </div>
                        )}
                        <div
                          className={`shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800 ${
                            isMobile ? 'h-16 w-24' : 'h-12 w-16'
                          }`}
                        >
                          {project.thumbnailDataUrl ? (
                            <img
                              src={getProjectThumbnail(project)}
                              alt=""
                              className="h-full w-full object-cover"
                              draggable={false}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-slate-400 dark:text-slate-500">
                              <ImageIcon className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1 pr-10">
                          {editingProjectId === project.id ? (
                            <input
                              value={editingProjectName}
                              onClick={(event) => event.stopPropagation()}
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
                            <div
                              className={`block w-full truncate text-left font-black text-slate-900 transition-colors group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-200 ${
                                isMobile ? 'text-base' : 'text-sm'
                              }`}
                            >
                              {project.projectName}
                            </div>
                          )}
                          <div className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                            {isZh ? '最近编辑' : 'Updated'}{' '}
                            {formatUpdatedAt(project.updatedAt, language)}
                          </div>
                        </div>
                        </div>

                        <div className="absolute right-3 top-3 z-20">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setActionMenuProjectId((current) =>
                                current === project.id ? null : project.id,
                              );
                            }}
                            className={`flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:bg-white hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-indigo-300 ${
                              isMobile ? 'h-10 w-10' : 'h-8 w-8'
                            }`}
                            title={isZh ? '更多项目操作' : 'More project actions'}
                          >
                            <EllipsisVertical className="h-4 w-4" />
                          </button>
                        </div>

                        <div className={`hidden ${isMobile ? 'grid w-full grid-cols-3 gap-2' : 'flex items-center gap-1.5'}`}>
                          {onExportProject && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void onExportProject(project.id);
                              }}
                              className={`flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:bg-white hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-indigo-300 ${
                                isMobile ? 'h-10 w-full' : 'h-8 w-8'
                              }`}
                              title={isZh ? '导出并下载' : 'Export and download'}
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setEditingProjectId(project.id);
                              setEditingProjectName(project.projectName);
                            }}
                            className={`flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:bg-white hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-indigo-300 ${
                              isMobile ? 'h-10 w-full' : 'h-8 w-8'
                            }`}
                            title={isZh ? '重命名项目' : 'Rename project'}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void onDeleteProject(project.id);
                            }}
                            className={`flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-rose-900/30 dark:hover:text-rose-400 ${
                              isMobile ? 'h-10 w-full' : 'h-8 w-8'
                            }`}
                            title={isZh ? '删除项目' : 'Delete project'}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      {actionMenuProjectId === project.id && (
                        <>
                          <button
                            type="button"
                            aria-label={isZh ? '关闭项目操作菜单' : 'Close project actions'}
                            className="fixed inset-0 z-[430] cursor-default bg-transparent"
                            onClick={(event) => {
                              event.stopPropagation();
                              setActionMenuProjectId(null);
                            }}
                          />
                          <div
                            className={`absolute z-[440] overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 ${
                              isMobile ? 'bottom-3 right-3 w-44' : 'right-3 top-12 w-44'
                            }`}
                            onClick={(event) => event.stopPropagation()}
                          >
                            {onExportProject && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActionMenuProjectId(null);
                                  void onExportProject(project.id);
                                }}
                                className="flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-bold text-slate-700 transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:text-slate-200 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300"
                              >
                                <Download className="h-4 w-4" />
                                <span>{isZh ? '下载项目' : 'Download'}</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setActionMenuProjectId(null);
                                setEditingProjectId(project.id);
                                setEditingProjectName(project.projectName);
                              }}
                              className="flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-bold text-slate-700 transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:text-slate-200 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300"
                            >
                              <Pencil className="h-4 w-4" />
                              <span>{isZh ? '重命名' : 'Rename'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActionMenuProjectId(null);
                                void onDeleteProject(project.id);
                              }}
                              className="flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-bold text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span>{isZh ? '删除项目' : 'Delete'}</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
      {hoverPreview?.project.thumbnailDataUrl && (
        <div
          className="pointer-events-none fixed z-[420] w-72 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          style={{
            left: Math.min(hoverPreview.x + 18, window.innerWidth - 320),
            top: Math.min(hoverPreview.y + 18, window.innerHeight - 230),
          }}
        >
          <img
            src={getProjectThumbnail(hoverPreview.project)}
            alt=""
            className="aspect-[16/10] w-full rounded-lg object-cover"
            draggable={false}
          />
          <div className="mt-2 truncate px-1 pb-1 text-xs font-black text-slate-700 dark:text-slate-200">
            {hoverPreview.project.projectName}
          </div>
        </div>
      )}
      {batchExportChoiceOpen && (
        <div className="fixed inset-0 z-[460] flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-black text-slate-900 dark:text-white">
                  {isZh ? '批量下载项目' : 'Batch download projects'}
                </div>
                <div className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  {isZh
                    ? `已选择 ${selectedProjectIds.length} 个项目。请选择下载方式。`
                    : `${selectedProjectIds.length} projects selected. Choose a download mode.`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBatchExportChoiceOpen(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-900 dark:hover:text-white"
                title={isZh ? '关闭' : 'Close'}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={() => void handleExportSingleBundle()}
                className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-left transition-colors hover:bg-indigo-100 dark:border-indigo-500/40 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/70"
              >
                <div className="font-black text-indigo-700 dark:text-indigo-200">
                  {isZh ? '下载一个整合包' : 'Download one bundle'}
                </div>
                <div className="mt-1 text-xs font-medium text-indigo-700/75 dark:text-indigo-200/75">
                  {isZh
                    ? '所有项目会放进同一个文件夹结构里，重新导入时会自动拆开。'
                    : 'All projects are grouped in one folder structure and split automatically on import.'}
                </div>
              </button>
              <button
                type="button"
                onClick={() => void handleExportMultiplePackages()}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                <div className="font-black text-slate-900 dark:text-white">
                  {isZh ? '下载多个独立包' : 'Download separate packages'}
                </div>
                <div className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {isZh ? '每个项目保持为一个单独 ZIP。' : 'Each project remains its own ZIP file.'}
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
