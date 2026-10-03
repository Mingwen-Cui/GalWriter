import type {
  PptManualTextElement,
  PptTextBoxLayout,
  PptTextOverrideTarget,
} from '../video/shared/types';

export function copyPptCoverText(
  target: Extract<PptTextOverrideTarget, 'cover-title' | 'cover-subtitle' | 'cover-description'>,
  text: string,
  layout: PptTextBoxLayout,
): PptManualTextElement {
  const title = target === 'cover-title';
  const style = layout.webStyle || {};
  const fontSize = style.fontSize || (title ? 36 : target === 'cover-subtitle' ? 14 : 16);
  const color =
    style.textColor || (title ? '#111827' : target === 'cover-subtitle' ? '#475569' : '#64748b');
  const fontWeight = style.fontWeight || (title ? 900 : 400);
  return {
    id: `clipboard-${target}`,
    kind: 'text',
    text,
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    rotation: layout.rotation,
    visible: true,
    fontSize,
    color,
    fontFamily: style.fontFamily,
    align: style.textAlign || 'left',
    bold: fontWeight >= 600,
    webStyle: structuredClone({
      ...style,
      fontSize,
      textColor: color,
      fontWeight,
      textAlign: style.textAlign || 'left',
    }),
  };
}
