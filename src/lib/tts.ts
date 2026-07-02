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
const HOSTED_TTS_PROXY_ENDPOINT = 'api/proxy.php';
const VOLCENGINE_TTS_ENDPOINT = 'https://openspeech.bytedance.com/api/v3/tts/unidirectional';

export const normalizeTtsApiUrl = (apiUrl: string) => {
  const raw = apiUrl.trim();
  if (!raw) return DEFAULT_TTS_ENDPOINT;
  if (/\/audio\/speech\/?$/i.test(raw)) return raw.replace(/\/$/, '');
  if (/\/v1\/?$/i.test(raw)) return `${raw.replace(/\/$/, '')}/audio/speech`;
  return raw;
};

const normalizeVolcengineTtsEndpoint = (apiUrl: string) => {
  const raw = apiUrl.trim();
  if (!raw) return VOLCENGINE_TTS_ENDPOINT;
  if (
    /^wss?:\/\//i.test(raw) ||
    /openspeech\.bytedance\.com\/api\/v3\/tts\/.*\/sse\/?$/i.test(raw) ||
    /openspeech\.bytedance\.com\/api\/v3\/tts\/bidirection\/?$/i.test(raw) ||
    /openspeech\.bytedance\.com\/api\/v3\/tts\/unidirectional\/stream\/?$/i.test(raw)
  ) {
    return VOLCENGINE_TTS_ENDPOINT;
  }
  return raw;
};

const getVolcengineTtsRequestEndpoint = (apiUrl: string) => {
  const endpoint = normalizeVolcengineTtsEndpoint(apiUrl);
  if (import.meta.env.DEV && /openspeech\.bytedance\.com\/api\/v3\/tts\/unidirectional\/?$/i.test(endpoint)) {
    return '/api/volcengine-tts';
  }
  return endpoint;
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

const getTauriInvoke = async () => {
  const runtimeWindow = typeof window === 'undefined' ? undefined : (window as any);
  const globalInvoke = runtimeWindow?.__TAURI__?.core?.invoke;
  if (typeof globalInvoke === 'function') return globalInvoke;
  if (!runtimeWindow?.__TAURI_INTERNALS__) return null;

  const tauriCore = (await import('@tauri-apps/api/core').catch(() => undefined)) as
    | { invoke?: unknown; default?: { invoke?: unknown } }
    | undefined;
  const moduleInvoke = tauriCore?.invoke;
  if (typeof moduleInvoke === 'function') return moduleInvoke;
  const defaultInvoke = tauriCore?.default?.invoke;
  if (typeof defaultInvoke === 'function') return defaultInvoke;
  return null;
};

const generateSystemSpeechAudio = async (input: string) => {
  const invoke = await getTauriInvoke();
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

const dataUrlToBlob = async (dataUrl: string) => {
  const response = await fetch(dataUrl);
  return response.blob();
};

const normalizeHostedAudio = async (audio: string) => {
  const value = audio.trim();
  if (!value) {
    throw new Error('Hosted TTS proxy returned no audio.');
  }

  if (/^data:audio\//i.test(value)) {
    const blob = await dataUrlToBlob(value);
    return {
      blob,
      url: URL.createObjectURL(blob),
    };
  }

  if (/^https?:\/\//i.test(value)) {
    const response = await fetch(value);
    if (!response.ok) {
      throw new Error(`Hosted TTS audio download failed with HTTP ${response.status}`);
    }
    const blob = await response.blob();
    return {
      blob,
      url: URL.createObjectURL(blob),
    };
  }

  const dataUrl = `data:audio/mpeg;base64,${value}`;
  const blob = await dataUrlToBlob(dataUrl);
  return {
    blob,
    url: URL.createObjectURL(blob),
  };
};

const generateHostedSpeechAudio = async (input: string, config: TTSConfig) => {
  const proxyUrl = config.apiUrl.trim() || HOSTED_TTS_PROXY_ENDPOINT;
  const payload = {
    type: 'voice',
    text: input,
    payload: {
      model: config.model.trim() || 'seed-tts-2.0',
      voice: config.voice.trim() || 'zh_female_vv_uranus_bigtts',
      response_format: 'mp3',
    },
  };

  console.info('[GalWriter TTS] Hosted proxy request', {
    proxyUrl,
    model: payload.payload.model,
    voice: payload.payload.voice,
    textLength: input.length,
  });

  const response = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.error || `Hosted TTS request failed with HTTP ${response.status}`;
    console.error('[GalWriter TTS] Hosted proxy failed', {
      status: response.status,
      proxyUrl,
      model: payload.payload.model,
      voice: payload.payload.voice,
      response: data,
    });
    throw new Error(String(message));
  }
  if (data?.debug) {
    console.info('[GalWriter TTS] Hosted proxy response debug', data.debug);
  }

  const audio =
    (typeof data?.audio === 'string' && data.audio) ||
    (typeof data?.audio_url === 'string' && data.audio_url) ||
    (typeof data?.url === 'string' && data.url) ||
    (typeof data?.b64_json === 'string' && data.b64_json);
  if (!audio) {
    throw new Error('Hosted TTS proxy returned no usable audio.');
  }

  return normalizeHostedAudio(audio);
};

const appendBase64Audio = (chunks: Uint8Array[], audio: string) => {
  const clean = audio.trim();
  if (!clean) return;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  chunks.push(bytes);
};

const extractJsonObjects = (source: string) => {
  const objects: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') {
      if (depth === 0) start = index;
      depth += 1;
      continue;
    }
    if (char === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        objects.push(source.slice(start, index + 1));
        start = -1;
      }
    }
  }

  const remainder = depth > 0 && start >= 0 ? source.slice(start) : '';
  return { objects, remainder };
};

