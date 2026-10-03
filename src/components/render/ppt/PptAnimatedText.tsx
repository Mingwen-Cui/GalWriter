import { useLayoutEffect, useRef, useState } from 'react';

import type { PptObjectAnimation } from '../video/shared/types';
import { pptTextLinePreview, wrapPptTextLines } from './pptTextBuild';

export function PptAnimatedText({
  text,
  animations,
  previewAtMs,
}: {
  text: string;
  animations: PptObjectAnimation[];
  previewAtMs?: number;
}) {
  const build = animations.find(
    (item) => item.textBuild?.mode === 'line-wipe' && (item.phase || 'enter') === 'enter',
  );
  const ref = useRef<HTMLSpanElement>(null);
  const [lines, setLines] = useState<string[]>([]);
  useLayoutEffect(() => {
    if (!build || !ref.current) return;
    const element = ref.current;
    let disposed = false;
    const measure = () => {
      if (disposed) return;
      const style = getComputedStyle(element);
      const ctx = document.createElement('canvas').getContext('2d');
      if (!ctx) return;
      ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      ctx.letterSpacing = style.letterSpacing;
      setLines(
        wrapPptTextLines(text, element.clientWidth, (value) => ctx.measureText(value).width),
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    void document.fonts.ready.then(measure);
    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, [Boolean(build), text]);
  if (!build) return <>{text}</>;
  return (
    <span ref={ref} className="block w-full">
      {(lines.length ? lines : text.split('\n')).map((line, index, all) => {
        return (
          <span
            key={index}
            className="block whitespace-pre"
            style={pptTextLinePreview(build, all.length, index, previewAtMs)}
          >
            {line || '\u00a0'}
          </span>
        );
      })}
    </span>
  );
}
