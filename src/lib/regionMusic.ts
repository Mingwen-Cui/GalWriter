import type { Node } from '@xyflow/react';

import type { RegionBackgroundMusic } from '../domain/project';

type RegionMusicMatch = {
  regionId: string;
  music: RegionBackgroundMusic;
  area: number;
};

const readSize = (value: unknown, fallback: number) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const getNodeRect = (node: Node) => ({
  x: node.position?.x || 0,
  y: node.position?.y || 0,
  width:
    node.measured?.width ||
    node.width ||
    readSize(node.style?.width, node.type === 'backgroundNode' ? 600 : 300),
  height:
    node.measured?.height ||
    node.height ||
    readSize(node.style?.height, node.type === 'backgroundNode' ? 400 : 200),
});

const normalizeMusic = (value: unknown): RegionBackgroundMusic | null => {
  if (!value || typeof value !== 'object') return null;
  const music = value as Partial<RegionBackgroundMusic>;
  if (typeof music.url !== 'string' || !music.url.trim()) return null;
  return {
    url: music.url,
    name: typeof music.name === 'string' ? music.name : undefined,
    loop: music.loop !== false,
    volume: Math.min(1, Math.max(0, Number(music.volume ?? 0.5))),
    fadeIn: Math.max(0, Number(music.fadeIn ?? 1)),
    fadeOut: Math.max(0, Number(music.fadeOut ?? 1)),
  };
};

export const resolveRegionBackgroundMusic = (
  nodes: Node[],
  storyNode: Node | null | undefined,
): RegionMusicMatch | null => {
  if (!storyNode || storyNode.type !== 'storyNode') return null;

  const storyRect = getNodeRect(storyNode);
  const center = {
    x: storyRect.x + storyRect.width / 2,
    y: storyRect.y + storyRect.height / 2,
  };
  const matches: RegionMusicMatch[] = [];

  nodes.forEach((node) => {
    const music = normalizeMusic(node.data?.backgroundMusic);
    if (!music) return;

    if (node.type === 'groupNode') {
      const childIds = Array.isArray(node.data?.childIds) ? node.data.childIds : [];
      if (!childIds.includes(storyNode.id)) return;
      const rect = getNodeRect(node);
      matches.push({
        regionId: node.id,
        music,
        area: Math.max(1, rect.width * rect.height),
      });
      return;
    }

    if (node.type !== 'backgroundNode') return;
    const rect = getNodeRect(node);
    const contains =
      center.x >= rect.x &&
      center.x <= rect.x + rect.width &&
      center.y >= rect.y &&
      center.y <= rect.y + rect.height;
    if (!contains) return;
    matches.push({
      regionId: node.id,
      music,
      area: Math.max(1, rect.width * rect.height),
    });
  });

  return matches.sort((a, b) => a.area - b.area)[0] || null;
};

export type { RegionMusicMatch };
