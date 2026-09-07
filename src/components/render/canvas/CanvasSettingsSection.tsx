import { Link, Link2Off, Monitor, MoveHorizontal, MoveVertical } from 'lucide-react';
import type { Language } from '../../../lib/i18n';
import { InspectorGroup, NumberField } from '../shared/inspectors/InspectorControls';
import { canvasRatio, resizeCanvas } from './canvasDimensions';
import type { SharedCanvasSettings } from './canvasSettings';
import { getCanvasText } from './i18n';

type Props = {
  language: Language;
  value: SharedCanvasSettings;
  onChange: (patch: Partial<SharedCanvasSettings>) => void;
  variant?: 'web' | 'video' | 'ppt';
  showDescriptions?: boolean;
};

export function CanvasSettingsSection({
  language,
  value,
  onChange,
  variant = 'web',
  showDescriptions = true,
}: Props) {
  const text = getCanvasText(language);
  const t = (zh: string, en: string, ja = en) =>
    language === 'zh' ? zh : language === 'ja' ? ja : en;
  const applyRatio = (width: number, height: number) => {
    const ratioValue = {
      ...value,
      canvasRatioWidth: width,
      canvasRatioHeight: height,
      canvasRatioLocked: true,
    };
    onChange({
      ...resizeCanvas(ratioValue, 'canvasWidth', value.canvasWidth),
      canvasRatioLocked: value.canvasRatioLocked,
    });
  };
  const preset = `${value.canvasRatioWidth}:${value.canvasRatioHeight}`;
  const presets =
    variant === 'ppt' ? ['16:9', '4:3'] : ['16:9', '4:3', '1:1', '9:16', '3:4', '21:9'];
  return (
    <InspectorGroup
      title={text.title}
      icon={<Monitor className="h-3.5 w-3.5" />}
      tone="extra"
      secondary={null}
      showDescriptions={showDescriptions}
    >
      {variant !== 'ppt' && (
        <div className="property-control-row">
          <NumberField
            icon={<MoveHorizontal className="h-3.5 w-3.5" />}
            label={`${text.width} · px`}
            value={value.canvasWidth}
            min={320}
            max={7680}
            onChange={(next) => onChange(resizeCanvas(value, 'canvasWidth', next))}
          />
          <NumberField
            icon={<MoveVertical className="h-3.5 w-3.5" />}
            label={`${text.height} · px`}
            value={value.canvasHeight}
            min={180}
            max={4320}
            onChange={(next) => onChange(resizeCanvas(value, 'canvasHeight', next))}
          />
        </div>
      )}
      <div className="mt-2 flex items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="property-field-label block">
            {t('画布比例', 'Aspect ratio', '縦横比')}
          </span>
          <select
            className="h-8 w-full rounded-md border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-2 text-xs"
            aria-label={t('画布比例', 'Aspect ratio', '縦横比')}
            value={presets.includes(preset) ? preset : 'custom'}
            onChange={(event) => {
              const [w, h] = event.target.value.split(':').map(Number);
              if (w && h) applyRatio(w, h);
            }}
          >
            {!presets.includes(preset) && (
              <option value="custom">
                {t('自定义', 'Custom', 'カスタム')} · {preset}
              </option>
            )}
            {presets.map((ratio) => (
              <option key={ratio} value={ratio}>
                {ratio}
              </option>
            ))}
          </select>
        </label>
        {variant !== 'ppt' && (
          <button
            type="button"
            className="property-enable mb-0.5"
            aria-label={text.lockRatio}
            title={text.lockRatio}
            aria-pressed={value.canvasRatioLocked}
            onClick={() =>
              onChange({
                canvasRatioLocked: !value.canvasRatioLocked,
                ...canvasRatio(value.canvasWidth, value.canvasHeight),
              })
            }
          >
            {value.canvasRatioLocked ? (
              <Link className="h-4 w-4" />
            ) : (
              <Link2Off className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
      {variant !== 'ppt' && (
        <label className="mt-3 block">
          <span className="property-field-label block">
            {t('布局模式', 'Layout', 'レイアウト')}
          </span>
          <select
            value={value.layoutMode}
            className="h-8 w-full rounded-md border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-2 text-xs"
            onChange={(event) =>
              onChange({
                layoutMode: event.target.value as 'classic' | 'immersive',
                ...(event.target.value === 'classic'
                  ? { choicesPosition: 'aboveText' as const }
                  : {}),
              })
            }
          >
            <option value="immersive">{text.merged}</option>
            <option value="classic">{text.split}</option>
          </select>
        </label>
      )}
      {variant === 'web' && (
        <div className="mt-3 space-y-2 border-t border-[var(--vr-border)] pt-3">
          <label className="flex items-center justify-between gap-2 text-xs">
            <span>{text.choicePosition}</span>
            <select
              aria-label={text.choicePosition}
              value={value.choicesPosition}
              disabled={value.layoutMode === 'classic'}
              onChange={(event) =>
                onChange({
                  choicesPosition: event.target.value as SharedCanvasSettings['choicesPosition'],
                })
              }
              className="h-8 rounded-md bg-[var(--vr-surface-soft)] px-2"
            >
              <option value="aboveText">{text.top}</option>
              <option value="center">{text.middle}</option>
              <option value="belowText">{text.bottom}</option>
            </select>
          </label>
          {(['skipSingleChoicePopup', 'autoAdvance', 'videoAutoPlay'] as const).map(
            (key, index) => (
              <label key={key} className="flex min-h-8 items-center justify-between gap-2 text-xs">
                <span>{[text.skipSingle, text.autoAdvance, text.videoAutoplay][index]}</span>
                <input
                  type="checkbox"
                  checked={value[key]}
                  onChange={(event) => onChange({ [key]: event.target.checked })}
                  className="h-4 w-4 accent-indigo-600"
                />
              </label>
            ),
          )}
        </div>
      )}
    </InspectorGroup>
  );
}
