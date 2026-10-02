import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { WebMenuElement } from '../video/shared/types';

/** Keep editing handles above other objects without raising the shape itself. */
export function WebShapeSelectionOverlay({
  element,
  children,
  enabled = true,
}: {
  element: WebMenuElement;
  children: ReactNode;
  enabled?: boolean;
}) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (enabled) setHost(anchor.current?.parentElement?.parentElement || null);
  }, [enabled]);
  if (!enabled) return <>{children}</>;
  return (
    <>
      <span ref={anchor} hidden />
      {host &&
        createPortal(
          <div
            data-shape-selection-overlay={element.id}
            className="pointer-events-none absolute origin-center"
            style={{
              left: `${element.x}%`,
              top: `${element.y}%`,
              width: `${element.width}%`,
              height: `${element.height}%`,
              transform: `rotate(${element.rotation || 0}deg) scale(${element.scale || 1})`,
              zIndex: 1000,
            }}
          >
            {children}
          </div>,
          host,
        )}
    </>
  );
}
