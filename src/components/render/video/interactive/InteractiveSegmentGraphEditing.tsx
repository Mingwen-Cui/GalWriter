import type { RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import type { GraphPoint } from './interactiveSegmentGraphLayout';
import type { InteractiveSegmentDraft } from './interactiveSegments';

export type ConnectionSide = 'top' | 'right' | 'bottom' | 'left';

type ConnectionDragState = {
  fromSegmentId: string;
  fromSide: ConnectionSide;
  pointer: GraphPoint;
};

type SelectionBoxState = {
  start: GraphPoint;
  current: GraphPoint;
};

type UseGraphEditingArgs = {
  segments: InteractiveSegmentDraft[];
  renderPositions: Map<string, GraphPoint>;
  cardWidth: number;
  cardHeight: number;
  viewportPan: GraphPoint;
  viewportZoom: number;
  graphViewportRef: RefObject<HTMLDivElement | null>;
  onSegmentsChange: (segments: InteractiveSegmentDraft[]) => void;
  onSelectSegment: (id: string) => void;
  setManualPositions: React.Dispatch<React.SetStateAction<Record<string, GraphPoint>>>;
};

const connectionSides: ConnectionSide[] = ['top', 'right', 'bottom', 'left'];

const segmentHandlePoint = (
  position: GraphPoint,
  width: number,
  height: number,
  side: ConnectionSide,
): GraphPoint => {
  if (side === 'top') return { x: position.x + width / 2, y: position.y };
  if (side === 'bottom') return { x: position.x + width / 2, y: position.y + height };
  if (side === 'left') return { x: position.x, y: position.y + height / 2 };
  return { x: position.x + width, y: position.y + height / 2 };
};

const updateSegment = (
  segments: InteractiveSegmentDraft[],
  id: string,
  updater: (segment: InteractiveSegmentDraft) => InteractiveSegmentDraft,
) => segments.map((segment) => (segment.id === id ? updater(segment) : segment));

export function useInteractiveSegmentGraphEditing({
  segments,
  renderPositions,
  cardWidth,
  cardHeight,
  viewportPan,
  viewportZoom,
  graphViewportRef,
  onSegmentsChange,
  onSelectSegment,
  setManualPositions,
}: UseGraphEditingArgs) {
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<string[]>([]);
  const [selectionBox, setSelectionBox] = useState<SelectionBoxState | null>(null);
  const [connectionDrag, setConnectionDrag] = useState<ConnectionDragState | null>(null);
  const selectionDragRef = useRef<{ pointerId: number; start: GraphPoint } | null>(null);
  const connectionDragRef = useRef<ConnectionDragState | null>(null);

  const graphPointFromClient = (clientX: number, clientY: number): GraphPoint => {
    const rect = graphViewportRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - viewportPan.x) / viewportZoom,
      y: (clientY - rect.top - viewportPan.y) / viewportZoom,
    };
  };

  const addSegmentConnection = (fromSegmentId: string, toSegmentId: string) => {
    if (fromSegmentId === toSegmentId) return;
    const target = segments.find((segment) => segment.id === toSegmentId);
    if (!target) return;
    onSegmentsChange(
      updateSegment(segments, fromSegmentId, (segment) => {
        if (segment.choices.some((choice) => choice.targetSegmentId === toSegmentId)) return segment;
        const nextIndex = segment.choices.length + 1;
        return {
          ...segment,
          source: 'edited',
          choices: [
            ...segment.choices,
            {
              id: `${segment.id}-choice-${uuidv4()}`,
              label: `Choice ${nextIndex}`,
              targetSegmentId: target.id,
              targetNodeId: target.nodeIds[0] || '',
            },
          ],
        };
      }),
    );
  };

  const deleteSegmentConnection = (fromSegmentId: string, choiceId: string) => {
    onSegmentsChange(
      updateSegment(segments, fromSegmentId, (segment) => ({
        ...segment,
        source: 'edited',
        choices: segment.choices.filter((choice) => choice.id !== choiceId),
      })),
    );
  };

  const reverseSegmentConnection = (fromSegmentId: string, toSegmentId: string, choiceId: string, label: string) => {
    const fromSegment = segments.find((segment) => segment.id === fromSegmentId);
    const toSegment = segments.find((segment) => segment.id === toSegmentId);
    if (!fromSegment || !toSegment || fromSegmentId === toSegmentId) return;
    onSegmentsChange(
      segments.map((segment) => {
        if (segment.id === fromSegmentId) {
          return {
            ...segment,
            source: 'edited' as const,
            choices: segment.choices.filter((choice) => choice.id !== choiceId),
          };
        }
        if (segment.id === toSegmentId) {
          if (segment.choices.some((choice) => choice.targetSegmentId === fromSegmentId)) return segment;
          return {
            ...segment,
            source: 'edited' as const,
            choices: [
              ...segment.choices,
              {
                id: `${segment.id}-choice-${uuidv4()}`,
                label: label.trim() || `Choice ${segment.choices.length + 1}`,
                targetSegmentId: fromSegment.id,
                targetNodeId: fromSegment.nodeIds[0] || '',
              },
            ],
          };
        }
        return segment;
      }),
    );
    onSelectSegment(toSegmentId);
  };

  const beginConnectionDrag = (
    event: React.PointerEvent<HTMLButtonElement>,
    segmentId: string,
    side: ConnectionSide,
  ) => {
    if (event.button !== 0) return;
    const next = {
      fromSegmentId: segmentId,
      fromSide: side,
      pointer: graphPointFromClient(event.clientX, event.clientY),
    };
    connectionDragRef.current = next;
    setConnectionDrag(next);
    event.stopPropagation();
  };

  const beginSelectionDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = graphPointFromClient(event.clientX, event.clientY);
    selectionDragRef.current = { pointerId: event.pointerId, start };
    setSelectionBox({ start, current: start });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const updateSelectionDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = selectionDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return false;
    setSelectionBox({ start: drag.start, current: graphPointFromClient(event.clientX, event.clientY) });
    return true;
  };

  const endSelectionDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = selectionDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return false;
    const end = graphPointFromClient(event.clientX, event.clientY);
    const minX = Math.min(drag.start.x, end.x);
    const maxX = Math.max(drag.start.x, end.x);
    const minY = Math.min(drag.start.y, end.y);
    const maxY = Math.max(drag.start.y, end.y);
    const selected = segments
      .filter((segment) => {
        const position = renderPositions.get(segment.id);
        if (!position) return false;
        return position.x < maxX && position.x + cardWidth > minX && position.y < maxY && position.y + cardHeight > minY;
      })
      .map((segment) => segment.id);
    setSelectedSegmentIds(selected);
    if (selected.length === 1) onSelectSegment(selected[0]);
    selectionDragRef.current = null;
    setSelectionBox(null);
    return true;
  };

  const mergeSelectedSegments = () => {
    if (selectedSegmentIds.length < 2) return;
    const selectedSet = new Set(selectedSegmentIds);
    const selectedSegments = segments.filter((segment) => selectedSet.has(segment.id));
    if (selectedSegments.length < 2) return;
    const primary = selectedSegments[0];
    const mergedNodeIds = selectedSegments.flatMap((segment) => segment.nodeIds);
    const mergedChoices = selectedSegments
      .flatMap((segment) => segment.choices)
      .filter((choice) => !selectedSet.has(choice.targetSegmentId))
      .filter((choice, index, choices) => choices.findIndex((item) => item.targetSegmentId === choice.targetSegmentId) === index)
      .map((choice, index) => ({ ...choice, id: `${primary.id}-choice-${index + 1}-${uuidv4()}` }));
    const nextSegments = segments
      .filter((segment) => !selectedSet.has(segment.id) || segment.id === primary.id)
      .map((segment) => {
        if (segment.id === primary.id) {
          return {
            ...segment,
            source: 'edited' as const,
            name: `${primary.name} + ${selectedSegments.length - 1}`,
            nodeIds: mergedNodeIds,
            choices: mergedChoices,
          };
        }
        return {
          ...segment,
          source: 'edited' as const,
          choices: segment.choices.map((choice) =>
            selectedSet.has(choice.targetSegmentId)
              ? { ...choice, targetSegmentId: primary.id, targetNodeId: primary.nodeIds[0] || choice.targetNodeId }
              : choice,
          ),
        };
      });
    onSegmentsChange(nextSegments);
    setSelectedSegmentIds([primary.id]);
    setManualPositions((previous) => {
      const next = { ...previous };
      selectedSegmentIds.forEach((id) => {
        if (id !== primary.id) delete next[id];
      });
      return next;
    });
    onSelectSegment(primary.id);
  };

  useEffect(() => {
    if (!connectionDrag) return;
    const handlePointerMove = (event: PointerEvent) => {
      const current = connectionDragRef.current;
      if (!current) return;
      const next = { ...current, pointer: graphPointFromClient(event.clientX, event.clientY) };
      connectionDragRef.current = next;
      setConnectionDrag(next);
    };
    const handlePointerUp = (event: PointerEvent) => {
      const current = connectionDragRef.current;
      connectionDragRef.current = null;
      setConnectionDrag(null);
      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>('[data-segment-handle-id]');
      const targetSegmentId = target?.dataset.segmentId;
      if (current && targetSegmentId) addSegmentConnection(current.fromSegmentId, targetSegmentId);
    };
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp, { once: true });
    document.addEventListener('pointercancel', handlePointerUp, { once: true });
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [connectionDrag, graphPointFromClient]);

  return {
    selectedSegmentIds,
    selectionBox,
    connectionDrag,
    beginConnectionDrag,
    beginSelectionDrag,
    updateSelectionDrag,
    endSelectionDrag,
    deleteSegmentConnection,
    reverseSegmentConnection,
    mergeSelectedSegments,
  };
}

