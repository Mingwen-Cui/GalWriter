import type { Language } from '../../../lib/i18n';

export function webToolbarButtonLabel(
  role: string | undefined,
  text: string,
  language: Language,
  fullscreen: boolean,
  hidden: boolean,
  auto: boolean,
  defaultAuto = false,
): string {
  const labels =
    language === 'zh'
      ? {
          menu: '主菜单',
          back: '回退',
          hide: '隐藏控制栏',
          show: '显示控制栏',
          maximize: '最大化',
          minimize: '最小化',
          auto: '自动播放',
          stop: '停止自动播放',
        }
      : language === 'ja'
        ? {
            menu: 'メニュー',
            back: '戻る',
            hide: '操作を隠す',
            show: '操作を表示',
            maximize: '最大化',
            minimize: '最小化',
            auto: '自動再生',
            stop: '自動再生を停止',
          }
        : {
            menu: 'Menu',
            back: 'Back',
            hide: 'Hide controls',
            show: 'Show controls',
            maximize: 'Maximize',
            minimize: 'Minimize',
            auto: 'Auto play',
            stop: 'Stop auto play',
          };
  if (role === 'mainMenu') return labels.menu;
  if (role === 'return') return labels.back;
  if (role === 'controlsToggle') return hidden ? labels.show : labels.hide;
  if (role === 'fullscreen') return fullscreen ? labels.minimize : labels.maximize;
  if (role === 'auto' && defaultAuto) return auto ? labels.stop : labels.auto;
  return text;
}

export function webPlaybackCopy(language: Language) {
  return language === 'zh'
    ? {
        history: '对话历史',
        empty: '尚无对话记录',
        close: '关闭',
        jump: '回到此处',
        audio: '播放语音',
        ended: '试玩已结束',
        title: '故事终点',
        description: '此分支已结束。要重新开始吗？',
        restart: '重新开始',
        menu: '返回主界面',
      }
    : language === 'ja'
      ? {
          history: '会話履歴',
          empty: '会話履歴はまだありません',
          close: '閉じる',
          jump: 'ここに戻る',
          audio: '音声を再生',
          ended: 'テスト終了',
          title: 'ストーリー終了',
          description: 'この分岐は終了しました。再開しますか？',
          restart: 'やり直す',
          menu: 'メインへ戻る',
        }
      : {
          history: 'Dialogue history',
          empty: 'No dialogue yet',
          close: 'Close',
          jump: 'Return here',
          audio: 'Play voice',
          ended: 'PLAYTEST ENDED',
          title: 'Story End',
          description: 'This branch has ended. Restart?',
          restart: 'Restart',
          menu: 'Main menu',
        };
}

// A missing card title is not player-facing story content.
export function webStoryTitle(value: unknown): string {
  const title = typeof value === 'string' ? value.trim() : '';
  return /^(untitled|未命名|无标题|無題)$/i.test(title) ? '' : title;
}

export type WebHistoryEntry = { index: number; title: string; text: string; audioUrl?: string };

// Kept self-contained so the exported player runs the same modal implementation.
export function mountWebHistory(
  host: HTMLElement,
  entries: WebHistoryEntry[],
  copy: ReturnType<typeof webPlaybackCopy>,
  onClose: () => void,
  onJump: (index: number) => void,
  onAudio: (index: number) => void,
) {
  const previousFocus = document.activeElement as HTMLElement | null;
  host.className = 'gw-history-backdrop';
  const panel = document.createElement('section');
  panel.className = 'gw-history-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', copy.history);
  const head = document.createElement('header');
  head.className = 'gw-history-head';
  const heading = document.createElement('h2');
  heading.textContent = copy.history;
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '×';
  close.setAttribute('aria-label', copy.close);
  close.onclick = onClose;
  head.append(heading, close);
  const list = document.createElement('div');
  list.className = 'gw-history-list';
  if (!entries.length) list.textContent = copy.empty;
  entries.forEach((entry) => {
    const row = document.createElement('article');
    if (entry.title) {
      const title = document.createElement('h3');
      title.textContent = entry.title;
      row.append(title);
    }
    const text = document.createElement('p');
    text.textContent = entry.text;
    row.append(text);
    const actions = document.createElement('div');
    actions.className = 'gw-history-actions';
    const jump = document.createElement('button');
    jump.type = 'button';
    jump.textContent = copy.jump;
    jump.onclick = () => onJump(entry.index);
    actions.append(jump);
    if (entry.audioUrl) {
      const audio = document.createElement('button');
      audio.type = 'button';
      audio.textContent = copy.audio;
      audio.onclick = () => onAudio(entry.index);
      actions.append(audio);
    }
    row.append(actions);
    list.append(row);
  });
  panel.append(head, list);
  host.replaceChildren(panel);
  host.onclick = (event) => {
    event.stopPropagation();
    if (event.target === host) onClose();
  };
  host.onkeydown = (event) => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
    if (event.key !== 'Tab') return;
    const buttons = Array.from(panel.querySelectorAll('button'));
    const first = buttons[0],
      last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };
  close.focus();
  list.scrollTop = list.scrollHeight;
  return () => {
    host.replaceChildren();
    host.onclick = null;
    host.onkeydown = null;
    previousFocus?.focus();
  };
}

