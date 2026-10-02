import type { RenderStyle, WebMenuElement } from '../video/shared/types';
import type { PlayerControlId, PlayerSettingsPanelConfig } from './playerSettingsPanelConfig';
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
    playback: '声音与操作',
    mode: '文字显示',
    immediate: '全部显示',
    typewriter: '逐字显示',
    speed: '文字速度',
    speedHint: '向右拖动，文字出现得更快。',
    intervalHint: '每字等待时间（毫秒），数值越小越快。',
    fast: '快',
    slow: '慢',
    standard: '标准',
    presetSmall: '小',
    presetLarge: '大',
    size: '文字大小',
    sizeHint: '调整故事正文和标题，不影响菜单字号。',
    small: '小 · 85%',
    large: '大 · 130%',
    auto: '自动推进',
    autoHint: '文字和媒体播放结束后继续；分支选项仍由你选择。',
    animation: '动画速度',
    animationHint: '调整画面转场和文字动画的节奏，不改变音视频速度。',
    half: '舒缓 · 0.5×',
    double: '快速 · 2×',
    sound: '播放声音',
    soundHint: '统一控制背景音乐、环境音、语音与视频声音。',
    controls: '显示操作栏',
    controlsHint: '显示返回、主菜单等播放工具；隐藏后可用画面角落按钮恢复。',
    preview: '阅读效果预览',
    sample: '风从山间吹来，轻轻翻动了手中的书页。\n「别着急，我们还有时间，把这个故事慢慢读完。」',
    replay: '重播效果',
    on: '开启',
    off: '关闭',
    reset: '恢复作品默认',
    saved: '调整立即生效',
    resetDone: '已恢复作品默认设置',
    undo: '撤销恢复',
    undoDone: '已撤销恢复',
  },
  en: {
    title: 'Playback settings',
    intro: 'Enjoy the story at your own pace.',
    back: 'Done',
    reading: 'Text & reading',
    playback: 'Audio & controls',
    mode: 'Text display',
    immediate: 'Instant',
    typewriter: 'Typewriter',
    speed: 'Text speed',
    speedHint: 'Drag right to reveal text faster.',
    intervalHint: 'Delay per character in milliseconds. Lower is faster.',
    fast: 'Fast',
    slow: 'Slow',
    standard: 'Standard',
    presetSmall: 'Small',
    presetLarge: 'Large',
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
    sample: 'A breeze crosses the hills, gently turning the pages.\n“Take your time. We can read this story together.”',
    replay: 'Replay preview',
    on: 'On',
    off: 'Off',
    reset: 'Restore story defaults',
    saved: 'Changes apply immediately',
    resetDone: 'Story defaults restored',
    undo: 'Undo reset',
    undoDone: 'Reset undone',
  },
  ja: {
    title: '再生設定',
    intro: '自分のペースで物語を楽しもう。',
    back: '完了',
    reading: '文字と読み方',
    playback: 'サウンドと操作',
    mode: '文字の表示',
    immediate: '即時表示',
    typewriter: '一文字ずつ',
    speed: '文字の表示速度',
    speedHint: '右に動かすほど、文字が速く表示されます。',
    intervalHint: '一文字の待ち時間（ミリ秒）。小さいほど速くなります。',
    fast: '速い',
    slow: '遅い',
    standard: '標準',
    presetSmall: '小',
    presetLarge: '大',
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
    sample: '山を渡る風が、手元のページをそっとめくった。\n「ゆっくりでいい。一緒にこの物語を読もう。」',
    replay: 'もう一度再生',
    on: 'オン',
    off: 'オフ',
    reset: '作品の初期設定に戻す',
    saved: '変更はすぐに反映されます',
    resetDone: '作品の初期設定に戻しました',
    undo: '元に戻す',
    undoDone: '変更を元に戻しました',
  },
};

