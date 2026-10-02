import type { SharedCanvasSettings } from '../render/canvas/canvasSettings';
import { updateRenderObject } from '../render/video/shared/renderObjects';
import type { RenderEditableObjectKind, RenderStyle } from '../render/video/shared/types';

type RecordValue = Record<string, unknown>;

const isRecord = (value: unknown): value is RecordValue =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const ensureKeys = (value: RecordValue, allowed: string[], label: string) => {
  const unsupported = Object.keys(value).find((key) => !allowed.includes(key));
  if (unsupported) throw new Error(`${label} field '${unsupported}' is not supported.`);
};

const ensureBoolean = (value: unknown, key: string) => {
  if (typeof value !== 'boolean') throw new Error(`${key} must be a boolean.`);
};

const ensureNumber = (value: unknown, key: string, min: number, max: number, integer = false) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new Error(`${key} must be a ${integer ? 'whole ' : ''}number between ${min} and ${max}.`);
  }
};

const ensureColor = (value: unknown, key: string) => {
  if (typeof value !== 'string' || !/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(value)) {
    throw new Error(`${key} must be a 3- or 6-digit hex color.`);
  }
};

const canvasFields = [
  'canvasWidth', 'canvasHeight', 'canvasRatioWidth', 'canvasRatioHeight', 'canvasRatioLocked',
  'layoutMode', 'sceneFit', 'sceneScale', 'sceneScaleX', 'sceneScaleY', 'sceneOffsetX', 'sceneOffsetY',
  'sceneBackgroundVisible', 'sceneBackgroundType', 'sceneBackgroundColor', 'sceneBackgroundGradientStart',
  'sceneBackgroundGradientEnd', 'sceneBackgroundGradientAngle', 'choicesPosition', 'skipSingleChoicePopup',
  'autoAdvance', 'videoAutoPlay', 'hideCharacterTags', 'hideSceneTags',
] as const;

const runtimeFields = [
  'darkMode', 'choicesColumns', 'interactionMode', 'typewriterSpeed', 'choiceDelay', 'blurBackground',
  'blurText', 'dimBackground', 'autoAdvance', 'autoAdvanceDelay', 'videoAutoPlay', 'hideCharacterTags',
  'hideSceneTags', 'skipSingleChoicePopup', 'layoutMode', 'choicesPosition',
] as const;

export type McpPlaytestSettingsPatch = {
  runtime: Partial<Record<(typeof runtimeFields)[number], unknown>>;
  canvas: Partial<SharedCanvasSettings>;
};

export const validateMcpPlaytestSettingsPatch = (value: unknown): McpPlaytestSettingsPatch => {
  if (!isRecord(value)) throw new Error('patch must be an object.');
  ensureKeys(value, ['runtime', 'canvas'], 'patch');
  const runtime = value.runtime === undefined ? {} : value.runtime;
  const canvas = value.canvas === undefined ? {} : value.canvas;
  if (!isRecord(runtime) || !isRecord(canvas)) throw new Error('patch.runtime and patch.canvas must be objects.');
  if (!Object.keys(runtime).length && !Object.keys(canvas).length) throw new Error('patch must change at least one setting.');
  ensureKeys(runtime, [...runtimeFields], 'patch.runtime');
  ensureKeys(canvas, [...canvasFields], 'patch.canvas');

  const booleans = new Set([
    'darkMode', 'blurBackground', 'blurText', 'dimBackground', 'autoAdvance', 'videoAutoPlay',
    'hideCharacterTags', 'hideSceneTags', 'skipSingleChoicePopup', 'canvasRatioLocked', 'sceneBackgroundVisible',
  ]);
  const numbers: Record<string, [number, number, boolean?]> = {
    choicesColumns: [1, 3, true], typewriterSpeed: [0, 500], choiceDelay: [0, 60], autoAdvanceDelay: [0, 60],
    canvasWidth: [320, 7680, true], canvasHeight: [180, 4320, true], canvasRatioWidth: [1, 100, true],
    canvasRatioHeight: [1, 100, true], sceneScale: [25, 400, true], sceneScaleX: [25, 400, true],
    sceneScaleY: [25, 400, true], sceneOffsetX: [-100, 100, true], sceneOffsetY: [-100, 100, true],
    sceneBackgroundGradientAngle: [0, 360, true],
  };

  for (const [key, setting] of [...Object.entries(runtime), ...Object.entries(canvas)]) {
    if (booleans.has(key)) ensureBoolean(setting, key);
    else if (numbers[key]) ensureNumber(setting, key, numbers[key][0], numbers[key][1], numbers[key][2]);
    else if (key === 'layoutMode') {
      if (setting !== 'classic' && setting !== 'immersive') throw new Error('layoutMode must be classic or immersive.');
    } else if (key === 'choicesPosition') {
      if (!['center', 'aboveText', 'belowText'].includes(String(setting))) throw new Error('choicesPosition must be center, aboveText, or belowText.');
    } else if (key === 'interactionMode') {
      if (setting !== 'immediate' && setting !== 'typewriter') throw new Error('interactionMode must be immediate or typewriter.');
    } else if (key === 'sceneFit') {
      if (!['cover', 'contain', 'stretch'].includes(String(setting))) throw new Error('sceneFit must be cover, contain, or stretch.');
    } else if (key === 'sceneBackgroundType') {
      if (!['solid', 'gradient', 'image'].includes(String(setting))) throw new Error('sceneBackgroundType must be solid, gradient, or image.');
    } else if (['sceneBackgroundColor', 'sceneBackgroundGradientStart', 'sceneBackgroundGradientEnd'].includes(key)) {
      ensureColor(setting, key);
    }
  }

  return { runtime: runtime as McpPlaytestSettingsPatch['runtime'], canvas: canvas as Partial<SharedCanvasSettings> };
};

