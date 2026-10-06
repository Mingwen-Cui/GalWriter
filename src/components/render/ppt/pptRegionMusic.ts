import type { Node, Edge } from '@xyflow/react';

import type { Language } from '../../../lib/i18n';
import { resolveRegionBackgroundMusic } from '../../../lib/regionMusic';
import { formatVideoText } from '../video/i18n';
import type { PptExportSettings } from '../video/shared/types';

export const buildPptRegionMusicRuns = (nodes: Node[], slideIds: string[], settings: PptExportSettings) => {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const runs: Array<{ slideId: string; slideCount: number; match: NonNullable<ReturnType<typeof resolveRegionBackgroundMusic>> }> = [];
  let previousKey = '';
  for (const slideId of slideIds) {
    if (settings.hiddenSlideIds?.includes(slideId)) continue;
    const match = resolveRegionBackgroundMusic(nodes, byId.get(slideId.replace(/^choice:/, '')));
    const key = match ? `${match.regionId}:${match.music.url}` : '';
    if (match && key === previousKey && settings.branchMode === 'linear') runs.at(-1)!.slideCount++;
    else if (match) runs.push({ slideId, slideCount: 1, match });
    previousKey = key;
  }
  return runs;
};

export const getPptRegionMusicWarnings = (nodes: Node[], _edges: Edge[], settings: PptExportSettings, language: Language): string[] => {
  const excluded = new Set([...(settings.deletedSlideIds || []), ...(settings.hiddenSlideIds || [])]);
  const musicalNodes = nodes.filter(node => node.type === 'storyNode' && !node.data?.hidden && !excluded.has(node.id) && resolveRegionBackgroundMusic(nodes, node));
  if (!musicalNodes.length) return [];
  const warnings: string[] = [];
  if (musicalNodes.some(node => {
    const music = resolveRegionBackgroundMusic(nodes, node)!.music;
    return music.fadeIn > 0 || music.fadeOut > 0;
  })) warnings.push(formatVideoText(language, 'pptRegionMusicFadesWarning'));
  if (settings.branchMode !== 'linear') warnings.push(formatVideoText(language, 'pptRegionMusicBranchWarning'));
  if (musicalNodes.some(node => node.data.audioUrl || (node.data.videoUrl && !node.data.muteVideoAudio) ||
    nodes.some(candidate => candidate.type === 'sceneNode' && candidate.id === (node.data.presentation as any)?.scene?.sourceNodeId && (candidate.data.ambientSound as any)?.enabled))) {
    warnings.push(formatVideoText(language, 'pptRegionMusicMixWarning'));
  }
  // Two regional BGMs can follow different branches even when their cards share no audio.
  const regions = new Set(musicalNodes.map(node => resolveRegionBackgroundMusic(nodes, node)!.regionId));
  if (regions.size > 1 && !warnings.includes(formatVideoText(language, 'pptRegionMusicMixWarning'))) {
    warnings.push(formatVideoText(language, 'pptRegionMusicMixWarning'));
  }
  if (musicalNodes.some(node => node.data.audioUrl || nodes.some(candidate => candidate.id === (node.data.presentation as any)?.scene?.sourceNodeId && (candidate.data.ambientSound as any)?.enabled)))
    warnings.push(formatVideoText(language, 'pptRegionMusicOtherAudioWarning'));
  return warnings;
};
