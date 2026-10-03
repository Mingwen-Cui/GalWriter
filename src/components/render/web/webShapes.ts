import type { WebMenuElement } from '../video/shared/types';
import type { PaintLayer } from '../shared/paint/appearance';
import type { Language } from '../../../lib/i18n';

export const webShapeCatalog = (language: Language) => [
  {
    type: 'rectangle' as const,
    label: language === 'zh' ? '正方形' : language === 'ja' ? '正方形' : 'Square',
  },
  {
    type: 'ellipse' as const,
    label: language === 'zh' ? '圆形' : language === 'ja' ? '円' : 'Circle',
  },
  {
    type: 'polygon' as const,
    label: language === 'zh' ? '多边形' : language === 'ja' ? '多角形' : 'Polygon',
  },
  {
    type: 'line' as const,
    label: language === 'zh' ? '直线' : language === 'ja' ? '直線' : 'Line',
  },
];

export const webPolygonSides = (element: WebMenuElement) =>
  Math.max(
    3,
    Math.min(60, Math.round(Number.isFinite(element.polygonSides) ? element.polygonSides! : 3)),
  );

export function webShapeAspectRatio(element: Pick<WebMenuElement, 'shapeType' | 'polygonSides'>) {
  if (element.shapeType === 'rectangle' || element.shapeType === 'ellipse') return 1;
  if (element.shapeType !== 'polygon' && element.shapeType !== 'triangle') return null;
  const count = Math.max(3, Math.min(60, Math.round(element.polygonSides || 3)));
  const points = Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / count;
    return { x: Math.cos(angle), y: Math.sin(angle) };
  });
  return (
    (Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y))) /
    (Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x)))
  );
}

export function webShapeCornerRadiusPatch(
  element: WebMenuElement,
  radius: number,
): Partial<WebMenuElement> {
  if (element.shapeType === 'polygon' || element.shapeType === 'triangle')
    return {
      borderRadius: radius,
      polygonCornerRadii: Array.from({ length: webPolygonSides(element) }, () => radius),
    };
  return {
    borderRadius: radius,
    borderTopLeftRadius: radius,
    borderTopRightRadius: radius,
    borderBottomRightRadius: radius,
    borderBottomLeftRadius: radius,
  };
}

export function constrainWebShapeSize(
  element: WebMenuElement,
  patch: Partial<WebMenuElement>,
  canvasWidth: number,
  canvasHeight: number,
  handle?: string,
) {
  const ratio = element.kind === 'shape' ? webShapeAspectRatio({ ...element, ...patch }) : null;
  if (
    ratio === null ||
    !['width', 'height', 'shapeType', 'polygonSides'].some((key) => key in patch)
  )
    return patch;
  let width = ((patch.width ?? element.width) * canvasWidth) / 100;
  if (patch.height !== undefined)
    width =
      patch.width === undefined
        ? (patch.height * canvasHeight) / 100 / ratio
        : Math.max(width, (patch.height * canvasHeight) / 100 / ratio);
  const height = width * ratio;
  const next = {
    ...patch,
    width: (width / canvasWidth) * 100,
    height: (height / canvasHeight) * 100,
  };
  if (handle?.includes('w')) next.x = element.x + element.width - next.width;
  if (handle?.includes('n')) next.y = element.y + element.height - next.height;
  if (
    (patch.shapeType !== undefined && patch.shapeType !== element.shapeType) ||
    (patch.polygonSides !== undefined && patch.polygonSides !== element.polygonSides)
  ) {
    next.x = element.x + (element.width - next.width) / 2;
    next.y = element.y + (element.height - next.height) / 2;
  }
  return next;
}

export function webShapeVertices(element: WebMenuElement, width: number, height: number) {
  if (element.shapeType !== 'polygon' && element.shapeType !== 'triangle')
    return [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ];
  const count = webPolygonSides(element);
  const points = Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / count;
    return { x: Math.cos(angle), y: Math.sin(angle) };
  });
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const scale = Math.min(width / (maxX - minX), height / (maxY - minY));
  return points.map((point) => ({
    x: width / 2 + (point.x - (minX + maxX) / 2) * scale,
    y: height / 2 + (point.y - (minY + maxY) / 2) * scale,
  }));
}

