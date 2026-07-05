import type { CSSProperties } from 'react';

import type { Language } from '../../../lib/i18n';
import { renderCopy } from '../video/shared/renderCopy';
import type { WebExportSettings } from '../video/shared/types';

type WebPreviewMenuPagesProps = {
  language: Language;
  settings: WebExportSettings;
  archiveOpen: boolean;
  settingsOpen: boolean;
  backgroundClass: string;
  backgroundStyle?: CSSProperties;
  choiceColor: string;
  choiceTextColor: string;
  previewControlsHidden: boolean;
  onCloseArchive: () => void;
  onCloseSettings: () => void;
  onNewGame: () => void;
  onToggleControls: () => void;
  onUpdateSettings: <K extends keyof WebExportSettings>(key: K, value: WebExportSettings[K]) => void;
};

export function WebPreviewMenuPages({
  language,
  settings,
  archiveOpen,
  settingsOpen,
  backgroundClass,
  backgroundStyle,
  choiceColor,
  choiceTextColor,
  previewControlsHidden,
  onCloseArchive,
  onCloseSettings,
  onNewGame,
  onToggleControls,
  onUpdateSettings,
}: WebPreviewMenuPagesProps) {
  const t = (zh: string, ja: string, en: string) => renderCopy(language, zh, ja, en);
  const primaryButtonStyle = {
    borderColor: 'rgba(255,255,255,0.22)',
    background: choiceColor,
    color: choiceTextColor,
  };

  return (
    <>
      {archiveOpen && (
        <div className={`absolute inset-0 z-50 text-white ${backgroundClass}`} style={backgroundStyle}>
          <div className="relative z-10 flex h-full flex-col bg-black/28 p-6 text-white">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xl font-black tracking-wide">{t('存档', 'セーブ', 'Save')}</div>
              <button
                type="button"
                onClick={onCloseArchive}
                className="h-10 rounded-xl border border-white/14 bg-white/10 px-4 text-xs font-black text-white/82 transition-colors hover:bg-white/18 hover:text-white"
              >
                {t('返回', '戻る', 'Back')}
              </button>
            </div>
            <div className="flex flex-1 items-center justify-center">
              <div className="grid w-[min(520px,100%)] gap-3">
                <button
                  type="button"
                  className="grid min-h-20 gap-1 rounded-xl border px-4 py-4 text-left text-sm font-black transition-transform active:scale-[0.99]"
                  style={{
                    borderColor: 'rgba(255,255,255,0.16)',
                    background: 'rgba(255,255,255,0.10)',
                    color: '#f8fafc',
                  }}
                >
                  <span>{t('没有存档', 'セーブなし', 'No save')}</span>
                  <span className="text-xs font-bold text-white/50">
                    {t(
                      '导出后的网页会在这里显示上次进度。',
                      '書き出し後のWebでは前回の進行がここに表示されます。',
                      'Exported web builds show the last progress here.',
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={onNewGame}
                  className="h-12 rounded-xl border px-4 text-sm font-black transition-transform hover:brightness-110 active:scale-[0.99]"
                  style={primaryButtonStyle}
                >
                  {t('新游戏', '新規ゲーム', 'New Game')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {settingsOpen && (
        <div className={`absolute inset-0 z-50 text-white ${backgroundClass}`} style={backgroundStyle}>
          <div className="relative z-10 flex h-full flex-col bg-black/28 p-6 text-white">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xl font-black tracking-wide">{t('设置', '設定', 'Settings')}</div>
              <button
                type="button"
                onClick={onCloseSettings}
                className="h-10 rounded-xl border border-white/14 bg-white/10 px-4 text-xs font-black text-white/82 transition-colors hover:bg-white/18 hover:text-white"
              >
                {t('返回', '戻る', 'Back')}
              </button>
            </div>
            <div className="flex flex-1 items-center justify-center">
              <div className="grid w-[min(520px,100%)] gap-3">
                <button
                  type="button"
                  onClick={() => onUpdateSettings('autoAdvance', !settings.autoAdvance)}
                  className="flex h-12 items-center justify-between rounded-xl border border-white/12 bg-white/10 px-4 text-sm font-black text-white/86 transition-colors hover:bg-white/16"
                >
                  <span>{t('自动播放', '自動再生', 'Auto play')}</span>
                  <span className={`h-5 w-10 rounded-full p-0.5 ${settings.autoAdvance ? 'bg-sky-500' : 'bg-white/18'}`}>
                    <span
                      className={`block h-4 w-4 rounded-full bg-white transition-transform ${
                        settings.autoAdvance ? 'translate-x-5' : ''
                      }`}
                    />
                  </span>
                </button>
                <label className="grid gap-2 rounded-xl border border-white/12 bg-white/10 p-4">
                  <div className="flex items-center justify-between text-sm font-black text-white/86">
                    <span>{t('打字速度', 'テキスト速度', 'Text speed')}</span>
                    <span className="text-xs text-white/55">{settings.typewriterSpeed}ms</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={200}
                    step={5}
                    value={settings.typewriterSpeed}
                    onChange={(event) => onUpdateSettings('typewriterSpeed', Number(event.target.value))}
                    className="w-full accent-sky-400"
                  />
                </label>
                <button
                  type="button"
                  onClick={onToggleControls}
                  className="flex h-12 items-center justify-between rounded-xl border px-4 text-sm font-black transition-transform hover:brightness-110 active:scale-[0.99]"
                  style={primaryButtonStyle}
                >
                  <span>{t('显示控制栏', '操作表示', 'Show controls')}</span>
                  <span>{previewControlsHidden ? t('关闭', 'オフ', 'Off') : t('开启', 'オン', 'On')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
