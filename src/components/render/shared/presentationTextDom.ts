import type { TextBlockLayout } from './presentationTextLayout';
import { appearanceStyle } from './paint/appearanceStyle';

/** Serializable text and style data. No bitmap, glyph outline or encoded image. */
export function presentTextBlock(block: TextBlockLayout) {
  const object = block.object;
  const alphaColor = (color: string, alpha: number) =>
    /^#[0-9a-f]{6}$/i.test(color)
      ? color +
        Math.round(Math.max(0, Math.min(100, alpha)) * 2.55)
          .toString(16)
          .padStart(2, '0')
      : color;
  const surface = object.appearance;
  const surfacePaint = surface ? appearanceStyle(surface) : undefined;
  const gradients = object.fill.gradientStops
    .map((stop) => `${alphaColor(stop.color, stop.alpha)} ${stop.position}%`)
    .join(', ');
  const backgroundImage = surface
    ? surfacePaint?.backgroundImage
    : object.fill.type === 'gradient'
      ? `linear-gradient(${object.fill.gradientAngle}deg, ${gradients})`
      : object.fill.type === 'image' && object.fill.imageUrl
        ? `url(${JSON.stringify(object.fill.imageUrl)})`
        : undefined;
  const shadow = surface
    ? surface.shadows
        .filter((s) => s.enabled && !s.inset)
        .map((s) => `${s.x}px ${s.y}px ${s.blur}px ${s.color}`)
        .join(', ')
    : (object.shadows?.length ? object.shadows : [object.shadow])
        .filter((s) => s.enabled && s.type === 'outer')
        .map((s) => `${s.x}px ${s.y}px ${s.blur}px ${alphaColor(s.color, s.alpha)}`)
        .join(', ');
  const outline = surface
    ? surface.strokes.find((s) => s.enabled)
    : object.stroke.enabled
      ? object.stroke
      : undefined;
  const color = surface
    ? surface.fills.some((f) => f.enabled)
      ? String(surfacePaint?.backgroundColor || object.fill.color)
      : 'transparent'
    : object.fill.enabled
      ? alphaColor(object.fill.color, object.fill.alpha)
      : 'transparent';
  return {
    width: block.right - block.left,
    height: block.height,
    fontFamily: object.fontFamily,
    fontWeight: object.fontWeight,
    fontSize: block.fontSize,
    letterSpacing: block.letterSpacing,
    lineHeight: block.lineHeight,
    visible: block.visible,
    paint: {
      color: backgroundImage ? 'transparent' : color,
      backgroundImage: backgroundImage || 'none',
      backgroundSize: '100% 100%',
      backgroundClip: backgroundImage ? 'text' : 'border-box',
      WebkitBackgroundClip: backgroundImage ? 'text' : 'border-box',
      WebkitTextFillColor: backgroundImage ? 'transparent' : color,
      textShadow: shadow || 'none',
      WebkitTextStroke: outline ? `${outline.width}px ${outline.color}` : '0 transparent',
      textDecoration:
        [object.underline ? 'underline' : '', object.strikethrough ? 'line-through' : '']
          .filter(Boolean)
          .join(' ') || 'none',
    },
    lines: block.lines.map((text, index) => ({
      text,
      start: block.starts[index],
      top: index * block.lineHeight,
      left:
        object.textAlign === 'center'
          ? (block.right - block.left - block.widths[index]) / 2
          : object.textAlign === 'right'
            ? block.right - block.left - block.widths[index]
            : 0,
      width: block.widths[index],
    })),
  };
}
export type PresentedTextBlock = ReturnType<typeof presentTextBlock>;

/** Self-contained so the offline player executes this exact renderer too. */
export function mountPresentationText(
  host: HTMLElement,
  block: PresentedTextBlock,
  count = Infinity,
) {
  host.replaceChildren();
  host.hidden = !block.visible;
  Object.assign(host.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    margin: '0',
    padding: '0',
    width: block.width + 'px',
    height: block.height + 'px',
    transformOrigin: 'top left',
    fontFamily: block.fontFamily,
    fontWeight: String(block.fontWeight),
    fontSize: block.fontSize + 'px',
    lineHeight: block.lineHeight + 'px',
    letterSpacing: block.letterSpacing + 'px',
    whiteSpace: 'pre',
    fontKerning: 'normal',
    userSelect: 'text',
  });
  for (const line of block.lines) {
    const span = document.createElement('span');
    span.textContent = Array.from(line.text)
      .slice(0, Math.max(0, count - line.start))
      .join('');
    Object.assign(span.style, block.paint, {
      position: 'absolute',
      display: 'block',
      margin: '0',
      padding: '0',
      left: line.left + 'px',
      top: line.top + 'px',
      height: block.lineHeight + 'px',
      minWidth: line.width + 'px',
      whiteSpace: 'pre',
    });
    host.appendChild(span);
  }
}
