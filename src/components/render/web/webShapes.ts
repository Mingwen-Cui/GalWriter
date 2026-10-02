import type { WebMenuElement } from '../video/shared/types';
import type { PaintLayer } from '../shared/paint/appearance';
import type { Language } from '../../../lib/i18n';

export const webShapeCatalog = (language: Language) => [
  { type: 'rectangle' as const, label: language === 'zh' ? '矩形' : language === 'ja' ? '長方形' : 'Rectangle' },
  { type: 'rounded' as const, label: language === 'zh' ? '圆角矩形' : language === 'ja' ? '角丸長方形' : 'Rounded rectangle' },
  { type: 'ellipse' as const, label: language === 'zh' ? '椭圆' : language === 'ja' ? '楕円' : 'Ellipse' },
  { type: 'triangle' as const, label: language === 'zh' ? '三角形' : language === 'ja' ? '三角形' : 'Triangle' },
  { type: 'line' as const, label: language === 'zh' ? '直线' : language === 'ja' ? '直線' : 'Line' },
];

/** Self-contained so the offline player uses exactly the same geometry and paint. */
export function webShapeMarkup(element: WebMenuElement, canvasWidth = 1920, canvasHeight = 1080) {
  const number = (value: number | undefined, fallback: number) => Number.isFinite(value) ? value! : fallback;
  const escape = (value: string) => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const width = Math.max(1, number(element.width, 20) * canvasWidth / 100);
  const height = Math.max(1, number(element.height, 20) * canvasHeight / 100);
  const id = 'gw-shape-' + element.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const type = element.shapeType || 'rounded';
  let defs = '';
  const paint = (layer: Partial<PaintLayer>, index: string) => {
    if (layer.type === 'gradient') {
      const gradientId = `${id}-${index}`;
      const stops = layer.gradientStops?.length ? layer.gradientStops : [
        { color: layer.gradientStart || '#625bf6', alpha: 100, position: 0 },
        { color: layer.gradientEnd || '#c7d2fe', alpha: 100, position: 100 },
      ];
      const stopMarkup = stops.map((stop) => `<stop offset="${Math.max(0, Math.min(100, stop.position))}%" stop-color="${escape(stop.color)}" stop-opacity="${number(stop.alpha, 100) / 100}"/>`).join('');
      if (layer.gradientShape === 'radial') defs += `<radialGradient id="${gradientId}">${stopMarkup}</radialGradient>`;
      else {
        const angle = (number(layer.gradientAngle, 135) - 90) * Math.PI / 180;
        const x = Math.cos(angle) * 50, y = Math.sin(angle) * 50;
        defs += `<linearGradient id="${gradientId}" x1="${50 - x}%" y1="${50 - y}%" x2="${50 + x}%" y2="${50 + y}%">${stopMarkup}</linearGradient>`;
      }
      return `url(#${gradientId})`;
    }
    if (layer.type === 'image' && layer.imageUrl) {
      const imageId = `${id}-${index}`;
      defs += `<pattern id="${imageId}" width="1" height="1" patternContentUnits="objectBoundingBox"><image href="${escape(layer.imageUrl)}" width="1" height="1" preserveAspectRatio="xMidYMid slice"/></pattern>`;
      return `url(#${imageId})`;
    }
    return escape(layer.color || 'transparent');
  };
  const geometry = (attributes: string, inset = 0) => {
    const w = Math.max(1, width - inset * 2), h = Math.max(1, height - inset * 2);
    if (type === 'ellipse') return `<ellipse cx="${width / 2}" cy="${height / 2}" rx="${w / 2}" ry="${h / 2}" ${attributes}/>`;
    if (type === 'triangle') return `<path d="M ${width / 2} ${inset} L ${width - inset} ${height - inset} L ${inset} ${height - inset} Z" ${attributes}/>`;
    if (type === 'line') return `<path d="M ${inset} ${height / 2} H ${width - inset}" ${attributes} stroke-linecap="round"/>`;
    return `<rect x="${inset}" y="${inset}" width="${w}" height="${h}" rx="${type === 'rectangle' ? 0 : Math.min(w / 2, h / 2, number(element.borderRadius, 16))}" ${attributes}/>`;
  };
  const fills: Partial<PaintLayer>[] = element.appearance?.fills || [{
    enabled: element.fillEnabled !== false, opacity: 100, type: element.backgroundType || 'solid', color: element.backgroundColor || '#eef2ff',
    gradientStart: element.backgroundGradientStart, gradientEnd: element.backgroundGradientEnd, gradientAngle: element.backgroundGradientAngle,
    gradientShape: element.backgroundGradientShape, gradientStops: element.backgroundGradientStops, imageUrl: element.backgroundImageUrl,
  }];
  let body = [...fills].reverse().map((layer, index) => layer.enabled === false ? '' : geometry(type === 'line' ? `fill="none" stroke="${paint(layer, `fill-${index}`)}" stroke-width="${Math.max(2, number(element.borderWidth, 4))}" opacity="${number(layer.opacity, 100) / 100}"` : `fill="${paint(layer, `fill-${index}`)}" opacity="${number(layer.opacity, 100) / 100}"`)).join('');
  const strokes = element.appearance?.strokes || (element.strokeEnabled !== false && element.borderColor && element.borderWidth ? [{ enabled: true, width: element.borderWidth, color: element.borderColor, paint: undefined }] : []);
  body += [...strokes].reverse().map((stroke, index) => stroke.enabled === false ? '' : geometry(`fill="none" stroke="${stroke.paint ? paint(stroke.paint, `stroke-${index}`) : escape(stroke.color)}" stroke-width="${Math.max(0, stroke.width)}" stroke-linejoin="round"`, stroke.width / 2)).join('');
  const shadows = element.appearance?.shadows || (element.shadowEnabled !== false && element.shadowOpacity ? [{ enabled: true, inset: false, color: element.shadowColor || '#252a59', x: element.shadowOffsetX || 0, y: element.shadowOffsetY || 0, blur: element.shadowBlur || 0 }] : []);
  const filter = shadows.filter((shadow) => shadow.enabled && !shadow.inset).map((shadow) => {
    const color = !element.appearance && /^#[0-9a-f]{6}$/i.test(shadow.color) ? `${shadow.color}${Math.round(number(element.shadowOpacity, 100) / 100 * 255).toString(16).padStart(2, '0')}` : shadow.color;
    return `drop-shadow(${shadow.x}px ${shadow.y}px ${Math.max(0, shadow.blur / 2)}px ${escape(color)})`;
  }).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true" style="display:block;overflow:visible;filter:${filter || 'none'}"><defs>${defs}</defs>${body}</svg>`;
}
