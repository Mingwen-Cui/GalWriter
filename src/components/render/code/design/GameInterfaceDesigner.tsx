import { Box, Monitor, PaintBucket, Type, Undo2, Redo2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Node } from '@xyflow/react';
import type { Language } from '../../../../lib/i18n';
import { FloatingPopover, InspectorGroup, NumberField } from '../../shared/inspectors/InspectorControls';
import { InlineColorControl } from '../../shared/paint/InlinePaintControls';
import { SolidColorPopover } from '../../shared/paint/ColorPopovers';
import { toHex8 } from '../../shared/paint/colorValue';
import { renderObjectText } from '../../video/objectInspector/i18n';
import type { CodeExportTarget } from '../codeExport/targets/targetTypes';
import type { RenpyExportSettings } from '../codeExport/types';
import { GAME_INTERFACE_CAPABILITIES, GAME_TARGET_NAMES, normalizeGameInterface, resolveGameInterface, type GameInterfaceSettings } from './gameInterface';

type Selection = 'canvas' | 'dialogue' | 'text' | 'choices';
export function GameInterfaceDesigner({language, target, settings, onChange, nodes}: {
  language: Language; target: CodeExportTarget; settings: RenpyExportSettings;
  onChange: (value: RenpyExportSettings) => void; nodes: Node[];
}) {
  const t = (zh: string, en: string, ja = en) => language === 'zh' ? zh : language === 'ja' ? ja : en;
  const value = resolveGameInterface(settings.interfaceDesigns, target);
  const caps = GAME_INTERFACE_CAPABILITIES[target];
  const [selection, setSelection] = useState<Selection>('dialogue');
  const [colorField, setColorField] = useState<keyof GameInterfaceSettings | null>(null);
  const [past, setPast] = useState<GameInterfaceSettings[]>([]);
  const [future, setFuture] = useState<GameInterfaceSettings[]>([]);
  const viewport = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  const labels = {canvas: t('画布','Canvas','キャンバス'), dialogue: t('对话框','Dialogue','ダイアログ'), text: t('文字','Text','テキスト'), choices: t('选项按钮','Choice buttons','選択肢')};
  const save = (next: GameInterfaceSettings) => onChange({...settings, interfaceDesigns: {...settings.interfaceDesigns, [target]: next}});
  const update = (patch: Partial<GameInterfaceSettings>) => {
    const next = normalizeGameInterface({...value,...patch});
    if (JSON.stringify(next) === JSON.stringify(value)) return;
    setPast(history => [...history.slice(-49),value]); setFuture([]); save(next);
  };
  useEffect(() => {
    const element = viewport.current; if (!element) return;
    const resize = () => setScale(Math.max(0.08,Math.min((element.clientWidth - 48) / value.width, (element.clientHeight - 70) / value.height,1)));
    const observer = new ResizeObserver(resize); observer.observe(element); resize(); return () => observer.disconnect();
  },[value.width,value.height]);
  const text = renderObjectText(language).popover;
  const number = (key: keyof GameInterfaceSettings, label: string, min: number, max: number, unit = '') => <NumberField key={key} icon={<Box className="h-3 w-3"/>} label={`${label}${unit ? ` · ${unit}` : ''}`} value={Number(value[key])} min={min} max={max} onChange={next => update({[key]: next})}/>;
  const color = (key: 'background' | 'panelColor' | 'textColor' | 'nameColor' | 'accentColor', label: string) => <div className="mt-2" key={key}><div className="property-field-label">{label}</div><InlineColorControl label={label} color={value[key]} alpha={key === 'panelColor' ? value.panelAlpha : 100} hexLabel={text.hex} alphaLabel={text.opacity} onColorChange={next => update({[key]:next})} onAlphaChange={key === 'panelColor' ? panelAlpha => update({panelAlpha}) : undefined} onColorAndAlphaChange={({color:next,alpha}) => update({[key]:next,...(key === 'panelColor' ? {panelAlpha:alpha} : {})})} onOpen={() => setColorField(key)}/></div>;
  const sample = nodes.find(node => node.type === 'storyNode');
  const dialogue = String(sample?.data?.content || sample?.data?.text || t('每一个故事，都从一次选择开始。','Every story begins with a choice.','物語は、ひとつの選択から始まります。')).replace(/<[^>]*>/g,'').slice(0,160);
  const sampleName = settings.characters[0]?.displayName || t('角色名称','Character','キャラクター');
  return <div className="flex h-full min-h-0 flex-1" data-game-interface-designer={target}>
    <aside className="w-40 shrink-0 border-r border-[var(--vr-border)] p-3">
      <div className="mb-3 text-xs font-semibold">{GAME_TARGET_NAMES[target]} · {t('界面设计','Interface design','画面デザイン')}</div>
      {(Object.keys(labels) as Selection[]).map(key => <button key={key} type="button" className={`mb-1 flex h-8 w-full items-center rounded-md px-2 text-left text-xs ${selection === key ? 'bg-[var(--vr-accent-soft)] text-[var(--vr-accent-strong)]' : 'text-[var(--vr-text-muted)]'}`} aria-pressed={selection === key} onClick={() => setSelection(key)}>{labels[key]}</button>)}
      <p className="mt-4 text-[11px] leading-5 text-[var(--vr-text-muted)]">{t('设置仅应用于当前游戏引擎。','Settings apply to this game engine.','設定は現在のゲームエンジンに適用されます。')}</p>
    </aside>
    <div className="relative min-w-0 flex-1 bg-[var(--vr-bg)]" ref={viewport}>
      <div className="flex h-10 items-center justify-between border-b border-[var(--vr-border)] px-4 text-[11px] text-[var(--vr-text-muted)]"><span>{value.width} × {value.height} · {Math.round(scale*100)}%</span><div className="flex gap-2">
        <button aria-label={t('撤销','Undo','元に戻す')} disabled={!past.length} onClick={() => {const previous = past.at(-1); if (previous) {setPast(past.slice(0,-1));setFuture([value,...future]);save(previous);}}} className="disabled:opacity-30"><Undo2 className="h-4 w-4"/></button>
        <button aria-label={t('重做','Redo','やり直し')} disabled={!future.length} onClick={() => {const next = future[0]; if (next) {setFuture(future.slice(1));setPast([...past,value]);save(next);}}} className="disabled:opacity-30"><Redo2 className="h-4 w-4"/></button>
      </div></div>
      <div className="absolute inset-x-0 bottom-0 top-10 grid place-items-center overflow-hidden">
        <div style={{width:value.width*scale,height:value.height*scale}} className="relative shadow-xl">
          <div className="absolute left-0 top-0 origin-top-left overflow-hidden" style={{width:value.width,height:value.height,transform:`scale(${scale})`,background:value.background}} onClick={() => setSelection('canvas')}>
            <div className="absolute left-0 top-0 flex w-full items-center justify-between px-8 py-5 text-white/60" style={{fontSize:16}}><span>{GAME_TARGET_NAMES[target]}</span><span>{t('界面布局预览','Interface layout preview','画面レイアウトプレビュー')}</span></div>
            <div className="absolute left-1/2 top-[24%] flex w-[50%] -translate-x-1/2 flex-col gap-3" onClick={event => {event.stopPropagation();setSelection('choices');}}>
              {[t('继续故事','Continue the story','物語を続ける'),t('探索另一条道路','Explore another path','別の道を探す')].map(caption => <button key={caption} type="button" className="px-6 py-3 text-white" style={{background:caps.accent ? value.accentColor : '#4f46e5',fontSize:value.fontSize,borderRadius:value.radius,outline:selection === 'choices' ? '2px solid #818cf8' : undefined}}>{caption}</button>)}
            </div>
            <div style={{position:'absolute',left:`${value.panelX}%`,top:`${value.panelY}%`,width:`${value.panelWidth}%`,height:`${value.panelHeight}%`,background:toHex8(value.panelColor,value.panelAlpha),borderRadius:value.radius,padding:24,outline:selection === 'dialogue' ? '2px solid #818cf8' : undefined,overflow:'hidden'}} onClick={event => {event.stopPropagation();setSelection('dialogue');}}>
              <div style={{fontSize:value.fontSize,color:value.nameColor,marginBottom:10}}>{sampleName}</div>
              <div style={{fontSize:value.fontSize,color:value.textColor,lineHeight:1.5,outline:selection === 'text' ? '1px dashed #818cf8' : undefined}} onClick={event => {event.stopPropagation();setSelection('text');}}>{dialogue}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <aside className="property-inspector w-80 shrink-0 overflow-auto border-l border-[var(--vr-border)] bg-[var(--vr-surface)] px-4 py-2">
      <div className="property-context"><span>{t('属性','Properties','プロパティ')} · {labels[selection]}</span><span>{GAME_TARGET_NAMES[target]}</span></div>
      {selection === 'canvas' && <InspectorGroup title={labels.canvas} icon={<Monitor className="h-3.5 w-3.5"/>} tone="extra" secondary={null}>
        {caps.canvas ? <div className="property-control-row">{number('width',t('宽度','Width','幅'),640,3840,'px')}{number('height',t('高度','Height','高さ'),360,2160,'px')}</div> : <p className="property-help">{t('画布尺寸由 TyranoScript 宿主工程设置；此处以 1280 × 720 预览。','Canvas size is configured in the TyranoScript host project; preview uses 1280 × 720.','画面サイズは TyranoScript プロジェクトで設定します。プレビューは 1280 × 720。')}</p>}
        {caps.background && color('background',t('背景颜色','Background color','背景色'))}
      </InspectorGroup>}
      {selection === 'dialogue' && <><InspectorGroup title={t('布局','Layout','レイアウト')} icon={<Box className="h-3.5 w-3.5"/>} tone="position" secondary={null}><div className="property-control-row">{number('panelX','X',0,95,'%')}{number('panelY','Y',0,95,'%')}{number('panelWidth',t('宽度','Width','幅'),10,100,'%')}{number('panelHeight',t('高度','Height','高さ'),15,70,'%')}{caps.radius && number('radius',t('圆角','Radius','角丸'),0,48,'px')}</div></InspectorGroup><InspectorGroup title={t('填充','Fill','塗り')} icon={<PaintBucket className="h-3.5 w-3.5"/>} tone="fill" secondary={null}>{color('panelColor',t('纯色','Solid color','単色'))}</InspectorGroup></>}
      {selection === 'text' && <InspectorGroup title={labels.text} icon={<Type className="h-3.5 w-3.5"/>} tone="text" secondary={null}><div className="property-control-row">{number('fontSize',t('字号','Font size','文字サイズ'),12,72,'px')}{number('textSpeed',t('打字速度','Text speed','表示速度'),1,200,t('字/秒','chars/s','文字/秒'))}</div>{color('textColor',t('正文颜色','Text color','本文色'))}{caps.nameColor && color('nameColor',t('姓名颜色','Name color','名前色'))}</InspectorGroup>}
      {selection === 'choices' && <InspectorGroup title={labels.choices} icon={<Box className="h-3.5 w-3.5"/>} tone="fill" secondary={null}>{caps.accent ? color('accentColor',t('按钮颜色','Button color','ボタン色')) : <p className="property-help">{t('选项样式继承 TyranoScript 宿主工程。','Choice styling is inherited from the TyranoScript host project.','選択肢の外観は TyranoScript プロジェクトから継承されます。')}</p>}</InspectorGroup>}
      {colorField && <FloatingPopover popoverKey="solid" onClose={() => setColorField(null)} closeLabel={t('关闭','Close','閉じる')}><SolidColorPopover tone="fill" text={text} color={String(value[colorField])} alpha={colorField === 'panelColor' ? value.panelAlpha : 100} onColorChange={next => update({[colorField]:next})} onAlphaChange={panelAlpha => {if (colorField === 'panelColor') update({panelAlpha});}} onColorAndAlphaChange={({color:next,alpha}) => update({[colorField]:next,...(colorField === 'panelColor' ? {panelAlpha:alpha} : {})})}/></FloatingPopover>}
    </aside>
  </div>;
}
