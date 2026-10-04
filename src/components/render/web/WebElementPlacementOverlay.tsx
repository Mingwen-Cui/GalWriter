import { Image, MousePointerClick, Plus, Type } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Language } from '../../../lib/i18n';
import { WebShapeIcon } from './WebShapeAddControl';
import { webShapeMarkup } from './webShapes';
import { placementGeometry, snapLineEnd } from './webElementPlacement';
import type { PlacementGeometry, PlacementPoint, WebPlacementTool } from './webElementPlacement';

export function WebElementPlacementOverlay({
  tool,
  canvasWidth,
  canvasHeight,
  language,
  onPlace,
  onCancel,
}: {
  tool: WebPlacementTool;
  canvasWidth: number;
  canvasHeight: number;
  language: Language;
  onPlace: (geometry: PlacementGeometry) => void;
  onCancel: () => void;
}) {
  const [point, setPoint] = useState<PlacementPoint | null>(null);
  const [geometry, setGeometry] = useState<PlacementGeometry | null>(null);
  const [lineStart, setLineStart] = useState<PlacementPoint | null>(null);
  const isLine = tool.kind === 'shape' && tool.shapeType === 'line';
  const drag = useRef<{
    start: PlacementPoint;
    clientX: number;
    clientY: number;
    pointerId: number;
    moved: boolean;
  } | null>(null);
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    };
    window.addEventListener('keydown', cancel, true);
    return () => window.removeEventListener('keydown', cancel, true);
  }, [onCancel]);
  const position = (
    event: React.PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>,
  ): PlacementPoint => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)),
    };
  };
  const preview = isLine
    ? geometry
    : geometry || (point && placementGeometry(tool, point, null, canvasWidth, canvasHeight));
  const hint = isLine
    ? language === 'zh'
      ? `${lineStart ? '点击确定终点' : '点击确定起点'} · Ctrl 吸附 45° · Esc 取消`
      : language === 'ja'
        ? `${lineStart ? '終点をクリック' : '始点をクリック'} · Esc で取消`
        : `${lineStart ? 'Click the end point' : 'Click the start point'} · Esc to cancel`
    : language === 'zh'
      ? '点击放置 · 按住拖动定大小 · Esc 取消'
      : language === 'ja'
        ? 'クリックで配置 · ドラッグでサイズ指定 · Esc で取消'
        : 'Click to place · Drag to size · Esc to cancel';
  const label =
    tool.kind === 'text'
      ? language === 'zh'
        ? '文字'
        : language === 'ja'
          ? 'テキスト'
          : 'Text'
      : tool.kind === 'image'
        ? language === 'zh'
          ? '图片'
          : language === 'ja'
            ? '画像'
            : 'Image'
        : language === 'zh'
          ? '按钮'
          : language === 'ja'
            ? 'ボタン'
            : 'Button';
  const Icon = tool.kind === 'text' ? Type : tool.kind === 'image' ? Image : MousePointerClick;
  return (
    <div
      data-web-placement-tool={tool.shapeType || tool.kind}
      className="absolute inset-0 z-[2000] touch-none select-none"
      style={{ cursor: isLine ? 'crosshair' : 'none' }}
      onContextMenu={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onPointerDown={(event) => {
        if (event.button !== 0 || !event.isPrimary) return;
        event.preventDefault();
        event.stopPropagation();
        if (isLine) return;
        const start = position(event);
        drag.current = {
          start,
          clientX: event.clientX,
          clientY: event.clientY,
          pointerId: event.pointerId,
          moved: false,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        setPoint(start);
        setGeometry(placementGeometry(tool, start, null, canvasWidth, canvasHeight));
      }}
      onPointerMove={(event) => {
        const next = position(event);
        setPoint(next);
        if (isLine) {
          const end = lineStart && (event.ctrlKey || event.metaKey) ? snapLineEnd(lineStart, next, canvasWidth, canvasHeight) : next;
          setGeometry(
            lineStart ? placementGeometry(tool, lineStart, end, canvasWidth, canvasHeight) : null,
          );
          return;
        }
        const active = drag.current;
        if (!active || active.pointerId !== event.pointerId) return;
        active.moved ||=
          Math.hypot(event.clientX - active.clientX, event.clientY - active.clientY) >= 4;
        setGeometry(
          placementGeometry(
            tool,
            active.start,
            active.moved ? next : null,
            canvasWidth,
            canvasHeight,
          ),
        );
      }}
      onPointerUp={(event) => {
        const active = drag.current;
        if (!active || active.pointerId !== event.pointerId || event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        // Recompute at release so a fast drag cannot commit a stale React frame.
        const moved =
          active.moved ||
          Math.hypot(event.clientX - active.clientX, event.clientY - active.clientY) >= 4;
        const result = placementGeometry(
          tool,
          active.start,
          moved ? position(event) : null,
          canvasWidth,
          canvasHeight,
        );
        drag.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
        onPlace(result);
      }}
      onPointerCancel={() => {
        drag.current = null;
        onCancel();
      }}
      onLostPointerCapture={() => {
        if (drag.current) {
          drag.current = null;
          onCancel();
        }
      }}
      onPointerLeave={() => {
        if (!drag.current) {
          setPoint(null);
          setGeometry(null);
        }
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!isLine) return;
        const next = position(event);
        if (!lineStart) {
          setLineStart(next);
          setGeometry(null);
          return;
        }
        if (
          Math.hypot(
            ((next.x - lineStart.x) * canvasWidth) / 100,
            ((next.y - lineStart.y) * canvasHeight) / 100,
          ) < 1
        )
          return;
        const end = event.ctrlKey || event.metaKey ? snapLineEnd(lineStart, next, canvasWidth, canvasHeight) : next;
        onPlace(placementGeometry(tool, lineStart, end, canvasWidth, canvasHeight));
      }}
    >
      {preview && (
        <div
          data-web-placement-preview
          className="pointer-events-none absolute opacity-70"
          style={{
            left: `${preview.x}%`,
            top: `${preview.y}%`,
            width: `${preview.width}%`,
            height: `${preview.height}%`,
            transform: `rotate(${preview.rotation}deg)`,
          }}
        >
          {tool.kind === 'shape' ? (
            <span
              className="absolute inset-0"
              dangerouslySetInnerHTML={{
                __html: webShapeMarkup(
                  {
                    id: 'placement-preview',
                    ...tool,
                    ...preview,
                    role: 'custom',
                    text: '',
                    visible: true,
                    scale: 1,
                    backgroundColor: '#eef2ff',
                    borderColor: tool.shapeType === 'line' ? '#c4c8dc' : '#625bf6',
                    borderWidth: tool.shapeType === 'line' ? 2 : 1,
                    borderRadius: tool.shapeType === 'rounded' ? 20 : 0,
                  },
                  canvasWidth,
                  canvasHeight,
                ),
              }}
            />
          ) : (
            <div
              className={`flex h-full w-full items-center justify-center gap-2 border border-dashed border-indigo-500 text-indigo-600 ${tool.kind === 'button' ? 'rounded-full bg-indigo-100' : 'rounded-lg bg-indigo-50/80'}`}
            >
              <Icon className="h-6 w-6 shrink-0" />
              <span>{label}</span>
            </div>
          )}
        </div>
      )}
      {lineStart && (
        <div
          data-web-line-start
          className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600 ring-2 ring-white"
          style={{ left: `${lineStart.x}%`, top: `${lineStart.y}%` }}
        />
      )}
      {point && !isLine && (
        <div
          className="pointer-events-none absolute flex items-center gap-2 text-indigo-600"
          style={{ left: `${point.x}%`, top: `${point.y}%`, transform: 'translate(-6px, -6px)' }}
        >
          <Plus className="h-3 w-3 shrink-0" strokeWidth={1.5} />
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-indigo-200 bg-white shadow-sm">
            {tool.kind === 'shape' ? (
              <WebShapeIcon type={tool.shapeType || 'rectangle'} />
            ) : (
              <Icon className="h-5 w-5" />
            )}
          </span>
        </div>
      )}
      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-indigo-200 bg-white/95 px-4 py-2 text-sm font-medium text-indigo-600 shadow-sm">
        {hint}
      </div>
    </div>
  );
}
