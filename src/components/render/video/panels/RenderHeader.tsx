import type { Node as FlowNode } from '@xyflow/react';
import {
  Download,
  FileText,
  Film,
  Loader2,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelRightClose,
  Redo2,
  Undo2,
  X,
} from 'lucide-react';

import type { Language } from '../../../../lib/i18n';
import { renderCopy } from '../shared/renderCopy';
import type { RenderStatus, RenderWorkspaceMode } from '../shared/types';

type RenderHeaderProps = {
  language: Language;
  workspaceMode: RenderWorkspaceMode;
  status: RenderStatus;
  isFullscreen: boolean;
  assetPanelCollapsed: boolean;
  exportPanelCollapsed: boolean;
  timelinePast: unknown[];
  timelineFuture: unknown[];
  webPast: unknown[];
  webFuture: unknown[];
  selectedNodes: unknown[];
  nodes: FlowNode[];
  setWorkspaceMode: (mode: RenderWorkspaceMode) => void;
  setError: (value: string) => void;
  setProgress: (value: string) => void;
  setSavedPath: (value: string) => void;
  toggleFullscreen: () => void;
  toggleAssetPanel: () => void;
  toggleExportPanel: () => void;
  undoTimeline: () => void;
  redoTimeline: () => void;
  undoWeb: () => void;
  redoWeb: () => void;
  renderVideo: () => void;
  exportWebProject: () => void;
  onClose: () => void;
};

export function RenderHeader({
  language,
  workspaceMode,
  status,
  isFullscreen,
  assetPanelCollapsed,
  exportPanelCollapsed,
  timelinePast,
  timelineFuture,
  webPast,
  webFuture,
  selectedNodes,
  nodes,
  setWorkspaceMode,
  setError,
  setProgress,
  setSavedPath,
  toggleFullscreen,
  toggleAssetPanel,
  toggleExportPanel,
  undoTimeline,
  redoTimeline,
  undoWeb,
  redoWeb,
  renderVideo,
  exportWebProject,
  onClose,
}: RenderHeaderProps) {
  const t = (zh: string, ja: string, en: string) => renderCopy(language, zh, ja, en);
  const isRendering = status === 'rendering';

  return (
    <header className="relative flex h-14 items-center justify-between border-b border-[var(--vr-border)] bg-[var(--vr-surface-strong)]/90 px-4 shadow-sm backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--vr-border)] bg-[var(--vr-accent-soft)] text-[var(--vr-accent-strong)]">
          <Film className="h-5 w-5" />
        </div>
        <h2 className="truncate text-sm font-black">渲染脚本</h2>
        <div className="flex h-9 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-0.5">
          {(['video', 'web'] as RenderWorkspaceMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                if (isRendering) return;
                setWorkspaceMode(mode);
                setError('');
                setProgress('');
                setSavedPath('');
              }}
              className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-black transition-colors ${
                workspaceMode === mode
                  ? 'bg-[var(--vr-accent)] text-white shadow-sm'
                  : 'text-[var(--vr-text-muted)] hover:text-[var(--vr-text)]'
              }`}
              aria-pressed={workspaceMode === mode}
              title={mode === 'video' ? '切换到视频导出' : '切换到网页导出'}
            >
              {mode === 'video' ? <Film className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
              {mode === 'video' ? '视频' : '网页'}
            </button>
          ))}
        </div>
      </div>

      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1">
        {assetPanelCollapsed ? (
          <button
            type="button"
            onClick={toggleAssetPanel}
            className="h-8 w-8 rounded-lg text-[var(--vr-text-muted)] transition-colors hover:bg-[var(--vr-accent-soft)] hover:text-[var(--vr-accent-strong)]"
            title="显示素材栏"
            aria-label="显示素材栏"
          >
            <PanelLeftClose className="mx-auto h-4 w-4" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={toggleFullscreen}
          className="h-8 w-8 rounded-lg text-[var(--vr-text-muted)] transition-colors hover:bg-[var(--vr-accent-soft)] hover:text-[var(--vr-accent-strong)]"
          title={isFullscreen ? '退出全屏' : '全屏'}
          aria-label={isFullscreen ? '退出全屏' : '全屏'}
        >
          {isFullscreen ? <Minimize2 className="mx-auto h-4 w-4" /> : <Maximize2 className="mx-auto h-4 w-4" />}
        </button>
        {exportPanelCollapsed ? (
          <button
            type="button"
            onClick={toggleExportPanel}
            className="h-8 w-8 rounded-lg text-[var(--vr-text-muted)] transition-colors hover:bg-[var(--vr-accent-soft)] hover:text-[var(--vr-accent-strong)]"
            title="显示导出设置"
            aria-label="显示导出设置"
          >
            <PanelRightClose className="mx-auto h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        {workspaceMode === 'video' && (
          <div className="mr-1 flex items-center gap-1 border-r border-[var(--vr-border)] pr-2">
            <button
              type="button"
              onClick={undoTimeline}
              disabled={timelinePast.length === 0 || isRendering}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--vr-text-muted)] transition-colors hover:bg-[var(--vr-accent-soft)] hover:text-[var(--vr-accent-strong)] disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-[var(--vr-text-muted)]"
              title="撤销渲染工作区更改"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={redoTimeline}
              disabled={timelineFuture.length === 0 || isRendering}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--vr-text-muted)] transition-colors hover:bg-[var(--vr-accent-soft)] hover:text-[var(--vr-accent-strong)] disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-[var(--vr-text-muted)]"
              title="重做渲染工作区更改"
            >
              <Redo2 className="h-4 w-4" />
            </button>
          </div>
        )}
        {workspaceMode === 'web' && (
          <div className="mr-1 flex items-center gap-1 border-r border-[var(--vr-border)] pr-2">
            <button
              type="button"
              onClick={undoWeb}
              disabled={webPast.length === 0 || isRendering}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--vr-text-muted)] transition-colors hover:bg-[var(--vr-accent-soft)] hover:text-[var(--vr-accent-strong)] disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-[var(--vr-text-muted)]"
              title="撤销网页更改"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={redoWeb}
              disabled={webFuture.length === 0 || isRendering}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--vr-text-muted)] transition-colors hover:bg-[var(--vr-accent-soft)] hover:text-[var(--vr-accent-strong)] disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-[var(--vr-text-muted)]"
              title="重做网页更改"
            >
              <Redo2 className="h-4 w-4" />
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={workspaceMode === 'web' ? exportWebProject : renderVideo}
          disabled={
            isRendering ||
            (workspaceMode === 'video' && selectedNodes.length === 0) ||
            (workspaceMode === 'web' &&
              nodes.filter((node) => node.type === 'storyNode' && !node.data?.hidden).length === 0)
          }
          className="flex h-9 items-center justify-center gap-2 rounded-lg bg-[var(--vr-accent)] px-3 text-xs font-black text-white shadow-sm hover:brightness-105 active:scale-[0.98] disabled:opacity-50"
        >
          {isRendering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          <span className="hidden sm:inline">{isRendering ? '渲染中...' : '导出'}</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-[var(--vr-text-muted)] hover:bg-[var(--vr-surface-soft)] hover:text-[var(--vr-text)]"
          title="关闭"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
