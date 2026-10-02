import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import background from '../src/assets/common/default-main-interface-background.jpg';
import { VirtualPresentationStage } from '../src/components/VirtualPresentationStage';
import { WebPreviewMenuPages } from '../src/components/render/web/WebPreviewMenuPages';
import { WebShapeAddControl } from '../src/components/render/web/WebShapeAddControl';
import { buildRehearsalTemplate } from '../src/components/render/web/webExperienceTemplates';
import { DEFAULT_RENDER_STYLE } from '../src/components/render/video/VideoRenderModal/workspaceStorage';
import { makeIndexHtml } from '../src/components/render/web/webExport/webExportHtml';
import type { WebExportSettings } from '../src/components/render/video/shared/types';
import type { WebSaveSlot } from '../src/components/render/web/webExport/webSaveSlots';

const preset = buildRehearsalTemplate('zh', 'Web menu regression');
const initial = { ...preset.settings, canvasWidth:1920, canvasHeight:1080, interactionMode:'typewriter', typewriterSpeed:80, textScale:100, animationSpeed:1, autoAdvance:false, soundEnabled:true, settingsPageElementsInitialized:true, startMenuShowSettings:true, startMenuShowSave:true, startMenuShowNewGame:true, startMenuBackgroundType:'image', startMenuBackgroundImageUrl:background, settingsBackgroundType:'image', settingsBackgroundImageUrl:background, archiveBackgroundType:'image', archiveBackgroundImageUrl:background } as WebExportSettings;

function App() {
  const [settings, setSettings] = useState(initial);
  const [page,setPage] = useState<'settings'|'archive'>('settings');
  const [mode,setMode] = useState<'test'|'edit'>('test');
  const [slots,setSlots] = useState<WebSaveSlot[]>([]);
  const [selected,setSelected] = useState<string|null>(null);
  const [message,setMessage] = useState('');
  const [html,setHtml] = useState('');
  const update: <K extends keyof WebExportSettings>(key:K,value:WebExportSettings[K]) => void = (key,value) => setSettings((previous) => ({ ...previous,[key]:value }));
  const buildExport = () => {
    const content = { title:'Web menu regression', language:'zh', nodes:[{id:'scene-a',data:{isRoot:true,title:'第一章',text:'<p>风从山间吹来。</p>'}},{id:'scene-b',data:{title:'第二章',text:'<p>我们继续前行。</p>'}}],edges:[], style:DEFAULT_RENDER_STYLE, settings };
    setHtml(makeIndexHtml(content.title,'zh','',undefined,settings.settingsPageElements).replace('<script src="./content.js"></script>',`<script>window.GALWRITER_CONTENT=${JSON.stringify(content).replace(/</g,'\\u003c')};</script>`));
  };
  return <div style={{padding:16,background:'#f1f5f9',minHeight:'100vh',fontFamily:'system-ui'}}>
    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
      <button onClick={() => {setHtml('');setPage('settings');}}>设置预览</button><button onClick={() => {setHtml('');setPage('archive');}}>存档预览</button><button onClick={() => setMode(mode === 'test' ? 'edit':'test')}>{mode === 'test' ? '编辑模式':'测试模式'}</button>
      <button onClick={() => setSlots([{id:'qa-a',savedAt:Date.now(),currentId:'scene-a',history:[],controlsHidden:false},{id:'qa-b',savedAt:Date.now()-86400000,currentId:'scene-b',history:[],controlsHidden:false}] as WebSaveSlot[])}>两份示例存档</button>
      <button onClick={buildExport}>生成导出预览</button>
      <WebShapeAddControl language="zh" onAdd={(shapeType) => {const key=page === 'settings' ? 'settingsPageElements':'archivePageElements'; update(key,[...settings[key],{id:crypto.randomUUID(),kind:'shape',shapeType,role:'custom',text:shapeType,visible:true,x:74,y:30,width:18,height:18,scale:1,rotation:0,backgroundColor:'#eef2ff',borderColor:'#625bf6',borderWidth:2,borderRadius:18}]);}} />
      <span>{message}</span>
    </div>
    {html ? <iframe title="导出网页" srcDoc={html} style={{width:'100%',height:'78vh',border:0}} /> : <div style={{height:'78vh'}}><VirtualPresentationStage width={1920} height={1080} className="h-full w-full"><WebPreviewMenuPages language="zh" settings={settings} renderStyle={DEFAULT_RENDER_STYLE} previewMode={mode} selectedStartMenuElementId={selected} archiveOpen={page === 'archive'} settingsOpen={page === 'settings'} backgroundClass="" archiveBackgroundStyle={{background:`url(${background}) center / cover`}} settingsBackgroundStyle={{background:`url(${background}) center / cover`}} boundsMinX={0} boundsMinY={0} boundsMaxX={100} boundsMaxY={100} archiveElements={settings.archivePageElements} settingsElements={settings.settingsPageElements} choiceColor="#625bf6" choiceTextColor="#fff" previewControlsHidden={false} onCloseArchive={() => setMessage('返回主界面')} onCloseSettings={() => setMessage('返回故事')} onOpenSettings={() => setPage('settings')} onNewGame={() => setMessage('开始新故事')} saveSlots={slots} onContinueSave={(save) => setMessage(`继续：${save.id}`)} onDeleteSave={(id) => setSlots((previous) => previous.filter((save) => save.id !== id))} onToggleControls={() => {}} onButtonFunction={() => false} onSelectElement={setSelected} onUpdateArchiveElement={(id,patch) => update('archivePageElements',settings.archivePageElements.map((element) => element.id === id ? {...element,...patch}:element))} onUpdateSettingsElement={(id,patch) => update('settingsPageElements',settings.settingsPageElements.map((element) => element.id === id ? {...element,...patch}:element))} onUpdateArchiveElements={(elements) => update('archivePageElements',elements)} onUpdateSettingsElements={(elements) => update('settingsPageElements',elements)} onUpdateSettings={update}/></VirtualPresentationStage></div>}
    <output id="values">{JSON.stringify({interactionMode:settings.interactionMode,typewriterSpeed:settings.typewriterSpeed,textScale:settings.textScale})}</output>
  </div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
