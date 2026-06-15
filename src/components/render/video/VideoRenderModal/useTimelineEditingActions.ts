import type { Node as FlowNode } from '@xyflow/react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { makeTrackId } from '../controls/RenderControls';
import type { TimelineSegmentMetric } from '../shared/types';

type TrackKind = 'video' | 'audio';
type DataOverrides = Record<string, Record<string, unknown>>;

export const useTimelineEditingActions = ({
  timelineIds,
  timelineSourceById,
  timelineNodes,
  orderedNodes,
  nodeById,
  timelineMetricById,
  timelineStartById,
  timelineDurationById,
  videoTrackIds,
  audioTrackIds,
  audioTrackByNodeId,
  activePreviewId,
  focusedPreviewId,
  defaultSeconds,
  speed,
  visibleAssetNodes,
  preservePreviewTimeOnNodeChangeRef,
  closeContextMenu,
  pushTimelineHistory,
  getNodeMediaDuration,
  makeTimelineClipInstanceId,
  segmentTitle,
  separatedAudioLabel,
  assignAudioTrackForVideoPlacement,
  addNodeToTimeline,
  setTimelineIds,
  setTimelineSourceById,
  setTimelineExcludedSourceIds,
  setSelectedIds,
  setActivePreviewId,
  setFocusedPreviewId,
  setPreviewTime,
  setPreviewPlaying,
  setTimelinePreviewTime,
  setVideoTrackIds,
  setAudioTrackIds,
  setVideoTrackByNodeId,
  setAudioTrackByNodeId,
  setTimelineStartById,
  setTimelineDurationById,
  setTimelineDataOverrides,
  setKeyShotIds,
}: {
  timelineIds: string[];
  timelineSourceById: Record<string, string>;
  timelineNodes: FlowNode[];
  orderedNodes: FlowNode[];
  nodeById: Map<string, FlowNode>;
  timelineMetricById: Map<string, TimelineSegmentMetric>;
  timelineStartById: Record<string, number>;
  timelineDurationById: Record<string, number>;
  videoTrackIds: string[];
  audioTrackIds: string[];
  audioTrackByNodeId: Record<string, string>;
  activePreviewId: string;
  focusedPreviewId: string;
  defaultSeconds: number;
  speed: number;
  visibleAssetNodes: FlowNode[];
  preservePreviewTimeOnNodeChangeRef: MutableRefObject<boolean>;
  closeContextMenu: () => void;
  pushTimelineHistory: () => void;
  getNodeMediaDuration: (node: FlowNode) => Promise<number>;
  makeTimelineClipInstanceId: (sourceId: string) => string;
  segmentTitle: (node: FlowNode) => string;
  separatedAudioLabel: string;
  assignAudioTrackForVideoPlacement: (
    nodeId: string,
    start: number,
    duration: number,
    videoTrackId: string,
  ) => void;
  addNodeToTimeline: (id: string, kind?: TrackKind, trackId?: string) => void;
  setTimelineIds: Dispatch<SetStateAction<string[]>>;
  setTimelineSourceById: Dispatch<SetStateAction<Record<string, string>>>;
  setTimelineExcludedSourceIds: Dispatch<SetStateAction<Set<string>>>;
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>;
  setActivePreviewId: Dispatch<SetStateAction<string>>;
  setFocusedPreviewId: Dispatch<SetStateAction<string>>;
  setPreviewTime: Dispatch<SetStateAction<number>>;
  setPreviewPlaying: Dispatch<SetStateAction<boolean>>;
  setTimelinePreviewTime: Dispatch<SetStateAction<number>>;
  setVideoTrackIds: Dispatch<SetStateAction<string[]>>;
  setAudioTrackIds: Dispatch<SetStateAction<string[]>>;
  setVideoTrackByNodeId: Dispatch<SetStateAction<Record<string, string>>>;
  setAudioTrackByNodeId: Dispatch<SetStateAction<Record<string, string>>>;
  setTimelineStartById: Dispatch<SetStateAction<Record<string, number>>>;
  setTimelineDurationById: Dispatch<SetStateAction<Record<string, number>>>;
  setTimelineDataOverrides: Dispatch<SetStateAction<DataOverrides>>;
  setKeyShotIds: Dispatch<SetStateAction<Set<string>>>;
}) => {
  const toggleNode = (id: string) => {
    closeContextMenu();
    pushTimelineHistory();
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const removeTimelineNodes = (ids: string[]) => {
    const removedIds = new Set(ids.filter((id) => timelineIds.includes(id)));
    if (removedIds.size === 0) return;
    const remainingIds = timelineIds.filter((id) => !removedIds.has(id));
    const removedSourceIds = new Set(
      Array.from(removedIds).map((id) => timelineSourceById[id] || id),
    );
    const excludedSourceIds = Array.from(removedSourceIds).filter(
      (sourceId) =>
        !remainingIds.some(
          (timelineId) => (timelineSourceById[timelineId] || timelineId) === sourceId,
        ),
    );
    closeContextMenu();
    pushTimelineHistory();
    setTimelineIds(remainingIds);
    if (excludedSourceIds.length > 0) {
      setTimelineExcludedSourceIds((previous) => {
        const next = new Set(previous);
        excludedSourceIds.forEach((sourceId) => next.add(sourceId));
        return next;
      });
    }
    setTimelineSourceById((previous) =>
      Object.fromEntries(
        Object.entries(previous).filter(([timelineId]) => !removedIds.has(timelineId)),
      ),
    );
    setSelectedIds((previous) => {
      const next = new Set(previous);
      removedIds.forEach((id) => next.delete(id));
      return next;
    });
    if (removedIds.has(activePreviewId)) {
      const nextNode = timelineNodes.find((node) => !removedIds.has(node.id)) || orderedNodes[0];
      setActivePreviewId(nextNode?.id || '');
    }
    if (removedIds.has(focusedPreviewId)) setFocusedPreviewId('');
    const removeEntries = <T,>(map: Record<string, T>) =>
      Object.fromEntries(Object.entries(map).filter(([id]) => !removedIds.has(id)));
    setVideoTrackByNodeId(removeEntries);
    setAudioTrackByNodeId(removeEntries);
    setTimelineStartById(removeEntries);
    setTimelineDurationById(removeEntries);
    setTimelineDataOverrides(removeEntries);
    setKeyShotIds((previous) => {
      const next = new Set(previous);
      removedIds.forEach((id) => next.delete(id));
      return next;
    });
  };

  const removeTimelineNode = (id: string) => removeTimelineNodes([id]);

  const useActualMediaDuration = async (node: FlowNode) => {
    if (!timelineIds.includes(node.id)) return;
    const duration = await getNodeMediaDuration(node);
    closeContextMenu();
    pushTimelineHistory();
    setTimelineDurationById((previous) => ({
      ...previous,
      [node.id]: Math.max(0.25, duration),
    }));
  };

  const separateTimelineAudio = (node: FlowNode) => {
    if (!timelineIds.includes(node.id) || !node.data?.videoUrl) return;
    const audioTimelineId = makeTimelineClipInstanceId(timelineSourceById[node.id] || node.id);
    const start = timelineMetricById.get(node.id)?.start || 0;
    const duration = timelineDurationById[node.id] || defaultSeconds;
    const audioTrackId = audioTrackByNodeId[node.id] || audioTrackIds[0] || 'audio-1';
    closeContextMenu();
    pushTimelineHistory();
    setTimelineIds((previous) => [...previous, audioTimelineId]);
    setTimelineSourceById((previous) => ({
      ...previous,
      [audioTimelineId]: timelineSourceById[node.id] || node.id,
    }));
    setTimelineDataOverrides((previous) => ({
      ...previous,
      [node.id]: {
        ...(previous[node.id] || {}),
        audioUrl: undefined,
        muteVideoAudio: true,
      },
      [audioTimelineId]: {
        videoUrl: undefined,
        imageUrl: undefined,
        text: '',
        audioUrl: node.data.videoUrl,
        title: `${segmentTitle(node)} - ${separatedAudioLabel}`,
      },
    }));
    setTimelineStartById((previous) => ({ ...previous, [audioTimelineId]: start }));
    setTimelineDurationById((previous) => ({ ...previous, [audioTimelineId]: duration }));
    setAudioTrackByNodeId((previous) => ({ ...previous, [audioTimelineId]: audioTrackId }));
    setSelectedIds((previous) => new Set(previous).add(audioTimelineId));
  };

  const toggleKeyShot = (id: string) => {
    if (!timelineIds.includes(id)) return;
    closeContextMenu();
    pushTimelineHistory();
    setKeyShotIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const removeTrack = (kind: TrackKind, trackId: string) => {
    const trackIds = kind === 'video' ? videoTrackIds : audioTrackIds;
    if (trackIds.length <= 1) return;
    closeContextMenu();
    pushTimelineHistory();
    const setTrackIds = kind === 'video' ? setVideoTrackIds : setAudioTrackIds;
    const setTrackByNodeId =
      kind === 'video' ? setVideoTrackByNodeId : setAudioTrackByNodeId;
    setTrackIds((previous) => {
      if (previous.length <= 1) return previous;
      const next = previous.filter((id) => id !== trackId);
      setTrackByNodeId((map) =>
        Object.fromEntries(
          Object.entries(map).map(([nodeId, assignedTrackId]) => [
            nodeId,
            assignedTrackId === trackId ? next[0] : assignedTrackId,
          ]),
        ),
      );
      return next;
    });
  };

  const addTrack = (kind: TrackKind) => {
    closeContextMenu();
    pushTimelineHistory();
    const setTrackIds = kind === 'video' ? setVideoTrackIds : setAudioTrackIds;
    setTrackIds((previous) => [...previous, makeTrackId(kind)]);
  };

  const focusTimelineSegment = (nodeId: string) => {
    const metric = timelineMetricById.get(nodeId);
    if (!metric) return;
    preservePreviewTimeOnNodeChangeRef.current = true;
    setFocusedPreviewId(nodeId);
    setActivePreviewId(nodeId);
    setTimelinePreviewTime(metric.start);
    setPreviewTime(0);
    setPreviewPlaying(false);
  };

  const previewNode = (id: string) => {
    if (!nodeById.has(id)) return;
    closeContextMenu();
    if (timelineMetricById.has(id)) {
      focusTimelineSegment(id);
      return;
    }
    setActivePreviewId(id);
    setPreviewTime(0);
    setPreviewPlaying(false);
  };

  const selectTimelineFromNode = (id: string) => {
    const startIndex = timelineIds.indexOf(id);
    if (startIndex < 0) return;
    closeContextMenu();
    pushTimelineHistory();
    setSelectedIds(new Set(timelineIds.slice(startIndex)));
    setActivePreviewId(id);
    setPreviewTime(0);
    setPreviewPlaying(false);
  };
  const selectOnlyNode = (id: string) => {
    if (!timelineIds.includes(id)) return;
    closeContextMenu();
    pushTimelineHistory();
    setSelectedIds(new Set([id]));
    setActivePreviewId(id);
  };
  const selectAllTimelineNodes = () => {
    closeContextMenu();
    pushTimelineHistory();
    setSelectedIds(new Set(timelineIds));
  };
  const clearTimelineSelection = () => {
    closeContextMenu();
    pushTimelineHistory();
    setFocusedPreviewId('');
    setSelectedIds(new Set());
  };
  const setTimelineNodesExported = (ids: string[], exported: boolean) => {
    const timelineIdSet = new Set(ids.filter((id) => timelineIds.includes(id)));
    if (timelineIdSet.size === 0) return;
    closeContextMenu();
    pushTimelineHistory();
    setSelectedIds((previous) => {
      const next = new Set(previous);
      timelineIdSet.forEach((id) => {
        if (exported) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  };

  const assignNodeTrack = (id: string, kind: TrackKind, trackId: string) => {
    if (!timelineIds.includes(id)) return;
    closeContextMenu();
    pushTimelineHistory();
    if (kind === 'video') {
      setVideoTrackByNodeId((previous) => ({ ...previous, [id]: trackId }));
      assignAudioTrackForVideoPlacement(
        id,
        timelineMetricById.get(id)?.start ?? timelineStartById[id] ?? 0,
        timelineMetricById.get(id)?.duration || Math.max(0.25, defaultSeconds / speed),
        trackId,
      );
    } else {
      setAudioTrackByNodeId((previous) => ({ ...previous, [id]: trackId }));
    }
  };

  const addNearestAssetToTimeline = (kind: TrackKind = 'video') => {
    const node = visibleAssetNodes[0];
    if (node) addNodeToTimeline(node.id, kind);
  };

  return {
    toggleNode,
    removeTimelineNodes,
    removeTimelineNode,
    useActualMediaDuration,
    separateTimelineAudio,
    toggleKeyShot,
    removeVideoTrack: (trackId: string) => removeTrack('video', trackId),
    removeAudioTrack: (trackId: string) => removeTrack('audio', trackId),
    addVideoTrack: () => addTrack('video'),
    addAudioTrack: () => addTrack('audio'),
    previewNode,
    selectTimelineFromNode,
    selectOnlyNode,
    selectAllTimelineNodes,
    clearTimelineSelection,
    setTimelineNodesExported,
    focusTimelineSegment,
    assignNodeTrack,
    addNearestAssetToTimeline,
  };
};
