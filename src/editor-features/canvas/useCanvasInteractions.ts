import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
} from '@xyflow/react';
import type {
  Dispatch,
  MouseEvent as ReactMouseEvent,
  MutableRefObject,
  SetStateAction,
  TouchEvent as ReactTouchEvent,
} from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface UseCanvasInteractionsParams {
  nodes: Node[];
  interactionMode: 'select' | 'box';
  selectionBoxRef: MutableRefObject<HTMLDivElement | null>;
  screenToFlowPosition: (position: { x: number; y: number }) => { x: number; y: number };
  getIntersectingNodes: (
    rect: { x: number; y: number; width: number; height: number },
    partially?: boolean,
  ) => Node[];
  setNodes: Dispatch<SetStateAction<Node[]>>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  setHorizontalGuides: Dispatch<SetStateAction<number[]>>;
  setVerticalGuides: Dispatch<SetStateAction<number[]>>;
  defaultEdgeOptions: Record<string, unknown>;
  handleDeleteNode: (id: string) => void;
  handleUpdateNode: (id: string, updates: Record<string, unknown>) => void;
}

const getConvexHull = (points: { x: number; y: number }[]) => {
  const crossProduct = (
    a: { x: number; y: number },
    b: { x: number; y: number },
    c: { x: number; y: number },
  ) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

  if (points.length <= 2) return points;
  const sorted = [...points].sort((a, b) => (a.x !== b.x ? a.x - b.x : a.y - b.y));
  const upper: { x: number; y: number }[] = [];
  for (const point of sorted) {
    while (
      upper.length >= 2 &&
      crossProduct(upper[upper.length - 2], upper[upper.length - 1], point) <= 0
    ) {
      upper.pop();
    }
    upper.push(point);
  }
  const lower: { x: number; y: number }[] = [];
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const point = sorted[index];
    while (
      lower.length >= 2 &&
      crossProduct(lower[lower.length - 2], lower[lower.length - 1], point) <= 0
    ) {
      lower.pop();
    }
    lower.push(point);
  }
  upper.pop();
  lower.pop();
  return upper.concat(lower);
};

