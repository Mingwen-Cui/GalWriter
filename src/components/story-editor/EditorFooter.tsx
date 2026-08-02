interface EditorFooterProps {
  nodeCount: number;
  pathCount: number;
  selectedItemCount: number;
  footerHint: string;
  labels: {
    nodes: string;
    paths: string;
    selectedItems: string;
  };
}

const StatDot = () => <span className="h-1 w-1 rounded-full bg-[var(--accent)]" />;

export function EditorFooter({
  nodeCount,
  pathCount,
  selectedItemCount,
  footerHint,
  labels,
}: EditorFooterProps) {
  return (
    <footer className="editor-footer z-20 flex h-8 shrink-0 items-center justify-between border-t border-slate-100 bg-white px-4 text-[10px] font-bold tracking-wide text-slate-500 transition-colors dark:border-white/5 dark:bg-black dark:text-white">
      <div className="flex gap-4">
        <span className="flex items-center gap-1.5">
          <StatDot /> {labels.nodes}: {nodeCount}
        </span>
        <span className="flex items-center gap-1.5">
          <StatDot /> {labels.paths}: {pathCount}
        </span>
        {selectedItemCount > 0 && (
          <span className="flex items-center gap-1.5 text-[var(--text-primary)]">
            <StatDot /> {labels.selectedItems}: {selectedItemCount}
          </span>
        )}
      </div>
      <div className="font-medium opacity-60">{footerHint}</div>
    </footer>
  );
}
