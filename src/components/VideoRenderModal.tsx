import React, { useMemo, useRef, useState } from 'react';
import type { Node as FlowNode, Edge as FlowEdge } from '@xyflow/react';
import { Clock, Download, Film, GripVertical, Image, Layers, Loader2, Music, Pause, Play, Settings, Trash2, Video, X } from 'lucide-react';
import JSZip from 'jszip';
import { htmlToSpeechText } from '../lib/tts';
import type { Language } from '../lib/i18n';

type RenderStatus = 'idle' | 'rendering' | 'done' | 'error';
type ExportFormat = 'webm' | 'mp4' | 'mkv';

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
const ENCODER_OPTIONS = [
  { label: 'CPU libx264', value: 'libx264' },
  { label: 'NVIDIA NVENC', value: 'h264_nvenc' },
  { label: 'Intel QSV', value: 'h264_qsv' },
  { label: 'AMD AMF', value: 'h264_amf' },
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

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isTauriRuntime = () => {
  if (typeof window === 'undefined') return false;
  const runtimeWindow = window as Window & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };
  return !!runtimeWindow.__TAURI__ || !!runtimeWindow.__TAURI_INTERNALS__;
};

const getSupportedMimeType = (format: ExportFormat) => {
  const option = EXPORT_FORMAT_OPTIONS.find(item => item.value === format) || EXPORT_FORMAT_OPTIONS[0];
  if (!option.directRecording) return '';
  return option.mimeCandidates.find(candidate => MediaRecorder.isTypeSupported(candidate)) || '';
};

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('Failed to load image.'));
  img.src = src;
});

const getAudioDuration = (src: string) => new Promise<number>((resolve) => {
  const audio = new Audio();
  audio.preload = 'metadata';
  audio.onloadedmetadata = () => resolve(Number.isFinite(audio.duration) ? audio.duration : 0);
  audio.onerror = () => resolve(0);
  audio.src = src;
});

