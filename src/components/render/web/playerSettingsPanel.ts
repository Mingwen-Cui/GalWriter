import type { Language } from '../../../lib/i18n';

export type PlayerSettingsValues = {
  autoAdvance: boolean;
  interactionMode: 'immediate' | 'typewriter';
  typewriterSpeed: number;
  textScale: number;
  animationSpeed: number;
  soundEnabled: boolean;
  controlsVisible: boolean;
};

export const PLAYER_SETTINGS_ROLES = [
  'title',
  'back',
  'auto',
  'speed',
  'textSize',
  'animationSpeed',
  'sound',
  'controls',
];

const copy = {
  zh: {
    title: '播放设置',
    intro: '按照你的节奏，享受这个故事。',
    back: '完成',
    reading: '文字与阅读',
    playback: '播放与声音',
    mode: '文字呈现',
    immediate: '立即显示',
    typewriter: '逐字显示',
    speed: '打字间隔',
    speedHint: '每个字出现的间隔。数值越小，文字出现越快。',
    fast: '快 · 10 ms',
    slow: '慢 · 200 ms',
    size: '文字大小',
    sizeHint: '调整故事正文和标题，不影响菜单字号。',
    small: '小 · 85%',
    large: '大 · 130%',
    auto: '自动翻页',
    autoHint: '文字和媒体播放结束后继续；分支选项仍由你选择。',
    animation: '动画速度',
    animationHint: '调整画面转场和文字动画的节奏，不改变音视频速度。',
    half: '舒缓 · 0.5×',
    double: '快速 · 2×',
    sound: '播放声音',
    soundHint: '统一控制背景音乐、环境音、语音与视频声音。',
    controls: '显示控制栏',
    controlsHint: '显示返回、主菜单等播放工具；隐藏后可用画面角落按钮恢复。',
    preview: '阅读效果预览',
    sample: '风从山间吹来，新的故事正等待你继续。',
    replay: '重播效果',
    on: '开启',
    off: '关闭',
    reset: '恢复作品默认',
    saved: '调整立即生效',
    resetDone: '已恢复作品默认设置',
  },
  en: {
    title: 'Playback settings',
    intro: 'Enjoy the story at your own pace.',
    back: 'Done',
    reading: 'Text & reading',
    playback: 'Playback & audio',
    mode: 'Text display',
    immediate: 'Instant',
    typewriter: 'Typewriter',
    speed: 'Typing interval',
    speedHint: 'Time between characters. Lower values reveal text faster.',
    fast: 'Fast · 10 ms',
    slow: 'Slow · 200 ms',
    size: 'Text size',
    sizeHint: 'Scales story text and titles, without changing menus.',
    small: 'Small · 85%',
    large: 'Large · 130%',
    auto: 'Auto advance',
    autoHint: 'Continue after text and media finish. Branch choices remain yours.',
    animation: 'Animation speed',
    animationHint: 'Adjust scene and text animations; audio and video speed stay unchanged.',
    half: 'Gentle · 0.5×',
    double: 'Fast · 2×',
    sound: 'Playback audio',
    soundHint: 'Control music, ambience, voice and video audio together.',
    controls: 'Show toolbar',
    controlsHint: 'Show playback tools. The corner button restores a hidden toolbar.',
    preview: 'Reading preview',
    sample: 'A breeze crosses the hills. A new story is waiting for you.',
    replay: 'Replay preview',
    on: 'On',
    off: 'Off',
    reset: 'Restore story defaults',
    saved: 'Changes apply immediately',
    resetDone: 'Story defaults restored',
  },
  ja: {
    title: '再生設定',
    intro: '自分のペースで物語を楽しもう。',
    back: '完了',
    reading: '文字と読み方',
    playback: '再生とサウンド',
    mode: '文字の表示',
    immediate: '即時表示',
    typewriter: '一文字ずつ',
    speed: '文字の表示間隔',
    speedHint: '文字が現れる間隔です。数値が小さいほど速くなります。',
    fast: '速い · 10 ms',
    slow: '遅い · 200 ms',
    size: '文字サイズ',
    sizeHint: '本文とタイトルの大きさを変更します。メニューは変わりません。',
    small: '小 · 85%',
    large: '大 · 130%',
    auto: '自動ページ送り',
    autoHint: '文字とメディアの再生後に進みます。分岐は自分で選べます。',
    animation: 'アニメーション速度',
    animationHint: '画面と文字の演出速度を変更します。音声と動画は変わりません。',
    half: 'ゆっくり · 0.5×',
    double: '速い · 2×',
    sound: 'サウンド',
    soundHint: '音楽、環境音、ボイス、動画の音声をまとめて切り替えます。',
    controls: '操作バーを表示',
    controlsHint: '再生ツールを表示します。非表示時は画面隅のボタンで戻せます。',
    preview: '読み方のプレビュー',
    sample: '山を渡る風が、新しい物語の始まりを告げる。',
    replay: 'もう一度再生',
    on: 'オン',
    off: 'オフ',
    reset: '作品の初期設定に戻す',
    saved: '変更はすぐに反映されます',
    resetDone: '作品の初期設定に戻しました',
  },
};

