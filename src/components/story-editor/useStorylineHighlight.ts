import type { Edge, Node } from '@xyflow/react';
import { useCallback } from 'react';

import type { Language } from '../../lib/i18n';

// ---------------------------------------------------------------------------
// Params

interface UseStorylineHighlightParams {
  nodes: Node[];
  edges: Edge[];
  highlightedPath: {
    nodes: Set<string>;
    edges: Set<string>;
    edgeColors: Map<string, string[]>;
  } | null;
  setHighlightedPath: React.Dispatch<
    React.SetStateAction<{
      nodes: Set<string>;
      edges: Set<string>;
      edgeColors: Map<string, string[]>;
    } | null>
  >;
  language: Language;
  showToast: (message: string, tone?: 'success' | 'error') => void;
}

// ---------------------------------------------------------------------------
// Hook

export function useStorylineHighlight({
  nodes,
  edges,
  highlightedPath,
  setHighlightedPath,
  language,
  showToast,
}: UseStorylineHighlightParams) {
  const toggleStorylineHighlight = useCallback(
    (nodeId: string | null) => {
      if (
        !nodeId ||
        (highlightedPath &&
          nodes.find((n) => n.id === nodeId)?.selected &&
          highlightedPath.nodes.has(nodeId))
      ) {
        setHighlightedPath(null);
        return;
      }

      const pathNodes = new Set<string>();
      const pathEdges = new Set<string>();
      const pathEdgeColors = new Map<string, string[]>();
      const nodeById = new Map(nodes.map((node) => [node.id, node]));
      const incomingEdgesByTarget = new Map<string, typeof edges>();
      const outgoingEdgesBySource = new Map<string, typeof edges>();
      const storylineBranchColors = [
        '#f43f5e',
        '#14b8a6',
        '#f59e0b',
        '#8b5cf6',
        '#06b6d4',
        '#84cc16',
        '#ec4899',
        '#6366f1',
      ];
      const defaultStorylineColor = storylineBranchColors[0];

      edges.forEach((edge) => {
        const incoming = incomingEdgesByTarget.get(edge.target) || [];
        incoming.push(edge);
        incomingEdgesByTarget.set(edge.target, incoming);

        const outgoing = outgoingEdgesBySource.get(edge.source) || [];
        outgoing.push(edge);
        outgoingEdgesBySource.set(edge.source, outgoing);
      });

      const maxSerialSumByNodeId = new Map<string, number>();
      const visitingSumNodes = new Set<string>();
      const getMaxSerialSumToNode = (id: string): number => {
        const cached = maxSerialSumByNodeId.get(id);
        if (typeof cached === 'number') return cached;
        if (visitingSumNodes.has(id)) return 0;

        visitingSumNodes.add(id);
        const node = nodeById.get(id);
        const ownValue =
          node && typeof node.data.nodeValue === 'number' && Number.isFinite(node.data.nodeValue)
            ? node.data.nodeValue
            : 0;
        const incomingEdges = incomingEdgesByTarget.get(id) || [];
        const maxUpstreamValue = incomingEdges.reduce(
          (maxValue, edge) => Math.max(maxValue, getMaxSerialSumToNode(edge.source)),
          0,
        );
        const total = ownValue + maxUpstreamValue;
        visitingSumNodes.delete(id);
        maxSerialSumByNodeId.set(id, total);
        return total;
      };

      const getNumberConditionInputTotal = (conditionNodeId: string) => {
        const directIncomingEdges = incomingEdgesByTarget.get(conditionNodeId) || [];
        return directIncomingEdges.reduce(
          (maxValue, edge) => Math.max(maxValue, getMaxSerialSumToNode(edge.source)),
          0,
        );
      };

      const getMaxSerialIncomingEdges = (id: string) => {
        const incomingEdges = incomingEdgesByTarget.get(id) || [];
        if (incomingEdges.length <= 1) return incomingEdges;
        const maxUpstreamValue = incomingEdges.reduce(
          (maxValue, edge) => Math.max(maxValue, getMaxSerialSumToNode(edge.source)),
          0,
        );
        return incomingEdges.filter(
          (edge) => getMaxSerialSumToNode(edge.source) === maxUpstreamValue,
        );
      };

      const getNumberConditionSourceHandleForTotal = (conditionNodeId: string, total: number) => {
        const currentNode = nodeById.get(conditionNodeId);
        if (currentNode?.type !== 'numberConditionNode') return null;

        const ranges =
          (currentNode.data.ranges as { id: string; min: number; max: number }[]) || [];
        const matchedRange = ranges.find(
          (range) => range.min <= range.max && total >= range.min && total <= range.max,
        );
        const threshold = (currentNode.data.threshold as number) || 0;
        return matchedRange
          ? `out-range-${matchedRange.id}`
          : total >= threshold
            ? 'out-greater'
            : 'out-less-equal';
      };

      const getActiveNumberConditionSourceHandle = (conditionNodeId: string) =>
        getNumberConditionSourceHandleForTotal(
          conditionNodeId,
          getNumberConditionInputTotal(conditionNodeId),
        );

      const getNodeValue = (id: string) => {
        const value = nodeById.get(id)?.data.nodeValue;
        return typeof value === 'number' && Number.isFinite(value) ? value : 0;
      };

      const getBranchColor = (branchIndex: number, currentPathColor: string) => {
        if (branchIndex <= 0) return currentPathColor;
        const alternateColors = storylineBranchColors.filter((item) => item !== currentPathColor);
        return alternateColors[(branchIndex - 1) % alternateColors.length];
      };

      type UpstreamTraceState = {
        nodes: string[];
        edges: Edge[];
        total: number;
      };

      const upstreamTraceStateCache = new Map<string, UpstreamTraceState[]>();
      const getUpstreamTraceStatesToNode = (
        id: string,
        visiting = new Set<string>(),
      ): UpstreamTraceState[] => {
        const cached = upstreamTraceStateCache.get(id);
        if (cached) return cached;
        if (visiting.has(id)) return [];

        visiting.add(id);
        const incomingEdges = incomingEdgesByTarget.get(id) || [];
        const ownValue = getNodeValue(id);
        const states =
          incomingEdges.length === 0
            ? [{ nodes: [id], edges: [], total: ownValue }]
            : incomingEdges.flatMap((edge) => {
                const sourceNode = nodeById.get(edge.source);
                if (sourceNode?.type === 'numberConditionNode') {
                  const requiredHandle =
                    edge.sourceHandle || getActiveNumberConditionSourceHandle(edge.source);
                  return getNumberConditionInputStatesForHandle(
                    edge.source,
                    requiredHandle,
                    new Set(visiting),
                  ).map((state) => ({
                    nodes: [...state.nodes, id],
                    edges: [...state.edges, edge],
                    total: state.total + ownValue,
                  }));
                }

                return getUpstreamTraceStatesToNode(edge.source, new Set(visiting)).map(
                  (state) => ({
                    nodes: [...state.nodes, id],
                    edges: [...state.edges, edge],
                    total: state.total + ownValue,
                  }),
                );
              });

        visiting.delete(id);
        upstreamTraceStateCache.set(id, states);
        return states;
      };

      const getNumberConditionInputStatesForHandle = (
        conditionNodeId: string,
        requiredHandle: string | null | undefined,
        visiting = new Set<string>(),
      ): UpstreamTraceState[] => {
        if (!requiredHandle || visiting.has(conditionNodeId)) return [];

        visiting.add(conditionNodeId);
        const states = (incomingEdgesByTarget.get(conditionNodeId) || []).flatMap((edge) =>
          getUpstreamTraceStatesToNode(edge.source, new Set(visiting))
            .filter(
              (state) =>
                getNumberConditionSourceHandleForTotal(conditionNodeId, state.total) ===
                requiredHandle,
            )
            .map((state) => ({
              nodes: [...state.nodes, conditionNodeId],
              edges: [...state.edges, edge],
              total: state.total,
            })),
        );
        visiting.delete(conditionNodeId);
        return states;
      };

      const addPathNode = (id: string, color = defaultStorylineColor) => {
        pathNodes.add(id);
      };

      const addPathEdge = (edge: Edge, color = defaultStorylineColor) => {
        pathEdges.add(edge.id);
        const colors = pathEdgeColors.get(edge.id) || [];
        if (!colors.includes(color)) {
          pathEdgeColors.set(edge.id, [...colors, color]);
        }
      };

      const addUpstreamTraceState = (state: UpstreamTraceState, color: string) => {
        state.nodes.forEach((stateNodeId) => addPathNode(stateNodeId, color));
        state.edges.forEach((stateEdge) => addPathEdge(stateEdge, color));
      };

      const traceUp = (id: string, maxSerialOnly = false, color = defaultStorylineColor) => {
        if (pathNodes.has(id)) return;
        addPathNode(id, color);
        const currentNode = nodeById.get(id);
        const shouldUseMaxSerialInput =
          maxSerialOnly || currentNode?.type === 'numberConditionNode';
        const incomingEdges = shouldUseMaxSerialInput
          ? getMaxSerialIncomingEdges(id)
          : incomingEdgesByTarget.get(id) || [];

        incomingEdges.forEach((edge, index) => {
          const sourceNode = nodeById.get(edge.source);
          if (sourceNode?.type === 'numberConditionNode') {
            addPathNode(edge.source, color);
            const requiredHandle =
              edge.sourceHandle || getActiveNumberConditionSourceHandle(edge.source);
            getNumberConditionInputStatesForHandle(edge.source, requiredHandle).forEach(
              (state, stateIndex) => {
                const stateColor = getBranchColor(index + stateIndex, color);
                addPathEdge(edge, stateColor);
                addUpstreamTraceState(state, stateColor);
              },
            );
            return;
          }

          addPathEdge(edge, color);
          traceUp(edge.source, shouldUseMaxSerialInput, color);
        });
      };

      const traceDown = (id: string) => {
        const visited = new Set<string>();
        const queue = [
          {
            id,
            color: defaultStorylineColor,
            total: nodeById.get(id)?.type === 'numberConditionNode' ? 0 : getNodeValue(id),
          },
        ];
        addPathNode(id);

        while (queue.length > 0) {
          const { id: currentId, color, total } = queue.shift()!;
          const visitKey = `${currentId}:${total}:${color}`;
          if (visited.has(visitKey)) continue;
          visited.add(visitKey);
          addPathNode(currentId, color);

          const currentNode = nodeById.get(currentId);
          const outgoingEdges =
            currentNode?.type === 'numberConditionNode'
              ? (outgoingEdgesBySource.get(currentId) || []).filter(
                  (edge) =>
                    edge.sourceHandle === getNumberConditionSourceHandleForTotal(currentId, total),
                )
              : outgoingEdgesBySource.get(currentId) || [];

          outgoingEdges.forEach((edge, index) => {
            const edgeColor =
              currentNode?.type === 'numberConditionNode' ? color : getBranchColor(index, color);
            const targetNode = nodeById.get(edge.target);
            const nextTotal =
              targetNode?.type === 'numberConditionNode'
                ? total
                : total + getNodeValue(edge.target);
            addPathEdge(edge, edgeColor);
            if (!visited.has(`${edge.target}:${nextTotal}:${edgeColor}`)) {
              queue.push({ id: edge.target, color: edgeColor, total: nextTotal });
            }
          });
        }
      };

      traceUp(nodeId);
      traceDown(nodeId);

      setHighlightedPath({
        nodes: pathNodes,
        edges: pathEdges,
        edgeColors: pathEdgeColors,
      });
      showToast(language === 'zh' ? '已追踪当前故事线' : 'Storyline traced');
    },
    [nodes, edges, highlightedPath, language, showToast],
  );

  return { toggleStorylineHighlight };
}
