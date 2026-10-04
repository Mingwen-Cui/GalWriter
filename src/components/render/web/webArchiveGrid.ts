import type { Language } from '../../../lib/i18n';

export type WebArchiveCard = {
  id: string;
  title: string;
  savedAt: number;
  thumbnail?: string;
};

export function captureWebArchiveThumbnail(root: HTMLElement | null, imageUrl: string, videoUrl: string) {
  if (!root) return imageUrl || undefined;
  const absolute = (url: string) => url ? new URL(url, window.location.href).href : '';
  const image = Array.from(root.querySelectorAll('img')).find((item) => item.src === absolute(imageUrl));
  const video = Array.from(root.querySelectorAll('video')).find((item) => item.src === absolute(videoUrl));
  const source = image || video;
  if (source) {
    try {
      const width = image ? image.naturalWidth : video!.videoWidth;
      const height = image ? image.naturalHeight : video!.videoHeight;
      if (width && height) {
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(480, width); canvas.height = Math.max(1, Math.round(canvas.width * height / width));
        const context = canvas.getContext('2d');
        if (context) {
          context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(source, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL('image/jpeg', 0.75);
        }
      }
    } catch { /* A cross-origin scene still has its original image URL as a fallback. */ }
  }
  return imageUrl || undefined;
}

// Self-contained: the offline player embeds this controller as JavaScript.
export function mountWebArchiveGrid(
  root: HTMLElement,
  cards: WebArchiveCard[],
  language: Language,
  onPlay: (id: string) => void,
  onDelete: (id: string) => void,
  interactive = true,
) {
  const copy = language === 'zh'
    ? { empty: '还没有存档', hint: '开始故事后，你的阅读进度会保存在这里。', play: '播放存档', remove: '删除存档', confirm: '确定删除这个存档吗？', cancel: '取消', yes: '删除' }
    : language === 'ja'
      ? { empty: 'セーブはまだありません', hint: '物語を始めると、ここに進行状況が保存されます。', play: 'セーブを再生', remove: 'セーブを削除', confirm: 'このセーブを削除しますか？', cancel: 'キャンセル', yes: '削除' }
      : { empty: 'No saves yet', hint: 'Your reading progress will appear here after you start.', play: 'Play save', remove: 'Delete save', confirm: 'Delete this save?', cancel: 'Cancel', yes: 'Delete' };
  root.replaceChildren();
  root.className = 'gw-archive-slot-list';
  if (!cards.length) {
    const empty = document.createElement('div'); empty.className = 'gw-archive-empty';
    const title = document.createElement('strong'); title.textContent = copy.empty;
    const hint = document.createElement('span'); hint.textContent = copy.hint;
    empty.append(title, hint); root.append(empty);
  }
  let dialog: HTMLDialogElement | undefined;
  const dismiss = () => { dialog?.close(); dialog?.remove(); dialog = undefined; };
  cards.forEach((card) => {
    const article = document.createElement('article'); article.className = 'gw-archive-slot';
    const picture = document.createElement('div'); picture.className = 'gw-archive-picture';
    if (card.thumbnail) {
      const image = document.createElement('img'); image.src = card.thumbnail; image.alt = card.title; image.loading = 'lazy';
      image.addEventListener('error', () => image.remove()); picture.append(image);
    }
    const play = document.createElement('button'); play.type = 'button'; play.className = 'gw-archive-play';
    play.setAttribute('aria-label', copy.play + ' · ' + card.title); play.title = copy.play;
    play.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7Z" fill="currentColor"/></svg>';
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'gw-archive-delete';
    remove.setAttribute('aria-label', copy.remove + ' · ' + card.title); remove.title = copy.remove;
    remove.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7"/></svg>';
    play.disabled = remove.disabled = !interactive;
    play.addEventListener('click', (event) => { event.stopPropagation(); onPlay(card.id); });
    remove.addEventListener('click', (event) => {
      event.stopPropagation(); dismiss();
      dialog = document.createElement('dialog'); dialog.className = 'gw-archive-confirm';
      dialog.setAttribute('aria-label', copy.confirm);
      dialog.addEventListener('keydown', (keyEvent) => keyEvent.stopPropagation());
      dialog.addEventListener('click', (clickEvent) => clickEvent.stopPropagation());
      dialog.addEventListener('pointerdown', (pointerEvent) => pointerEvent.stopPropagation());
      const heading = document.createElement('h3'); heading.textContent = copy.confirm;
      const detail = document.createElement('p'); detail.textContent = card.title;
      const actions = document.createElement('div');
      const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = copy.cancel;
      const yes = document.createElement('button'); yes.type = 'button'; yes.textContent = copy.yes; yes.className = 'gw-archive-confirm-delete';
      cancel.addEventListener('click', dismiss);
      yes.addEventListener('click', () => { dismiss(); onDelete(card.id); });
      dialog.addEventListener('cancel', (cancelEvent) => { cancelEvent.preventDefault(); dismiss(); });
      actions.append(cancel, yes); dialog.append(heading, detail, actions); root.append(dialog);
      dialog.showModal(); cancel.focus();
    });
    picture.append(play, remove);
    const meta = document.createElement('div'); meta.className = 'gw-archive-meta';
    const title = document.createElement('strong'); title.textContent = card.title;
    const date = document.createElement('span'); date.textContent = new Date(card.savedAt).toLocaleString();
    meta.append(title, date); article.append(picture, meta); root.append(article);
  });
  return { destroy: dismiss };
}

export const WEB_ARCHIVE_GRID_CSS = `
.gw-archive-slot-list { box-sizing:border-box; width:100%; height:100%; overflow:auto; display:grid; grid-template-columns:repeat(auto-fill,minmax(min(100%,220px),1fr)); align-content:start; gap:20px; padding:6px; color:var(--gw-ink,#252a59); text-align:left; scrollbar-width:thin; }
.gw-archive-slot { position:relative; min-width:0; overflow:hidden; border:1px solid var(--gw-edge,#e0e5ef); border-radius:16px; background:var(--gw-panel,#fff); box-shadow:0 5px 16px #252a5910; }
.gw-archive-picture { position:relative; width:100%; aspect-ratio:16/9; overflow:hidden; background:linear-gradient(145deg,#dfe5f8,#f6f0fb 50%,#d6e6ef); }
.gw-archive-picture img { width:100%; height:100%; object-fit:cover; display:block; }
.gw-archive-picture button { position:absolute; display:grid; place-items:center; padding:0; cursor:pointer; border:1px solid #ffffff80; color:#fff; background:#111827a8; box-shadow:0 3px 12px #0002; }
.gw-archive-picture button:disabled { cursor:default; }
.gw-archive-play { left:50%; top:50%; transform:translate(-50%,-50%); width:48px; height:48px; border-radius:50%; }
.gw-archive-play svg { width:26px; height:26px; }
.gw-archive-delete { right:8px; top:8px; width:30px; height:30px; border-radius:9px; }
.gw-archive-delete svg { width:18px; height:18px; }
.gw-archive-meta { display:flex; flex-direction:column; gap:5px; padding:12px 14px; }
.gw-archive-meta strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:16px; }
.gw-archive-meta span { color:var(--gw-muted,#68719a); font-size:13px; }
.gw-archive-empty { grid-column:1/-1; display:flex; flex-direction:column; justify-content:center; align-items:center; gap:12px; min-height:220px; padding:20px; text-align:center; }
.gw-archive-empty strong { font-size:24px; }
.gw-archive-empty span { color:var(--gw-muted,#68719a); font-size:18px; }
.gw-archive-confirm { width:min(360px,calc(100vw - 48px)); box-sizing:border-box; padding:24px; border:1px solid #e0e5ef; border-radius:20px; background:#fff; color:#252a59; font:16px/1.5 system-ui,sans-serif; box-shadow:0 20px 70px #0003; }
.gw-archive-confirm::backdrop { background:#11182766; }
.gw-archive-confirm h3 { margin:0 0 10px; font-size:20px; }
.gw-archive-confirm p { margin:0 0 24px; overflow-wrap:anywhere; color:#68719a; }
.gw-archive-confirm>div { display:flex; justify-content:flex-end; gap:12px; }
.gw-archive-confirm button { padding:8px 20px; border:1px solid #e0e5ef; border-radius:10px; background:#f5f6fc; color:#252a59; font:inherit; cursor:pointer; }
.gw-archive-confirm .gw-archive-confirm-delete { background:#e11d48; color:white; border-color:#e11d48; }
.gw-archive-slot-list button:focus-visible { outline:3px solid #625bf6; outline-offset:3px; }
`;