export function mountWebEnding(
  host: HTMLElement,
  copy: ReturnType<typeof webPlaybackCopy>,
  hasMenu: boolean,
  restart: () => void,
  close: () => void,
) {
  host.className = 'gw-ending';
  host.innerHTML =
    '<section class="gw-ending-card" role="dialog" aria-modal="true"><div class="gw-ending-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="m10 8 6 4-6 4z"/></svg></div><p class="gw-ending-eyebrow"></p><h2></h2><p class="gw-ending-description"></p><div class="gw-ending-actions"><button type="button" class="gw-ending-restart"></button><button type="button" class="gw-ending-close"></button></div></section>';
  host.querySelector('.gw-ending-card')!.setAttribute('aria-label', copy.title);
  host.querySelector('.gw-ending-eyebrow')!.textContent = copy.ended;
  host.querySelector('h2')!.textContent = copy.title;
  host.querySelector('.gw-ending-description')!.textContent = copy.description;
  const restartButton = host.querySelector<HTMLButtonElement>('.gw-ending-restart')!;
  const closeButton = host.querySelector<HTMLButtonElement>('.gw-ending-close')!;
  restartButton.textContent = copy.restart;
  closeButton.textContent = hasMenu ? copy.menu : copy.close;
  restartButton.onclick = restart;
  closeButton.onclick = close;
  host.onclick = (event) => event.stopPropagation();
  host.onkeydown = (event) => {
    event.stopPropagation();
    if (event.key === 'Escape') close();
    if (event.key === 'Tab') {
      event.preventDefault();
      (document.activeElement === restartButton ? closeButton : restartButton).focus();
    }
  };
  restartButton.focus();
  return () => {
    host.replaceChildren();
    host.onclick = null;
    host.onkeydown = null;
  };
}

