import {
  ALargeSmall,
  Baseline,
  BetweenHorizontalStart,
  BetweenVerticalStart,
  Blend,
  ImagePlus,
  Palette,
  Radius,
  RotateCw,
  Type,
} from 'lucide-react';
import type { ReactNode } from 'react';

import type { Language } from '../../../lib/i18n';
import {
  StyleColorTile as ColorTile,
  StyleGradientStopsTile,
  StyleNumberTile as NumberTile,
  StyleSelectTile as SelectTile,
  StyleTileField as Field,
} from '../video/controls/StyleControlTiles';
import { renderCopy } from '../video/shared/renderCopy';
import type { WebMenuElement } from '../video/shared/types';
import { normalizeGradientStops } from './webGradientStops';

const FONT_OPTIONS = [
  { label: '雅黑', value: '"Microsoft YaHei", "Noto Sans SC", Arial, sans-serif' },
  { label: '宋体', value: 'SimSun, "Noto Serif SC", serif' },
  { label: '黑体', value: 'SimHei, "Noto Sans SC", sans-serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Serif', value: 'Georgia, "Times New Roman", serif' },
];

const BLEND_OPTIONS = [
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

type InspectorProps = {
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
}: InspectorProps) {
  const t = (zh: string, ja: string, en: string) => renderCopy(language, zh, ja, en);

  if (element.kind === 'text') {
    return (
      <GridPanel>
        <div className="grid grid-cols-3 gap-2">
          <ColorTile
            icon={Palette}
            label={t('选择文字颜色', '文字色を選択', 'Choose text color')}
            description={
              showDescriptions ? t('文字颜色', '文字色', 'Text color'): undefined
            }
            value={element.textColor || '#ffffff'}
            onChange={(value) => onUpdate({ textColor: value })}
          />
          <SelectTile
            icon={Type}
            value={element.fontFamily || FONT_OPTIONS[0].value}
            label={t('选择文字字体', '文字フォントを選択', 'Choose text font')}
            description={
              showDescriptions
                ? t('字体', 'フォント', 'Font')
                : undefined
            }
            options={FONT_OPTIONS}
            onChange={(value) => onUpdate({ fontFamily: value })}
          />
          <NumberTile
            icon={ALargeSmall}
            label={t('拖动调整字号', 'サイズを調整', 'Adjust font size')}
            description={
              showDescriptions ? t('字体大小', 'フォントサイズ', 'Font size') : undefined
            }
            value={element.fontSize ?? 28}
            min={8}
            max={120}
            step={1}
            unit="px"
            onChange={(value) => onUpdate({ fontSize: value })}
          />
        </div>
        <TextDetailRows
          element={element}
          showDescriptions={showDescriptions}
          t={t}
          onUpdate={onUpdate}
        />
      </GridPanel>
    );
  }

  if (element.kind === 'image') {
    return (
      <GridPanel>
        <div className="grid grid-cols-3 gap-2">
          <ImageButton
            label={t('选择新的图片素材', '新しい画像素材を選択', 'Choose a new image')}
            description={
              showDescriptions
                ? t('更换图片', '画像を変更', 'Replace image')
                : undefined
            }
            onChange={(value) => onUpdate({ imageUrl: value })}
          />
          <NumberTile
            icon={Baseline}
            label={t('拖动调整图片描边宽度', '画像の縁取り幅を調整', 'Adjust image stroke width')}
            description={
              showDescriptions
                ? t('描边宽度', '縁取り幅', 'Stroke width')
                : undefined
            }
            value={element.borderWidth ?? 0}
            min={0}
            max={16}
            step={0.5}
            unit="px"
            onChange={(value) => onUpdate({ borderWidth: value })}
          />
          <ColorTile
            icon={Baseline}
            label={t('选择图片描边颜色', '画像の縁取り色を選択', 'Choose image stroke color')}
            description={
              showDescriptions
                ? t('描边颜色', '縁取り色', 'Stroke color')
                : undefined
            }
            value={element.borderColor || '#ffffff'}
            onChange={(value) => onUpdate({ borderColor: value })}
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <NumberTile
            icon={Blend}
            label={t('拖动调整图片透明度', '画像の透明度を調整', 'Adjust image opacity')}
            description={
              showDescriptions
                ? t('透明度', '透明度', 'Opacity')
                : undefined
            }
            value={element.opacity ?? 100}
            min={0}
            max={100}
            step={1}
            unit="%"
            onChange={(value) => onUpdate({ opacity: value })}
          />
          <NumberTile
            icon={Radius}
            label={t('拖动调整图片圆角', '画像の角丸を調整', 'Adjust image radius')}
            description={
              showDescriptions
                ? t('圆角', '角丸', 'Radius')
                : undefined
            }
            value={element.borderRadius ?? 12}
            min={0}
            max={80}
            step={1}
            unit="px"
            onChange={(value) => onUpdate({ borderRadius: value })}
          />
          <SelectTile
            icon={Blend}
            value={element.blendMode || 'normal'}
            label={t('混合模式', 'ブレンド', 'Blend mode')}
            description={
              showDescriptions
                ? t('对应 CSS mix-blend-mode', 'CSS mix-blend-mode に対応', 'CSS mix-blend-mode')
                : undefined
            }
            options={BLEND_OPTIONS}
            onChange={(value) => onUpdate({ blendMode: value })}
          />
        </div>
      </GridPanel>
    );
  }

  const gradientStops = normalizeGradientStops(
    element.backgroundGradientStops,
    element.backgroundGradientStart || '#0ea5e9',
    element.backgroundGradientEnd || '#0f172a',
  );

  return (
    <GridPanel>
      <div className="grid grid-cols-3 gap-2">
        <ColorTile
          icon={Palette}
          label={t('选择按钮内部文字颜色', 'ボタン内の文字色を選択', 'Choose button text color')}
          description={
            showDescriptions
              ? t('文字颜色', '文字色', 'Text color')
              : undefined
          }
          value={element.textColor || '#ffffff'}
          onChange={(value) => onUpdate({ textColor: value })}
        />
        <SelectTile
          icon={Type}
          value={element.fontFamily || FONT_OPTIONS[0].value}
          label={t('选择按钮文字字体', 'ボタン文字フォントを選択', 'Choose button font')}
          description={
            showDescriptions
              ? t('字体', 'フォント', 'Font')
              : undefined
          }
          options={FONT_OPTIONS}
          onChange={(value) => onUpdate({ fontFamily: value })}
        />
        <NumberTile
          icon={ALargeSmall}
          label={t('拖动调整按钮文字字号', 'ボタン文字サイズを調整', 'Adjust button text size')}
          description={
            showDescriptions
              ? t('文字字号', '文字サイズ', 'Text size')
              : undefined
          }
          value={element.fontSize ?? 14}
          min={8}
          max={80}
          step={1}
          unit="px"
          onChange={(value) => onUpdate({ fontSize: value })}
        />
      </div>
      <TextDetailRows
        element={element}
        showDescriptions={showDescriptions}
        t={t}
        onUpdate={onUpdate}
        defaultAlign="center"
      />
      <div className="grid grid-cols-3 gap-2">
        <NumberTile
          icon={Baseline}
          label={t('拖动调整按钮边框宽度', 'ボタン枠線幅を調整', 'Adjust button border width')}
          description={
            showDescriptions
              ? t('边框宽度', '枠線幅', 'Border width')
              : undefined
          }
          value={element.borderWidth ?? 1}
          min={0}
          max={16}
          step={0.5}
          unit="px"
          onChange={(value) => onUpdate({ borderWidth: value })}
        />
        <ColorTile
          icon={Baseline}
          label={t('选择按钮边框颜色', 'ボタン枠線色を選択', 'Choose button border color')}
          description={
            showDescriptions
              ? t('边框颜色', '枠線色', 'Border color')
              : undefined
          }
          value={element.borderColor || '#ffffff'}
          onChange={(value) => onUpdate({ borderColor: value })}
        />
        <SelectTile
          icon={Blend}
          value={element.blendMode || 'normal'}
          label={t('混合模式', 'ブレンド', 'Blend mode')}
          description={
            showDescriptions
              ? t('混合模式', 'ブレンド', 'Blend mode')
              : undefined
          }
          options={BLEND_OPTIONS}
          onChange={(value) => onUpdate({ blendMode: value })}
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <NumberTile
          icon={Radius}
          label={t('拖动调整按钮圆角', 'ボタン角丸を調整', 'Adjust button radius')}
          description={
            showDescriptions
              ? t('圆角', '角丸', 'Radius')
              : undefined
          }
          value={element.borderRadius ?? 12}
          min={0}
          max={80}
          step={1}
          unit="px"
          onChange={(value) => onUpdate({ borderRadius: value })}
        />
        <SelectTile
          icon={Palette}
          value={element.backgroundType || 'solid'}
          label={t('选择按钮底色类型', 'ボタン背景タイプを選択', 'Choose button background type')}
          description={
            showDescriptions
              ? t('底色', '背景', 'Background')
              : undefined
          }
          options={[
            { value: 'solid', label: t('纯色', '単色', 'Solid') },
            { value: 'gradient', label: t('渐变', 'グラデ', 'Gradient') },
            { value: 'image', label: t('导入图片', '画像', 'Image') },
          ]}
          onChange={(value) =>
            onUpdate({ backgroundType: value as WebMenuElement['backgroundType'] })
          }
        />
        <BackgroundValueTile element={element} t={t} onUpdate={onUpdate} />
      </div>
      {(element.backgroundType || 'solid') === 'gradient' && (
        <StyleGradientStopsTile
          stops={gradientStops}
          activeLabel={t('渐变色标', 'グラデーション色標', 'Gradient stop')}
          removeLabel={t('删除一个色标', '色標を削除', 'Remove a color stop')}
          addLabel={t('添加色标', '色標を追加', 'Add a color stop')}
          alphaLabel={t('拖动调整透明度', '透明度を調整', 'Adjust alpha')}
          onChangeStops={(stops) => {
            const sorted = [...stops].sort((a, b) => a.position - b.position);
            const start = sorted[0];
            const end = sorted[sorted.length - 1];
            onUpdate({
              backgroundType: 'gradient',
              backgroundGradientStops: sorted,
              backgroundGradientStart: start?.color || element.backgroundGradientStart || '#0ea5e9',
              backgroundGradientEnd: end?.color || element.backgroundGradientEnd || '#0f172a',
            });
          }}
        />
      )}
    </GridPanel>
  );
}

