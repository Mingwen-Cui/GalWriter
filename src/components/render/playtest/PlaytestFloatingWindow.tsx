import { ScanSearch, ZoomIn } from 'lucide-react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

import type { PlaytestWindowBounds } from '../../../domain/project';
import type { Language } from '../../../lib/i18n';
import { getPlaytestWindowText } from './i18n/playtest-window';
import type { PlaytestWindowLayer } from './types';

type ResizeEdge =
  | 'top'
  | 'right'
  | 'bottom'
  | 'left'
  | 'top-left'
  | 'top-right'
  | 'bottom-right'
  | 'bottom-left';

type DragState = {
  pointerId: number;
  anchorX: number;
  anchorY: number;
};

type ResizeState = {
  pointerId: number;
  edge: ResizeEdge;
  startX: number;
  startY: number;
  bounds: PlaytestWindowBounds;
};

type WindowVariant = 'desktop' | 'mobile' | 'mobile-settings';

const DESKTOP_VIEWPORT_PADDING = 16;
const MOBILE_VIEWPORT_PADDING = 12;
const DESKTOP_DEFAULT_WIDTH = 760;
const DESKTOP_MIN_WIDTH = 520;
const MOBILE_MIN_WIDTH = 220;
const MOBILE_DEFAULT_MAX_WIDTH = 280;
const MOBILE_SETTINGS_MAX_WIDTH = 240;
const HOVER_SCALE = 1.18;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const normalizeAspectRatio = (value: number) =>
  Number.isFinite(value) && value > 0 ? value : 16 / 9;

const getViewportSize = () => ({
  width: typeof window === 'undefined' ? 1440 : window.visualViewport?.width || window.innerWidth,
  height: typeof window === 'undefined' ? 900 : window.visualViewport?.height || window.innerHeight,
});

const getSafeAreaInsets = () => {
  if (typeof document === 'undefined') return { top: 0, bottom: 0 };
  const styles = window.getComputedStyle(document.documentElement);
  return {
    top: Number.parseFloat(styles.getPropertyValue('--app-safe-area-top')) || 0,
    bottom: Number.parseFloat(styles.getPropertyValue('--app-safe-area-bottom')) || 0,
  };
};

const getWindowLimits = (
  aspectRatio: number,
  variant: WindowVariant,
  viewportWidth: number,
  viewportHeight: number,
) => {
  const normalizedAspectRatio = normalizeAspectRatio(aspectRatio);
  const mobile = variant !== 'desktop';
  const viewportPadding = mobile ? MOBILE_VIEWPORT_PADDING : DESKTOP_VIEWPORT_PADDING;
  const safeArea = mobile ? getSafeAreaInsets() : { top: 0, bottom: 0 };
  const topPadding = viewportPadding + safeArea.top;
  const bottomPadding = viewportPadding + safeArea.bottom;
  const availableWidth = Math.max(1, viewportWidth - viewportPadding * 2);
  const availableHeight = Math.max(1, viewportHeight - topPadding - bottomPadding);
  const profileMaximum =
    variant === 'desktop'
      ? Number.POSITIVE_INFINITY
      : variant === 'mobile-settings'
        ? MOBILE_SETTINGS_MAX_WIDTH
        : viewportWidth * 0.86;
  const maximum = Math.max(
    1,
    Math.min(availableWidth, availableHeight * normalizedAspectRatio, profileMaximum),
  );
  const minimum = Math.min(variant === 'desktop' ? DESKTOP_MIN_WIDTH : MOBILE_MIN_WIDTH, maximum);
  const defaultTarget =
    variant === 'desktop'
      ? Math.min(DESKTOP_DEFAULT_WIDTH, viewportWidth * 0.5)
      : variant === 'mobile-settings'
        ? Math.min(MOBILE_SETTINGS_MAX_WIDTH, viewportWidth * 0.56)
        : Math.min(MOBILE_DEFAULT_MAX_WIDTH, viewportWidth * 0.64);

  return {
    viewportPadding,
    topPadding,
    bottomPadding,
    minimum,
    maximum,
    defaultWidth: clamp(defaultTarget, minimum, maximum),
  };
};

