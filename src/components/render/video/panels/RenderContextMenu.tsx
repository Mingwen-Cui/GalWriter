import type { Node as FlowNode } from '@xyflow/react';

import type {
  RenderContextMenuSection,
  RenderContextMenuState,
  RenderContextMenuTarget,
} from '../shared/types';

type RenderContextMenuProps = {
  contextMenu: RenderContextMenuState | null;
  nodeById: Map<string, FlowNode>;
  timelineMenuLabel: string;
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
  buildContextMenuSections,
  mediaIcon,
  mediaKind,
  segmentDurationLabel,
  segmentTitle,
  segmentText,
}: RenderContextMenuProps) {
  if (!contextMenu) return null;

  const node = contextMenu.nodeId ? nodeById.get(contextMenu.nodeId) : undefined;
  const sections = buildContextMenuSections(contextMenu, node);
  const body = node ? segmentText(node) : '';

  return (
    <div
      className="fixed z-[500] w-60 overflow-hidden rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-strong)] py-1 shadow-2xl"
      style={{ left: contextMenu.x, top: contextMenu.y }}
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
          {timelineMenuLabel}
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
    </div>
  );
}
