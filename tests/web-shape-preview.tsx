import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import { WebPlaytestStartMenuElement } from '../src/components/render/web/WebPlaytestStartMenuElement';
import { WebShapeAddControl } from '../src/components/render/web/WebShapeAddControl';
import { buildRehearsalTemplate } from '../src/components/render/web/webExperienceTemplates';
import type { WebMenuElement } from '../src/components/render/video/shared/types';

const settings = buildRehearsalTemplate('zh', 'Shape regression').settings;
const initial: WebMenuElement = {
  id: 'regression-shape',
  kind: 'shape',
  shapeType: 'rectangle',
  role: 'custom',
  text: '矩形',
  visible: true,
  x: 20,
  y: 10,
  width: 45,
  height: 70,
  scale: 1,
  rotation: 0,
  backgroundColor: '#eef2ff',
  borderColor: '#625bf6',
  borderWidth: 2,
  borderRadius: 0,
  zIndex: 1,
};
function App() {
  const [shape, setShape] = useState(initial);
  const [selected, setSelected] = useState(true);
  const [mode, setMode] = useState<'edit' | 'test'>('edit');
  const update = (_id: string, patch: Partial<WebMenuElement>) =>
    setShape((previous) => ({ ...previous, ...patch }));
  const foreground = {
    ...initial,
    id: 'foreground-button',
    kind: 'button' as const,
    text: '继续游戏',
    x: 8,
    y: 40,
    width: 45,
    height: 15,
    backgroundColor: '#625bf6',
    textColor: '#fff',
    fontSize: 32,
    borderRadius: 20,
    zIndex: 7,
  };
  const shared = {
    settings,
    choiceColor: '#625bf6',
    choiceTextColor: '#fff',
    language: 'zh' as const,
    previewMode: mode,
    editingStartMenuElementId: null,
    hasCustomStartMenuElements: true,
    onEnsureStartMenuElements: () => {},
    onSelectElement: () => setSelected(true),
    onSetEditingElement: () => {},
    onUpdateElement: update,
    onBeginDrag: () => {},
    action: null,
  };
  return (
    <main style={{ padding: 32, background: '#f8fafc', minHeight: '100vh', color: '#1e293b' }}>
      <div style={{ display: 'flex', gap: 24, alignItems: 'center', marginBottom: 32 }}>
        <label>
          Z轴{' '}
          <input
            aria-label="图形Z轴"
            type="number"
            value={shape.zIndex}
            onChange={(event) => update(shape.id, { zIndex: Number(event.target.value) })}
          />
        </label>
        <label>
          圆角{' '}
          <input
            aria-label="图形圆角"
            type="number"
            value={shape.borderRadius}
            onChange={(event) => update(shape.id, { borderRadius: Number(event.target.value) })}
          />
        </label>
        <button onClick={() => setSelected((value) => !value)}>
          {selected ? '取消选择' : '选择矩形'}
        </button>
        <button onClick={() => setMode(mode === 'edit' ? 'test' : 'edit')}>
          {mode === 'edit' ? '测试模式' : '编辑模式'}
        </button>
        <WebShapeAddControl language="zh" onAdd={(shapeType) => update(shape.id, { shapeType })} />
      </div>
      <div
        style={{
          position: 'relative',
          width: 'min(100%,1000px)',
          aspectRatio: '16/9',
          background: '#fff',
          border: '1px solid #e2e8f0',
        }}
      >
        <WebPlaytestStartMenuElement {...shared} element={shape} selected={selected} />
        <WebPlaytestStartMenuElement {...shared} element={foreground} selected={false} />
      </div>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
