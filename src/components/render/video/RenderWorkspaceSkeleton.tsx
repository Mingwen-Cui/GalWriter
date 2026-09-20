import { FileCode2, FileText, Film, Presentation, X } from 'lucide-react';
import { type CSSProperties, useEffect, useState } from 'react';

import type { RenderWorkspaceMode } from './shared/types';

type RenderWorkspaceSkeletonProps = {
  mode: RenderWorkspaceMode;
  delayed?: boolean;
};

const SkeletonBlock = ({
  className = '',
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) => (
  <div
    className={`render-workspace-skeleton-block ${className}`}
    style={style}
    aria-hidden="true"
  />
);

function VideoWorkspaceSkeleton() {
  return (
    <div className="render-workspace-skeleton-layout render-workspace-skeleton-layout--video">
      <aside className="render-workspace-skeleton-panel space-y-3">
        <SkeletonBlock className="h-8 w-full rounded-lg" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="space-y-2">
              <SkeletonBlock className="aspect-video w-full rounded-xl" />
              <SkeletonBlock className="h-3 w-3/4 rounded-full" />
            </div>
          ))}
        </div>
      </aside>
      <main className="render-workspace-skeleton-stage">
        <SkeletonBlock className="aspect-video w-[min(86%,960px)] rounded-2xl" />
        <div className="flex w-[min(78%,860px)] items-center gap-3">
          <SkeletonBlock className="h-8 w-8 rounded-full" />
          <SkeletonBlock className="h-2 flex-1 rounded-full" />
          <SkeletonBlock className="h-4 w-16 rounded-full" />
        </div>
      </main>
      <aside className="render-workspace-skeleton-panel space-y-4">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="space-y-2 rounded-xl border border-[var(--vr-border)] p-3">
            <SkeletonBlock className="h-4 w-2/5 rounded-full" />
            <SkeletonBlock className="h-8 w-full rounded-lg" />
            <SkeletonBlock className="h-2 w-full rounded-full" />
          </div>
        ))}
      </aside>
      <section className="render-workspace-skeleton-timeline">
        <div className="flex items-center gap-3 border-b border-[var(--vr-border)] px-4 py-3">
          <SkeletonBlock className="h-7 w-24 rounded-lg" />
          <SkeletonBlock className="h-2 flex-1 rounded-full" />
        </div>
        <div className="space-y-3 p-4">
          <div className="flex gap-3">
            <SkeletonBlock className="h-16 w-[26%] rounded-lg" />
            <SkeletonBlock className="h-16 w-[18%] rounded-lg" />
            <SkeletonBlock className="h-16 w-[32%] rounded-lg" />
          </div>
          <div className="flex gap-3">
            <SkeletonBlock className="h-10 w-[38%] rounded-lg" />
            <SkeletonBlock className="h-10 w-[22%] rounded-lg" />
          </div>
        </div>
      </section>
    </div>
  );
}

function WebWorkspaceSkeleton() {
  return <WebDesignWorkspaceSkeleton />;
}

