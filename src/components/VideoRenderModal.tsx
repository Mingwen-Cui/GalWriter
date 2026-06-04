import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react';
import JSZip from 'jszip';
import {
  Clock,
  Download,
  Film,
  Image,
  Layers,
  Loader2,
  MoveHorizontal,
  MoveVertical,
  Music,
  Pause,
  Play,
  Plus,
  Redo2,
  Settings,
  Trash2,
  Undo2,
  Video,
  X,
} from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';

import type { Language } from '../lib/i18n';
import { htmlToSpeechText } from '../lib/tts';

type RenderStatus = 'idle' | 'rendering' | 'done' | 'error';
type ExportFormat = 'webm' | 'mp4' | 'mkv';
type TextAnimation = 'none' | 'fade' | 'slideUp' | 'typewriter';
type TimelineScaleMode = 'seconds' | 'frames';
type TimelineWheelMode = 'vertical' | 'horizontal';

type VideoRenderModalProps = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  onClose: () => void;
  language: Language;
};

type TauriRenderSaveResult = {
  path: string;
};

type TauriRenderSessionResult = {
  workDir: string;
};

type RenderStyle = {
  titleFontSize: number;
  bodyFontSize: number;
  titleColor: string;
  bodyColor: string;
  panelColor: string;
  titleAnimation: TextAnimation;
  bodyAnimation: TextAnimation;
};

type SegmentRenderInfo = {
  node: FlowNode;
  durationSecs: number;
  audioUrl?: string;
  videoUrl?: string;
};

type HighPerfSegmentPayload = {
  title?: string;
  text?: string;
  imagePath?: string;
  videoPath?: string;
  audioPath?: string;
  durationSecs?: number;
};

type RenderedFramePayload = {
  bytes: number[];
  durationSecs: number;
};

type AssetRegionOption = {
  id: string;
  label: string;
  type: 'all' | 'outside' | 'dynamicGroup' | 'background';
};

type TimelineHistoryState = {
  timelineIds: string[];
  selectedIds: string[];
  videoTrackIds: string[];
  audioTrackIds: string[];
  videoTrackByNodeId: Record<string, string>;
  audioTrackByNodeId: Record<string, string>;
  activePreviewId: string;
};

const DEFAULT_VIDEO_BITRATE = '6000k';
const AUDIO_CHUNK_SIZE = 512 * 1024;
const ASSET_CHUNK_SIZE = 1024 * 1024;

const RESOLUTION_OPTIONS = [
  { label: '1920 x 1080', width: 1920, height: 1080 },
  { label: '1280 x 720', width: 1280, height: 720 },
  { label: '1080 x 1920', width: 1080, height: 1920 },
  { label: '720 x 1280', width: 720, height: 1280 },
];

const FRAME_RATE_OPTIONS = [25, 30, 59, 60];
const HEADER_HEIGHT = 56;
const MIN_MAIN_HEIGHT = 320;
const MIN_PREVIEW_WIDTH = 360;
const TIMELINE_LABEL_WIDTH = 76;
const TIMELINE_PIXELS_PER_SECOND = 72;
const TIMELINE_MIN_PIXELS_PER_SECOND = 8;
const TIMELINE_MAX_PIXELS_PER_SECOND = 1800;
const TIMELINE_SEGMENT_GAP = 6;
const PANEL_SIZE_LIMITS = {
  asset: { min: 220, max: 520 },
  export: { min: 280, max: 560 },
  timeline: { min: 150, max: 420 },
};
const ENCODER_OPTIONS = [
  { label: 'CPU libx264', value: 'libx264' },
  { label: 'NVIDIA NVENC', value: 'h264_nvenc' },
  { label: 'Intel QSV', value: 'h264_qsv' },
  { label: 'AMD AMF', value: 'h264_amf' },
];

const TEXT_ANIMATION_OPTIONS: { value: TextAnimation; zh: string; en: string }[] = [
  { value: 'none', zh: '无', en: 'None' },
  { value: 'fade', zh: '淡入', en: 'Fade' },
  { value: 'slideUp', zh: '上滑', en: 'Rise' },
  { value: 'typewriter', zh: '打字', en: 'Type' },
];

const EXPORT_FORMAT_OPTIONS: {
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

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const isTauriRuntime = () => {
  if (typeof window === 'undefined') return false;
  const runtimeWindow = window as Window & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };
  return !!runtimeWindow.__TAURI__ || !!runtimeWindow.__TAURI_INTERNALS__;
};

const getSupportedMimeType = (format: ExportFormat) => {
  const option =
    EXPORT_FORMAT_OPTIONS.find((item) => item.value === format) || EXPORT_FORMAT_OPTIONS[0];
  if (!option.directRecording) return '';
  return option.mimeCandidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || '';
};

const imageLoadCache = new Map<string, Promise<HTMLImageElement>>();

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const prefersCrossOrigin = /^https?:\/\//i.test(src);
    const tryLoad = (useCrossOrigin: boolean) => {
      const img = new window.Image();
      if (useCrossOrigin) img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => {
        if (!useCrossOrigin) {
          tryLoad(true);
          return;
        }
        reject(new Error('Failed to load image.'));
      };
      img.src = src;
    };
    tryLoad(prefersCrossOrigin);
  });

const loadCachedImage = (src: string) => {
  const cached = imageLoadCache.get(src);
  if (cached) return cached;

  const request = loadImage(src).catch((error) => {
    imageLoadCache.delete(src);
    throw error;
  });
  imageLoadCache.set(src, request);
  return request;
};

const getAudioDuration = (src: string) =>
  new Promise<number>((resolve) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => resolve(Number.isFinite(audio.duration) ? audio.duration : 0);
    audio.onerror = () => resolve(0);
    audio.src = src;
  });

const validDuration = (duration: number) =>
  Number.isFinite(duration) && duration > 0 ? duration : 0;

const loadVideo = (src: string) =>
  new Promise<HTMLVideoElement>((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => resolve(video);
    video.onerror = () => reject(new Error('Failed to load video.'));
    video.src = src;
    video.load();
  });

const seekVideo = (video: HTMLVideoElement, time: number) =>
  new Promise<void>((resolve, reject) => {
    const targetTime = Math.max(0, Math.min(time, Math.max(0, (video.duration || 0) - 0.05)));
    if (Math.abs(video.currentTime - targetTime) < 0.01) {
      resolve();
      return;
    }
    const cleanup = () => {
      video.onseeked = null;
      video.onerror = null;
    };
    video.onseeked = () => {
      cleanup();
      resolve();
    };
    video.onerror = () => {
      cleanup();
      reject(new Error('Failed to seek video.'));
    };
    video.currentTime = targetTime;
  });

const canvasToPngBytes = (canvas: HTMLCanvasElement) =>
  new Promise<number[]>((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('Canvas could not be exported as PNG.'));
        return;
      }
      resolve(Array.from(new Uint8Array(await blob.arrayBuffer())));
    }, 'image/png');
  });

const fetchArrayBuffer = async (src: string) => {
  const response = await fetch(src);
  if (!response.ok) throw new Error('Failed to load media bytes.');
  return response.arrayBuffer();
};

const encodeWav = (buffer: AudioBuffer) => {
  const channels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const samples = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = samples * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);
  let offset = 0;

  const writeString = (value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
    offset += value.length;
  };

  writeString('RIFF');
  view.setUint32(offset, 36 + dataSize, true);
  offset += 4;
  writeString('WAVE');
  writeString('fmt ');
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint16(offset, channels, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, sampleRate * blockAlign, true);
  offset += 4;
  view.setUint16(offset, blockAlign, true);
  offset += 2;
  view.setUint16(offset, bytesPerSample * 8, true);
  offset += 2;
  writeString('data');
  view.setUint32(offset, dataSize, true);
  offset += 4;

  const channelData = Array.from({ length: channels }, (_, index) => buffer.getChannelData(index));
  for (let i = 0; i < samples; i += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][i] || 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return Array.from(new Uint8Array(arrayBuffer));
};

const formatSeconds = (seconds: number, precision = 0) => {
  const safeSeconds = Math.max(0, seconds);
  if (precision <= 0) {
    const roundedSeconds = Math.round(safeSeconds);
    const minutes = Math.floor(roundedSeconds / 60);
    const rest = roundedSeconds % 60;
    return `${minutes}:${String(rest).padStart(2, '0')}`;
  }
  const roundedSeconds = Number(safeSeconds.toFixed(precision));
  const minutes = Math.floor(roundedSeconds / 60);
  const rest = roundedSeconds - minutes * 60;
  const fixedRest = rest.toFixed(precision);
  const [whole, decimal = ''] = fixedRest.split('.');
  return `${minutes}:${whole.padStart(2, '0')}.${decimal}`;
};

const getTimelineTickSettings = (
  pixelsPerSecond: number,
  scaleMode: TimelineScaleMode,
  frameRate: number,
) => {
  const minimumLabelGapPx = scaleMode === 'frames' ? 72 : 64;
  const minimumSecondsPerTick = minimumLabelGapPx / Math.max(1, pixelsPerSecond);
  const secondSteps = [
    1 / 60,
    1 / 30,
    1 / 24,
    1 / 12,
    0.1,
    0.2,
    0.25,
    0.5,
    1,
    2,
    5,
    10,
    15,
    30,
    60,
  ];

  if (scaleMode === 'frames') {
    const framesPerTick = Math.max(1, Math.ceil(minimumSecondsPerTick * frameRate));
    return {
      step: framesPerTick / frameRate,
      precision: 0,
    };
  }

  const step = secondSteps.find((candidate) => candidate >= minimumSecondsPerTick) || 120;
  return {
    step,
    precision: step < 1 ? Math.min(2, Math.ceil(-Math.log10(step))) : 0,
  };
};

const getTimelineSegmentLayout = (start: number, duration: number, pixelsPerSecond: number) => {
  const slotLeft = start * pixelsPerSecond;
  const slotWidth = Math.max(1, duration * pixelsPerSecond);
  const gap = Math.min(TIMELINE_SEGMENT_GAP, Math.max(0, slotWidth - 1));
  return {
    left: slotLeft + gap / 2,
    width: Math.max(1, slotWidth - gap),
  };
};

const normalizeAssetPath = (path?: string) => {
  if (!path || !path.startsWith('assets/')) return undefined;
  return path.replace(/\\/g, '/');
};

const stripHtml = (html: string) => htmlToSpeechText(html || '');

const drawCoverImage = (
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number,
) => {
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
};

const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  const lines: string[] = [];
  const paragraphs = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  paragraphs.forEach((paragraph) => {
    let current = '';
    Array.from(paragraph).forEach((char) => {
      const next = current + char;
      if (ctx.measureText(next).width > maxWidth && current) {
        lines.push(current);
        current = char;
      } else {
        current = next;
      }
    });
    if (current) lines.push(current);
  });

  return lines;
};

const getOrderedStoryNodes = (nodes: FlowNode[], edges: FlowEdge[]) => {
  const storyNodes = nodes.filter((node) => node.type === 'storyNode' && !node.data?.hidden);
  const root = storyNodes.find((node) => node.data?.isRoot) || storyNodes[0];
  if (!root) return [];

  const visited = new Set<string>();
  const ordered: FlowNode[] = [];

  const visit = (nodeId: string) => {
    if (visited.has(nodeId)) return;
    const node = storyNodes.find((item) => item.id === nodeId);
    if (!node) return;
    visited.add(nodeId);
    ordered.push(node);
    edges
      .filter((edge) => edge.source === nodeId)
      .sort((a, b) => String(a.data?.label || '').localeCompare(String(b.data?.label || '')))
      .forEach((edge) => visit(edge.target));
  };

  visit(root.id);
  storyNodes
    .filter((node) => !visited.has(node.id))
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
    .forEach((node) => ordered.push(node));

  return ordered;
};

const readNumber = (value: unknown, fallback: number) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const getNodeSize = (node: FlowNode, fallbackWidth = 220, fallbackHeight = 140) => ({
  width: readNumber(node.width ?? node.measured?.width ?? node.style?.width, fallbackWidth),
  height: readNumber(node.height ?? node.measured?.height ?? node.style?.height, fallbackHeight),
});

const getNodeCenter = (node: FlowNode, fallbackWidth = 220, fallbackHeight = 140) => {
  const size = getNodeSize(node, fallbackWidth, fallbackHeight);
  return {
    x: node.position.x + size.width / 2,
    y: node.position.y + size.height / 2,
  };
};

const pointInRect = (
  point: { x: number; y: number },
  rect: { x: number; y: number; width: number; height: number },
) =>
  point.x >= rect.x &&
  point.x <= rect.x + rect.width &&
  point.y >= rect.y &&
  point.y <= rect.y + rect.height;

const getAssetRegionOptions = (nodes: FlowNode[], isZh: boolean): AssetRegionOption[] => {
  const regionOptions = nodes
    .filter(
      (node) => (node.type === 'groupNode' || node.type === 'backgroundNode') && !node.data?.hidden,
    )
    .map((node) => ({
      id: node.id,
      label: String(
        node.data?.title ||
          (node.type === 'groupNode'
            ? isZh
              ? '动态包裹'
              : 'Dynamic wrap'
            : isZh
              ? '背景区域'
              : 'Background'),
      ),
      type: node.type === 'groupNode' ? ('dynamicGroup' as const) : ('background' as const),
    }));

  return [
    { id: 'all', label: isZh ? '全部素材' : 'All assets', type: 'all' },
    { id: 'outside', label: isZh ? '画布外/未归组' : 'Outside regions', type: 'outside' },
    ...regionOptions,
  ];
};