// Both the editor and the standalone export consume this markup and controller.
export function playerSettingsMarkup(language: Language) {
  const t = copy[language === 'ja' ? 'ja' : language === 'en' ? 'en' : 'zh'];
  const range = (
    role: string,
    key: string,
    label: string,
    hint: string,
    min: number,
    max: number,
    step: number,
    unit: string,
    low: string,
    high: string,
  ) => `
    <div class="gw-ps-row" data-setting-role="${role}">
      <label><span class="gw-ps-label"><span data-role-label>${label}</span><output data-value="${key}" data-unit="${unit}"></output></span>
      <span class="gw-ps-hint">${hint}</span><input type="range" data-setting="${key}" min="${min}" max="${max}" step="${step}" aria-label="${label}" />
      <span class="gw-ps-scale" aria-hidden="true"><span>${low}</span><span>${high}</span></span></label>
    </div>`;
  const toggle = (role: string, key: string, label: string, hint: string) => `
    <div class="gw-ps-row gw-ps-toggle-row" data-setting-role="${role}"><div><span class="gw-ps-label" data-role-label>${label}</span><p class="gw-ps-hint">${hint}</p></div>
      <button class="gw-ps-toggle" type="button" role="switch" aria-checked="false" aria-label="${label}" data-setting="${key}"><span data-toggle-label>${t.off}</span><i aria-hidden="true"></i></button></div>`;
  return `<section class="gw-ps-panel" aria-label="${t.title}" data-on="${t.on}" data-off="${t.off}" data-saved="${t.saved}" data-reset-done="${t.resetDone}">
    <div class="gw-ps-head"><div><span class="gw-ps-eyebrow">PREFERENCES</span><h2 data-setting-role="title"><span data-role-label>${t.title}</span></h2><p>${t.intro}</p></div><button class="gw-ps-done" type="button" data-action="close" data-setting-role="back"><span data-role-label>${t.back}</span><span aria-hidden="true">✓</span></button></div>
    <div class="gw-ps-columns"><section class="gw-ps-group"><h3><span aria-hidden="true">Aa</span>${t.reading}</h3>
      <div class="gw-ps-row"><span class="gw-ps-label">${t.mode}</span><div class="gw-ps-segments" role="group" aria-label="${t.mode}"><button type="button" data-mode="immediate">${t.immediate}</button><button type="button" data-mode="typewriter">${t.typewriter}</button></div></div>
      ${range('speed', 'typewriterSpeed', t.speed, t.speedHint, 10, 200, 5, ' ms', t.fast, t.slow)}
      ${range('textSize', 'textScale', t.size, t.sizeHint, 85, 130, 5, '%', t.small, t.large)}
      <div class="gw-ps-preview"><div class="gw-ps-preview-head"><span>${t.preview}</span><button type="button" data-action="replay">↻ ${t.replay}</button></div><p data-sample="${t.sample}">${t.sample}</p><div class="gw-ps-motion" aria-hidden="true"><i></i></div></div>
    </section><section class="gw-ps-group"><h3><span aria-hidden="true">▷</span>${t.playback}</h3>
      ${toggle('auto', 'autoAdvance', t.auto, t.autoHint)}
      ${range('animationSpeed', 'animationSpeed', t.animation, t.animationHint, 0.5, 2, 0.25, '×', t.half, t.double)}
      ${toggle('sound', 'soundEnabled', t.sound, t.soundHint)}
      ${toggle('controls', 'controlsVisible', t.controls, t.controlsHint)}
    </section></div><div class="gw-ps-footer"><button type="button" data-action="reset">↺ ${t.reset}</button><span data-status role="status">${t.saved}</span></div>
  </section>`;
}

