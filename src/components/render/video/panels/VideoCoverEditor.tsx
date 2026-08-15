import type { Node as FlowNode } from '@xyflow/react';
import { Check, ImagePlus, Settings2, Trash2, Type, Upload, X } from 'lucide-react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { normalizeSharedCanvasSettings, type SharedCanvasSettings } from '../../canvas/canvasSettings';
import { StartMenuBackgroundInspector } from '../../web/StartMenuBackgroundInspector';
import { StartMenuElementInspector } from '../../web/StartMenuElementInspector';
import { WebEditableElementFrame, type WebEditableResizeHandle } from '../../web/WebEditableElementFrame';
import { renderVideoCoverCanvas } from '../export/videoCover';
import type { VideoCoverElement, VideoCoverSettings, WebExportSettings, WebMenuElement } from '../shared/types';

type VideoCoverEditorProps = {
  cover: VideoCoverSettings;
  nodes: FlowNode[];
  resolution: { width: number; height: number };
  language: 'zh' | 'en' | 'ja';
  onChange: (cover: VideoCoverSettings) => void;
  onDelete: () => void;
  onClose: () => void;
  embedded?: boolean;
};

const copy = (language: VideoCoverEditorProps['language']) =>
  language === 'zh'
    ? {
        title: '封面编辑', addText: '添加文字', addImage: '添加图片', done: '完成',
        inspector: '封面设置', element: '元素设置', background: '封面背景', source: '背景来源',
        frame: '视频帧', image: '素材图片', gradient: '渐变底色', pickVideo: '选择视频',
        frameTime: '取帧时间（秒）', pickImage: '选择图片素材', text: '文字内容',
        imageAsset: '图片素材', position: '位置与尺寸', style: '文字样式', deleteElement: '删除元素',
        deleteCover: '删除封面', confirm: '确定要删除这个视频封面吗？导出时将不再生成 PNG。', cancel: '取消',
        noMedia: '暂无可用图片素材。',
      }
    : language === 'ja'
      ? {
          title: 'カバー編集', addText: 'テキストを追加', addImage: '画像を追加', done: '完了',
          inspector: 'カバー設定', element: '要素設定', background: 'カバー背景', source: '背景素材',
          frame: '動画フレーム', image: '画像素材', gradient: 'グラデーション', pickVideo: '動画を選択',
          frameTime: 'フレーム時間（秒）', pickImage: '画像素材を選択', text: 'テキスト',
          imageAsset: '画像', position: '位置とサイズ', style: 'テキストスタイル', deleteElement: '要素を削除',
          deleteCover: 'カバーを削除', confirm: 'この動画カバーを削除しますか？PNG は書き出されなくなります。', cancel: 'キャンセル',
          noMedia: '利用できる画像素材がありません。',
        }
      : {
          title: 'Cover editor', addText: 'Add text', addImage: 'Add image', done: 'Done',
          inspector: 'Cover settings', element: 'Element settings', background: 'Cover background', source: 'Background source',
          frame: 'Video frame', image: 'Image asset', gradient: 'Gradient', pickVideo: 'Choose video',
          frameTime: 'Frame time (seconds)', pickImage: 'Choose image asset', text: 'Text',
          imageAsset: 'Image asset', position: 'Position and size', style: 'Text style', deleteElement: 'Delete element',
          deleteCover: 'Delete cover', confirm: 'Delete this video cover? A PNG will no longer be exported.', cancel: 'Cancel',
          noMedia: 'No usable image assets yet.',
        };

const nodeLabel = (node: FlowNode) => String(node.data?.title || node.data?.label || node.id);
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const newElementId = (kind: VideoCoverElement['kind']) =>
  `cover-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const textColorWithAlpha = (color: string | undefined, alpha: number | undefined) => {
  const source = color || '#ffffff';
  const match = source.match(/^#([0-9a-f]{6})$/i);
  if (!match) return source;
  const safeAlpha = Math.max(0, Math.min(100, alpha ?? 100)) / 100;
  return `${source}${Math.round(safeAlpha * 255).toString(16).padStart(2, '0')}`;
};

function ToolbarButton({ icon: Icon, label, tone, onClick, disabled }: {
  icon: typeof Type; label: string; tone: 'indigo' | 'emerald'; onClick: () => void; disabled?: boolean;
}) {
  return <button type="button" onClick={onClick} disabled={disabled}
    className={`flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-black transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${tone === 'indigo' ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
    <span className={`grid h-7 w-7 place-items-center rounded-lg text-white ${tone === 'indigo' ? 'bg-indigo-600' : 'bg-emerald-600'}`}><Icon className="h-4 w-4" /></span>{label}
  </button>;
}

