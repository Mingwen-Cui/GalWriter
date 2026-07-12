import { Eye, EyeOff, ImagePlus, MoveHorizontal, MoveVertical, RotateCcw, Scaling } from 'lucide-react';
import { useRef } from 'react';

import type { Language } from '../../../lib/i18n';
import type { SharedCanvasSettings } from './canvasSettings';

type Props = {
  language: Language;
  value: SharedCanvasSettings;
  onChange: (patch: Partial<SharedCanvasSettings>) => void;
  mode?: 'position' | 'background';
};

export function SceneCanvasInspector({ language, value, onChange, mode = 'position' }: Props) {
  const uploadRef = useRef<HTMLInputElement>(null);
  const t = (zh: string, ja: string, en: string) =>
    language === 'zh' ? zh : language === 'ja' ? ja : en;
  const reset = () => onChange({ sceneFit: 'cover', sceneScale: 100, sceneOffsetX: 0, sceneOffsetY: 0 });

  return (
    <div className="space-y-3 text-xs text-slate-900 dark:text-[var(--vr-text)]">
      {mode === 'position' && <section className="rounded-[22px] bg-emerald-50 p-3 dark:bg-emerald-950/25">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-bold">{t('画面位置', '画面位置', 'Scene position')}</div>
          <button type="button" onClick={reset} className="flex h-8 items-center gap-1 rounded-lg bg-white px-2 font-bold text-slate-600 shadow-sm dark:bg-white/10 dark:text-white/75">
            <RotateCcw className="h-3.5 w-3.5" />{t('重置', 'リセット', 'Reset')}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(['cover', 'contain', 'stretch'] as const).map((fit) => (
            <button key={fit} type="button" onClick={() => onChange({ sceneFit: fit })} className={`h-9 rounded-lg font-bold ${value.sceneFit === fit ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 dark:bg-white/10 dark:text-white/75'}`}>
              {fit === 'cover' ? t('填充', '塗りつぶし', 'Fill') : fit === 'contain' ? t('适应', 'フィット', 'Fit') : t('拉伸', 'ストレッチ', 'Stretch')}
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <SceneNumber icon={MoveHorizontal} label="X" value={value.sceneOffsetX} min={-100} max={100} onChange={(sceneOffsetX) => onChange({ sceneOffsetX })} />
          <SceneNumber icon={MoveVertical} label="Y" value={value.sceneOffsetY} min={-100} max={100} onChange={(sceneOffsetY) => onChange({ sceneOffsetY })} />
          <div className="col-span-2">
            <SceneNumber icon={Scaling} label={t('缩放', '拡大縮小', 'Scale')} value={value.sceneScale} min={25} max={400} suffix="%" onChange={(sceneScale) => onChange({ sceneScale })} />
          </div>
        </div>
      </section>}

      {mode === 'background' && <section className="rounded-[22px] bg-sky-50 p-3 dark:bg-sky-950/25">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-bold">{t('背景样式', '背景スタイル', 'Background style')}</div>
          <button type="button" onClick={() => onChange({ sceneBackgroundVisible: !value.sceneBackgroundVisible })} className={`grid h-8 w-12 place-items-center rounded-lg ${value.sceneBackgroundVisible ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 dark:bg-white/10'}`} aria-pressed={value.sceneBackgroundVisible}>
            {value.sceneBackgroundVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(['solid', 'gradient', 'image'] as const).map((type) => (
            <button key={type} type="button" onClick={() => onChange({ sceneBackgroundType: type })} className={`h-9 rounded-lg font-bold ${value.sceneBackgroundType === type ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 dark:bg-white/10 dark:text-white/75'}`}>
              {type === 'solid' ? t('纯色', '単色', 'Solid') : type === 'gradient' ? t('渐变', 'グラデーション', 'Gradient') : t('图片', '画像', 'Image')}
            </button>
          ))}
        </div>
        {value.sceneBackgroundType === 'solid' && (
          <ColorField label={t('背景颜色', '背景色', 'Background')} value={value.sceneBackgroundColor} onChange={(sceneBackgroundColor) => onChange({ sceneBackgroundColor })} />
        )}
        {value.sceneBackgroundType === 'gradient' && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <ColorField label={t('起始颜色', '開始色', 'Start')} value={value.sceneBackgroundGradientStart} onChange={(sceneBackgroundGradientStart) => onChange({ sceneBackgroundGradientStart })} />
            <ColorField label={t('结束颜色', '終了色', 'End')} value={value.sceneBackgroundGradientEnd} onChange={(sceneBackgroundGradientEnd) => onChange({ sceneBackgroundGradientEnd })} />
            <div className="col-span-2"><SceneNumber label={t('渐变角度', '角度', 'Angle')} value={value.sceneBackgroundGradientAngle} min={0} max={360} suffix="°" onChange={(sceneBackgroundGradientAngle) => onChange({ sceneBackgroundGradientAngle })} /></div>
          </div>
        )}
        {value.sceneBackgroundType === 'image' && (
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => uploadRef.current?.click()} className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-white font-bold text-slate-700 dark:bg-white/10 dark:text-white/80"><ImagePlus className="h-4 w-4" />{value.sceneBackgroundImageUrl ? t('更换图片', '画像を変更', 'Replace image') : t('导入图片', '画像を選択', 'Choose image')}</button>
            <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => onChange({ sceneBackgroundImageUrl: String(reader.result || '') }); reader.readAsDataURL(file); event.currentTarget.value = ''; }} />
          </div>
        )}
      </section>}
    </div>
  );
}

function SceneNumber({ icon: Icon, label, value, min, max, suffix = '', onChange }: { icon?: typeof MoveHorizontal; label: string; value: number; min: number; max: number; suffix?: string; onChange: (value: number) => void }) {
  return <label className="block"><span className="mb-1 block text-[10px] text-slate-500 dark:text-white/45">{label}</span><span className="flex h-9 items-center rounded-lg bg-white px-2 dark:bg-white/10">{Icon && <Icon className="mr-2 h-3.5 w-3.5 text-slate-400" />}<input type="number" value={value} min={min} max={max} onChange={(event) => onChange(Math.min(max, Math.max(min, Number(event.target.value) || 0)))} className="min-w-0 flex-1 bg-transparent text-right tabular-nums outline-none" /><span className="ml-1 text-slate-400">{suffix}</span></span></label>;
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="mt-3 block"><span className="mb-1 block text-[10px] text-slate-500 dark:text-white/45">{label}</span><span className="flex h-9 items-center gap-2 rounded-lg bg-white px-2 dark:bg-white/10"><input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onChange={(event) => onChange(event.target.value)} className="h-6 w-7 cursor-pointer border-0 bg-transparent p-0" /><input value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent outline-none" /></span></label>;
}
