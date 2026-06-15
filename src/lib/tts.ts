export type TTSConfig = {
  provider: string;
  apiUrl: string;
  apiKey: string;
  appKey?: string;
  appSecret?: string;
  model: string;
  voice: string;
  speed?: string;
  volume?: string;
};

const DEFAULT_TTS_ENDPOINT = 'https://api.openai.com/v1/audio/speech';
const YOUDAO_TTS_ENDPOINT = 'https://openapi.youdao.com/ttsapi';

export const normalizeTtsApiUrl = (apiUrl: string) => {
  const raw = apiUrl.trim();
  if (!raw) return DEFAULT_TTS_ENDPOINT;
  if (/\/audio\/speech\/?$/i.test(raw)) return raw.replace(/\/$/, '');
  if (/\/v1\/?$/i.test(raw)) return `${raw.replace(/\/$/, '')}/audio/speech`;
  return raw;
};

export const htmlToSpeechText = (html: string) => {
  const normalize = (text: string) =>
    text
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t\f\v]+/g, ' ')
      .replace(/\s*\n\s*/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

  if (typeof document === 'undefined') {
    return normalize(
      html
        .replace(
          /<(script|style|svg|img|video|audio|source|canvas|button|select|option|input|textarea)\b[^>]*>[\s\S]*?<\/\1>/gi,
          ' ',
        )
        .replace(
          /<(img|video|audio|source|canvas|button|select|option|input|textarea)\b[^>]*\/?>/gi,
          ' ',
        )
        .replace(/<\s*br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, '\n')
        .replace(/<[^>]*>/g, ' '),
    );
  }

  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  doc
    .querySelectorAll(
      'script, style, svg, img, video, audio, source, canvas, button, select, option, input, textarea',
    )
    .forEach((element) => element.remove());
  doc.querySelectorAll<HTMLElement>('.mention-chip').forEach((mention) => {
    mention.textContent =
      mention.dataset.mentionName || mention.textContent?.replace(/^@/, '') || '';
  });
  doc.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));

  return normalize(doc.body.textContent || '');
};

export const stripTagsFromSpeechText = (text: string) =>
  text
    .replace(/\{\{\s*(?:character|scene)\s*:[^}]+\}\}/gi, ' ')
    .replace(/@[\p{L}\p{N}_·・.-]+/gu, ' ')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export const htmlToTagFreeSpeechText = (html: string) => {
  if (!html) return '';

  if (typeof DOMParser === 'undefined') {
    const withoutMentions = html
      .replace(
        /<span\b[^>]*(?:class=(?:"[^"]*\bmention-chip\b[^"]*"|'[^']*\bmention-chip\b[^']*')|data-mention-(?:kind|name)=(?:"[^"]*"|'[^']*'))[^>]*>[\s\S]*?<\/span>/gi,
        ' ',
      )
      .replace(
        /&lt;span\b[\s\S]*?(?:mention-chip|data-mention-(?:kind|name))[\s\S]*?&gt;[\s\S]*?&lt;\/span&gt;/gi,
        ' ',
      );
    return stripTagsFromSpeechText(htmlToSpeechText(withoutMentions));
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc
    .querySelectorAll('.mention-chip, [data-mention-kind], [data-mention-name]')
    .forEach((mention) => mention.remove());
  return stripTagsFromSpeechText(htmlToSpeechText(doc.body.innerHTML));
};

const sha256Hex = async (text: string) => {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const truncateForYoudaoSign = (text: string) => {
  const chars = Array.from(text);
  if (chars.length <= 20) return text;
  return `${chars.slice(0, 10).join('')}${chars.length}${chars.slice(-10).join('')}`;
};

const normalizeYoudaoError = async (response: Response) => {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await response.json().catch(() => null);
    if (data?.errorCode) return `Youdao TTS error ${data.errorCode}`;
    return JSON.stringify(data || {});
  }
  return await response.text();
};

const generateYoudaoSpeechAudio = async (input: string, config: TTSConfig) => {
  const appKey = (config.appKey || config.model || '').trim();
  const appSecret = (config.appSecret || config.apiKey || '').trim();
  const voiceName = config.voice.trim() || 'youxiaoqin';
  const endpoint = config.apiUrl.trim() || YOUDAO_TTS_ENDPOINT;

  if (!appKey) {
    throw new Error('Youdao application ID is missing.');
  }
  if (!appSecret) {
    throw new Error('Youdao application secret is missing.');
  }

  const salt = crypto.randomUUID();
  const curtime = Math.floor(Date.now() / 1000).toString();
  const signInput = truncateForYoudaoSign(input);
  const sign = await sha256Hex(`${appKey}${signInput}${salt}${curtime}${appSecret}`);
  const params = new URLSearchParams({
    q: input,
    appKey,
    salt,
    sign,
    signType: 'v3',
    curtime,
    format: 'mp3',
    voiceName,
  });

  const speed = (config.speed || '').trim();
  const volume = (config.volume || '').trim();
  if (speed) params.set('speed', speed);
  if (volume) params.set('volume', volume);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: params,
  });

  const contentType = response.headers.get('content-type') || '';
  if (!response.ok || contentType.includes('application/json')) {
    throw new Error(
      (await normalizeYoudaoError(response)) ||
        `Youdao TTS request failed with HTTP ${response.status}`,
    );
  }

  const blob = await response.blob();
  return {
    blob,
    url: URL.createObjectURL(blob),
  };
};

const generateSystemSpeechAudio = async (input: string) => {
  const tauriCore = await import('@tauri-apps/api/core');
  const invoke =
    tauriCore.invoke ||
    (tauriCore as any).default?.invoke ||
    (window as any).__TAURI__?.core?.invoke;
  if (!invoke) {
    throw new Error('System voice is only available in the GalWriter App.');
  }
  const bytes = (await invoke('synthesize_system_speech', { text: input })) as number[];
  const blob = new Blob([new Uint8Array(bytes)], { type: 'audio/wav' });
  return {
    blob,
    url: URL.createObjectURL(blob),
  };
};

export async function generateSpeechAudio(text: string, config: TTSConfig) {
  const input = stripTagsFromSpeechText(text);
  if (!input) {
    throw new Error('No text to synthesize.');
  }

  if (config.provider === 'system') {
    return generateSystemSpeechAudio(input);
  }

  if (config.provider === 'youdao') {
    return generateYoudaoSpeechAudio(input, config);
  }

  if (!config.apiKey.trim()) {
    throw new Error('TTS API key is missing.');
  }

  const response = await fetch(normalizeTtsApiUrl(config.apiUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: config.model.trim() || 'gpt-4o-mini-tts',
      voice: config.voice.trim() || 'alloy',
      input,
      response_format: 'mp3',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `TTS request failed with HTTP ${response.status}`);
  }

  const blob = await response.blob();
  return {
    blob,
    url: URL.createObjectURL(blob),
  };
}
