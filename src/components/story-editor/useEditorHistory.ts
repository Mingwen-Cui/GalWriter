import type { Edge, Node } from '@xyflow/react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { INITIAL_EDGES, INITIAL_NODES } from './initialGraph';

export type EditorHistorySnapshot = {
  nodes: Node[];
  edges: Edge[];
};

type EditorHistoryState = {
  past: EditorHistorySnapshot[];
  future: EditorHistorySnapshot[];
};

type UseEditorHistoryOptions = {
  edges: Edge[];
  nodes: Node[];
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
};

export function useEditorHistory({ edges, nodes, setEdges, setNodes }: UseEditorHistoryOptions) {
  const [history, setHistory] = useState<EditorHistoryState>({ past: [], future: [] });
  const lastHistoryState = useRef<EditorHistorySnapshot>({
    nodes: INITIAL_NODES,
    edges: INITIAL_EDGES,
  });
  const isUndoRedoAction = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isUndoRedoAction.current) {
      isUndoRedoAction.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (JSON.stringify(lastHistoryState.current) !== JSON.stringify({ nodes, edges })) {
        setHistory((currentHistory) => ({
          past: [...currentHistory.past, lastHistoryState.current].slice(-50),
          future: [],
        }));
        lastHistoryState.current = { nodes, edges };
      }
    }, 800);
  }, [edges, nodes]);

  const undo = useCallback(() => {
    setHistory((currentHistory) => {
      if (currentHistory.past.length === 0) return currentHistory;
      const previous = currentHistory.past[currentHistory.past.length - 1];
      isUndoRedoAction.current = true;
      setNodes(previous.nodes);
      setEdges(previous.edges);
      lastHistoryState.current = previous;
      return {
        past: currentHistory.past.slice(0, -1),
        future: [{ nodes, edges }, ...currentHistory.future],
      };
    });
  }, [edges, nodes, setEdges, setNodes]);

  const redo = useCallback(() => {
    setHistory((currentHistory) => {
      if (currentHistory.future.length === 0) return currentHistory;
      const next = currentHistory.future[0];
      isUndoRedoAction.current = true;
      setNodes(next.nodes);
      setEdges(next.edges);
      lastHistoryState.current = next;
      return {
        past: [...currentHistory.past, { nodes, edges }],
        future: currentHistory.future.slice(1),
      };
    });
  }, [edges, nodes, setEdges, setNodes]);

  return { history, setHistory, lastHistoryState, undo, redo };
}
