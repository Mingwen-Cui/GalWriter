import type { Node } from '@xyflow/react';
import type { RefObject } from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';

type SelectionBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type SelectionMenuLayout = {
  wrapperLeft: number;
  wrapperTop: number;
  menuWidth: number;
  menuHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  usableRightEdge: number;
};

interface UseSelectionMenuParams {
  nodes: Node[];
  getViewport: () => { x: number; y: number; zoom: number };
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
  getViewport,
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
  const layoutRefreshRafRef = useRef<number | null>(null);
  const selectionMenuLayoutRef = useRef<SelectionMenuLayout | null>(null);
  const transformRef = useRef<[number, number, number]>([0, 0, 1]);

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

  const measureSelectionMenuLayout = useCallback(() => {
    const element = selectionMenuRef.current;
    const wrapper = canvasWrapperRef.current;
    if (!element || !wrapper) {
      selectionMenuLayoutRef.current = null;
      return false;
    }

    const viewportPadding = 12;
    const wrapperRect = wrapper.getBoundingClientRect();
    const menuRect = element.getBoundingClientRect();
    const assistantPanel = document.querySelector<HTMLElement>(
      '.assistant-panel-desktop.assistant-panel-entered',
    );
    const assistantPanelRect = assistantPanel?.getBoundingClientRect();
    const usableRightEdge =
      assistantPanelRect &&
      assistantPanelRect.width > 0 &&
      assistantPanelRect.left < window.innerWidth
        ? Math.min(window.innerWidth - viewportPadding, assistantPanelRect.left - viewportPadding)
        : window.innerWidth - viewportPadding;

    selectionMenuLayoutRef.current = {
      wrapperLeft: wrapperRect.left,
      wrapperTop: wrapperRect.top,
      menuWidth: menuRect.width,
      menuHeight: menuRect.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      usableRightEdge,
    };
    return true;
  }, [canvasWrapperRef]);

  const updateSelectionMenuPosition = useCallback(
    (transform?: [number, number, number]) => {
      const element = selectionMenuRef.current;
      const bounds = selectionBoundsRef.current;
      const layout = selectionMenuLayoutRef.current;
      if (!element || !bounds || !layout) return;

      const [transformX, transformY, zoom] = transform ?? transformRef.current;
      const centerX = bounds.minX + (bounds.maxX - bounds.minX) / 2;
      const viewportPadding = 12;
      const minimumMenuCenterX = viewportPadding + layout.menuWidth / 2;
      const maximumMenuCenterX = Math.max(
        minimumMenuCenterX,
        layout.usableRightEdge - layout.menuWidth / 2,
      );
      const screenX = Math.max(
        minimumMenuCenterX,
        Math.min(
          maximumMenuCenterX,
          layout.wrapperLeft + centerX * zoom + transformX,
        ),
      );
      const selectedTop = layout.wrapperTop + bounds.minY * zoom + transformY;
      const selectedBottom = layout.wrapperTop + bounds.maxY * zoom + transformY;
      const preferredAboveY = selectedTop - viewportPadding;
      const canPlaceAbove = preferredAboveY - layout.menuHeight >= viewportPadding;
      const screenY = canPlaceAbove
        ? preferredAboveY
        : Math.min(
            Math.max(viewportPadding, selectedBottom + viewportPadding),
            layout.viewportHeight - viewportPadding - layout.menuHeight,
          );

      element.style.setProperty('--selection-menu-x', `${screenX}px`);
      element.style.setProperty('--selection-menu-y', `${screenY}px`);
      element.style.setProperty('--selection-menu-translate-y', canPlaceAbove ? '-100%' : '0');
    },
    [],
  );

  const scheduleSelectionMenuPosition = useCallback(
    (transform?: [number, number, number]) => {
      if (transform) {
        transformRef.current = transform;
      } else {
        const viewport = getViewport();
        transformRef.current = [viewport.x, viewport.y, viewport.zoom];
      }
      if (selectionMenuRafRef.current !== null) {
        cancelAnimationFrame(selectionMenuRafRef.current);
      }

      selectionMenuRafRef.current = requestAnimationFrame(() => {
        selectionMenuRafRef.current = null;
        updateSelectionMenuPosition(transform);
      });
    },
    [getViewport, updateSelectionMenuPosition],
  );

  const refreshSelectionMenuLayout = useCallback(() => {
    if (layoutRefreshRafRef.current !== null) {
      cancelAnimationFrame(layoutRefreshRafRef.current);
    }

    layoutRefreshRafRef.current = requestAnimationFrame(() => {
      layoutRefreshRafRef.current = null;
      if (!measureSelectionMenuLayout()) return;
      const viewport = getViewport();
      const transform: [number, number, number] = [viewport.x, viewport.y, viewport.zoom];
      transformRef.current = transform;
      updateSelectionMenuPosition(transform);
    });
  }, [getViewport, measureSelectionMenuLayout, updateSelectionMenuPosition]);

  useLayoutEffect(() => {
    selectionBoundsRef.current = computeSelectionBounds(selectedNodes);
    if (showSelectionMenu) {
      if (!selectionMenuLayoutRef.current) {
        measureSelectionMenuLayout();
      }
      scheduleSelectionMenuPosition();
    } else {
      selectionMenuLayoutRef.current = null;
    }
  }, [
    computeSelectionBounds,
    measureSelectionMenuLayout,
    scheduleSelectionMenuPosition,
    selectedNodes,
    showSelectionMenu,
  ]);

  useEffect(() => {
    if (!showSelectionMenu) return;

    const handleResize = () => refreshSelectionMenuLayout();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [refreshSelectionMenuLayout, showSelectionMenu]);

  useEffect(() => {
    if (!showSelectionMenu || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(refreshSelectionMenuLayout);
    const wrapper = canvasWrapperRef.current;
    const menu = selectionMenuRef.current;
    if (wrapper) observer.observe(wrapper);
    if (menu) observer.observe(menu);

    return () => observer.disconnect();
  }, [canvasWrapperRef, refreshSelectionMenuLayout, showSelectionMenu]);

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

      refreshSelectionMenuLayout();
      window.clearTimeout(transitionTimer);
      transitionTimer = window.setTimeout(refreshSelectionMenuLayout, 520);
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
  }, [refreshSelectionMenuLayout, showSelectionMenu]);

  useEffect(
    () => () => {
      if (selectionMenuRafRef.current !== null) {
        cancelAnimationFrame(selectionMenuRafRef.current);
      }
      if (layoutRefreshRafRef.current !== null) {
        cancelAnimationFrame(layoutRefreshRafRef.current);
      }
    },
    [],
  );

  const handleViewportMove = useCallback(
    (_event: unknown, viewport: { x: number; y: number; zoom: number }) => {
      transformRef.current = [viewport.x, viewport.y, viewport.zoom];
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