const handleVolcengineMessage = (raw: string, audioChunks: Uint8Array[]) => {
  const dataText = raw
    .split(/\r?\n/)
    .map((line) => (line.startsWith('data:') ? line.slice(5).trim() : line.trim()))
    .filter(Boolean)
    .join('\n');
  if (!dataText) return;

  const data = JSON.parse(dataText);
  const code = Number(data?.code ?? 0);
  if (code !== 0 && code !== 20000000) {
    throw new Error(data?.message || `Volcengine TTS error ${code}`);
  }
  if (typeof data?.data === 'string') {
    appendBase64Audio(audioChunks, data.data);
  }
};

const appendVolcengineResponseAudio = (text: string, audioChunks: Uint8Array[]) => {
  const extracted = extractJsonObjects(text);
  for (const objectText of extracted.objects) {
    handleVolcengineMessage(objectText, audioChunks);
  }
};

const generateVolcengineSpeechAudio = async (input: string, config: TTSConfig) => {
  const apiKey = config.apiKey.trim();
  const resourceId = config.model.trim() || 'seed-tts-2.0';
  const speaker = config.voice.trim() || 'zh_female_vv_uranus_bigtts';
  const normalizedEndpoint = normalizeVolcengineTtsEndpoint(config.apiUrl);
  const endpoint = getVolcengineTtsRequestEndpoint(config.apiUrl);

  if (!apiKey) {
    throw new Error('Volcengine API Key is missing.');
  }

  const requestId = crypto.randomUUID();
  const body = JSON.stringify({
    user: {
      uid: 'galwriter-ai',
    },
    namespace: 'BidirectionalTTS',
    req_params: {
      text: input,
      speaker,
      audio_params: {
        format: 'mp3',
        sample_rate: 24000,
        bit_rate: 128000,
      },
      additions: JSON.stringify({
        disable_markdown_filter: true,
      }),
    },
  });
  const audioChunks: Uint8Array[] = [];
  const invoke = await getTauriInvoke();

  console.info('[GalWriter TTS] Volcengine request', {
    endpoint,
    normalizedEndpoint,
    resourceId,
    speaker,
    textLength: input.length,
    viaTauri: Boolean(
      invoke &&
        /^https:\/\/openspeech\.bytedance\.com\/api\/v3\/tts\/unidirectional\/?$/i.test(
          normalizedEndpoint,
        ),
    ),
  });

  if (
    invoke &&
    /^https:\/\/openspeech\.bytedance\.com\/api\/v3\/tts\/unidirectional\/?$/i.test(normalizedEndpoint)
  ) {
    const responseText = (await invoke('proxy_volcengine_tts', {
      endpoint: normalizedEndpoint.replace(/\/$/, ''),
      apiKey,
      resourceId,
      requestId,
      body,
    })) as string;
    appendVolcengineResponseAudio(responseText, audioChunks);
  } else {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
        'X-Api-Resource-Id': resourceId,
        'X-Api-Request-Id': requestId,
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[GalWriter TTS] Volcengine request failed', {
        status: response.status,
        endpoint,
        resourceId,
        speaker,
        response: errorText,
      });
      throw new Error(errorText || `Volcengine TTS request failed with HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (reader) {
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const extracted = extractJsonObjects(buffer);
        buffer = extracted.remainder;
        for (const objectText of extracted.objects) {
          handleVolcengineMessage(objectText, audioChunks);
        }
      }
      buffer += decoder.decode();
      appendVolcengineResponseAudio(buffer, audioChunks);
    } else {
      const text = await response.text();
      appendVolcengineResponseAudio(text, audioChunks);
    }
  }

  if (audioChunks.length === 0) {
    throw new Error('Volcengine TTS returned no audio data.');
  }

  const blob = new Blob(audioChunks, { type: 'audio/mpeg' });
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

  if (config.provider === 'hosted-voice') {
    return generateHostedSpeechAudio(input, config);
  }

  if (config.provider === 'doubao') {
    return generateVolcengineSpeechAudio(input, config);
  }

  if (!config.apiKey.trim()) {
    throw new Error('TTS API key is missing.');
  }

  const normalizedModel = config.model.trim() || 'gpt-4o-mini-tts';
  const normalizedVoice = config.voice.trim() || 'alloy';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const payload: Record<string, unknown> = {
    model: normalizedModel,
    voice: normalizedVoice,
    input,
    response_format: 'mp3',
  };

  headers.Authorization = `Bearer ${config.apiKey.trim()}`;

  const response = await fetch(normalizeTtsApiUrl(config.apiUrl), {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
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
