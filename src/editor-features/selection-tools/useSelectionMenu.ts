import type { Node } from '@xyflow/react';
import type { RefObject } from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';

type SelectionBounds = {
  minX: number;
  minY: number;
  maxX: number;
};

interface UseSelectionMenuParams {
  nodes: Node[];
  tx: number;
  ty: number;
  tzoom: number;
  canvasWrapperRef: RefObject<HTMLDivElement | null>;
}

interface UseSelectionMenuResult {
  selectedNodes: Node[];
  selectedAssistantTargetNodes: Node[];
  showSelectionMenu: boolean;
  selectionMenuRef: RefObject<HTMLDivElement | null>;
  handleViewportMove: (_event: unknown, viewport: { x: number; y: number; zoom: number }) => void;
}

export const useSelectionMenu = ({
  nodes,
  tx,
  ty,
  tzoom,
  canvasWrapperRef,
}: UseSelectionMenuParams): UseSelectionMenuResult => {
  const selectedNodes = useMemo(() => nodes.filter((node) => node.selected), [nodes]);
  const showSelectionMenu = selectedNodes.length >= 2;
  const selectedAssistantTargetNodes = useMemo(
    () =>
      selectedNodes.filter(
        (node) =>
          node.type === 'storyNode' || node.type === 'characterNode' || node.type === 'sceneNode',
      ),
    [selectedNodes],
  );

  const selectionMenuRef = useRef<HTMLDivElement>(null);
  const selectionBoundsRef = useRef<SelectionBounds | null>(null);
  const selectionMenuRafRef = useRef<number | null>(null);
  const transformRef = useRef<[number, number, number]>([tx, ty, tzoom]);
  transformRef.current = [tx, ty, tzoom];

  const computeSelectionBounds = useCallback((nodesToMeasure: Node[]) => {
    if (nodesToMeasure.length < 2) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;

    nodesToMeasure.forEach((node) => {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(
        maxX,
        node.position.x + (node.measured?.width || (node.style?.width as number) || 300),
      );
    });

    return { minX, minY, maxX };
  }, []);

  const updateSelectionMenuPosition = useCallback(
    (transform?: [number, number, number]) => {
      const element = selectionMenuRef.current;
      const bounds = selectionBoundsRef.current;
      const wrapper = canvasWrapperRef.current;
      if (!element || !bounds || !wrapper) return;

      const [transformX, transformY, zoom] = transform ?? transformRef.current;
      const wrapperRect = wrapper.getBoundingClientRect();
      const centerX = bounds.minX + (bounds.maxX - bounds.minX) / 2;
      const screenX = wrapperRect.left + centerX * zoom + transformX;
      const screenY = wrapperRect.top + bounds.minY * zoom + transformY - 12;

      element.style.setProperty('--selection-menu-x', `${screenX}px`);
      element.style.setProperty('--selection-menu-y', `${screenY}px`);
    },
    [canvasWrapperRef],
  );

  const scheduleSelectionMenuPosition = useCallback(
    (transform?: [number, number, number]) => {
      if (selectionMenuRafRef.current !== null) {
        cancelAnimationFrame(selectionMenuRafRef.current);
      }

      selectionMenuRafRef.current = requestAnimationFrame(() => {
        selectionMenuRafRef.current = null;
        updateSelectionMenuPosition(transform);
      });
    },
    [updateSelectionMenuPosition],
  );

  useLayoutEffect(() => {
    selectionBoundsRef.current = computeSelectionBounds(selectedNodes);
    if (showSelectionMenu) {
      scheduleSelectionMenuPosition();
    }
  }, [computeSelectionBounds, scheduleSelectionMenuPosition, selectedNodes, showSelectionMenu]);

  useEffect(() => {
    if (showSelectionMenu) {
      scheduleSelectionMenuPosition([tx, ty, tzoom]);
    }
  }, [scheduleSelectionMenuPosition, showSelectionMenu, tx, ty, tzoom]);

  useEffect(() => {
    if (!showSelectionMenu) return;

    const handleResize = () => scheduleSelectionMenuPosition();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [scheduleSelectionMenuPosition, showSelectionMenu]);

  useEffect(
    () => () => {
      if (selectionMenuRafRef.current !== null) {
        cancelAnimationFrame(selectionMenuRafRef.current);
      }
    },
    [],
  );

  const handleViewportMove = useCallback(
    (_event: unknown, viewport: { x: number; y: number; zoom: number }) => {
      if (selectionBoundsRef.current) {
        scheduleSelectionMenuPosition([viewport.x, viewport.y, viewport.zoom]);
      }
    },
    [scheduleSelectionMenuPosition],
  );

  return {
    selectedNodes,
    selectedAssistantTargetNodes,
    showSelectionMenu,
    selectionMenuRef,
    handleViewportMove,
  };
};
