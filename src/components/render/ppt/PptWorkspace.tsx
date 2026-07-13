import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react';
import { Link2, Presentation, Settings2 } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

import { pptSceneColors, resolvePptScenes } from './pptSceneResolver';
import type { Language } from '../../../lib/i18n';
import { renderCopy } from '../video/shared/renderCopy';
import type { PptExportSettings, RenderStyle, WebExportSettings } from '../video/shared/types';

type Props = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  language: Language;
  projectName: string;
  webSettings: WebExportSettings;
  renderStyle: RenderStyle;
  pptSettings: PptExportSettings;
  updatePptSettings: (patch: Partial<PptExportSettings>) => void;
};

export function PptWorkspace({ nodes, edges, language, projectName, webSettings, renderStyle, pptSettings, updatePptSettings }: Props) {
  const t = (zh: string, ja: string, en: string) => renderCopy(language, zh, ja, en);
  const scenes = useMemo(() => resolvePptScenes(nodes, edges, webSettings), [nodes, edges, webSettings]);
  const [selectedId, setSelectedId] = useState<string | 'cover'>(pptSettings.includeCover ? 'cover' : scenes[0]?.id || 'cover');
  const scene = selectedId === 'cover' ? undefined : scenes.find((item) => item.id === selectedId) || scenes[0];
  const colors = pptSceneColors(renderStyle, webSettings);
  const slides = [
    ...(pptSettings.includeCover ? [{ id: 'cover', title: projectName || t('未命名项目', '無題のプロジェクト', 'Untitled project') }] : []),
    ...scenes.map((item) => ({ id: item.id, title: item.title })),
  ];

  return (
    <main className="min-h-0 min-w-0 flex overflow-hidden bg-[var(--vr-bg)]">
      <aside className="w-56 shrink-0 overflow-y-auto border-r border-[var(--vr-border)] bg-[var(--vr-surface-strong)] p-3">
        <div className="mb-3 flex items-center gap-2 px-1 text-xs font-black text-[var(--vr-text)]"><Presentation className="h-4 w-4 text-[var(--vr-accent-strong)]" />{t('幻灯片', 'スライド', 'Slides')}</div>
        <div className="space-y-2">
          {slides.map((slide, index) => (
            <button key={slide.id} type="button" onClick={() => setSelectedId(slide.id)} className={`w-full rounded-lg border p-2 text-left transition-colors ${selectedId === slide.id ? 'border-[var(--vr-accent)] bg-[var(--vr-accent-soft)]' : 'border-[var(--vr-border)] hover:bg-[var(--vr-surface-soft)]'}`}>
              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold text-[var(--vr-text-muted)]"><span>{index + 1}</span><span className="truncate">{slide.id === 'cover' ? t('封面', '表紙', 'Cover') : t('剧情页', 'ストーリーページ', 'Story')}</span></div>
              <div className="aspect-video overflow-hidden rounded bg-slate-950 p-1.5"><div className="h-full rounded border border-white/20 bg-slate-800 px-1.5 py-2 text-[8px] font-bold text-white/90">{slide.title}</div></div>
            </button>
          ))}
        </div>
      </aside>

      <section className="min-w-0 flex-1 overflow-auto bg-[var(--vr-bg)] p-6 lg:p-10">
        <div className="mx-auto flex min-h-full max-w-5xl items-center justify-center">
          <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/15 bg-slate-950 shadow-2xl" style={{ backgroundColor: selectedId === 'cover' ? webSettings.startMenuBackgroundColor : colors.background }}>
            {selectedId === 'cover' ? <CoverPreview projectName={projectName} renderStyle={renderStyle} /> : scene ? <ScenePreview scene={scene} renderStyle={renderStyle} colors={colors} /> : <div className="grid h-full place-items-center text-sm text-white/60">{t('没有可导出的剧情节点', '書き出すストーリーノードがありません', 'No story nodes to export')}</div>}
          </div>
        </div>
      </section>

      <aside className="w-72 shrink-0 overflow-y-auto border-l border-[var(--vr-border)] bg-[var(--vr-surface-strong)] p-4">
        <div className="mb-5 flex items-center gap-2 text-sm font-black"><Settings2 className="h-4 w-4 text-[var(--vr-accent-strong)]" />{t('PPT 导出规则', 'PPT 書き出しルール', 'PPT export rules')}</div>
        <Field label={t('页面比例', 'スライド比率', 'Slide ratio')}><select value={pptSettings.layout} onChange={(event) => updatePptSettings({ layout: event.target.value as PptExportSettings['layout'] })} className="render-field"><option value="LAYOUT_WIDE">16:9</option><option value="LAYOUT_STANDARD">4:3</option></select></Field>
        <Field label={t('分支表现', '分岐の扱い', 'Branches')}><select value={pptSettings.branchMode} onChange={(event) => updatePptSettings({ branchMode: event.target.value as PptExportSettings['branchMode'] })} className="render-field"><option value="interactive">{t('互动跳转', 'クリックで遷移', 'Clickable links')}</option><option value="linear">{t('主线演示', 'メインルート', 'Main route')}</option><option value="all">{t('全部分支', 'すべての分岐', 'All branches')}</option></select></Field>
        <Field label={t('页面密度', 'ページ密度', 'Slide density')}><select value={pptSettings.density} onChange={(event) => updatePptSettings({ density: event.target.value as PptExportSettings['density'] })} className="render-field"><option value="oneNodePerSlide">{t('每节点一页', '1ノード1ページ', 'One node per slide')}</option><option value="mergeShortDialogue">{t('合并短对白（即将支持）', '短い台詞を統合（準備中）', 'Merge short dialogue (soon)')}</option></select></Field>
        <Toggle label={t('生成封面页', '表紙を生成', 'Include cover')} checked={pptSettings.includeCover} onChange={(includeCover) => updatePptSettings({ includeCover })} />
        <Toggle label={t('写入演讲备注', '発表者ノートを追加', 'Include speaker notes')} checked={pptSettings.includeNotes} onChange={(includeNotes) => updatePptSettings({ includeNotes })} />
        <div className="mt-6 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-3 text-xs leading-5 text-[var(--vr-text-muted)]"><div className="mb-1 flex items-center gap-1.5 font-bold text-[var(--vr-text)]"><Link2 className="h-3.5 w-3.5" />{t('同源编辑', '共有編集', 'Shared editing')}</div>{t('背景、角色、对话框、字体和选项均直接跟随网页设置，无需重复编辑。', '背景、キャラクター、会話ボックス、書体、選択肢はWeb設定と共有されます。', 'Backgrounds, characters, dialogue, fonts, and choices follow the web settings.')}</div>
      </aside>
    </main>
  );
}

