import type { RenderStyle, VideoTextScaleMode } from './types';

// Output size scales the stage, never the authored text metrics.
export const resolveVideoTextScale = (_mode: VideoTextScaleMode, _height: number) => 1;
export const getVideoTextRenderStyle = (style: RenderStyle, _mode: VideoTextScaleMode, _height: number) => style;