function TextDetailRows({
  element,
  showDescriptions,
  t,
  onUpdate,
  defaultAlign = 'left',
}: {
  element: WebMenuElement;
  showDescriptions: boolean;
  t: (zh: string, ja: string, en: string) => string;
  onUpdate: (patch: Partial<WebMenuElement>) => void;
  defaultAlign?: NonNullable<WebMenuElement['textAlign']>;
}) {
  const textAlign = element.textAlign || defaultAlign;
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <NumberTile
          icon={Blend}
          label={t('拖动调整文字透明度', '文字の透明度を調整', 'Adjust text alpha')}
          description={
            showDescriptions
              ? t('透明度', '透明度', 'Text alpha')
              : undefined
          }
          value={element.textColorAlpha ?? 100}
          min={0}
          max={100}
          step={1}
          unit="%"
          onChange={(value) => onUpdate({ textColorAlpha: value })}
        />
        <NumberTile
          icon={Baseline}
          label={t('拖动调整描边宽度', '縁取り幅を調整', 'Adjust stroke width')}
          description={
            showDescriptions
              ? t('描边宽度', '縁取り幅', 'Stroke width')
              : undefined
          }
          value={element.textStrokeWidth ?? 0}
          min={0}
          max={16}
          step={0.5}
          unit="px"
          onChange={(value) => onUpdate({ textStrokeWidth: value })}
        />
        <ColorTile
          icon={Baseline}
          label={t('选择描边颜色', '縁取り色を選択', 'Choose stroke color')}
          description={
            showDescriptions
              ? t('描边颜色', '縁取り色', 'Stroke color')
              : undefined
          }
          value={element.textStrokeColor || '#000000'}
          onChange={(value) => onUpdate({ textStrokeColor: value })}
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Field description={showDescriptions ? t('文字对齐', '文字揃え', 'Text align') : undefined}>
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
        </Field>
        <NumberTile
          icon={BetweenHorizontalStart}
          label={t('拖动调整文字间距', '文字間隔を調整', 'Adjust spacing')}
          description={
            showDescriptions ? t('文字间距', '文字間隔', 'Letter spacing') : undefined
          }
          value={element.letterSpacing ?? 0}
          min={-4}
          max={24}
          step={0.5}
          unit="px"
          onChange={(value) => onUpdate({ letterSpacing: value })}
        />
        <NumberTile
          icon={BetweenVerticalStart}
          label={t('拖动调整行间距', '行間を調整', 'Adjust line height')}
          description={
            showDescriptions ? t('行间距', '行間', 'Line height') : undefined
          }
          value={element.lineHeight ?? 1.25}
          min={0.8}
          max={2.4}
          step={0.05}
          unit="x"
          onChange={(value) => onUpdate({ lineHeight: value })}
        />
      </div>
    </>
  );
}

