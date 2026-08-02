import type { Node } from '@xyflow/react';
import type { RefObject } from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';

type SelectionBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
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
    let maxY = -Infinity;

    nodesToMeasure.forEach((node) => {
      const nodeWidth = node.measured?.width || (node.style?.width as number) || 300;
      const nodeHeight = node.measured?.height || (node.style?.height as number) || 200;
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + nodeWidth);
      maxY = Math.max(maxY, node.position.y + nodeHeight);
    });

    return { minX, minY, maxX, maxY };
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
      const menuWidth = element.offsetWidth;
      const menuHeight = element.offsetHeight;
      const viewportPadding = 12;
      const assistantPanel = document.querySelector<HTMLElement>(
        '.assistant-panel-desktop.assistant-panel-entered',
      );
      const assistantPanelRect = assistantPanel?.getBoundingClientRect();
      const usableRightEdge =
        assistantPanelRect && assistantPanelRect.width > 0 && assistantPanelRect.left < window.innerWidth
          ? Math.min(window.innerWidth - viewportPadding, assistantPanelRect.left - viewportPadding)
          : window.innerWidth - viewportPadding;
      const minimumMenuCenterX = viewportPadding + menuWidth / 2;
      const maximumMenuCenterX = Math.max(
        minimumMenuCenterX,
        usableRightEdge - menuWidth / 2,
      );
      const screenX = Math.max(
        minimumMenuCenterX,
        Math.min(
          maximumMenuCenterX,
          wrapperRect.left + centerX * zoom + transformX,
        ),
      );
      const selectedTop = wrapperRect.top + bounds.minY * zoom + transformY;
      const selectedBottom = wrapperRect.top + bounds.maxY * zoom + transformY;
      const preferredAboveY = selectedTop - viewportPadding;
      const canPlaceAbove = preferredAboveY - menuHeight >= viewportPadding;
      const screenY = canPlaceAbove
        ? preferredAboveY
        : Math.min(Math.max(viewportPadding, selectedBottom + viewportPadding), window.innerHeight - viewportPadding - menuHeight);

      element.style.setProperty('--selection-menu-x', `${screenX}px`);
      element.style.setProperty('--selection-menu-y', `${screenY}px`);
      element.style.setProperty('--selection-menu-translate-y', canPlaceAbove ? '-100%' : '0');
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

  useEffect(() => {
    if (!showSelectionMenu) return;

    let transitionTimer: number | undefined;
    const observer = new MutationObserver((mutations) => {
      const panelVisibilityChanged = mutations.some(
        (mutation) =>
          mutation.target instanceof HTMLElement &&
          mutation.target.classList.contains('assistant-panel-desktop'),
      );
      if (!panelVisibilityChanged) return;

      scheduleSelectionMenuPosition();
      window.clearTimeout(transitionTimer);
      transitionTimer = window.setTimeout(scheduleSelectionMenuPosition, 520);
    });

    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      observer.disconnect();
      window.clearTimeout(transitionTimer);
    };
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
