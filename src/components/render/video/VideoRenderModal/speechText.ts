import type { Node as FlowNode } from '@xyflow/react';

import { htmlToSpeechText } from '../../../../lib/tts';

export const getSpeechTagNames = (nodes: FlowNode[]) =>
  Array.from(
    new Set(
      nodes
        .flatMap((node) => [
          node.type === 'characterNode' ? node.data?.characterName : '',
          node.type === 'sceneNode' ? node.data?.sceneName : '',
        ])
        .map((name) => String(name || '').trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => b.length - a.length);

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const removePlainSpeechTags = (text: string, speechTagNames: string[]) => {
  let cleaned = text
    .replace(/<\/?span\b[^>]*(?:mention-chip|data-mention-(?:kind|name))[^>]*>/gi, ' ')
    .replace(/\{\{\s*(?:character|scene)\s*:[^}]+\}\}/gi, ' ');
  speechTagNames.forEach((name) => {
    cleaned = cleaned.replace(new RegExp(`@\\s*${escapeRegExp(name)}`, 'giu'), ' ');
  });
  return cleaned
    .replace(/@[\p{L}\p{N}_·・.-]+/gu, ' ')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
};

const removeSpeechMentionTags = (html: string) => {
  if (!html) return '';
  if (typeof DOMParser === 'undefined') {
    return html
      .replace(
        /<span\b[^>]*(?:class=(?:"[^"]*\bmention-chip\b[^"]*"|'[^']*\bmention-chip\b[^']*')|data-mention-kind=(?:"[^"]*"|'[^']*'))[^>]*>[\s\S]*?<\/span>/gi,
        ' ',
      )
      .replace(/@\S+/g, ' ');
  }
  const document = new DOMParser().parseFromString(html, 'text/html');
  document
    .querySelectorAll('.mention-chip, [data-mention-kind], [data-mention-name]')
    .forEach((mention) => mention.remove());
  return document.body.innerHTML;
};

export const getSpeechTextForNode = (node: FlowNode, speechTagNames: string[]) => {
  const cleanField = (value: unknown) =>
    removePlainSpeechTags(
      htmlToSpeechText(removeSpeechMentionTags(String(value || ''))),
      speechTagNames,
    );
  return [cleanField(node.data?.title), cleanField(node.data?.text)]
    .filter(Boolean)
    .join('\n')
    .trim();
};
