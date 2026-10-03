import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Image, Type } from 'lucide-react';
import '../src/index.css';
import { VirtualPresentationStage } from '../src/components/VirtualPresentationStage';
import { WebPlaytestStartMenuElement } from '../src/components/render/web/WebPlaytestStartMenuElement';
import { WebShapeAddControl } from '../src/components/render/web/WebShapeAddControl';
import { WebInsertToolButton } from '../src/components/render/web/WebInsertToolButton';
import { WebElementPlacementOverlay } from '../src/components/render/web/WebElementPlacementOverlay';
import { buildRehearsalTemplate } from '../src/components/render/web/webExperienceTemplates';
import type { WebPlacementTool } from '../src/components/render/web/webElementPlacement';
import type { WebMenuElement } from '../src/components/render/video/shared/types';

const settings = {
  ...buildRehearsalTemplate('zh', 'Geometry').settings,
  canvasWidth: 960,
  canvasHeight: 640,
};
function App() {
  const [tool, setTool] = useState<WebPlacementTool | null>(null);
  const [element, setElement] = useState<WebMenuElement>({
    id: 'test-shape',
    kind: 'shape',
    shapeType: 'polygon',
    polygonSides: 3,
    role: 'custom',
    text: '',
    visible: true,
    x: 30,
    y: 20,
    width: 30,
    height: (((30 * 960) / 640) * Math.sqrt(3)) / 2,
    scale: 1,
    rotation: 0,
    borderRadius: 0,
    backgroundColor: '#eef2ff',
    borderColor: '#625bf6',
    borderWidth: 1,
  });
  return (
    <main style={{ padding: 24, background: '#f8fafc', color: '#1e293b', minHeight: '100vh' }}>
      <div
        role="toolbar"
        aria-label="画布工具"
        className="mb-4 flex w-max items-center gap-3 rounded-xl border border-slate-200 bg-white p-1"
      >
        <WebInsertToolButton
          icon={Type}
          label="文字"
          active={tool?.kind === 'text'}
          onClick={() => setTool({ kind: 'text' })}
        />
        <WebInsertToolButton
          icon={Image}
          label="图片"
          active={tool?.kind === 'image'}
          onClick={() => setTool({ kind: 'image' })}
        />
        <WebShapeAddControl
          language="zh"
          active={tool?.kind === 'shape'}
          onAdd={(shapeType) => setTool({ kind: 'shape', shapeType })}
        />
        <button
          onClick={() =>
            setElement((previous) => ({ ...previous, rotation: (previous.rotation || 0) + 30 }))
          }
        >
          旋转 30°
        </button>
      </div>
      <VirtualPresentationStage
        width={960}
        height={640}
        className="border border-slate-200 bg-white"
        style={{ width: 900, height: 600 }}
      >
        <div className="absolute inset-0">
          <WebPlaytestStartMenuElement
            element={element}
            selected={!tool}
            settings={settings}
            language="zh"
            choiceColor="#625bf6"
            choiceTextColor="#fff"
            previewMode="edit"
            editingStartMenuElementId={null}
            hasCustomStartMenuElements
            onEnsureStartMenuElements={() => {}}
            onSelectElement={() => {}}
            onSetEditingElement={() => {}}
            onBeginDrag={() => {}}
            action={null}
            onUpdateElement={(_id, patch) => setElement((previous) => ({ ...previous, ...patch }))}
          />
          {tool && (
            <WebElementPlacementOverlay
              key={`${tool.kind}-${tool.shapeType}`}
              tool={tool}
              canvasWidth={960}
              canvasHeight={640}
              language="zh"
              onCancel={() => setTool(null)}
              onPlace={(geometry) => {
                setElement({
                  ...element,
                  ...tool,
                  ...geometry,
                  borderRadius: 0,
                  polygonSides: 3,
                  polygonCornerRadii: [],
                });
                setTool(null);
              }}
            />
          )}
        </div>
      </VirtualPresentationStage>
      <output data-testid="shape-state" className="mt-4 block text-xs">
        {JSON.stringify(element)}
      </output>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
