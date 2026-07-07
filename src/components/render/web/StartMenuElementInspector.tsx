import {
  ALargeSmall,
  Baseline,
  BetweenHorizontalStart,
  BetweenVerticalStart,
  Blend,
  ChevronDown,
  ImagePlus,
  Palette,
  Radius,
  Type,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';

import type { Language } from '../../../lib/i18n';
import { DragSizeControl } from '../video/controls/RenderControls';
import { renderCopy } from '../video/shared/renderCopy';
import type { WebMenuElement } from '../video/shared/types';

const WEB_MENU_FONT_OPTIONS = [
  { label: '雅黑', value: '"Microsoft YaHei", "Noto Sans SC", Arial, sans-serif' },
  { label: '宋体', value: 'SimSun, "Noto Serif SC", serif' },
  { label: '黑体', value: 'SimHei, "Noto Sans SC", sans-serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Serif', value: 'Georgia, "Times New Roman", serif' },
];

const WEB_MENU_BLEND_OPTIONS = [
  { label: 'Normal', value: 'normal' },
  { label: 'Multiply', value: 'multiply' },
  { label: 'Screen', value: 'screen' },
  { label: 'Overlay', value: 'overlay' },
  { label: 'Darken', value: 'darken' },
  { label: 'Lighten', value: 'lighten' },
  { label: 'Color Dodge', value: 'color-dodge' },
  { label: 'Color Burn', value: 'color-burn' },
  { label: 'Hard Light', value: 'hard-light' },
  { label: 'Soft Light', value: 'soft-light' },
  { label: 'Difference', value: 'difference' },
  { label: 'Exclusion', value: 'exclusion' },
  { label: 'Hue', value: 'hue' },
  { label: 'Saturation', value: 'saturation' },
  { label: 'Color', value: 'color' },
  { label: 'Luminosity', value: 'luminosity' },
];

type StartMenuElementInspectorProps = {
  element: WebMenuElement;
  language: Language;
  showDescriptions: boolean;
  onUpdate: (patch: Partial<WebMenuElement>) => void;
};

export function StartMenuElementInspector({
  element,
  language,
  showDescriptions,
  onUpdate,
}: StartMenuElementInspectorProps) {
  const t = (zh: string, ja: string, en: string) => renderCopy(language, zh, ja, en);
  const textAlign = element.textAlign || 'left';

  if (element.kind === 'text') {
    return (
      <div className="space-y-2 rounded-xl bg-indigo-500/5 p-2">
        <div className="grid grid-cols-3 gap-2">
          <InspectorColor
            icon={Palette}
            label={t('文字颜色', '文字色', 'Text color')}
            description={
              showDescriptions ? t('选择文字颜色', '文字色を選択', 'Choose text color') : undefined
            }
            value={element.textColor || '#ffffff'}
            onChange={(value) => onUpdate({ textColor: value })}
          />
          <InspectorSelect
            icon={Type}
            value={element.fontFamily || WEB_MENU_FONT_OPTIONS[0].value}
            label={t('字体', 'フォント', 'Font')}
            description={
              showDescriptions
                ? t('选择文字字体', '文字フォントを選択', 'Choose text font')
                : undefined
            }
            options={WEB_MENU_FONT_OPTIONS}
            onChange={(value) => onUpdate({ fontFamily: value })}
          />
          <InspectorNumber
            icon={ALargeSmall}
            label={t('字体大小', 'フォントサイズ', 'Font size')}
            description={
              showDescriptions ? t('拖动调整字号', 'サイズを調整', 'Adjust font size') : undefined
            }
            value={element.fontSize ?? 28}
            min={8}
            max={120}
            step={1}
            unit="px"
            onChange={(value) => onUpdate({ fontSize: value })}
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <InspectorNumber
            icon={Blend}
            label={t('文字透明度', '文字の透明度', 'Text alpha')}
            description={
              showDescriptions
                ? t('拖动调整文字透明度', '文字の透明度を調整', 'Adjust text alpha')
                : undefined
            }
            value={element.textColorAlpha ?? 100}
            min={0}
            max={100}
            step={1}
            unit="%"
            onChange={(value) => onUpdate({ textColorAlpha: value })}
          />
          <InspectorNumber
            icon={Baseline}
            label={t('描边宽度', '縁取り幅', 'Stroke width')}
            description={
              showDescriptions
                ? t('拖动调整描边宽度', '縁取り幅を調整', 'Adjust stroke width')
                : undefined
            }
            value={element.textStrokeWidth ?? 0}
            min={0}
            max={16}
            step={0.5}
            unit="px"
            onChange={(value) => onUpdate({ textStrokeWidth: value })}
          />
          <InspectorColor
            icon={Baseline}
            label={t('描边颜色', '縁取り色', 'Stroke color')}
            description={
              showDescriptions
                ? t('选择文字描边颜色', '縁取り色を選択', 'Choose stroke color')
                : undefined
            }
            value={element.textStrokeColor || '#000000'}
            onChange={(value) => onUpdate({ textStrokeColor: value })}
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <InspectorField
            description={showDescriptions ? t('文字对齐', '文字揃え', 'Text align') : undefined}
          >
            <div className="grid grid-cols-3 overflow-hidden rounded-lg bg-[var(--vr-surface-soft)]">
              {(['left', 'center', 'right'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onUpdate({ textAlign: value })}
                  className={`h-9 text-xs font-normal ${
                    textAlign === value
                      ? 'bg-[var(--vr-accent)] text-white'
                      : 'text-[var(--vr-text-soft)]'
                  }`}
                >
                  {value === 'left'
                    ? t('左', '左', 'L')
                    : value === 'center'
                      ? t('中', '中央', 'C')
                      : t('右', '右', 'R')}
                </button>
              ))}
            </div>
          </InspectorField>
          <InspectorNumber
            icon={BetweenHorizontalStart}
            label={t('字间距', '文字間隔', 'Letter spacing')}
            description={
              showDescriptions ? t('拖动调整字间距', '文字間隔を調整', 'Adjust spacing') : undefined
            }
            value={element.letterSpacing ?? 0}
            min={-4}
            max={24}
            step={0.5}
            unit="px"
            onChange={(value) => onUpdate({ letterSpacing: value })}
          />
          <InspectorNumber
            icon={BetweenVerticalStart}
            label={t('行距', '行間', 'Line height')}
            description={
              showDescriptions ? t('拖动调整行距', '行間を調整', 'Adjust line height') : undefined
            }
            value={element.lineHeight ?? 1.25}
            min={0.8}
            max={2.4}
            step={0.05}
            unit="x"
            onChange={(value) => onUpdate({ lineHeight: value })}
          />
        </div>
      </div>
    );
  }

  if (element.kind === 'image') {
    return (
      <div className="space-y-2 rounded-xl bg-indigo-500/5 p-2">
        <div className="grid grid-cols-3 gap-2">
          <InspectorImageButton
            label={t('更换图片', '画像を変更', 'Replace image')}
            description={
              showDescriptions
                ? t('选择新的图片素材', '新しい画像素材を選択', 'Choose a new image')
                : undefined
            }
            onChange={(value) => onUpdate({ imageUrl: value })}
          />
          <InspectorNumber
            icon={Baseline}
            label={t('描边宽度', '縁取り幅', 'Stroke width')}
            description={
              showDescriptions
                ? t('拖动调整图片描边宽度', '画像の縁取り幅を調整', 'Adjust image stroke width')
                : undefined
            }
            value={element.borderWidth ?? 0}
            min={0}
            max={16}
            step={0.5}
            unit="px"
            onChange={(value) => onUpdate({ borderWidth: value })}
          />
          <InspectorColor
            icon={Baseline}
            label={t('描边颜色', '縁取り色', 'Stroke color')}
            description={
              showDescriptions
                ? t('选择图片描边颜色', '画像の縁取り色を選択', 'Choose image stroke color')
                : undefined
            }
            value={element.borderColor || '#ffffff'}
            onChange={(value) => onUpdate({ borderColor: value })}
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <InspectorNumber
            icon={Blend}
            label={t('透明度', '透明度', 'Opacity')}
            description={
              showDescriptions
                ? t('拖动调整图片透明度', '画像の透明度を調整', 'Adjust image opacity')
                : undefined
            }
            value={element.opacity ?? 100}
            min={0}
            max={100}
            step={1}
            unit="%"
            onChange={(value) => onUpdate({ opacity: value })}
          />
          <InspectorNumber
            icon={Radius}
            label={t('圆角', '角丸', 'Radius')}
            description={
              showDescriptions
                ? t('拖动调整图片圆角', '画像の角丸を調整', 'Adjust image radius')
                : undefined
            }
            value={element.borderRadius ?? 12}
            min={0}
            max={80}
            step={1}
            unit="px"
            onChange={(value) => onUpdate({ borderRadius: value })}
          />
          <InspectorSelect
            icon={Blend}
            value={element.blendMode || 'normal'}
            label={t('混合模式', 'ブレンド', 'Blend mode')}
            description={
              showDescriptions
                ? t('对应 CSS mix-blend-mode', 'CSS mix-blend-mode に対応', 'CSS mix-blend-mode')
                : undefined
            }
            options={WEB_MENU_BLEND_OPTIONS}
            onChange={(value) => onUpdate({ blendMode: value })}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <ButtonColorField
        label={t('文字颜色', '文字色', 'Text')}
        value={element.textColor || '#ffffff'}
        onChange={(value) => onUpdate({ textColor: value })}
      />
      <ButtonRangeField
        label={t('圆角', '角丸', 'Radius')}
        value={element.borderRadius ?? 12}
        min={0}
        max={40}
        onChange={(value) => onUpdate({ borderRadius: value })}
      />
      <div className="rounded-lg bg-[var(--vr-surface-soft)] p-2">
        <div className="mb-2 px-1 text-[10px] font-black text-[var(--vr-text-muted)]">
          {t('按钮背景', 'ボタン背景', 'Button background')}
        </div>
        <div className="grid grid-cols-3 overflow-hidden rounded-lg bg-[var(--vr-surface)]">
          {[
            { value: 'solid', label: t('底色', '単色', 'Solid') },
            { value: 'gradient', label: t('渐变', 'グラデ', 'Gradient') },
            { value: 'image', label: t('图片', '画像', 'Image') },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() =>
                onUpdate({ backgroundType: option.value as WebMenuElement['backgroundType'] })
              }
              className={`h-8 px-2 text-[11px] font-black transition-colors ${
                (element.backgroundType || 'solid') === option.value
                  ? 'bg-indigo-600 text-white'
                  : 'text-[var(--vr-text-soft)] hover:text-[var(--vr-text)]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      {(element.backgroundType || 'solid') === 'solid' ? (
        <ButtonColorField
          label={t('按钮底色', 'ボタン色', 'Button')}
          value={colorInputValue(element.backgroundColor || '#0ea5e9')}
          onChange={(value) => onUpdate({ backgroundColor: value, backgroundType: 'solid' })}
        />
      ) : (element.backgroundType || 'solid') === 'gradient' ? (
        <div className="grid gap-2 rounded-lg bg-[var(--vr-surface-soft)] p-2">
          <div className="grid grid-cols-2 gap-2">
            <ButtonColorField
              label={t('起点', '開始', 'Start')}
              value={element.backgroundGradientStart || '#0ea5e9'}
              onChange={(value) =>
                onUpdate({ backgroundGradientStart: value, backgroundType: 'gradient' })
              }
            />
            <ButtonColorField
              label={t('终点', '終了', 'End')}
              value={element.backgroundGradientEnd || '#0f172a'}
              onChange={(value) =>
                onUpdate({ backgroundGradientEnd: value, backgroundType: 'gradient' })
              }
            />
          </div>
          <ButtonRangeField
            label={t('角度', '角度', 'Angle')}
            value={element.backgroundGradientAngle ?? 135}
            min={0}
            max={360}
            onChange={(value) =>
              onUpdate({ backgroundGradientAngle: value, backgroundType: 'gradient' })
            }
          />
        </div>
      ) : (
        <div className="grid gap-2 rounded-lg bg-[var(--vr-surface-soft)] p-2">
          <input
            type="text"
            value={element.backgroundImageUrl || ''}
            onChange={(event) =>
              onUpdate({ backgroundImageUrl: event.target.value, backgroundType: 'image' })
            }
            placeholder={t('按钮背景图片 URL', 'ボタン背景画像 URL', 'Button background image URL')}
            className="h-9 w-full rounded-lg border border-transparent bg-[var(--vr-surface)] px-3 text-xs font-bold text-[var(--vr-text)] outline-none transition-colors placeholder:text-[var(--vr-text-muted)] focus:border-[var(--vr-accent)]"
            aria-label={t('按钮背景图片 URL', 'ボタン背景画像 URL', 'Button background image URL')}
          />
          <label className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface)] px-3 text-[10px] font-black text-[var(--vr-text-soft)] transition-colors hover:border-[var(--vr-border-strong)] hover:text-[var(--vr-text)]">
            <ImagePlus className="h-3.5 w-3.5" />
            <span>{t('选择背景图', '背景画像を選択', 'Choose background')}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) {
                  readImageFileAsDataUrl(file, (value) =>
                    onUpdate({ backgroundImageUrl: value, backgroundType: 'image' }),
                  );
                }
                event.currentTarget.value = '';
              }}
            />
          </label>
        </div>
      )}
      <ButtonColorField
        label={t('边框颜色', '枠線色', 'Border')}
        value={colorInputValue(element.borderColor || '#ffffff')}
        onChange={(value) => onUpdate({ borderColor: value })}
      />
    </div>
  );
}

function InspectorField({ description, children }: { description?: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      {description && (
        <div className="px-1 text-[10px] leading-4 text-[var(--vr-text-muted)]">{description}</div>
      )}
      {children}
    </div>
  );
}

function InspectorShell({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="grid h-9 grid-cols-[28px_minmax(0,1fr)] items-stretch rounded-lg bg-[var(--vr-surface-soft)]">
      <span className="flex h-full items-center justify-center text-[var(--vr-text-muted)]">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function InspectorNumber({
  icon,
  label,
  description,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  icon: LucideIcon;
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <InspectorField description={description}>
      <InspectorShell icon={icon}>
        <DragSizeControl
          label={label}
          value={value}
          min={min}
          max={max}
          step={step}
          unit={unit}
          onChange={onChange}
        />
      </InspectorShell>
    </InspectorField>
  );
}

function InspectorColor({
  icon,
  label,
  description,
  value,
  onChange,
}: {
  icon: LucideIcon;
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <InspectorField description={description}>
      <InspectorShell icon={icon}>
        <input
          type="color"
          value={colorInputValue(value)}
          onChange={(event) => onChange(event.target.value)}
          className="video-render-color-input h-9 w-full cursor-pointer rounded-r-lg border-0 bg-transparent p-0"
          aria-label={label}
          title={label}
        />
      </InspectorShell>
    </InspectorField>
  );
}

function InspectorImageButton({
  label,
  description,
  onChange,
}: {
  label: string;
  description?: string;
  onChange: (value: string) => void;
}) {
  return (
    <InspectorField description={description}>
      <label className="grid h-9 cursor-pointer grid-cols-[28px_minmax(0,1fr)] items-stretch rounded-lg bg-[var(--vr-surface-soft)] text-[var(--vr-text)] transition-colors hover:bg-white/5">
        <span className="flex h-full items-center justify-center text-[var(--vr-text-muted)]">
          <ImagePlus className="h-3.5 w-3.5" />
        </span>
        <span className="flex min-w-0 items-center justify-end px-2 text-right text-xs font-normal">
          <span className="min-w-0 truncate">{label}</span>
        </span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) readImageFileAsDataUrl(file, onChange);
            event.currentTarget.value = '';
          }}
        />
      </label>
    </InspectorField>
  );
}

function InspectorSelect({
  icon,
  value,
  label,
  description,
  options,
  onChange,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
  description?: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel =
    options.find((option) => option.value === value)?.label || options[0]?.label || '';

  return (
    <InspectorField description={description}>
      <div
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
        }}
      >
        <InspectorShell icon={icon}>
          <div className="relative z-0 min-w-0">
            <button
              type="button"
              onClick={() => setOpen((current) => !current)}
              className="flex h-9 w-full min-w-0 items-center justify-end gap-1.5 rounded-r-lg bg-transparent px-2 text-right text-xs font-normal text-[var(--vr-text)] outline-none transition-colors hover:bg-white/5"
              title={label}
              aria-haspopup="listbox"
              aria-expanded={open}
            >
              <span className="min-w-0 truncate">{selectedLabel}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 shrink-0 text-[var(--vr-text-muted)] transition-transform ${
                  open ? 'rotate-180' : ''
                }`}
              />
            </button>
            {open && (
              <div
                className="absolute right-0 top-[calc(100%+4px)] z-30 max-h-56 w-full min-w-[132px] overflow-y-auto rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface)] p-1 shadow-xl shadow-black/15"
                role="listbox"
              >
                {options.map((option) => {
                  const active = option.value === value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        onChange(option.value);
                        setOpen(false);
                      }}
                      className={`flex h-8 w-full items-center justify-end rounded-md px-2 text-right text-xs font-normal transition-colors ${
                        active
                          ? 'bg-indigo-500/15 text-indigo-500 dark:text-indigo-300'
                          : 'text-[var(--vr-text-soft)] hover:bg-white/5 hover:text-[var(--vr-text)]'
                      }`}
                      role="option"
                      aria-selected={active}
                    >
                      <span className="min-w-0 truncate">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </InspectorShell>
      </div>
    </InspectorField>
  );
}

function ButtonColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-2 rounded-lg bg-[var(--vr-surface-soft)] px-2 py-1 text-[10px] font-black text-[var(--vr-text-muted)]">
      <span className="truncate">{label}</span>
      <input
        type="color"
        value={colorInputValue(value)}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-full rounded border-0 bg-transparent"
        aria-label={label}
      />
    </label>
  );
}

function ButtonRangeField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid grid-cols-[72px_minmax(0,1fr)_36px] items-center gap-2 text-[10px] font-black text-[var(--vr-text-muted)]">
      <span className="truncate">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full accent-[var(--vr-accent)]"
      />
      <span className="text-right tabular-nums">{value}</span>
    </label>
  );
}

function readImageFileAsDataUrl(file: File, onReady: (value: string) => void) {
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result === 'string') onReady(reader.result);
  };
  reader.readAsDataURL(file);
}

const colorInputValue = (value: string) => {
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
  const rgba = trimmed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!rgba) return '#ffffff';
  return `#${[rgba[1], rgba[2], rgba[3]]
    .map((channel) => Number(channel).toString(16).padStart(2, '0'))
    .join('')}`;
};
