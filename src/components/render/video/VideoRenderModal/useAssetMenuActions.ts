import type { Node as FlowNode } from '@xyflow/react';
import type { Dispatch, SetStateAction } from 'react';

import { isAudioOnlyNode } from './timelineTrackLayout';

type DataOverrides = Record<string, Record<string, unknown>>;

export const useAssetMenuActions = ({
  status,
  selectedAssetIds,
  visibleAssetNodes,
  uploadedAssetNodes,
  allAssetNodes,
  assetNodeById,
  timelineIds,
  timelineSourceById,
  timelineTotalDuration,
  videoTrackIds,
  audioTrackIds,
  speed,
  activePreviewId,
  focusedPreviewId,
  closeContextMenu,
  pushTimelineHistory,
  getNodeMediaDuration,
  makeTimelineClipInstanceId,
  revokeTrackedObjectUrl,
  setSelectedAssetIds,
  setUploadedAssetNodes,
  setTimelineIds,
  setTimelineSourceById,
  setTimelineStartById,
  setTimelineDurationById,
  setTimelineDataOverrides,
  setVideoTrackByNodeId,
  setAudioTrackByNodeId,
  setSelectedIds,
  setKeyShotIds,
  setActivePreviewId,
  setFocusedPreviewId,
}: {
  status: string;
  selectedAssetIds: string[];
  visibleAssetNodes: FlowNode[];
  uploadedAssetNodes: FlowNode[];
  allAssetNodes: FlowNode[];
  assetNodeById: Map<string, FlowNode>;
  timelineIds: string[];
  timelineSourceById: Record<string, string>;
  timelineTotalDuration: number;
  videoTrackIds: string[];
  audioTrackIds: string[];
  speed: number;
  activePreviewId: string;
  focusedPreviewId: string;
  closeContextMenu: () => void;
  pushTimelineHistory: () => void;
  getNodeMediaDuration: (node: FlowNode) => Promise<number>;
  makeTimelineClipInstanceId: (sourceId: string) => string;
  revokeTrackedObjectUrl: (url: string) => void;
  setSelectedAssetIds: Dispatch<SetStateAction<string[]>>;
  setUploadedAssetNodes: Dispatch<SetStateAction<FlowNode[]>>;
  setTimelineIds: Dispatch<SetStateAction<string[]>>;
  setTimelineSourceById: Dispatch<SetStateAction<Record<string, string>>>;
  setTimelineStartById: Dispatch<SetStateAction<Record<string, number>>>;
  setTimelineDurationById: Dispatch<SetStateAction<Record<string, number>>>;
  setTimelineDataOverrides: Dispatch<SetStateAction<DataOverrides>>;
  setVideoTrackByNodeId: Dispatch<SetStateAction<Record<string, string>>>;
  setAudioTrackByNodeId: Dispatch<SetStateAction<Record<string, string>>>;
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>;
  setKeyShotIds: Dispatch<SetStateAction<Set<string>>>;
  setActivePreviewId: Dispatch<SetStateAction<string>>;
  setFocusedPreviewId: Dispatch<SetStateAction<string>>;
}) => {
  const getSelectedAssetsInCardOrder = () => {
    const visibleIndex = new Map(visibleAssetNodes.map((node, index) => [node.id, index]));
    return [...selectedAssetIds].sort(
      (a, b) =>
        (visibleIndex.get(a) ?? Number.MAX_SAFE_INTEGER) -
        (visibleIndex.get(b) ?? Number.MAX_SAFE_INTEGER),
    );
  };

  const sortSelectedAssetsByCardOrder = () => {
    setSelectedAssetIds(getSelectedAssetsInCardOrder());
    closeContextMenu();
  };

  const importSelectedAssetsToTimeline = async () => {
    const sourceIds = getSelectedAssetsInCardOrder().filter((id) => assetNodeById.has(id));
    if (sourceIds.length === 0 || status === 'rendering') return;
    const newClips = [];
    for (const sourceId of sourceIds) {
      const sourceNode = assetNodeById.get(sourceId);
      if (!sourceNode) continue;
      newClips.push({
        sourceId,
        timelineId: makeTimelineClipInstanceId(sourceId),
        mediaDuration: await getNodeMediaDuration(sourceNode),
      });
    }
    let cursor = timelineTotalDuration;
    const startById: Record<string, number> = {};
    const durationById: Record<string, number> = {};
    newClips.forEach(({ timelineId, mediaDuration }) => {
      startById[timelineId] = cursor;
      durationById[timelineId] = mediaDuration;
      cursor += Math.max(0.25, mediaDuration / speed);
    });
    const videoTrackId = videoTrackIds[0] || 'video-1';
    const audioTrackId = audioTrackIds[0] || 'audio-1';

    pushTimelineHistory();
    setTimelineIds((previous) => [
      ...previous,
      ...newClips.map(({ timelineId }) => timelineId),
    ]);
    setTimelineSourceById((previous) => ({
      ...previous,
      ...Object.fromEntries(
        newClips.map(({ timelineId, sourceId }) => [timelineId, sourceId]),
      ),
    }));
    setTimelineStartById((previous) => ({ ...previous, ...startById }));
    setTimelineDurationById((previous) => ({ ...previous, ...durationById }));
    setVideoTrackByNodeId((previous) => ({
      ...previous,
      ...Object.fromEntries(
        newClips
          .filter(({ sourceId }) => !isAudioOnlyNode(assetNodeById.get(sourceId)))
          .map(({ timelineId }) => [timelineId, videoTrackId]),
      ),
    }));
    setAudioTrackByNodeId((previous) => ({
      ...previous,
      ...Object.fromEntries(newClips.map(({ timelineId }) => [timelineId, audioTrackId])),
    }));
    setSelectedIds((previous) => {
      const next = new Set(previous);
      newClips.forEach(({ timelineId }) => next.add(timelineId));
      return next;
    });
    setSelectedAssetIds(sourceIds);
    setActivePreviewId(newClips[0]?.timelineId || '');
    closeContextMenu();
  };

  const removeUploadedAssets = (ids: string[]) => {
    const uploadedIds = new Set(
      ids.filter((id) => uploadedAssetNodes.some((node) => node.id === id)),
    );
    if (uploadedIds.size === 0) return;
    const timelineIdsToRemove = timelineIds.filter((timelineId) =>
      uploadedIds.has(timelineSourceById[timelineId] || timelineId),
    );
    closeContextMenu();
    setUploadedAssetNodes((previous) => {
      previous
        .filter((node) => uploadedIds.has(node.id))
        .forEach((node) => {
          [node.data?.imageUrl, node.data?.videoUrl, node.data?.audioUrl].forEach((url) => {
            if (typeof url === 'string') revokeTrackedObjectUrl(url);
          });
        });
      return previous.filter((node) => !uploadedIds.has(node.id));
    });
    if (timelineIdsToRemove.length > 0) {
      const removedTimelineIds = new Set(timelineIdsToRemove);
      const removeEntries = <T,>(map: Record<string, T>) =>
        Object.fromEntries(
          Object.entries(map).filter(([id]) => !removedTimelineIds.has(id)),
        ) as Record<string, T>;
      setTimelineIds((previous) =>
        previous.filter((id) => !removedTimelineIds.has(id)),
      );
      setTimelineSourceById(removeEntries);
      setVideoTrackByNodeId(removeEntries);
      setAudioTrackByNodeId(removeEntries);
      setTimelineStartById(removeEntries);
      setTimelineDurationById(removeEntries);
      setTimelineDataOverrides(removeEntries);
      setKeyShotIds((previous) => {
        const next = new Set(previous);
        removedTimelineIds.forEach((id) => next.delete(id));
        return next;
      });
    }
    setSelectedAssetIds((previous) =>
      previous.filter((id) => !uploadedIds.has(id)),
    );
    setSelectedIds((previous) => {
      const next = new Set(previous);
      timelineIdsToRemove.forEach((id) => next.delete(id));
      return next;
    });
    if (uploadedIds.has(activePreviewId) || timelineIdsToRemove.includes(activePreviewId)) {
      setActivePreviewId(allAssetNodes.find((node) => !uploadedIds.has(node.id))?.id || '');
    }
    if (timelineIdsToRemove.includes(focusedPreviewId)) setFocusedPreviewId('');
  };

  return {
    sortSelectedAssetsByCardOrder,
    importSelectedAssetsToTimeline,
    removeUploadedAssets,
  };
};
