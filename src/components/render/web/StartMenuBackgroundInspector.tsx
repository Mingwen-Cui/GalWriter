import { ImagePlus, Palette, RotateCw } from 'lucide-react';

import type { Language } from '../../../lib/i18n';
import {
  StyleColorTile,
  StyleGradientStopsTile,
  StyleNumberTile,
  StylePreviewTile,
  StyleSelectTile,
  StyleTileField,
  StyleTileShell,
} from '../video/controls/StyleControlTiles';
import { renderCopy } from '../video/shared/renderCopy';
import type { WebExportSettings } from '../video/shared/types';
import { linearGradientFromStops, normalizeGradientStops } from './webGradientStops';

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

export function StartMenuBackgroundInspector({
  settings,
  language,
  showDescriptions,
  updateWebSettings,
}: StartMenuBackgroundInspectorProps) {
  const t = (zh: string, ja: string, en: string) => renderCopy(language, zh, ja, en);
  const backgroundPreview =
    settings.startMenuBackgroundType === 'image' && settings.startMenuBackgroundImageUrl
      ? `center / cover url("${settings.startMenuBackgroundImageUrl.replace(/"/g, '\\"')}")`
      : settings.startMenuBackgroundType === 'gradient'
        ? linearGradientFromStops(
            settings.startMenuBackgroundGradientAngle,
            normalizeGradientStops(
              settings.startMenuBackgroundGradientStops,
              settings.startMenuBackgroundGradientStart,
              settings.startMenuBackgroundGradientEnd,
              '#0f172a',
              '#0891b2',
            ),
          )
        : settings.startMenuBackgroundColor;
  const gradientStops = normalizeGradientStops(
    settings.startMenuBackgroundGradientStops,
    settings.startMenuBackgroundGradientStart,
    settings.startMenuBackgroundGradientEnd,
    '#0f172a',
    '#0891b2',
  );

  return (
    <div className="grid gap-2">
      <StyleSelectTile<BackgroundType>
        icon={Palette}
        value={settings.startMenuBackgroundType}
        label={t('底色类型', '背景タイプ', 'Background type')}
        description={
          showDescriptions ? t('背景类型', '背景タイプ', 'Background type') : undefined
        }
        options={[
          { value: 'solid', label: t('纯色', '単色', 'Solid') },
          {
            value: 'gradient',
            label: t('透明渐变', '透明グラデーション', 'Transparent gradient'),
          },
          { value: 'image', label: t('导入图片', '画像', 'Image') },
        ]}
        onChange={(value) => updateWebSettings('startMenuBackgroundType', value)}
      />

      {settings.startMenuBackgroundType === 'solid' && (
        <StyleTileField
          description={
            showDescriptions
              ? t('启动页背景底色', 'タイトル画面の背景色', 'Start screen background color')
              : undefined
          }
        >
          <div className="grid grid-cols-3 gap-2">
            <StyleColorTile
              icon={Palette}
              label={t('底色', '単色', 'Solid')}
              value={settings.startMenuBackgroundColor}
              onChange={(value) => updateWebSettings('startMenuBackgroundColor', value)}
            />
            <div className="col-span-2">
              <StylePreviewTile
                icon={Palette}
                background={backgroundPreview}
                label={t('背景预览', '背景プレビュー', 'Background preview')}
              />
            </div>
          </div>
        </StyleTileField>
      )}

      {settings.startMenuBackgroundType === 'gradient' && (
        <StyleTileField
          description={
            showDescriptions
              ? t('渐变起点、终点与方向', 'グラデーションの色と角度', 'Gradient colors and angle')
              : undefined
          }
        >
          <div className="grid grid-cols-3 gap-2">
            <StyleColorTile
              icon={Palette}
              label={t('起点', '開始', 'Start')}
              value={settings.startMenuBackgroundGradientStart}
              onChange={(value) => updateWebSettings('startMenuBackgroundGradientStart', value)}
            />
            <StyleColorTile
              icon={Palette}
              label={t('终点', '終了', 'End')}
              value={settings.startMenuBackgroundGradientEnd}
              onChange={(value) => updateWebSettings('startMenuBackgroundGradientEnd', value)}
            />
            <StyleNumberTile
              icon={RotateCw}
              label={t('角度', '角度', 'Angle')}
              value={settings.startMenuBackgroundGradientAngle}
              min={0}
              max={360}
              step={1}
              unit="deg"
              onChange={(value) => updateWebSettings('startMenuBackgroundGradientAngle', value)}
            />
          </div>
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

      {settings.startMenuBackgroundType === 'image' && (
        <StyleTileField
          description={
            showDescriptions
              ? t('启动页背景图片地址', 'タイトル画面の背景画像URL', 'Start screen background image URL')
              : undefined
          }
        >
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <StyleTileShell icon={ImagePlus}>
                <input
                  type="text"
                  value={settings.startMenuBackgroundImageUrl}
                  onChange={(event) =>
                    updateWebSettings('startMenuBackgroundImageUrl', event.target.value)
                  }
                  placeholder={t('背景图片 URL', '背景画像 URL', 'Background image URL')}
                  className="h-10 w-full min-w-0 rounded-r-lg border-0 bg-transparent px-2 text-right text-xs font-normal text-[var(--vr-text)] outline-none transition-colors placeholder:text-[var(--vr-text-muted)] focus:bg-white/5"
                  aria-label={t('背景图片 URL', '背景画像 URL', 'Background image URL')}
                />
              </StyleTileShell>
            </div>
            <StylePreviewTile
              icon={Palette}
              background={backgroundPreview}
              label={t('背景预览', '背景プレビュー', 'Background preview')}
            />
          </div>
        </StyleTileField>
      )}
    </div>
  );
}
