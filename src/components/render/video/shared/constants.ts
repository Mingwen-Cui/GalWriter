import type { ExportFormat, TextAnimation } from './types';

export const DEFAULT_VIDEO_BITRATE = '6000k';
export const AUDIO_CHUNK_SIZE = 512 * 1024;
export const ASSET_CHUNK_SIZE = 1024 * 1024;

export const RESOLUTION_OPTIONS = [
  { label: '1920 x 1080', width: 1920, height: 1080 },
  { label: '1280 x 720', width: 1280, height: 720 },
  { label: '1080 x 1920', width: 1080, height: 1920 },
  { label: '720 x 1280', width: 720, height: 1280 },
];

export const FRAME_RATE_OPTIONS = [25, 30, 59, 60];
export const HEADER_HEIGHT = 56;
export const MIN_MAIN_HEIGHT = 320;
export const MIN_PREVIEW_WIDTH = 360;
export const TIMELINE_LABEL_WIDTH = 76;
export const TIMELINE_PIXELS_PER_SECOND = 72;
export const TIMELINE_MIN_PIXELS_PER_SECOND = 8;
export const TIMELINE_MAX_PIXELS_PER_SECOND = 1800;
export const ASSET_CARD_MIN_SCALE = 0.72;
export const ASSET_CARD_MAX_SCALE = 1.75;
export const PANEL_SIZE_LIMITS = {
  asset: { min: 220, max: 520 },
  export: { min: 280, max: 560 },
  timeline: { min: 150, max: 420 },
};
export const ENCODER_OPTIONS = [
  { label: 'CPU libx264', value: 'libx264' },
  { label: 'NVIDIA NVENC', value: 'h264_nvenc' },
  { label: 'Intel QSV', value: 'h264_qsv' },
  { label: 'AMD AMF', value: 'h264_amf' },
];

export const TEXT_ANIMATION_OPTIONS: { value: TextAnimation; zh: string; ja: string; en: string }[] = [
  { value: 'none', zh: '无', ja: 'なし', en: 'None' },
  { value: 'fade', zh: '淡入', ja: 'フェード', en: 'Fade' },
  { value: 'slideUp', zh: '上滑', ja: '上へスライド', en: 'Rise' },
  { value: 'typewriter', zh: '打字', ja: 'タイプ', en: 'Type' },
];

export const EXPORT_FORMAT_OPTIONS: {
  label: string;
  value: ExportFormat;
  directRecording: boolean;
  mimeCandidates: string[];
}[] = [
  {
    label: 'WebM',
    value: 'webm',
    directRecording: true,
    mimeCandidates: ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'],
  },
  {
    label: 'MP4',
    value: 'mp4',
    directRecording: false,
    mimeCandidates: [],
  },
  {
    label: 'MKV',
    value: 'mkv',
    directRecording: false,
    mimeCandidates: [],
  },
];
