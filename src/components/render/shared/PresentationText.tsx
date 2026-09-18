import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { mountPresentationText, presentTextBlock } from './presentationTextDom';
import type { CSSProperties } from 'react';
import type { RenderStyle } from '../video/shared/types';
import { preparePresentationFonts, resolveDialogueTextLayout } from './presentationTextLayout';
import type { TextBlockLayout } from './presentationTextLayout';

export function useDialogueTextLayout(
  style: RenderStyle,
  width: number,
  height: number,
  title: string,
  body: string,
  hideTitle = false,
) {
  const [fontRevision, setFontRevision] = useState(0);
  useEffect(() => {
    let active = true;
    preparePresentationFonts(style, title + body).then(() => {
      if (active) setFontRevision((v) => v + 1);
    });
    return () => {
      active = false;
    };
  }, [style, title, body]);
  return useMemo(() => {
    const context = document.createElement('canvas').getContext('2d')!;
    return resolveDialogueTextLayout(context, { style, width, height, title, body, hideTitle });
  }, [style, width, height, title, body, hideTitle, fontRevision]);
}

export function textBlockCss(
  block: TextBlockLayout,
  parent: { x: number; y: number; width: number; height: number },
): CSSProperties {
  return {
    position: 'absolute',
    margin: 0,
    padding: 0,
    boxSizing: 'border-box',
    fontFamily: block.object.fontFamily,
    fontWeight: block.object.fontWeight,
    fontSize: block.fontSize,
    lineHeight: `${block.lineHeight}px`,
    letterSpacing: block.letterSpacing,
    color: block.object.fill.color,
    textAlign: block.object.textAlign,
    left: `${(100 * (block.left - parent.x)) / parent.width}%`,
    top: `${(100 * (block.top - parent.y)) / parent.height}%`,
    width: `${(100 * (block.right - block.left)) / parent.width}%`,
    height: `${(100 * block.height) / parent.height}%`,
    transform: `rotate(${block.object.rotation}deg) scale(${block.object.flipX ? -1 : 1}, ${block.object.flipY ? -1 : 1})`,
  };
}

/** Real DOM text, scaled with its logical stage without rasterization. */
export function PresentationText({
  block,
  visibleCharacters = Infinity,
  scale = 1,
}: {
  block: TextBlockLayout;
  visibleCharacters?: number;
  scale?: number;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const presentation = useMemo(() => presentTextBlock(block), [block]);
  useLayoutEffect(() => {
    if (inner.current) mountPresentationText(inner.current, presentation, visibleCharacters);
  }, [presentation, visibleCharacters]);
  useLayoutEffect(() => {
    const container = outer.current,
      content = inner.current;
    if (!container || !content) return;
    const resize = () => {
      const size = getComputedStyle(container);
      const width = parseFloat(size.width) || container.clientWidth;
      const height = parseFloat(size.height) || container.clientHeight;
      content.style.transform = `scale(${(scale * width) / Math.max(1, presentation.width)}, ${(scale * height) / Math.max(1, presentation.height)})`;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [presentation, scale]);
  return (
    <div ref={outer} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
      <div ref={inner} />
    </div>
  );
}