const clampBounds = (
  bounds: PlaytestWindowBounds,
  aspectRatio: number,
  variant: WindowVariant,
  viewportWidth = getViewportSize().width,
  viewportHeight = getViewportSize().height,
): PlaytestWindowBounds => {
  const normalizedAspectRatio = normalizeAspectRatio(aspectRatio);
  const limits = getWindowLimits(normalizedAspectRatio, variant, viewportWidth, viewportHeight);
  const width = clamp(bounds.width, limits.minimum, limits.maximum);
  const height = width / normalizedAspectRatio;
  const maxX = Math.max(limits.viewportPadding, viewportWidth - width - limits.viewportPadding);
  const maxY = Math.max(limits.topPadding, viewportHeight - height - limits.bottomPadding);

  return {
    x: clamp(bounds.x, limits.viewportPadding, maxX),
    y: clamp(bounds.y, limits.topPadding, maxY),
    width,
    height,
  };
};

const createDefaultBounds = (aspectRatio: number, variant: WindowVariant): PlaytestWindowBounds => {
  const { width: viewportWidth, height: viewportHeight } = getViewportSize();
  const normalizedAspectRatio = normalizeAspectRatio(aspectRatio);
  const limits = getWindowLimits(normalizedAspectRatio, variant, viewportWidth, viewportHeight);
  const width = limits.defaultWidth;
  const height = width / normalizedAspectRatio;

  return clampBounds(
    {
      x: viewportWidth - width - limits.viewportPadding,
      y: viewportHeight - height - limits.bottomPadding,
      width,
      height,
    },
    normalizedAspectRatio,
    variant,
    viewportWidth,
    viewportHeight,
  );
};

const resizeHandleClass = (edge: ResizeEdge) => {
  switch (edge) {
    case 'top':
      return 'left-3 right-3 top-0 h-2 cursor-ns-resize';
    case 'right':
      return 'bottom-3 right-0 top-3 w-2 cursor-ew-resize';
    case 'bottom':
      return 'bottom-0 left-3 right-3 h-2 cursor-ns-resize';
    case 'left':
      return 'bottom-3 left-0 top-3 w-2 cursor-ew-resize';
    case 'top-left':
      return 'left-0 top-0 h-4 w-4 cursor-nwse-resize';
    case 'top-right':
      return 'right-0 top-0 h-4 w-4 cursor-nesw-resize';
    case 'bottom-right':
      return 'bottom-0 right-0 h-4 w-4 cursor-nwse-resize';
    case 'bottom-left':
      return 'bottom-0 left-0 h-4 w-4 cursor-nesw-resize';
  }
};

const resizeEdges: ResizeEdge[] = [
  'top',
  'right',
  'bottom',
  'left',
  'top-left',
  'top-right',
  'bottom-right',
  'bottom-left',
];

interface PlaytestFloatingWindowProps {
  language: Language;
  aspectRatio: number;
  initialBounds: PlaytestWindowBounds | null;
  autoScaleOnHover: boolean;
  isMobile: boolean;
  layer: PlaytestWindowLayer;
  onBoundsChange: (bounds: PlaytestWindowBounds) => void;
  onDisplayBoundsChange?: (bounds: PlaytestWindowBounds) => void;
  children: ReactNode;
}

