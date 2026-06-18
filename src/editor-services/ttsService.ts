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

const TAG_SEGMENT_MARKER = '\n\n__GALWRITER_TAG_BREAK__\n\n';

const splitSpeechText = (text: string) =>
  text
    .split('__GALWRITER_TAG_BREAK__')
    .map((segment) =>
      segment
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t\f\v]+/g, ' ')
        .replace(/\s*\n\s*/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim(),
    )
    .filter(Boolean);

const htmlToTagSplitSpeechSegments = (html: string) => {
  if (!html) return [];

  if (typeof DOMParser === 'undefined') {
    return splitSpeechText(
      htmlToSpeechText(
        html.replace(
          /<span\b[^>]*data-mention-kind=(?:"(?:character|scene)"|'(?:character|scene)')[^>]*>[\s\S]*?<\/span>/gi,
          TAG_SEGMENT_MARKER,
        ),
      ),
    );
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll<HTMLElement>('[data-mention-kind="character"], [data-mention-kind="scene"]').forEach((mention) => {
    mention.replaceWith(doc.createTextNode(TAG_SEGMENT_MARKER));
  });
  doc
    .querySelectorAll('.mention-chip, [data-mention-kind], [data-mention-name]')
    .forEach((mention) => mention.remove());
  return splitSpeechText(htmlToSpeechText(doc.body.innerHTML));
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
  buildSpeechSegments(titleHtml: string, bodyHtml: string, mode: TtsNarrationMode = 'body') {
    const title = htmlToTagFreeSpeechText(titleHtml);
    const bodySegments = htmlToTagSplitSpeechSegments(bodyHtml);
    if (mode === 'title') return title ? [{ id: 'title', text: title }] : [];
    if (mode === 'all') {
      const segments = bodySegments.map((text, index) => ({ id: `body-${index + 1}`, text }));
      return title ? [{ id: 'title', text: title }, ...segments] : segments;
    }
    return bodySegments.map((text, index) => ({ id: `body-${index + 1}`, text }));
  },
  async generate(request: TTSRequest) {
    return generateSpeechAudio(request.text, request);
  },
};
