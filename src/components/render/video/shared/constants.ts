import type { ExportFormat, TextAnimation } from './types';

export const DEFAULT_VIDEO_BITRATE = '6000k';

export const RESOLUTION_OPTIONS = [
  { label: '2K', width: 2560, height: 1440 },
  { label: '1080p', width: 1920, height: 1080 },
  { label: '720p', width: 1280, height: 720 },
  { label: '2K 竖屏', width: 1440, height: 2560 },
  { label: '1080p 竖屏', width: 1080, height: 1920 },
  { label: '720p 竖屏', width: 720, height: 1280 },
];

export const FRAME_RATE_OPTIONS = [25, 30, 59, 60];
export const HEADER_HEIGHT = 56;
export const MIN_MAIN_HEIGHT = 320;
export const MIN_PREVIEW_WIDTH = 360;
export const TIMELINE_LABEL_WIDTH = 92;
export const TIMELINE_PIXELS_PER_SECOND = 72;
export const TIMELINE_MIN_PIXELS_PER_SECOND = 8;
export const TIMELINE_MAX_PIXELS_PER_SECOND = 1800;
export const ASSET_CARD_MIN_SCALE = 0.72;
export const ASSET_CARD_MAX_SCALE = 1.75;
export const PANEL_SIZE_LIMITS = {
  asset: { min: 220, max: 520 },
  export: { min: 380, max: 560 },
  timeline: { min: 150, max: 420 },
};
export const ENCODER_OPTIONS = [
  { label: 'CPU libx264', value: 'libx264' },
  { label: 'NVIDIA NVENC', value: 'h264_nvenc' },
  { label: 'Intel QSV', value: 'h264_qsv' },
  { label: 'AMD AMF', value: 'h264_amf' },
];

export const TEXT_ANIMATION_OPTIONS: {
  value: TextAnimation;
  zh: string;
  ja: string;
  en: string;
}[] = [
  { value: 'none', zh: '无动画', ja: 'アニメなし', en: 'No animation' },
  { value: 'fade', zh: '淡入', ja: 'フェード', en: 'Fade' },
  { value: 'slideUp', zh: '上滑', ja: '上へスライド', en: 'Rise' },
  { value: 'typewriter', zh: '打字', ja: 'タイプ', en: 'Type' },
];

export const EXPORT_FORMAT_OPTIONS: {
  label: string;
  value: ExportFormat;
}[] = [
  {
    label: 'MP4',
    value: 'mp4',
  },
  {
    label: 'MOV',
    value: 'mov',
  },
  {
    label: 'MKV',
    value: 'mkv',
  },
];