function CoverPreview({ projectName, renderStyle }: { projectName: string; renderStyle: RenderStyle }) { return <div className="grid h-full place-items-center bg-black/35 px-10 text-center"><div><h1 className="text-4xl font-black text-white" style={{ fontFamily: renderStyle.titleFontFamily }}>{projectName || 'GalWriter AI'}</h1><p className="mt-4 text-sm text-white/75">GalWriter AI</p></div></div>; }
function ScenePreview({ scene, renderStyle, colors }: { scene: ReturnType<typeof resolvePptScenes>[number]; renderStyle: RenderStyle; colors: ReturnType<typeof pptSceneColors> }) { return <><div className="absolute inset-x-[4%] bottom-[7%] rounded-xl px-6 py-4" style={{ backgroundColor: `${colors.panel}${Math.round(((renderStyle.panelColorAlpha ?? 82) / 100) * 255).toString(16).padStart(2, '0')}` }}><div className="mb-1 text-sm font-black" style={{ color: colors.title, fontFamily: renderStyle.titleFontFamily }}>{scene.title}</div><div className="max-w-[68%] whitespace-pre-wrap text-sm leading-6" style={{ color: colors.body, fontFamily: renderStyle.bodyFontFamily }}>{scene.text}</div>{scene.choices.slice(0, 3).map((choice) => <span key={choice.label} className="ml-2 inline-flex rounded bg-indigo-500 px-2 py-1 text-[10px] font-bold text-white">{choice.label}</span>)}</div></>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="mb-4 block text-xs font-bold text-[var(--vr-text-muted)]"><span className="mb-1.5 block">{label}</span>{children}</label>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="mb-3 flex cursor-pointer items-center justify-between gap-3 text-xs font-bold text-[var(--vr-text)]"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label>; }
