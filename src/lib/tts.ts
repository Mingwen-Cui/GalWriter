export type TTSConfig = {
  apiUrl: string;
  apiKey: string;
  model: string;
  voice: string;
};

const DEFAULT_TTS_ENDPOINT = 'https://api.openai.com/v1/audio/speech';

export const normalizeTtsApiUrl = (apiUrl: string) => {
  const raw = apiUrl.trim();
  if (!raw) return DEFAULT_TTS_ENDPOINT;
  if (/\/audio\/speech\/?$/i.test(raw)) return raw.replace(/\/$/, '');
  if (/\/v1\/?$/i.test(raw)) return `${raw.replace(/\/$/, '')}/audio/speech`;
  return raw;
};

export const htmlToSpeechText = (html: string) => {
  if (typeof document === 'undefined') {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
};

export async function generateSpeechAudio(text: string, config: TTSConfig) {
  const input = text.trim();
  if (!input) {
    throw new Error('No text to synthesize.');
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