// Both the editor and the standalone export consume this markup and controller.
export function playerSettingsMarkup(
  language: Language,
  config: PlayerSettingsPanelConfig = {},
  element?: WebMenuElement,
) {
  const t = copy[language === 'ja' ? 'ja' : language === 'en' ? 'en' : 'zh'];
  if (element?.role)
    config = {
      ...config,
      controls: {
        ...config.controls,
        [element.role]: { form: element.settingsControlForm, state: 'visible' },
      },
    };

  const clamp = (value: number | undefined, min: number, max: number, fallback: number) =>
    Number.isFinite(value) ? Math.min(max, Math.max(min, value!)) : fallback;
  const height = clamp(config.height, 28, 64, 40);
  const fontSize = element
    ? clamp(element.fontSize, 4, 240, 16)
    : clamp(config.fontSize, 12, 24, 16);
  const radius = clamp(config.radius, 0, 32, 10);
  const attrs = (id: PlayerControlId) => {
    const control = config.controls?.[id] || {};
    const state = ['visible', 'hidden', 'removed'].includes(control.state || '')
      ? control.state
      : '';
    return `data-setting-role="${id}" data-panel-state="${state}" style="--ps-height:${clamp(control.height, 28, 64, height)}px;--ps-size:${element ? fontSize : clamp(control.fontSize, 12, 24, fontSize)}px;width:${clamp(control.width, 40, 100, 100)}%;" ${state === 'hidden' || state === 'removed' ? 'hidden' : ''}`;
  };
  const range = (
    role: PlayerControlId,
    key: string,
    label: string,
    hint: string,
    min: number,
    max: number,
    step: number,
    unit: string,
    low: string,
    high: string,
  ) => {
    const stepper = config.controls?.[role]?.form === 'stepper';
    const input = `<input type="${stepper ? 'number' : 'range'}" data-setting="${key}" ${role === 'speed' && !stepper ? 'data-invert="true"' : ''} min="${min}" max="${max}" step="${step}" aria-label="${label}" />`;
    return `<div class="gw-ps-row" ${attrs(role)}>
      <label><span class="gw-ps-label"><span data-role-label>${label}</span><output data-value="${key}" data-unit="${unit}" ${stepper ? 'hidden' : ''}></output></span>
      <span class="gw-ps-hint">${role === 'speed' && stepper ? t.intervalHint : hint}</span>${stepper ? '' : input + `<span class="gw-ps-scale" aria-hidden="true"><span>${low}</span><span>${high}</span></span>`}</label>
      ${stepper ? `<div class="gw-ps-stepper"><button type="button" data-step-setting="${key}" data-delta="-1" aria-label="${label} − ${step}">−</button>${input}<span>${unit}</span><button type="button" data-step-setting="${key}" data-delta="1" aria-label="${label} + ${step}">+</button></div>` : ''}
      ${role === 'textSize' ? `<div class="gw-ps-presets" role="group" aria-label="${label}">${[[85, t.presetSmall], [100, t.standard], [130, t.presetLarge]].map(([value, text]) => `<button type="button" data-text-scale="${value}" aria-pressed="false">${text}</button>`).join('')}</div>` : ''}
    </div>`;
  };
  const toggle = (role: PlayerControlId, key: string, label: string, hint: string) => {
    const segmented = config.controls?.[role]?.form === 'segmented';
    return `<div class="gw-ps-row ${segmented ? '' : 'gw-ps-toggle-row'}" ${attrs(role)}><div><span class="gw-ps-label" data-role-label>${label}</span><p class="gw-ps-hint">${hint}</p></div>
      ${segmented ? `<div class="gw-ps-segments" role="group" aria-label="${label}"><button type="button" data-setting-choice="${key}" data-choice="true">${t.on}</button><button type="button" data-setting-choice="${key}" data-choice="false">${t.off}</button></div>` : `<button class="gw-ps-toggle" type="button" role="switch" aria-checked="false" aria-label="${label}" data-setting="${key}"><span data-toggle-label>${t.off}</span><i aria-hidden="true"></i></button>`}</div>`;
  };
  const modeMarkup = `<div class="gw-ps-row" ${attrs('mode')}><span class="gw-ps-label" data-role-label>${t.mode}</span>
      ${config.controls?.mode?.form === 'select' ? `<select class="gw-ps-select" data-mode-select aria-label="${t.mode}"><option value="immediate">${t.immediate}</option><option value="typewriter">${t.typewriter}</option></select>` : `<div class="gw-ps-segments" role="group" aria-label="${t.mode}"><button type="button" data-mode="immediate">${t.immediate}</button><button type="button" data-mode="typewriter">${t.typewriter}</button></div>`}</div>`;
  const previewMarkup = `<div class="gw-ps-preview" ${attrs('preview')}><div class="gw-ps-preview-head"><span data-role-label>${t.preview}</span><button type="button" data-action="replay">${t.replay}</button></div><p data-sample="${t.sample}">${t.sample}</p><div class="gw-ps-motion" aria-hidden="true"><i></i></div></div>`;
  const resetMarkup = `<div class="gw-ps-reset" ${attrs('reset')}><button type="button" data-action="reset"><span data-role-label>${t.reset}</span></button><button type="button" data-action="undo-reset" hidden>${t.undo}</button><span data-status role="status" class="gw-ps-reset-status"></span></div>`;
  const widgets: Record<string, string> = {
    mode: modeMarkup,
    preview: previewMarkup,
    reset: resetMarkup,
    speed: range(
      'speed',
      'typewriterSpeed',
      t.speed,
      t.speedHint,
      10,
      200,
      5,
      ' ms',
      t.slow,
      t.fast,
    ),
    textSize: range('textSize', 'textScale', t.size, t.sizeHint, 85, 130, 5, '%', t.small, t.large),
    animationSpeed: range(
      'animationSpeed',
      'animationSpeed',
      t.animation,
      t.animationHint,
      0.5,
      2,
      0.25,
      '×',
      t.half,
      t.double,
    ),
    auto: toggle('auto', 'autoAdvance', t.auto, t.autoHint),
    sound: toggle('sound', 'soundEnabled', t.sound, t.soundHint),
    controls: toggle('controls', 'controlsVisible', t.controls, t.controlsHint),
  };
  if (element)
    return `<div class="gw-ps-panel gw-ps-widget" data-speed-slow="${t.slow}" data-speed-standard="${t.standard}" data-speed-fast="${t.fast}" data-undo-done="${t.undoDone}" style="--ps-size:${fontSize}px;--ps-height:${height}px;--ps-radius:${clamp(element.borderRadius, 0, 100, radius)}px;" data-on="${t.on}" data-off="${t.off}" data-saved="${t.saved}" data-reset-done="${t.resetDone}">${widgets[element.role || ''] || ''}</div>`;
  const appearance = ['soft', 'filled', 'outline'].includes(config.appearance || '')
    ? config.appearance
    : 'soft';
  return `<section class="gw-ps-panel" data-appearance="${appearance}" data-speed-slow="${t.slow}" data-speed-standard="${t.standard}" data-speed-fast="${t.fast}" data-undo-done="${t.undoDone}" style="--ps-height:${height}px;--ps-size:${fontSize}px;--ps-radius:${radius}px;" aria-label="${t.title}" data-on="${t.on}" data-off="${t.off}" data-saved="${t.saved}" data-reset-done="${t.resetDone}">
    <div class="gw-ps-head"><div><span class="gw-ps-eyebrow">PREFERENCES</span><h2 data-setting-role="title"><span data-role-label>${t.title}</span></h2><p>${t.intro}</p></div><button class="gw-ps-done" type="button" data-action="close" data-setting-role="back"><span data-role-label>${t.back}</span><span aria-hidden="true">✓</span></button></div>
    <div class="gw-ps-columns"><section class="gw-ps-group"><h3><span aria-hidden="true">Aa</span>${t.reading}</h3>
      ${modeMarkup}
      ${range('speed', 'typewriterSpeed', t.speed, t.speedHint, 10, 200, 5, ' ms', t.slow, t.fast)}
      ${range('textSize', 'textScale', t.size, t.sizeHint, 85, 130, 5, '%', t.small, t.large)}
      ${previewMarkup}
    </section><section class="gw-ps-group"><h3><span aria-hidden="true">▷</span>${t.playback}</h3>
      ${toggle('auto', 'autoAdvance', t.auto, t.autoHint)}
      ${range('animationSpeed', 'animationSpeed', t.animation, t.animationHint, 0.5, 2, 0.25, '×', t.half, t.double)}
      ${toggle('sound', 'soundEnabled', t.sound, t.soundHint)}
      ${toggle('controls', 'controlsVisible', t.controls, t.controlsHint)}
    </section></div><div class="gw-ps-footer">${resetMarkup}<span>${t.saved}</span></div>
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
  readingStyle?: Partial<RenderStyle>,
) {
  let values = { ...initial };
  let beforeReset: PlayerSettingsValues | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let sampleAnimation: Animation | undefined;
  const panel = root.querySelector<HTMLElement>('.gw-ps-panel')!;
  const sample = panel.querySelector<HTMLElement>('[data-sample]');
  if (sample && readingStyle) {
    sample.style.fontFamily = readingStyle.bodyFontFamily || 'inherit';
    sample.style.lineHeight = String(readingStyle.bodyLineHeight || 1.5);
    sample.style.color = readingStyle.bodyColor || 'inherit';
    sample.style.backgroundColor = readingStyle.panelColor || 'transparent';
    sample.style.borderRadius = `${readingStyle.dialogRadius ?? 10}px`;
    sample.style.padding = '8px 12px';
  }
  const locks = new Set<Element>();
  panel.querySelectorAll<HTMLElement>('[data-setting-role]').forEach((row) => {
    row.hidden = ['hidden', 'removed'].includes(row.dataset.panelState || '');
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
    row.hidden = row.dataset.panelState
      ? row.dataset.panelState !== 'visible'
      : element.visible === false;
    const label = row.querySelector<HTMLElement>('[data-role-label]');
    if (label && typeof element.text === 'string') label.textContent = element.text;
    row
      .querySelectorAll<HTMLInputElement | HTMLButtonElement>('input,button')
      .forEach((control) => {
        if (
          element.text &&
          !control.hasAttribute('data-step-setting') &&
          !control.hasAttribute('data-setting-choice')
        )
          control.setAttribute('aria-label', element.text);
        if (element.disabled) {
          control.disabled = true;
          locks.add(control);
        }
      });
  });
  const groups = Array.from(panel.querySelectorAll<HTMLElement>('.gw-ps-group'));
  groups.forEach((group) => {
    group.hidden = Array.from(group.querySelectorAll<HTMLElement>('[data-setting-role]')).every(
      (row) => row.hidden,
    );
  });
  const columns = panel.querySelector<HTMLElement>('.gw-ps-columns');
  if (columns) {
    columns.hidden = groups.every((group) => group.hidden);
    columns.style.gridTemplateColumns =
      groups.filter((group) => !group.hidden).length === 1 ? '1fr' : '';
  }
  // Keep an exit available even if an older template hid its back element.
  const closeButton = panel.querySelector<HTMLElement>('[data-action="close"]');
  if (closeButton) closeButton.hidden = false;
  const replay = () => {
    clearTimeout(timer);
    sampleAnimation?.cancel();
    if (!sample) return;
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
    const readingChanged = values.interactionMode !== next.interactionMode || values.typewriterSpeed !== next.typewriterSpeed || values.animationSpeed !== next.animationSpeed;
    values = { ...next };
    panel
      .querySelectorAll<HTMLInputElement | HTMLButtonElement>('[data-setting]')
      .forEach((control) => {
        const key = control.dataset.setting as keyof PlayerSettingsValues;
        const value = values[key];
        if (control instanceof HTMLInputElement) {
          const sliderValue = control.dataset.invert === 'true' ? Number(control.min) + Number(control.max) - Number(value) : Number(value);
          control.value = String(sliderValue);
          control.style.setProperty(
            '--fill',
            `${((sliderValue - Number(control.min)) / (Number(control.max) - Number(control.min))) * 100}%`,
          );
          control.disabled =
            locks.has(control) ||
            (key === 'typewriterSpeed' && values.interactionMode === 'immediate');
          const output = panel.querySelector<HTMLOutputElement>(`[data-value="${key}"]`);
          const displayValue = control.dataset.invert === 'true' ? (Number(value) <= 50 ? panel.dataset.speedFast : Number(value) <= 110 ? panel.dataset.speedStandard : panel.dataset.speedSlow) || '' : `${value}${output?.dataset.unit || ''}`;
          if (output) output.value = displayValue;
          control.setAttribute('aria-valuetext', displayValue);
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
    panel.querySelectorAll<HTMLButtonElement>('[data-setting-choice]').forEach((button) => {
      button.setAttribute(
        'aria-pressed',
        String(
          values[button.dataset.settingChoice as keyof PlayerSettingsValues] ===
            (button.dataset.choice === 'true'),
        ),
      );
    });
    const modeSelect = panel.querySelector<HTMLSelectElement>('[data-mode-select]');
    if (modeSelect) modeSelect.value = values.interactionMode;
    panel.querySelectorAll<HTMLButtonElement>('[data-step-setting]').forEach((button) => {
      const field = panel.querySelector<HTMLInputElement>(
        `input[data-setting="${button.dataset.stepSetting}"]`,
      )!;
      const current = Number(field.value);
      button.disabled =
        locks.has(button) ||
        field.disabled ||
        (Number(button.dataset.delta) < 0
          ? current <= Number(field.min)
          : current >= Number(field.max));
    });
    panel.querySelectorAll<HTMLButtonElement>('[data-text-scale]').forEach((button) => button.setAttribute('aria-pressed', String(Number(button.dataset.textScale) === values.textScale)));
    if (sample) sample.style.fontSize = readingStyle?.bodyFontSize ? `${(readingStyle.bodyFontSize * values.textScale) / 100}px` : `${(1.1 * values.textScale) / 100}em`;
    if (readingChanged) replay();
  };
  const change = (patch: Partial<PlayerSettingsValues>) => {
    sync({ ...values, ...patch });
    onChange(patch);
    const status = panel.querySelector('[data-status]');
    if (status) status.textContent = panel.dataset.saved!;
  };
  const input = (event: Event) => {
    const field = event.target;
    if (field instanceof HTMLSelectElement && field.hasAttribute('data-mode-select')) {
      if (event.type === 'change') {
        change({ interactionMode: field.value as PlayerSettingsValues['interactionMode'] });
        replay();
      }
      return;
    }
    if (!(field instanceof HTMLInputElement) || !field.dataset.setting || field.disabled) return;
    if ((field.type === 'number') !== (event.type === 'change')) return;
    const raw = field.dataset.invert === 'true' ? Number(field.min) + Number(field.max) - Number(field.value) : Number(field.value);
    if (!field.value || !Number.isFinite(raw)) {
      sync(values);
      return;
    }
    const step = Number(field.step) || 1;
    const value = Math.max(
      Number(field.min),
      Math.min(Number(field.max), Math.round(raw / step) * step),
    );
    change({ [field.dataset.setting]: value });
    if (field.dataset.setting !== 'textScale') replay();
  };
  const click = (event: Event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button');
    if (!button || button.disabled) return;
    if (button.dataset.action === 'close') onClose();
    else if (button.dataset.action === 'replay') replay();
    else if (button.dataset.action === 'reset') {
      beforeReset = { ...values };
      change({ ...defaults });
      replay();
      const status = panel.querySelector('[data-status]');
      if (status) status.textContent = panel.dataset.resetDone!;
      const undo = panel.querySelector<HTMLButtonElement>('[data-action="undo-reset"]');
      if (undo) undo.hidden = false;
    } else if (button.dataset.action === 'undo-reset' && beforeReset) {
      change(beforeReset);
      beforeReset = undefined;
      button.hidden = true;
      const status = panel.querySelector('[data-status]');
      if (status) status.textContent = panel.dataset.undoDone!;
    } else if (button.dataset.textScale) {
      change({ textScale: Number(button.dataset.textScale) });
    } else if (button.dataset.mode) {
      change({ interactionMode: button.dataset.mode as PlayerSettingsValues['interactionMode'] });
      replay();
    } else if (button.dataset.settingChoice) {
      change({ [button.dataset.settingChoice]: button.dataset.choice === 'true' });
    } else if (button.dataset.stepSetting) {
      const field = panel.querySelector<HTMLInputElement>(
        `input[data-setting="${button.dataset.stepSetting}"]`,
      )!;
      const next = Math.max(
        Number(field.min),
        Math.min(
          Number(field.max),
          Number(field.value) + Number(button.dataset.delta) * Number(field.step),
        ),
      );
      change({ [button.dataset.stepSetting]: next });
      if (button.dataset.stepSetting !== 'textScale') replay();
    } else if (button.dataset.setting) {
      const key = button.dataset.setting as keyof PlayerSettingsValues;
      change({ [key]: !values[key] });
    }
  };
  root.addEventListener('input', input);
  root.addEventListener('change', input);
  root.addEventListener('click', click);
  sync(values);
  replay();
  return {
    sync,
    destroy: () => {
      clearTimeout(timer);
      sampleAnimation?.cancel();
      root.removeEventListener('input', input);
      root.removeEventListener('change', input);
      root.removeEventListener('click', click);
    },
  };
}

export const PLAYER_SETTINGS_CSS = `
.gw-archive-slot-list { box-sizing:border-box; width:100%; height:100%; overflow:auto; display:flex; flex-direction:column; gap:8px; padding:12px; color:#334155; text-align:left; }
.gw-archive-slot { box-sizing:border-box; display:flex; flex-direction:column; flex-shrink:0; gap:5px; width:100%; min-height:72px; padding:12px 16px; border:1px solid #e0e5ef; border-radius:10px; background:#fff; color:inherit; text-align:left; font:inherit; cursor:pointer; }
.gw-archive-slot[aria-pressed=true] { border-color:#625bf6; background:#eef2ff; box-shadow:inset 3px 0 #625bf6; }
.gw-archive-slot strong { font-size:18px; font-weight:700; }
.gw-archive-slot span { font-size:15px; color:#59637d; }
.gw-archive-slot:focus-visible { outline:3px solid #625bf6; outline-offset:2px; }
.gw-archive-empty { display:flex; flex-direction:column; justify-content:center; gap:12px; height:100%; padding:20px; }
.gw-archive-empty strong { color:#252a59; font-size:24px; }
.gw-archive-empty span { color:#59637d; font-size:18px; }
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
.gw-ps-preview p { white-space:pre-line; font-weight:500; }
.gw-ps-presets { display:flex; gap:6px; margin-top:8px; }
.gw-ps-presets button { flex:1; min-height:30px; padding:4px 8px; border:1px solid #789ed452; border-radius:7px; background:transparent; color:inherit; font-size:.8em; }
.gw-ps-presets button[aria-pressed=true] { background:#625bf6; color:#fff; border-color:#625bf6; }
.gw-ps-reset { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; height:100%; }
.gw-ps-reset-status { font-size:11px; line-height:1.3; text-align:center; }
.gw-ps-reset-status:empty { display:none; }
.gw-ps-motion { height:3px; overflow:hidden; border-radius:5px; background:#ffffff0d; }
.gw-ps-motion i { display:block; width:33.333%; height:100%; background:#a4c4ff; border-radius:5px; }
.gw-ps-footer { display:flex; align-items:center; justify-content:space-between; gap:16px; padding-top:24px; color:#a9b7cc; font-size:13px; }
.gw-ps-footer button { border:1px solid #ffffff26; background:transparent; padding:10px 14px; border-radius:10px; }

.gw-ps-row,.gw-ps-preview { margin-inline:auto; }
.gw-ps-row { padding-block:max(12px,calc(var(--ps-height,36px) / 2)); }
.gw-ps-label { font-size:var(--ps-size,16px); flex-wrap:wrap; }
.gw-ps-panel button,.gw-ps-panel select,.gw-ps-panel input[type=number] { font-size:var(--ps-size,16px); }
.gw-ps-panel .gw-ps-done,.gw-ps-footer button,.gw-ps-preview-head button { min-height:var(--ps-height,36px); border-radius:var(--ps-radius,10px); }
.gw-ps-segments { border-radius:var(--ps-radius,10px); }
.gw-ps-segments button { min-height:var(--ps-height,36px); border-radius:max(0px,calc(var(--ps-radius,10px) - 3px)); white-space:normal; overflow-wrap:anywhere; }
.gw-ps-row input[type=range] { height:var(--ps-height,36px); margin:10px 0 0; background-size:100% 6px; background-repeat:no-repeat; background-position:center; }
.gw-ps-select { display:block; width:100%; height:var(--ps-height,36px); margin-top:12px; padding-inline:12px; border:1px solid #ffffff30; border-radius:var(--ps-radius,10px); color:inherit; background:#17263c; }
.gw-ps-toggle-row { flex-wrap:wrap; }
.gw-ps-panel .gw-ps-toggle { min-height:var(--ps-height,36px); font-size:var(--ps-size,16px)!important; }
.gw-ps-toggle i { height:clamp(20px,calc(var(--ps-height,36px) * .65),40px); width:clamp(36px,calc(var(--ps-height,36px) * 1.2),74px); }
.gw-ps-toggle i::after { height:100%; width:auto; aspect-ratio:1; }
.gw-ps-toggle[aria-checked=true] i::after { transform:translateX(calc(clamp(36px,calc(var(--ps-height,36px) * 1.2),74px) - clamp(20px,calc(var(--ps-height,36px) * .65),40px))); }
.gw-ps-stepper { display:grid; grid-template-columns:var(--ps-height,36px) minmax(0,1fr) auto var(--ps-height,36px); align-items:center; margin-top:14px; min-height:var(--ps-height,36px); overflow:hidden; border:1px solid #ffffff30; border-radius:var(--ps-radius,10px); background:#ffffff09; }
.gw-ps-stepper button { align-self:stretch; min-height:var(--ps-height,36px); border:0; background:#ffffff0c; }
.gw-ps-stepper input { width:100%; min-width:0; color:inherit; text-align:center; background:transparent; border:0; padding:6px; appearance:textfield; }
.gw-ps-stepper input::-webkit-inner-spin-button,.gw-ps-stepper input::-webkit-outer-spin-button { appearance:none; margin:0; }
.gw-ps-stepper>span { padding-right:8px; font-size:12px; color:#a9b7cc; }
.gw-ps-panel[data-appearance=filled] .gw-ps-segments,.gw-ps-panel[data-appearance=filled] .gw-ps-done,.gw-ps-panel[data-appearance=filled] .gw-ps-stepper,.gw-ps-panel[data-appearance=filled] .gw-ps-footer button,.gw-ps-panel[data-appearance=filled] .gw-ps-select { background:#2b4368; border-color:#789ed452; }
.gw-ps-panel[data-appearance=outline] .gw-ps-segments,.gw-ps-panel[data-appearance=outline] .gw-ps-done,.gw-ps-panel[data-appearance=outline] .gw-ps-stepper,.gw-ps-panel[data-appearance=outline] .gw-ps-footer button,.gw-ps-panel[data-appearance=outline] .gw-ps-select { background:transparent; border:1px solid #a8caff65; }
.gw-ps-panel[data-appearance=outline] .gw-ps-segments button[aria-pressed=true] { background:#a8caff1c; box-shadow:inset 0 0 0 1px #a8caff; }
 .gw-ps-footer [data-setting-role=reset] button { width:100%; }
.gw-ps-panel[data-appearance=outline] .gw-ps-toggle i { box-shadow:inset 0 0 0 1px #a8caff; }
.gw-ps-panel[data-appearance=filled] .gw-ps-preview-head button { background:#2b4368; padding-inline:10px; }
 .gw-ps-widget-surface { width:100%; height:100%; position:relative; }
.gw-ps-panel.gw-ps-widget { white-space:normal; font:inherit; color:inherit; width:100%; height:100%; max-height:none; padding:12px 16px; overflow:auto; border:0; border-radius:inherit; background:transparent; box-shadow:none; }
.gw-ps-widget .gw-ps-row,.gw-ps-widget .gw-ps-preview { padding:0; border:0; background:transparent; margin:0; box-shadow:none; }
.gw-ps-widget .gw-ps-label { color:inherit; font-weight:inherit; }
.gw-ps-widget-surface { z-index:1; }
.gw-ps-widget .gw-ps-hint { color:inherit; opacity:.85; font-size:.8em; }
.gw-ps-widget [data-setting-role=reset]>button { width:100%; min-height:28px; padding:3px 6px; border:0; background:transparent; color:inherit; }
.gw-ps-widget [data-action=undo-reset] { font-size:13px; text-decoration:underline; }
.gw-ps-widget .gw-ps-toggle-row { min-height:100%; }
.gw-ps-panel.gw-ps-widget { overflow:auto; padding:14px 18px; color-scheme:light; }
.gw-ps-widget .gw-ps-row { padding:0; }
.gw-ps-widget .gw-ps-label { line-height:1.2; }
.gw-ps-widget .gw-ps-hint { margin-top:5px; line-height:1.4; white-space:normal; }
.gw-ps-widget .gw-ps-row input[type=range] { height:32px; margin:4px 0 0; background-size:100% 5px; background-image:linear-gradient(to right,#625bf6 var(--fill,50%),#cbd5e1 var(--fill,50%)); }
.gw-ps-widget input[type=range]::-webkit-slider-thumb { width:22px; height:22px; border-color:#625bf6; box-shadow:0 2px 6px #252a5920; }
.gw-ps-widget input[type=range]::-moz-range-thumb { width:16px; height:16px; border-color:#625bf6; }
.gw-ps-widget .gw-ps-scale { font-size:.7em; line-height:1.3; color:inherit; opacity:.8; }
.gw-ps-widget .gw-ps-label output { color:inherit; background:#64748b0d; border-color:#64748b26; min-width:64px; padding:2px 8px; font-size:.85em; }
.gw-ps-widget .gw-ps-segments { background:#64748b14; margin-top:8px; }
.gw-ps-widget .gw-ps-segments button { color:inherit; min-height:32px; padding:6px 10px; font-size:.85em; }
.gw-ps-widget .gw-ps-segments button[aria-pressed=true] { color:#fff; background:#625bf6; box-shadow:0 2px 5px #252a5920; }
.gw-ps-widget .gw-ps-toggle i { background:#94a3b8; }
.gw-ps-widget .gw-ps-toggle[aria-checked=true] i { background:#625bf6; }
.gw-ps-widget .gw-ps-stepper { background:#64748b0d; border-color:#64748b26; margin-top:8px; }
.gw-ps-widget .gw-ps-stepper button { background:#64748b14; }
.gw-ps-widget .gw-ps-stepper>span { color:inherit; }
.gw-ps-widget .gw-ps-select { color:inherit; background:#64748b0d; border-color:#64748b26; }
.gw-ps-widget button:focus-visible,.gw-ps-widget input:focus-visible,.gw-ps-widget select:focus-visible { outline-color:#625bf6; outline-offset:2px; }
.gw-ps-widget button:hover:not(:disabled) { filter:none; background-color:#625bf61a; }
.gw-ps-widget .gw-ps-segments button[aria-pressed=true]:hover,.gw-ps-widget .gw-ps-presets button[aria-pressed=true]:hover { background:#4f46e5; }
.gw-ps-widget .gw-ps-preview { margin:0; padding:0; border:0; background:transparent; }
.gw-ps-widget .gw-ps-preview-head { font-size:.75em; color:inherit; }
.gw-ps-widget .gw-ps-preview-head button { min-height:28px; padding:2px 8px; font-size:inherit; color:#4338ca; background:#eef2ff; }
.gw-ps-widget .gw-ps-preview p { margin:8px 0; min-height:3em; line-height:1.5; color:inherit; }
.gw-ps-widget .gw-ps-motion { background:#e0e5ef; }
.gw-ps-widget .gw-ps-motion i { background:#625bf6; }
@container (max-width:700px) { .gw-ps-panel { padding:20px; border-radius:18px; } .gw-ps-columns { grid-template-columns:1fr; } .gw-ps-head h2 { font-size:24px; } .gw-ps-group { padding:16px; } .gw-ps-footer { flex-wrap:wrap; } }
@media (prefers-reduced-motion:reduce) { .gw-ps-toggle i::after { transition:none; } }
`;