const getStoryNodeRegion = (node: FlowNode, nodes: FlowNode[]): AssetRegionOption | null => {
  const directGroup = nodes.find((regionNode) => {
    if (regionNode.type !== 'groupNode') return false;
    const childIds = (regionNode.data?.childIds as string[]) || [];
    return childIds.includes(node.id);
  });
  if (directGroup) {
    return {
      id: directGroup.id,
      label: String(directGroup.data?.title || '动态包裹'),
      type: 'dynamicGroup',
    };
  }

  const center = getNodeCenter(node);
  const containingBackgrounds = nodes
    .filter((regionNode) => regionNode.type === 'backgroundNode' && regionNode.id !== node.id)
    .map((regionNode) => {
      const size = getNodeSize(regionNode, 600, 400);
      return {
        node: regionNode,
        area: size.width * size.height,
        rect: {
          x: regionNode.position.x,
          y: regionNode.position.y,
          width: size.width,
          height: size.height,
        },
      };
    })
    .filter((region) => pointInRect(center, region.rect))
    .sort((a, b) => a.area - b.area);

  const background = containingBackgrounds[0]?.node;
  if (!background) return null;
  return {
    id: background.id,
    label: String(background.data?.title || '背景区域'),
    type: 'background',
  };
};

const buildAudioTrack = async (segments: SegmentRenderInfo[], speed: number) => {
  const totalDuration = segments.reduce((sum, segment) => sum + segment.durationSecs, 0);
  if (totalDuration <= 0) return undefined;

  const sampleRate = 48000;
  const context = new OfflineAudioContext(2, Math.ceil(totalDuration * sampleRate), sampleRate);
  let cursor = 0;
  let hasAudio = false;

  for (const segment of segments) {
    const mediaUrl = segment.audioUrl || segment.videoUrl;
    if (mediaUrl) {
      try {
        const bytes = await fetchArrayBuffer(mediaUrl);
        const decoded = await context.decodeAudioData(bytes.slice(0));
        const source = context.createBufferSource();
        source.buffer = decoded;
        source.playbackRate.value = speed;
        source.connect(context.destination);
        source.start(cursor, 0, Math.min(decoded.duration, segment.durationSecs * speed));
        hasAudio = true;
      } catch (error) {
        console.warn('Could not decode render audio track:', error);
      }
    }
    cursor += segment.durationSecs;
  }

  if (!hasAudio) return undefined;
  const rendered = await context.startRendering();
  return encodeWav(rendered);
};

type DragSizeControlProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
};

function DragSizeControl({ label, value, min, max, step, onChange }: DragSizeControlProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const dragRef = useRef<{ startX: number; startValue: number; moved: boolean } | null>(null);

  React.useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [editing, value]);

  const clampValue = (nextValue: number) => Math.min(max, Math.max(min, nextValue));
  const commitDraft = () => {
    const parsed = Number(draft);
    if (Number.isFinite(parsed)) onChange(clampValue(parsed));
    else setDraft(String(value));
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        type="text"
        inputMode="numeric"
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value.replace(/[^\d.]/g, ''))}
        onBlur={commitDraft}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commitDraft();
          if (event.key === 'Escape') {
            setDraft(String(value));
            setEditing(false);
          }
        }}
        className="w-full px-3 py-2 rounded-lg bg-[var(--vr-surface-soft)] border border-[var(--vr-accent)] text-sm font-black text-[var(--vr-text)] outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = { startX: event.clientX, startValue: value, moved: false };
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag) return;
        const delta = event.clientX - drag.startX;
        if (Math.abs(delta) > 3) drag.moved = true;
        if (!drag.moved) return;
        const nextValue = Math.round((drag.startValue + delta * step) / step) * step;
        onChange(clampValue(nextValue));
      }}
      onPointerUp={(event) => {
        const drag = dragRef.current;
        dragRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
        if (!drag?.moved) setEditing(true);
      }}
      className="group w-full px-3 py-2 rounded-lg bg-[var(--vr-surface-soft)] border border-[var(--vr-border)] text-sm text-[var(--vr-text)] flex items-center justify-between cursor-ew-resize hover:border-[var(--vr-accent)] transition-colors select-none"
      title={label}
    >
      <span className="font-black">{value}px</span>
      <MoveHorizontal className="w-4 h-4 text-[var(--vr-text-muted)] group-hover:text-[var(--vr-accent)]" />
    </button>
  );
}

type RangeControlProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  valueLabel?: string;
  disabled?: boolean;
  hideLabel?: boolean;
};

