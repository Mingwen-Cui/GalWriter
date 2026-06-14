import type { Node as FlowNode } from '@xyflow/react';
import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type {
  RenderContextMenuSection,
  RenderContextMenuState,
  RenderContextMenuTarget,
} from '../shared/types';

type RenderContextMenuProps = {
  contextMenu: RenderContextMenuState | null;
  nodeById: Map<string, FlowNode>;
  timelineMenuLabel: string;
  assetMenuLabel: string;
  buildContextMenuSections: (
    target: RenderContextMenuTarget,
    node?: FlowNode,
  ) => RenderContextMenuSection[];
  mediaIcon: (node: FlowNode, className?: string) => React.ReactNode;
  mediaKind: (node: FlowNode) => string;
  segmentDurationLabel: (node: FlowNode) => string;
  segmentTitle: (node: FlowNode) => string;
  segmentText: (node: FlowNode) => string;
};

export function RenderContextMenu({
  contextMenu,
  nodeById,
  timelineMenuLabel,
  assetMenuLabel,
  buildContextMenuSections,
  mediaIcon,
  mediaKind,
  segmentDurationLabel,
  segmentTitle,
  segmentText,
}: RenderContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 8, y: 8, measured: false });

  useLayoutEffect(() => {
    if (!contextMenu) return;
    const menu = menuRef.current;
    if (!menu) return;

    const viewportPadding = 8;
    const pointerOffset = 6;
    const rect = menu.getBoundingClientRect();
    const preferredX = contextMenu.x + pointerOffset;
    const preferredY = contextMenu.y + pointerOffset;
    const x =
      preferredX + rect.width <= window.innerWidth - viewportPadding
        ? preferredX
        : contextMenu.x - rect.width - pointerOffset;
    const y =
      preferredY + rect.height <= window.innerHeight - viewportPadding
        ? preferredY
        : contextMenu.y - rect.height - pointerOffset;

    setPosition({
      x: Math.max(viewportPadding, Math.min(x, window.innerWidth - rect.width - viewportPadding)),
      y: Math.max(viewportPadding, Math.min(y, window.innerHeight - rect.height - viewportPadding)),
      measured: true,
    });
  }, [contextMenu]);

  if (!contextMenu) return null;

  const node = contextMenu.nodeId ? nodeById.get(contextMenu.nodeId) : undefined;
  const sections = buildContextMenuSections(contextMenu, node);
  const body = node ? segmentText(node) : '';

  return createPortal(
    <div
      ref={menuRef}
      className="video-render-workspace fixed isolate z-[1000] w-60 overflow-x-hidden overflow-y-auto rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-strong)] py-1 text-[var(--vr-text)] opacity-100 shadow-2xl"
      style={{
        left: position.x,
        top: position.y,
        maxHeight: 'calc(100vh - 16px)',
        backgroundColor: 'var(--vr-surface-strong, #ffffff)',
        visibility: position.measured ? 'visible' : 'hidden',
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      {node && (
        <div className="border-b border-[var(--vr-border)] px-3 py-2">
          <div className="flex min-w-0 items-center gap-2 text-[11px] font-black text-[var(--vr-text-muted)]">
            {mediaIcon(node, 'w-3.5 h-3.5')}
            <span>{mediaKind(node).toUpperCase()}</span>
            <span className="ml-auto tabular-nums">{segmentDurationLabel(node)}</span>
          </div>
          <div className="mt-1 truncate text-xs font-black text-[var(--vr-text)]">
            {segmentTitle(node)}
          </div>
          {body && (
            <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-[var(--vr-text-muted)]">
              {body}
            </div>
          )}
        </div>
      )}
      {!node && (
        <div className="border-b border-[var(--vr-border)] px-3 py-2 text-xs font-black text-[var(--vr-text)]">
          {contextMenu.kind === 'asset' ? assetMenuLabel : timelineMenuLabel}
        </div>
      )}
      {sections.map((section, sectionIndex) => (
        <div
          key={sectionIndex}
          className={sectionIndex > 0 ? 'border-t border-[var(--vr-border)] py-1' : 'py-1'}
        >
          {section.items.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) return;
                item.onSelect?.();
              }}
              className={`flex h-8 w-full items-center gap-2 px-3 text-left text-xs font-bold transition-colors ${
                item.danger
                  ? 'text-rose-500 hover:bg-[var(--vr-danger-soft)]'
                  : 'text-[var(--vr-text-soft)] hover:bg-[var(--vr-accent-soft)] hover:text-[var(--vr-accent-strong)]'
              } disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[var(--vr-text-soft)]`}
            >
              <span className="shrink-0">{item.icon}</span>
              <span className="min-w-0 truncate">{item.label}</span>
            </button>
          ))}
        </div>
      ))}
    </div>,
    document.body,
  );
}
