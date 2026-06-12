import type { Node as FlowNode } from '@xyflow/react';
import {
  Download,
  FileText,
  Film,
  Loader2,
  Maximize2,
  Minimize2,
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
        <h2 className="truncate text-sm font-black">
          {t('渲染剧本', 'スクリプトを書き出し', 'Render Script')}
        </h2>
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
              title={
                mode === 'video'
                  ? t('切换到视频导出', '動画書き出しに切り替え', 'Switch to video export')
                  : t('切换到网页导出', 'Web書き出しに切り替え', 'Switch to web export')
              }
            >
              {mode === 'video' ? (
                <Film className="h-3.5 w-3.5" />
              ) : (
                <FileText className="h-3.5 w-3.5" />
              )}
              {mode === 'video' ? t('视频', '動画', 'Video') : t('网页', 'Web', 'Web')}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={toggleFullscreen}
        className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-lg text-[var(--vr-text-muted)] transition-colors hover:bg-[var(--vr-accent-soft)] hover:text-[var(--vr-accent-strong)]"
        title={
          isFullscreen
            ? t('退出全屏', '全画面を終了', 'Exit fullscreen')
            : t('全屏', '全画面', 'Fullscreen')
        }
        aria-label={
          isFullscreen
            ? t('退出全屏', '全画面を終了', 'Exit fullscreen')
            : t('全屏', '全画面', 'Fullscreen')
        }
      >
        {isFullscreen ? (
          <Minimize2 className="mx-auto h-4 w-4" />
        ) : (
          <Maximize2 className="mx-auto h-4 w-4" />
        )}
      </button>

      <div className="flex items-center gap-2">
        {workspaceMode === 'video' && (
          <div className="mr-1 flex items-center gap-1 border-r border-[var(--vr-border)] pr-2">
            <button
              type="button"
              onClick={undoTimeline}
              disabled={timelinePast.length === 0 || isRendering}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--vr-text-muted)] transition-colors hover:bg-[var(--vr-accent-soft)] hover:text-[var(--vr-accent-strong)] disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-[var(--vr-text-muted)]"
              title={t(
                '撤销视频渲染操作',
                '動画書き出し操作を元に戻す',
                'Undo render workspace change',
              )}
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={redoTimeline}
              disabled={timelineFuture.length === 0 || isRendering}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--vr-text-muted)] transition-colors hover:bg-[var(--vr-accent-soft)] hover:text-[var(--vr-accent-strong)] disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-[var(--vr-text-muted)]"
              title={t(
                '重做视频渲染操作',
                '動画書き出し操作をやり直す',
                'Redo render workspace change',
              )}
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
              title={t('撤销网页页面设置', 'Webページ設定を元に戻す', 'Undo web page change')}
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={redoWeb}
              disabled={webFuture.length === 0 || isRendering}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--vr-text-muted)] transition-colors hover:bg-[var(--vr-accent-soft)] hover:text-[var(--vr-accent-strong)] disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-[var(--vr-text-muted)]"
              title={t('重做网页页面设置', 'Webページ設定をやり直す', 'Redo web page change')}
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
          title={
            workspaceMode === 'web'
              ? t('导出网页 ZIP', 'Web ZIPを書き出し', 'Export Web ZIP')
              : t('一键导出视频', '動画を書き出し', 'Export Video')
          }
        >
          {isRendering ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">
            {isRendering
              ? t('渲染中...', '書き出し中...', 'Rendering...')
              : workspaceMode === 'web'
                ? t('导出网页', 'Webを書き出し', 'Export Web')
                : t('导出视频', '動画を書き出し', 'Export Video')}
          </span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-[var(--vr-text-muted)] hover:bg-[var(--vr-surface-soft)] hover:text-[var(--vr-text)]"
          title={t('关闭', '閉じる', 'Close')}
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
