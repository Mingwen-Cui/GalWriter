import type { Dispatch, PointerEvent, SetStateAction } from 'react';
import { useEffect, useRef } from 'react';

import {
  ASSET_CARD_MAX_SCALE,
  ASSET_CARD_MIN_SCALE,
  TIMELINE_MAX_PIXELS_PER_SECOND,
  TIMELINE_MIN_PIXELS_PER_SECOND,
} from '../shared/constants';
import { clamp } from '../shared/mediaUtils';
import type { RenderStatus, TimelineWheelMode } from '../shared/types';

type TimelineScrollInfo = {
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
};

type AssetScrollInfo = {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
};

export const useWorkspaceInteractions = ({
  status,
  timelineScrollInfo,
  setTimelineScrollInfo,
  assetScrollInfo,
  setAssetScrollInfo,
  assetCardScale,
  setAssetCardScale,
  timelineDisplayDuration,
  timelinePixelsPerSecond,
  timelineWheelMode,
  setTimelineDisplayDuration,
  setTimelinePixelsPerSecond,
  seekTimelineFromClientX,
}: {
  status: RenderStatus;
  timelineScrollInfo: TimelineScrollInfo;
  setTimelineScrollInfo: Dispatch<SetStateAction<TimelineScrollInfo>>;
  assetScrollInfo: AssetScrollInfo;
  setAssetScrollInfo: Dispatch<SetStateAction<AssetScrollInfo>>;
  assetCardScale: number;
  setAssetCardScale: Dispatch<SetStateAction<number>>;
  timelineDisplayDuration: number;
  timelinePixelsPerSecond: number;
  timelineWheelMode: TimelineWheelMode;
  setTimelineDisplayDuration: Dispatch<SetStateAction<number>>;
  setTimelinePixelsPerSecond: Dispatch<SetStateAction<number>>;
  seekTimelineFromClientX: (
    clientX: number,
    rect: DOMRect,
    options?: { keepPlaying?: boolean },
  ) => void;
}) => {
  const assetViewportRef = useRef<HTMLDivElement>(null);
  const timelineViewportRef = useRef<HTMLDivElement>(null);
  const timelineScrubSurfaceRef = useRef<HTMLDivElement>(null);
  const timelineScrubRef = useRef(false);
  const timelineScaleDragRef = useRef<{
    side: 'left' | 'right';
    anchorTrackX: number;
    trackWidth: number;
  } | null>(null);
  const assetScaleDragRef = useRef<{
    side: 'top' | 'bottom';
    startY: number;
    startScale: number;
  } | null>(null);
  const timelineScrollDragRef = useRef<{
    startX: number;
    startScrollLeft: number;
    trackWidth: number;
  } | null>(null);
  const assetScrollDragRef = useRef<{
    startY: number;
    startScrollTop: number;
    trackHeight: number;
  } | null>(null);

  const timelineThumbWidthPercent =
    timelineScrollInfo.scrollWidth > 0
      ? clamp(
          (timelineScrollInfo.clientWidth / timelineScrollInfo.scrollWidth) * 100,
          0,
          100,
        )
      : 100;
  const timelineThumbLeftPercent =
    timelineScrollInfo.scrollWidth > 0
      ? clamp(
          (timelineScrollInfo.scrollLeft / timelineScrollInfo.scrollWidth) * 100,
          0,
          100 - timelineThumbWidthPercent,
        )
      : 0;
  const assetThumbHeightPercent =
    assetScrollInfo.scrollHeight > 0
      ? clamp(
          (assetScrollInfo.clientHeight / assetScrollInfo.scrollHeight) * 100,
          8,
          100,
        )
      : 100;
  const assetThumbTopPercent =
    assetScrollInfo.scrollHeight > 0
      ? clamp(
          (assetScrollInfo.scrollTop / assetScrollInfo.scrollHeight) * 100,
          0,
          100 - assetThumbHeightPercent,
        )
      : 0;

  const syncTimelineScrollInfo = () => {
    const element = timelineViewportRef.current;
    if (!element) return;
    setTimelineScrollInfo({
      scrollLeft: element.scrollLeft,
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    });
  };

  const syncAssetScrollInfo = () => {
    const element = assetViewportRef.current;
    if (!element) return;
    setAssetScrollInfo({
      scrollTop: element.scrollTop,
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
    });
  };

  const updateAssetCardScale = (nextScale: number) => {
    const element = assetViewportRef.current;
    const centerRatio =
      element && element.scrollHeight > 0
        ? (element.scrollTop + element.clientHeight / 2) / element.scrollHeight
        : 0.5;
    setAssetCardScale(clamp(nextScale, ASSET_CARD_MIN_SCALE, ASSET_CARD_MAX_SCALE));
    window.requestAnimationFrame(() => {
      const nextElement = assetViewportRef.current;
      if (!nextElement) return;
      nextElement.scrollTop = Math.max(
        0,
        centerRatio * nextElement.scrollHeight - nextElement.clientHeight / 2,
      );
      syncAssetScrollInfo();
    });
  };

  const applyTimelineViewportWindow = (
    leftTrackX: number,
    rightTrackX: number,
    trackWidth: number,
    activeSide: 'left' | 'right',
  ) => {
    const element = timelineViewportRef.current;
    if (!element || trackWidth <= 0) return;
    const viewportWidth = Math.max(1, element.clientWidth);
    const minWindowWidth = Math.min(trackWidth, 10);
    const windowLeft = clamp(
      Math.min(leftTrackX, rightTrackX - minWindowWidth),
      0,
      trackWidth - minWindowWidth,
    );
    const windowRight = clamp(
      Math.max(rightTrackX, windowLeft + minWindowWidth),
      windowLeft + minWindowWidth,
      trackWidth,
    );
    const windowWidth = Math.max(minWindowWidth, windowRight - windowLeft);
    const targetScrollWidth = (viewportWidth * trackWidth) / windowWidth;
    const nextScale = clamp(
      targetScrollWidth / timelineDisplayDuration,
      TIMELINE_MIN_PIXELS_PER_SECOND,
      TIMELINE_MAX_PIXELS_PER_SECOND,
    );

    setTimelinePixelsPerSecond(nextScale);
    window.requestAnimationFrame(() => {
      const nextElement = timelineViewportRef.current;
      if (!nextElement) return;
      const nextScrollWidth = Math.max(1, timelineDisplayDuration * nextScale);
      const targetScrollLeft =
        activeSide === 'right'
          ? (windowRight / trackWidth) * nextScrollWidth - nextElement.clientWidth
          : (windowLeft / trackWidth) * nextScrollWidth;
      nextElement.scrollLeft = clamp(
        targetScrollLeft,
        0,
        Math.max(0, nextScrollWidth - nextElement.clientWidth),
      );
      syncTimelineScrollInfo();
    });
  };

  const handleTimelineScrubStart = (event: PointerEvent<HTMLElement>) => {
    if (status === 'rendering') return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    timelineScrubRef.current = true;
    seekTimelineFromClientX(event.clientX, event.currentTarget.getBoundingClientRect());
  };
  const handleTimelineScrubMove = (event: PointerEvent<HTMLElement>) => {
    if (!timelineScrubRef.current || status === 'rendering') return;
    event.preventDefault();
    seekTimelineFromClientX(event.clientX, event.currentTarget.getBoundingClientRect());
  };
  const handleTimelineScrubEnd = (event: PointerEvent<HTMLElement>) => {
    timelineScrubRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const handleTimelinePlayheadGrabStart = (event: PointerEvent<HTMLElement>) => {
    const scrubSurface = timelineScrubSurfaceRef.current;
    if (status === 'rendering' || !scrubSurface) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    timelineScrubRef.current = true;
    seekTimelineFromClientX(event.clientX, scrubSurface.getBoundingClientRect());
  };
  const handleTimelinePlayheadGrabMove = (event: PointerEvent<HTMLElement>) => {
    const scrubSurface = timelineScrubSurfaceRef.current;
    if (!timelineScrubRef.current || status === 'rendering' || !scrubSurface) return;
    event.preventDefault();
    seekTimelineFromClientX(event.clientX, scrubSurface.getBoundingClientRect());
  };

  const handleTimelineScrollThumbStart = (event: PointerEvent<HTMLDivElement>) => {
    const element = timelineViewportRef.current;
    if (!element) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    timelineScrollDragRef.current = {
      startX: event.clientX,
      startScrollLeft: element.scrollLeft,
      trackWidth: event.currentTarget.parentElement?.clientWidth || 1,
    };
  };
  const handleTimelineScrollThumbMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = timelineScrollDragRef.current;
    const element = timelineViewportRef.current;
    if (!drag || !element) return;
    const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);
    const maxThumbTravel = Math.max(
      1,
      drag.trackWidth - (element.clientWidth / element.scrollWidth) * drag.trackWidth,
    );
    element.scrollLeft = clamp(
      drag.startScrollLeft + ((event.clientX - drag.startX) / maxThumbTravel) * maxScrollLeft,
      0,
      maxScrollLeft,
    );
    syncTimelineScrollInfo();
  };
  const handleTimelineScrollThumbEnd = (event: PointerEvent<HTMLDivElement>) => {
    timelineScrollDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleAssetScrollThumbStart = (event: PointerEvent<HTMLDivElement>) => {
    const element = assetViewportRef.current;
    if (!element) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    assetScrollDragRef.current = {
      startY: event.clientY,
      startScrollTop: element.scrollTop,
      trackHeight: event.currentTarget.parentElement?.clientHeight || 1,
    };
  };
  const handleAssetScrollThumbMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = assetScrollDragRef.current;
    const element = assetViewportRef.current;
    if (!drag || !element) return;
    const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
    const maxThumbTravel = Math.max(
      1,
      drag.trackHeight - (element.clientHeight / element.scrollHeight) * drag.trackHeight,
    );
    element.scrollTop = clamp(
      drag.startScrollTop + ((event.clientY - drag.startY) / maxThumbTravel) * maxScrollTop,
      0,
      maxScrollTop,
    );
    syncAssetScrollInfo();
  };
  const handleAssetScrollThumbEnd = (event: PointerEvent<HTMLDivElement>) => {
    assetScrollDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleTimelineScaleHandleStart = (
    event: PointerEvent<HTMLButtonElement>,
    side: 'left' | 'right',
  ) => {
    const track = event.currentTarget.parentElement?.parentElement;
    if (!track) return;
    const trackWidth = track.clientWidth || 1;
    const thumbLeft = (timelineThumbLeftPercent / 100) * trackWidth;
    const thumbRight = thumbLeft + (timelineThumbWidthPercent / 100) * trackWidth;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    timelineScaleDragRef.current = {
      side,
      anchorTrackX: side === 'left' ? thumbRight : thumbLeft,
      trackWidth,
    };
  };
  const handleTimelineScaleHandleMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = timelineScaleDragRef.current;
    if (!drag) return;
    event.preventDefault();
    event.stopPropagation();
    const track = event.currentTarget.parentElement?.parentElement;
    if (!track) return;
    const pointerTrackX = clamp(
      event.clientX - track.getBoundingClientRect().left,
      0,
      drag.trackWidth,
    );
    if (drag.side === 'left') {
      applyTimelineViewportWindow(pointerTrackX, drag.anchorTrackX, drag.trackWidth, 'left');
    } else {
      applyTimelineViewportWindow(drag.anchorTrackX, pointerTrackX, drag.trackWidth, 'right');
    }
  };
  const handleTimelineScaleHandleEnd = (event: PointerEvent<HTMLButtonElement>) => {
    timelineScaleDragRef.current = null;
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleAssetScaleHandleStart = (
    event: PointerEvent<HTMLButtonElement>,
    side: 'top' | 'bottom',
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    assetScaleDragRef.current = { side, startY: event.clientY, startScale: assetCardScale };
  };
  const handleAssetScaleHandleMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = assetScaleDragRef.current;
    if (!drag) return;
    event.preventDefault();
    event.stopPropagation();
    const distance =
      drag.side === 'top' ? event.clientY - drag.startY : drag.startY - event.clientY;
    updateAssetCardScale(drag.startScale * Math.exp(distance / 180));
  };
  const handleAssetScaleHandleEnd = (event: PointerEvent<HTMLButtonElement>) => {
    assetScaleDragRef.current = null;
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  useEffect(() => {
    const element = timelineViewportRef.current;
    if (!element) return;
    const handleWheel = (event: WheelEvent) => {
      if (timelineWheelMode === 'vertical') return;
      event.preventDefault();
      event.stopPropagation();
      const maxScrollLeft = element.scrollWidth - element.clientWidth;
      const scrollDelta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (maxScrollLeft <= 0 || scrollDelta === 0) return;

      const movingRight = scrollDelta > 0;
      const canMoveRight = element.scrollLeft < maxScrollLeft - 1;
      const canMoveLeft = element.scrollLeft > 1;
      if ((movingRight && canMoveRight) || (!movingRight && canMoveLeft)) {
        element.scrollLeft += scrollDelta;
        syncTimelineScrollInfo();
        return;
      }
      if (movingRight && !canMoveRight) {
        const viewportSeconds = Math.max(
          1,
          element.clientWidth / Math.max(1, timelinePixelsPerSecond),
        );
        setTimelineDisplayDuration((previous) =>
          Math.ceil(previous + Math.max(30, viewportSeconds * 2)),
        );
      }
    };
    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleWheel);
  }, [setTimelineDisplayDuration, timelinePixelsPerSecond, timelineWheelMode]);

  return {
    assetViewportRef,
    timelineViewportRef,
    timelineScrubSurfaceRef,
    timelineThumbWidthPercent,
    timelineThumbLeftPercent,
    assetThumbHeightPercent,
    assetThumbTopPercent,
    syncTimelineScrollInfo,
    syncAssetScrollInfo,
    handleTimelineScrubStart,
    handleTimelineScrubMove,
    handleTimelineScrubEnd,
    handleTimelinePlayheadGrabStart,
    handleTimelinePlayheadGrabMove,
    handleTimelineScrollThumbStart,
    handleTimelineScrollThumbMove,
    handleTimelineScrollThumbEnd,
    handleAssetScrollThumbStart,
    handleAssetScrollThumbMove,
    handleAssetScrollThumbEnd,
    handleTimelineScaleHandleStart,
    handleTimelineScaleHandleMove,
    handleTimelineScaleHandleEnd,
    handleAssetScaleHandleStart,
    handleAssetScaleHandleMove,
    handleAssetScaleHandleEnd,
  };
};
