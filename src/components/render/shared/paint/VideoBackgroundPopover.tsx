import { resolveKnownAppAssetUrl } from '../../../../lib/appAssets';
import type { Language } from '../../../../lib/i18n';
export function VideoBackgroundPopover({
  language,
  videoUrl,
  loop,
  muted,
  fit,
  onChange,
}: {
  language: Language;
  videoUrl: string;
  loop: boolean;
  muted: boolean;
  fit: 'crop' | 'fit';
  onChange: (updates: {
    videoUrl?: string;
    videoLoop?: boolean;
    videoMuted?: boolean;
    videoFit?: 'crop' | 'fit';
  }) => void;
}) {
  const copy =
    language === 'en'
      ? ['Video background', 'Replace video', 'Loop', 'Mute', 'Fill', 'Fit']
      : language === 'ja'
        ? ['動画背景', '動画を置換', 'ループ', 'ミュート', 'トリミング', '全体表示']
        : ['视频背景', '替换视频', '循环', '静音', '裁切填满', '完整显示'];
  return (
    <div className="property-paint-popover rounded-lg border p-3 shadow-xl">
      <label className="grid h-32 cursor-pointer place-items-center overflow-hidden rounded-xl bg-slate-950">
        {videoUrl ? (
          <video
            src={resolveKnownAppAssetUrl(videoUrl)}
            autoPlay
            muted
            loop
            playsInline
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-xs font-medium text-white">{copy[0]}</span>
        )}
        <input
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => onChange({ videoUrl: String(reader.result || '') });
            reader.readAsDataURL(file);
            event.target.value = '';
          }}
        />
      </label>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <button
          type="button"
          onClick={() => onChange({ videoLoop: !loop })}
          className={`h-9 rounded-lg ${loop ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700'}`}
        >
          {copy[2]}
        </button>
        <button
          type="button"
          onClick={() => onChange({ videoMuted: !muted })}
          className={`h-9 rounded-lg ${muted ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700'}`}
        >
          {copy[3]}
        </button>
        <button
          type="button"
          onClick={() => onChange({ videoFit: 'crop' })}
          className={`h-9 rounded-lg ${fit === 'crop' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700'}`}
        >
          {copy[4]}
        </button>
        <button
          type="button"
          onClick={() => onChange({ videoFit: 'fit' })}
          className={`h-9 rounded-lg ${fit === 'fit' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700'}`}
        >
          {copy[5]}
        </button>
      </div>
    </div>
  );
}
