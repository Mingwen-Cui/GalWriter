import React, { useLayoutEffect, useRef, useState } from 'react';

export const PRESENTATION_STAGE_WIDTH = 1920;
export const PRESENTATION_STAGE_HEIGHT = 1080;

type VirtualPresentationStageProps = {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  fit?: 'contain' | 'cover' | 'width';
};

export function VirtualPresentationStage({
  children,
  className = '',
  style,
  fit = 'contain',
}: VirtualPresentationStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ scale: 0, left: 0, top: 0 });

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateLayout = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      const scaleByWidth = width / PRESENTATION_STAGE_WIDTH;
      const scaleByHeight = height / PRESENTATION_STAGE_HEIGHT;
      const scale =
        fit === 'width'
          ? scaleByWidth
          : fit === 'cover'
            ? Math.max(scaleByWidth, scaleByHeight)
            : Math.min(scaleByWidth, scaleByHeight);
      const stageWidth = PRESENTATION_STAGE_WIDTH * scale;
      const stageHeight = PRESENTATION_STAGE_HEIGHT * scale;
      setLayout({
        scale,
        left: (width - stageWidth) / 2,
        top: fit === 'width' ? Math.max(0, (height - stageHeight) / 2) : (height - stageHeight) / 2,
      });
    };

    updateLayout();
    const observer = new ResizeObserver(updateLayout);
    observer.observe(container);
    return () => observer.disconnect();
  }, [fit]);

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className}`} style={style}>
      <div
        className="absolute overflow-hidden"
        style={{
          width: PRESENTATION_STAGE_WIDTH,
          height: PRESENTATION_STAGE_HEIGHT,
          left: layout.left,
          top: layout.top,
          opacity: layout.scale > 0 ? 1 : 0,
          transform: `scale(${layout.scale})`,
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
    </div>
  );
}
