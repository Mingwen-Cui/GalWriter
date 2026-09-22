import { ReactFlowProvider, useReactFlow, type Node, type Edge } from '@xyflow/react';
import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import '../src/index.css';
import { StoryCanvasWorkspace } from '../src/components/story-editor/StoryCanvasWorkspace';
import { useCanvasInteractions } from '../src/editor-features/canvas/useCanvasInteractions';

const frame = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
const noop = () => {};

function Fixture() {
  const [nodes, setNodes] = useState<Node[]>([
    { id: 'first', position: { x: 150, y: 150 }, data: { label: 'First card' } },
    { id: 'second', position: { x: 450, y: 150 }, data: { label: 'Second card' } },
  ]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [report, setReport] = useState('Ready');
  const wrapper = useRef<HTMLDivElement>(null);
  const selection = useRef<HTMLDivElement>(null);
  const contextCount = useRef(0);
  const flow = useReactFlow();
  const interactions = useCanvasInteractions({
    nodes,
    setNodes,
    setEdges,
    interactionMode: 'select',
    selectionBoxRef: selection,
    screenToFlowPosition: flow.screenToFlowPosition,
    getIntersectingNodes: flow.getIntersectingNodes,
    setHorizontalGuides: noop,
    setVerticalGuides: noop,
    defaultEdgeOptions: {},
    handleDeleteNode: noop,
    handleUpdateNode: noop,
  });
  const run = async () => {
    const passed: string[] = [];
    const check = (condition: boolean, label: string) => {
      if (!condition) throw new Error(label);
      passed.push(`PASS ${label}`);
    };
    const mouse = (
      target: EventTarget,
      type: string,
      x: number,
      y: number,
      button: number,
      shiftKey = false,
    ) => {
      const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        button,
        buttons: type === 'mouseup' ? 0 : button === 2 ? 2 : 1,
        shiftKey,
        view: window,
      });
      target.dispatchEvent(event);
      return event;
    };
    try {
      setNodes((current) => current.map((node) => ({ ...node, selected: false })));
      await flow.setViewport({ x: 0, y: 0, zoom: 1 });
      await frame();
      const pane = wrapper.current!.querySelector('.react-flow__pane')!;
      const first = wrapper.current!.querySelector('[data-id="first"]')!;
      const second = wrapper.current!.querySelector('[data-id="second"]')!;
      const select = async (node: Element, shift = false) => {
        const rect = node.getBoundingClientRect();
        mouse(pane, 'mousedown', rect.left - 20, rect.top - 20, 0, shift);
        await frame();
        mouse(pane, 'mousemove', rect.right + 20, rect.bottom + 20, 0, shift);
        await frame();
        mouse(pane, 'mouseup', rect.right + 20, rect.bottom + 20, 0, shift);
        mouse(pane, 'click', rect.right + 20, rect.bottom + 20, 0, shift);
        await frame();
      };
      await select(first);
      check(
        flow
          .getNodes()
          .filter((node) => node.selected)
          .map((node) => node.id)
          .join() === 'first',
        'left drag selects and subsequent click keeps selection',
      );
      check(
        flow.getViewport().x === 0 && flow.getViewport().y === 0,
        'left selection does not pan',
      );
      await select(second, true);
      check(
        flow.getNodes().filter((node) => node.selected).length === 2,
        'Shift appends selection',
      );
      const rect = first.getBoundingClientRect();
      mouse(first, 'mousedown', rect.left + 10, rect.top + 10, 2);
      mouse(window, 'mousemove', rect.left + 90, rect.top + 60, 2);
      await frame();
      mouse(window, 'mouseup', rect.left + 90, rect.top + 60, 2);
      const context = mouse(first, 'contextmenu', rect.left + 90, rect.top + 60, 2);
      await frame();
      check(
        flow.getViewport().x === 80 && flow.getViewport().y === 50,
        'right drag from card pans by pointer delta',
      );
      check(
        context.defaultPrevented && contextCount.current === 0,
        'right drag does not open node menu',
      );
      check(
        flow.getNodes().filter((node) => node.selected).length === 2,
        'right drag preserves selection',
      );
      mouse(first, 'mousedown', rect.left + 90, rect.top + 60, 2);
      mouse(window, 'mouseup', rect.left + 90, rect.top + 60, 2);
      mouse(first, 'contextmenu', rect.left + 90, rect.top + 60, 2);
      check(contextCount.current === 1, 'stationary right click still opens node menu');
      mouse(pane, 'mousedown', 20, 100, 0);
      await frame();
      mouse(window, 'mousemove', 900, 700, 0);
      mouse(window, 'mouseup', 900, 700, 0);
      await frame();
      check(selection.current?.style.display === 'none', 'release outside canvas ends selection');
      setReport(passed.join('\n'));
    } catch (error) {
      setReport([...passed, `FAIL ${String(error)}`].join('\n'));
    }
  };
  return (
    <>
      <button onClick={() => void run()}>运行画布鼠标回归</button>
      <pre data-testid="report">{report}</pre>
      <div style={{ width: 850, height: 550 }}>
        <StoryCanvasWorkspace
          bubbleStyle="flat"
          canvasTouchAction={interactions.canvasTouchAction}
          canvasWrapperRef={wrapper}
          selectionBoxRef={selection}
          onMouseDown={interactions.handleMouseDown}
          onMouseMove={interactions.handleMouseMove}
          onMouseUp={interactions.handleMouseUp}
          interactionMode="select"
          isRightDragging={interactions.isRightDragging}
          scrollMode="zoom"
          resolvedTheme="light"
          showMiniMap={false}
          showControls={false}
          showStats={false}
          miniMapPosition="right"
          miniMapCopy={{ zoomIn: '', zoomOut: '', fitView: '', maximize: '', exitFullscreen: '' }}
          isFullscreen={false}
          onToggleFullscreen={noop}
          horizontalGuides={[]}
          verticalGuides={[]}
          reactFlowProps={{
            nodes,
            edges,
            onNodesChange: interactions.onNodesChange,
            onNodeContextMenu: () => {
              contextCount.current += 1;
            },
          }}
        />
      </div>
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <ReactFlowProvider>
    <Fixture />
  </ReactFlowProvider>,
);
