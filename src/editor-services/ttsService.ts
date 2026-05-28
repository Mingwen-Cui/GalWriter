import { generateSpeechAudio, htmlToSpeechText, type TTSConfig } from '../lib/tts';

export type TTSRequest = TTSConfig & {
  text: string;
};

export const ttsService = {
  htmlToSpeechText,
  async generate(request: TTSRequest) {
    return generateSpeechAudio(request.text, request);
  },
};
