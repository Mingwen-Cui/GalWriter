import type { Node as FlowNode } from '@xyflow/react';
import type { Dispatch, DragEvent, MutableRefObject, SetStateAction } from 'react';

import { makeTrackId } from '../controls/RenderControls';
import { clamp } from '../shared/mediaUtils';
import type { TimelineSegmentMetric } from '../shared/types';
import type { VideoTimelineMetrics } from './timelineMetrics';
import { isAudioOnlyNode } from './timelineTrackLayout';

type TrackKind = 'video' | 'audio';
type DataOverrides = Record<string, Record<string, unknown>>;

export const useTimelineDragDrop = ({
  timelineIds,
  selectedAssetIds,
  assetNodeById,
  timelineNodeById,
  timelineMetricById,
  timelineMetrics,
  videoTrackIds,
  audioTrackIds,
  activePreviewId,
  activeTimelineTime,
  defaultSeconds,
  speed,
  preservePreviewTimeOnNodeChangeRef,
  closeContextMenu,
  pushTimelineHistory,
  getNodeMediaDuration,
  makeTimelineClipInstanceId,
  getTimelinePlaceholderOverrides,
  snapTimelineTime,
  snapToTimelineClipEdges,
  findNonOverlappingTrackStart,
  getAudioDropTrackId,
  assignAudioTrackForVideoPlacement,
  addNodeToTimeline,
  setTimelineIds,
  setTimelineSourceById,
  setTimelineStartById,
  setTimelineDurationById,
  setTimelineDataOverrides,
  setVideoTrackByNodeId,
  setAudioTrackByNodeId,
  setSelectedIds,
  setActivePreviewId,
  setPreviewTime,
  setTimelinePreviewTime,
}: {
  timelineIds: string[];
  selectedAssetIds: string[];
  assetNodeById: Map<string, FlowNode>;
  timelineNodeById: Map<string, FlowNode>;
  timelineMetricById: Map<string, TimelineSegmentMetric>;
  timelineMetrics: VideoTimelineMetrics;
  videoTrackIds: string[];
  audioTrackIds: string[];
  activePreviewId: string;
  activeTimelineTime: number;
  defaultSeconds: number;
  speed: number;
  preservePreviewTimeOnNodeChangeRef: MutableRefObject<boolean>;
  closeContextMenu: () => void;
  pushTimelineHistory: () => void;
  getNodeMediaDuration: (node: FlowNode) => Promise<number>;
  makeTimelineClipInstanceId: (sourceId: string) => string;
  getTimelinePlaceholderOverrides: (node?: FlowNode | null) => Record<string, unknown>;
  snapTimelineTime: (time: number) => number;
  snapToTimelineClipEdges: (
    nodeId: string,
    wantedStart: number,
    duration: number,
    excludedNodeIds?: Iterable<string>,
  ) => number;
  findNonOverlappingTrackStart: (
    nodeId: string,
    wantedStart: number,
    duration: number,
    trackKind: TrackKind,
    trackId: string,
  ) => number;
  getAudioDropTrackId: (
    nodeId: string,
    start: number,
    duration: number,
    preferredTrackId?: string,
  ) => string;
  assignAudioTrackForVideoPlacement: (
    nodeId: string,
    start: number,
    duration: number,
    videoTrackId: string,
  ) => void;
  addNodeToTimeline: (
    id: string,
    trackKind?: TrackKind,
    trackId?: string,
    startTime?: number,
  ) => void;
  setTimelineIds: Dispatch<SetStateAction<string[]>>;
  setTimelineSourceById: Dispatch<SetStateAction<Record<string, string>>>;
  setTimelineStartById: Dispatch<SetStateAction<Record<string, number>>>;
  setTimelineDurationById: Dispatch<SetStateAction<Record<string, number>>>;
  setTimelineDataOverrides: Dispatch<SetStateAction<DataOverrides>>;
  setVideoTrackByNodeId: Dispatch<SetStateAction<Record<string, string>>>;
  setAudioTrackByNodeId: Dispatch<SetStateAction<Record<string, string>>>;
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>;
  setActivePreviewId: Dispatch<SetStateAction<string>>;
  setPreviewTime: Dispatch<SetStateAction<number>>;
  setTimelinePreviewTime: Dispatch<SetStateAction<number>>;
}) => {
  const reorderTimelineNode = (
    dragId: string,
    targetId: string,
    placement: 'before' | 'after' = 'before',
  ) => {
    if (!dragId || !targetId || dragId === targetId) return;
    closeContextMenu();
    pushTimelineHistory();
    setTimelineIds((previous) => {
      const withoutDragged = previous.filter((id) => id !== dragId);
      const targetIndex = withoutDragged.indexOf(targetId);
      if (targetIndex < 0) return previous;
      const next = [...withoutDragged];
      next.splice(placement === 'after' ? targetIndex + 1 : targetIndex, 0, dragId);
      return next;
    });
  };

  const handleAssetDragStart = (
    event: DragEvent,
    id: string,
    trackKind?: TrackKind,
    dragOffsetSeconds = 0,
    draggedTimelineIds?: string[],
  ) => {
    event.stopPropagation();
    const draggedAssetIds =
      trackKind && draggedTimelineIds?.includes(id) && draggedTimelineIds.length > 1
        ? draggedTimelineIds.filter((timelineId) => timelineIds.includes(timelineId))
        : !trackKind && selectedAssetIds.includes(id) && selectedAssetIds.length > 1
          ? selectedAssetIds
          : [id];
    event.dataTransfer.setData('application/x-galwriter-node', id);
    event.dataTransfer.setData('application/x-galwriter-nodes', JSON.stringify(draggedAssetIds));
    event.dataTransfer.setData(
      'application/x-galwriter-drag-origin',
      trackKind ? 'timeline' : 'asset',
    );
    if (trackKind) event.dataTransfer.setData('application/x-galwriter-track-kind', trackKind);
    event.dataTransfer.setData(
      'application/x-galwriter-drag-offset-seconds',
      String(Math.max(0, dragOffsetSeconds)),
    );
    event.dataTransfer.setData('text/plain', id);
    event.dataTransfer.effectAllowed = 'copyMove';

    if (draggedAssetIds.length > 1) {
      const preview = document.createElement('div');
      preview.style.cssText =
        'position:fixed;left:-10000px;top:-10000px;width:190px;padding:8px;border-radius:10px;background:rgba(15,23,42,.94);color:white;box-shadow:0 12px 30px rgba(0,0,0,.3);font:700 12px system-ui;z-index:2147483647;';
      draggedAssetIds.slice(0, 4).forEach((draggedId, index) => {
        const item = document.createElement('div');
        item.textContent = `卡片 ${index + 1}`;
        item.style.cssText =
          'height:28px;margin-top:3px;padding:0 10px;border:1px solid rgba(255,255,255,.28);border-radius:6px;background:rgba(99,102,241,.82);display:flex;align-items:center;overflow:hidden;white-space:nowrap;';
        const sourceElement = Array.from(
          document.querySelectorAll<HTMLElement>('[data-timeline-clip-id],[data-asset-card-id]'),
        ).find(
          (element) =>
            element.dataset.timelineClipId === draggedId ||
            element.dataset.assetCardId === draggedId,
        );
        const label = sourceElement?.textContent?.trim();
        if (label) item.textContent = label.slice(0, 28);
        preview.appendChild(item);
      });
      const count = document.createElement('div');
      count.textContent = `共 ${draggedAssetIds.length} 张卡片`;
      count.style.cssText = 'margin-top:6px;text-align:center;opacity:.82;';
      preview.appendChild(count);
      document.body.appendChild(preview);
      event.dataTransfer.setDragImage(preview, 24, 18);
      window.setTimeout(() => preview.remove(), 0);
    }
  };

  const handleTimelineDrop = async (
    event: DragEvent,
    targetId?: string,
    trackId?: string,
    trackKind?: TrackKind,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const draggedId =
      event.dataTransfer.getData('application/x-galwriter-node') ||
      event.dataTransfer.getData('text/plain');
    if (!draggedId) return;
    const dragOrigin = event.dataTransfer.getData('application/x-galwriter-drag-origin');
    let draggedAssetIds: string[] = [];
    try {
      const parsed = JSON.parse(
        event.dataTransfer.getData('application/x-galwriter-nodes') || '[]',
      );
      if (Array.isArray(parsed)) {
        draggedAssetIds = parsed.filter(
          (id): id is string =>
            typeof id === 'string' && (assetNodeById.has(id) || timelineNodeById.has(id)),
        );
      }
    } catch {
      draggedAssetIds = [];
    }

    const isTimelineClip = dragOrigin === 'timeline' && timelineIds.includes(draggedId);
    if (!isTimelineClip && !assetNodeById.has(draggedId)) return;
    let droppedTrackKind =
      trackKind ||
      (event.dataTransfer.getData('application/x-galwriter-track-kind') as TrackKind) ||
      'video';
    let droppedTrackId = trackId;

    if (dragOrigin === 'asset' && draggedAssetIds.length > 1) {
      const trackElement = (event.currentTarget as HTMLElement).closest(
        '[data-render-track-kind]',
      ) as HTMLElement | null;
      const rect = (trackElement || event.currentTarget).getBoundingClientRect();
      const dropTime = Math.max(
        0,
        (event.clientX - rect.left) / Math.max(1, timelineMetrics.pixelsPerSecond),
      );
      const newClips = [];
      for (const sourceId of draggedAssetIds) {
        const sourceNode = assetNodeById.get(sourceId);
        if (!sourceNode) continue;
        newClips.push({
          sourceId,
          timelineId: makeTimelineClipInstanceId(sourceId),
          mediaDuration: await getNodeMediaDuration(sourceNode),
          placeholderOverrides: getTimelinePlaceholderOverrides(sourceNode),
        });
      }
      let cursor = dropTime;
      const startById: Record<string, number> = {};
      const durationById: Record<string, number> = {};
      newClips.forEach(({ timelineId, mediaDuration }) => {
        startById[timelineId] = cursor;
        durationById[timelineId] = mediaDuration;
        cursor += Math.max(0.25, mediaDuration / speed);
      });
      const overridesById = Object.fromEntries(
        newClips
          .filter(({ placeholderOverrides }) => Object.keys(placeholderOverrides).length > 0)
          .map(({ timelineId, placeholderOverrides }) => [timelineId, placeholderOverrides]),
      );
      const targetVideoTrackId = droppedTrackId || videoTrackIds[0] || 'video-1';
      const targetAudioTrackId =
        droppedTrackKind === 'audio'
          ? droppedTrackId || audioTrackIds[0] || 'audio-1'
          : audioTrackIds[videoTrackIds.indexOf(targetVideoTrackId)] ||
            audioTrackIds[0] ||
            'audio-1';

      pushTimelineHistory();
      setTimelineIds((previous) => [...previous, ...newClips.map(({ timelineId }) => timelineId)]);
      setTimelineSourceById((previous) => ({
        ...previous,
        ...Object.fromEntries(newClips.map(({ timelineId, sourceId }) => [timelineId, sourceId])),
      }));
      setTimelineStartById((previous) => ({ ...previous, ...startById }));
      setTimelineDurationById((previous) => ({ ...previous, ...durationById }));
      setTimelineDataOverrides((previous) => ({ ...previous, ...overridesById }));
      setVideoTrackByNodeId((previous) => ({
        ...previous,
        ...Object.fromEntries(
          newClips
            .filter(
              ({ sourceId }) =>
                droppedTrackKind !== 'audio' && !isAudioOnlyNode(assetNodeById.get(sourceId)),
            )
            .map(({ timelineId }) => [timelineId, targetVideoTrackId]),
        ),
      }));
      setAudioTrackByNodeId((previous) => ({
        ...previous,
        ...Object.fromEntries(newClips.map(({ timelineId }) => [timelineId, targetAudioTrackId])),
      }));
      setSelectedIds((previous) => {
        const next = new Set(previous);
        newClips.forEach(({ timelineId }) => next.add(timelineId));
        return next;
      });
      setActivePreviewId(newClips[0]?.timelineId || '');
      closeContextMenu();
      return;
    }

    const draggedSourceNode = isTimelineClip
      ? timelineNodeById.get(draggedId)
      : assetNodeById.get(draggedId);
    const draggingAudioOnly = isAudioOnlyNode(draggedSourceNode);
    if (draggingAudioOnly) {
      droppedTrackKind = 'audio';
      droppedTrackId =
        trackKind === 'video' && trackId
          ? audioTrackIds[videoTrackIds.indexOf(trackId)] || makeTrackId('audio')
          : trackId || audioTrackIds[0];
    }

    if (draggingAudioOnly || droppedTrackId) {
      const trackElement = (event.currentTarget as HTMLElement).closest(
        '[data-render-track-kind]',
      ) as HTMLElement | null;
      const rect = (trackElement || event.currentTarget).getBoundingClientRect();
      const dragOffset =
        Number.parseFloat(
          event.dataTransfer.getData('application/x-galwriter-drag-offset-seconds'),
        ) || 0;
      const timelineId = isTimelineClip ? draggedId : makeTimelineClipInstanceId(draggedId);
      const placeholderOverrides = isTimelineClip
        ? {}
        : getTimelinePlaceholderOverrides(draggedSourceNode);
      const duration = isTimelineClip
        ? timelineMetricById.get(draggedId)?.duration || Math.max(0.25, defaultSeconds / speed)
        : Math.max(0.25, defaultSeconds / speed);
      const droppedTime =
        (event.clientX - rect.left) / Math.max(1, timelineMetrics.pixelsPerSecond) - dragOffset;
      const draggedTimelineIds =
        isTimelineClip && draggedAssetIds.includes(draggedId)
          ? draggedAssetIds.filter((id) => timelineMetricById.has(id))
          : [];

      if (draggedTimelineIds.length > 1) {
        const anchorStart = timelineMetricById.get(draggedId)?.start || 0;
        const anchorDuration =
          timelineMetricById.get(draggedId)?.duration || Math.max(0.25, defaultSeconds / speed);
        const desiredAnchorStart = snapToTimelineClipEdges(
          draggedId,
          droppedTime,
          anchorDuration,
          draggedTimelineIds,
        );
        const minimumStart = Math.min(
          ...draggedTimelineIds.map((id) => timelineMetricById.get(id)?.start || 0),
        );
        const delta = Math.max(desiredAnchorStart - anchorStart, -minimumStart);
        const nextStarts = Object.fromEntries(
          draggedTimelineIds.map((id) => [
            id,
            Math.max(0, (timelineMetricById.get(id)?.start || 0) + delta),
          ]),
        );
        pushTimelineHistory();
        setTimelineStartById((previous) => ({ ...previous, ...nextStarts }));
        if (droppedTrackKind === 'video' && droppedTrackId) {
          setVideoTrackByNodeId((previous) => ({ ...previous, [draggedId]: droppedTrackId! }));
          assignAudioTrackForVideoPlacement(
            draggedId,
            nextStarts[draggedId],
            timelineMetricById.get(draggedId)?.duration || Math.max(0.25, defaultSeconds / speed),
            droppedTrackId,
          );
        } else if (droppedTrackKind === 'audio' && droppedTrackId) {
          setAudioTrackByNodeId((previous) => ({ ...previous, [draggedId]: droppedTrackId! }));
        }
        if (draggedTimelineIds.includes(activePreviewId)) {
          preservePreviewTimeOnNodeChangeRef.current = true;
          setTimelinePreviewTime((previous) =>
            clamp(previous + delta, 0, timelineMetrics.totalDuration + Math.max(0, delta)),
          );
        }
        return;
      }

      const placementTrackId = droppedTrackId || audioTrackIds[0] || makeTrackId('audio');
      const nextStart = draggingAudioOnly
        ? snapToTimelineClipEdges(timelineId, droppedTime, duration)
        : findNonOverlappingTrackStart(
            timelineId,
            droppedTime,
            duration,
            droppedTrackKind,
            placementTrackId,
          );
      droppedTrackId =
        droppedTrackKind === 'audio'
          ? getAudioDropTrackId(timelineId, nextStart, duration, droppedTrackId)
          : placementTrackId;
      const resolvedTrackId = droppedTrackId || placementTrackId;
      const shouldPreservePlayhead = timelineId === activePreviewId;

      pushTimelineHistory();
      setTimelineIds((previous) =>
        previous.includes(timelineId) ? previous : [...previous, timelineId],
      );
      if (!isTimelineClip) {
        setTimelineSourceById((previous) => ({ ...previous, [timelineId]: draggedId }));
      }
      if (Object.keys(placeholderOverrides).length > 0) {
        setTimelineDataOverrides((previous) => ({
          ...previous,
          [timelineId]: { ...(previous[timelineId] || {}), ...placeholderOverrides },
        }));
      }
      if (droppedTrackKind === 'video') {
        setVideoTrackByNodeId((previous) => ({ ...previous, [timelineId]: resolvedTrackId }));
        assignAudioTrackForVideoPlacement(timelineId, nextStart, duration, resolvedTrackId);
      } else {
        setAudioTrackByNodeId((previous) => ({ ...previous, [timelineId]: resolvedTrackId }));
        setVideoTrackByNodeId((previous) => {
          const next = { ...previous };
          delete next[timelineId];
          return next;
        });
      }
      setTimelineStartById((previous) => ({ ...previous, [timelineId]: nextStart }));
      if (shouldPreservePlayhead) {
        preservePreviewTimeOnNodeChangeRef.current = true;
        setPreviewTime(clamp((activeTimelineTime - nextStart) * speed, 0, duration * speed));
      }
      setSelectedIds((previous) => new Set(previous).add(timelineId));
      if (!activePreviewId || !isTimelineClip) setActivePreviewId(timelineId);
      return;
    }

    if (targetId && isTimelineClip) {
      reorderTimelineNode(
        draggedId,
        targetId,
        event.clientX > event.currentTarget.getBoundingClientRect().left ? 'after' : 'before',
      );
    } else {
      addNodeToTimeline(draggedId, droppedTrackKind, droppedTrackId);
    }
  };

  return { handleAssetDragStart, handleTimelineDrop };
};
