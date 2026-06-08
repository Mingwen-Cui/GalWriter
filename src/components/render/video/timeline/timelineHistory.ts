import type { TimelineHistoryState } from '../shared/types';

type TimelineHistorySource = {
  timelineIds: string[];
  timelineSourceById: Record<string, string>;
  timelineExcludedSourceIds: Set<string>;
  selectedIds: Set<string>;
  videoTrackIds: string[];
  audioTrackIds: string[];
  videoTrackByNodeId: Record<string, string>;
  audioTrackByNodeId: Record<string, string>;
  timelineStartById: Record<string, number>;
  activePreviewId: string;
};

type TimelineHistoryRestoreHandlers = {
  setTimelineIds: (value: string[]) => void;
  setTimelineSourceById: (value: Record<string, string>) => void;
  setTimelineExcludedSourceIds: (value: Set<string>) => void;
  setSelectedIds: (value: Set<string>) => void;
  setVideoTrackIds: (value: string[]) => void;
  setAudioTrackIds: (value: string[]) => void;
  setVideoTrackByNodeId: (value: Record<string, string>) => void;
  setAudioTrackByNodeId: (value: Record<string, string>) => void;
  setTimelineStartById: (value: Record<string, number>) => void;
  setActivePreviewId: (value: string) => void;
};

export const captureTimelineHistoryState = ({
  timelineIds,
  timelineSourceById,
  timelineExcludedSourceIds,
  selectedIds,
  videoTrackIds,
  audioTrackIds,
  videoTrackByNodeId,
  audioTrackByNodeId,
  timelineStartById,
  activePreviewId,
}: TimelineHistorySource): TimelineHistoryState => ({
  timelineIds: [...timelineIds],
  timelineSourceById: { ...timelineSourceById },
  timelineExcludedSourceIds: [...timelineExcludedSourceIds],
  selectedIds: [...selectedIds],
  videoTrackIds: [...videoTrackIds],
  audioTrackIds: [...audioTrackIds],
  videoTrackByNodeId: { ...videoTrackByNodeId },
  audioTrackByNodeId: { ...audioTrackByNodeId },
  timelineStartById: { ...timelineStartById },
  activePreviewId,
});

export const restoreTimelineHistoryState = (
  snapshot: TimelineHistoryState,
  handlers: TimelineHistoryRestoreHandlers,
) => {
  handlers.setTimelineIds(snapshot.timelineIds);
  handlers.setTimelineSourceById(snapshot.timelineSourceById || {});
  handlers.setTimelineExcludedSourceIds(new Set(snapshot.timelineExcludedSourceIds || []));
  handlers.setSelectedIds(new Set(snapshot.selectedIds));
  handlers.setVideoTrackIds(snapshot.videoTrackIds);
  handlers.setAudioTrackIds(snapshot.audioTrackIds);
  handlers.setVideoTrackByNodeId(snapshot.videoTrackByNodeId);
  handlers.setAudioTrackByNodeId(snapshot.audioTrackByNodeId);
  handlers.setTimelineStartById(snapshot.timelineStartById || {});
  handlers.setActivePreviewId(snapshot.activePreviewId);
};
