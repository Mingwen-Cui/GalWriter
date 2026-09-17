import { buildDefaultRenderObjects, getRenderObjects } from '../../video/shared/renderObjects';
import type { RenderStyle, RenderEditableObjectKind } from '../../video/shared/types';

// Inspector field names are commands/views over the object graph, never a second store.
const fields: Record<string, [RenderEditableObjectKind, string, string?]> = {};
for (const kind of ['title', 'body'] as const) {
  for (const [suffix, field] of Object.entries({ Visible: 'visible', FontFamily: 'fontFamily', FontSize: 'fontSize', Align: 'textAlign', LetterSpacing: 'letterSpacing', LineHeight: 'lineHeight' })) fields[kind + suffix] = [kind, field];
  for (const [suffix, field, child] of [['Color', 'fill', 'color'], ['ColorAlpha', 'fill', 'alpha'], ['StrokeColor', 'stroke', 'color'], ['StrokeWidth', 'stroke', 'width'], ['Animation', 'animation', 'animation'], ['TypewriterMode', 'animation', 'typewriterMode']]) fields[kind + suffix] = [kind, field, child];
}
for (const [prefix, kind] of [['dialog', 'dialogBox'], ['nameplate', 'nameplate']] as const) {
  for (const [suffix, field] of Object.entries({ Visible: 'visible', OffsetX: 'x', OffsetY: 'y', Radius: 'radius', ...(kind === 'dialogBox' ? { Width: 'width', Height: 'height' } : { Scale: 'width', FontSize: 'fontSize', FontFamily: 'fontFamily' }) })) fields[prefix + suffix] = [kind, field];
  for (const [suffix, child] of Object.entries({ BackgroundType: 'type', GradientAngle: 'gradientAngle', GradientStops: 'gradientStops', ImageUrl: 'imageUrl' })) fields[prefix + suffix] = [kind, 'fill', child];
}
fields.panelColor = ['dialogBox', 'fill', 'color'];
fields.panelColorAlpha = ['dialogBox', 'fill', 'alpha'];
fields.nameplateColor = ['nameplate', 'fill', 'color'];
fields.nameplateColorAlpha = ['nameplate', 'fill', 'alpha'];

/** Persist only authored values; derived fields are rebuilt at the boundary. */
export function serializeAppearance(style: RenderStyle): RenderStyle {
  const source = { ...style, renderObjects: getRenderObjects(style) } as unknown as Record<string, unknown>;
  for (const key of Object.keys(fields)) delete source[key];
  return source as unknown as RenderStyle;
}

export function resolveAppearance(source: RenderStyle): RenderStyle {
  const objects = source.renderObjects ?? buildDefaultRenderObjects();
  const view = { ...source, renderObjects: objects } as unknown as Record<string, unknown>;
  for (const [key, [kind, field, child]] of Object.entries(fields)) {
    const value = (objects[kind] as unknown as Record<string, any>)[field];
    view[key] = child ? value[child] : value;
  }
  return view as unknown as RenderStyle;
}

export function applyStylePatch<K extends keyof RenderStyle>(previous: RenderStyle, key: K, value: RenderStyle[K]): RenderStyle {
  const path = fields[key];
  if (!path) return resolveAppearance({ ...previous, [key]: value });
  const [kind, field, child] = path;
  const objects = getRenderObjects(previous);
  const object = objects[kind] as unknown as Record<string, any>;
  const updated = { ...object, [field]: child ? { ...object[field], [child]: value } : value };
  if (field === 'stroke' && child === 'width') updated.stroke.enabled = Number(value) > 0;
  return resolveAppearance({ ...previous, renderObjects: { ...objects, [kind]: updated } } as RenderStyle);
}