const loadVideo = (src: string) => new Promise<HTMLVideoElement>((resolve, reject) => {
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

const seekVideo = (video: HTMLVideoElement, time: number) => new Promise<void>((resolve, reject) => {
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

const canvasToPngBytes = (canvas: HTMLCanvasElement) => new Promise<number[]>((resolve, reject) => {
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
  view.setUint32(offset, 36 + dataSize, true); offset += 4;
  writeString('WAVE');
  writeString('fmt ');
  view.setUint32(offset, 16, true); offset += 4;
  view.setUint16(offset, 1, true); offset += 2;
  view.setUint16(offset, channels, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, sampleRate * blockAlign, true); offset += 4;
  view.setUint16(offset, blockAlign, true); offset += 2;
  view.setUint16(offset, bytesPerSample * 8, true); offset += 2;
  writeString('data');
  view.setUint32(offset, dataSize, true); offset += 4;

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

const formatSeconds = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const rest = safeSeconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
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
  height: number
) => {
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
};

const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  const lines: string[] = [];
  const paragraphs = text.split(/\n+/).map(line => line.trim()).filter(Boolean);

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
  const storyNodes = nodes.filter(node => node.type === 'storyNode' && !node.data?.hidden);
  const root = storyNodes.find(node => node.data?.isRoot) || storyNodes[0];
  if (!root) return [];

  const visited = new Set<string>();
  const ordered: FlowNode[] = [];

  const visit = (nodeId: string) => {
    if (visited.has(nodeId)) return;
    const node = storyNodes.find(item => item.id === nodeId);
    if (!node) return;
    visited.add(nodeId);
    ordered.push(node);
    edges
      .filter(edge => edge.source === nodeId)
      .sort((a, b) => String(a.data?.label || '').localeCompare(String(b.data?.label || '')))
      .forEach(edge => visit(edge.target));
  };

  visit(root.id);
  storyNodes
    .filter(node => !visited.has(node.id))
    .sort((a, b) => (a.position.y - b.position.y) || (a.position.x - b.position.x))
    .forEach(node => ordered.push(node));

  return ordered;
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

export function VideoRenderModal({ nodes, edges, onClose, language }: VideoRenderModalProps) {
  const orderedNodes = useMemo(() => getOrderedStoryNodes(nodes, edges), [nodes, edges]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(orderedNodes.map(node => node.id)));
  const [timelineIds, setTimelineIds] = useState<string[]>(() => orderedNodes.map(node => node.id));
  const [activePreviewId, setActivePreviewId] = useState<string>(() => orderedNodes[0]?.id || '');
  const [resolutionIndex, setResolutionIndex] = useState(0);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('webm');
  const [speed, setSpeed] = useState(1);
  const [defaultSeconds, setDefaultSeconds] = useState(4);
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
  });
  const [status, setStatus] = useState<RenderStatus>('idle');
  const [progress, setProgress] = useState('');
  const [progressValue, setProgressValue] = useState(0);
  const [estimatedDuration, setEstimatedDuration] = useState(0);
  const [previewTime, setPreviewTime] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(defaultSeconds);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [error, setError] = useState('');
  const [savedPath, setSavedPath] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const nodeById = useMemo(() => new Map(orderedNodes.map(node => [node.id, node])), [orderedNodes]);
  const timelineNodes = useMemo(() => timelineIds.map(id => nodeById.get(id)).filter(Boolean) as FlowNode[], [nodeById, timelineIds]);
  const selectedNodes = useMemo(() => timelineNodes.filter(node => selectedIds.has(node.id)), [timelineNodes, selectedIds]);
  const activePreviewNode = nodeById.get(activePreviewId) || selectedNodes[0] || orderedNodes[0];
  const resolution = RESOLUTION_OPTIONS[resolutionIndex] || RESOLUTION_OPTIONS[0];
  const isZh = language === 'zh';
  const fallbackEstimatedSeconds = selectedNodes.length * defaultSeconds / speed;

  React.useEffect(() => {
    const validIds = new Set(orderedNodes.map(node => node.id));
    setTimelineIds(prev => {
      const kept = prev.filter(id => validIds.has(id));
      const missing = orderedNodes.map(node => node.id).filter(id => !kept.includes(id));
      return [...kept, ...missing];
    });
    setSelectedIds(prev => new Set([...prev].filter(id => validIds.has(id))));
    setActivePreviewId(prev => (prev && validIds.has(prev) ? prev : orderedNodes[0]?.id || ''));
  }, [orderedNodes]);

  React.useEffect(() => {
    setPreviewTime(0);
    setPreviewPlaying(false);
  }, [activePreviewNode?.id]);

  React.useEffect(() => {
    setPreviewTime(prev => Math.min(prev, previewDuration));
  }, [previewDuration]);

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
        const videoUrl = node.data?.videoUrl as string | undefined;
        const audioUrl = node.data?.audioUrl as string | undefined;
        if (videoUrl) {
          try {
            const video = await loadVideo(videoUrl);
            total += Number.isFinite(video.duration) && video.duration > 0 ? video.duration : defaultSeconds;
            continue;
          } catch {
            total += defaultSeconds;
            continue;
          }
        }
        const audioDuration = audioUrl ? await getAudioDuration(audioUrl) : 0;
        total += audioDuration > 0 ? audioDuration : defaultSeconds;
      }
      if (!cancelled) setEstimatedDuration(total / speed);
    };
    measureDuration();
    return () => {
      cancelled = true;
    };
  }, [selectedNodes, defaultSeconds, speed]);

  const toggleNode = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addNodeToTimeline = (id: string) => {
    if (!nodeById.has(id)) return;
    setTimelineIds(prev => (prev.includes(id) ? prev : [...prev, id]));
    setSelectedIds(prev => new Set(prev).add(id));
    setActivePreviewId(id);
  };

  const reorderTimelineNode = (dragId: string, targetId: string, placement: 'before' | 'after' = 'before') => {
    if (!dragId || !targetId || dragId === targetId) return;
    setTimelineIds(prev => {
      const withoutDragged = prev.filter(id => id !== dragId);
      const targetIndex = withoutDragged.indexOf(targetId);
      if (targetIndex < 0) return prev;
      const next = [...withoutDragged];
      next.splice(placement === 'after' ? targetIndex + 1 : targetIndex, 0, dragId);
      return next;
    });
  };

  const removeTimelineNode = (id: string) => {
    setTimelineIds(prev => prev.filter(item => item !== id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (activePreviewId === id) {
      const nextNode = timelineNodes.find(node => node.id !== id) || orderedNodes.find(node => node.id !== id);
      setActivePreviewId(nextNode?.id || '');
    }
  };

  const handleAssetDragStart = (event: React.DragEvent, id: string) => {
    event.stopPropagation();
    event.dataTransfer.setData('application/x-galwriter-node', id);
    event.dataTransfer.setData('text/plain', id);
    event.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleTimelineDrop = (event: React.DragEvent, targetId?: string) => {
    event.preventDefault();
    event.stopPropagation();
    const draggedId = event.dataTransfer.getData('application/x-galwriter-node') || event.dataTransfer.getData('text/plain');
    if (!draggedId) return;
    if (targetId && timelineIds.includes(draggedId)) {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      reorderTimelineNode(draggedId, targetId, event.clientX > rect.left + rect.width / 2 ? 'after' : 'before');
    }
    else addNodeToTimeline(draggedId);
  };

  const updateRenderStyle = <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => {
    setRenderStyle(prev => ({ ...prev, [key]: value }));
  };

  const updateProgress = (label: string, current: number, total: number) => {
    const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
    setProgress(`${label} ${percent}%`);
    setProgressValue(percent);
  };

  const writeZipAssetsToSession = async (zip: JSZip, workDir: string, invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>) => {
    const assetFiles = Object.values(zip.files).filter(file => !file.dir && file.name.startsWith('assets/'));
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
      updateProgress(isZh ? '写入 ZIP 素材' : 'Writing ZIP assets', fileIndex + 1, assetFiles.length);
    }
  };

  const renderFromZipProject = async () => {
    if (!zipFile) {
      throw new Error(isZh ? '请先选择已经保存好的剧本 ZIP。' : 'Please choose a saved project ZIP first.');
    }

    const { invoke } = await import('@tauri-apps/api/core');
    updateProgress(isZh ? '读取 ZIP 工程' : 'Reading ZIP project', 5, 100);
    const zip = await JSZip.loadAsync(zipFile);
    const projectJson = zip.file('project.json');
    if (!projectJson) throw new Error(isZh ? 'ZIP 中没有 project.json。' : 'project.json was not found in the ZIP.');
    const projectData = JSON.parse(await projectJson.async('string'));
    const zipNodes = (projectData.nodes || []) as FlowNode[];
    const zipEdges = (projectData.edges || []) as FlowEdge[];
    const orderedZipNodes = getOrderedStoryNodes(zipNodes, zipEdges).filter(node => selectedIds.has(node.id));
    if (orderedZipNodes.length === 0) throw new Error(isZh ? 'ZIP 工程里没有选中的片段。' : 'No selected segments were found in the ZIP.');

    const fileName = `galwriter-render-${Date.now()}`;
    const session = await invoke<TauriRenderSessionResult>('create_render_session', { fileName, outputDir });
    await writeZipAssetsToSession(zip, session.workDir, invoke);

    const segments: HighPerfSegmentPayload[] = orderedZipNodes.map(node => ({
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
      typewriter: typewriterEnabled,
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

  const drawFrame = async (
    ctx: CanvasRenderingContext2D,
    node: FlowNode,
    width: number,
    height: number,
    media?: { source: CanvasImageSource; width: number; height: number },
  ) => {
    const title = htmlToSpeechText(String(node.data?.title || ''));
    const body = htmlToSpeechText(String(node.data?.text || ''));

    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, width, height);

    if (media) {
      drawCoverImage(ctx, media.source, media.width || width, media.height || height, width, height);
    } else {
      const imageUrl = node.data?.imageUrl as string | undefined;
      if (imageUrl) {
        try {
          const image = await loadImage(imageUrl);
          drawCoverImage(ctx, image, image.naturalWidth || width, image.naturalHeight || height, width, height);
        } catch {
          ctx.fillStyle = '#1f2937';
          ctx.fillRect(0, 0, width, height);
        }
      }
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
    const titleLines = wrapText(ctx, title || (isZh ? '未命名片段' : 'Untitled segment'), maxTextWidth).slice(0, 2);
    ctx.font = `500 ${bodySize}px "Microsoft YaHei", "Noto Sans SC", Arial, sans-serif`;
    const bodyLines = wrapText(ctx, body || '', maxTextWidth).slice(0, 7);
    const textHeight = titleLines.length * titleLineHeight + (bodyLines.length ? Math.round(bodySize * 0.6) : 0) + bodyLines.length * bodyLineHeight;
    let y = height - margin - textHeight;

    ctx.fillStyle = renderStyle.panelColor;
    ctx.globalAlpha = 0.62;
    ctx.fillRect(margin * 0.72, y - bodySize * 0.8, width - margin * 1.44, textHeight + bodySize * 1.35);
    ctx.globalAlpha = 1;

    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 12;
    ctx.font = `800 ${titleSize}px "Microsoft YaHei", "Noto Sans SC", Arial, sans-serif`;
    ctx.fillStyle = renderStyle.titleColor;
    titleLines.forEach(line => {
      ctx.fillText(line, margin, y);
      y += titleLineHeight;
    });

    if (bodyLines.length) y += Math.round(bodySize * 0.6);
    ctx.font = `500 ${bodySize}px "Microsoft YaHei", "Noto Sans SC", Arial, sans-serif`;
    ctx.fillStyle = renderStyle.bodyColor;
    bodyLines.forEach(line => {
      ctx.fillText(line, margin, y);
      y += bodyLineHeight;
    });
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
      setError(isZh
        ? '当前环境不支持浏览器录制 WebM，无法生成可转码的源视频。'
        : 'This environment cannot record WebM, so a transcodable source video cannot be generated.');
      return;
    }

    const shouldUseTauriExport = isTauriRuntime();
    if (!shouldUseTauriExport && exportFormat !== 'webm') {
      setStatus('error');
      setError(isZh
        ? `${exportFormat.toUpperCase()} 需要 Tauri 桌面端调用 FFmpeg 转码。网页端只能直接导出 WebM。`
        : `${exportFormat.toUpperCase()} requires Tauri desktop FFmpeg transcoding. Web export can only save WebM directly.`);
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

      const videoStream = canvas.captureStream(frameRate);
      const audioContext = new AudioContext();
      const audioDestination = audioContext.createMediaStreamDestination();
      audioDestination.stream.getAudioTracks().forEach(track => videoStream.addTrack(track));

      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(videoStream, { mimeType: recordMimeType });
      recorder.ondataavailable = event => {
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
          const source = audioContext.createMediaElementSource(video);
          source.connect(audioDestination);
          source.connect(audioContext.destination);
          await video.play();
          const renderStart = performance.now();
          const durationMs = Math.max(500, ((video.duration || defaultSeconds) / speed) * 1000);
          while (performance.now() - renderStart < durationMs) {
            await drawFrame(ctx, node, resolution.width, resolution.height, {
              source: video,
              width: video.videoWidth || resolution.width,
              height: video.videoHeight || resolution.height,
            });
            await wait(1000 / 30);
          }
          video.pause();
          source.disconnect();
          continue;
        }

        await drawFrame(ctx, node, resolution.width, resolution.height);

        if (audioUrl) {
          const audio = new Audio(audioUrl);
          audio.crossOrigin = 'anonymous';
          audio.playbackRate = speed;
          const source = audioContext.createMediaElementSource(audio);
          source.connect(audioDestination);
          source.connect(audioContext.destination);
          await audio.play();
          const duration = await getAudioDuration(audioUrl);
          await wait(Math.max(400, (duration / speed) * 1000));
          audio.pause();
          source.disconnect();
        } else {
          await wait(Math.max(500, (defaultSeconds / speed) * 1000));
        }
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
      const videoUrl = activePreviewNode.data?.videoUrl as string | undefined;
      const audioUrl = activePreviewNode.data?.audioUrl as string | undefined;
      if (videoUrl) {
        try {
          const video = await loadVideo(videoUrl);
          if (!cancelled) setPreviewDuration(Number.isFinite(video.duration) && video.duration > 0 ? video.duration : defaultSeconds);
          return;
        } catch {
          if (!cancelled) setPreviewDuration(defaultSeconds);
          return;
        }
      }

      const audioDuration = audioUrl ? await getAudioDuration(audioUrl) : 0;
      if (!cancelled) setPreviewDuration(audioDuration > 0 ? audioDuration : defaultSeconds);
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
    canvas.width = resolution.width;
    canvas.height = resolution.height;

    const drawPreview = async () => {
      const videoUrl = activePreviewNode.data?.videoUrl as string | undefined;
      if (videoUrl) {
        try {
          const video = await loadVideo(videoUrl);
          await seekVideo(video, previewTime);
          if (cancelled) return;
          await drawFrame(ctx, activePreviewNode, resolution.width, resolution.height, {
            source: video,
            width: video.videoWidth || resolution.width,
            height: video.videoHeight || resolution.height,
          });
          return;
        } catch {
          if (cancelled) return;
        }
      }
      await drawFrame(ctx, activePreviewNode, resolution.width, resolution.height);
    };

    drawPreview().catch(() => {
      if (cancelled) return;
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, resolution.width, resolution.height);
    });
    return () => {
      cancelled = true;
    };
  }, [activePreviewNode, previewTime, resolution.width, resolution.height, renderStyle, status]);

  React.useEffect(() => {
    if (!previewPlaying || status === 'rendering') return;
    const startedAt = performance.now();
    const startTime = previewTime;
    const timer = window.setInterval(() => {
      const nextTime = startTime + ((performance.now() - startedAt) / 1000) * speed;
      if (nextTime >= previewDuration) {
        setPreviewTime(previewDuration);
        setPreviewPlaying(false);
        return;
      }
      setPreviewTime(nextTime);
    }, 120);
    return () => window.clearInterval(timer);
  }, [previewPlaying, previewTime, previewDuration, speed, status]);

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

  const segmentTitle = (node: FlowNode) => String(node.data?.title || (isZh ? '未命名片段' : 'Untitled segment'));
  const segmentText = (node: FlowNode) => stripHtml(String(node.data?.text || '')).trim();
  const segmentDurationLabel = (node: FlowNode) => {
    if (node.data?.videoUrl) return isZh ? '按视频时长' : 'Video length';
    if (node.data?.audioUrl) return isZh ? '按音频时长' : 'Audio length';
    return `${defaultSeconds}s`;
  };

  return (
    <div className="fixed inset-0 z-[350] bg-[#0b1020] text-slate-100">
      <div className="h-full w-full grid grid-rows-[56px_minmax(0,1fr)_230px]">
        <header className="h-14 px-4 border-b border-white/10 bg-[#111827] flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-200">
              <Film className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black truncate">{isZh ? '渲染剧本视频' : 'Render Script Video'}</h2>
              <p className="text-[11px] text-slate-400 truncate">{isZh ? '素材、预览、导出和时间线集中在一个全屏工作台。' : 'Assets, preview, export and timeline in a full-screen workspace.'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10" title={isZh ? '关闭' : 'Close'}>
            <X className="w-5 h-5" />
          </button>
        </header>

        <main className="min-h-0 grid grid-cols-[280px_minmax(420px,1fr)_340px] bg-[#0b1020]">
          <aside className="min-h-0 border-r border-white/10 bg-[#111827] flex flex-col">
            <div className="h-12 px-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-300">
                <Layers className="w-4 h-4 text-sky-300" />
                {isZh ? '素材卡片' : 'Asset Cards'}
              </div>
              <span className="text-[11px] text-slate-500">{orderedNodes.length}</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-2">
              {orderedNodes.map((node, index) => (
                <div
                  key={node.id}
                  draggable
                  onDragStart={event => handleAssetDragStart(event, node.id)}
                  onClick={() => setActivePreviewId(node.id)}
                  className={`group cursor-grab active:cursor-grabbing rounded-lg border p-2.5 transition-all ${activePreviewNode?.id === node.id ? 'border-sky-400 bg-sky-400/10' : 'border-white/10 bg-white/[0.04] hover:border-sky-400/50 hover:bg-white/[0.07]'}`}
                >
                  <div className="flex gap-3">
                    <div className="relative w-20 h-14 rounded-md overflow-hidden bg-slate-950 border border-white/10 shrink-0 flex items-center justify-center text-slate-400">
                      {node.data?.imageUrl ? (
                        <img src={node.data.imageUrl as string} alt="" className="w-full h-full object-cover" />
                      ) : node.data?.videoUrl ? (
                        <video src={node.data.videoUrl as string} className="w-full h-full object-cover" muted playsInline />
                      ) : (
                        mediaIcon(node, 'w-5 h-5')
                      )}
                      <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-black text-white">{index + 1}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-400">
                        {mediaIcon(node, 'w-3.5 h-3.5')}
                        <span>{mediaKind(node).toUpperCase()}</span>
                      </div>
                      <div className="mt-1 text-xs font-black text-slate-100 truncate">{segmentTitle(node)}</div>
                      <div className="mt-1 text-[11px] text-slate-500 truncate">{segmentText(node) || (isZh ? '无正文' : 'No body text')}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <section className="min-h-0 bg-[#090d19] flex flex-col">
            <div className="h-12 px-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-300">
                <Play className="w-4 h-4 text-emerald-300" />
                {isZh ? '测试预览窗口' : 'Preview Monitor'}
              </div>
              <div className="flex items-center gap-3 text-[11px] font-bold text-slate-400">
                <span>{resolution.label}</span>
                <span>{frameRate} fps</span>
              </div>
            </div>
            <div className="min-h-0 flex-1 p-6 flex items-center justify-center">
              <div className="w-full max-w-5xl">
                <div className="relative rounded-lg bg-black border border-white/10 shadow-2xl overflow-hidden">
                  <canvas ref={canvasRef} className="w-full aspect-video block bg-black" />
                  <div className="absolute left-3 top-3 rounded bg-black/55 px-2 py-1 text-[11px] font-black text-white">
                    {activePreviewNode ? segmentTitle(activePreviewNode) : (isZh ? '暂无预览' : 'No preview')}
                  </div>
                </div>
                <div className="mt-3 rounded-lg border border-white/10 bg-[#111827] px-3 py-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (previewTime >= previewDuration) setPreviewTime(0);
                      setPreviewPlaying(prev => !prev);
                    }}
                    disabled={!activePreviewNode || status === 'rendering'}
                    className="w-9 h-9 rounded-lg bg-white/10 text-white flex items-center justify-center hover:bg-white/15 disabled:opacity-40"
                    title={previewPlaying ? (isZh ? '暂停预览' : 'Pause preview') : (isZh ? '播放预览' : 'Play preview')}
                  >
                    {previewPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <span className="w-12 text-right text-[11px] font-bold text-slate-400">{formatSeconds(previewTime)}</span>
                  <input
                    type="range"
                    min="0"
                    max={Math.max(0.1, previewDuration)}
                    step="0.05"
                    value={Math.min(previewTime, previewDuration)}
                    onChange={event => {
                      setPreviewPlaying(false);
                      setPreviewTime(Math.max(0, Number(event.target.value) || 0));
                    }}
                    className="min-w-0 flex-1 accent-sky-400"
                  />
                  <span className="w-12 text-[11px] font-bold text-slate-400">{formatSeconds(previewDuration)}</span>
                </div>
              </div>
            </div>
          </section>

          <aside className="min-h-0 border-l border-white/10 bg-[#111827] flex flex-col">
            <div className="h-12 px-4 border-b border-white/10 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-300">
              <Settings className="w-4 h-4 text-amber-300" />
              {isZh ? '导出设置' : 'Export Settings'}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
            {false && isTauriRuntime() && exportFormat !== 'webm' && (
              <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3 space-y-3">
                <input
                  ref={zipInputRef}
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={event => setZipFile(event.target.files?.[0] || null)}
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
                    {zipFile ? zipFile.name : (isZh ? '高性能导出需要先保存并选择剧本 ZIP' : 'High performance export needs a saved project ZIP')}
                  </span>
                </div>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-200">
                  <input type="checkbox" checked={typewriterEnabled} onChange={e => setTypewriterEnabled(e.target.checked)} />
                  {isZh ? '启用文字打字机动画' : 'Enable typewriter text animation'}
                </label>
              </div>
            )}
            <div className="space-y-3">
              <label className="space-y-2">
                <span className="text-xs font-black text-slate-300">{isZh ? '分辨率' : 'Resolution'}</span>
                <select value={resolutionIndex} onChange={e => setResolutionIndex(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg bg-[#0b1020] border border-white/10 text-sm text-slate-100">
                  {RESOLUTION_OPTIONS.map((option, index) => <option key={option.label} value={index}>{option.label}</option>)}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs font-black text-slate-300">{isZh ? '导出格式' : 'Export format'}</span>
                <select value={exportFormat} onChange={e => setExportFormat(e.target.value as ExportFormat)} className="w-full px-3 py-2 rounded-lg bg-[#0b1020] border border-white/10 text-sm text-slate-100">
                  {EXPORT_FORMAT_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs font-black text-slate-300">{isZh ? '播放倍速' : 'Playback speed'}</span>
                <div className="px-3 py-2 rounded-lg bg-[#0b1020] border border-white/10">
                  <div className="flex items-center justify-between text-sm font-bold text-slate-100">
                    <span>{speed.toFixed(2)}x</span>
                    <span>{isZh ? `预计 ${formatSeconds(estimatedDuration || fallbackEstimatedSeconds)}` : `Est. ${formatSeconds(estimatedDuration || fallbackEstimatedSeconds)}`}</span>
                  </div>
                  <input type="range" min="0.25" max="3" step="0.25" value={speed} onChange={e => setSpeed(Math.max(0.25, Number(e.target.value) || 1))} className="w-full accent-sky-400" />
                </div>
              </label>
              <label className="space-y-2">
                <span className="text-xs font-black text-slate-300">{isZh ? '视频帧率' : 'Frame rate'}</span>
                <select value={frameRate} onChange={e => setFrameRate(Number(e.target.value) || 30)} className="w-full px-3 py-2 rounded-lg bg-[#0b1020] border border-white/10 text-sm text-slate-100">
                  {FRAME_RATE_OPTIONS.map(option => <option key={option} value={option}>{option} fps</option>)}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs font-black text-slate-300">{isZh ? 'GPU/编码器' : 'GPU / Encoder'}</span>
                <select value={encoder} onChange={e => setEncoder(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[#0b1020] border border-white/10 text-sm text-slate-100">
                  {ENCODER_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs font-black text-slate-300">{isZh ? '无音频片段停留秒数' : 'Seconds for segments without audio'}</span>
                <input type="number" min="1" max="30" step="1" value={defaultSeconds} onChange={e => setDefaultSeconds(Math.max(1, Number(e.target.value) || 4))} className="w-full px-3 py-2 rounded-lg bg-[#0b1020] border border-white/10 text-sm text-slate-100" />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-black text-slate-300">{isZh ? '标题字号' : 'Title size'}</span>
                <input type="number" min="18" max="120" step="2" value={renderStyle.titleFontSize} onChange={e => updateRenderStyle('titleFontSize', Math.max(18, Number(e.target.value) || 56))} className="w-full px-3 py-2 rounded-lg bg-[#0b1020] border border-white/10 text-sm text-slate-100" />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-black text-slate-300">{isZh ? '正文字号' : 'Body size'}</span>
                <input type="number" min="16" max="96" step="2" value={renderStyle.bodyFontSize} onChange={e => updateRenderStyle('bodyFontSize', Math.max(16, Number(e.target.value) || 38))} className="w-full px-3 py-2 rounded-lg bg-[#0b1020] border border-white/10 text-sm text-slate-100" />
              </label>
              <div className="grid grid-cols-3 gap-2">
                <label className="space-y-2">
                  <span className="text-xs font-black text-slate-300">{isZh ? '标题' : 'Title'}</span>
                  <input type="color" value={renderStyle.titleColor} onChange={e => updateRenderStyle('titleColor', e.target.value)} className="w-full h-9 px-1 py-1 rounded-lg bg-[#0b1020] border border-white/10" />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-black text-slate-300">{isZh ? '正文' : 'Body'}</span>
                  <input type="color" value={renderStyle.bodyColor} onChange={e => updateRenderStyle('bodyColor', e.target.value)} className="w-full h-9 px-1 py-1 rounded-lg bg-[#0b1020] border border-white/10" />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-black text-slate-300">{isZh ? '底色' : 'Panel'}</span>
                  <input type="color" value={renderStyle.panelColor} onChange={e => updateRenderStyle('panelColor', e.target.value)} className="w-full h-9 px-1 py-1 rounded-lg bg-[#0b1020] border border-white/10" />
                </label>
              </div>
              <label className="space-y-2">
                <span className="text-xs font-black text-slate-300">{isZh ? '保存位置' : 'Save location'}</span>
                <input type="text" value={outputDir} onChange={e => setOutputDir(e.target.value)} placeholder={isZh ? '默认保存到系统下载目录' : 'Defaults to Downloads'} className="w-full px-3 py-2 rounded-lg bg-[#0b1020] border border-white/10 text-sm text-slate-100" />
              </label>
            </div>
            <button
              onClick={renderVideo}
              disabled={status === 'rendering' || selectedNodes.length === 0}
              className="w-full py-3 rounded-lg bg-sky-400 text-slate-950 text-sm font-black flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.99] hover:bg-sky-300"
            >
              {status === 'rendering' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {status === 'rendering' ? (isZh ? '渲染中...' : 'Rendering...') : (isZh ? '一键导出视频' : 'Export Video')}
            </button>
            {(progress || error) && (
              <div className="space-y-2">
                {!error && (
                  <div className="h-2 rounded-full bg-black/30 border border-white/10 overflow-hidden">
                    <div className="h-full bg-sky-400 transition-all" style={{ width: `${progressValue}%` }} />
                  </div>
                )}
                <p className={`text-xs font-bold ${error ? 'text-rose-400' : 'text-slate-400'}`}>
                  {error || progress}
                </p>
              </div>
            )}
            {savedPath && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300 break-all">
                {isZh ? '已保存到：' : 'Saved to: '}{savedPath}
              </div>
            )}
            </div>
          </aside>
        </main>

        <section className="min-h-0 border-t border-white/10 bg-[#111827] grid grid-rows-[44px_minmax(0,1fr)]">
          <div className="px-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-300">
              <Clock className="w-4 h-4 text-fuchsia-300" />
              {isZh ? '视频编辑时间线' : 'Editing Timeline'}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setSelectedIds(new Set(timelineIds))} className="px-3 py-1.5 text-xs font-black rounded-lg bg-white/10 text-slate-200 hover:bg-white/15">
                {isZh ? '全选轨道' : 'All tracks'}
              </button>
              <button onClick={() => setSelectedIds(new Set())} className="px-3 py-1.5 text-xs font-black rounded-lg bg-white/10 text-slate-200 hover:bg-white/15">
                {isZh ? '静音全部' : 'Disable all'}
              </button>
            </div>
          </div>
          <div
            className="min-h-0 overflow-x-auto overflow-y-hidden p-4"
            onDragOver={event => {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
            }}
            onDrop={event => handleTimelineDrop(event)}
          >
            <div className="min-w-max space-y-3">
              <div className="grid grid-cols-[76px_minmax(0,1fr)] gap-3 items-center">
                <div className="text-[11px] font-black text-slate-500">{isZh ? '视频轨' : 'Video'}</div>
                <div className="flex items-stretch gap-2">
                  {timelineNodes.map((node, index) => {
                    const enabled = selectedIds.has(node.id);
                    const widthClass = node.data?.videoUrl ? 'w-48' : node.data?.audioUrl ? 'w-40' : 'w-32';
                    return (
                      <div
                        key={node.id}
                        draggable
                        onDragStart={event => handleAssetDragStart(event, node.id)}
                        onDragOver={event => {
                          event.preventDefault();
                          event.stopPropagation();
                          event.dataTransfer.dropEffect = 'move';
                        }}
                        onDrop={event => handleTimelineDrop(event, node.id)}
                        onClick={() => setActivePreviewId(node.id)}
                        className={`${widthClass} h-20 rounded-lg border p-2 shrink-0 cursor-grab active:cursor-grabbing transition-all ${enabled ? 'border-sky-400/70 bg-sky-400/12' : 'border-white/10 bg-white/[0.03] opacity-55'} ${activePreviewNode?.id === node.id ? 'ring-2 ring-sky-300/50' : ''}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black text-slate-400">#{index + 1}</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={event => {
                                event.stopPropagation();
                                removeTimelineNode(node.id);
                              }}
                              onDragStart={event => event.preventDefault()}
                              className="w-5 h-5 rounded text-slate-500 hover:text-rose-300 hover:bg-rose-400/10 flex items-center justify-center"
                              title={isZh ? '从时间线删除' : 'Remove from timeline'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <GripVertical className="w-3.5 h-3.5 text-slate-500" />
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-1.5 text-[11px] font-black text-slate-200">
                          {mediaIcon(node, 'w-3.5 h-3.5')}
                          <span className="truncate">{segmentTitle(node)}</span>
                        </div>
                        <div className="mt-1 text-[10px] text-slate-500 truncate">{segmentDurationLabel(node)}</div>
                      </div>
                    );
                  })}
                  {timelineNodes.length === 0 && (
                    <div className="w-[520px] h-20 rounded-lg border border-dashed border-white/15 flex items-center justify-center text-xs font-bold text-slate-500">
                      {isZh ? '把左侧素材拖到这里' : 'Drag assets here'}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-[76px_minmax(0,1fr)] gap-3 items-center">
                <div className="text-[11px] font-black text-slate-500">{isZh ? '音频轨' : 'Audio'}</div>
                <div className="flex items-stretch gap-2">
                  {timelineNodes.map(node => (
                    <button
                      key={`${node.id}-audio`}
                      type="button"
                      onClick={() => toggleNode(node.id)}
                      className={`h-12 rounded-lg border px-3 shrink-0 text-left transition-all ${node.data?.audioUrl || node.data?.videoUrl ? 'w-40' : 'w-32'} ${selectedIds.has(node.id) ? 'border-emerald-400/60 bg-emerald-400/10' : 'border-white/10 bg-white/[0.03] opacity-55'}`}
                    >
                      <div className="flex items-center gap-2 text-[11px] font-black text-slate-200">
                        <Music className="w-3.5 h-3.5 text-emerald-300" />
                        <span className="truncate">{node.data?.audioUrl || node.data?.videoUrl ? (isZh ? '关联音频' : 'Linked audio') : (isZh ? '默认停留' : 'Hold')}</span>
                      </div>
                      <div className="mt-1 text-[10px] text-slate-500 truncate">{segmentDurationLabel(node)}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
