import {
  generateSpeechAudio,
  htmlToSpeechText,
  htmlToTagFreeSpeechText,
  type TTSConfig,
} from '../lib/tts';
import type { TtsNarrationMode } from '../domain/project';

export type TTSRequest = TTSConfig & {
  text: string;
};

export const ttsService = {
  htmlToSpeechText,
  buildSpeechText(titleHtml: string, bodyHtml: string, mode: TtsNarrationMode = 'body') {
    const title = htmlToTagFreeSpeechText(titleHtml);
    const body = htmlToTagFreeSpeechText(bodyHtml);
    if (mode === 'title') return title;
    if (mode === 'all') return [title, body].filter(Boolean).join('\n\n').trim();
    return body;
  },
  async generate(request: TTSRequest) {
    return generateSpeechAudio(request.text, request);
  },
};
