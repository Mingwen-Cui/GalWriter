import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  PanOnScrollMode,
  ReactFlow,
  SelectionMode,
} from '@xyflow/react';
import type { ComponentProps, CSSProperties, MouseEventHandler, RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';

import { SelectionMenu } from '../../editor-features/selection-tools/SelectionMenu';
import { SmartGuides } from './SmartGuides';

type ReactFlowProps = ComponentProps<typeof ReactFlow>;
type SelectionMenuProps = ComponentProps<typeof SelectionMenu>;

interface StoryCanvasWorkspaceProps {
  bubbleStyle: 'glass' | 'flat';
  canvasTouchAction: CSSProperties['touchAction'];
  canvasWrapperRef: RefObject<HTMLDivElement | null>;
  selectionBoxRef: RefObject<HTMLDivElement | null>;
  onMouseDown: MouseEventHandler<HTMLDivElement>;
  onMouseMove: MouseEventHandler<HTMLDivElement>;
  onMouseUp: MouseEventHandler<HTMLDivElement>;
  onBackgroundCardPlacementStart?: MouseEventHandler<HTMLDivElement>;
  onBackgroundCardPlacementEnd?: MouseEventHandler<HTMLDivElement>;
  onDynamicWrapSelectionStart?: MouseEventHandler<HTMLDivElement>;
  onDynamicWrapSelectionEnd?: MouseEventHandler<HTMLDivElement>;
  reactFlowProps: ReactFlowProps;
  interactionMode: 'select' | 'box';
  isRightDragging: boolean;
  scrollMode: 'zoom' | 'pan';
  resolvedTheme: 'light' | 'dark';
  showMiniMap: boolean;
  showControls: boolean;
  showStats: boolean;
  miniMapPosition: 'left' | 'right';
  miniMapOverlayStyle?: CSSProperties;
  horizontalGuides: number[];
  verticalGuides: number[];
  cardPlacementPreviewKind?:
    | 'story'
    | 'background'
    | 'dynamicWrap'
    | 'bodyText'
    | 'headingText'
    | null;
  cardPlacementPreviewTitle?: string;
  cardPlacementStartScreen?: { x: number; y: number };
  storyCardPlacementPreviewScale?: number;
  selectionMenuProps?: SelectionMenuProps;
}

export function StoryCanvasWorkspace({
  bubbleStyle,
  canvasTouchAction,
  canvasWrapperRef,
  selectionBoxRef,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onBackgroundCardPlacementStart,
  onBackgroundCardPlacementEnd,
  onDynamicWrapSelectionStart,
  onDynamicWrapSelectionEnd,
  reactFlowProps,
  interactionMode,
  isRightDragging,
  scrollMode,
  resolvedTheme,
  showMiniMap,
  showControls,
  showStats,
  miniMapPosition,
  miniMapOverlayStyle,
  horizontalGuides,
  verticalGuides,
  cardPlacementPreviewKind = null,
  cardPlacementPreviewTitle = '',
  cardPlacementStartScreen,
  storyCardPlacementPreviewScale = 1,
  selectionMenuProps,
}: StoryCanvasWorkspaceProps) {
  const overlayPositionClass = miniMapPosition === 'left' ? 'left-4' : 'right-4';
  const footerSpacingClass = showStats ? '' : 'canvas-bottom-overlay-no-footer';
  const placementPreviewRef = useRef<HTMLDivElement>(null);
  const regionPlacementPreviewRef = useRef<HTMLDivElement>(null);
  const isPlacementPreviewVisibleRef = useRef(false);
  const [isPlacementPreviewVisible, setIsPlacementPreviewVisible] = useState(false);
  const placementPreviewScale = Math.max(0.1, storyCardPlacementPreviewScale);
  const placementPreviewSize =
    cardPlacementPreviewKind === 'headingText'
      ? { width: 320, height: 90 }
      : cardPlacementPreviewKind === 'bodyText'
        ? { width: 200, height: 60 }
        : { width: 300, height: 176 };
  const isPointPlacement =
    cardPlacementPreviewKind === 'story' ||
    cardPlacementPreviewKind === 'bodyText' ||
    cardPlacementPreviewKind === 'headingText';

  useEffect(() => {
    if (!cardPlacementPreviewKind) {
      isPlacementPreviewVisibleRef.current = false;
      setIsPlacementPreviewVisible(false);
    }
  }, [cardPlacementPreviewKind]);

  const handleCanvasMouseMove: MouseEventHandler<HTMLDivElement> = (event) => {
    onMouseMove(event);
    if (isPointPlacement && !cardPlacementStartScreen && placementPreviewRef.current) {
      placementPreviewRef.current.style.left = `${event.clientX - (placementPreviewSize.width / 2) * placementPreviewScale}px`;
      placementPreviewRef.current.style.top = `${event.clientY - (placementPreviewSize.height / 2) * placementPreviewScale}px`;
      if (!isPlacementPreviewVisibleRef.current) {
        isPlacementPreviewVisibleRef.current = true;
        setIsPlacementPreviewVisible(true);
      }
    }

    if (cardPlacementStartScreen && regionPlacementPreviewRef.current) {
      const left = Math.min(cardPlacementStartScreen.x, event.clientX);
      const top = Math.min(cardPlacementStartScreen.y, event.clientY);
      regionPlacementPreviewRef.current.style.left = `${left}px`;
      regionPlacementPreviewRef.current.style.top = `${top}px`;
      regionPlacementPreviewRef.current.style.width = `${Math.abs(event.clientX - cardPlacementStartScreen.x)}px`;
      regionPlacementPreviewRef.current.style.height = `${Math.abs(event.clientY - cardPlacementStartScreen.y)}px`;
    }
  };

  return (
    <>
      <div
        ref={canvasWrapperRef}
        className={`relative h-full w-full ${bubbleStyle === 'glass' ? 'bubble-glass-mode' : 'bubble-flat-mode'}`}
        onMouseDownCapture={(event) => {
          onMouseDown(event);
          onBackgroundCardPlacementStart?.(event);
          onDynamicWrapSelectionStart?.(event);
        }}
        onMouseMoveCapture={handleCanvasMouseMove}
        onMouseUpCapture={(event) => {
          onMouseUp(event);
          onBackgroundCardPlacementEnd?.(event);
          onDynamicWrapSelectionEnd?.(event);
        }}
        onMouseLeave={() => {
          isPlacementPreviewVisibleRef.current = false;
          setIsPlacementPreviewVisible(false);
        }}
        style={{ touchAction: canvasTouchAction }}
      >
        {isPointPlacement && !cardPlacementStartScreen && (
          <div
            ref={placementPreviewRef}
            aria-hidden="true"
            className={`card-placement-preview card-placement-preview--${cardPlacementPreviewKind}${isPlacementPreviewVisible ? ' card-placement-preview--visible' : ''}`}
            style={{
              width: placementPreviewSize.width,
              height: placementPreviewSize.height,
              transform: `scale(${placementPreviewScale})`,
            }}
          >
            <span>{cardPlacementPreviewTitle}</span>
          </div>
        )}
        {cardPlacementStartScreen && cardPlacementPreviewKind !== 'story' && (
          <div
            ref={regionPlacementPreviewRef}
            aria-hidden="true"
            className={`region-placement-preview region-placement-preview--${cardPlacementPreviewKind}`}
            style={{ left: cardPlacementStartScreen.x, top: cardPlacementStartScreen.y }}
          />
        )}
        <div
          ref={selectionBoxRef}
          className="pointer-events-none fixed z-[9999] rounded-sm border-2 border-dashed border-indigo-500 bg-indigo-500/10"
          style={{ display: 'none' }}
        />
        <ReactFlow
          {...reactFlowProps}
          connectionMode={ConnectionMode.Loose}
          panOnDrag={isRightDragging ? false : interactionMode === 'select' ? [0] : false}
          selectionOnDrag={false}
          selectionMode={SelectionMode.Partial}
          panOnScroll={scrollMode === 'pan'}
          zoomOnScroll={scrollMode === 'zoom'}
          panOnScrollMode={scrollMode === 'pan' ? PanOnScrollMode.Vertical : undefined}
          selectionKeyCode="Shift"
          deleteKeyCode={null}
          proOptions={{ hideAttribution: true }}
          fitView
          fitViewOptions={{ padding: 0.45 }}
          minZoom={0.1}
          maxZoom={1.5}
        >
          <Background
            variant={BackgroundVariant.Dots}
            color={resolvedTheme === 'dark' ? '#334155' : '#cbd5e1'}
            gap={24}
            size={1}
          />
          {showMiniMap && (
            <div
              className={`canvas-bottom-overlay ${footerSpacingClass} toolbar-bubble-surface absolute ${overlayPositionClass} bottom-4 z-[50] flex flex-col overflow-hidden rounded-xl border border-[var(--toolbar-border)] bg-[var(--toolbar-bg)] shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-4 duration-300`}
              style={miniMapOverlayStyle}
            >
              <div className="minimap-clip w-full overflow-hidden rounded-t-xl">
                <MiniMap
                  pannable
                  zoomable
                  className="!static !m-0 !block !border-none !bg-transparent"
                  nodeColor={bubbleStyle === 'glass' ? 'rgba(255, 255, 255, 0.38)' : '#dbeafe'}
                  nodeStrokeColor={
                    bubbleStyle === 'glass' ? 'rgba(255, 255, 255, 0.78)' : '#4f46e5'
                  }
                  nodeBorderRadius={6}
                  maskColor={
                    bubbleStyle === 'glass'
                      ? resolvedTheme === 'dark'
                        ? 'rgba(0, 0, 0, 0.3)'
                        : 'rgba(0, 0, 0, 0.08)'
                      : resolvedTheme === 'dark'
                        ? 'rgba(84, 185, 251, 0.12)'
                        : 'rgba(79, 70, 229, 0.08)'
                  }
                  style={{ height: 120, width: 160 }}
                />
              </div>
              {showControls && (
                <div className="minimap-controls flex h-8 w-full items-center border-t border-[var(--toolbar-border)] bg-transparent">
                  <Controls
                    showInteractive={false}
                    showZoom
                    showFitView
                    orientation="horizontal"
                    className="!static !m-0 !flex !h-full !w-full !flex-row !items-center !justify-around !gap-0 !border-none !bg-transparent !p-0 !shadow-none"
                  />
                </div>
              )}
            </div>
          )}
          {!showMiniMap && showControls && (
            <div
              className={`canvas-bottom-overlay ${footerSpacingClass} toolbar-bubble-surface absolute ${overlayPositionClass} bottom-4 z-[50] h-8 w-40 overflow-hidden rounded-xl border border-[var(--toolbar-border)] bg-[var(--toolbar-bg)] shadow-xl backdrop-blur-md animate-in slide-in-from-bottom-4 duration-300`}
              style={miniMapOverlayStyle}
            >
              <Controls
                showInteractive={false}
                showZoom
                showFitView
                orientation="horizontal"
                className="!static !m-0 !flex !h-full !w-full !flex-row !items-center !justify-around !gap-0 !border-none !bg-transparent !p-0 !shadow-none"
              />
            </div>
          )}
          <SmartGuides hLines={horizontalGuides} vLines={verticalGuides} />
        </ReactFlow>
      </div>

      {selectionMenuProps && <SelectionMenu {...selectionMenuProps} />}
    </>
  );
}