/** Self-contained: serialized into the offline player, so it must not reference module scope. */
export function mountPlayerSettings(
  root: HTMLElement,
  initial: PlayerSettingsValues,
  defaults: PlayerSettingsValues,
  onChange: (patch: Partial<PlayerSettingsValues>) => void,
  onClose: () => void,
  elements: Array<{ role?: string; text: string; visible?: boolean; disabled?: boolean }> = [],
) {
  let values = { ...initial };
  let timer: ReturnType<typeof setTimeout> | undefined;
  let sampleAnimation: Animation | undefined;
  const panel = root.querySelector<HTMLElement>('.gw-ps-panel')!;
  const sample = panel.querySelector<HTMLElement>('[data-sample]')!;
  const locks = new Set<Element>();
  panel.querySelectorAll<HTMLElement>('[data-setting-role]').forEach((row) => {
    row.hidden = false;
    const label = row.querySelector<HTMLElement>('[data-role-label]');
    if (label) {
      label.dataset.defaultLabel ??= label.textContent || '';
      label.textContent = label.dataset.defaultLabel;
    }
    row
      .querySelectorAll<HTMLInputElement | HTMLButtonElement>('input,button')
      .forEach((control) => {
        control.disabled = false;
      });
  });
  elements.forEach((element) => {
    const row = Array.from(panel.querySelectorAll<HTMLElement>('[data-setting-role]')).find(
      (item) => item.dataset.settingRole === element.role,
    );
    if (!row) return;
    row.hidden = element.visible === false;
    const label = row.querySelector<HTMLElement>('[data-role-label]');
    if (label && element.text) label.textContent = element.text;
    row
      .querySelectorAll<HTMLInputElement | HTMLButtonElement>('input,button')
      .forEach((control) => {
        if (element.text) control.setAttribute('aria-label', element.text);
        if (element.disabled) {
          control.disabled = true;
          locks.add(control);
        }
      });
  });
  // Keep an exit available even if an older template hid its back element.
  panel.querySelector<HTMLElement>('[data-action="close"]')!.hidden = false;
  const replay = () => {
    clearTimeout(timer);
    sampleAnimation?.cancel();
    const text = Array.from(sample.dataset.sample || '');
    sample.textContent = '';
    let index = 0;
    const tick = () => {
      if (values.interactionMode === 'immediate') index = text.length;
      else index += 1;
      sample.textContent = text.slice(0, index).join('');
      if (index < text.length) timer = setTimeout(tick, values.typewriterSpeed);
    };
    tick();
    sampleAnimation = panel
      .querySelector('.gw-ps-motion i')
      ?.animate(
        [
          { transform: 'translateX(0)' },
          { transform: 'translateX(200%)' },
          { transform: 'translateX(0)' },
        ],
        {
          duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 0
            : 1600 / values.animationSpeed,
          easing: 'ease-in-out',
        },
      );
  };
  const sync = (next: PlayerSettingsValues) => {
    values = { ...next };
    panel
      .querySelectorAll<HTMLInputElement | HTMLButtonElement>('[data-setting]')
      .forEach((control) => {
        const key = control.dataset.setting as keyof PlayerSettingsValues;
        const value = values[key];
        if (control instanceof HTMLInputElement) {
          control.value = String(value);
          control.style.setProperty(
            '--fill',
            `${((Number(value) - Number(control.min)) / (Number(control.max) - Number(control.min))) * 100}%`,
          );
          control.disabled =
            locks.has(control) ||
            (key === 'typewriterSpeed' && values.interactionMode === 'immediate');
          const output = panel.querySelector<HTMLOutputElement>(`[data-value="${key}"]`);
          if (output) output.value = `${value}${output.dataset.unit}`;
          control.setAttribute('aria-valuetext', `${value}${output?.dataset.unit || ''}`);
        } else {
          control.setAttribute('aria-checked', String(Boolean(value)));
          control.querySelector('[data-toggle-label]')!.textContent = value
            ? panel.dataset.on!
            : panel.dataset.off!;
        }
      });
    panel
      .querySelectorAll<HTMLButtonElement>('[data-mode]')
      .forEach((button) =>
        button.setAttribute('aria-pressed', String(button.dataset.mode === values.interactionMode)),
      );
    sample.style.fontSize = `${(20 * values.textScale) / 100}px`;
  };
  const change = (patch: Partial<PlayerSettingsValues>) => {
    sync({ ...values, ...patch });
    onChange(patch);
    panel.querySelector('[data-status]')!.textContent = panel.dataset.saved!;
  };
  const input = (event: Event) => {
    if (!(event.target instanceof HTMLInputElement) || !event.target.dataset.setting) return;
    change({ [event.target.dataset.setting]: Number(event.target.value) });
    if (event.target.dataset.setting !== 'textScale') replay();
  };
  const click = (event: Event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button');
    if (!button || button.disabled) return;
    if (button.dataset.action === 'close') onClose();
    else if (button.dataset.action === 'replay') replay();
    else if (button.dataset.action === 'reset') {
      change({ ...defaults });
      replay();
      panel.querySelector('[data-status]')!.textContent = panel.dataset.resetDone!;
    } else if (button.dataset.mode) {
      change({ interactionMode: button.dataset.mode as PlayerSettingsValues['interactionMode'] });
      replay();
    } else if (button.dataset.setting) {
      const key = button.dataset.setting as keyof PlayerSettingsValues;
      change({ [key]: !values[key] });
    }
  };
  root.addEventListener('input', input);
  root.addEventListener('click', click);
  sync(values);
  return {
    sync,
    destroy: () => {
      clearTimeout(timer);
      sampleAnimation?.cancel();
      root.removeEventListener('input', input);
      root.removeEventListener('click', click);
    },
  };
}

