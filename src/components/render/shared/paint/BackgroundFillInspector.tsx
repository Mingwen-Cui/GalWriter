import { ImagePlus, PaintBucket, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { resolveKnownAppAssetUrl } from '../../../../lib/appAssets';
import type { Language } from '../../../../lib/i18n';
import { renderObjectText } from '../../video/objectInspector/i18n';
import type { RenderColorStop } from '../../video/shared/types';
import { normalizeGradientStops } from './gradient';
import { FloatingPopover, InspectorGroup } from '../inspectors/InspectorControls';
import { SolidColorPopover } from './ColorPopovers';
import { GradientEditorPopover, type GradientShape } from './GradientEditorPopover';
import { InlineColorControl, InlineGradientControl } from './InlinePaintControls';
import { VideoBackgroundPopover } from './VideoBackgroundPopover';
import { parseColorValue, toHex8 } from './colorValue';

export type BackgroundPaint = {
  type: 'solid' | 'gradient' | 'image' | 'video';
  color: string;
  gradientStart: string;
  gradientEnd: string;
  gradientAngle: number;
  gradientShape?: GradientShape;
  gradientStops?: RenderColorStop[];
  imageUrl: string;
  videoUrl?: string;
  videoLoop?: boolean;
  videoMuted?: boolean;
  videoFit?: 'crop' | 'fit';
};

/** A controlled editor. Web and PPT adapters own field names and persistence. */
export function BackgroundFillInspector({
  language,
  value,
  onChange,
  onGradientEditingChange,
  allowedTypes = ['solid', 'gradient', 'image', 'video'],
  gradientShapes = true,
  enabled = true,
  onEnabledChange,
}: {
  language: Language;
  value: BackgroundPaint;
  onChange: (patch: Partial<BackgroundPaint>) => void;
  gradientShapes?: boolean;
  allowedTypes?: BackgroundPaint['type'][];
  onGradientEditingChange?: (editing: boolean) => void;
  enabled?: boolean;
  onEnabledChange?: (enabled: boolean) => void;
}) {
  const text = renderObjectText(language);
  const [editor, setEditor] = useState<BackgroundPaint['type'] | null>(null);
  const editingCallback = useRef(onGradientEditingChange);
  editingCallback.current = onGradientEditingChange;
  useEffect(() => {
    editingCallback.current?.(editor === 'gradient');
    return () => editingCallback.current?.(false);
  }, [editor]);
  const t = (zh: string, en: string, ja = en) =>
    language === 'zh' ? zh : language === 'ja' ? ja : en;
  const labels = { ...text.option, video: t('视频', 'Video', '動画') };
  const parsed = parseColorValue(value.color);
  const stops = normalizeGradientStops(value.gradientStops, value.gradientStart, value.gradientEnd);
  const changeColor = (color: string, alpha: number) => onChange({ color: toHex8(color, alpha) });
  return (
    <InspectorGroup
      title={text.group.fill}
      icon={<PaintBucket className="h-3.5 w-3.5" />}
      tone="fill"
      titleActive={enabled}
      onTitleClick={onEnabledChange ? () => onEnabledChange(!enabled) : undefined}
      secondary={
        <div
          className="flex gap-1 rounded-md bg-[var(--vr-surface-soft)] p-1"
          role="group"
          aria-label={text.group.fill}
        >
          {allowedTypes.map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={value.type === type}
              className={`h-7 min-w-0 flex-1 rounded px-1 text-[11px] ${value.type === type ? 'bg-[var(--vr-accent)] text-white' : 'text-[var(--vr-text-muted)]'}`}
              onClick={() => {
                onChange({ type });
                setEditor(null);
              }}
            >
              {labels[type]}
            </button>
          ))}
        </div>
      }
    >
      {value.type === 'solid' && (
        <InlineColorControl
          label={text.group.fill}
          color={parsed.hex}
          alpha={parsed.alpha}
          hexLabel={text.popover.hex}
          alphaLabel={text.popover.opacity}
          onColorChange={(color) => changeColor(color, parsed.alpha)}
          onAlphaChange={(alpha) => changeColor(parsed.hex, alpha)}
          onColorAndAlphaChange={({ color, alpha }) => changeColor(color, alpha)}
          onOpen={() => setEditor('solid')}
        />
      )}
      {value.type === 'gradient' && (
        <InlineGradientControl
          label={text.popover.gradientTitle}
          stops={stops}
          onAlphaChange={(alpha) =>
            onChange({ gradientStops: stops.map((stop) => ({ ...stop, alpha })) })
          }
          onOpen={() => setEditor('gradient')}
        />
      )}
      {value.type === 'image' && (
        <div className="space-y-2">
          {value.imageUrl && (
            <img
              src={resolveKnownAppAssetUrl(value.imageUrl)}
              alt={text.popover.imageTitle}
              className="h-24 w-full rounded-md object-cover"
            />
          )}
          <div className="flex gap-2">
            <label className="flex h-8 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md bg-[var(--vr-surface-soft)] text-xs">
              <ImagePlus className="h-3.5 w-3.5" />
              {value.imageUrl ? text.popover.replace : text.popover.upload}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => onChange({ imageUrl: String(reader.result || '') });
                  reader.readAsDataURL(file);
                  event.currentTarget.value = '';
                }}
              />
            </label>
            {value.imageUrl && (
              <button
                type="button"
                className="property-enable"
                onClick={() => onChange({ imageUrl: '' })}
                aria-label={text.popover.remove}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
      {value.type === 'video' && (
        <button
          type="button"
          className="h-8 w-full rounded-md bg-[var(--vr-surface-soft)] text-xs"
          onClick={() => setEditor('video')}
        >
          {value.videoUrl
            ? t('编辑视频背景', 'Edit video background', '動画背景を編集')
            : t('选择视频', 'Choose video', '動画を選択')}
        </button>
      )}
      {editor && (
        <FloatingPopover
          popoverKey={editor === 'video' ? 'style' : editor}
          onClose={() => setEditor(null)}
          closeLabel={t('关闭', 'Close', '閉じる')}
        >
          {editor === 'solid' && (
            <SolidColorPopover
              tone="fill"
              text={text.popover}
              color={parsed.hex}
              alpha={parsed.alpha}
              onColorChange={(color) => changeColor(color, parsed.alpha)}
              onAlphaChange={(alpha) => changeColor(parsed.hex, alpha)}
              onColorAndAlphaChange={({ color, alpha }) => changeColor(color, alpha)}
            />
          )}
          {editor === 'gradient' && (
            <GradientEditorPopover
              language={language}
              angle={value.gradientAngle}
              shape={value.gradientShape}
              stops={stops}
              onAngleChange={(gradientAngle) => onChange({ gradientAngle })}
              onShapeChange={
                gradientShapes ? (gradientShape) => onChange({ gradientShape }) : undefined
              }
              onStopsChange={(gradientStops) =>
                onChange({
                  gradientStops,
                  gradientStart: gradientStops[0]?.color || value.gradientStart,
                  gradientEnd: gradientStops.at(-1)?.color || value.gradientEnd,
                })
              }
            />
          )}
          {editor === 'video' && (
            <VideoBackgroundPopover
              language={language}
              videoUrl={value.videoUrl || ''}
              loop={value.videoLoop !== false}
              muted={value.videoMuted !== false}
              fit={value.videoFit || 'crop'}
              onChange={onChange}
            />
          )}
        </FloatingPopover>
      )}
    </InspectorGroup>
  );
}