const validatePaint = (value: unknown, field: 'fill' | 'stroke' | 'shadow', label: string): RecordValue => {
  if (!isRecord(value)) throw new Error(`${label}.${field} must be an object.`);
  const allowed = field === 'fill'
    ? ['enabled', 'type', 'color', 'alpha', 'gradientAngle', 'gradientType', 'gradientStops', 'imageFit', 'imageAngle', 'imageAlpha', 'blendMode']
    : field === 'stroke'
      ? ['enabled', 'type', 'color', 'alpha', 'width', 'position', 'dashed', 'lineCap', 'lineJoin', 'gradientAngle', 'gradientType', 'gradientStops']
      : ['enabled', 'type', 'x', 'y', 'blur', 'spread', 'color', 'alpha'];
  ensureKeys(value, allowed, `${label}.${field}`);
  for (const [key, item] of Object.entries(value)) {
    if (['enabled', 'dashed'].includes(key)) ensureBoolean(item, `${field}.${key}`);
    else if (key === 'color') ensureColor(item, `${field}.${key}`);
    else if (['alpha', 'width'].includes(key)) ensureNumber(item, `${field}.${key}`, 0, key === 'width' ? 500 : 100);
    else if (['x', 'y'].includes(key)) ensureNumber(item, `${field}.${key}`, -1000, 1000);
    else if (['blur', 'spread'].includes(key)) ensureNumber(item, `${field}.${key}`, 0, 1000);
    else if (key === 'gradientAngle' || key === 'imageAngle') ensureNumber(item, `${field}.${key}`, 0, 360);
    else if (key === 'imageAlpha') ensureNumber(item, `${field}.${key}`, 0, 100);
    else if (key === 'type') {
      const values = field === 'shadow' ? ['outer', 'inner'] : ['solid', 'gradient', 'image'];
      if (!values.includes(String(item))) throw new Error(`${field}.type is invalid.`);
    } else if (key === 'gradientType' && !['linear', 'radial', 'angular', 'diamond'].includes(String(item))) {
      throw new Error(`${field}.gradientType is invalid.`);
    } else if (key === 'position' && !['inside', 'center', 'outside'].includes(String(item))) {
      throw new Error(`${field}.position is invalid.`);
    } else if (key === 'lineCap' && !['butt', 'round', 'square'].includes(String(item))) {
      throw new Error(`${field}.lineCap is invalid.`);
    } else if (key === 'lineJoin' && !['miter', 'round', 'bevel'].includes(String(item))) {
      throw new Error(`${field}.lineJoin is invalid.`);
    } else if (key === 'imageFit' && !['fit', 'max', 'crop'].includes(String(item))) {
      throw new Error(`${field}.imageFit is invalid.`);
    } else if (key === 'blendMode' && (typeof item !== 'string' || item.length > 40)) {
      throw new Error(`${field}.blendMode must be a short string.`);
    } else if (key === 'gradientStops') {
      if (!Array.isArray(item) || item.length > 16) throw new Error(`${field}.gradientStops must contain at most 16 color stops.`);
      for (const [index, stop] of item.entries()) {
        if (!isRecord(stop)) throw new Error(`${field}.gradientStops[${index}] must be an object.`);
        ensureKeys(stop, ['id', 'color', 'alpha', 'position'], `${field}.gradientStops[${index}]`);
        if (stop.id !== undefined && (typeof stop.id !== 'string' || stop.id.length > 128)) throw new Error('Gradient stop id is invalid.');
        ensureColor(stop.color, `${field}.gradientStops[${index}].color`);
        ensureNumber(stop.alpha, `${field}.gradientStops[${index}].alpha`, 0, 100);
        ensureNumber(stop.position, `${field}.gradientStops[${index}].position`, 0, 100);
      }
    }
  }
  return value;
};

