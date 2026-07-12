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
};

export function RenderObjectSettingsSection({
  language,
  renderStyle,
  updateRenderStyle,
  surface = 'web',
  showDescriptions = false,
  canvasSettings,
  onCanvasSettingsChange,
}: RenderObjectSettingsSectionProps) {
  type ActiveSelection = 'scene' | 'background' | RenderEditableObjectKind;
  const [activeSelection, setActiveSelection] = useState<ActiveSelection>(
    canvasSettings?.layoutMode === 'classic'
      ? (renderStyle.selectedRenderObject || 'scene')
      : (renderStyle.selectedRenderObject || 'dialogBox'),
  );
  useEffect(() => {
    if (renderStyle.selectedRenderObject) setActiveSelection(renderStyle.selectedRenderObject);
  }, [renderStyle.selectedRenderObject]);
  useEffect(() => {
    if (canvasSettings?.layoutMode !== 'classic' && (activeSelection === 'scene' || activeSelection === 'background')) {
      setActiveSelection('dialogBox');
      updateRenderStyle('selectedRenderObject', 'dialogBox');
    }
  }, [activeSelection, canvasSettings?.layoutMode, updateRenderStyle]);
  const labels = language === 'zh'
    ? { scene: '画面', background: '画面外背景', dialogBox: '对话框背景', title: '标题', body: '正文', nameplate: '人物名牌' }
    : language === 'ja'
      ? { scene: '画面', background: '画面外背景', dialogBox: 'ダイアログ背景', title: 'タイトル', body: '本文', nameplate: 'ネームプレート' }
      : { scene: 'Scene', background: 'Outer background', dialogBox: 'Dialog box', title: 'Title', body: 'Body', nameplate: 'Nameplate' };
  const selectObject = (kind: RenderEditableObjectKind) => {
    setActiveSelection(kind);
    updateRenderStyle('selectedRenderObject', kind);
  };
  const inspectorStyle: RenderStyle = {
    ...renderStyle,
    selectedRenderObject:
      activeSelection === 'scene' || activeSelection === 'background'
        ? undefined
        : activeSelection,
  };
  return (
    <div className="space-y-3">
      {canvasSettings?.layoutMode === 'classic' && onCanvasSettingsChange && (
        <div className="grid grid-cols-2 gap-2">
          {(['scene', 'background'] as const).map((kind) => <button key={kind} type="button" onClick={() => setActiveSelection(kind)} className={`h-9 rounded-lg px-2 text-left text-xs font-bold transition-colors ${activeSelection === kind ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{labels[kind]}</button>)}
          {(['dialogBox', 'title', 'body', 'nameplate'] as RenderEditableObjectKind[]).map((kind) => <button key={kind} type="button" onClick={() => selectObject(kind)} className={`h-9 rounded-lg px-2 text-left text-xs font-bold transition-colors ${activeSelection === kind ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{labels[kind]}</button>)}
        </div>
      )}
      {(activeSelection === 'scene' || activeSelection === 'background') && canvasSettings && onCanvasSettingsChange ? (
        <SceneCanvasInspector language={language} value={canvasSettings} onChange={onCanvasSettingsChange} mode={activeSelection === 'scene' ? 'position' : 'background'} />
      ) : (
        <RenderObjectInspector language={language} renderStyle={inspectorStyle} updateRenderStyle={updateRenderStyle} surface={surface} showDescriptions={showDescriptions} hideObjectSelector={canvasSettings?.layoutMode === 'classic'} />
      )}
    </div>
  );
}
