import { FileCode2, FileText, Film, Presentation, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { RenderWorkspaceMode } from './shared/types';

type RenderWorkspaceSkeletonProps = {
  mode: RenderWorkspaceMode;
  delayed?: boolean;
};

const SkeletonBlock = ({ className = '' }: { className?: string }) => (
  <div className={`render-workspace-skeleton-block ${className}`} aria-hidden="true" />
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
  return (
    <div className="render-workspace-skeleton-layout render-workspace-skeleton-layout--editor">
      <aside className="render-workspace-skeleton-panel space-y-3">
        <SkeletonBlock className="h-8 w-full rounded-lg" />
        {Array.from({ length: 7 }, (_, index) => (
          <SkeletonBlock key={index} className="h-14 w-full rounded-xl" />
        ))}
      </aside>
      <main className="render-workspace-skeleton-stage">
        <SkeletonBlock className="aspect-video w-[min(88%,980px)] rounded-2xl" />
      </main>
      <aside className="render-workspace-skeleton-panel space-y-4">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="space-y-2">
            <SkeletonBlock className="h-4 w-1/3 rounded-full" />
            <SkeletonBlock className="h-9 w-full rounded-lg" />
          </div>
        ))}
      </aside>
    </div>
  );
}

function PptWorkspaceSkeleton() {
  return (
    <div className="render-workspace-skeleton-layout render-workspace-skeleton-layout--ppt">
      <div className="col-span-3 flex h-20 items-center gap-3 border-b border-[var(--vr-border)] px-4">
        {Array.from({ length: 7 }, (_, index) => (
          <SkeletonBlock key={index} className="h-11 w-20 rounded-lg" />
        ))}
      </div>
      <aside className="render-workspace-skeleton-panel space-y-3">
        {Array.from({ length: 6 }, (_, index) => (
          <SkeletonBlock key={index} className="aspect-video w-full rounded-lg" />
        ))}
      </aside>
      <main className="render-workspace-skeleton-stage">
        <SkeletonBlock className="aspect-video w-[min(88%,980px)] rounded-md" />
      </main>
      <aside className="render-workspace-skeleton-panel space-y-4">
        {Array.from({ length: 6 }, (_, index) => (
          <SkeletonBlock key={index} className="h-16 w-full rounded-xl" />
        ))}
      </aside>
    </div>
  );
}

function CodeWorkspaceSkeleton() {
  return (
    <div className="render-workspace-skeleton-layout render-workspace-skeleton-layout--editor">
      <aside className="render-workspace-skeleton-panel space-y-3">
        <SkeletonBlock className="h-8 w-full rounded-lg" />
        {Array.from({ length: 10 }, (_, index) => (
          <SkeletonBlock
            key={index}
            className={`h-4 rounded-full ${index % 3 === 0 ? 'w-4/5' : 'w-3/5'}`}
          />
        ))}
      </aside>
      <main className="space-y-3 overflow-hidden bg-[var(--vr-surface-strong)] p-6">
        {Array.from({ length: 18 }, (_, index) => (
          <div key={index} className="flex items-center gap-4">
            <SkeletonBlock className="h-3 w-6 rounded-full" />
            <SkeletonBlock
              className={`h-3 rounded-full ${index % 4 === 0 ? 'w-2/3' : index % 3 === 0 ? 'w-1/2' : 'w-4/5'}`}
            />
          </div>
        ))}
      </main>
      <aside className="render-workspace-skeleton-panel space-y-4">
        {Array.from({ length: 7 }, (_, index) => (
          <SkeletonBlock key={index} className="h-12 w-full rounded-lg" />
        ))}
      </aside>
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
