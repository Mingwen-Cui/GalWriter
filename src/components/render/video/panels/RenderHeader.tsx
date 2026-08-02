import type { Node as FlowNode } from '@xyflow/react';
import {
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  FileCode2,
  Film,
  Gamepad2,
  Loader2,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelRightClose,
  PanelsTopLeft,
  Play,
  PlusSquare,
  Presentation,
  Redo2,
  Sparkles,
  Undo2,
  X,
} from 'lucide-react';

import type { Language } from '../../../../lib/i18n';
import { getPptCopy } from '../../ppt/i18n';
import { renderCopy } from '../shared/renderCopy';
import type { RenderStatus, RenderWorkspaceMode } from '../shared/types';

type RenderHeaderProps = {
  language: Language;
  workspaceMode: RenderWorkspaceMode;
  videoWorkspaceMode: 'timeline' | 'interactive';
  status: RenderStatus;
  isFullscreen: boolean;
  assetPanelCollapsed: boolean;
  exportPanelCollapsed: boolean;
  timelinePast: unknown[];
  timelineFuture: unknown[];
  webPast: unknown[];
  webFuture: unknown[];
  pptPast: unknown[];
  pptFuture: unknown[];
  webShowStartMenu: boolean;
  pptRibbonTab: 'insert' | 'animation' | 'transition';
  pptRibbonCollapsed: boolean;
  selectedNodes: unknown[];
  nodes: FlowNode[];
  setWorkspaceMode: (mode: RenderWorkspaceMode) => void;
  setVideoWorkspaceMode: (mode: 'timeline' | 'interactive') => void;
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
  undoPpt: () => void;
  redoPpt: () => void;
  setWebShowStartMenu: (enabled: boolean) => void;
  setPptRibbonTab: (tab: 'insert' | 'animation' | 'transition') => void;
  setPptRibbonCollapsed: (collapsed: boolean) => void;
  /** 点击导出按钮时打开弹窗，而非直接导出 */
  onExportClick: () => void;
  onClose: () => void;
};

