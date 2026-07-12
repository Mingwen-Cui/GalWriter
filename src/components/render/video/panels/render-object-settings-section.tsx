import type { Language } from '../../../../lib/i18n';
import { useEffect, useState } from 'react';
import { SceneCanvasInspector } from '../../canvas/SceneCanvasInspector';
import type { SharedCanvasSettings } from '../../canvas/canvasSettings';
import { RenderObjectInspector } from '../objectInspector/RenderObjectInspector';
import type { RenderStyle } from '../shared/types';
import type { RenderEditableObjectKind } from '../shared/types';

type RenderObjectSettingsSectionProps = {
  language: Language;
  renderStyle: RenderStyle;
  updateRenderStyle: <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => void;
  surface?: 'video' | 'web' | 'playtest';
  showDescriptions?: boolean;
  canvasSettings?: SharedCanvasSettings;
  onCanvasSettingsChange?: (patch: Partial<SharedCanvasSettings>) => void;
  selection?: 'scene' | 'background' | RenderEditableObjectKind;
  onSelectionChange?: (selection: 'scene' | 'background' | RenderEditableObjectKind) => void;
};

export function RenderObjectSettingsSection({
  language,
  renderStyle,
  updateRenderStyle,
  surface = 'web',
  showDescriptions = false,
  canvasSettings,
  onCanvasSettingsChange,
  selection,
  onSelectionChange,
}: RenderObjectSettingsSectionProps) {
  type ActiveSelection = 'scene' | 'background' | RenderEditableObjectKind;
  const [activeSelection, setActiveSelection] = useState<ActiveSelection>(
    canvasSettings?.layoutMode === 'classic'
      ? (renderStyle.selectedRenderObject || 'scene')
      : (renderStyle.selectedRenderObject || 'dialogBox'),
  );
  const currentSelection = selection || activeSelection;
  const changeSelection = (next: ActiveSelection) => {
    setActiveSelection(next);
    onSelectionChange?.(next);
  };
  useEffect(() => {
    if (renderStyle.selectedRenderObject && !selection) setActiveSelection(renderStyle.selectedRenderObject);
  }, [renderStyle.selectedRenderObject]);
  useEffect(() => {
    if (canvasSettings?.layoutMode !== 'classic' && (currentSelection === 'scene' || currentSelection === 'background')) {
      changeSelection('dialogBox');
      updateRenderStyle('selectedRenderObject', 'dialogBox');
    }
  }, [canvasSettings?.layoutMode, currentSelection, updateRenderStyle]);
  const labels = language === 'zh'
    ? { scene: '画面', background: '画面外背景', dialogBox: '对话框背景', title: '标题', body: '正文', nameplate: '人物名牌' }
    : language === 'ja'
      ? { scene: '画面', background: '画面外背景', dialogBox: 'ダイアログ背景', title: 'タイトル', body: '本文', nameplate: 'ネームプレート' }
      : { scene: 'Scene', background: 'Outer background', dialogBox: 'Dialog box', title: 'Title', body: 'Body', nameplate: 'Nameplate' };
  const selectObject = (kind: RenderEditableObjectKind) => {
    changeSelection(kind);
    updateRenderStyle('selectedRenderObject', kind);
  };
  const inspectorStyle: RenderStyle = {
    ...renderStyle,
    selectedRenderObject:
      currentSelection === 'scene' || currentSelection === 'background'
        ? undefined
        : currentSelection,
  };
  return (
    <div className="space-y-3">
      {canvasSettings?.layoutMode === 'classic' && onCanvasSettingsChange && (
        <div className="grid grid-cols-2 gap-2">
          {(['scene', 'background'] as const).map((kind) => <button key={kind} type="button" aria-pressed={currentSelection === kind} data-render-selection={kind} onPointerDown={(event) => event.stopPropagation()} onClick={() => { changeSelection(kind); updateRenderStyle('selectedRenderObject', undefined); }} className={`h-9 rounded-lg px-2 text-left text-xs font-bold transition-colors ${currentSelection === kind ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{labels[kind]}</button>)}
          {(['dialogBox', 'title', 'body', 'nameplate'] as RenderEditableObjectKind[]).map((kind) => <button key={kind} type="button" aria-pressed={currentSelection === kind} data-render-selection={kind} onPointerDown={(event) => event.stopPropagation()} onClick={() => selectObject(kind)} className={`h-9 rounded-lg px-2 text-left text-xs font-bold transition-colors ${currentSelection === kind ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{labels[kind]}</button>)}
        </div>
      )}
      {(currentSelection === 'scene' || currentSelection === 'background') && canvasSettings && onCanvasSettingsChange ? (
        <SceneCanvasInspector language={language} value={canvasSettings} onChange={onCanvasSettingsChange} mode={currentSelection === 'scene' ? 'position' : 'background'} />
      ) : (
        <RenderObjectInspector language={language} renderStyle={inspectorStyle} updateRenderStyle={updateRenderStyle} surface={surface} showDescriptions={showDescriptions} hideObjectSelector={canvasSettings?.layoutMode === 'classic'} />
      )}
    </div>
  );
}
