import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import { WebWorkspace } from '../src/components/render/web/WebWorkspace';
import { useWebExportSettings } from '../src/components/render/video/export/useWebExportSettings';
import { DEFAULT_RENDER_STYLE } from '../src/components/render/video/VideoRenderModal/workspaceStorage';
import { makeIndexHtml } from '../src/components/render/web/webExport/webExportHtml';
import { buildExportWebFlow } from '../src/components/render/web/webExport/webExportFlow';
import type { WebExportNode } from '../src/components/render/web/webExport/webExportTypes';
import type { Node, Edge } from '@xyflow/react';

const nodes: Node[] = [
  {
    id: 'flow-a',
    type: 'storyNode',
    position: { x: 0, y: 0 },
    data: { isRoot: true, title: '开始', text: '第一段', imageUrl: '' },
  },
  {
    id: 'flow-b',
    type: 'storyNode',
    position: { x: 280, y: 0 },
    data: { title: '分支', text: '第二段', imageUrl: '' },
  },
  {
    id: 'flow-c',
    type: 'storyNode',
    position: { x: 280, y: 180 },
    data: { title: '结尾', text: '第三段', imageUrl: '' },
  },
];
const edges: Edge[] = [
  { id: 'a-b', source: 'flow-a', target: 'flow-b' },
  { id: 'b-c', source: 'flow-b', target: 'flow-c' },
];

function App() {
  const [style, setStyle] = useState(DEFAULT_RENDER_STYLE);
  const state = useWebExportSettings('流程图模板', 'zh', false, 'web-flow-regression', undefined, {
    value: style,
    update: (key, value) => setStyle((previous) => ({ ...previous, [key]: value })),
  });
  const [html, setHtml] = useState('');
  const flowButton = state.webSettings.flowOverviewElements.find((element) => element.kind === 'button')!;
  const settings = {
    ...state.webSettings,
    flowOverviewElements: [
      ...state.webSettings.flowOverviewElements,
      ...(['flowDirection', 'flowFitView'] as const).map((role, index) => ({
        ...flowButton, id: `regression-${role}`, role, text: '', textVisible: false,
        x: 77 + index * 4, y: 8, width: 3, height: 16 / 3, visible: true,
      })),
    ],
  };
  const exportPreview = () => {
    const content = {
      title: 'Flow regression',
      language: 'zh',
      nodes,
      edges,
      flow: buildExportWebFlow(nodes as WebExportNode[], edges),
      settings,
      style,
    };
    setHtml(
      makeIndexHtml(content.title, 'zh', '').replace(
        '<script src="./content.js"></script>',
        `<script>window.GALWRITER_CONTENT=${JSON.stringify(content).replace(/</g, '\\u003c')};</script>`,
      ),
    );
  };
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="flex gap-3 p-2 text-xs">
        <button onClick={exportPreview}>生成导出预览</button>
        <button onClick={() => setHtml('')}>返回编辑</button>
        <button onClick={() => state.updateWebSettings('showStartMenu', !state.webSettings.showStartMenu)}>
          {state.webSettings.showStartMenu ? '无界面' : '主界面'}
        </button>
        <button onClick={state.undoWeb}>撤销</button>
        <button onClick={state.redoWeb}>重做</button>
        <output data-flow-view>{JSON.stringify(state.webSettings.flowOverviewView)}</output>
      </div>
      {html ? (
        <iframe title="导出网页" srcDoc={html} className="min-h-0 w-full flex-1 border-0" />
      ) : (
        <WebWorkspace
          nodes={nodes}
          edges={edges}
          language="zh"
          {...state}
          webSettings={settings}
          progress=""
          error=""
          progressValue={0}
          savedPath=""
        />
      )}
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
