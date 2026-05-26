import { RotateCw, X } from 'lucide-react';
import React, { memo, useCallback, useRef, useState } from 'react';

type PanoramaViewerProps = {
  imageUrl: string;
  className?: string;
  compact?: boolean;
  onExpand?: () => void;
};

export function PanoramaViewer({
  imageUrl,
  className = '',
  compact = false,
  onExpand,
}: PanoramaViewerProps) {
  const [yaw, setYaw] = useState(50);
  const [pitch, setPitch] = useState(50);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setYaw((v) => Math.max(0, Math.min(100, v - dx * 0.25)));
    setPitch((v) => Math.max(25, Math.min(75, v - dy * 0.25)));
  }, []);

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-blue-700/30 bg-blue-950/20 ${compact ? 'h-20' : 'h-28'} ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={onExpand}
      style={{ touchAction: 'none' }}
    >
      <div
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        style={{
          backgroundImage: `url(${imageUrl})`,
          backgroundSize: 'auto 100%',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: `${yaw}% ${pitch}%`,
        }}
      />
      <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-blue-900/80 text-[9px] font-bold text-blue-100 flex items-center gap-0.5 pointer-events-none">
        <RotateCw className="w-2.5 h-2.5" />
        360°
      </div>
      {!compact && (
        <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/50 text-[9px] text-white/80 pointer-events-none">
          拖拽浏览 · 双击放大
        </div>
      )}
    </div>
  );
}

type PanoramaModalProps = {
  imageUrl: string;
  title?: string;
  onClose: () => void;
};

export function PanoramaModal({ imageUrl, title, onClose }: PanoramaModalProps) {
  const [yaw, setYaw] = useState(50);
  const [pitch, setPitch] = useState(50);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setYaw((v) => Math.max(0, Math.min(100, v - dx * 0.15)));
    setPitch((v) => Math.max(20, Math.min(80, v - dy * 0.15)));
  }, []);

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/85 flex flex-col" onClick={onClose}>
      <div
        className="flex items-center justify-between px-4 py-3 bg-blue-950/90 border-b border-blue-800/50"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-sm font-bold text-blue-100">{title || '360° 全景预览'}</span>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-blue-200 hover:bg-blue-800/50 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div
        className="flex-1 relative cursor-grab active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ touchAction: 'none' }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${imageUrl})`,
            backgroundSize: 'auto 100%',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: `${yaw}% ${pitch}%`,
          }}
        />
      </div>
    </div>
  );
}

export const MemoizedPanoramaViewer = memo(PanoramaViewer);
