import type { Node as FlowNode } from '@xyflow/react';
import { Film, Image, Music, Video } from 'lucide-react';
import React from 'react';

import { filterMentionTags, stripHtml } from '../shared/storyNodes';

export const mediaKind = (node: FlowNode) => {
  if (node.data?.videoUrl) return 'video';
  if (node.data?.imageUrl) return 'image';
  if (node.data?.audioUrl) return 'audio';
  return 'text';
};

export const mediaIcon = (node: FlowNode, className = 'w-4 h-4') => {
  const kind = mediaKind(node);
  if (kind === 'video') return <Video className={className} />;
  if (kind === 'image') return <Image className={className} />;
  if (kind === 'audio') return <Music className={className} />;
  return <Film className={className} />;
};

export const segmentTitle = (node: FlowNode, untitledLabel: string) =>
  String(node.data?.title || untitledLabel);

export const segmentText = (node: FlowNode, hideCharacterTags = true, hideSceneTags = true) =>
  stripHtml(filterMentionTags(String(node.data?.text || ''), hideCharacterTags, hideSceneTags)).trim();

export const segmentDurationLabel = (
  node: FlowNode,
  defaultSeconds: number,
  labels: {
    longestMedia: string;
    video: string;
    audio: string;
  },
) => {
  if (node.data?.videoUrl && node.data?.audioUrl) return labels.longestMedia;
  if (node.data?.videoUrl) return labels.video;
  if (node.data?.audioUrl) return labels.audio;
  return `${defaultSeconds}s`;
};
