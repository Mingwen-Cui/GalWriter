import type { Edge, Node } from '@xyflow/react';
import { MarkerType } from '@xyflow/react';
import { useMemo } from 'react';

interface HighlightedPath {
  nodes: Set<string>;
  edges: Set<string>;
  edgeColors: Map<string, string[]>;
}

interface UseGraphPresentationParams {
  nodes: Node[];
  edges: Edge[];
  nodeRenderData: Record<string, unknown>;
  aiLoadingNodeId: string | null;
  highlightedPath: HighlightedPath | null;
  edgeStyle: 'step' | 'bezier';
  edgeColor: string;
  arrowSize: number;
  arrowCornerRadius: number;
  arrowTipAngle: number;
  isMobile: boolean;
  onDeleteEdge: (edgeId: string) => void;
  onReverseEdge: (edge: Edge) => void;
}

export function useGraphPresentation({
  nodes,
  edges,
  nodeRenderData,
  aiLoadingNodeId,
  highlightedPath,
  edgeStyle,
  edgeColor,
  arrowSize,
  arrowCornerRadius,
  arrowTipAngle,
  isMobile,
  onDeleteEdge,
  onReverseEdge,
}: UseGraphPresentationParams) {
  const renderedNodes = useMemo<Node[]>(
    () =>
      nodes.map((node) => {
        const isHighlighted = highlightedPath?.nodes.has(node.id);
        return {
          ...node,
          hidden: !!node.data?.hidden,
          draggable: !node.data?.locked,
          selectable: !node.data?.locked,
          data: {
            ...node.data,
            ...nodeRenderData,
            isAILoading: aiLoadingNodeId === node.id,
            isHighlighted,
          },
          style: {
            ...node.style,
            opacity: highlightedPath ? (isHighlighted ? 1 : 0.15) : 1,
            filter: highlightedPath && !isHighlighted ? 'grayscale(0.8) blur(1px)' : 'none',
            transition: 'opacity 0.5s ease-in-out, filter 0.5s ease-in-out',
          },
        };
      }),
    [aiLoadingNodeId, highlightedPath, nodeRenderData, nodes],
  );

  const renderedEdges = useMemo(() => {
    const hiddenNodeIds = new Set(nodes.filter((node) => node.data?.hidden).map((node) => node.id));

    return edges.map((edge) => {
      const isHighlighted = highlightedPath?.edges.has(edge.id);
      const highlightColors = highlightedPath?.edgeColors.get(edge.id) || ['#f43f5e'];
      const highlightColor = highlightColors[0] || '#f43f5e';
      const isHiddenByNode = hiddenNodeIds.has(edge.source) || hiddenNodeIds.has(edge.target);
      const markerEnd =
        typeof edge.markerEnd === 'object' && edge.markerEnd ? edge.markerEnd : {};

      return {
        ...edge,
        hidden: isHiddenByNode,
        type: 'customEdge',
        markerEnd: {
          ...markerEnd,
          type: MarkerType.ArrowClosed,
          width: arrowSize,
          height: arrowSize,
          color: isHighlighted ? highlightColor : edgeColor,
        },
        data: {
          ...edge.data,
          edgeStyle,
          arrowSize,
          arrowCornerRadius,
          arrowTipAngle,
          edgeColor: isHighlighted ? highlightColor : edgeColor,
          edgeColors: isHighlighted ? highlightColors : undefined,
          onDelete: onDeleteEdge,
          onReverse: () => onReverseEdge(edge),
          isHighlighted,
          isMobile,
        },
        style: {
          ...edge.style,
          stroke: isHighlighted ? highlightColor : edgeColor,
          strokeWidth: isHighlighted ? 6 : edge.style?.strokeWidth || 3,
          opacity: highlightedPath ? (isHighlighted ? 1 : 0.1) : 1,
          transition:
            'stroke 0.5s ease-in-out, stroke-width 0.5s ease-in-out, opacity 0.5s ease-in-out',
        },
        animated: highlightedPath ? false : edge.animated,
      };
    });
  }, [
    arrowCornerRadius,
    arrowSize,
    arrowTipAngle,
    edgeColor,
    edges,
    edgeStyle,
    highlightedPath,
    isMobile,
    nodes,
    onDeleteEdge,
    onReverseEdge,
  ]);

  return { nodesWithCallbacks: renderedNodes, edgesWithData: renderedEdges };
}
