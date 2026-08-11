import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
  CHARACTER_APPEARANCE_ASSET_GUIDE,
  CHARACTER_APPEARANCE_CANVAS,
  createDemoCharacterAppearance,
  DEMO_APPEARANCE_CATALOG,
  resolveAppearanceLayers,
} from '../lib/characterAppearance';

type Props = { onClose: () => void };

const labels = {
  title: '\u89d2\u8272\u88c5\u914d Demo',
  clothes: '\u8863\u670d',
  hair: '\u53d1\u578b',
  expression: '\u8868\u60c5',
  sourceColor: '\u5f53\u524d\u7d20\u6750\u4fdd\u7559\u81ea\u5e26\u914d\u8272\uff1b\u66ff\u6362\u4e3a\u7070\u9636\u7d20\u6750\u540e\uff0c\u53ef\u518d\u542f\u7528\u8c03\u8272\u76d8\u65b9\u6848\u3002',
  wait: '\u6b63\u5728\u52a0\u8f7d\u89d2\u8272\u7d20\u6750',
};

const loadImage = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error(url));
  image.src = url;
});

const OptionButton = ({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) => (
  <button type="button" onClick={onClick} className={`rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${active ? 'border-purple-400 bg-purple-500/15 text-purple-600 dark:text-purple-300' : 'border-[var(--card-border)] text-[var(--text-secondary)] hover:bg-[var(--app-bg)]'}`}>{children}</button>
);

export function CharacterAppearanceDemo({ onClose }: Props) {
  const [appearance, setAppearance] = useState(createDemoCharacterAppearance);
  const [loadedLayers, setLoadedLayers] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layers = useMemo(() => resolveAppearanceLayers(appearance), [appearance]);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    canvas.width = CHARACTER_APPEARANCE_CANVAS.width;
    canvas.height = CHARACTER_APPEARANCE_CANVAS.height;
    context.clearRect(0, 0, canvas.width, canvas.height);
    setLoadedLayers(0);
    Promise.allSettled(layers.map((layer) => loadImage(layer.url))).then((results) => {
      if (cancelled) return;
      let loaded = 0;
      results.forEach((result, index) => {
        if (result.status !== 'fulfilled') return;
        const layer = layers[index];
        if (layer.id === 'face') {
          context.save();
          context.translate(appearance.faceTransform.offsetX, appearance.faceTransform.offsetY);
          context.translate(CHARACTER_APPEARANCE_CANVAS.faceAnchor.x, CHARACTER_APPEARANCE_CANVAS.faceAnchor.y);
          context.scale(appearance.faceTransform.scale, appearance.faceTransform.scale);
          context.translate(-CHARACTER_APPEARANCE_CANVAS.faceAnchor.x, -CHARACTER_APPEARANCE_CANVAS.faceAnchor.y);
          context.drawImage(result.value, 0, 0, canvas.width, canvas.height);
          context.restore();
        } else context.drawImage(result.value, 0, 0, canvas.width, canvas.height);
        loaded += 1;
      });
      setLoadedLayers(loaded);
    });
    return () => { cancelled = true; };
  }, [appearance, layers]);

  const updateFace = (key: 'offsetX' | 'offsetY' | 'scale', value: number) => setAppearance((current) => ({ ...current, faceTransform: { ...current.faceTransform, [key]: value } }));
  const { outfits, hairs, faces } = DEMO_APPEARANCE_CATALOG;

  return <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onMouseDown={onClose}>
    <section className="grid max-h-[min(760px,calc(100vh-32px))] w-full max-w-4xl overflow-hidden rounded-2xl border border-white/60 bg-[var(--card-bg)] shadow-2xl md:grid-cols-[minmax(0,1fr)_320px]" role="dialog" aria-modal="true" aria-label={labels.title} onMouseDown={(event) => event.stopPropagation()}>
      <div className="min-h-[440px] bg-[radial-gradient(circle_at_50%_25%,#293c5f_0%,#111827_58%,#090d16_100%)] p-5"><div className="relative mx-auto h-full min-h-[400px] max-w-[430px] overflow-hidden rounded-xl border border-white/15 bg-slate-950/35"><canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-contain" />{loadedLayers < layers.length && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/55 px-8 text-center text-xs text-white/80"><span>{labels.wait}</span><span className="text-[10px] text-white/55">{loadedLayers}/{layers.length}</span><code className="text-[9px] text-cyan-200/85">public/presets/characters/female/avatar/</code></div>}</div></div>
      <div className="overflow-y-auto p-4 custom-scrollbar"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-bold text-[var(--text-primary)]">{labels.title}</h2><p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{faces.length} \u4e2a\u8868\u60c5 \u00b7 {hairs.length} \u4e2a\u53d1\u578b \u00b7 {outfits.length} \u4ef6\u8863\u670d</p></div><button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-sm text-[var(--text-muted)] hover:bg-[var(--app-bg)]">\u00d7</button></div>
        <div className="space-y-2 border-t border-[var(--card-border)] pt-3"><label className="text-[11px] font-bold text-[var(--text-secondary)]">{labels.clothes}</label><div className="flex flex-wrap gap-2">{outfits.map(({ id, label }) => <OptionButton key={id} active={appearance.outfitId === id} onClick={() => setAppearance((current) => ({ ...current, outfitId: id }))}>{label}</OptionButton>)}</div></div>
        <div className="mt-4 space-y-2"><label className="text-[11px] font-bold text-[var(--text-secondary)]">{labels.hair}</label><div className="flex flex-wrap gap-2">{hairs.map(({ id, label }) => <OptionButton key={id} active={appearance.hairId === id} onClick={() => setAppearance((current) => ({ ...current, hairId: id }))}>{label}</OptionButton>)}</div></div>
        <div className="mt-4 space-y-2"><label className="text-[11px] font-bold text-[var(--text-secondary)]">{labels.expression}</label><div className="flex flex-wrap gap-2">{faces.map(({ id, label }) => <OptionButton key={id} active={appearance.faceId === id} onClick={() => setAppearance((current) => ({ ...current, faceId: id }))}>{label}</OptionButton>)}</div></div>
        <p className="mt-4 rounded-lg border border-amber-400/25 bg-amber-400/10 px-2.5 py-2 text-[11px] leading-relaxed text-[var(--text-secondary)]">{labels.sourceColor}</p>
        <div className="mt-4 space-y-2 border-t border-[var(--card-border)] pt-3">{([['offsetX', '\u6c34\u5e73', -100, 100, 1], ['offsetY', '\u5782\u76f4', -100, 100, 1], ['scale', '\u7f29\u653e', 0.8, 1.2, 0.01]] as const).map(([key, label, min, max, step]) => <label key={key} className="grid grid-cols-[32px_1fr_44px] items-center gap-2 text-[10px] text-[var(--text-muted)]"><span>{label}</span><input type="range" min={min} max={max} step={step} value={appearance.faceTransform[key]} onChange={(event) => updateFace(key, Number(event.target.value))} /><span className="text-right tabular-nums">{key === 'scale' ? `${Math.round(appearance.faceTransform[key] * 100)}%` : appearance.faceTransform[key]}</span></label>)}</div>
        <a href={CHARACTER_APPEARANCE_ASSET_GUIDE} target="_blank" rel="noreferrer" className="mt-4 block text-center text-[11px] text-purple-500 hover:underline">\u67e5\u770b\u7d20\u6750\u89c4\u8303</a>
      </div>
    </section>
  </div>;
}