export function SegmentConnectionHandles({
  segmentId,
  position,
  cardWidth,
  cardHeight,
  onBeginConnection,
}: {
  segmentId: string;
  position: GraphPoint;
  cardWidth: number;
  cardHeight: number;
  onBeginConnection: (event: React.PointerEvent<HTMLButtonElement>, segmentId: string, side: ConnectionSide) => void;
}) {
  return (
    <>
      {connectionSides.map((side) => {
        const point = segmentHandlePoint(position, cardWidth, cardHeight, side);
        return (
          <button
            key={side}
            type="button"
            data-segment-handle-id={`${segmentId}-${side}`}
            data-segment-id={segmentId}
            className={`interactive-segment-handle interactive-segment-handle-${side}`}
            style={{ left: point.x, top: point.y }}
            onPointerDown={(event) => onBeginConnection(event, segmentId, side)}
            aria-label={`Connect ${segmentId} ${side}`}
          />
        );
      })}
    </>
  );
}

export function GraphEditingOverlays({
  selectionBox,
  connectionDrag,
  renderPositions,
  cardWidth,
  cardHeight,
}: {
  selectionBox: SelectionBoxState | null;
  connectionDrag: ConnectionDragState | null;
  renderPositions: Map<string, GraphPoint>;
  cardWidth: number;
  cardHeight: number;
}) {
  const fromPosition = connectionDrag ? renderPositions.get(connectionDrag.fromSegmentId) : undefined;
  const fromPoint =
    connectionDrag && fromPosition
      ? segmentHandlePoint(fromPosition, cardWidth, cardHeight, connectionDrag.fromSide)
      : null;
  const selectionRect = selectionBox
    ? {
        x: Math.min(selectionBox.start.x, selectionBox.current.x),
        y: Math.min(selectionBox.start.y, selectionBox.current.y),
        width: Math.abs(selectionBox.current.x - selectionBox.start.x),
        height: Math.abs(selectionBox.current.y - selectionBox.start.y),
      }
    : null;

  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
      {fromPoint && connectionDrag && (
        <path
          d={`M${fromPoint.x},${fromPoint.y} L${connectionDrag.pointer.x},${connectionDrag.pointer.y}`}
          className="stroke-[var(--vr-accent)]"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="8 7"
        />
      )}
      {selectionRect && selectionRect.width > 2 && selectionRect.height > 2 && (
        <rect
          x={selectionRect.x}
          y={selectionRect.y}
          width={selectionRect.width}
          height={selectionRect.height}
          className="fill-[var(--vr-accent)] stroke-[var(--vr-accent)]"
          fillOpacity="0.1"
          strokeOpacity="0.65"
          strokeWidth="1.5"
          strokeDasharray="6 5"
        />
      )}
    </svg>
  );
}