export function RenderHeader({
  language,
  workspaceMode,
  videoWorkspaceMode,
  status,
  isFullscreen,
  assetPanelCollapsed,
  exportPanelCollapsed,
  timelinePast,
  timelineFuture,
  webPast,
  webFuture,
  pptPast,
  pptFuture,
  webShowStartMenu,
  pptRibbonTab,
  pptRibbonCollapsed,
  selectedNodes,
  nodes,
  setWorkspaceMode,
  setVideoWorkspaceMode,
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
  undoPpt,
  redoPpt,
  setWebShowStartMenu,
  setPptRibbonTab,
  setPptRibbonCollapsed,
  onExportClick,
  onClose,
}: RenderHeaderProps) {
  const t = (zh: string, ja: string, en: string) => renderCopy(language, zh, ja, en);
  const pptCopy = getPptCopy(language);
  const isRendering = status === 'rendering';

  return (
    <header className="relative flex h-14 items-center justify-between border-b border-transparent bg-[var(--vr-surface-strong)]/90 px-4 backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--vr-border)] bg-[var(--vr-accent-soft)] text-[var(--vr-accent-strong)]">
          <Film className="h-5 w-5" />
        </div>
        <h2 className="truncate text-sm font-black">渲染脚本</h2>
        <div className={`render-workspace-switcher render-workspace-switcher--${workspaceMode}`}>
          {(['video', 'web', 'ppt', 'code'] as RenderWorkspaceMode[]).map((mode) => (
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
              className={`render-workspace-tab ${
                workspaceMode === mode
                  ? 'is-active'
                  : ''
              }`}
              aria-pressed={workspaceMode === mode}
              title={mode === 'video' ? '切换到视频导出' : '切换到网页导出'}
            >
              {mode === 'video' ? <Film className="h-3.5 w-3.5" /> : mode === 'web' ? <FileText className="h-3.5 w-3.5" /> : mode === 'ppt' ? <Presentation className="h-3.5 w-3.5" /> : <FileCode2 className="h-3.5 w-3.5" />}
              {mode === 'ppt' ? 'PPT' : null}
              {mode === 'code' ? '代码' : null}
              {mode !== 'ppt' && mode !== 'code' && <>
              {mode === 'video' ? '视频' : '网页'}
              </>}
            </button>
          ))}
        </div>
      </div>

      <div className="absolute inset-y-0 left-1/2 flex -translate-x-1/2 items-center gap-1">
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
        {workspaceMode === 'ppt' && (
          <>
          <div className="render-context-tabs render-context-tabs--ppt ml-1" aria-label={t('PPT 编辑工具', 'PPT 編集ツール', 'PPT editing tools')}>
            <button
              type="button"
              onClick={() => {
                setPptRibbonTab('insert');
                setPptRibbonCollapsed(false);
              }}
              className={`render-context-tab ${pptRibbonTab === 'insert' ? 'is-active' : ''}`}
              aria-pressed={pptRibbonTab === 'insert'}
              title={pptCopy.insert}
            >
              <PlusSquare className="h-3.5 w-3.5" />
              {pptCopy.insert}
            </button>
            <button
              type="button"
              onClick={() => {
                setPptRibbonTab('transition');
                setPptRibbonCollapsed(false);
              }}
              className={`render-context-tab ${pptRibbonTab === 'transition' ? 'is-active' : ''}`}
              aria-pressed={pptRibbonTab === 'transition'}
              title={t('切换', '画面切り替え', 'Transitions')}
            >
              <PanelsTopLeft className="h-3.5 w-3.5" />
              {t('切换', '切り替え', 'Transitions')}
            </button>
            <button
              type="button"
              onClick={() => {
                setPptRibbonTab('animation');
                setPptRibbonCollapsed(false);
              }}
              className={`render-context-tab ${pptRibbonTab === 'animation' ? 'is-active' : ''}`}
              aria-pressed={pptRibbonTab === 'animation'}
              title={t('动画', 'アニメーション', 'Animations')}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {t('动画', 'アニメ', 'Animations')}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setPptRibbonCollapsed(!pptRibbonCollapsed)}
            className="ml-1 h-8 w-8 rounded-lg text-[var(--vr-text-muted)] transition-colors hover:bg-[var(--vr-accent-soft)] hover:text-[var(--vr-accent-strong)]"
            title={pptRibbonCollapsed ? t('\u5c55\u5f00\u5de5\u5177\u680f', '\u30c4\u30fc\u30eb\u30d0\u30fc\u3092\u5c55\u958b', 'Expand ribbon') : t('\u6536\u8d77\u5de5\u5177\u680f', '\u30c4\u30fc\u30eb\u30d0\u30fc\u3092\u6298\u308a\u305f\u305f\u3080', 'Collapse ribbon')}
            aria-label={pptRibbonCollapsed ? t('\u5c55\u5f00\u5de5\u5177\u680f', '\u30c4\u30fc\u30eb\u30d0\u30fc\u3092\u5c55\u958b', 'Expand ribbon') : t('\u6536\u8d77\u5de5\u5177\u680f', '\u30c4\u30fc\u30eb\u30d0\u30fc\u3092\u6298\u308a\u305f\u305f\u3080', 'Collapse ribbon')}
            aria-expanded={!pptRibbonCollapsed}
          >
            {pptRibbonCollapsed ? <ChevronDown className="mx-auto h-4 w-4" /> : <ChevronUp className="mx-auto h-4 w-4" />}
          </button>
          </>
        )}
        {workspaceMode === 'web' && (
          <div className="render-context-tabs render-context-tabs--web ml-1" aria-label={t('网页启动方式', 'Web 起動方法', 'Web launch mode')}>
            <button
              type="button"
              onClick={() => {
                if (isRendering) return;
                setWebShowStartMenu(true);
              }}
              disabled={isRendering}
              className={`render-context-tab ${
                webShowStartMenu
                  ? 'is-active'
                  : ''
              }`}
              title={t('启用主界面入口', 'メイン画面を有効化', 'Enable menu entry')}
              aria-pressed={webShowStartMenu}
            >
              <Gamepad2 className="h-3.5 w-3.5" />
              <span>{t('主界面', 'メイン', 'Menu')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (isRendering) return;
                setWebShowStartMenu(false);
              }}
              disabled={isRendering}
              className={`render-context-tab ${
                !webShowStartMenu
                  ? 'is-active'
                  : ''
              }`}
              title={t('直接进入剧情', '直接シナリオへ', 'Start directly')}
              aria-pressed={!webShowStartMenu}
            >
              <Play className="h-3.5 w-3.5" />
              <span>{t('无界面', '画面なし', 'No UI')}</span>
            </button>
          </div>
        )}
        {workspaceMode === 'video' && (
          <div className={`render-context-tabs render-context-tabs--video render-context-tabs--video-${videoWorkspaceMode} mx-1`} aria-label={t('视频导出模式', '動画書き出しモード', 'Video export mode')}>
            {[
              {
                value: 'timeline' as const,
                label: renderCopy(language, '时间线导出', 'タイムライン書出し', 'Timeline'),
              },
              {
                value: 'interactive' as const,
                label: renderCopy(language, '互动分段导出', 'インタラクティブ分割', 'Interactive'),
              },
            ].map((mode) => (
              <button
                key={mode.value}
                type="button"
                onClick={() => {
                  if (isRendering) return;
                  setVideoWorkspaceMode(mode.value);
                  setError('');
                  setProgress('');
                  setSavedPath('');
                }}
                disabled={isRendering}
                className={`render-context-tab ${
                  videoWorkspaceMode === mode.value
                    ? 'is-active'
                    : ''
                }`}
                aria-pressed={videoWorkspaceMode === mode.value}
                title={mode.label}
              >
                {mode.label}
              </button>
            ))}
          </div>
        )}
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
        {workspaceMode === 'ppt' && (
          <div className="mr-1 flex items-center gap-1 border-r border-[var(--vr-border)] pr-2">
            <button
              type="button"
              onClick={undoPpt}
              disabled={pptPast.length === 0 || isRendering}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--vr-text-muted)] transition-colors hover:bg-[var(--vr-accent-soft)] hover:text-[var(--vr-accent-strong)] disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-[var(--vr-text-muted)]"
              title="撤销 PPT 更改"
              aria-label="撤销 PPT 更改"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={redoPpt}
              disabled={pptFuture.length === 0 || isRendering}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--vr-text-muted)] transition-colors hover:bg-[var(--vr-accent-soft)] hover:text-[var(--vr-accent-strong)] disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-[var(--vr-text-muted)]"
              title="重做 PPT 更改"
              aria-label="重做 PPT 更改"
            >
              <Redo2 className="h-4 w-4" />
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={onExportClick}
          disabled={
            isRendering ||
            (workspaceMode === 'video' && selectedNodes.length === 0) ||
            ((workspaceMode === 'web' || workspaceMode === 'ppt' || workspaceMode === 'code') &&
              nodes.filter((node) => node.type === 'storyNode' && !node.data?.hidden).length === 0)
          }
          className="flex h-9 items-center justify-center gap-2 rounded-lg bg-[var(--vr-accent)] px-3 text-xs font-black text-white shadow-sm hover:brightness-105 active:scale-[0.98] disabled:opacity-50"
        >
          {isRendering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {workspaceMode === 'ppt' ? <span className="hidden sm:inline">导出 PPTX</span> : null}
          {workspaceMode !== 'ppt' && <>
          <span className="hidden sm:inline">{isRendering ? '渲染中...' : '导出'}</span>
          </>}
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
