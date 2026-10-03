import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PptWorkspace } from '../src/components/render/ppt/PptWorkspace';
import { useWebExportSettings } from '../src/components/render/video/export/useWebExportSettings';
import { DEFAULT_RENDER_STYLE } from '../src/components/render/video/VideoRenderModal/workspaceStorage';
import type { PptExportSettings } from '../src/components/render/video/shared/types';
import '../src/index.css';

let snapshot: PptExportSettings;
const settle = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const check = (condition: unknown, label: string) => {
  if (!condition) throw new Error(label);
};
const workspace = () => document.querySelector('#workspace')!;
const findButton = (label: string, scope: ParentNode = workspace()) => {
  const found = [...scope.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => button.textContent?.trim() === label,
  );
  if (!found) throw new Error(`Missing button: ${label}`);
  return found;
};
const click = async (label: string, scope?: ParentNode) => {
  findButton(label, scope).click();
  await settle();
};
const selected = () =>
  workspace().querySelector<HTMLElement>('[data-ppt-selection-target="cover-description"]')!;
const ribbon = () => workspace().querySelector('header')!;
const sidebar = () => workspace().querySelector('aside')!;
const arrows = () => [...ribbon().querySelectorAll<HTMLButtonElement>('.ppt-direction-button')];

async function run() {
  const reports: string[] = [];
  const report = (label: string) => {
    reports.push(`PASS ${label}`);
    document.querySelector('#report')!.textContent = reports.join('\n');
  };
  try {
    await click('动画标签', document);
    check(
      findButton('动画', sidebar()).getAttribute('aria-pressed') === 'true',
      'animation sidebar default',
    );
    selected().click();
    await settle();
    check(
      findButton('无动画', ribbon()).getAttribute('aria-pressed') === 'true',
      'empty object must show no animation',
    );
    check(sidebar().textContent?.includes('无动画'), 'empty timeline status');
    report('对象没有动画时，功能区和右侧均显示无动画');
    await click('入场', ribbon());
    check(
      snapshot.animations?.cover?.length === 1 && snapshot.animations.cover[0].phase === 'enter',
      'entrance must be saved',
    );
    check(
      sidebar().querySelectorAll('[title]').length > 0 &&
        !sidebar().textContent?.includes('选择画布中的对象'),
      'timeline reflects saved entrance',
    );
    check(selected().firstElementChild?.getAnimations().length, 'entrance auto preview');
    report('点击入场真正添加动画、时间轴立即显示，并自动预览');
    await click('循环播放', sidebar());
    const old = selected();
    arrows()
      .find((button) => button.title === '自上方')!
      .click();
    await settle();
    check(old !== selected(), 'direction change must restart preview');
    check(
      selected().firstElementChild?.getAnimations()[0]?.effect?.getTiming().duration === 500,
      'updated animation plays',
    );
    await wait(1150);
    check(
      selected().firstElementChild?.getAnimations().length === 0,
      'automatic preview plays once even if loop is enabled',
    );
    report('修改动画方向重新预览一次，循环开关不影响自动预览次数');
    await click('中场', ribbon());
    await click('亮度', ribbon());
    const outerStyle = getComputedStyle(selected());
    check(outerStyle.filter === 'none', 'editor frame must not inherit brightness');
    check(
      selected().firstElementChild?.getAnimations().length,
      'brightness still animates content',
    );
    check(
      getComputedStyle(selected().querySelector('[aria-label="Hide"]')!).backgroundColor !==
        'rgb(0, 0, 0)',
      'visibility icon retains color',
    );
    report('亮度动画只作用于内容，选框和图标保持原色');
    await click('出场', ribbon());
    check(
      snapshot.animations?.cover?.some((item) => item.phase === 'exit'),
      'exit is saved',
    );
    await click('无动画', ribbon());
    check(
      findButton('无动画', ribbon()).getAttribute('aria-pressed') === 'true',
      'cleared no animation status',
    );
    await click('切换标签', document);
    check(
      findButton('设计', sidebar()).getAttribute('aria-pressed') === 'true',
      'transition sidebar default',
    );
    for (const name of ['无', '平滑', '淡入/淡出', '切入']) {
      await click(name, ribbon());
      check(
        arrows().every((button) => button.disabled),
        `${name} has no directions`,
      );
    }
    await click('显示', ribbon());
    check(
      arrows().filter((button) => !button.disabled).length === 2,
      'reveal only supports left/right',
    );
    check(
      arrows()
        .filter((button) => !button.disabled)
        .every((button) => /左|右/.test(button.title)),
      'reveal disables up/down',
    );
    for (const name of ['推入', '擦除']) {
      await click(name, ribbon());
      check(
        arrows().every((button) => !button.disabled),
        `${name} supports all directions`,
      );
      const oldCanvas = workspace().querySelector('.ppt-slide-canvas');
      arrows()
        .find((button) => button.title === '自下方')!
        .click();
      await settle();
      const canvas = workspace().querySelector<HTMLElement>('.ppt-slide-canvas')!;
      check(
        canvas !== oldCanvas && canvas.style.animation.includes('-down'),
        `${name} direction preview`,
      );
    }
    report('所有切换效果的方向限制与预览一致');
    await click('分割', ribbon());
    for (const label of ['横向向内', '横向向外', '纵向向内', '纵向向外']) {
      const oldCanvas = workspace().querySelector('.ppt-slide-canvas');
      await click(label, ribbon());
      check(
        workspace().querySelector('.ppt-slide-canvas') !== oldCanvas,
        `${label} must restart preview`,
      );
    }
    await click('随机线条', ribbon());
    await click('垂直', ribbon());
    check(snapshot.transitions?.cover?.orientation === 'vertical', 'bars orientation saved');
    check(
      workspace()
        .querySelector<HTMLElement>('.ppt-slide-canvas')!
        .style.animation.includes('bars-vertical'),
      'bars direction preview',
    );
    report('分割四种选项和随机线条两种选项均保存并自动预览');
    await click('插入标签', document);
    check(
      findButton('设计', sidebar()).getAttribute('aria-pressed') === 'true',
      'insert sidebar default',
    );
    await click('动画标签', document);
    check(
      findButton('动画', sidebar()).getAttribute('aria-pressed') === 'true',
      'return to animation sidebar',
    );
    report('插入/切换默认设计，动画默认动画');
    document.querySelector('#report')!.textContent =
      `ALL ${reports.length} CHECKS PASSED\n${reports.join('\n')}`;
  } catch (error) {
    document.querySelector('#report')!.textContent = `${reports.join('\n')}\nFAIL ${String(error)}`;
  }
}

