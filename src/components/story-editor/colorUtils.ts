import type { Node } from '@xyflow/react';

import {
  DEFAULT_DARK_ACCENT_COLOR,
  DEFAULT_LIGHT_ACCENT_COLOR,
  DEFAULT_ROOT_STORY_TEXT_VARIANTS,
  DEFAULT_ROOT_STORY_TITLE,
  HEX_COLOR_PATTERN,
} from './constants';

export const normalizeStoryPlainText = (value: unknown) =>
  String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, '')
    .replace(/[.。…]+$/g, '');

export const isHexColor = (color: string) => HEX_COLOR_PATTERN.test(color);

export const clampColorChannel = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

export const mixHexColor = (color: string, target: '#000000' | '#ffffff', amount: number) => {
  if (!isHexColor(color)) return color;
  const sourceValue = Number.parseInt(color.slice(1), 16);
  const targetValue = Number.parseInt(target.slice(1), 16);
  const source = {
    r: (sourceValue >> 16) & 255,
    g: (sourceValue >> 8) & 255,
    b: sourceValue & 255,
  };
  const mixed = {
    r: clampColorChannel(source.r + (((targetValue >> 16) & 255) - source.r) * amount),
    g: clampColorChannel(source.g + (((targetValue >> 8) & 255) - source.g) * amount),
    b: clampColorChannel(source.b + ((targetValue & 255) - source.b) * amount),
  };

  return `#${[mixed.r, mixed.g, mixed.b]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`;
};

export const resolveAccentColor = (accentColor: string, resolvedTheme: 'light' | 'dark') =>
  isHexColor(accentColor)
    ? accentColor
    : resolvedTheme === 'dark'
      ? DEFAULT_DARK_ACCENT_COLOR
      : DEFAULT_LIGHT_ACCENT_COLOR;

export const isDefaultInitialStoryNode = (node: Node) =>
  node.type === 'storyNode' &&
  node.id === 'root' &&
  String(node.data?.title || '') === DEFAULT_ROOT_STORY_TITLE &&
  DEFAULT_ROOT_STORY_TEXT_VARIANTS.has(normalizeStoryPlainText(node.data?.text));