/** The web exporter is a preview window plus inspector, rather than a file tree. */
function WebDesignWorkspaceSkeleton({ inCodeWorkspace = false }: { inCodeWorkspace?: boolean }) {
  return (
    <div
      className={`render-workspace-skeleton-layout render-workspace-skeleton-layout--web ${
        inCodeWorkspace ? 'render-workspace-skeleton-layout--code-design' : ''
      }`}
    >
      <section className="render-workspace-skeleton-web-preview">
        <header className="render-workspace-skeleton-web-header">
          <div className="flex items-center gap-2">
            <SkeletonBlock className="h-4 w-4 rounded" />
            <SkeletonBlock className="h-3 w-28 rounded-full" />
          </div>
          <div className="flex items-center gap-2">
            {Array.from({ length: 4 }, (_, index) => (
              <SkeletonBlock key={index} className="h-8 w-8 rounded-lg" />
            ))}
          </div>
        </header>
        <div className="render-workspace-skeleton-web-stage">
          <div className="render-workspace-skeleton-web-canvas">
            <SkeletonBlock className="h-3 w-[28%] rounded-full" />
            <SkeletonBlock className="mt-5 h-7 w-[56%] rounded-full" />
            <SkeletonBlock className="mt-3 h-3 w-[70%] rounded-full" />
            <SkeletonBlock className="mt-2 h-3 w-[52%] rounded-full" />
            <div className="mt-auto grid w-[68%] gap-2 pt-10">
              <SkeletonBlock className="h-9 w-full rounded-lg" />
              <SkeletonBlock className="h-9 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </section>
      <aside className="render-workspace-skeleton-web-inspector">
        <header className="render-workspace-skeleton-inspector-header">
          <SkeletonBlock className="h-4 w-24 rounded-full" />
          <div className="flex h-7 w-32 gap-1 rounded-lg p-1">
            <SkeletonBlock className="h-full flex-1 rounded" />
            <SkeletonBlock className="h-full flex-1 rounded" />
          </div>
        </header>
        <div className="render-workspace-skeleton-inspector-body">
          <div className="render-workspace-skeleton-inspector-card">
            <SkeletonBlock className="h-3 w-16 rounded-full" />
            <SkeletonBlock className="mt-3 h-8 w-full rounded-lg" />
          </div>
          <div className="render-workspace-skeleton-inspector-card">
            <div className="flex items-center justify-between">
              <SkeletonBlock className="h-3 w-20 rounded-full" />
              <SkeletonBlock className="h-5 w-9 rounded-full" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <SkeletonBlock className="h-16 rounded-lg" />
              <SkeletonBlock className="h-16 rounded-lg" />
            </div>
          </div>
          {Array.from({ length: 2 }, (_, index) => (
            <div key={index} className="render-workspace-skeleton-inspector-card">
              <SkeletonBlock className="h-3 w-24 rounded-full" />
              <div className="mt-3 flex gap-2">
                <SkeletonBlock className="h-8 w-8 rounded-lg" />
                <SkeletonBlock className="h-8 flex-1 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function PptWorkspaceSkeleton() {
  return (
    <div className="render-workspace-skeleton-layout render-workspace-skeleton-layout--ppt">
      <header className="render-workspace-skeleton-ppt-ribbon">
        <div className="render-workspace-skeleton-ppt-ribbon-groups">
          {[3, 2, 4, 2].map((count, groupIndex) => (
            <div key={groupIndex} className="render-workspace-skeleton-ppt-ribbon-group">
              <div className="flex gap-2">
                {Array.from({ length: count }, (_, index) => (
                  <div key={index} className="flex w-14 flex-col items-center gap-2">
                    <SkeletonBlock className="h-7 w-7 rounded-md" />
                    <SkeletonBlock className="h-2 w-10 rounded-full" />
                  </div>
                ))}
              </div>
              <SkeletonBlock className="absolute inset-x-5 bottom-2 mx-auto h-2 w-12 rounded-full" />
            </div>
          ))}
        </div>
        <div className="render-workspace-skeleton-ppt-rules">
          <SkeletonBlock className="h-3 w-14 rounded-full" />
          <SkeletonBlock className="mt-3 h-8 w-24 rounded-lg" />
        </div>
      </header>
      <div className="render-workspace-skeleton-ppt-body">
        <aside className="render-workspace-skeleton-ppt-slides">
          <SkeletonBlock className="mb-4 h-3 w-20 rounded-full" />
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="flex items-start gap-2">
              <SkeletonBlock className="mt-1 h-3 w-3 rounded-full" />
              <SkeletonBlock className="aspect-video flex-1 rounded-lg" />
            </div>
          ))}
        </aside>
        <main className="render-workspace-skeleton-ppt-stage">
          <div className="render-workspace-skeleton-ppt-canvas">
            <SkeletonBlock className="h-4 w-[22%] rounded-full" />
            <SkeletonBlock className="mt-5 h-8 w-[53%] rounded-full" />
            <SkeletonBlock className="mt-3 h-3 w-[66%] rounded-full" />
            <SkeletonBlock className="mt-2 h-3 w-[45%] rounded-full" />
            <div className="mt-auto flex justify-end gap-2 pt-10">
              <SkeletonBlock className="h-8 w-24 rounded-lg" />
              <SkeletonBlock className="h-8 w-24 rounded-lg" />
            </div>
          </div>
        </main>
        <aside className="render-workspace-skeleton-ppt-inspector">
          <header className="render-workspace-skeleton-inspector-header">
            <SkeletonBlock className="h-3 w-20 rounded-full" />
            <SkeletonBlock className="h-7 w-28 rounded-lg" />
          </header>
          <div className="render-workspace-skeleton-inspector-body">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="render-workspace-skeleton-inspector-card">
                <SkeletonBlock className="h-3 w-24 rounded-full" />
                <SkeletonBlock className="mt-3 h-8 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </aside>
      </div>
      <footer className="render-workspace-skeleton-ppt-footer">
        <SkeletonBlock className="h-4 w-16 rounded-full" />
        <div className="ml-auto flex items-center gap-3">
          {Array.from({ length: 4 }, (_, index) => (
            <SkeletonBlock key={index} className="h-7 w-7 rounded" />
          ))}
          <SkeletonBlock className="h-2 w-20 rounded-full" />
          <SkeletonBlock className="h-3 w-10 rounded-full" />
        </div>
      </footer>
    </div>
  );
}

function CodeWorkspaceSkeleton() {
  return (
    <div className="render-workspace-skeleton-code-shell">
      <header className="render-workspace-skeleton-code-ribbon">
        <div className="flex gap-1">
          {[74, 62, 70, 72, 62, 54, 74].map((width, index) => (
            <div key={index} className="flex h-8 items-center gap-1.5 rounded-md px-2">
              <SkeletonBlock className="h-3.5 w-3.5 rounded" />
              <SkeletonBlock className="h-2 rounded-full" style={{ width }} />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <SkeletonBlock className="h-8 w-28 rounded-md" />
          <SkeletonBlock className="h-8 w-24 rounded-md" />
        </div>
      </header>
      <WebDesignWorkspaceSkeleton inCodeWorkspace />
    </div>
  );
}

export function RenderWorkspaceContentSkeleton({
  mode,
  delayed = false,
}: RenderWorkspaceSkeletonProps) {
  const [visible, setVisible] = useState(!delayed);

  useEffect(() => {
    if (!delayed) {
      setVisible(true);
      return;
    }
    setVisible(false);
    const timer = window.setTimeout(() => setVisible(true), 100);
    return () => window.clearTimeout(timer);
  }, [delayed, mode]);

  if (!visible) {
    return <div className="min-h-0 min-w-0 bg-[var(--vr-bg)]" aria-busy="true" />;
  }

  return (
    <div
      className="render-workspace-content-skeleton min-h-0 min-w-0"
      aria-busy="true"
      aria-live="polite"
      aria-label="正在加载工作区"
    >
      {mode === 'video' ? (
        <VideoWorkspaceSkeleton />
      ) : mode === 'web' ? (
        <WebWorkspaceSkeleton />
      ) : mode === 'ppt' ? (
        <PptWorkspaceSkeleton />
      ) : (
        <CodeWorkspaceSkeleton />
      )}
    </div>
  );
}

type RenderWorkspaceBootSkeletonProps = {
  onClose: () => void;
};

export function RenderWorkspaceBootSkeleton({ onClose }: RenderWorkspaceBootSkeletonProps) {
  const tabs = [
    { mode: 'video', label: '视频', icon: Film },
    { mode: 'web', label: '网页', icon: FileText },
    { mode: 'ppt', label: 'PPT', icon: Presentation },
    { mode: 'code', label: '代码', icon: FileCode2 },
  ] as const;

  return (
    <div className="video-render-workspace fixed inset-0 z-[350] bg-[var(--vr-bg)] text-[var(--vr-text)]">
      <div className="grid h-full w-full" style={{ gridTemplateRows: '56px minmax(0, 1fr)' }}>
        <header className="relative flex h-14 items-center justify-between border-b border-transparent bg-[var(--vr-surface-strong)]/90 px-4 backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--vr-border)] bg-[var(--vr-accent-soft)] text-[var(--vr-accent-strong)]">
              <Film className="h-5 w-5" />
            </div>
            <h2 className="truncate text-sm font-black">渲染脚本</h2>
            <div className="render-workspace-switcher render-workspace-switcher--video">
              {tabs.map(({ mode, label, icon: Icon }) => (
                <div
                  key={mode}
                  className={`render-workspace-tab ${mode === 'video' ? 'is-active' : ''}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </div>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--vr-text-muted)] hover:bg-[var(--vr-surface-soft)] hover:text-[var(--vr-text)]"
            title="关闭"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <RenderWorkspaceContentSkeleton mode="video" />
      </div>
    </div>
  );
}