function Fixture() {
  const [style, setStyle] = useState(DEFAULT_RENDER_STYLE);
  const updateStyle = <K extends keyof typeof style>(key: K, value: (typeof style)[K]) =>
    setStyle((previous) => ({ ...previous, [key]: value }));
  const { webSettings } = useWebExportSettings(
    'PPT regression',
    'zh',
    false,
    'ppt-effects-fixture',
    undefined,
    { value: style, update: updateStyle },
  );
  const [settings, setSettings] = useState<PptExportSettings>({
    layout: 'LAYOUT_WIDE',
    branchMode: 'linear',
    density: 'oneNodePerSlide',
    includeCover: true,
    includeNotes: false,
  });
  const [tab, setTab] = useState<'animation' | 'transition' | 'insert'>('insert');
  snapshot = settings;
  return (
    <>
      <div style={{ padding: 8 }}>
        {(['insert', 'transition', 'animation'] as const).map((value, index) => (
          <button key={value} onClick={() => setTab(value)} style={{ marginRight: 16 }}>
            {['插入标签', '切换标签', '动画标签'][index]}
          </button>
        ))}
        <button onClick={run}>Run regression</button>
        <pre id="report" style={{ whiteSpace: 'pre-wrap' }}>
          Ready
        </pre>
      </div>
      <div id="workspace" className="video-render-workspace" style={{ height: '84vh' }}>
        <PptWorkspace
          nodes={[]}
          edges={[]}
          language="zh"
          projectName="PPT regression"
          webSettings={webSettings}
          renderStyle={style}
          updateRenderStyle={updateStyle}
          pptSettings={settings}
          updatePptSettings={(patch) => setSettings((previous) => ({ ...previous, ...patch }))}
          ribbonTab={tab}
          ribbonCollapsed={false}
        />
      </div>
    </>
  );
}
createRoot(document.getElementById('root')!).render(<Fixture />);