export const WEB_PLAYBACK_UI_CSS = `
.gw-playback-control { min-height:0; max-height:none; min-width:0; box-sizing:border-box; aspect-ratio:1; padding:0!important; display:inline-flex; align-items:center; justify-content:center; border-radius:9999px!important; border:0!important; background:#f1f5f9!important; color:#475569!important; box-shadow:none!important; font-weight:700; line-height:1; transition:background .15s,transform .15s; }
.gw-playback-control > .gw-playback-control-content { min-width:0; padding:0!important; width:100%; height:100%; display:flex; align-items:center; justify-content:center; }
[data-virtual-presentation-host]:fullscreen { width:100vw!important; height:100vh!important; max-width:none!important; max-height:none!important; background:#020617; }
.gw-playback-control-with-label { aspect-ratio:auto; }
.gw-playback-control-with-label > .gw-playback-control-content { padding:0 14px!important; gap:8px; }
.gw-playback-label { display:block; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; line-height:1.25; }
.gw-playback-settings { position:absolute; inset:0; z-index:410; display:grid; place-items:center; padding:24px; background:#020617aa; backdrop-filter:blur(8px); }
.gw-playback-settings > div { width:min(860px,100%); max-height:100%; overflow:auto; border-radius:24px; }
.gw-playback-settings > .gw-ps-surface { position:relative; inset:auto; display:block; padding:0; }
.gw-playback-settings [hidden] { display:none!important; }
.gw-playback-settings .gw-ps-columns:has(.gw-ps-group:first-child > [data-setting-role]:not([hidden])):not(:has(.gw-ps-group:last-child > [data-setting-role]:not([hidden]))),.gw-playback-settings .gw-ps-columns:not(:has(.gw-ps-group:first-child > [data-setting-role]:not([hidden]))) { grid-template-columns:minmax(0,1fr); }
.gw-playback-settings .gw-ps-group:not(:has(> [data-setting-role]:not([hidden]))) { display:none; }
.gw-playback-control:hover { background:#e2e8f0!important; }
.gw-playback-control:active { transform:scale(.95); }
.gw-playback-control:disabled { background:#f1f5f9!important; color:#94a3b8!important; filter:grayscale(1); cursor:default; }
.gw-playback-control[aria-pressed=true] { background:#e0e7ff!important; color:#4f46e5!important; }
.gw-playback-control-content > svg { display:block; width:var(--gw-toolbar-icon-size,20px); height:var(--gw-toolbar-icon-size,20px); max-width:65%; max-height:65%; flex-shrink:0; }
.gw-playback-control:focus-visible,.gw-history-backdrop button:focus-visible,.gw-ending button:focus-visible { outline:2px solid #7dd3fc; outline-offset:3px; }
.gw-history-backdrop { position:absolute; inset:0; z-index:400; display:flex; align-items:center; justify-content:center; padding:24px; background:rgba(2,6,23,.65); backdrop-filter:blur(8px); color:#fff; }
.gw-history-panel { width:min(640px,100%); max-height:90%; display:flex; flex-direction:column; overflow:hidden; border:1px solid #ffffff1f; border-radius:24px; background:#020617f0; box-shadow:0 24px 72px #0008; }
.gw-history-head { position:static!important; display:flex!important; flex-shrink:0; align-items:center; justify-content:space-between; padding:20px 24px!important; background:transparent!important; }
.gw-history-head h2 { margin:0; font-size:18px; font-weight:800; }
.gw-history-head button { width:32px; height:32px; border-radius:50%; background:#ffffff12; color:#fff; border:0; cursor:pointer; font-size:24px; }
.gw-history-list { overflow:auto; overscroll-behavior:contain; padding:0 24px 24px; min-height:0; }
.gw-history-list article { padding:18px 0; border-top:1px solid #ffffff14; }
.gw-history-list h3 { color:#bae6fd; margin:0 0 8px; font-size:14px; }
.gw-history-list p { white-space:pre-wrap; overflow-wrap:anywhere; font-size:15px; line-height:1.8; margin:0; }
.gw-history-actions { display:flex; gap:12px; margin-top:12px; }
.gw-history-actions button { border:0; border-radius:8px; padding:7px 12px; color:#bae6fd; background:#0ea5e922; cursor:pointer; font-size:12px; }
.gw-ending { position:absolute; inset:0; z-index:230; display:flex; align-items:center; justify-content:center; overflow:auto; padding:24px; text-align:center; background:linear-gradient(#0206174d,#0206178c,#020617d9); backdrop-filter:blur(3px); }
.gw-ending-card { position:relative; width:min(512px,100%); max-height:100%; overflow:auto; border-radius:32px; padding:40px 28px; color:#fff; background:#020617a6; box-shadow:0 24px 72px #0206176b; backdrop-filter:blur(40px); }
.gw-ending-icon { display:grid; place-items:center; margin:auto; width:48px; height:48px; border-radius:50%; background:#38bdf81f; color:#bae6fd; }
.gw-ending-eyebrow { margin:24px 0 0; font-size:12px; font-weight:700; letter-spacing:.18em; color:#e0f2feb3; }
.gw-ending h2 { margin:12px 0 0; font-size:36px; line-height:1.2; font-weight:900; letter-spacing:-.025em; }
.gw-ending-description { margin:16px auto 0; font-size:15px; line-height:24px; color:#e2e8f0bf; }
.gw-ending-actions { display:flex; flex-direction:column; align-items:center; gap:12px; margin-top:36px; }
.gw-ending button { border:0; cursor:pointer; font-size:14px; font-weight:800; }
.gw-ending-restart { border-radius:12px; padding:14px 28px; background:#0ea5e9; color:#fff; box-shadow:0 10px 15px #0ea5e933; }
.gw-ending-restart:hover { background:#38bdf8; }
.gw-ending-close { padding:8px 16px; background:transparent; color:#cbd5e1; }
@media(max-height:500px) { .gw-ending-card { padding:20px; } .gw-ending-icon { width:36px; height:36px; } .gw-ending-eyebrow,.gw-ending-actions { margin-top:16px; } .gw-ending h2 { font-size:28px; } }
`;