function BackgroundValueTile({
  element,
  t,
  onUpdate,
}: {
  element: WebMenuElement;
  t: (zh: string, ja: string, en: string) => string;
  onUpdate: (patch: Partial<WebMenuElement>) => void;
}) {
  if ((element.backgroundType || 'solid') === 'image') {
    return (
      <ImageButton
        label={
          element.backgroundImageUrl
            ? t('更换图片', '画像を変更', 'Replace image')
            : t('导入图片', '画像を選択', 'Import image')
        }
        onChange={(value) => onUpdate({ backgroundImageUrl: value, backgroundType: 'image' })}
      />
    );
  }
  if ((element.backgroundType || 'solid') === 'gradient') {
    return (
      <NumberTile
        icon={RotateCw}
        label={t('渐变角度', 'グラデーション角度', 'Gradient angle')}
        value={element.backgroundGradientAngle ?? 135}
        min={0}
        max={360}
        step={1}
        unit="deg"
        onChange={(value) => onUpdate({ backgroundGradientAngle: value, backgroundType: 'gradient' })}
      />
    );
  }
  return (
    <ColorTile
      icon={Palette}
      label={t('按钮底色', 'ボタン色', 'Button background')}
      value={element.backgroundColor || '#0ea5e9'}
      onChange={(value) => onUpdate({ backgroundColor: value, backgroundType: 'solid' })}
    />
  );
}

function GridPanel({ children }: { children: ReactNode }) {
  return <div className="space-y-2 rounded-xl bg-indigo-500/5 p-2">{children}</div>;
}

function ImageButton({
  label,
  description,
  onChange,
}: {
  label: string;
  description?: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field description={description}>
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
    </Field>
  );
}

function readImageFileAsDataUrl(file: File, onReady: (value: string) => void) {
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result === 'string') onReady(reader.result);
  };
  reader.readAsDataURL(file);
}