export function PlaytestFloatingWindow({
  language,
  aspectRatio,
  initialBounds,
  autoScaleOnHover,
  isMobile,
  layer,
  onBoundsChange,
  onDisplayBoundsChange,
  children,
}: PlaytestFloatingWindowProps) {
  const text = getPlaytestWindowText(language);
  const normalizedAspectRatio = normalizeAspectRatio(aspectRatio);
  const workspaceVariant: WindowVariant = isMobile ? 'mobile' : 'desktop';
  const settingsOverlayActive = isMobile && layer === 'above-settings';
  const [workspaceBounds, setWorkspaceBounds] = useState(() =>
    initialBounds
      ? clampBounds(initialBounds, normalizedAspectRatio, workspaceVariant)
      : createDefaultBounds(normalizedAspectRatio, workspaceVariant),
  );
  const [settingsBounds, setSettingsBounds] = useState(() =>
    createDefaultBounds(normalizedAspectRatio, 'mobile-settings'),
  );
  const [hovered, setHovered] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const activeBounds = settingsOverlayActive ? settingsBounds : workspaceBounds;
  const activeVariant: WindowVariant = settingsOverlayActive ? 'mobile-settings' : workspaceVariant;
  const boundsRef = useRef(activeBounds);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const onDisplayBoundsChangeRef = useRef(onDisplayBoundsChange);
  const dragRef = useRef<DragState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);

  const updateActiveBounds = (updater: (current: PlaytestWindowBounds) => PlaytestWindowBounds) => {
    if (settingsOverlayActive) {
      setSettingsBounds(updater);
    } else {
      setWorkspaceBounds(updater);
    }
  };

  useEffect(() => {
    onBoundsChangeRef.current = onBoundsChange;
  }, [onBoundsChange]);

  useEffect(() => {
    onDisplayBoundsChangeRef.current = onDisplayBoundsChange;
  }, [onDisplayBoundsChange]);

  useEffect(() => {
    boundsRef.current = activeBounds;
    onDisplayBoundsChangeRef.current?.(activeBounds);
  }, [activeBounds]);

  useEffect(() => {
    const persistTimer = window.setTimeout(() => {
      onBoundsChangeRef.current(workspaceBounds);
    }, 120);
    return () => window.clearTimeout(persistTimer);
  }, [workspaceBounds]);

  useEffect(() => {
    if (settingsOverlayActive) {
      setSettingsBounds(createDefaultBounds(normalizedAspectRatio, 'mobile-settings'));
    }
  }, [normalizedAspectRatio, settingsOverlayActive]);

  useEffect(() => {
    setWorkspaceBounds((current) => clampBounds(current, normalizedAspectRatio, workspaceVariant));
    const handleViewportResize = () => {
      setWorkspaceBounds((current) =>
        clampBounds(current, normalizedAspectRatio, workspaceVariant),
      );
      setSettingsBounds((current) =>
        clampBounds(current, normalizedAspectRatio, 'mobile-settings'),
      );
    };
    window.addEventListener('resize', handleViewportResize);
    return () => window.removeEventListener('resize', handleViewportResize);
  }, [normalizedAspectRatio, workspaceVariant]);

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (!target.closest('[data-playtest-window-drag-handle]')) return;
    if (target.closest('button,input,select,textarea,a,[role="button"]')) return;

    const displayed = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      anchorX: clamp((event.clientX - displayed.left) / displayed.width, 0, 1),
      anchorY: clamp((event.clientY - displayed.top) / displayed.height, 0, 1),
    };
    setInteracting(true);
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const movePointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag?.pointerId === event.pointerId) {
      const current = boundsRef.current;
      updateActiveBounds(() =>
        clampBounds(
          {
            ...current,
            x: event.clientX - current.width * drag.anchorX,
            y: event.clientY - current.height * drag.anchorY,
          },
          normalizedAspectRatio,
          activeVariant,
        ),
      );
      return;
    }

    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - resize.startX;
    const deltaY = event.clientY - resize.startY;
    const horizontalWidth = resize.edge.includes('left')
      ? resize.bounds.width - deltaX
      : resize.bounds.width + deltaX;
    const verticalHeight = resize.edge.includes('top')
      ? resize.bounds.height - deltaY
      : resize.bounds.height + deltaY;
    const verticalWidth = verticalHeight * normalizedAspectRatio;
    const usesHorizontalEdge = resize.edge.includes('left') || resize.edge.includes('right');
    const usesVerticalEdge = resize.edge.includes('top') || resize.edge.includes('bottom');
    const width =
      usesHorizontalEdge && usesVerticalEdge
        ? Math.abs(horizontalWidth - resize.bounds.width) >=
          Math.abs(verticalWidth - resize.bounds.width)
          ? horizontalWidth
          : verticalWidth
        : usesHorizontalEdge
          ? horizontalWidth
          : verticalWidth;
    const height = width / normalizedAspectRatio;
    const next = {
      ...resize.bounds,
      width,
      height,
      x: resize.edge.includes('left')
        ? resize.bounds.x + resize.bounds.width - width
        : usesHorizontalEdge
          ? resize.bounds.x
          : resize.bounds.x + (resize.bounds.width - width) / 2,
      y: resize.edge.includes('top')
        ? resize.bounds.y + resize.bounds.height - height
        : usesVerticalEdge
          ? resize.bounds.y
          : resize.bounds.y + (resize.bounds.height - height) / 2,
    };

    updateActiveBounds(() => clampBounds(next, normalizedAspectRatio, activeVariant));
  };

  const endPointerInteraction = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      dragRef.current?.pointerId !== event.pointerId &&
      resizeRef.current?.pointerId !== event.pointerId
    ) {
      return;
    }
    dragRef.current = null;
    resizeRef.current = null;
    setInteracting(false);
  };

  const beginResize = (edge: ResizeEdge) => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    resizeRef.current = {
      pointerId: event.pointerId,
      edge,
      startX: event.clientX,
      startY: event.clientY,
      bounds: boundsRef.current,
    };
    setInteracting(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const hoverScale = !isMobile && autoScaleOnHover && hovered && !interacting ? HOVER_SCALE : 1;
  const viewport = getViewportSize();
  const activeLimits = getWindowLimits(
    normalizedAspectRatio,
    activeVariant,
    viewport.width,
    viewport.height,
  );
  const horizontalOrigin =
    activeBounds.x <= activeLimits.viewportPadding * 2
      ? 'left'
      : activeBounds.x + activeBounds.width >= viewport.width - activeLimits.viewportPadding * 2
        ? 'right'
        : 'center';
  const verticalOrigin =
    activeBounds.y <= activeLimits.topPadding + activeLimits.viewportPadding
      ? 'top'
      : activeBounds.y + activeBounds.height >=
          viewport.height - activeLimits.bottomPadding - activeLimits.viewportPadding
        ? 'bottom'
        : 'center';
  const style: CSSProperties = {
    left: activeBounds.x,
    top: activeBounds.y,
    width: activeBounds.width,
    height: activeBounds.height,
    transform: `scale(${hoverScale})`,
    transformOrigin: `${horizontalOrigin} ${verticalOrigin}`,
  };

  return (
    <div
      className={`pointer-events-none fixed inset-0 ${
        layer === 'above-settings' ? 'z-[400]' : 'z-[100]'
      }`}
    >
      <div
        role="dialog"
        aria-label={text.windowTitle}
        className={`pointer-events-auto absolute overflow-visible rounded-[18px] shadow-2xl shadow-slate-950/35 ${
          interacting ? 'transition-none' : 'transition-transform duration-200 ease-out'
        }`}
        style={style}
        onPointerDownCapture={beginDrag}
        onPointerMove={movePointer}
        onPointerUp={endPointerInteraction}
        onPointerCancel={endPointerInteraction}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        {(isMobile ? (['bottom-right'] as ResizeEdge[]) : resizeEdges).map((edge) => (
          <div
            key={edge}
            role="separator"
            aria-label={text.resizeWindow}
            className={`absolute z-[400] touch-none ${
              isMobile ? '-bottom-2 -right-2 h-8 w-8 cursor-nwse-resize' : resizeHandleClass(edge)
            }`}
            onPointerDown={beginResize(edge)}
          />
        ))}
        {children}
      </div>
    </div>
  );
}