export function VideoCoverEditor({ cover, nodes, resolution, language, onChange, onDelete, onClose, embedded = false }: VideoCoverEditorProps) {
  const text = copy(language);
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [editingElementId, setEditingElementId] = useState<string | null>(null);
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const [isDeleteCoverConfirmOpen, setIsDeleteCoverConfirmOpen] = useState(false);
  const [activeTemplateId, setActiveTemplateId] = useState('cinematic');
  const videoNodes = useMemo(() => nodes.filter((node) => typeof node.data?.videoUrl === 'string' && node.data.videoUrl), [nodes]);
  const imageNodes = useMemo(() => nodes.filter((node) => typeof node.data?.imageUrl === 'string' && node.data.imageUrl), [nodes]);
  const elements = cover.elements || [];
  const selectedElement = elements.find((element) => element.id === selectedElementId) || null;
  const selectedInspectorElement = selectedElement
    ? ({ ...selectedElement, text: selectedElement.text || '' } as WebMenuElement)
    : null;
  const coverCanvasSettings = useMemo(
    () => normalizeSharedCanvasSettings({ ...cover.canvasSettings, canvasWidth: cover.canvasSettings?.canvasWidth || resolution.width, canvasHeight: cover.canvasSettings?.canvasHeight || resolution.height }),
    [cover.canvasSettings, resolution.height, resolution.width],
  );
  const coverBackgroundSettings = useMemo(() => ({
    ...coverCanvasSettings,
    startMenuBackgroundType: cover.sourceType === 'videoFrame' ? 'video' : cover.sourceType === 'image' ? 'image' : 'gradient',
    startMenuBackgroundColor: cover.gradientStart,
    startMenuBackgroundGradientStart: cover.gradientStart,
    startMenuBackgroundGradientEnd: cover.gradientEnd,
    startMenuBackgroundGradientAngle: 135,
    startMenuBackgroundImageUrl: cover.imageUrl || '',
    startMenuBackgroundVideoUrl: String(nodes.find((node) => node.id === cover.videoNodeId)?.data?.videoUrl || ''),
  }) as WebExportSettings, [cover, coverCanvasSettings, nodes]);

  useEffect(() => {
    if (cover.logoInitialized) return;
    const legacy: VideoCoverElement[] = [...(cover.elements || [])];
    if (cover.title.trim()) legacy.push({ id: newElementId('text'), kind: 'text', text: cover.title, visible: true, x: 15, y: 50, width: 70, height: 14, rotation: 0, opacity: 100, fontSize: cover.titleFontSize, fontWeight: 900, textAlign: cover.textAlign, textColor: '#ffffff' });
    if (cover.subtitle.trim()) legacy.push({ id: newElementId('text'), kind: 'text', text: cover.subtitle, visible: true, x: 15, y: 65, width: 70, height: 8, rotation: 0, opacity: 100, fontSize: cover.subtitleFontSize, fontWeight: 600, textAlign: cover.textAlign, textColor: '#ffffff' });
    legacy.push({ id: 'cover-logo', kind: 'image', imageUrl: '/glass.png', visible: true, x: 92, y: 88, width: 5, height: 8.8, rotation: 0, opacity: 94, objectFit: 'contain' });
    onChange({ ...cover, title: '', subtitle: '', elements: legacy, logoInitialized: true });
  }, [cover, onChange]);
  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;
    void renderVideoCoverCanvas({ settings: cover, nodes, width: Math.min(1920, coverCanvasSettings.canvasWidth), height: Math.min(1080, coverCanvasSettings.canvasHeight), canvas: preview, includeElements: false }).catch(() => undefined);
  }, [cover, coverCanvasSettings, nodes]);

  const patch = (value: Partial<VideoCoverSettings>) => onChange({ ...cover, ...value });
  const updateCoverCanvas = (value: Partial<SharedCanvasSettings>) => patch({ canvasSettings: { ...cover.canvasSettings, ...value } });
  const updateCoverBackground = (key: keyof WebExportSettings, value: WebExportSettings[keyof WebExportSettings]) => {
    if (key === 'startMenuBackgroundType') { patch({ sourceType: value === 'video' ? 'videoFrame' : value === 'image' ? 'image' : 'gradient' }); return; }
    if (key === 'startMenuBackgroundGradientStart') patch({ gradientStart: String(value) });
    if (key === 'startMenuBackgroundGradientEnd') patch({ gradientEnd: String(value) });
    if (key === 'startMenuBackgroundImageUrl') patch({ imageUrl: String(value) });
    if (key === 'startMenuBackgroundVideoUrl') patch({ videoNodeId: nodes.find((node) => node.data?.videoUrl === value)?.id });
  };
  const updateElements = (next: VideoCoverElement[]) => patch({ elements: next });
  const updateElement = (id: string, value: Partial<VideoCoverElement>) => updateElements(elements.map((element) => element.id === id ? { ...element, ...value } : element));
  const deleteElement = (id: string) => { updateElements(elements.filter((element) => element.id !== id)); setSelectedElementId((current) => current === id ? null : current); };
  const addText = () => {
    const element: VideoCoverElement = { id: newElementId('text'), kind: 'text', text: language === 'zh' ? '输入文字' : language === 'ja' ? 'テキスト' : 'Your text', visible: true, x: 20, y: 42, width: 60, height: 13, rotation: 0, opacity: 100, fontSize: 58, fontWeight: 800, textAlign: 'center', textColor: '#ffffff' };
    updateElements([...elements, element]); setSelectedElementId(element.id);
  };
  const addImage = (imageUrl: string) => {
    if (!imageUrl) return;
    const element: VideoCoverElement = { id: newElementId('image'), kind: 'image', imageUrl, visible: true, x: 32, y: 32, width: 36, height: 36, rotation: 0, opacity: 100, objectFit: 'cover' };
    updateElements([...elements, element]); setSelectedElementId(element.id);
    setIsImagePickerOpen(false);
  };
  const addUploadedImage = (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => addImage(String(reader.result || ''));
    reader.readAsDataURL(file);
  };
  const templateNames =
    language === 'zh'
      ? { cinematic: '电影开场', minimal: '极简留白', poster: '霓虹海报', photo: '图片焦点' }
      : language === 'ja'
        ? { cinematic: 'シネマ', minimal: 'ミニマル', poster: 'ネオン', photo: '写真' }
        : { cinematic: 'Cinematic', minimal: 'Minimal', poster: 'Neon poster', photo: 'Photo focus' };
  const applyTemplate = (templateId: keyof typeof templateNames) => {
    const imageUrl = cover.imageUrl || String(imageNodes[0]?.data?.imageUrl || '');
    const logo: VideoCoverElement = { id: 'cover-logo', kind: 'image', imageUrl: '/glass.png', visible: true, x: 92, y: 88, width: 5, height: 8.8, rotation: 0, opacity: 94, objectFit: 'contain' };
    const title: VideoCoverElement = { id: 'cover-title', kind: 'text', text: language === 'zh' ? '开始' : language === 'ja' ? 'はじまり' : 'BEGIN', visible: true, x: 16, y: 48, width: 68, height: 14, rotation: 0, opacity: 100, fontSize: 72, fontWeight: 900, textAlign: 'center', textColor: '#ffffff' };
    const subtitle: VideoCoverElement = { id: 'cover-subtitle', kind: 'text', text: language === 'zh' ? '故事即将开始' : language === 'ja' ? '物語が始まります' : 'The story begins', visible: true, x: 22, y: 64, width: 56, height: 7, rotation: 0, opacity: 90, fontSize: 30, fontWeight: 600, textAlign: 'center', textColor: '#dbeafe' };
    const presets = {
      cinematic: { sourceType: 'gradient' as const, gradientStart: '#061b2b', gradientEnd: '#0f7490', elements: [title, subtitle, logo] },
      minimal: { sourceType: 'gradient' as const, gradientStart: '#111827', gradientEnd: '#334155', elements: [{ ...title, y: 43, fontSize: 64 }, logo] },
      poster: { sourceType: 'gradient' as const, gradientStart: '#3b0764', gradientEnd: '#db2777', elements: [{ ...title, y: 58, textAlign: 'left', x: 10, width: 80 }, { ...subtitle, y: 73, textAlign: 'left', x: 10, width: 70 }, logo] },
      photo: { sourceType: imageUrl ? 'image' as const : 'gradient' as const, gradientStart: '#172554', gradientEnd: '#0f766e', imageUrl, elements: [{ ...title, y: 68, fontSize: 62 }, { ...subtitle, y: 80 }, logo] },
    };
    const preset = presets[templateId];
    onChange({ ...cover, ...preset, title: '', subtitle: '', logoInitialized: true });
    setActiveTemplateId(templateId);
    setSelectedElementId(null);
  };
  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>, element: VideoCoverElement) => {
    if ((event.target as HTMLElement).closest('[data-cover-control="true"]')) return;
    if (editingElementId === element.id) return;
    event.preventDefault(); event.stopPropagation(); setSelectedElementId(element.id);
    const rect = stageRef.current?.getBoundingClientRect(); if (!rect) return;
    const startX = event.clientX; const startY = event.clientY;
    const move = (moveEvent: PointerEvent) => updateElement(element.id, { x: clamp(element.x + ((moveEvent.clientX - startX) / rect.width) * 100, 0, 100 - element.width), y: clamp(element.y + ((moveEvent.clientY - startY) / rect.height) * 100, 0, 100 - element.height) });
    const end = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end);
  };
  const beginResize = (event: ReactPointerEvent<HTMLElement>, element: VideoCoverElement, handle: WebEditableResizeHandle) => {
    event.preventDefault(); event.stopPropagation(); const rect = stageRef.current?.getBoundingClientRect(); if (!rect) return;
    const startX = event.clientX; const startY = event.clientY;
    const move = (moveEvent: PointerEvent) => {
      const dx = ((moveEvent.clientX - startX) / rect.width) * 100; const dy = ((moveEvent.clientY - startY) / rect.height) * 100;
      let x = element.x; let y = element.y; let width = element.width; let height = element.height;
      if (handle.includes('e')) width = clamp(element.width + dx, 4, 100 - element.x);
      if (handle.includes('s')) height = clamp(element.height + dy, 4, 100 - element.y);
      if (handle.includes('w')) { x = clamp(element.x + dx, 0, element.x + element.width - 4); width = element.width - (x - element.x); }
      if (handle.includes('n')) { y = clamp(element.y + dy, 0, element.y + element.height - 4); height = element.height - (y - element.y); }
      updateElement(element.id, { x, y, width, height });
    };
    const end = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end);
  };
  const beginRotate = (event: ReactPointerEvent<HTMLElement>, element: VideoCoverElement) => {
    event.preventDefault(); event.stopPropagation(); const rect = stageRef.current?.getBoundingClientRect(); if (!rect) return;
    const centerX = rect.left + ((element.x + element.width / 2) / 100) * rect.width; const centerY = rect.top + ((element.y + element.height / 2) / 100) * rect.height;
    const startAngle = Math.atan2(event.clientY - centerY, event.clientX - centerX);
    const move = (moveEvent: PointerEvent) => { const angle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX); updateElement(element.id, { rotation: element.rotation + ((angle - startAngle) * 180) / Math.PI }); };
    const end = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end);
  };
  const numberField = (label: string, value: number, onValue: (next: number) => void, min = 0, max = 100, step = 1) => <label className="grid gap-1 text-[10px] font-bold text-[var(--vr-text-muted)]"><span>{label}</span><input type="number" min={min} max={max} step={step} value={Number.isFinite(value) ? value : 0} onChange={(event) => onValue(Number(event.target.value))} className="h-9 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface)] px-2 text-xs font-bold text-[var(--vr-text)] outline-none focus:border-[var(--vr-accent)]" /></label>;

  return <div className={embedded ? 'h-full min-h-0 min-w-0 overflow-hidden bg-[var(--vr-bg)]' : 'fixed inset-0 z-[200] grid place-items-center bg-slate-950/20 p-6'}>
    <div className={`relative grid w-full overflow-hidden bg-[var(--vr-bg)] grid-rows-[52px_minmax(0,1fr)] ${embedded ? 'h-full' : 'h-[min(760px,calc(100vh-48px))] max-w-[1180px] rounded-2xl border border-white/70 shadow-2xl'}`}>
      <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-[var(--vr-border)] bg-[var(--vr-surface)] px-4">
        <div className="flex min-w-0 items-center gap-2 text-xs font-black tracking-wide text-[var(--vr-text-soft)]"><Settings2 className="h-4 w-4 text-[var(--vr-accent)]" /><span className="truncate">{text.title}</span><button type="button" onClick={() => setIsDeleteCoverConfirmOpen(true)} className="ml-1 flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-black text-rose-600 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" />{text.deleteCover}</button></div>
        <div className="flex items-center gap-2"><ToolbarButton icon={Type} label={text.addText} tone="indigo" onClick={addText} /><ToolbarButton icon={ImagePlus} label={text.addImage} tone="emerald" onClick={() => setIsImagePickerOpen(true)} /></div>
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="flex h-9 items-center gap-1.5 rounded-lg bg-[var(--vr-accent)] px-3 text-xs font-black text-white hover:brightness-105"><Check className="h-4 w-4" />{text.done}</button><button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--vr-surface-soft)] text-[var(--vr-text-soft)] hover:bg-[var(--vr-border)]" aria-label="Close"><X className="h-4 w-4" /></button></div>
      </header>
      {isImagePickerOpen && <div className="absolute left-1/2 top-14 z-[300] w-[min(520px,calc(100%-32px))] -translate-x-1/2 rounded-2xl border border-[var(--vr-border)] bg-[var(--vr-surface)] p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between gap-3"><div className="text-sm font-black text-[var(--vr-text)]">{text.pickImage}</div><button type="button" onClick={() => setIsImagePickerOpen(false)} className="rounded-lg px-2 py-1 text-xs font-bold text-[var(--vr-text-muted)] hover:bg-[var(--vr-surface-soft)]">×</button></div>
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { addUploadedImage(event.target.files?.[0]); event.currentTarget.value = ''; }} />
        <button type="button" onClick={() => imageInputRef.current?.click()} className="mb-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-300 bg-emerald-50 text-xs font-black text-emerald-700 hover:bg-emerald-100"><Upload className="h-4 w-4" />上传图片</button>
        <div className="grid max-h-72 grid-cols-4 gap-2 overflow-y-auto">{imageNodes.map((node) => { const url = String(node.data?.imageUrl || ''); return <button key={node.id} type="button" onClick={() => addImage(url)} className="aspect-square overflow-hidden rounded-xl border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] hover:ring-2 hover:ring-[var(--vr-accent)]" title={nodeLabel(node)}><img src={url} alt="" className="h-full w-full object-cover" /></button>; })}</div>
        {!imageNodes.length && <p className="py-5 text-center text-xs text-[var(--vr-text-muted)]">{text.noMedia}</p>}
      </div>}
      <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_330px] max-md:grid-cols-1">
        <section className="flex min-h-0 min-w-0 flex-col bg-[var(--vr-surface-soft)]"><div className="min-h-0 flex-1 overflow-auto p-5"><div className="mx-auto flex min-h-full min-w-[620px] items-center justify-center"><div ref={stageRef} className="relative w-full max-w-[1120px] overflow-visible bg-slate-950 shadow-2xl" style={{ aspectRatio: `${coverCanvasSettings.canvasWidth} / ${coverCanvasSettings.canvasHeight}` }} onPointerDown={() => setSelectedElementId(null)}>
          <canvas ref={previewRef} className="absolute inset-0 h-full w-full" />
          {elements.map((element) => <div key={element.id} data-cover-element="true" className={`absolute cursor-move touch-none ${element.visible ? '' : 'opacity-35'}`} style={{ left: `${element.x}%`, top: `${element.y}%`, width: `${element.width}%`, height: `${element.height}%`, transform: `rotate(${element.rotation}deg)`, opacity: element.opacity / 100 }} onPointerDown={(event) => beginDrag(event, element)}>
            {element.kind === 'text' ? <div contentEditable={editingElementId === element.id} suppressContentEditableWarning onDoubleClick={(event) => { event.stopPropagation(); setSelectedElementId(element.id); setEditingElementId(element.id); event.currentTarget.focus(); }} onBlur={(event) => { updateElement(element.id, { text: event.currentTarget.innerText }); setEditingElementId(null); }} className="flex h-full w-full items-center overflow-hidden whitespace-pre-wrap break-words px-1 leading-tight outline-none" style={{ color: textColorWithAlpha(element.textColor, element.textColorAlpha), fontFamily: element.fontFamily, fontSize: `${Math.max(12, (element.fontSize || 54) / 11)}px`, fontWeight: element.fontWeight || 800, letterSpacing: `${element.letterSpacing || 0}px`, lineHeight: element.lineHeight || 1.28, textAlign: element.textAlign || 'center', justifyContent: element.textAlign === 'left' ? 'flex-start' : element.textAlign === 'right' ? 'flex-end' : 'center', textShadow: '0 2px 5px rgba(2, 6, 23, .7)' }}>{element.text}</div> : element.imageUrl ? <img src={element.imageUrl} alt="" draggable={false} className="h-full w-full select-none" style={{ objectFit: element.objectFit || 'cover' }} /> : null}
            {selectedElementId === element.id && <WebEditableElementFrame visible={element.visible} onToggleVisible={(event) => { event.stopPropagation(); updateElement(element.id, { visible: !element.visible }); }} onDelete={(event) => { event.stopPropagation(); deleteElement(element.id); }} onRotatePointerDown={(event) => beginRotate(event, element)} onResizePointerDown={(event, handle) => beginResize(event, element, handle)} />}
          </div>)}
        </div></div></div><div className="border-t border-[var(--vr-border)] bg-[var(--vr-surface)] px-5 py-3"><div className="mb-2 text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">{language === 'zh' ? '封面模板' : language === 'ja' ? 'カバーテンプレート' : 'Cover templates'}</div><div className="grid grid-cols-4 gap-2">{(['cinematic', 'minimal', 'poster', 'photo'] as Array<keyof typeof templateNames>).map((templateId) => <button key={templateId} type="button" onClick={() => applyTemplate(templateId)} className={`group overflow-hidden rounded-xl border p-1 text-left transition-all ${activeTemplateId === templateId ? 'border-[var(--vr-accent)] ring-2 ring-[var(--vr-accent-soft)]' : 'border-[var(--vr-border)] hover:border-[var(--vr-accent)]'}`}><span className={`relative flex h-12 items-center justify-center overflow-hidden rounded-lg px-2 text-[10px] font-black text-white ${templateId === 'cinematic' ? 'bg-gradient-to-br from-[#061b2b] to-[#0f7490]' : templateId === 'minimal' ? 'bg-gradient-to-br from-slate-900 to-slate-600' : templateId === 'poster' ? 'bg-gradient-to-br from-purple-800 to-pink-600' : 'bg-gradient-to-br from-indigo-800 to-teal-700'}`}><span className="drop-shadow">{templateId === 'poster' ? '夜幕' : templateId === 'photo' ? '影像' : templateId === 'minimal' ? 'BEGIN' : '开始'}</span><span className="absolute bottom-1 right-1 h-2 w-2 rounded-full bg-white/80" /></span><span className="block truncate px-1 pt-1 text-[10px] font-bold text-[var(--vr-text-soft)]">{templateNames[templateId]}</span></button>)}</div></div></section>
        <aside className="min-h-0 overflow-y-auto border-l border-[var(--vr-border)] bg-[var(--vr-surface)] p-4 max-md:border-l-0 max-md:border-t">
          <h2 className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[var(--vr-text-soft)]"><Settings2 className="h-4 w-4 text-[var(--vr-accent)]" />{selectedElement ? text.element : text.inspector}</h2>
          {selectedElement && selectedInspectorElement ? <><StartMenuElementInspector element={selectedInspectorElement} language={language} showDescriptions={false} onUpdate={(updates) => updateElement(selectedElement.id, updates as Partial<VideoCoverElement>)} onAlignSelected={(axis, value) => { const next = value === 'start' ? 0 : value === 'center' ? 50 : 100; updateElement(selectedElement.id, axis === 'x' ? { x: next - selectedElement.width / 2 } : { y: next - selectedElement.height / 2 }); }} /><div className="hidden space-y-4">
            {selectedElement.kind === 'text' ? <><label className="grid gap-1 text-[10px] font-bold text-[var(--vr-text-muted)]"><span>{text.text}</span><textarea value={selectedElement.text || ''} onChange={(event) => updateElement(selectedElement.id, { text: event.target.value })} className="min-h-20 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-2 text-xs font-bold text-[var(--vr-text)] outline-none focus:border-[var(--vr-accent)]" /></label><section className="grid grid-cols-2 gap-2 rounded-xl bg-[var(--vr-surface-soft)] p-3">{numberField('字号', selectedElement.fontSize || 54, (fontSize) => updateElement(selectedElement.id, { fontSize }), 12, 220)}{numberField('字重', selectedElement.fontWeight || 800, (fontWeight) => updateElement(selectedElement.id, { fontWeight }), 100, 900, 100)}<label className="grid gap-1 text-[10px] font-bold text-[var(--vr-text-muted)]"><span>颜色</span><input type="color" value={selectedElement.textColor || '#ffffff'} onChange={(event) => updateElement(selectedElement.id, { textColor: event.target.value })} className="h-9 w-full rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface)] p-1" /></label><label className="grid gap-1 text-[10px] font-bold text-[var(--vr-text-muted)]"><span>对齐</span><select value={selectedElement.textAlign || 'center'} onChange={(event) => updateElement(selectedElement.id, { textAlign: event.target.value as VideoCoverElement['textAlign'] })} className="h-9 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface)] px-2 text-xs font-bold text-[var(--vr-text)]"><option value="left">左对齐</option><option value="center">居中</option><option value="right">右对齐</option></select></label></section></> : <section><div className="mb-2 text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">{text.imageAsset}</div><div className="grid max-h-44 grid-cols-3 gap-2 overflow-y-auto">{imageNodes.map((node) => { const url = String(node.data?.imageUrl || ''); return <button key={node.id} type="button" onClick={() => updateElement(selectedElement.id, { imageUrl: url })} className={`aspect-square overflow-hidden rounded-lg border-2 ${selectedElement.imageUrl === url ? 'border-[var(--vr-accent)]' : 'border-transparent'}`} title={nodeLabel(node)}><img src={url} alt="" className="h-full w-full object-cover" /></button>; })}</div>{!imageNodes.length && <p className="mt-2 text-xs text-[var(--vr-text-muted)]">{text.noMedia}</p>}</section>}
            <section><div className="mb-2 text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">{text.position}</div><div className="grid grid-cols-2 gap-2 rounded-xl bg-[var(--vr-surface-soft)] p-3">{numberField('X', selectedElement.x, (x) => updateElement(selectedElement.id, { x }))}{numberField('Y', selectedElement.y, (y) => updateElement(selectedElement.id, { y }))}{numberField('宽度', selectedElement.width, (width) => updateElement(selectedElement.id, { width }), 4, 100)}{numberField('高度', selectedElement.height, (height) => updateElement(selectedElement.id, { height }), 4, 100)}{numberField('旋转', selectedElement.rotation, (rotation) => updateElement(selectedElement.id, { rotation }), -360, 360)}{numberField('透明度', selectedElement.opacity, (opacity) => updateElement(selectedElement.id, { opacity }), 0, 100)}</div></section>
            <button type="button" onClick={() => deleteElement(selectedElement.id)} className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 text-xs font-black text-rose-600 hover:bg-rose-100"><Trash2 className="h-3.5 w-3.5" />{text.deleteElement}</button>
          </div></> : <><StartMenuBackgroundInspector settings={coverBackgroundSettings} language={language} showDescriptions={false} hideMusic onCanvasSettingsChange={updateCoverCanvas} updateWebSettings={(key, value) => updateCoverBackground(key, value)} /><div className="hidden space-y-4">
            <section className="rounded-xl bg-[var(--vr-surface-soft)] p-3"><div className="mb-2 text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">{text.background}</div><div className="grid grid-cols-3 gap-1 rounded-lg bg-[var(--vr-bg)] p-1">{([['videoFrame', text.frame], ['image', text.image], ['gradient', text.gradient]] as const).map(([value, label]) => <button key={value} type="button" onClick={() => patch({ sourceType: value })} className={`h-8 rounded-md text-[10px] font-black ${cover.sourceType === value ? 'bg-[var(--vr-surface)] text-[var(--vr-accent-strong)] shadow-sm' : 'text-[var(--vr-text-muted)]'}`}>{label}</button>)}</div></section>
            {cover.sourceType === 'videoFrame' && <section className="space-y-2"><label className="grid gap-1 text-[10px] font-bold text-[var(--vr-text-muted)]"><span>{text.pickVideo}</span><select value={cover.videoNodeId || ''} onChange={(event) => patch({ videoNodeId: event.target.value })} className="h-9 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-2 text-xs font-bold text-[var(--vr-text)]"><option value="">—</option>{videoNodes.map((node) => <option key={node.id} value={node.id}>{nodeLabel(node)}</option>)}</select></label>{numberField(text.frameTime, cover.frameTime, (frameTime) => patch({ frameTime }), 0, 3600, 0.1)}</section>}
            {cover.sourceType === 'image' && <section><div className="mb-2 text-[10px] font-bold text-[var(--vr-text-muted)]">{text.pickImage}</div><div className="grid max-h-48 grid-cols-3 gap-2 overflow-y-auto">{imageNodes.map((node) => { const url = String(node.data?.imageUrl || ''); return <button key={node.id} type="button" onClick={() => patch({ imageUrl: url })} className={`aspect-square overflow-hidden rounded-lg border-2 ${cover.imageUrl === url ? 'border-[var(--vr-accent)]' : 'border-transparent'}`}><img src={url} alt="" className="h-full w-full object-cover" /></button>; })}</div>{!imageNodes.length && <p className="mt-2 text-xs text-[var(--vr-text-muted)]">{text.noMedia}</p>}</section>}
            {cover.sourceType === 'gradient' && <section className="grid grid-cols-2 gap-2 rounded-xl bg-[var(--vr-surface-soft)] p-3">{(['gradientStart', 'gradientEnd'] as const).map((key) => <label key={key} className="grid gap-1 text-[10px] font-bold text-[var(--vr-text-muted)]"><span>{key === 'gradientStart' ? 'A' : 'B'}</span><input type="color" value={cover[key]} onChange={(event) => patch({ [key]: event.target.value })} className="h-9 w-full rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface)] p-1" /></label>)}</section>}
            <button type="button" onClick={() => setIsDeleteCoverConfirmOpen(true)} className="mt-4 flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 text-xs font-black text-rose-600 hover:bg-rose-100"><Trash2 className="h-3.5 w-3.5" />{text.deleteCover}</button>
          </div></>}
        </aside>
      </div>
      {isDeleteCoverConfirmOpen && <div className="absolute inset-0 z-[500] grid place-items-center bg-slate-950/35 p-5">
        <section role="dialog" aria-modal="true" aria-labelledby="cover-delete-title" className="w-full max-w-sm rounded-2xl border border-[var(--vr-border)] bg-[var(--vr-surface)] p-5 shadow-2xl">
          <h3 id="cover-delete-title" className="text-base font-black text-[var(--vr-text)]">{text.deleteCover}</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--vr-text-soft)]">{text.confirm}</p>
          <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setIsDeleteCoverConfirmOpen(false)} className="h-9 rounded-lg bg-[var(--vr-surface-soft)] px-3 text-xs font-black text-[var(--vr-text-soft)] hover:bg-[var(--vr-border)]">{text.cancel}</button><button type="button" onClick={() => { onDelete(); setIsDeleteCoverConfirmOpen(false); onClose(); }} className="h-9 rounded-lg bg-rose-600 px-3 text-xs font-black text-white hover:bg-rose-700">{text.deleteCover}</button></div>
        </section>
      </div>}
    </div>
  </div>;
}