export const applyMcpPlaytestRenderObjectPatch = (
  style: RenderStyle,
  objectId: unknown,
  value: unknown,
): RenderStyle => {
  const kinds: RenderEditableObjectKind[] = ['dialogBox', 'title', 'body', 'nameplate', 'choice'];
  if (typeof objectId !== 'string' || !kinds.includes(objectId as RenderEditableObjectKind)) {
    throw new Error(`object_id must be one of: ${kinds.join(', ')}.`);
  }
  if (!isRecord(value) || !Object.keys(value).length) throw new Error('fields must be a non-empty object.');
  const directFields = [
    'visible', 'x', 'y', 'width', 'height', 'radius', 'rotation', 'flipX', 'flipY', 'zIndex',
    'horizontalAlign', 'verticalAlign', 'fontFamily', 'fontSize', 'fontWeight', 'underline',
    'strikethrough', 'letterSpacing', 'lineHeight', 'textAlign', 'textVerticalAlign',
  ];
  ensureKeys(value, [...directFields, 'fill', 'stroke', 'shadow', 'shadows'], 'fields');
  const isTextObject = objectId !== 'dialogBox';
  const updates: RecordValue = {};
  for (const [key, item] of Object.entries(value)) {
    if (['visible', 'flipX', 'flipY', 'underline', 'strikethrough'].includes(key)) ensureBoolean(item, key);
    else if (['x', 'y'].includes(key)) ensureNumber(item, key, -1000, 1000);
    else if (['width', 'height'].includes(key)) ensureNumber(item, key, 0, 1000);
    else if (key === 'radius') ensureNumber(item, key, 0, 1000);
    else if (key === 'rotation') ensureNumber(item, key, -3600, 3600);
    else if (key === 'zIndex') ensureNumber(item, key, -10000, 10000, true);
    else if (['fontSize', 'fontWeight', 'letterSpacing', 'lineHeight'].includes(key)) {
      if (!isTextObject) throw new Error(`${key} is supported only for text render objects.`);
      const bounds: Record<string, [number, number, boolean?]> = {
        fontSize: [0, 500], fontWeight: [100, 900, true], letterSpacing: [-50, 100], lineHeight: [0.5, 5],
      };
      const [min, max, integer] = bounds[key];
      ensureNumber(item, key, min, max, integer);
    } else if (key === 'fontFamily') {
      if (!isTextObject || typeof item !== 'string' || item.length > 200) throw new Error('fontFamily must be a string of at most 200 characters on a text object.');
    } else if (['horizontalAlign', 'textAlign'].includes(key)) {
      if (!['left', 'center', 'right'].includes(String(item))) throw new Error(`${key} must be left, center, or right.`);
    } else if (['verticalAlign', 'textVerticalAlign'].includes(key)) {
      if (!['top', 'center', 'bottom'].includes(String(item))) throw new Error(`${key} must be top, center, or bottom.`);
    } else if (key === 'fill' || key === 'stroke' || key === 'shadow') {
      updates[key] = validatePaint(item, key, 'fields');
    } else if (key === 'shadows') {
      if (!Array.isArray(item) || item.length > 6) throw new Error('shadows must contain at most 6 shadow layers.');
      updates.shadows = item.map((shadow, index) => validatePaint(shadow, 'shadow', `fields.shadows[${index}]`));
    }
    if (!['fill', 'stroke', 'shadow', 'shadows'].includes(key)) updates[key] = item;
  }
  const renderObjects = updateRenderObject(style, objectId as RenderEditableObjectKind, updates);
  return { ...style, renderObjects };
};
