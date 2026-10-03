import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import { AnimationRibbon } from '../src/components/render/ppt/PptWorkspaceControls';
import { PptCopyContext } from '../src/components/render/ppt/pptCopyContext';
import { getPptCopy } from '../src/components/render/ppt/i18n';
import { getPptWorkspaceCopy } from '../src/components/render/ppt/i18n/index';
import { PptInsertRibbon } from '../src/components/render/ppt/PptInsertRibbon';
import type { PptObjectAnimation, PptSlideTransition, PptAnimationPhase } from '../src/components/render/video/shared/types';
const copy = {...getPptCopy('zh'), ...getPptWorkspaceCopy('zh')};
const noop = () => {};
function App() {
  const [tab,setTab]=useState<'insert'|'animation'|'transition'>('transition');
  const [selected,setSelected]=useState(true);
  const [phase,setPhase]=useState<PptAnimationPhase>('enter');
  const [animation,setAnimation]=useState<PptObjectAnimation>({id:'qa',target:'dialog-body',effect:'line',phase:'enter',direction:'left',start:'withPrevious',durationMs:500,delayMs:0});
  const [transition,setTransition]=useState<PptSlideTransition>({effect:'push',direction:'left',durationMs:700,advanceOnClick:true,advanceAfterMs:2000});
  return <PptCopyContext.Provider value={copy}><main className="video-render-workspace" style={{height:'100vh',background:'#eef3f8'}}>
    <nav style={{padding:12,display:'flex',gap:20}}>
      <button onClick={()=>setTab('insert')}>插入工具栏</button><button onClick={()=>setTab('transition')}>切换工具栏</button><button onClick={()=>setTab('animation')}>动画工具栏</button>
      <button onClick={()=>setSelected(v=>!v)}>{selected?'取消选择':'选中组件'}</button>
    </nav>
    {tab==='insert'?<PptInsertRibbon copy={copy} language="zh" onInsertShape={noop} onNewSlide={noop} onDuplicateSlide={noop} onInsertText={noop} onInsertButton={noop} onInsertImage={noop} onCopyElement={noop} onCutElement={noop} onPasteElement={noop} canCopyElement={false} canPasteElement={false}/>:<AnimationRibbon activeTab={tab} selected={selected?{target:'dialog-body',label:'对话正文'}:null} phase={phase} setPhase={setPhase} animation={selected?animation:undefined} onApply={effect=>setAnimation(v=>({...v,effect}))} onClearAnimations={noop} onApplyMiddleAction={noop} onApplyLineWipe={()=>setAnimation(v=>({...v,textBuild:{mode:'line-wipe',lineGapMs:350}}))} onPreview={noop} onUpdate={patch=>setAnimation(v=>({...v,...patch}))} transition={transition} onUpdateTransition={patch=>setTransition(v=>({...v,...patch}))} onApplyTransitionToAll={noop}/>}
    <output style={{display:'block',padding:20}}>切换持续时间：{transition.durationMs}ms · 自动换片时间：{transition.advanceAfterMs ?? '关闭'}ms · 动画持续时间：{animation.durationMs}ms · 动画延迟：{animation.delayMs}ms · 行间停顿：{animation.textBuild?.lineGapMs ?? 0}ms</output>
  </main></PptCopyContext.Provider>;
}
createRoot(document.getElementById('root')!).render(<App/>);