/** Self-contained so the offline player uses exactly the same geometry and paint. */
export function webShapeMarkup(element: WebMenuElement, canvasWidth = 1920, canvasHeight = 1080) {
  const number = (value: number | undefined, fallback: number) =>
    Number.isFinite(value) ? value! : fallback;
  const escape = (value: string) =>
    String(value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  const width = Math.max(1, (number(element.width, 20) * canvasWidth) / 100);
  const height = Math.max(1, (number(element.height, 20) * canvasHeight) / 100);
  const id = 'gw-shape-' + element.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const type = element.shapeType || 'rounded';
  let defs = '';
  const paint = (layer: Partial<PaintLayer>, index: string) => {
    if (layer.type === 'gradient') {
      const gradientId = `${id}-${index}`;
      const stops = layer.gradientStops?.length
        ? layer.gradientStops
        : [
            { color: layer.gradientStart || '#625bf6', alpha: 100, position: 0 },
            { color: layer.gradientEnd || '#c7d2fe', alpha: 100, position: 100 },
          ];
      const stopMarkup = stops
        .map(
          (stop) =>
            `<stop offset="${Math.max(0, Math.min(100, stop.position))}%" stop-color="${escape(stop.color)}" stop-opacity="${number(stop.alpha, 100) / 100}"/>`,
        )
        .join('');
      if (layer.gradientShape === 'radial')
        defs += `<radialGradient id="${gradientId}">${stopMarkup}</radialGradient>`;
      else {
        const angle = ((number(layer.gradientAngle, 135) - 90) * Math.PI) / 180;
        const x = Math.cos(angle) * 50,
          y = Math.sin(angle) * 50;
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
    const w = Math.max(1, width - inset * 2),
      h = Math.max(1, height - inset * 2);
    if (type === 'ellipse')
      return `<ellipse cx="${width / 2}" cy="${height / 2}" rx="${w / 2}" ry="${h / 2}" ${attributes}/>`;
    if (type === 'polygon' || type === 'triangle') {
      // Keep this geometry self-contained: the offline export serializes this function.
      const count = Math.max(3, Math.min(60, Math.round(number(element.polygonSides, 3))));
      const points = Array.from({ length: count }, (_, index) => {
        const angle = -Math.PI / 2 + (index * Math.PI * 2) / count;
        return { x: Math.cos(angle), y: Math.sin(angle) };
      });
      const minX = Math.min(...points.map((point) => point.x)),
        maxX = Math.max(...points.map((point) => point.x));
      const minY = Math.min(...points.map((point) => point.y)),
        maxY = Math.max(...points.map((point) => point.y));
      const scale = Math.min(w / (maxX - minX), h / (maxY - minY));
      const vertices = points.map((point) => ({
        x: width / 2 + (point.x - (minX + maxX) / 2) * scale,
        y: height / 2 + (point.y - (minY + maxY) / 2) * scale,
      }));
      const corners = vertices.map((vertex, index) => {
        const previous = vertices[(index + count - 1) % count],
          next = vertices[(index + 1) % count];
        const before = Math.hypot(previous.x - vertex.x, previous.y - vertex.y),
          after = Math.hypot(next.x - vertex.x, next.y - vertex.y);
        const u = { x: (previous.x - vertex.x) / before, y: (previous.y - vertex.y) / before };
        const v = { x: (next.x - vertex.x) / after, y: (next.y - vertex.y) / after };
        const angle = Math.acos(Math.max(-1, Math.min(1, u.x * v.x + u.y * v.y)));
        const tangent = Math.tan(angle / 2);
        const radius = Math.max(
          0,
          number(element.polygonCornerRadii?.[index], number(element.borderRadius, 0)) - inset,
        );
        return { vertex, u, v, before, tangent, distance: radius / Math.max(0.0001, tangent) };
      });
      const factor = Math.min(
        1,
        ...corners.map(
          (corner, index) =>
            corner.before / (corner.distance + corners[(index + count - 1) % count].distance || 1),
        ),
      );
      let path = '';
      corners.forEach((corner, index) => {
        const distance = corner.distance * factor,
          radius = distance * corner.tangent;
        const entry = {
          x: corner.vertex.x + corner.u.x * distance,
          y: corner.vertex.y + corner.u.y * distance,
        };
        const exit = {
          x: corner.vertex.x + corner.v.x * distance,
          y: corner.vertex.y + corner.v.y * distance,
        };
        path += `${index === 0 ? 'M' : 'L'} ${entry.x} ${entry.y} `;
        path +=
          radius > 0.001
            ? `A ${radius} ${radius} 0 0 1 ${exit.x} ${exit.y} `
            : `L ${exit.x} ${exit.y} `;
      });
      return `<path d="${path}Z" ${attributes}/>`;
    }
    if (type === 'line')
      return `<path d="M ${inset} ${height / 2} H ${width - inset}" ${attributes} stroke-linecap="round"/>`;
    const baseRadius = number(element.borderRadius, type === 'rectangle' ? 0 : 16);
    const radii = [
      element.borderTopLeftRadius,
      element.borderTopRightRadius,
      element.borderBottomRightRadius,
      element.borderBottomLeftRadius,
    ].map((radius) => Math.max(0, number(radius, baseRadius) - inset));
    const [tl, tr, br, bl] = radii;
    const factor = Math.min(
      1,
      w / (tl + tr || 1),
      w / (bl + br || 1),
      h / (tl + bl || 1),
      h / (tr + br || 1),
    );
    const [a, b, c, d] = radii.map((radius) => radius * factor);
    if (a === b && b === c && c === d)
      return `<rect x="${inset}" y="${inset}" width="${w}" height="${h}" rx="${a}" ${attributes}/>`;
    const right = inset + w,
      bottom = inset + h;
    return `<path d="M ${inset + a} ${inset} H ${right - b} Q ${right} ${inset} ${right} ${inset + b} V ${bottom - c} Q ${right} ${bottom} ${right - c} ${bottom} H ${inset + d} Q ${inset} ${bottom} ${inset} ${bottom - d} V ${inset + a} Q ${inset} ${inset} ${inset + a} ${inset} Z" ${attributes}/>`;
  };
  const fills: Partial<PaintLayer>[] = element.appearance?.fills || [
    {
      enabled: element.fillEnabled !== false,
      opacity: 100,
      type: element.backgroundType || 'solid',
      color: element.backgroundColor || '#eef2ff',
      gradientStart: element.backgroundGradientStart,
      gradientEnd: element.backgroundGradientEnd,
      gradientAngle: element.backgroundGradientAngle,
      gradientShape: element.backgroundGradientShape,
      gradientStops: element.backgroundGradientStops,
      imageUrl: element.backgroundImageUrl,
    },
  ];
  let body = [...fills]
    .reverse()
    .map((layer, index) =>
      layer.enabled === false
        ? ''
        : geometry(
            type === 'line'
              ? `fill="none" stroke="${paint(layer, `fill-${index}`)}" stroke-width="${Math.max(2, number(element.borderWidth, 4))}" opacity="${number(layer.opacity, 100) / 100}"`
              : `fill="${paint(layer, `fill-${index}`)}" opacity="${number(layer.opacity, 100) / 100}"`,
          ),
    )
    .join('');
  const strokes =
    element.appearance?.strokes ||
    (element.strokeEnabled !== false && element.borderColor && element.borderWidth
      ? [
          {
            enabled: true,
            width: element.borderWidth,
            color: element.borderColor,
            paint: undefined,
          },
        ]
      : []);
  body += [...strokes]
    .reverse()
    .map((stroke, index) =>
      stroke.enabled === false
        ? ''
        : geometry(
            `fill="none" stroke="${stroke.paint ? paint(stroke.paint, `stroke-${index}`) : escape(stroke.color)}" stroke-width="${Math.max(0, stroke.width)}" stroke-linejoin="round"`,
            stroke.width / 2,
          ),
    )
    .join('');
  const shadows =
    element.appearance?.shadows ||
    (element.shadowEnabled !== false && element.shadowOpacity
      ? [
          {
            enabled: true,
            inset: false,
            color: element.shadowColor || '#252a59',
            x: element.shadowOffsetX || 0,
            y: element.shadowOffsetY || 0,
            blur: element.shadowBlur || 0,
          },
        ]
      : []);
  const filter = shadows
    .filter((shadow) => shadow.enabled && !shadow.inset)
    .map((shadow) => {
      const color =
        !element.appearance && /^#[0-9a-f]{6}$/i.test(shadow.color)
          ? `${shadow.color}${Math.round((number(element.shadowOpacity, 100) / 100) * 255)
              .toString(16)
              .padStart(2, '0')}`
          : shadow.color;
      return `drop-shadow(${shadow.x}px ${shadow.y}px ${Math.max(0, shadow.blur / 2)}px ${escape(color)})`;
    })
    .join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true" style="display:block;overflow:visible;filter:${filter || 'none'}"><defs>${defs}</defs>${body}</svg>`;
}