export const useCanvasInteractions = ({
  nodes,
  interactionMode,
  selectionBoxRef,
  screenToFlowPosition,
  getIntersectingNodes,
  setNodes,
  setEdges,
  setHorizontalGuides,
  setVerticalGuides,
  defaultEdgeOptions,
  handleDeleteNode,
  handleUpdateNode,
}: UseCanvasInteractionsParams) => {
  const [isRightDragging, setIsRightDragging] = useState(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const snapDistance = 15;

      const positionChanges = changes.filter(
        (change: any) => change.type === 'position' && change.position,
      );
      const dimensionChanges = changes.filter(
        (change: any) => change.type === 'dimensions' && change.dimensions,
      );

      if (positionChanges.length === 0 && dimensionChanges.length === 0) {
        setNodes((nds) => applyNodeChanges(changes, nds));
        return;
      }

      setNodes((nds) => {
        const hLines: number[] = [];
        const vLines: number[] = [];
        const nodeMap = new Map(nds.map((node) => [node.id, node]));

        const updatedChanges = changes.map((change: any) => {
          if (change.type === 'position' && change.position) {
            const targetX = change.position.x;
            const targetY = change.position.y;
            let snapX = targetX;
            let snapY = targetY;
            let minDx = snapDistance;
            let minDy = snapDistance;

            const movingNode = nodeMap.get(change.id);
            if (!movingNode) return change;

            const movingW =
              movingNode.measured?.width || (movingNode.style?.width as number) || 300;
            const movingH =
              movingNode.measured?.height || (movingNode.style?.height as number) || 200;

            for (const node of nds) {
              if (node.id === change.id) continue;
              const nodeX = node.position.x;
              const nodeY = node.position.y;
              const nodeW = node.measured?.width || (node.style?.width as number) || 300;
              const nodeH = node.measured?.height || (node.style?.height as number) || 200;

              const xTargets = [nodeX, nodeX + nodeW];
              const movingXTargets = [targetX, targetX + movingW];
              for (const xt of xTargets) {
                for (const mxt of movingXTargets) {
                  const diff = Math.abs(xt - mxt);
                  if (diff < minDx) {
                    minDx = diff;
                    snapX = mxt === targetX ? xt : xt - movingW;
                    if (!vLines.includes(xt)) vLines.push(xt);
                  } else if (diff < snapDistance) {
                    if (!vLines.includes(xt)) vLines.push(xt);
                  }
                }
              }

              const yTargets = [nodeY, nodeY + nodeH];
              const movingYTargets = [targetY, targetY + movingH];
              for (const yt of yTargets) {
                for (const myt of movingYTargets) {
                  const diff = Math.abs(yt - myt);
                  if (diff < minDy) {
                    minDy = diff;
                    snapY = myt === targetY ? yt : yt - movingH;
                    if (!hLines.includes(yt)) hLines.push(yt);
                  } else if (diff < snapDistance) {
                    if (!hLines.includes(yt)) hLines.push(yt);
                  }
                }
              }
            }
            return {
              ...change,
              position: { x: snapX, y: snapY },
              positionAbsolute: change.positionAbsolute ? { x: snapX, y: snapY } : undefined,
            };
          }

          if (change.type === 'dimensions' && change.dimensions) {
            const targetNode = nodeMap.get(change.id);
            if (targetNode) {
              const x = targetNode.position.x;
              const y = targetNode.position.y;
              const width = change.dimensions.width;
              const height = change.dimensions.height;
              for (const node of nds) {
                if (node.id === change.id) continue;
                const nodeX = node.position.x;
                const nodeY = node.position.y;
                const nodeW = node.measured?.width || (node.style?.width as number) || 300;
                const nodeH = node.measured?.height || (node.style?.height as number) || 200;
                if (Math.abs(nodeX - x) < snapDistance && !vLines.includes(nodeX))
                  vLines.push(nodeX);
                if (Math.abs(nodeX + nodeW - x) < snapDistance && !vLines.includes(nodeX + nodeW))
                  vLines.push(nodeX + nodeW);
                if (Math.abs(nodeX - (x + width)) < snapDistance && !vLines.includes(nodeX))
                  vLines.push(nodeX);
                if (
                  Math.abs(nodeX + nodeW - (x + width)) < snapDistance &&
                  !vLines.includes(nodeX + nodeW)
                )
                  vLines.push(nodeX + nodeW);
                if (Math.abs(nodeY - y) < snapDistance && !hLines.includes(nodeY))
                  hLines.push(nodeY);
                if (Math.abs(nodeY + nodeH - y) < snapDistance && !hLines.includes(nodeY + nodeH))
                  hLines.push(nodeY + nodeH);
                if (Math.abs(nodeY - (y + height)) < snapDistance && !hLines.includes(nodeY))
                  hLines.push(nodeY);
                if (
                  Math.abs(nodeY + nodeH - (y + height)) < snapDistance &&
                  !hLines.includes(nodeY + nodeH)
                )
                  hLines.push(nodeY + nodeH);
              }
            }
          }
          return change;
        });

        const isInteracting = changes.some(
          (change: any) =>
            (change.type === 'position' && change.dragging) ||
            (change.type === 'dimensions' && change.resizing),
        );

        if (isInteracting) {
          setHorizontalGuides(hLines);
          setVerticalGuides(vLines);
        } else {
          setHorizontalGuides((prev) => (prev.length > 0 ? [] : prev));
          setVerticalGuides((prev) => (prev.length > 0 ? [] : prev));
        }

        return applyNodeChanges(updatedChanges, nds);
      });
    },
    [setHorizontalGuides, setNodes, setVerticalGuides],
  );

  const onEdgesChange = useCallback(
    (changes: any[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges],
  );

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) => addEdge({ ...connection, id: uuidv4(), ...defaultEdgeOptions }, eds)),
    [defaultEdgeOptions, setEdges],
  );

  const onEdgeContextMenu = useCallback(
    (event: ReactMouseEvent, edge: Edge) => {
      event.preventDefault();
      setEdges((eds) => eds.filter((item) => item.id !== edge.id));
    },
    [setEdges],
  );

  const onEdgeDoubleClick = useCallback(
    (_event: ReactMouseEvent, edge: Edge) => {
      setEdges((eds) =>
        eds.map((item) => {
          if (item.id !== edge.id) return item;
          return {
            ...item,
            source: item.target,
            target: item.source,
            sourceHandle: item.targetHandle,
            targetHandle: item.sourceHandle,
          };
        }),
      );
    },
    [setEdges],
  );

  const onNodeDragStop = useCallback(
    (_event: ReactMouseEvent, node: Node) => {
      const mediaUrl = node.data.imageUrl || node.data.videoUrl || node.data.audioUrl;
      if (node.type !== 'storyNode' || !mediaUrl) return;

      const nodeX = node.position.x;
      const nodeY = node.position.y;
      const sourceHasVisual = !!(node.data.imageUrl || node.data.videoUrl);
      const sourceHasAudio = !!node.data.audioUrl;
      const targetNode = nodes.find((candidate) => {
        const targetHasVisual = !!(candidate.data.imageUrl || candidate.data.videoUrl);
        const targetHasAudio = !!candidate.data.audioUrl;
        const canAttachMedia =
          (!targetHasVisual && !targetHasAudio) ||
          (sourceHasAudio && !targetHasAudio) ||
          (sourceHasVisual && !targetHasVisual);

        return (
          candidate.id !== node.id &&
          (candidate.type === 'storyNode' || candidate.type === 'aiNode') &&
          canAttachMedia &&
          nodeX > candidate.position.x &&
          nodeX < candidate.position.x + (candidate.measured?.width || 300) &&
          nodeY > candidate.position.y &&
          nodeY < candidate.position.y + (candidate.measured?.height || 200)
        );
      });

      if (!targetNode) return;

      if (targetNode.type === 'aiNode') {
        handleUpdateNode(targetNode.id, {
          imageUrl: node.data.imageUrl,
          videoUrl: node.data.videoUrl,
          objectFit: 'cover',
        });
      } else {
        setNodes((nds) =>
          nds.map((current) => {
            if (current.id !== targetNode.id) return current;
            return {
              ...current,
              data: {
                ...current.data,
                imageUrl: node.data.imageUrl || current.data.imageUrl || undefined,
                videoUrl: node.data.videoUrl || current.data.videoUrl || undefined,
                audioUrl: node.data.audioUrl || current.data.audioUrl || undefined,
                showTextOverlay: true,
              },
              style: {
                ...current.style,
                height:
                  (current.measured?.height || (current.style?.height as number) || 200) +
                  (sourceHasVisual ? 200 : 56),
              },
            };
          }),
        );
      }
      handleDeleteNode(node.id);
    },
    [handleDeleteNode, handleUpdateNode, nodes, setNodes],
  );

  const startSelection = useCallback(
    (x: number, y: number) => {
      setIsRightDragging(true);
      startPosRef.current = { x, y };
      if (selectionBoxRef.current) {
        selectionBoxRef.current.style.display = 'none';
        selectionBoxRef.current.style.width = '0px';
        selectionBoxRef.current.style.height = '0px';
      }
    },
    [selectionBoxRef],
  );

  const updateSelection = useCallback(
    (x: number, y: number) => {
      if (!(isRightDragging && startPosRef.current && selectionBoxRef.current)) return;

      const left = Math.min(x, startPosRef.current.x);
      const top = Math.min(y, startPosRef.current.y);
      const width = Math.abs(x - startPosRef.current.x);
      const height = Math.abs(y - startPosRef.current.y);

      selectionBoxRef.current.style.left = `${left}px`;
      selectionBoxRef.current.style.top = `${top}px`;
      selectionBoxRef.current.style.width = `${width}px`;
      selectionBoxRef.current.style.height = `${height}px`;

      if (width > 5 || height > 5) {
        selectionBoxRef.current.style.display = 'block';
      }
    },
    [isRightDragging, selectionBoxRef],
  );

  const endSelection = useCallback(
    (x: number, y: number) => {
      if (isRightDragging && startPosRef.current) {
        const dx = Math.abs(x - startPosRef.current.x);
        const dy = Math.abs(y - startPosRef.current.y);

        if (dx > 5 || dy > 5) {
          const start = screenToFlowPosition({
            x: startPosRef.current.x,
            y: startPosRef.current.y,
          });
          const end = screenToFlowPosition({ x, y });

          const rect = {
            x: Math.min(start.x, end.x),
            y: Math.min(start.y, end.y),
            width: Math.abs(start.x - end.x),
            height: Math.abs(start.y - end.y),
          };

          const nodesInRect = getIntersectingNodes(rect, true);
          const nodeIds = new Set(nodesInRect.map((node) => node.id));

          setNodes((nds) =>
            nds.map((node) => ({
              ...node,
              selected: nodeIds.has(node.id) && !node.data?.locked,
            })),
          );
        }
      }

      if (selectionBoxRef.current) {
        selectionBoxRef.current.style.display = 'none';
      }
      setIsRightDragging(false);
      startPosRef.current = null;
    },
    [getIntersectingNodes, isRightDragging, screenToFlowPosition, selectionBoxRef, setNodes],
  );

  const handleMouseDown = useCallback(
    (event: ReactMouseEvent) => {
      if (
        event.button !== 2 &&
        !(interactionMode === 'box' && event.button === 0) &&
        !(event.shiftKey && event.button === 0)
      ) {
        return;
      }
      const target = event.target as HTMLElement;
      if (target.closest('button, input, textarea, [contenteditable="true"]')) return;
      startSelection(event.clientX, event.clientY);
    },
    [interactionMode, startSelection],
  );

  const handleMouseMove = useCallback(
    (event: ReactMouseEvent) => {
      updateSelection(event.clientX, event.clientY);
    },
    [updateSelection],
  );

  const handleMouseUp = useCallback(
    (event: ReactMouseEvent) => {
      endSelection(event.clientX, event.clientY);
    },
    [endSelection],
  );

  const handleTouchStart = useCallback(
    (event: ReactTouchEvent) => {
      if (!(interactionMode === 'box' && event.touches.length === 1)) return;
      const target = event.target as HTMLElement;
      if (target.closest('button, input, textarea, [contenteditable="true"]')) return;
      const touch = event.touches[0];
      startSelection(touch.clientX, touch.clientY);
    },
    [interactionMode, startSelection],
  );

  const handleTouchMove = useCallback(
    (event: ReactTouchEvent) => {
      if (!(isRightDragging && event.touches.length === 1)) return;
      const touch = event.touches[0];
      updateSelection(touch.clientX, touch.clientY);
    },
    [isRightDragging, updateSelection],
  );

  const handleTouchEnd = useCallback(
    (event: ReactTouchEvent) => {
      if (!(isRightDragging && event.changedTouches.length > 0)) return;
      const touch = event.changedTouches[0];
      endSelection(touch.clientX, touch.clientY);
    },
    [endSelection, isRightDragging],
  );

  useEffect(() => {
    const handleGlobalContextMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('.react-flow')) {
        event.preventDefault();
      }
    };
    document.addEventListener('contextmenu', handleGlobalContextMenu);
    return () => document.removeEventListener('contextmenu', handleGlobalContextMenu);
  }, []);

  useEffect(() => {
    const groupNodes = nodes.filter((node) => node.type === 'groupNode');
    if (groupNodes.length === 0) return;

    const timer = window.setTimeout(() => {
      let hasChanges = false;
      const nextNodes = nodes.map((groupNode) => {
        if (groupNode.type !== 'groupNode') return groupNode;

        const childIds = (groupNode.data.childIds as string[]) || [];
        if (childIds.length === 0) return groupNode;

        const children = nodes.filter((node) => childIds.includes(node.id));
        if (children.length === 0) return groupNode;

        const points: { x: number; y: number }[] = [];
        const padding = 20;

        children.forEach((child) => {
          const { x, y } = child.position;
          const width =
            child.measured?.width ||
            (typeof child.style?.width === 'number' ? child.style.width : 300);
          const height =
            child.measured?.height ||
            (typeof child.style?.height === 'number' ? child.style.height : 200);

          points.push({ x: x - padding, y: y - padding });
          points.push({ x: x + width + padding, y: y - padding });
          points.push({ x: x + width + padding, y: y + height + padding });
          points.push({ x: x - padding, y: y + height + padding });
        });

        const hull = getConvexHull(points);

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        hull.forEach((point) => {
          minX = Math.min(minX, point.x);
          minY = Math.min(minY, point.y);
          maxX = Math.max(maxX, point.x);
          maxY = Math.max(maxY, point.y);
        });

        const targetX = Math.round(minX * 10) / 10;
        const targetY = Math.round(minY * 10) / 10;
        const targetW = Math.round((maxX - minX) * 10) / 10;
        const targetH = Math.round((maxY - minY) * 10) / 10;
        const relativeHull = hull.map((point) => ({
          x: Math.round((point.x - targetX) * 10) / 10,
          y: Math.round((point.y - targetY) * 10) / 10,
        }));

        const diffX = Math.abs(groupNode.position.x - targetX);
        const diffY = Math.abs(groupNode.position.y - targetY);
        const diffW = Math.abs(((groupNode.style?.width as number) || 0) - targetW);
        const diffH = Math.abs(((groupNode.style?.height as number) || 0) - targetH);

        let isHullDifferent = false;
        const oldHull = (groupNode.data.hullPoints as { x: number; y: number }[]) || [];
        if (oldHull.length !== relativeHull.length) {
          isHullDifferent = true;
        } else {
          for (let index = 0; index < oldHull.length; index += 1) {
            if (
              Math.abs(oldHull[index].x - relativeHull[index].x) > 2 ||
              Math.abs(oldHull[index].y - relativeHull[index].y) > 2
            ) {
              isHullDifferent = true;
              break;
            }
          }
        }

        if (diffX >= 2 || diffY >= 2 || diffW >= 2 || diffH >= 2 || isHullDifferent) {
          hasChanges = true;
          return {
            ...groupNode,
            position: { x: targetX, y: targetY },
            style: { ...groupNode.style, width: targetW, height: targetH },
            data: { ...groupNode.data, hullPoints: relativeHull },
          };
        }
        return groupNode;
      });

      if (hasChanges) {
        setNodes(nextNodes);
      }
    }, 100);

    return () => window.clearTimeout(timer);
  }, [nodes, setNodes]);

  return {
    isRightDragging,
    setIsRightDragging,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onEdgeContextMenu,
    onEdgeDoubleClick,
    onNodeDragStop,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    canvasTouchAction: interactionMode === 'box' || isRightDragging ? 'none' : 'auto',
  };
};
