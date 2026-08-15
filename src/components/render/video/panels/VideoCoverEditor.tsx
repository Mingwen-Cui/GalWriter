import type { Node as FlowNode } from '@xyflow/react';
import { Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';

import { renderVideoCoverCanvas } from '../export/videoCover';
import type { VideoCoverSettings } from '../shared/types';

type VideoCoverEditorProps = {
  cover: VideoCoverSettings;
  nodes: FlowNode[];
  resolution: { width: number; height: number };
  language: 'zh' | 'en' | 'ja';
  onChange: (cover: VideoCoverSettings) => void;
  onDelete: () => void;
  onClose: () => void;
};

const copy = (language: VideoCoverEditorProps['language']) =>
  language === 'zh'
    ? {
        title: '视频封面',
        source: '封面来源',
        frame: '视频帧',
        image: '素材图片',
        gradient: '渐变底色',
        pickVideo: '选择视频',
        frameTime: '取帧时间（秒）',
        pickImage: '选择已有图片素材',
        headline: '标题',
        subtitle: '副标题',
        textLayout: '文字排版',
        align: '对齐',
        delete: '删除封面',
        close: '完成',
        confirm: '确定要删除这个视频封面吗？导出时将不再生成 PNG。',
        noMedia: '暂无可用素材，可先在项目中添加图片或视频。',
      }
    : language === 'ja'
      ? {
          title: '動画カバー',
          source: 'カバー素材',
          frame: '動画フレーム',
          image: '画像素材',
          gradient: 'グラデーション',
          pickVideo: '動画を選択',
          frameTime: 'フレーム時間（秒）',
          pickImage: '既存画像を選択',
          headline: 'タイトル',
          subtitle: 'サブタイトル',
          textLayout: '文字レイアウト',
          align: '揃え',
          delete: 'カバーを削除',
          close: '完了',
          confirm: 'この動画カバーを削除しますか？エクスポート時に PNG は生成されません。',
          noMedia: '利用できる素材がありません。先に画像または動画を追加してください。',
        }
      : {
          title: 'Video cover',
          source: 'Cover source',
          frame: 'Video frame',
          image: 'Image asset',
          gradient: 'Gradient',
          pickVideo: 'Choose video',
          frameTime: 'Frame time (seconds)',
          pickImage: 'Choose an existing image',
          headline: 'Title',
          subtitle: 'Subtitle',
          textLayout: 'Text layout',
          align: 'Align',
          delete: 'Delete cover',
          close: 'Done',
          confirm: 'Delete this video cover? A PNG will no longer be exported.',
          noMedia: 'No usable media yet. Add an image or video to the project first.',
        };

const nodeLabel = (node: FlowNode) => String(node.data?.title || node.data?.label || node.id);

export function VideoCoverEditor({
  cover,
  nodes,
  resolution,
  language,
  onChange,
  onDelete,
  onClose,
}: VideoCoverEditorProps) {
  const text = copy(language);
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const videoNodes = useMemo(
    () => nodes.filter((node) => typeof node.data?.videoUrl === 'string' && node.data.videoUrl),
    [nodes],
  );
  const imageNodes = useMemo(
    () => nodes.filter((node) => typeof node.data?.imageUrl === 'string' && node.data.imageUrl),
    [nodes],
  );

  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;
    void renderVideoCoverCanvas({
      settings: cover,
      nodes,
      width: 960,
      height: 540,
      canvas: preview,
    }).catch(() => undefined);
  }, [cover, nodes]);

  const patch = (value: Partial<VideoCoverSettings>) => onChange({ ...cover, ...value });
  const range = (
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    key: keyof VideoCoverSettings,
  ) => (
    <label className="grid grid-cols-[1fr_56px] items-center gap-2 text-[11px] font-bold text-slate-600">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) =>
          patch({ [key]: Number(event.target.value) } as Partial<VideoCoverSettings>)
        }
        className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-right text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
      />
    </label>
  );

  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="grid h-[min(860px,calc(100vh-32px))] w-[min(1320px,100%)] grid-cols-[minmax(0,1fr)_340px] overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl max-md:h-auto max-md:max-h-[calc(100vh-32px)] max-md:grid-cols-1">
        <section className="min-h-0 bg-slate-950 p-7 max-md:p-4">
          <canvas ref={previewRef} className="h-auto w-full rounded-xl bg-slate-900 shadow-2xl" />
          <div className="mt-3 text-xs font-bold text-slate-300">
            <span>
              {resolution.width} × {resolution.height} PNG
            </span>
          </div>
        </section>
        <aside className="min-h-0 overflow-y-auto border-l border-slate-200 bg-slate-50 p-4 max-md:border-l-0 max-md:border-t">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-sm font-black text-slate-950">{text.title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-black text-white"
            >
              {text.close}
            </button>
          </div>
          <div className="space-y-4">
            <section>
              <div className="mb-2 text-[10px] font-black uppercase tracking-wide text-slate-400">
                {text.source}
              </div>
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-200 p-1">
                {(
                  [
                    ['videoFrame', text.frame],
                    ['image', text.image],
                    ['gradient', text.gradient],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => patch({ sourceType: value })}
                    className={`h-8 rounded-md text-[10px] font-black ${cover.sourceType === value ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>
            {cover.sourceType === 'videoFrame' && (
              <section className="space-y-2">
                <label className="grid gap-1 text-[11px] font-bold text-slate-600">
                  <span>{text.pickVideo}</span>
                  <select
                    value={cover.videoNodeId || ''}
                    onChange={(event) => patch({ videoNodeId: event.target.value })}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-800"
                  >
                    <option value="">—</option>
                    {videoNodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {nodeLabel(node)}
                      </option>
                    ))}
                  </select>
                </label>
                {range(text.frameTime, cover.frameTime, 0, 3600, 0.1, 'frameTime')}
                {!videoNodes.length && (
                  <p className="text-[11px] leading-4 text-slate-400">{text.noMedia}</p>
                )}
              </section>
            )}
            {cover.sourceType === 'image' && (
              <section className="space-y-2">
                <div className="text-[11px] font-bold text-slate-600">{text.pickImage}</div>
                <div className="grid max-h-40 grid-cols-3 gap-2 overflow-y-auto">
                  {imageNodes.map((node) => {
                    const url = String(node.data?.imageUrl || '');
                    return (
                      <button
                        key={node.id}
                        type="button"
                        onClick={() => patch({ imageUrl: url })}
                        className={`aspect-square overflow-hidden rounded-lg border-2 ${cover.imageUrl === url ? 'border-indigo-500' : 'border-transparent'}`}
                        title={nodeLabel(node)}
                      >
                        <img src={url} alt="" className="h-full w-full object-cover" />
                      </button>
                    );
                  })}
                </div>
                {!imageNodes.length && (
                  <p className="text-[11px] leading-4 text-slate-400">{text.noMedia}</p>
                )}
              </section>
            )}
            {cover.sourceType === 'gradient' && (
              <section className="grid grid-cols-2 gap-2">
                {(['gradientStart', 'gradientEnd'] as const).map((key) => (
                  <label key={key} className="text-[10px] font-bold text-slate-500">
                    <span>{key === 'gradientStart' ? 'A' : 'B'}</span>
                    <input
                      type="color"
                      value={cover[key]}
                      onChange={(event) => patch({ [key]: event.target.value })}
                      className="mt-1 block h-9 w-full rounded-lg border border-slate-200 bg-white p-1"
                    />
                  </label>
                ))}
              </section>
            )}
            <section className="space-y-2 border-t border-slate-200 pt-4">
              <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                {text.textLayout}
              </div>
              <input
                value={cover.title}
                onChange={(event) => patch({ title: event.target.value })}
                placeholder={text.headline}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
              />
              <input
                value={cover.subtitle}
                onChange={(event) => patch({ subtitle: event.target.value })}
                placeholder={text.subtitle}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
              />
              <div className="grid grid-cols-2 gap-2">
                {range('标题 X%', cover.titleX, 0, 100, 1, 'titleX')}
                {range('标题 Y%', cover.titleY, 0, 100, 1, 'titleY')}
                {range('副标题 X%', cover.subtitleX, 0, 100, 1, 'subtitleX')}
                {range('副标题 Y%', cover.subtitleY, 0, 100, 1, 'subtitleY')}
              </div>
              <label className="grid gap-1 text-[11px] font-bold text-slate-600">
                <span>{text.align}</span>
                <select
                  value={cover.textAlign}
                  onChange={(event) =>
                    patch({ textAlign: event.target.value as VideoCoverSettings['textAlign'] })
                  }
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-800"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </label>
            </section>
            <section className="border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(text.confirm)) {
                    onDelete();
                    onClose();
                  }
                }}
                className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white text-xs font-black text-rose-600 hover:bg-rose-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {text.delete}
              </button>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}