const makeTrackId = (kind: 'video' | 'audio') =>
  `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
  valueLabel,
  disabled,
  hideLabel = false,
}: RangeControlProps) {
  const percent = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const rangeInput = (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value))}
      className="video-render-range w-full"
      style={
        { '--range-progress': `${Math.min(100, Math.max(0, percent))}%` } as React.CSSProperties
      }
    />
  );

  if (hideLabel) {
    return (
      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0 flex-1">{rangeInput}</div>
        <span className="shrink-0 whitespace-nowrap text-[11px] font-black tabular-nums text-[var(--vr-accent-strong)]">
          {valueLabel ?? value}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-[11px] font-black text-[var(--vr-text-soft)]">
        <span>{label}</span>
        <span className="tabular-nums text-[var(--vr-accent-strong)]">{valueLabel ?? value}</span>
      </div>
      {rangeInput}
    </div>
  );
}

type ResizeHandleProps = {
  label: string;
  axis: 'x' | 'y';
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  reverse?: boolean;
};

function ResizeHandle({ label, axis, value, min, max, onChange, reverse }: ResizeHandleProps) {
  const dragRef = useRef<{ startPosition: number; startValue: number } | null>(null);
  const isHorizontal = axis === 'x';

  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation={isHorizontal ? 'vertical' : 'horizontal'}
      tabIndex={0}
      title={label}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = {
          startPosition: isHorizontal ? event.clientX : event.clientY,
          startValue: value,
        };
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag) return;
        const position = isHorizontal ? event.clientX : event.clientY;
        const delta = (position - drag.startPosition) * (reverse ? -1 : 1);
        onChange(clamp(Math.round(drag.startValue + delta), min, max));
      }}
      onPointerUp={(event) => {
        dragRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
      onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        const sign = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
        const nextSign = reverse ? -sign : sign;
        onChange(clamp(value + nextSign * 16, min, max));
      }}
      className={`group relative z-10 shrink-0 outline-none ${
        isHorizontal
          ? '-mx-1 w-2 cursor-col-resize'
          : '-my-1 h-2 cursor-row-resize'
      }`}
    >
      <span
        className={`absolute rounded-full bg-[var(--vr-border-strong)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 group-active:opacity-100 ${
          isHorizontal ? 'inset-y-4 left-1/2 w-0.5 -translate-x-1/2' : 'inset-x-4 top-1/2 h-0.5 -translate-y-1/2'
        }`}
      />
    </div>
  );
}

export function VideoRenderModal({
  nodes,
  edges,
  onClose,
  language,
}: VideoRenderModalProps) {
  const orderedNodes = useMemo(() => getOrderedStoryNodes(nodes, edges), [nodes, edges]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(orderedNodes.map((node) => node.id)),
  );
  const [timelineIds, setTimelineIds] = useState<string[]>(() =>
    orderedNodes.map((node) => node.id),
  );
  const [videoTrackIds, setVideoTrackIds] = useState<string[]>(() => ['video-1']);
  const [audioTrackIds, setAudioTrackIds] = useState<string[]>(() => ['audio-1']);
  const [videoTrackByNodeId, setVideoTrackByNodeId] = useState<Record<string, string>>(() =>
    Object.fromEntries(orderedNodes.map((node) => [node.id, 'video-1'])),
  );
  const [audioTrackByNodeId, setAudioTrackByNodeId] = useState<Record<string, string>>(() =>
    Object.fromEntries(orderedNodes.map((node) => [node.id, 'audio-1'])),
  );
  const [timelinePast, setTimelinePast] = useState<TimelineHistoryState[]>([]);
  const [timelineFuture, setTimelineFuture] = useState<TimelineHistoryState[]>([]);
  const [activePreviewId, setActivePreviewId] = useState<string>(() => orderedNodes[0]?.id || '');
  const [assetRegionFilter, setAssetRegionFilter] = useState('all');
  const [resolutionIndex, setResolutionIndex] = useState(0);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('mp4');
  const [speed, setSpeed] = useState(1);
  const [defaultSeconds, setDefaultSeconds] = useState(4);
  const [animationLeadSeconds, setAnimationLeadSeconds] = useState(0);
  const [frameRate, setFrameRate] = useState(30);
  const [encoder, setEncoder] = useState('libx264');
  const [typewriterEnabled, setTypewriterEnabled] = useState(true);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [outputDir, setOutputDir] = useState('');
  const [renderStyle, setRenderStyle] = useState<RenderStyle>({
    titleFontSize: 56,
    bodyFontSize: 38,
    titleColor: '#ffffff',
    bodyColor: '#f8fafc',
    panelColor: '#111827',
    titleAnimation: 'none',
    bodyAnimation: 'typewriter',
  });
  const [status, setStatus] = useState<RenderStatus>('idle');
  const [progress, setProgress] = useState('');
  const [progressValue, setProgressValue] = useState(0);
  const [estimatedDuration, setEstimatedDuration] = useState(0);
  const [previewTime, setPreviewTime] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(defaultSeconds);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [assetPanelWidth, setAssetPanelWidth] = useState(320);
  const [exportPanelWidth, setExportPanelWidth] = useState(380);
  const [timelineHeight, setTimelineHeight] = useState(250);
  const [timelineScaleMode, setTimelineScaleMode] = useState<TimelineScaleMode>('seconds');
  const [timelineWheelMode, setTimelineWheelMode] = useState<TimelineWheelMode>('horizontal');
  const [timelinePixelsPerSecond, setTimelinePixelsPerSecond] = useState(TIMELINE_PIXELS_PER_SECOND);
  const [timelineDisplayDuration, setTimelineDisplayDuration] = useState(60);
  const [timelineDurationById, setTimelineDurationById] = useState<Record<string, number>>({});
  const [timelineScrollInfo, setTimelineScrollInfo] = useState({
    scrollLeft: 0,
    scrollWidth: 1,
    clientWidth: 1,
  });
  const [error, setError] = useState('');
  const [savedPath, setSavedPath] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const timelineViewportRef = useRef<HTMLDivElement>(null);
  const timelineScrubRef = useRef(false);
  const timelineScaleDragRef = useRef<{
    side: 'left' | 'right';
    anchorTrackX: number;
    trackWidth: number;
  } | null>(null);
  const timelineScrollDragRef = useRef<{
    startX: number;
    startScrollLeft: number;
    trackWidth: number;
  } | null>(null);
  const preservePreviewTimeOnNodeChangeRef = useRef(false);
  const previewVideoRef = useRef<{ url: string; video: HTMLVideoElement } | null>(null);
  const previewDrawIdRef = useRef(0);

  const nodeById = useMemo(
    () => new Map(orderedNodes.map((node) => [node.id, node])),
    [orderedNodes],
  );
  const timelineNodes = useMemo(
    () => timelineIds.map((id) => nodeById.get(id)).filter(Boolean) as FlowNode[],
    [nodeById, timelineIds],
  );
  const selectedNodes = useMemo(
    () => timelineNodes.filter((node) => selectedIds.has(node.id)),
    [timelineNodes, selectedIds],
  );
  const activePreviewNode = nodeById.get(activePreviewId) || selectedNodes[0] || orderedNodes[0];
  const resolution = RESOLUTION_OPTIONS[resolutionIndex] || RESOLUTION_OPTIONS[0];
  const isZh = language === 'zh';
  const fallbackEstimatedSeconds = (selectedNodes.length * defaultSeconds) / speed;
  const assetRegionOptions = useMemo(() => getAssetRegionOptions(nodes, isZh), [nodes, isZh]);
  const viewportWidth = typeof window === 'undefined' ? 1280 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 800 : window.innerHeight;
  const assetPanelMax = Math.max(
    PANEL_SIZE_LIMITS.asset.min,
    Math.min(PANEL_SIZE_LIMITS.asset.max, viewportWidth - exportPanelWidth - MIN_PREVIEW_WIDTH),
  );
  const exportPanelMax = Math.max(
    PANEL_SIZE_LIMITS.export.min,
    Math.min(PANEL_SIZE_LIMITS.export.max, viewportWidth - assetPanelWidth - MIN_PREVIEW_WIDTH),
  );
  const timelineMax = Math.max(
    PANEL_SIZE_LIMITS.timeline.min,
    Math.min(PANEL_SIZE_LIMITS.timeline.max, viewportHeight - HEADER_HEIGHT - MIN_MAIN_HEIGHT),
  );
  const nodeRegionById = useMemo(() => {
    const entries = orderedNodes.map((node) => [node.id, getStoryNodeRegion(node, nodes)] as const);
    return new Map(entries);
  }, [orderedNodes, nodes]);
  const visibleAssetNodes = useMemo(() => {
    if (assetRegionFilter === 'all') return orderedNodes;
    if (assetRegionFilter === 'outside')
      return orderedNodes.filter((node) => !nodeRegionById.get(node.id));
    return orderedNodes.filter((node) => nodeRegionById.get(node.id)?.id === assetRegionFilter);
  }, [assetRegionFilter, orderedNodes, nodeRegionById]);
  const timelineMetrics = useMemo(() => {
    let cursor = 0;
    const segments = timelineNodes.map((node) => {
      const mediaDuration = timelineDurationById[node.id] || defaultSeconds;
      const duration = Math.max(0.25, mediaDuration / speed);
      const metric = {
        node,
        start: cursor,
        duration,
        end: cursor + duration,
      };
      cursor += duration;
      return metric;
    });
    const totalDuration = Math.max(0.25, cursor);
    const displayDuration = Math.max(totalDuration, timelineDisplayDuration);
    const width = Math.max(1, Math.ceil(displayDuration * timelinePixelsPerSecond));
    return {
      segments,
      totalDuration,
      displayDuration,
      width,
      pixelsPerSecond: width / displayDuration,
    };
  }, [
    defaultSeconds,
    speed,
    timelineDisplayDuration,
    timelineDurationById,
    timelineNodes,
    timelinePixelsPerSecond,
  ]);
  const timelineMetricById = useMemo(
    () => new Map(timelineMetrics.segments.map((metric) => [metric.node.id, metric])),
    [timelineMetrics.segments],
  );
  const activeTimelineMetric = activePreviewNode
    ? timelineMetricById.get(activePreviewNode.id)
    : undefined;
  const activeTimelineTime = activeTimelineMetric
    ? clamp(activeTimelineMetric.start + previewTime / speed, 0, timelineMetrics.totalDuration)
    : 0;
  const activeTimelineFrame = Math.floor(activeTimelineTime * frameRate);
  const timelinePlayheadLeft = activeTimelineTime * timelineMetrics.pixelsPerSecond;
  const timelineTickSettings = getTimelineTickSettings(
    timelineMetrics.pixelsPerSecond,
    timelineScaleMode,
    frameRate,
  );
  const timelineTicks = useMemo(() => {
    const ticks: number[] = [];
    for (
      let time = 0;
      time <= timelineMetrics.displayDuration + 0.001;
      time += timelineTickSettings.step
    ) {
      ticks.push(Number(time.toFixed(3)));
    }
    if (ticks[ticks.length - 1] !== timelineMetrics.displayDuration) {
      ticks.push(timelineMetrics.displayDuration);
    }
    return ticks;
  }, [timelineMetrics.displayDuration, timelineTickSettings.step]);

  const captureTimelineState = (): TimelineHistoryState => ({
    timelineIds: [...timelineIds],
    selectedIds: [...selectedIds],
    videoTrackIds: [...videoTrackIds],
    audioTrackIds: [...audioTrackIds],
    videoTrackByNodeId: { ...videoTrackByNodeId },
    audioTrackByNodeId: { ...audioTrackByNodeId },
    activePreviewId,
  });

  const restoreTimelineState = (snapshot: TimelineHistoryState) => {
    setTimelineIds(snapshot.timelineIds);
    setSelectedIds(new Set(snapshot.selectedIds));
    setVideoTrackIds(snapshot.videoTrackIds);
    setAudioTrackIds(snapshot.audioTrackIds);
    setVideoTrackByNodeId(snapshot.videoTrackByNodeId);
    setAudioTrackByNodeId(snapshot.audioTrackByNodeId);
    setActivePreviewId(snapshot.activePreviewId);
  };

  const pushTimelineHistory = () => {
    setTimelinePast((prev) => [...prev, captureTimelineState()]);
    setTimelineFuture([]);
  };

  const undoTimeline = () => {
    if (timelinePast.length === 0 || status === 'rendering') return;
    const previous = timelinePast[timelinePast.length - 1];
    setTimelinePast((prev) => prev.slice(0, -1));
    setTimelineFuture((prev) => [captureTimelineState(), ...prev]);
    restoreTimelineState(previous);
  };

  const redoTimeline = () => {
    if (timelineFuture.length === 0 || status === 'rendering') return;
    const next = timelineFuture[0];
    setTimelineFuture((prev) => prev.slice(1));
    setTimelinePast((prev) => [...prev, captureTimelineState()]);
    restoreTimelineState(next);
  };

  const seekTimelineTime = (time: number, options?: { keepPlaying?: boolean }) => {
    const nextTime = clamp(time, 0, timelineMetrics.totalDuration);
    const segment =
      timelineMetrics.segments.find((metric) => nextTime >= metric.start && nextTime < metric.end) ||
      timelineMetrics.segments[timelineMetrics.segments.length - 1];
    if (!segment) return;

    if (segment.node.id !== activePreviewId) {
      preservePreviewTimeOnNodeChangeRef.current = true;
    }
    setActivePreviewId(segment.node.id);
    setPreviewTime(clamp((nextTime - segment.start) * speed, 0, segment.duration * speed));
    if (!options?.keepPlaying) setPreviewPlaying(false);
  };

  const seekTimelineFromClientX = (clientX: number, rect: DOMRect, options?: { keepPlaying?: boolean }) => {
    const offset = clamp(clientX - rect.left, 0, rect.width);
    seekTimelineTime(offset / timelineMetrics.pixelsPerSecond, options);
  };

  const handleTimelineScrubStart = (event: React.PointerEvent<HTMLElement>) => {
    if (status === 'rendering') return;
    event.preventDefault();
    event.stopPropagation();
    const element = event.currentTarget;
    element.setPointerCapture(event.pointerId);
    timelineScrubRef.current = true;
    seekTimelineFromClientX(event.clientX, element.getBoundingClientRect());
  };

  const handleTimelineScrubMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!timelineScrubRef.current || status === 'rendering') return;
    event.preventDefault();
    seekTimelineFromClientX(event.clientX, event.currentTarget.getBoundingClientRect());
  };

  const handleTimelineScrubEnd = (event: React.PointerEvent<HTMLElement>) => {
    timelineScrubRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const syncTimelineScrollInfo = () => {
    const element = timelineViewportRef.current;
    if (!element) return;
    setTimelineScrollInfo({
      scrollLeft: element.scrollLeft,
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    });
  };

  const updateTimelineScale = (nextScale: number) => {
    const element = timelineViewportRef.current;
    const centerRatio =
      element && element.scrollWidth > 0
        ? (element.scrollLeft + element.clientWidth / 2) / element.scrollWidth
        : 0.5;
    setTimelinePixelsPerSecond(
      clamp(nextScale, TIMELINE_MIN_PIXELS_PER_SECOND, TIMELINE_MAX_PIXELS_PER_SECOND),
    );
    window.requestAnimationFrame(() => {
      const nextElement = timelineViewportRef.current;
      if (!nextElement) return;
      nextElement.scrollLeft = Math.max(
        0,
        centerRatio * nextElement.scrollWidth - nextElement.clientWidth / 2,
      );
      syncTimelineScrollInfo();
    });
  };

  const applyTimelineViewportWindow = (
    leftTrackX: number,
    rightTrackX: number,
    trackWidth: number,
    activeSide: 'left' | 'right',
  ) => {
    const element = timelineViewportRef.current;
    if (!element || trackWidth <= 0) return;
    const viewportWidth = Math.max(1, element.clientWidth);
    const minWindowWidth = Math.min(trackWidth, 10);
    const windowLeft = clamp(Math.min(leftTrackX, rightTrackX - minWindowWidth), 0, trackWidth - minWindowWidth);
    const windowRight = clamp(Math.max(rightTrackX, windowLeft + minWindowWidth), windowLeft + minWindowWidth, trackWidth);
    const windowWidth = Math.max(minWindowWidth, windowRight - windowLeft);
    const targetScrollWidth = (viewportWidth * trackWidth) / windowWidth;
    const nextScale = clamp(
      targetScrollWidth / timelineMetrics.displayDuration,
      TIMELINE_MIN_PIXELS_PER_SECOND,
      TIMELINE_MAX_PIXELS_PER_SECOND,
    );

    setTimelinePixelsPerSecond(nextScale);
    window.requestAnimationFrame(() => {
      const nextElement = timelineViewportRef.current;
      if (!nextElement) return;
      const nextScrollWidth = Math.max(1, timelineMetrics.displayDuration * nextScale);
      const targetScrollLeft =
        activeSide === 'right'
          ? (windowRight / trackWidth) * nextScrollWidth - nextElement.clientWidth
          : (windowLeft / trackWidth) * nextScrollWidth;
      nextElement.scrollLeft = clamp(
        targetScrollLeft,
        0,
        Math.max(0, nextScrollWidth - nextElement.clientWidth),
      );
      syncTimelineScrollInfo();
    });
  };

  const handleTimelineScrollThumbStart = (event: React.PointerEvent<HTMLDivElement>) => {
    const element = timelineViewportRef.current;
    if (!element) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    timelineScrollDragRef.current = {
      startX: event.clientX,
      startScrollLeft: element.scrollLeft,
      trackWidth: event.currentTarget.parentElement?.clientWidth || 1,
    };
  };

  const handleTimelineScrollThumbMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = timelineScrollDragRef.current;
    const element = timelineViewportRef.current;
    if (!drag || !element) return;
    const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);
    const maxThumbTravel = Math.max(1, drag.trackWidth - (element.clientWidth / element.scrollWidth) * drag.trackWidth);
    element.scrollLeft = clamp(
      drag.startScrollLeft + ((event.clientX - drag.startX) / maxThumbTravel) * maxScrollLeft,
      0,
      maxScrollLeft,
    );
    syncTimelineScrollInfo();
  };

  const handleTimelineScrollThumbEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    timelineScrollDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleTimelineScaleHandleStart = (
    event: React.PointerEvent<HTMLButtonElement>,
    side: 'left' | 'right',
  ) => {
    const track = event.currentTarget.parentElement?.parentElement;
    if (!track) return;
    const trackWidth = track.clientWidth || 1;
    const thumbLeft = (timelineThumbLeftPercent / 100) * trackWidth;
    const thumbRight = thumbLeft + (timelineThumbWidthPercent / 100) * trackWidth;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    timelineScaleDragRef.current = {
      side,
      anchorTrackX: side === 'left' ? thumbRight : thumbLeft,
      trackWidth,
    };
  };

  const handleTimelineScaleHandleMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = timelineScaleDragRef.current;
    if (!drag) return;
    event.preventDefault();
    event.stopPropagation();
    const track = event.currentTarget.parentElement?.parentElement;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const pointerTrackX = clamp(event.clientX - rect.left, 0, drag.trackWidth);
    if (drag.side === 'left') {
      applyTimelineViewportWindow(pointerTrackX, drag.anchorTrackX, drag.trackWidth, 'left');
      return;
    }
    applyTimelineViewportWindow(drag.anchorTrackX, pointerTrackX, drag.trackWidth, 'right');
  };

  const handleTimelineScaleHandleEnd = (event: React.PointerEvent<HTMLButtonElement>) => {
    timelineScaleDragRef.current = null;
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  React.useEffect(() => {
    const validIds = new Set(orderedNodes.map((node) => node.id));
    setTimelineIds((prev) => {
      const kept = prev.filter((id) => validIds.has(id));
      const missing = orderedNodes.map((node) => node.id).filter((id) => !kept.includes(id));
      return [...kept, ...missing];
    });
    setSelectedIds((prev) => new Set([...prev].filter((id) => validIds.has(id))));
    setActivePreviewId((prev) => (prev && validIds.has(prev) ? prev : orderedNodes[0]?.id || ''));
    setVideoTrackByNodeId((prev) => {
      const next: Record<string, string> = {};
      orderedNodes.forEach((node) => {
        next[node.id] = videoTrackIds.includes(prev[node.id]) ? prev[node.id] : videoTrackIds[0];
      });
      return next;
    });
    setAudioTrackByNodeId((prev) => {
      const next: Record<string, string> = {};
      orderedNodes.forEach((node) => {
        next[node.id] = audioTrackIds.includes(prev[node.id]) ? prev[node.id] : audioTrackIds[0];
      });
      return next;
    });
  }, [orderedNodes, videoTrackIds, audioTrackIds]);

  React.useEffect(() => {
    if (assetRegionFilter === 'all' || assetRegionFilter === 'outside') return;
    if (!assetRegionOptions.some((option) => option.id === assetRegionFilter)) {
      setAssetRegionFilter('all');
    }
  }, [assetRegionFilter, assetRegionOptions]);

  React.useEffect(() => {
    if (preservePreviewTimeOnNodeChangeRef.current) {
      preservePreviewTimeOnNodeChangeRef.current = false;
      return;
    }
    setPreviewTime(0);
    setPreviewPlaying(false);
  }, [activePreviewNode?.id]);

  React.useEffect(() => {
    setPreviewTime((prev) => Math.min(prev, previewDuration));
  }, [previewDuration]);

  React.useEffect(() => {
    setAssetPanelWidth((prev) => clamp(prev, PANEL_SIZE_LIMITS.asset.min, assetPanelMax));
  }, [assetPanelMax]);

  React.useEffect(() => {
    setExportPanelWidth((prev) => clamp(prev, PANEL_SIZE_LIMITS.export.min, exportPanelMax));
  }, [exportPanelMax]);

  React.useEffect(() => {
    setTimelineHeight((prev) => clamp(prev, PANEL_SIZE_LIMITS.timeline.min, timelineMax));
  }, [timelineMax]);

  React.useEffect(() => {
    const viewportSeconds = Math.max(
      1,
      timelineScrollInfo.clientWidth / Math.max(1, timelineMetrics.pixelsPerSecond),
    );
    const minimumDisplayDuration = Math.max(60, timelineMetrics.totalDuration + viewportSeconds * 2);
    if (timelineDisplayDuration < minimumDisplayDuration) {
      setTimelineDisplayDuration(Math.ceil(minimumDisplayDuration));
    }
  }, [
    timelineDisplayDuration,
    timelineMetrics.pixelsPerSecond,
    timelineMetrics.totalDuration,
    timelineScrollInfo.clientWidth,
  ]);

  React.useEffect(() => {
    syncTimelineScrollInfo();
  }, [timelineMetrics.width, timelineHeight]);

  React.useEffect(() => {
    if (!isTauriRuntime()) return;
    let cancelled = false;
    const loadDefaultDir = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const result = await invoke<TauriRenderSaveResult>('default_render_dir');
        if (!cancelled) setOutputDir(result.path);
      } catch {
        if (!cancelled) setOutputDir('');
      }
    };
    loadDefaultDir();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const measureDuration = async () => {
      let total = 0;
      for (const node of selectedNodes) {
        if (cancelled) return;
        total += await getNodeMediaDuration(node);
      }
      if (!cancelled) setEstimatedDuration(total / speed);
    };
    measureDuration();
    return () => {
      cancelled = true;
    };
  }, [selectedNodes, defaultSeconds, speed]);

  const toggleNode = (id: string) => {
    pushTimelineHistory();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addNodeToTimeline = (
    id: string,
    trackKind: 'video' | 'audio' = 'video',
    trackId?: string,
  ) => {
    if (!nodeById.has(id)) return;
    pushTimelineHistory();
    setTimelineIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    if (trackKind === 'video' && trackId) {
      setVideoTrackByNodeId((prev) => ({ ...prev, [id]: trackId }));
    }
    if (trackKind === 'audio' && trackId) {
      setAudioTrackByNodeId((prev) => ({ ...prev, [id]: trackId }));
    }
    setSelectedIds((prev) => new Set(prev).add(id));
    setActivePreviewId(id);
  };

  const reorderTimelineNode = (
    dragId: string,
    targetId: string,
    placement: 'before' | 'after' = 'before',
  ) => {
    if (!dragId || !targetId || dragId === targetId) return;
    pushTimelineHistory();
    setTimelineIds((prev) => {
      const withoutDragged = prev.filter((id) => id !== dragId);
      const targetIndex = withoutDragged.indexOf(targetId);
      if (targetIndex < 0) return prev;
      const next = [...withoutDragged];
      next.splice(placement === 'after' ? targetIndex + 1 : targetIndex, 0, dragId);
      return next;
    });
  };

  const removeTimelineNode = (id: string) => {
    if (!timelineIds.includes(id)) return;
    pushTimelineHistory();
    setTimelineIds((prev) => prev.filter((item) => item !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (activePreviewId === id) {
      const nextNode =
        timelineNodes.find((node) => node.id !== id) || orderedNodes.find((node) => node.id !== id);
      setActivePreviewId(nextNode?.id || '');
    }
    setVideoTrackByNodeId((prev) => {
      const { [id]: _removed, ...next } = prev;
      return next;
    });
    setAudioTrackByNodeId((prev) => {
      const { [id]: _removed, ...next } = prev;
      return next;
    });
  };

  const removeVideoTrack = (trackId: string) => {
    if (videoTrackIds.length <= 1) return;
    pushTimelineHistory();
    setVideoTrackIds((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((id) => id !== trackId);
      setVideoTrackByNodeId((map) =>
        Object.fromEntries(
          Object.entries(map).map(([nodeId, assignedTrackId]) => [
            nodeId,
            assignedTrackId === trackId ? next[0] : assignedTrackId,
          ]),
        ),
      );
      return next;
    });
  };

  const removeAudioTrack = (trackId: string) => {
    if (audioTrackIds.length <= 1) return;
    pushTimelineHistory();
    setAudioTrackIds((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((id) => id !== trackId);
      setAudioTrackByNodeId((map) =>
        Object.fromEntries(
          Object.entries(map).map(([nodeId, assignedTrackId]) => [
            nodeId,
            assignedTrackId === trackId ? next[0] : assignedTrackId,
          ]),
        ),
      );
      return next;
    });
  };

  const addVideoTrack = () => {
    pushTimelineHistory();
    setVideoTrackIds((prev) => [...prev, makeTrackId('video')]);
  };

  const addAudioTrack = () => {
    pushTimelineHistory();
    setAudioTrackIds((prev) => [...prev, makeTrackId('audio')]);
  };

  const handleAssetDragStart = (
    event: React.DragEvent,
    id: string,
    trackKind?: 'video' | 'audio',
  ) => {
    event.stopPropagation();
    event.dataTransfer.setData('application/x-galwriter-node', id);
    if (trackKind) event.dataTransfer.setData('application/x-galwriter-track-kind', trackKind);
    event.dataTransfer.setData('text/plain', id);
    event.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleTimelineDrop = (
    event: React.DragEvent,
    targetId?: string,
    trackId?: string,
    trackKind?: 'video' | 'audio',
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const draggedId =
      event.dataTransfer.getData('application/x-galwriter-node') ||
      event.dataTransfer.getData('text/plain');
    if (!draggedId) return;
    const droppedTrackKind =
      trackKind ||
      (event.dataTransfer.getData('application/x-galwriter-track-kind') as 'video' | 'audio') ||
      'video';
    if (targetId && timelineIds.includes(draggedId)) {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const currentTrackId =
        droppedTrackKind === 'video'
          ? videoTrackByNodeId[draggedId] || videoTrackIds[0]
          : audioTrackByNodeId[draggedId] || audioTrackIds[0];
      if (draggedId === targetId && trackId && currentTrackId !== trackId) {
        pushTimelineHistory();
      }
      reorderTimelineNode(
        draggedId,
        targetId,
        event.clientX > rect.left + rect.width / 2 ? 'after' : 'before',
      );
      if (trackId && droppedTrackKind === 'video') {
        setVideoTrackByNodeId((prev) => ({ ...prev, [draggedId]: trackId }));
      }
      if (trackId && droppedTrackKind === 'audio') {
        setAudioTrackByNodeId((prev) => ({ ...prev, [draggedId]: trackId }));
      }
    } else addNodeToTimeline(draggedId, droppedTrackKind, trackId);
  };

  const handleTimelineWheel = (event: WheelEvent) => {
    if (timelineWheelMode === 'vertical') return;
    event.preventDefault();
    event.stopPropagation();
    const element = timelineViewportRef.current;
    if (!element) return;
    const maxScrollLeft = element.scrollWidth - element.clientWidth;
    const scrollDelta =
      Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (maxScrollLeft <= 0 || scrollDelta === 0) return;

    const movingRight = scrollDelta > 0;
    const canMoveRight = element.scrollLeft < maxScrollLeft - 1;
    const canMoveLeft = element.scrollLeft > 1;
    if ((movingRight && canMoveRight) || (!movingRight && canMoveLeft)) {
      element.scrollLeft += scrollDelta;
      syncTimelineScrollInfo();
      return;
    }

    if (movingRight && !canMoveRight) {
      const viewportSeconds = Math.max(
        1,
        element.clientWidth / Math.max(1, timelineMetrics.pixelsPerSecond),
      );
      setTimelineDisplayDuration((prev) => Math.ceil(prev + Math.max(30, viewportSeconds * 2)));
    }
  };

  React.useEffect(() => {
    const element = timelineViewportRef.current;
    if (!element) return;
    element.addEventListener('wheel', handleTimelineWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleTimelineWheel);
  }, [handleTimelineWheel]);

  React.useEffect(() => {
    const handleRenderKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const modifier = event.ctrlKey || event.metaKey;
      const target = event.target as HTMLElement | null;
      const isEditingText =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        !!target?.isContentEditable;
      if (isEditingText) return;

      if (event.code === 'Space' && !modifier && !event.altKey && !event.shiftKey) {
        event.stopPropagation();
        event.preventDefault();
        if (!activePreviewNode || status === 'rendering') return;
        if (activeTimelineTime >= timelineMetrics.totalDuration - 0.001) {
          seekTimelineTime(0, { keepPlaying: true });
        }
        setPreviewPlaying((prev) => !prev);
        return;
      }

      if (!modifier || (key !== 'z' && key !== 'y')) return;

      event.stopPropagation();
      event.preventDefault();
      if (key === 'z' && event.shiftKey) redoTimeline();
      else if (key === 'z') undoTimeline();
      else redoTimeline();
    };

    document.addEventListener('keydown', handleRenderKeyDown, true);
    return () => document.removeEventListener('keydown', handleRenderKeyDown, true);
  });

  const updateRenderStyle = <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => {
    setRenderStyle((prev) => ({ ...prev, [key]: value }));
  };

  const updateProgress = (label: string, current: number, total: number) => {
    const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
    setProgress(`${label} ${percent}%`);
    setProgressValue(percent);
  };

  const getNodeMediaDuration = async (node: FlowNode) => {
    const videoUrl = node.data?.videoUrl as string | undefined;
    const audioUrl = node.data?.audioUrl as string | undefined;
    let videoDuration = 0;
    let audioDuration = 0;

    if (videoUrl) {
      try {
        const video = await loadVideo(videoUrl);
        videoDuration = validDuration(video.duration);
      } catch {
        videoDuration = 0;
      }
    }

    if (audioUrl) {
      audioDuration = validDuration(await getAudioDuration(audioUrl));
    }

    return Math.max(videoDuration, audioDuration, defaultSeconds);
  };

  const getNodeRenderDuration = async (node: FlowNode) => {
    return (await getNodeMediaDuration(node)) / speed;
  };

  React.useEffect(() => {
    let cancelled = false;
    const measureTimelineDurations = async () => {
      const entries: [string, number][] = [];
      for (const node of timelineNodes) {
        if (cancelled) return;
        entries.push([node.id, await getNodeMediaDuration(node)]);
      }
      if (!cancelled) setTimelineDurationById(Object.fromEntries(entries));
    };
    measureTimelineDurations();
    return () => {
      cancelled = true;
    };
  }, [timelineNodes, defaultSeconds]);

  const renderStaticFramesWithFfmpeg = async () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx)
      throw new Error(isZh ? '预览画布不可用。' : 'Preview canvas is unavailable.');

    const { invoke } = await import('@tauri-apps/api/core');
    canvas.width = resolution.width;
    canvas.height = resolution.height;

    const frames: RenderedFramePayload[] = [];
    const audioSegments: SegmentRenderInfo[] = [];
    for (let index = 0; index < selectedNodes.length; index += 1) {
      const node = selectedNodes[index];
      const durationSecs = await getNodeRenderDuration(node);
      updateProgress(
        isZh ? '生成图片帧' : 'Rendering still frames',
        index + 1,
        selectedNodes.length + 2,
      );
      await drawFrame(
        ctx,
        node,
        resolution.width,
        resolution.height,
        undefined,
        undefined,
        undefined,
        true,
      );
      frames.push({
        bytes: await canvasToPngBytes(canvas),
        durationSecs,
      });
      audioSegments.push({
        node,
        durationSecs,
        audioUrl: node.data?.audioUrl as string | undefined,
        videoUrl: node.data?.videoUrl as string | undefined,
      });
    }

    updateProgress(
      isZh ? '合成音频轨' : 'Mixing audio track',
      selectedNodes.length + 1,
      selectedNodes.length + 2,
    );
    const audioBytes = await buildAudioTrack(audioSegments, speed);
    updateProgress(
      isZh ? '调用 FFmpeg 导出' : 'Exporting with FFmpeg',
      selectedNodes.length + 2,
      selectedNodes.length + 2,
    );
    const result = await invoke<TauriRenderSaveResult>('save_rendered_frames', {
      fileName: `galwriter-render-${Date.now()}`,
      format: exportFormat,
      frames,
      audioBytes,
      outputDir,
      videoBitrate: DEFAULT_VIDEO_BITRATE,
    });
    setSavedPath(result.path);
  };

  const writeZipAssetsToSession = async (
    zip: JSZip,
    workDir: string,
    invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>,
  ) => {
    const assetFiles = Object.values(zip.files).filter(
      (file) => !file.dir && file.name.startsWith('assets/'),
    );
    for (let fileIndex = 0; fileIndex < assetFiles.length; fileIndex += 1) {
      const file = assetFiles[fileIndex];
      const bytes = new Uint8Array(await file.async('arraybuffer'));
      for (let offset = 0; offset < bytes.length; offset += ASSET_CHUNK_SIZE) {
        await invoke('write_render_asset_chunk', {
          workDir,
          assetPath: file.name,
          bytes: Array.from(bytes.slice(offset, offset + ASSET_CHUNK_SIZE)),
          append: offset > 0,
        });
      }
      updateProgress(
        isZh ? '写入 ZIP 素材' : 'Writing ZIP assets',
        fileIndex + 1,
        assetFiles.length,
      );
    }
  };

  const renderFromZipProject = async () => {
    if (!zipFile) {
      throw new Error(
        isZh ? '请先选择已经保存好的剧本 ZIP。' : 'Please choose a saved project ZIP first.',
      );
    }

    const { invoke } = await import('@tauri-apps/api/core');
    updateProgress(isZh ? '读取 ZIP 工程' : 'Reading ZIP project', 5, 100);
    const zip = await JSZip.loadAsync(zipFile);
    const projectJson = zip.file('project.json');
    if (!projectJson)
      throw new Error(
        isZh ? 'ZIP 中没有 project.json。' : 'project.json was not found in the ZIP.',
      );
    const projectData = JSON.parse(await projectJson.async('string'));
    const zipNodes = (projectData.nodes || []) as FlowNode[];
    const zipEdges = (projectData.edges || []) as FlowEdge[];
    const orderedZipNodes = getOrderedStoryNodes(zipNodes, zipEdges).filter((node) =>
      selectedIds.has(node.id),
    );
    if (orderedZipNodes.length === 0)
      throw new Error(
        isZh ? 'ZIP 工程里没有选中的片段。' : 'No selected segments were found in the ZIP.',
      );

    const fileName = `galwriter-render-${Date.now()}`;
    const session = await invoke<TauriRenderSessionResult>('create_render_session', {
      fileName,
      outputDir,
    });
    await writeZipAssetsToSession(zip, session.workDir, invoke);

    const segments: HighPerfSegmentPayload[] = orderedZipNodes.map((node) => ({
      title: stripHtml(String(node.data?.title || '')),
      text: stripHtml(String(node.data?.text || '')),
      imagePath: normalizeAssetPath(node.data?.imageUrl as string | undefined),
      videoPath: normalizeAssetPath(node.data?.videoUrl as string | undefined),
      audioPath: normalizeAssetPath(node.data?.audioUrl as string | undefined),
    }));

    updateProgress(isZh ? '调用 FFmpeg 高性能渲染' : 'High performance FFmpeg render', 96, 100);
    const result = await invoke<TauriRenderSaveResult>('finish_high_perf_render', {
      fileName,
      format: exportFormat,
      workDir: session.workDir,
      segments,
      width: resolution.width,
      height: resolution.height,
      frameRate,
      speed,
      defaultSeconds,
      outputDir,
      encoder,
      typewriter: renderStyle.bodyAnimation === 'typewriter',
      textStyle: {
        titleFontSize: renderStyle.titleFontSize,
        bodyFontSize: renderStyle.bodyFontSize,
        titleColor: renderStyle.titleColor,
        bodyColor: renderStyle.bodyColor,
      },
    });
    setSavedPath(result.path);
    setStatus('done');
    setProgressValue(100);
    setProgress(isZh ? '导出完成 100%' : 'Export complete 100%');
  };

  const revealLines = (lines: string[], visibleChars: number) => {
    let remaining = visibleChars;
    return lines.map((line) => {
      if (remaining <= 0) return '';
      const shown = line.slice(0, remaining);
      remaining -= line.length;
      return shown;
    });
  };

  const animatedTextState = (
    animation: TextAnimation,
    lines: string[],
    elapsed?: number,
    duration?: number,
    forceFinal = false,
  ) => {
    if (forceFinal || !elapsed || !duration || animation === 'none') {
      return { lines, alpha: 1, offsetY: 0 };
    }

    const animationDuration = Math.max(0.1, duration - animationLeadSeconds);
    const progress = Math.min(1, Math.max(0, elapsed / animationDuration));
    if (animation === 'fade') {
      return { lines, alpha: progress, offsetY: 0 };
    }
    if (animation === 'slideUp') {
      return { lines, alpha: progress, offsetY: (1 - progress) * 28 };
    }

    const totalChars = lines.reduce((sum, line) => sum + line.length, 0);
    return {
      lines: revealLines(lines, Math.ceil(totalChars * progress)),
      alpha: 1,
      offsetY: 0,
    };
  };

  const drawFrame = async (
    ctx: CanvasRenderingContext2D,
    node: FlowNode,
    width: number,
    height: number,
    media?: { source: CanvasImageSource; width: number; height: number },
    elapsed?: number,
    duration?: number,
    forceFinalText = false,
  ) => {
    const title = htmlToSpeechText(String(node.data?.title || ''));
    const body = htmlToSpeechText(String(node.data?.text || ''));
    const imageUrl = !media ? (node.data?.imageUrl as string | undefined) : undefined;
    let image: HTMLImageElement | undefined;
    let imageFailed = false;

    if (imageUrl) {
      try {
        image = await loadCachedImage(imageUrl);
      } catch {
        imageFailed = true;
      }
    }

    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, width, height);

    if (media) {
      drawCoverImage(
        ctx,
        media.source,
        media.width || width,
        media.height || height,
        width,
        height,
      );
    } else if (image) {
      drawCoverImage(
        ctx,
        image,
        image.naturalWidth || width,
        image.naturalHeight || height,
        width,
        height,
      );
    } else if (imageFailed) {
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, width, height);
    }

    const gradient = ctx.createLinearGradient(0, height * 0.45, 0, height);
    gradient.addColorStop(0, 'rgba(17, 24, 39, 0)');
    gradient.addColorStop(1, 'rgba(17, 24, 39, 0.88)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const margin = Math.max(48, width * 0.07);
    const titleSize = Math.max(18, renderStyle.titleFontSize);
    const bodySize = Math.max(16, renderStyle.bodyFontSize);
    const titleLineHeight = Math.round(titleSize * 1.25);
    const bodyLineHeight = Math.round(bodySize * 1.45);
    const maxTextWidth = width - margin * 2;

    ctx.font = `800 ${titleSize}px "Microsoft YaHei", "Noto Sans SC", Arial, sans-serif`;
    const titleLines = wrapText(
      ctx,
      title || (isZh ? '未命名片段' : 'Untitled segment'),
      maxTextWidth,
    ).slice(0, 2);
    ctx.font = `500 ${bodySize}px "Microsoft YaHei", "Noto Sans SC", Arial, sans-serif`;
    const bodyLines = wrapText(ctx, body || '', maxTextWidth).slice(0, 7);
    const textHeight =
      titleLines.length * titleLineHeight +
      (bodyLines.length ? Math.round(bodySize * 0.6) : 0) +
      bodyLines.length * bodyLineHeight;
    let y = height - margin - textHeight;

    ctx.fillStyle = renderStyle.panelColor;
    ctx.globalAlpha = 0.62;
    ctx.fillRect(
      margin * 0.72,
      y - bodySize * 0.8,
      width - margin * 1.44,
      textHeight + bodySize * 1.35,
    );
    ctx.globalAlpha = 1;

    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 12;
    ctx.font = `800 ${titleSize}px "Microsoft YaHei", "Noto Sans SC", Arial, sans-serif`;
    ctx.fillStyle = renderStyle.titleColor;
    const titleState = animatedTextState(
      renderStyle.titleAnimation,
      titleLines,
      elapsed,
      duration,
      forceFinalText,
    );
    ctx.save();
    ctx.globalAlpha = titleState.alpha;
    titleState.lines.forEach((line) => {
      ctx.fillText(line, margin, y + titleState.offsetY);
      y += titleLineHeight;
    });
    ctx.restore();

    if (bodyLines.length) y += Math.round(bodySize * 0.6);
    ctx.font = `500 ${bodySize}px "Microsoft YaHei", "Noto Sans SC", Arial, sans-serif`;
    ctx.fillStyle = renderStyle.bodyColor;
    const bodyState = animatedTextState(
      renderStyle.bodyAnimation,
      bodyLines,
      elapsed,
      duration,
      forceFinalText,
    );
    ctx.save();
    ctx.globalAlpha = bodyState.alpha;
    bodyState.lines.forEach((line) => {
      ctx.fillText(line, margin, y + bodyState.offsetY);
      y += bodyLineHeight;
    });
    ctx.restore();
    ctx.shadowBlur = 0;
  };

  const renderVideo = async () => {
    if (selectedNodes.length === 0 || status === 'rendering') return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const recordMimeType = getSupportedMimeType('webm');
    if (!recordMimeType) {
      setStatus('error');
      setError(
        isZh
          ? '当前环境不支持浏览器录制 WebM，无法生成可转码的源视频。'
          : 'This environment cannot record WebM, so a transcodable source video cannot be generated.',
      );
      return;
    }

    const shouldUseTauriExport = isTauriRuntime();
    if (!shouldUseTauriExport && exportFormat !== 'webm') {
      setStatus('error');
      setError(
        isZh
          ? `${exportFormat.toUpperCase()} 需要 Tauri 桌面端调用 FFmpeg 转码。网页端只能直接导出 WebM。`
          : `${exportFormat.toUpperCase()} requires Tauri desktop FFmpeg transcoding. Web export can only save WebM directly.`,
      );
      return;
    }

    setStatus('rendering');
    setError('');
    setSavedPath('');
    setProgressValue(0);
    setProgress(isZh ? '准备渲染 0%' : 'Preparing render 0%');

    try {
      canvas.width = resolution.width;
      canvas.height = resolution.height;

      if (
        shouldUseTauriExport &&
        exportFormat !== 'webm' &&
        selectedNodes.every((node) => !node.data?.videoUrl)
      ) {
        await renderStaticFramesWithFfmpeg();
        setStatus('done');
        setProgressValue(100);
        setProgress(isZh ? '导出完成 100%' : 'Export complete 100%');
        return;
      }

      const videoStream = canvas.captureStream(frameRate);
      const audioContext = new AudioContext();
      const audioDestination = audioContext.createMediaStreamDestination();
      audioDestination.stream.getAudioTracks().forEach((track) => videoStream.addTrack(track));

      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(videoStream, { mimeType: recordMimeType });
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      const finished = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: recordMimeType }));
      });

      recorder.start(250);

      for (let index = 0; index < selectedNodes.length; index += 1) {
        const node = selectedNodes[index];
        setProgress(`${index + 1}/${selectedNodes.length} ${String(node.data?.title || '')}`);

        const videoUrl = node.data?.videoUrl as string | undefined;
        const audioUrl = node.data?.audioUrl as string | undefined;
        if (videoUrl) {
          const video = await loadVideo(videoUrl);
          video.muted = false;
          video.playbackRate = speed;
          const videoSource = audioContext.createMediaElementSource(video);
          videoSource.connect(audioDestination);
          videoSource.connect(audioContext.destination);
          let linkedAudio: HTMLAudioElement | undefined;
          let linkedAudioSource: MediaElementAudioSourceNode | undefined;
          const audioDuration = audioUrl ? await getAudioDuration(audioUrl) : 0;
          if (audioUrl) {
            linkedAudio = new Audio(audioUrl);
            linkedAudio.crossOrigin = 'anonymous';
            linkedAudio.playbackRate = speed;
            linkedAudioSource = audioContext.createMediaElementSource(linkedAudio);
            linkedAudioSource.connect(audioDestination);
            linkedAudioSource.connect(audioContext.destination);
          }
          await video.play();
          if (linkedAudio) await linkedAudio.play();
          const renderStart = performance.now();
          const durationMs =
            Math.max(500, Math.max(validDuration(video.duration), audioDuration, defaultSeconds)) /
            speed *
            1000;
          while (performance.now() - renderStart < durationMs) {
            const elapsedSecs = (performance.now() - renderStart) / 1000;
            await drawFrame(
              ctx,
              node,
              resolution.width,
              resolution.height,
              {
                source: video,
                width: video.videoWidth || resolution.width,
                height: video.videoHeight || resolution.height,
              },
              elapsedSecs,
              durationMs / 1000,
            );
            await wait(1000 / 30);
          }
          video.pause();
          linkedAudio?.pause();
          videoSource.disconnect();
          linkedAudioSource?.disconnect();
          continue;
        }

        let audio: HTMLAudioElement | undefined;
        let audioSource: MediaElementAudioSourceNode | undefined;
        let durationMs = Math.max(500, (defaultSeconds / speed) * 1000);

        if (audioUrl) {
          audio = new Audio(audioUrl);
          audio.crossOrigin = 'anonymous';
          audio.playbackRate = speed;
          audioSource = audioContext.createMediaElementSource(audio);
          audioSource.connect(audioDestination);
          audioSource.connect(audioContext.destination);
          const duration = await getAudioDuration(audioUrl);
          durationMs = Math.max(400, ((validDuration(duration) || defaultSeconds) / speed) * 1000);
          await audio.play();
        }

        const renderStart = performance.now();
        while (performance.now() - renderStart < durationMs) {
          await drawFrame(
            ctx,
            node,
            resolution.width,
            resolution.height,
            undefined,
            (performance.now() - renderStart) / 1000,
            durationMs / 1000,
          );
          await wait(1000 / frameRate);
        }

        if (audio) audio.pause();
        if (audioSource) audioSource.disconnect();
      }

      recorder.stop();
      const blob = await finished;
      audioContext.close();

      if (shouldUseTauriExport) {
        updateProgress(isZh ? '保存视频' : 'Saving video', 90, 100);
        const { invoke } = await import('@tauri-apps/api/core');
        const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
        const result = await invoke<TauriRenderSaveResult>('save_rendered_video', {
          fileName: `galwriter-render-${Date.now()}`,
          format: exportFormat,
          bytes,
          outputDir,
          videoBitrate: DEFAULT_VIDEO_BITRATE,
        });
        setSavedPath(result.path);
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `galwriter-render-${Date.now()}.webm`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }

      setStatus('done');
      setProgressValue(100);
      setProgress(isZh ? '导出完成 100%' : 'Export complete 100%');
    } catch (renderError: any) {
      console.error('Video render failed:', renderError);
      setStatus('error');
      setError(renderError?.message || (isZh ? '视频渲染失败' : 'Video render failed'));
    }
  };

  React.useEffect(() => {
    if (!activePreviewNode) {
      setPreviewDuration(defaultSeconds);
      return;
    }

    let cancelled = false;
    const loadPreviewDuration = async () => {
      const duration = await getNodeMediaDuration(activePreviewNode);
      if (!cancelled) setPreviewDuration(duration);
    };
    loadPreviewDuration();
    return () => {
      cancelled = true;
    };
  }, [activePreviewNode, defaultSeconds]);

  React.useEffect(() => {
    if (!activePreviewNode || status === 'rendering') return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let cancelled = false;
    if (canvas.width !== resolution.width) canvas.width = resolution.width;
    if (canvas.height !== resolution.height) canvas.height = resolution.height;

    const drawPreview = async () => {
      const drawId = ++previewDrawIdRef.current;
      const videoUrl = activePreviewNode.data?.videoUrl as string | undefined;
      if (videoUrl) {
        try {
          if (previewVideoRef.current?.url !== videoUrl) {
            previewVideoRef.current?.video.pause();
            previewVideoRef.current = { url: videoUrl, video: await loadVideo(videoUrl) };
          }
          const video = previewVideoRef.current.video;
          await seekVideo(video, previewTime);
          if (cancelled || drawId !== previewDrawIdRef.current) return;
          await drawFrame(
            ctx,
            activePreviewNode,
            resolution.width,
            resolution.height,
            {
              source: video,
              width: video.videoWidth || resolution.width,
              height: video.videoHeight || resolution.height,
            },
            previewTime,
            previewDuration,
          );
          return;
        } catch {
          if (cancelled) return;
        }
      } else if (previewVideoRef.current) {
        previewVideoRef.current.video.pause();
        previewVideoRef.current = null;
      }
      if (cancelled || drawId !== previewDrawIdRef.current) return;
      await drawFrame(
        ctx,
        activePreviewNode,
        resolution.width,
        resolution.height,
        undefined,
        previewTime,
        previewDuration,
      );
    };

    drawPreview().catch(() => {
      if (cancelled) return;
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, resolution.width, resolution.height);
    });
    return () => {
      cancelled = true;
    };
  }, [
    activePreviewNode,
    previewTime,
    resolution.width,
    resolution.height,
    renderStyle,
    animationLeadSeconds,
    status,
  ]);

  React.useEffect(() => {
    if (!previewPlaying || status === 'rendering') return;
    const startedAt = performance.now();
    const startTimelineTime = activeTimelineTime;
    const timer = window.setInterval(() => {
      const nextTime = startTimelineTime + (performance.now() - startedAt) / 1000;
      if (nextTime >= timelineMetrics.totalDuration) {
        seekTimelineTime(timelineMetrics.totalDuration);
        setPreviewPlaying(false);
        return;
      }
      seekTimelineTime(nextTime, { keepPlaying: true });
    }, 120);
    return () => window.clearInterval(timer);
  }, [activeTimelineTime, previewPlaying, status, timelineMetrics.totalDuration]);

  const mediaKind = (node: FlowNode) => {
    if (node.data?.videoUrl) return 'video';
    if (node.data?.imageUrl) return 'image';
    if (node.data?.audioUrl) return 'audio';
    return 'text';
  };

  const mediaIcon = (node: FlowNode, className = 'w-4 h-4') => {
    const kind = mediaKind(node);
    if (kind === 'video') return <Video className={className} />;
    if (kind === 'image') return <Image className={className} />;
    if (kind === 'audio') return <Music className={className} />;
    return <Film className={className} />;
  };

  const segmentTitle = (node: FlowNode) =>
    String(node.data?.title || (isZh ? '未命名片段' : 'Untitled segment'));
  const segmentText = (node: FlowNode) => stripHtml(String(node.data?.text || '')).trim();
  const segmentDurationLabel = (node: FlowNode) => {
    if (node.data?.videoUrl && node.data?.audioUrl)
      return isZh ? '按音画较长时长' : 'Longest media length';
    if (node.data?.videoUrl) return isZh ? '按视频时长' : 'Video length';
    if (node.data?.audioUrl) return isZh ? '按音频时长' : 'Audio length';
    return `${defaultSeconds}s`;
  };
  const timelineThumbWidthPercent =
    timelineScrollInfo.scrollWidth > 0
      ? clamp((timelineScrollInfo.clientWidth / timelineScrollInfo.scrollWidth) * 100, 0, 100)
      : 100;
  const timelineThumbLeftPercent =
    timelineScrollInfo.scrollWidth > 0
      ? clamp(
          (timelineScrollInfo.scrollLeft / timelineScrollInfo.scrollWidth) * 100,
          0,
          100 - timelineThumbWidthPercent,
        )
      : 0;

  return (
    <div className="video-render-workspace fixed inset-0 z-[350] bg-[var(--vr-bg)] text-[var(--vr-text)]">
      <div
        className="h-full w-full grid"
        style={{ gridTemplateRows: `${HEADER_HEIGHT}px minmax(0, 1fr) ${timelineHeight}px` }}
      >
        <header className="h-14 px-4 border-b border-[var(--vr-border)] bg-[var(--vr-surface-strong)]/90 backdrop-blur-xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[var(--vr-accent-soft)] border border-[var(--vr-border)] flex items-center justify-center text-[var(--vr-accent-strong)]">
              <Film className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black truncate">
                {isZh ? '渲染剧本视频' : 'Render Script Video'}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 border-r border-[var(--vr-border)] pr-2 mr-1">
              <button
                type="button"
                onClick={undoTimeline}
                disabled={timelinePast.length === 0 || status === 'rendering'}
                className="h-9 w-9 rounded-lg text-[var(--vr-text-muted)] hover:text-[var(--vr-accent-strong)] hover:bg-[var(--vr-accent-soft)] disabled:opacity-35 disabled:hover:text-[var(--vr-text-muted)] disabled:hover:bg-transparent transition-colors flex items-center justify-center"
                title={isZh ? '撤销渲染视频内操作' : 'Undo render workspace change'}
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={redoTimeline}
                disabled={timelineFuture.length === 0 || status === 'rendering'}
                className="h-9 w-9 rounded-lg text-[var(--vr-text-muted)] hover:text-[var(--vr-accent-strong)] hover:bg-[var(--vr-accent-soft)] disabled:opacity-35 disabled:hover:text-[var(--vr-text-muted)] disabled:hover:bg-transparent transition-colors flex items-center justify-center"
                title={isZh ? '重做渲染视频内操作' : 'Redo render workspace change'}
              >
                <Redo2 className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={renderVideo}
              disabled={status === 'rendering' || selectedNodes.length === 0}
              className="h-9 px-3 rounded-lg bg-[var(--vr-accent)] text-white text-xs font-black flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] hover:brightness-105 shadow-sm"
              title={isZh ? '一键导出视频' : 'Export Video'}
            >
              {status === 'rendering' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">
                {status === 'rendering'
                  ? isZh
                    ? '渲染中...'
                    : 'Rendering...'
                  : isZh
                    ? '一键导出视频'
                    : 'Export Video'}
              </span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-[var(--vr-text-muted)] hover:text-[var(--vr-text)] hover:bg-[var(--vr-surface-soft)]"
              title={isZh ? '关闭' : 'Close'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="min-h-0 flex bg-[var(--vr-bg)]">
          <aside
            className="min-h-0 border-r border-[var(--vr-border)] bg-[var(--vr-surface)] backdrop-blur-xl flex flex-col shrink-0"
            style={{ width: assetPanelWidth }}
          >
            <div className="h-12 px-4 border-b border-[var(--vr-border)] flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[var(--vr-text-soft)]">
                <Layers className="w-4 h-4 text-[var(--vr-accent)]" />
                {isZh ? '素材卡片' : 'Asset Cards'}
              </div>
              <span className="text-[11px] text-[var(--vr-text-muted)]">
                {visibleAssetNodes.length}/{orderedNodes.length}
              </span>
            </div>
            <div className="px-3 py-2 border-b border-[var(--vr-border)]">
              <select
                value={assetRegionFilter}
                onChange={(event) => setAssetRegionFilter(event.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--vr-surface-soft)] border border-[var(--vr-border)] text-xs font-bold text-[var(--vr-text)]"
              >
                {assetRegionOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="video-render-scroll min-h-0 flex-1 overflow-y-auto p-3 space-y-2">
              {visibleAssetNodes.map((node) => {
                const region = nodeRegionById.get(node.id);
                return (
                  <div
                    key={node.id}
                    draggable
                    onDragStart={(event) => handleAssetDragStart(event, node.id)}
                    onClick={() => setActivePreviewId(node.id)}
                    className={`group cursor-grab active:cursor-grabbing rounded-lg border p-2.5 transition-all ${activePreviewNode?.id === node.id ? 'border-[var(--vr-accent)] bg-[var(--vr-accent-soft)] shadow-sm' : 'border-[var(--vr-border)] bg-[var(--vr-panel)] hover:border-[var(--vr-border-strong)] hover:bg-[var(--vr-surface-soft)]'}`}
                  >
                    <div className="flex gap-3">
                      <div className="relative w-20 h-14 rounded-md overflow-hidden bg-black border border-[var(--vr-border)] shrink-0 flex items-center justify-center text-[var(--vr-text-muted)]">
                        {node.data?.imageUrl ? (
                          <img
                            src={node.data.imageUrl as string}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : node.data?.videoUrl ? (
                          <video
                            src={node.data.videoUrl as string}
                            className="w-full h-full object-cover"
                            muted
                            playsInline
                          />
                        ) : (
                          mediaIcon(node, 'w-5 h-5')
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-[11px] font-black text-[var(--vr-text-muted)]">
                          {mediaIcon(node, 'w-3.5 h-3.5')}
                          <span>{mediaKind(node).toUpperCase()}</span>
                        </div>
                        <div className="mt-1 text-xs font-black text-[var(--vr-text)] truncate">
                          {segmentTitle(node)}
                        </div>
                        <div className="mt-1 text-[11px] text-[var(--vr-text-muted)] truncate">
                          {region
                            ? `${region.type === 'dynamicGroup' ? (isZh ? '包裹' : 'Wrap') : isZh ? '背景' : 'Background'} · ${region.label}`
                            : segmentText(node) || (isZh ? '无正文' : 'No body text')}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {visibleAssetNodes.length === 0 && (
                <div className="rounded-lg border border-dashed border-[var(--vr-border-strong)] px-3 py-8 text-center text-xs font-bold text-[var(--vr-text-muted)]">
                  {isZh ? '这个区域里暂无可渲染卡片' : 'No renderable cards in this region'}
                </div>
              )}
            </div>
          </aside>

          <ResizeHandle
            label={isZh ? '调整素材卡片宽度' : 'Resize asset cards'}
            axis="x"
            value={assetPanelWidth}
            min={PANEL_SIZE_LIMITS.asset.min}
            max={assetPanelMax}
            onChange={setAssetPanelWidth}
          />

          <section
            className="min-h-0 min-w-0 bg-[var(--vr-surface-soft)] flex flex-col flex-1"
            style={{ minWidth: MIN_PREVIEW_WIDTH }}
          >
            <div className="grid h-12 grid-cols-[1fr_auto_1fr] items-center border-b border-[var(--vr-border)] px-4">
              <div className="flex min-w-0 items-center gap-2 text-xs font-black uppercase tracking-wide text-[var(--vr-text-soft)]">
                <Play className="w-4 h-4 text-[var(--vr-accent)]" />
                {isZh ? '测试预览窗口' : 'Preview Monitor'}
              </div>
              <div className="rounded bg-[var(--vr-surface)] px-2 py-1 text-[11px] font-black tabular-nums text-[var(--vr-text)]">
                {timelineScaleMode === 'frames'
                  ? `${isZh ? '帧' : 'Frame'} ${activeTimelineFrame}`
                  : `${formatSeconds(activeTimelineTime)} · ${activeTimelineFrame}f`}
              </div>
              <div className="flex min-w-0 items-center justify-end gap-3 text-[11px] font-bold text-[var(--vr-text-muted)]">
                <span>{resolution.label}</span>
                <span>{frameRate} fps</span>
              </div>
            </div>
            <div className="min-h-0 flex-1 p-4 xl:p-5">
              <div className="h-full min-h-0 flex items-center justify-center">
                <div className="grid h-full w-fit max-w-full grid-rows-[minmax(0,1fr)_auto] gap-3">
                  <div className="min-h-0">
                    <div
                      className="relative h-full max-h-full max-w-full aspect-video rounded-lg bg-black border border-[var(--vr-border-strong)] overflow-hidden"
                      style={{ boxShadow: 'var(--vr-shadow)' }}
                    >
                      <canvas ref={canvasRef} className="w-full h-full block bg-black" />
                    </div>
                  </div>
                  <div className="w-full rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface)] px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (previewTime >= previewDuration) setPreviewTime(0);
                          setPreviewPlaying((prev) => !prev);
                        }}
                        disabled={!activePreviewNode || status === 'rendering'}
                        className="w-9 h-9 rounded-lg bg-[var(--vr-accent-soft)] text-[var(--vr-accent-strong)] flex items-center justify-center hover:bg-[var(--vr-surface-soft)] disabled:opacity-40"
                        title={
                          previewPlaying
                            ? isZh
                              ? '暂停预览'
                              : 'Pause preview'
                            : isZh
                              ? '播放预览'
                              : 'Play preview'
                        }
                      >
                        {previewPlaying ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <RangeControl
                          label={isZh ? '预览位置' : 'Preview position'}
                          min={0}
                          max={Math.max(0.1, previewDuration)}
                          step={0.05}
                          value={Math.min(previewTime, previewDuration)}
                          valueLabel={`${formatSeconds(previewTime)} / ${formatSeconds(previewDuration)}`}
                          disabled={!activePreviewNode || status === 'rendering'}
                          hideLabel
                          onChange={(nextValue) => {
                            setPreviewPlaying(false);
                            setPreviewTime(Math.max(0, nextValue || 0));
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <ResizeHandle
            label={isZh ? '调整导出设置宽度' : 'Resize export settings'}
            axis="x"
            value={exportPanelWidth}
            min={PANEL_SIZE_LIMITS.export.min}
            max={exportPanelMax}
            reverse
            onChange={setExportPanelWidth}
          />

          <aside
            className="min-h-0 border-l border-[var(--vr-border)] bg-[var(--vr-surface)] backdrop-blur-xl flex flex-col shrink-0"
            style={{ width: exportPanelWidth }}
          >
            <div className="h-12 px-4 border-b border-[var(--vr-border)] flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[var(--vr-text-soft)]">
              <Settings className="w-4 h-4 text-[var(--vr-accent)]" />
              {isZh ? '导出设置' : 'Export Settings'}
            </div>
            <div className="video-render-scroll min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
              {false && isTauriRuntime() && exportFormat !== 'webm' && (
                <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3 space-y-3">
                  <input
                    ref={zipInputRef}
                    type="file"
                    accept=".zip"
                    className="hidden"
                    onChange={(event) => setZipFile(event.target.files?.[0] || null)}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => zipInputRef.current?.click()}
                      className="px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-xs font-black text-white hover:border-sky-400"
                    >
                      {isZh ? '选择已保存 ZIP' : 'Choose saved ZIP'}
                    </button>
                    <span className="min-w-0 truncate text-xs font-bold text-slate-400">
                      {zipFile
                        ? zipFile.name
                        : isZh
                          ? '高性能导出需要先保存并选择剧本 ZIP'
                          : 'High performance export needs a saved project ZIP'}
                    </span>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-200">
                    <input
                      type="checkbox"
                      checked={typewriterEnabled}
                      onChange={(e) => setTypewriterEnabled(e.target.checked)}
                    />
                    {isZh ? '启用文字打字机动画' : 'Enable typewriter text animation'}
                  </label>
                </div>
              )}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-2">
                    <span className="text-xs font-black text-[var(--vr-text-soft)]">
                      {isZh ? '分辨率' : 'Resolution'}
                    </span>
                    <select
                      value={resolutionIndex}
                      onChange={(e) => setResolutionIndex(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--vr-surface-soft)] border border-[var(--vr-border)] text-sm text-[var(--vr-text)]"
                    >
                      {RESOLUTION_OPTIONS.map((option, index) => (
                        <option key={option.label} value={index}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-black text-[var(--vr-text-soft)]">
                      {isZh ? '导出格式' : 'Export format'}
                    </span>
                    <select
                      value={exportFormat}
                      onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--vr-surface-soft)] border border-[var(--vr-border)] text-sm text-[var(--vr-text)]"
                    >
                      {EXPORT_FORMAT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="space-y-2">
                  <span className="text-xs font-black text-[var(--vr-text-soft)]">
                    {isZh ? '播放倍速' : 'Playback speed'}
                  </span>
                  <div className="px-3 py-2 rounded-lg bg-[var(--vr-surface-soft)] border border-[var(--vr-border)]">
                    <RangeControl
                      label={isZh ? '速度' : 'Speed'}
                      min={0.25}
                      max={3}
                      step={0.25}
                      value={speed}
                      valueLabel={`${speed.toFixed(2)}x · ${isZh ? '预计' : 'Est.'} ${formatSeconds(estimatedDuration || fallbackEstimatedSeconds)}`}
                      onChange={(nextValue) => setSpeed(Math.max(0.25, nextValue || 1))}
                    />
                  </div>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-2">
                    <span className="text-xs font-black text-[var(--vr-text-soft)]">
                      {isZh ? '视频帧率' : 'Frame rate'}
                    </span>
                    <select
                      value={frameRate}
                      onChange={(e) => setFrameRate(Number(e.target.value) || 30)}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--vr-surface-soft)] border border-[var(--vr-border)] text-sm text-[var(--vr-text)]"
                    >
                      {FRAME_RATE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option} fps
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-black text-[var(--vr-text-soft)]">
                      {isZh ? '编码器' : 'Encoder'}
                    </span>
                    <select
                      value={encoder}
                      onChange={(e) => setEncoder(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--vr-surface-soft)] border border-[var(--vr-border)] text-sm text-[var(--vr-text)]"
                    >
                      {ENCODER_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-2">
                    <span className="text-xs font-black text-[var(--vr-text-soft)]">
                      {isZh ? '无音频停留秒数' : 'No-audio hold'}
                    </span>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      step="1"
                      value={defaultSeconds}
                      onChange={(e) => setDefaultSeconds(clamp(Number(e.target.value) || 4, 1, 30))}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--vr-surface-soft)] border border-[var(--vr-border)] text-sm text-[var(--vr-text)]"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-black text-[var(--vr-text-soft)]">
                      {isZh ? '提前完成动画(秒)' : 'Finish animation early'}
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="30"
                      step="0.1"
                      value={animationLeadSeconds}
                      onChange={(e) =>
                        setAnimationLeadSeconds(clamp(Number(e.target.value) || 0, 0, 30))
                      }
                      className="w-full px-3 py-2 rounded-lg bg-[var(--vr-surface-soft)] border border-[var(--vr-border)] text-sm text-[var(--vr-text)]"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-2">
                    <span className="text-xs font-black text-[var(--vr-text-soft)]">
                      {isZh ? '标题字号' : 'Title size'}
                    </span>
                    <DragSizeControl
                      label={
                        isZh
                          ? '拖动调整标题字号，单击输入精确数字'
                          : 'Drag to adjust title size, click to type an exact value'
                      }
                      value={renderStyle.titleFontSize}
                      min={18}
                      max={120}
                      step={1}
                      onChange={(nextValue) => updateRenderStyle('titleFontSize', nextValue)}
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-black text-[var(--vr-text-soft)]">
                      {isZh ? '标题动画' : 'Title animation'}
                    </span>
                    <select
                      value={renderStyle.titleAnimation}
                      onChange={(e) =>
                        updateRenderStyle('titleAnimation', e.target.value as TextAnimation)
                      }
                      className="w-full px-3 py-2 rounded-lg bg-[var(--vr-surface-soft)] border border-[var(--vr-border)] text-sm text-[var(--vr-text)]"
                    >
                      {TEXT_ANIMATION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {isZh ? option.zh : option.en}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-2">
                    <span className="text-xs font-black text-[var(--vr-text-soft)]">
                      {isZh ? '正文字号' : 'Body size'}
                    </span>
                    <DragSizeControl
                      label={
                        isZh
                          ? '拖动调整正文字号，单击输入精确数字'
                          : 'Drag to adjust body size, click to type an exact value'
                      }
                      value={renderStyle.bodyFontSize}
                      min={16}
                      max={96}
                      step={1}
                      onChange={(nextValue) => updateRenderStyle('bodyFontSize', nextValue)}
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-black text-[var(--vr-text-soft)]">
                      {isZh ? '正文动画' : 'Body animation'}
                    </span>
                    <select
                      value={renderStyle.bodyAnimation}
                      onChange={(e) =>
                        updateRenderStyle('bodyAnimation', e.target.value as TextAnimation)
                      }
                      className="w-full px-3 py-2 rounded-lg bg-[var(--vr-surface-soft)] border border-[var(--vr-border)] text-sm text-[var(--vr-text)]"
                    >
                      {TEXT_ANIMATION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {isZh ? option.zh : option.en}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <label className="space-y-2">
                    <span className="text-xs font-black text-[var(--vr-text-soft)]">
                      {isZh ? '标题' : 'Title'}
                    </span>
                    <input
                      type="color"
                      value={renderStyle.titleColor}
                      onChange={(e) => updateRenderStyle('titleColor', e.target.value)}
                      className="w-full h-9 px-1 py-1 rounded-lg bg-[var(--vr-surface-soft)] border border-[var(--vr-border)]"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-black text-[var(--vr-text-soft)]">
                      {isZh ? '正文' : 'Body'}
                    </span>
                    <input
                      type="color"
                      value={renderStyle.bodyColor}
                      onChange={(e) => updateRenderStyle('bodyColor', e.target.value)}
                      className="w-full h-9 px-1 py-1 rounded-lg bg-[var(--vr-surface-soft)] border border-[var(--vr-border)]"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-black text-[var(--vr-text-soft)]">
                      {isZh ? '底色' : 'Panel'}
                    </span>
                    <input
                      type="color"
                      value={renderStyle.panelColor}
                      onChange={(e) => updateRenderStyle('panelColor', e.target.value)}
                      className="w-full h-9 px-1 py-1 rounded-lg bg-[var(--vr-surface-soft)] border border-[var(--vr-border)]"
                    />
                  </label>
                </div>
                <label className="space-y-2">
                  <span className="text-xs font-black text-[var(--vr-text-soft)]">
                    {isZh ? '保存位置' : 'Save location'}
                  </span>
                  <input
                    type="text"
                    value={outputDir}
                    onChange={(e) => setOutputDir(e.target.value)}
                    placeholder={isZh ? '默认保存到系统下载目录' : 'Defaults to Downloads'}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--vr-surface-soft)] border border-[var(--vr-border)] text-sm text-[var(--vr-text)]"
                  />
                </label>
              </div>
              {(progress || error) && (
                <div className="space-y-2">
                  {!error && (
                    <div className="h-2 rounded-full bg-[var(--vr-surface-soft)] border border-[var(--vr-border)] overflow-hidden">
                      <div
                        className="h-full bg-[var(--vr-accent)] transition-all"
                        style={{ width: `${progressValue}%` }}
                      />
                    </div>
                  )}
                  <p
                    className={`text-xs font-bold ${error ? 'text-rose-500 dark:text-rose-400' : 'text-[var(--vr-text-muted)]'}`}
                  >
                    {error || progress}
                  </p>
                </div>
              )}
              {savedPath && (
                <div className="rounded-lg border border-[var(--vr-accent)] bg-[var(--vr-accent-soft)] px-3 py-2 text-xs font-bold text-[var(--vr-accent-strong)] break-all">
                  {isZh ? '已保存到：' : 'Saved to: '}
                  {savedPath}
                </div>
              )}
            </div>
          </aside>
        </main>

        <section className="relative min-h-0 border-t border-[var(--vr-border)] bg-[var(--vr-surface-strong)]/95 grid grid-rows-[44px_minmax(0,1fr)_24px]">
          <div className="absolute inset-x-0 top-0">
            <ResizeHandle
              label={isZh ? '调整视频编辑时间线高度' : 'Resize editing timeline'}
              axis="y"
              value={timelineHeight}
              min={PANEL_SIZE_LIMITS.timeline.min}
              max={timelineMax}
              reverse
              onChange={setTimelineHeight}
            />
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-[var(--vr-border)] px-4">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[var(--vr-text-soft)]">
              <Clock className="w-4 h-4 text-[var(--vr-accent)]" />
              {isZh ? '视频编辑时间线' : 'Editing Timeline'}
            </div>
            <div className="flex justify-center gap-1.5">
              <button
                type="button"
                onClick={() => seekTimelineTime(0)}
                disabled={!activePreviewNode || status === 'rendering'}
                className="h-8 w-8 rounded-lg bg-[var(--vr-surface-soft)] text-[var(--vr-text-soft)] flex items-center justify-center hover:bg-[var(--vr-accent-soft)] disabled:opacity-40"
                title={isZh ? '跳到开头' : 'Jump to start'}
                aria-label={isZh ? '跳到时间线开头' : 'Jump to timeline start'}
              >
                <span className="text-xs font-black">|&lt;</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (activeTimelineTime >= timelineMetrics.totalDuration - 0.001) {
                    seekTimelineTime(0, { keepPlaying: true });
                  }
                  setPreviewPlaying((prev) => !prev);
                }}
                disabled={!activePreviewNode || status === 'rendering'}
                className="h-8 w-8 rounded-lg bg-[var(--vr-accent-soft)] text-[var(--vr-accent-strong)] flex items-center justify-center hover:bg-[var(--vr-surface-soft)] disabled:opacity-40"
                title={
                  previewPlaying
                    ? isZh
                      ? '暂停时间线'
                      : 'Pause timeline'
                    : isZh
                      ? '播放时间线'
                      : 'Play timeline'
                }
              >
                {previewPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => seekTimelineTime(timelineMetrics.totalDuration)}
                disabled={!activePreviewNode || status === 'rendering'}
                className="h-8 w-8 rounded-lg bg-[var(--vr-surface-soft)] text-[var(--vr-text-soft)] flex items-center justify-center hover:bg-[var(--vr-accent-soft)] disabled:opacity-40"
                title={isZh ? '跳到结尾' : 'Jump to end'}
                aria-label={isZh ? '跳到时间线结尾' : 'Jump to timeline end'}
              >
                <span className="text-xs font-black">&gt;|</span>
              </button>
            </div>
            <div className="flex items-center justify-end gap-2">
              <div className="flex h-8 rounded-lg bg-[var(--vr-surface-soft)] p-0.5">
                {(['vertical', 'horizontal'] as TimelineWheelMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setTimelineWheelMode(mode)}
                    className={`flex h-7 items-center gap-1 rounded-md px-2 text-xs font-black transition-colors ${
                      timelineWheelMode === mode
                        ? 'bg-[var(--vr-accent)] text-white shadow-sm'
                        : 'text-[var(--vr-text-muted)] hover:text-[var(--vr-text)]'
                    }`}
                    title={
                      mode === 'vertical'
                        ? isZh
                          ? '鼠标滚轮上下滚动时间线区域'
                          : 'Mouse wheel scrolls vertically'
                        : isZh
                          ? '鼠标滚轮左右移动时间线'
                          : 'Mouse wheel scrolls horizontally'
                    }
                  >
                    {mode === 'vertical' ? (
                      <MoveVertical className="w-3.5 h-3.5" />
                    ) : (
                      <MoveHorizontal className="w-3.5 h-3.5" />
                    )}
                    {mode === 'vertical' ? (isZh ? '上下' : 'Y') : isZh ? '左右' : 'X'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div
            ref={timelineViewportRef}
            className="min-h-0 overflow-y-auto overflow-x-hidden p-4"
            onScroll={syncTimelineScrollInfo}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(event) => handleTimelineDrop(event)}
          >
            <div className="min-w-max space-y-3">
              <div
                className="sticky -top-4 z-30 -mx-4 grid gap-3 bg-[var(--vr-surface)]/95 px-4 backdrop-blur"
                style={{ gridTemplateColumns: `${TIMELINE_LABEL_WIDTH}px minmax(0, 1fr)` }}
              >
                <div className="flex h-8 items-center justify-end">
                  <div className="flex h-7 rounded-lg bg-[var(--vr-surface-soft)] p-0.5">
                    {(['seconds', 'frames'] as TimelineScaleMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setTimelineScaleMode(mode)}
                        className={`h-6 min-w-8 rounded-md px-1.5 text-[10px] font-black transition-colors ${
                          timelineScaleMode === mode
                            ? 'bg-[var(--vr-accent)] text-white shadow-sm'
                            : 'text-[var(--vr-text-muted)] hover:text-[var(--vr-text)]'
                        }`}
                        title={
                          mode === 'seconds'
                            ? isZh
                              ? '按秒数显示比例尺'
                              : 'Show ruler in seconds'
                            : isZh
                              ? '按帧数显示比例尺'
                              : 'Show ruler in frames'
                        }
                      >
                        {mode === 'seconds' ? (isZh ? '秒' : 'Sec') : isZh ? '帧' : 'Frm'}
                      </button>
                    ))}
                  </div>
                </div>
                <div
                  className="relative h-8 cursor-ew-resize rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface)]"
                  style={{ width: timelineMetrics.width }}
                  onPointerDown={handleTimelineScrubStart}
                  onPointerMove={handleTimelineScrubMove}
                  onPointerUp={handleTimelineScrubEnd}
                  onPointerCancel={handleTimelineScrubEnd}
                  title={isZh ? '拖动或点击移动播放条' : 'Drag or click to move playhead'}
                >
                  {timelineTicks.map((time) => {
                    const left = time * timelineMetrics.pixelsPerSecond;
                    const label =
                      timelineScaleMode === 'frames'
                        ? `${Math.round(time * frameRate)}f`
                        : formatSeconds(time, timelineTickSettings.precision);
                    return (
                      <div
                        key={`${time}-${timelineScaleMode}`}
                        className="absolute top-0 h-full border-l border-[var(--vr-border-strong)]"
                        style={{ left }}
                      >
                        <span className="absolute left-1 top-1 text-[10px] font-black text-[var(--vr-text-muted)] whitespace-nowrap">
                          {label}
                        </span>
                      </div>
                    );
                  })}
                  <div
                    className="absolute inset-y-0 w-0.5 bg-[var(--vr-accent)] shadow-[0_0_0_1px_rgba(255,255,255,0.45)]"
                    style={{ left: timelinePlayheadLeft }}
                  />
                </div>
              </div>
              <div className="relative">
                <div
                  className="pointer-events-none absolute bottom-0 top-0 z-20"
                  style={{ left: TIMELINE_LABEL_WIDTH + 12 + timelinePlayheadLeft }}
                >
                  <div className="h-full w-0.5 bg-[var(--vr-accent)] shadow-[0_0_0_1px_rgba(255,255,255,0.45)]" />
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-md bg-[var(--vr-accent)] px-1.5 py-0.5 text-[10px] font-black text-white shadow-sm whitespace-nowrap">
                    {timelineScaleMode === 'frames'
                      ? `${activeTimelineFrame}f`
                      : formatSeconds(activeTimelineTime)}
                  </div>
                </div>
                <div className="space-y-3">
              <div className="grid grid-cols-[76px_minmax(0,1fr)] gap-3 items-center">
                <button
                  type="button"
                  onClick={addVideoTrack}
                  className="h-7 rounded-lg bg-[var(--vr-surface-soft)] text-[var(--vr-text-soft)] hover:bg-[var(--vr-accent-soft)] flex items-center justify-center"
                  title={isZh ? '新增视频轨' : 'Add video track'}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <div />
              </div>
              {[...videoTrackIds].reverse().map((trackId) => {
                const trackIndex = videoTrackIds.indexOf(trackId);
                const trackNodes = timelineNodes.filter(
                  (node) => (videoTrackByNodeId[node.id] || videoTrackIds[0]) === trackId,
                );
                const trackMetrics = trackNodes
                  .map((node) => timelineMetricById.get(node.id))
                  .filter(Boolean) as NonNullable<typeof activeTimelineMetric>[];
                return (
                  <div key={trackId} className="grid grid-cols-[76px_minmax(0,1fr)] gap-3 items-center">
                    <div className="flex items-center gap-1 text-[11px] font-black text-[var(--vr-text-muted)]">
                      <span className="min-w-0 truncate">
                        {isZh ? `视频轨 ${trackIndex + 1}` : `Video ${trackIndex + 1}`}
                      </span>
                      {videoTrackIds.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeVideoTrack(trackId)}
                          className="shrink-0 w-5 h-5 rounded text-[var(--vr-text-muted)] hover:text-rose-500 hover:bg-[var(--vr-danger-soft)] flex items-center justify-center"
                          title={isZh ? '删除视频轨' : 'Delete video track'}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div
                      className="relative min-h-20"
                      style={{ width: timelineMetrics.width }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        event.dataTransfer.dropEffect = 'move';
                      }}
                      onDrop={(event) => handleTimelineDrop(event, undefined, trackId, 'video')}
                    >
                      {trackMetrics.map((metric) => {
                      const node = metric.node;
                      const enabled = selectedIds.has(node.id);
                      const segmentLayout = getTimelineSegmentLayout(
                        metric.start,
                        metric.duration,
                        timelineMetrics.pixelsPerSecond,
                      );
                      return (
                        <div
                          key={`${trackId}-${node.id}`}
                          draggable
                          onDragStart={(event) => handleAssetDragStart(event, node.id, 'video')}
                          onDragOver={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            event.dataTransfer.dropEffect = 'move';
                          }}
                          onDrop={(event) => handleTimelineDrop(event, node.id, trackId, 'video')}
                          onClick={() => setActivePreviewId(node.id)}
                          className={`absolute top-0 h-20 min-w-0 overflow-hidden rounded-lg border p-2 cursor-grab active:cursor-grabbing transition-all ${enabled ? 'border-[var(--vr-accent)] bg-[var(--vr-accent-soft)]' : 'border-[var(--vr-border)] bg-[var(--vr-panel)] opacity-60'} ${activePreviewNode?.id === node.id ? 'ring-2 ring-[var(--vr-accent)]/35' : ''}`}
                          style={{
                            left: segmentLayout.left,
                            width: segmentLayout.width,
                          }}
                        >
                          {node.data?.imageUrl ? (
                            <img
                              src={node.data.imageUrl as string}
                              alt=""
                              className="absolute inset-0 h-full w-full object-cover"
                              draggable={false}
                            />
                          ) : node.data?.videoUrl ? (
                            <video
                              src={node.data.videoUrl as string}
                              className="absolute inset-0 h-full w-full object-cover"
                              muted
                              playsInline
                              draggable={false}
                            />
                          ) : null}
                          {(node.data?.imageUrl || node.data?.videoUrl) && (
                            <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/10 to-black/65" />
                          )}
                          <div className="relative z-10 flex items-center justify-end">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  removeTimelineNode(node.id);
                                }}
                                onDragStart={(event) => event.preventDefault()}
                                className={`w-5 h-5 rounded flex items-center justify-center ${
                                  node.data?.imageUrl || node.data?.videoUrl
                                    ? 'bg-black/45 text-white hover:bg-rose-500 hover:text-white'
                                    : 'text-[var(--vr-text-muted)] hover:text-rose-500 hover:bg-[var(--vr-danger-soft)]'
                                }`}
                                title={isZh ? '从时间线删除' : 'Remove from timeline'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <div
                            className={`relative z-10 mt-2 flex items-center gap-1.5 text-[11px] font-black ${
                              node.data?.imageUrl || node.data?.videoUrl
                                ? 'text-white drop-shadow'
                                : 'text-[var(--vr-text)]'
                            }`}
                          >
                            <span className="truncate">{segmentTitle(node)}</span>
                          </div>
                        </div>
                      );
                    })}
                    {trackNodes.length === 0 ? (
                      <div
                        className="h-20 rounded-lg border border-dashed border-[var(--vr-border-strong)] flex items-center justify-center text-xs font-bold text-[var(--vr-text-muted)]"
                        style={{ width: timelineMetrics.width }}
                      >
                        {isZh ? '把左侧素材拖到这里' : 'Drag assets here'}
                      </div>
                    ) : null}
                  </div>
                </div>
                );
              })}
              <div className="grid grid-cols-[76px_minmax(0,1fr)] gap-3 items-center py-1">
                <div />
                <div
                  className="h-0.5 rounded-full bg-[var(--vr-border-strong)]"
                  style={{ width: timelineMetrics.width }}
                />
              </div>
              {audioTrackIds.map((trackId, trackIndex) => {
                const trackNodes = timelineNodes.filter(
                  (node) => (audioTrackByNodeId[node.id] || audioTrackIds[0]) === trackId,
                );
                const trackMetrics = trackNodes
                  .map((node) => timelineMetricById.get(node.id))
                  .filter(Boolean) as NonNullable<typeof activeTimelineMetric>[];
                return (
                  <div key={trackId} className="grid grid-cols-[76px_minmax(0,1fr)] gap-3 items-center">
                    <div className="flex items-center gap-1 text-[11px] font-black text-[var(--vr-text-muted)]">
                      <span className="min-w-0 truncate">
                        {isZh ? `音频轨 ${trackIndex + 1}` : `Audio ${trackIndex + 1}`}
                      </span>
                      {audioTrackIds.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeAudioTrack(trackId)}
                          className="shrink-0 w-5 h-5 rounded text-[var(--vr-text-muted)] hover:text-rose-500 hover:bg-[var(--vr-danger-soft)] flex items-center justify-center"
                          title={isZh ? '删除音频轨' : 'Delete audio track'}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div
                      className="relative min-h-12"
                      style={{ width: timelineMetrics.width }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        event.dataTransfer.dropEffect = 'move';
                      }}
                      onDrop={(event) => handleTimelineDrop(event, undefined, trackId, 'audio')}
                    >
                      {trackMetrics.map((metric) => {
                      const node = metric.node;
                      const audioText = segmentText(node) || segmentTitle(node);
                      const segmentLayout = getTimelineSegmentLayout(
                        metric.start,
                        metric.duration,
                        timelineMetrics.pixelsPerSecond,
                      );
                      return (
                      <button
                        key={`${trackId}-${node.id}-audio`}
                        type="button"
                        draggable
                        onDragStart={(event) => handleAssetDragStart(event, node.id, 'audio')}
                        onDragOver={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          event.dataTransfer.dropEffect = 'move';
                        }}
                        onDrop={(event) => handleTimelineDrop(event, node.id, trackId, 'audio')}
                        className={`absolute top-0 h-12 min-w-0 overflow-hidden rounded-lg border px-3 text-left transition-all ${selectedIds.has(node.id) ? 'border-[var(--vr-accent)] bg-[var(--vr-accent-soft)]' : 'border-[var(--vr-border)] bg-[var(--vr-panel)] opacity-55'}`}
                        style={{
                          left: segmentLayout.left,
                          width: segmentLayout.width,
                        }}
                      >
                        <div className="flex items-center gap-2 text-[11px] font-black text-[var(--vr-text)]">
                          <span className="truncate">{audioText}</span>
                        </div>
                      </button>
                    );
                    })}
                    {trackNodes.length === 0 ? (
                      <div
                        className="h-12 rounded-lg border border-dashed border-[var(--vr-border-strong)] flex items-center justify-center text-xs font-bold text-[var(--vr-text-muted)]"
                        style={{ width: timelineMetrics.width }}
                      >
                        {isZh ? '把音频片段拖到这里' : 'Drag audio clips here'}
                      </div>
                    ) : null}
                  </div>
                </div>
                );
              })}
              <div className="grid grid-cols-[76px_minmax(0,1fr)] gap-3 items-center">
                <button
                  type="button"
                  onClick={addAudioTrack}
                  className="h-7 rounded-lg bg-[var(--vr-surface-soft)] text-[var(--vr-text-soft)] hover:bg-[var(--vr-accent-soft)] flex items-center justify-center"
                  title={isZh ? '新增音频轨' : 'Add audio track'}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <div />
              </div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex h-6 items-center border-t border-[var(--vr-border)] bg-[var(--vr-surface)] px-4">
            <div className="flex h-full w-full items-center">
              <div className="relative h-2 w-full rounded-full bg-slate-200">
                <div
                  className="absolute inset-y-1 rounded-full bg-[var(--vr-accent-soft)]"
                  style={{
                    left: `${timelineThumbLeftPercent}%`,
                    width: `${timelineThumbWidthPercent}%`,
                  }}
                />
                <div
                  className="absolute inset-y-0 cursor-grab active:cursor-grabbing"
                  style={{
                    left: `${timelineThumbLeftPercent}%`,
                    width: `${timelineThumbWidthPercent}%`,
                  }}
                  onPointerDown={handleTimelineScrollThumbStart}
                  onPointerMove={handleTimelineScrollThumbMove}
                  onPointerUp={handleTimelineScrollThumbEnd}
                  onPointerCancel={handleTimelineScrollThumbEnd}
                  title={isZh ? '拖动移动时间线视野' : 'Drag to scroll timeline'}
                >
                  <div className="absolute left-2 right-2 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-[var(--vr-accent)]/50" />
                  <button
                    type="button"
                    className="absolute left-0 top-1/2 z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-[var(--vr-surface-strong)] bg-[var(--vr-accent)] shadow-sm outline-none transition-[width,height,filter] hover:h-5 hover:w-5 hover:brightness-110 active:h-5 active:w-5"
                    onPointerDown={(event) => handleTimelineScaleHandleStart(event, 'left')}
                    onPointerMove={handleTimelineScaleHandleMove}
                    onPointerUp={handleTimelineScaleHandleEnd}
                    onPointerCancel={handleTimelineScaleHandleEnd}
                    title={isZh ? '拖动调整可视窗口宽度' : 'Drag to resize timeline window'}
                    aria-label={isZh ? '调整时间轴缩放左手柄' : 'Adjust timeline scale left handle'}
                  />
                  <button
                    type="button"
                    className="absolute right-0 top-1/2 z-10 h-4 w-4 translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-[var(--vr-surface-strong)] bg-[var(--vr-accent)] shadow-sm outline-none transition-[width,height,filter] hover:h-5 hover:w-5 hover:brightness-110 active:h-5 active:w-5"
                    onPointerDown={(event) => handleTimelineScaleHandleStart(event, 'right')}
                    onPointerMove={handleTimelineScaleHandleMove}
                    onPointerUp={handleTimelineScaleHandleEnd}
                    onPointerCancel={handleTimelineScaleHandleEnd}
                    title={isZh ? '拖动调整可视窗口宽度' : 'Drag to resize timeline window'}
                    aria-label={isZh ? '调整时间轴缩放右手柄' : 'Adjust timeline scale right handle'}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
