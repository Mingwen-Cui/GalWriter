import { ImagePlus, Palette, RotateCw } from 'lucide-react';

import type { Language } from '../../../lib/i18n';
import {
  StyleColorTile,
  StyleGradientStopsTile,
  StyleNumberTile,
  StyleSelectTile,
  StyleTileField,
  StyleTileShell,
} from '../video/controls/StyleControlTiles';
import { renderCopy } from '../video/shared/renderCopy';
import type { WebExportSettings } from '../video/shared/types';
import { normalizeGradientStops } from './webGradientStops';

type StartMenuBackgroundInspectorProps = {
  settings: WebExportSettings;
  language: Language;
  showDescriptions: boolean;
  updateWebSettings: <K extends keyof WebExportSettings>(
    key: K,
    value: WebExportSettings[K],
  ) => void;
};

type BackgroundType = WebExportSettings['startMenuBackgroundType'];

const BLANK_BACKGROUND_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9' viewBox='0 0 16 9'%3E%3Crect width='16' height='9' fill='white'/%3E%3C/svg%3E";

export function StartMenuBackgroundInspector({
  settings,
  language,
  showDescriptions,
  updateWebSettings,
}: StartMenuBackgroundInspectorProps) {
  const t = (zh: string, ja: string, en: string) => renderCopy(language, zh, ja, en);
  const gradientStops = normalizeGradientStops(
    settings.startMenuBackgroundGradientStops,
    settings.startMenuBackgroundGradientStart,
    settings.startMenuBackgroundGradientEnd,
    '#0f172a',
    '#0891b2',
  );

  const setBackgroundType = (value: BackgroundType) => {
    updateWebSettings('startMenuBackgroundType', value);
    if (value === 'image' && !settings.startMenuBackgroundImageUrl) {
      updateWebSettings('startMenuBackgroundImageUrl', BLANK_BACKGROUND_IMAGE);
    }
  };

  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-2">
        <StyleSelectTile<BackgroundType>
          icon={Palette}
          value={settings.startMenuBackgroundType}
          label={t('背景类型', '背景タイプ', 'Background type')}
          description={showDescriptions ? t('背景类型', '背景タイプ', 'Background type') : undefined}
          options={[
            { value: 'solid', label: t('纯色', '単色', 'Solid') },
            { value: 'gradient', label: t('透明渐变', '透明グラデーション', 'Transparent gradient') },
            { value: 'image', label: t('导入图片', '画像', 'Image') },
          ]}
          onChange={setBackgroundType}
        />

        {settings.startMenuBackgroundType === 'solid' && (
          <StyleColorTile
            icon={Palette}
            label={t('启动页背景底色', 'タイトル画面の背景色', 'Start screen background color')}
            description={
              showDescriptions
                ? t('启动页背景底色', 'タイトル画面の背景色', 'Start screen background color')
                : undefined
            }
            value={settings.startMenuBackgroundColor}
            onChange={(value) => updateWebSettings('startMenuBackgroundColor', value)}
          />
        )}

        {settings.startMenuBackgroundType === 'gradient' && (
          <StyleNumberTile
            icon={RotateCw}
            label={t('渐变角度', 'グラデーション角度', 'Gradient angle')}
            description={showDescriptions ? t('渐变角度', 'グラデーション角度', 'Gradient angle') : undefined}
            value={settings.startMenuBackgroundGradientAngle}
            min={0}
            max={360}
            step={1}
            unit="deg"
            onChange={(value) => updateWebSettings('startMenuBackgroundGradientAngle', value)}
          />
        )}

        {settings.startMenuBackgroundType === 'image' && (
          <BackgroundImageButton
            label={
              settings.startMenuBackgroundImageUrl &&
              settings.startMenuBackgroundImageUrl !== BLANK_BACKGROUND_IMAGE
                ? t('更换图片', '画像を変更', 'Replace image')
                : t('导入图片', '画像を選択', 'Import image')
            }
            description={
              showDescriptions
                ? t('启动页背景图片', 'タイトル画面の背景画像', 'Start screen background image')
                : undefined
            }
            onChange={(value) => updateWebSettings('startMenuBackgroundImageUrl', value)}
          />
        )}
      </div>

      {settings.startMenuBackgroundType === 'gradient' && (
        <StyleTileField>
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
              updateWebSettings('startMenuBackgroundGradientStops', sorted);
              if (start) updateWebSettings('startMenuBackgroundGradientStart', start.color);
              if (end) updateWebSettings('startMenuBackgroundGradientEnd', end.color);
            }}
          />
        </StyleTileField>
      )}
    </div>
  );
}

function BackgroundImageButton({
  description,
  onChange,
}: {
  label: string;
  description?: string;
  onChange: (value: string) => void;
}) {
  return (
    <StyleTileShell icon={ImagePlus} description={description}>
      <label className="flex h-10 min-w-0 cursor-pointer items-center justify-center rounded-r-lg px-2 text-[var(--vr-text)] transition-colors hover:bg-white/5">
        <ImagePlus className="h-3.5 w-3.5 shrink-0 text-[var(--vr-text-muted)]" />
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
    </StyleTileShell>
  );
}

function readImageFileAsDataUrl(file: File, onReady: (value: string) => void) {
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result === 'string') onReady(reader.result);
  };
  reader.readAsDataURL(file);
}