export const PLAYER_SETTINGS_CSS = `
.gw-ps-surface { position:absolute; inset:0; z-index:15; display:grid; place-items:center; padding:32px; overflow:hidden; container-type:inline-size; }
.gw-ps-panel { box-sizing:border-box; width:min(100%,1060px); max-height:100%; overflow:auto; color:#edf3ff; background:rgba(12,20,34,.94); border:1px solid #ffffff24; border-radius:24px; box-shadow:0 28px 80px #0005; padding:32px; font:16px/1.5 system-ui,sans-serif; text-align:left; color-scheme:dark; scrollbar-width:thin; }
.gw-ps-panel * { box-sizing:border-box; }
.gw-ps-panel [hidden] { display:none!important; }
.gw-ps-panel button,.gw-ps-panel input { font:inherit; touch-action:manipulation; }
.gw-ps-panel button { cursor:pointer; color:inherit; }
.gw-ps-panel button:disabled,.gw-ps-panel input:disabled { opacity:.4; cursor:default; }
.gw-ps-panel button:focus-visible,.gw-ps-panel input:focus-visible { outline:3px solid #a8cbff; outline-offset:4px; }
.gw-ps-head { display:flex; align-items:center; justify-content:space-between; gap:24px; padding-bottom:26px; }
.gw-ps-eyebrow { color:#a8bcdb; font-size:11px; font-weight:700; letter-spacing:.16em; }
.gw-ps-head h2 { margin:6px 0; font-size:30px; font-weight:700; line-height:1.25; color:inherit; }
.gw-ps-head p { margin:0; color:#a9b7cc; }
.gw-ps-done { display:flex; align-items:center; gap:24px; border:1px solid #ffffff30; border-radius:12px; background:#ffffff0d; padding:12px 20px; flex-shrink:0; }
.gw-ps-panel button:hover:not(:disabled) { filter:brightness(1.18); background-color:#ffffff20; }
.gw-ps-columns { display:grid; grid-template-columns:1fr 1fr; gap:22px; }
.gw-ps-group { min-width:0; padding:22px; border:1px solid #ffffff16; border-radius:18px; background:#ffffff04; }
.gw-ps-group h3 { display:flex; align-items:center; gap:10px; margin:0 0 8px; font-size:18px; font-weight:650; }
.gw-ps-group h3>span { display:grid; place-items:center; width:32px; height:32px; background:#86b4ff1c; color:#b7d1ff; border-radius:9px; font-size:16px; }
.gw-ps-row { padding:20px 0; border-bottom:1px solid #ffffff12; }
.gw-ps-row:last-child { border-bottom:0; }
.gw-ps-row label { display:block; }
.gw-ps-label { display:flex; align-items:center; justify-content:space-between; gap:12px; font-weight:600; font-size:16px; }
.gw-ps-label output { min-width:72px; padding:3px 9px; border:1px solid #a8caff26; border-radius:7px; color:#c4dcff; background:#85b5ff12; font-variant-numeric:tabular-nums; text-align:center; white-space:nowrap; }
.gw-ps-hint { display:block; margin:7px 0 0; font-size:13px; line-height:1.65; color:#a9b7cc; font-weight:400; }
.gw-ps-row input[type=range] { appearance:none; display:block; width:100%; height:6px; margin:20px 0 12px; border:0; border-radius:99px; background:linear-gradient(to right,#a4c4ff var(--fill,50%),#ffffff26 var(--fill,50%)); cursor:pointer; }
.gw-ps-row input[type=range]::-webkit-slider-thumb { appearance:none; width:18px; height:18px; border-radius:50%; background:#f5f8ff; border:3px solid #a4c4ff; box-shadow:0 2px 8px #0005; }
.gw-ps-row input[type=range]::-moz-range-thumb { width:14px; height:14px; border-radius:50%; background:#f5f8ff; border:3px solid #a4c4ff; }
.gw-ps-scale { display:flex; justify-content:space-between; gap:10px; font-size:11px; color:#a9b7cc; }
.gw-ps-segments { display:flex; gap:4px; padding:4px; background:#0003; border-radius:10px; margin-top:12px; }
.gw-ps-segments button { flex:1; padding:8px; border:0; border-radius:7px; background:transparent; color:#a9b7cc; }
.gw-ps-segments button[aria-pressed=true] { color:#fff; background:#536a91; box-shadow:0 2px 5px #0003; }
.gw-ps-toggle-row { display:flex; align-items:center; gap:20px; justify-content:space-between; }
.gw-ps-toggle-row>div { min-width:0; }
.gw-ps-toggle { display:flex; align-items:center; gap:8px; flex-shrink:0; padding:4px 0; border:0; background:transparent; font-size:12px!important; }
.gw-ps-toggle i { display:block; width:42px; height:24px; padding:3px; border-radius:20px; background:#ffffff30; }
.gw-ps-toggle i::after { content:''; display:block; width:18px; height:18px; background:#fff; border-radius:50%; transition:transform .15s; }
.gw-ps-toggle[aria-checked=true] i { background:#739deb; }
.gw-ps-toggle[aria-checked=true] i::after { transform:translateX(18px); }
.gw-ps-preview { margin-top:18px; padding:16px; border-radius:12px; background:linear-gradient(125deg,#608ec51a,#6172bd12); border:1px solid #a3c7ff20; }
.gw-ps-preview-head { display:flex; align-items:center; justify-content:space-between; gap:10px; font-size:12px; color:#b9c9de; }
.gw-ps-preview-head button { background:transparent; border:0; padding:4px; font-size:12px; color:#c4dcff; }
.gw-ps-preview p { margin:14px 0; min-height:3em; line-height:1.5; overflow-wrap:anywhere; }
.gw-ps-motion { height:3px; overflow:hidden; border-radius:5px; background:#ffffff0d; }
.gw-ps-motion i { display:block; width:33.333%; height:100%; background:#a4c4ff; border-radius:5px; }
.gw-ps-footer { display:flex; align-items:center; justify-content:space-between; gap:16px; padding-top:24px; color:#a9b7cc; font-size:13px; }
.gw-ps-footer button { border:1px solid #ffffff26; background:transparent; padding:10px 14px; border-radius:10px; }
@container (max-width:700px) { .gw-ps-panel { padding:20px; border-radius:18px; } .gw-ps-columns { grid-template-columns:1fr; } .gw-ps-head h2 { font-size:24px; } .gw-ps-group { padding:16px; } .gw-ps-footer { flex-wrap:wrap; } }
@media (prefers-reduced-motion:reduce) { .gw-ps-toggle i::after { transition:none; } }
`;
