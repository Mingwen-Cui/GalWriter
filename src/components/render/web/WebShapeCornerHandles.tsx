import { useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Language } from '../../../lib/i18n';
import type { WebMenuElement } from '../video/shared/types';
import {
  constrainWebShapeSize,
  webPolygonSides,
  webShapeCornerRadiusPatch,
  webShapeVertices,
} from './webShapes';
import { WebPolygonSidesControl } from './WebPolygonSidesControl';

const rectangleCornerKeys = [
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomRightRadius',
  'borderBottomLeftRadius',
] as const;

/** Shared by every editable Web surface, inside the shape's raised selection overlay. */
export function WebShapeCornerHandles({
  element,
  language,
  onUpdate,
}: {
  element: WebMenuElement;
  language: Language;
  onUpdate: (id: string, patch: Partial<WebMenuElement>) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({
    width: 0,
    height: 0,
    scale: 1,
    canvasWidth: 1920,
    canvasHeight: 1080,
  });
  const drag = useRef<{
    index: number;
    pointerId: number;
    startX: number;
    startY: number;
    radius: number;
    direction: { x: number; y: number };
    max: number;
    scale: number;
    angle: number;
  } | null>(null);
  const polygon = element.shapeType === 'polygon' || element.shapeType === 'triangle';
  const enabled =
    element.kind === 'shape' &&
    (polygon || element.shapeType === 'rectangle' || element.shapeType === 'rounded');
  useLayoutEffect(() => {
    if (!enabled || !root.current) return;
    const node = root.current;
    const stage = node.closest<HTMLElement>('[data-presentation-width]');
    const measure = () => {
      const stageScale = stage ? stage.getBoundingClientRect().width / stage.offsetWidth : 1;
      setSize({
        width: node.offsetWidth,
        height: node.offsetHeight,
        scale: Math.max(0.001, stageScale * (element.scale || 1)),
        canvasWidth:
          Number(stage?.getAttribute('data-presentation-width')) ||
          node.parentElement?.parentElement?.clientWidth ||
          1920,
        canvasHeight:
          Number(stage?.getAttribute('data-presentation-height')) ||
          node.parentElement?.parentElement?.clientHeight ||
          1080,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    if (stage?.parentElement) observer.observe(stage.parentElement);
    return () => observer.disconnect();
  }, [enabled, element.scale]);
  if (!enabled || !size.width || !size.height)
    return <div ref={root} className="pointer-events-none absolute inset-0" />;
  const vertices = webShapeVertices(element, size.width, size.height);
  const count = vertices.length;
  const radii = vertices.map((_, index) =>
    Math.max(
      0,
      polygon
        ? (element.polygonCornerRadii?.[index] ?? element.borderRadius ?? 0)
        : (element[rectangleCornerKeys[index]] ?? element.borderRadius ?? 0),
    ),
  );
  const copy =
    language === 'zh'
      ? { radius: '圆角', sides: '边数' }
      : language === 'ja'
        ? { radius: '角丸', sides: '辺の数' }
        : { radius: 'Corner radius', sides: 'Sides' };
  const commitRadius = (_index: number, radius: number) => {
    onUpdate(element.id, webShapeCornerRadiusPatch(element, radius));
  };
  const move = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const dx = (event.clientX - active.startX) / active.scale,
      dy = (event.clientY - active.startY) / active.scale;
    const localX = Math.cos(active.angle) * dx + Math.sin(active.angle) * dy;
    const localY = -Math.sin(active.angle) * dx + Math.cos(active.angle) * dy;
    const change = localX * active.direction.x + localY * active.direction.y;
    commitRadius(
      active.index,
      Math.round(Math.max(0, Math.min(active.max, active.radius + change))),
    );
  };
  return (
    <div ref={root} className="pointer-events-none absolute inset-0">
      {vertices.map((vertex, index) => {
        const previous = vertices[(index + count - 1) % count],
          next = vertices[(index + 1) % count];
        const before = Math.hypot(previous.x - vertex.x, previous.y - vertex.y),
          after = Math.hypot(next.x - vertex.x, next.y - vertex.y);
        const u = { x: (previous.x - vertex.x) / before, y: (previous.y - vertex.y) / before };
        const v = { x: (next.x - vertex.x) / after, y: (next.y - vertex.y) / after };
        const length = Math.hypot(u.x + v.x, u.y + v.y);
        const direction = { x: (u.x + v.x) / length, y: (u.y + v.y) / length };
        const max =
          (Math.min(before, after) / 2) *
          Math.tan(Math.acos(Math.max(-1, Math.min(1, u.x * v.x + u.y * v.y))) / 2);
        const distance = Math.min(14 / size.scale + radii[index], Math.min(before, after) * 0.4);
        const label = `${copy.radius} ${index + 1}`;
        return (
          <button
            key={index}
            type="button"
            data-web-corner-handle={index}
            aria-label={label}
            title={`${label}: ${Math.round(radii[index])}px`}
            className="group pointer-events-auto absolute z-[10000] grid place-items-center rounded-full bg-transparent focus-visible:outline-2 focus-visible:outline-indigo-500"
            style={{
              left: vertex.x + direction.x * distance,
              top: vertex.y + direction.y * distance,
              width: 18 / size.scale,
              height: 18 / size.scale,
              transform: 'translate(-50%, -50%)',
              cursor: 'nwse-resize',
              touchAction: 'none',
            }}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              event.stopPropagation();
              drag.current = {
                index,
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                radius: radii[index],
                direction,
                max,
                scale: size.scale,
                angle: ((element.rotation || 0) * Math.PI) / 180,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={move}
            onPointerUp={(event) => {
              if (drag.current?.pointerId !== event.pointerId) return;
              move(event);
              drag.current = null;
              event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
            onLostPointerCapture={() => {
              drag.current = null;
            }}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (!['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(event.key)) return;
              event.preventDefault();
              event.stopPropagation();
              const change = ['ArrowUp', 'ArrowRight'].includes(event.key) ? 1 : -1;
              commitRadius(
                index,
                Math.max(0, Math.min(max, radii[index] + change * (event.shiftKey ? 10 : 1))),
              );
            }}
          >
            <span
              className="block rounded-full border border-indigo-500/90 bg-white shadow-[0_1px_3px_rgba(49,46,129,0.15)] ring-1 ring-white/90 transition-colors group-hover:bg-indigo-50 group-hover:border-indigo-600"
              style={{ width: 7 / size.scale, height: 7 / size.scale }}
            />
          </button>
        );
      })}
      {polygon && (
        <div
          className="pointer-events-auto absolute bottom-0 left-full z-[10000] ml-3"
          style={{
            transform: `rotate(${-(element.rotation || 0)}deg) scale(${1 / size.scale})`,
            transformOrigin: 'left bottom',
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <WebPolygonSidesControl
            language={language}
            value={count}
            onChange={(value) => {
              const polygonSides = webPolygonSides({
                ...element,
                polygonSides: value,
              });
              onUpdate(
                element.id,
                constrainWebShapeSize(
                  element,
                  {
                    shapeType: 'polygon',
                    polygonSides,
                    polygonCornerRadii: Array.from(
                      { length: polygonSides },
                      (_, index) => radii[index] ?? element.borderRadius ?? 0,
                    ),
                  },
                  size.canvasWidth,
                  size.canvasHeight,
                ),
              );
            }}
          />
        </div>
      )}
    </div>
  );
}