interface PlaytestWindowActionsProps {
  language: Language;
  isDarkMode: boolean;
  immersive: boolean;
  buttonClassName: string;
  followSelectedCard: boolean;
  hasSelectedCard: boolean;
  autoScaleOnHover: boolean;
  showAutoScale?: boolean;
  onFollowSelectedCardChange: (active: boolean) => void;
  onAutoScaleOnHoverChange: (active: boolean) => void;
}

export function PlaytestWindowActions({
  language,
  isDarkMode,
  immersive,
  buttonClassName,
  followSelectedCard,
  hasSelectedCard,
  autoScaleOnHover,
  showAutoScale = true,
  onFollowSelectedCardChange,
  onAutoScaleOnHoverChange,
}: PlaytestWindowActionsProps) {
  const text = getPlaytestWindowText(language);
  const idleClass = immersive
    ? 'bg-white/10 text-white hover:bg-white/20'
    : isDarkMode
      ? 'bg-white/10 text-white hover:bg-white/20'
      : 'bg-slate-100 text-slate-600 hover:bg-slate-200';

  return (
    <>
      <button
        type="button"
        onClick={() => onFollowSelectedCardChange(!followSelectedCard)}
        className={`${buttonClassName} transition-colors ${
          followSelectedCard ? 'bg-sky-500/85 text-white hover:bg-sky-500' : idleClass
        }`}
        title={
          !hasSelectedCard
            ? text.followSelectedCardEmpty
            : followSelectedCard
              ? text.followSelectedCardActive
              : text.followSelectedCardInactive
        }
        aria-label={text.followSelectedCard}
        aria-pressed={followSelectedCard}
      >
        <ScanSearch className="h-5 w-5" />
      </button>
      {showAutoScale ? (
        <button
          type="button"
          onClick={() => onAutoScaleOnHoverChange(!autoScaleOnHover)}
          className={`${buttonClassName} transition-colors ${
            autoScaleOnHover ? 'bg-violet-500/85 text-white hover:bg-violet-500' : idleClass
          }`}
          title={autoScaleOnHover ? text.autoScaleActive : text.autoScaleInactive}
          aria-label={text.autoScale}
          aria-pressed={autoScaleOnHover}
        >
          <ZoomIn className="h-5 w-5" />
        </button>
      ) : null}
    </>
  );
}
