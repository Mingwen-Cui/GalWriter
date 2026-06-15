import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react';
import JSZip from 'jszip';

import { resolveRegionBackgroundMusic } from '../../../lib/regionMusic';
import { filterMentionTags } from '../video/shared/storyNodes';

type WebExportOptions = {
  projectName?: string;
  language: 'zh' | 'ja' | 'en';
  style?: WebExportStyle;
  settings?: WebExportSettings;
};

type WebExportStyle = {
  titleFontSize: number;
  bodyFontSize: number;
  titleColor: string;
  bodyColor: string;
  panelColor: string;
  titleAnimation: 'none' | 'fade' | 'slideUp' | 'typewriter';
  bodyAnimation: 'none' | 'fade' | 'slideUp' | 'typewriter';
  choiceColor: string;
  choiceTextColor: string;
};

type WebExportSettings = {
  layoutMode: 'classic' | 'immersive';
  choicesPosition: 'center' | 'aboveText' | 'belowText';
  blurBackground: boolean;
  skipSingleChoicePopup: boolean;
  interactionMode: 'immediate' | 'typewriter';
  typewriterSpeed: number;
  autoAdvance: boolean;
  videoAutoPlay: boolean;
  hideCharacterTags: boolean;
  hideSceneTags: boolean;
};

type WebExportNode = {
  id: string;
  type?: string;
  data: {
    title?: string;
    text?: string;
    color?: string;
    imageUrl?: string;
    videoUrl?: string;
    audioUrl?: string;
    backgroundMusic?: {
      url: string;
      loop: boolean;
      volume: number;
      fadeIn: number;
      fadeOut: number;
    };
    objectFit?: string;
    showTextOverlay?: boolean;
    isRoot?: boolean;
    presentation?: {
      characters: {
        sourceNodeId: string;
        position: 'left' | 'right' | 'center';
        offsetX: number;
        offsetY: number;
        scale: number;
        flipX: boolean;
        layer: number;
        imageUrl?: string;
        name?: string;
      }[];
    };
  };
};

type WebExportEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  label?: string;
};

const IMAGE_EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
};

const safeFilePart = (value: string) =>
  value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'galwriter';

const getDataUrlMime = (url: string) => url.match(/^data:([^;,]+)/i)?.[1]?.toLowerCase() || '';

const getImageExtension = (url: string, fallback = 'png') => {
  const dataMime = getDataUrlMime(url);
  if (dataMime && IMAGE_EXTENSION_BY_MIME[dataMime]) return IMAGE_EXTENSION_BY_MIME[dataMime];
  const cleanUrl = url.split('?')[0].split('#')[0];
  const ext = cleanUrl.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase();
  return ext || fallback;
};

const isPackableImage = (url: unknown): url is string => {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('data:image/')) return true;
  if (trimmed.startsWith('blob:')) return true;
  return /^https?:\/\//i.test(trimmed) || /^\.?\//.test(trimmed);
};

const VIDEO_EXTENSION_BY_MIME: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/ogg': 'ogv',
  'video/quicktime': 'mov',
};

const addVideoAsset = async (
  zip: JSZip,
  url: string | undefined,
  hint: string,
  assetMap: Map<string, string>,
) => {
  if (typeof url !== 'string' || !url.trim()) return url;
  if (assetMap.has(url)) return assetMap.get(url);
  if (
    !url.startsWith('blob:') &&
    !url.startsWith('data:video/') &&
    !/^https?:\/\//i.test(url) &&
    !/^\.?\//.test(url)
  ) {
    return url;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const extension = getImageExtension(url, VIDEO_EXTENSION_BY_MIME[blob.type] || 'mp4');
    const fileName = `videos/${safeFilePart(hint)}-${assetMap.size + 1}.${extension}`;
    zip.file(fileName, blob);
    const relativePath = `./${fileName}`;
    assetMap.set(url, relativePath);
    return relativePath;
  } catch (error) {
    console.warn('Could not pack web export video:', error);
    return url;
  }
};

const addAudioAsset = async (
  zip: JSZip,
  url: string | undefined,
  hint: string,
  assetMap: Map<string, string>,
) => {
  if (typeof url !== 'string' || !url.trim()) return url;
  if (assetMap.has(url)) return assetMap.get(url);
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const extension =
      blob.type === 'audio/mpeg' ? 'mp3' : getImageExtension(url, blob.type.split('/')[1] || 'bin');
    const fileName = `audio/${safeFilePart(hint)}-${assetMap.size + 1}.${extension}`;
    zip.file(fileName, blob);
    const relativePath = `./${fileName}`;
    assetMap.set(url, relativePath);
    return relativePath;
  } catch (error) {
    console.warn('Could not pack web export audio:', error);
    return url;
  }
};

const addImageAsset = async (
  zip: JSZip,
  url: string | undefined,
  hint: string,
  assetMap: Map<string, string>,
) => {
  if (!isPackableImage(url)) return url;
  if (assetMap.has(url)) return assetMap.get(url);

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const extension = getImageExtension(url, IMAGE_EXTENSION_BY_MIME[blob.type] || 'png');
    const fileName = `images/${safeFilePart(hint)}-${assetMap.size + 1}.${extension}`;
    zip.file(fileName, blob);
    const relativePath = `./${fileName}`;
    assetMap.set(url, relativePath);
    return relativePath;
  } catch (error) {
    console.warn('Could not pack web export image:', error);
    return url;
  }
};

const addExportLogoAsset = async (iconFolder: JSZip | null) => {
  if (!iconFolder) return './icons/app.svg';
  try {
    const response = await fetch('./icon.png');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    iconFolder.file('logo.png', blob);
    return './icons/logo.png';
  } catch (error) {
    console.warn('Could not pack web export logo:', error);
    return './icons/app.svg';
  }
};

const nodeTitle = (node: FlowNode) =>
  String(
    node.data?.title ||
      node.data?.characterName ||
      node.data?.sceneName ||
      node.data?.label ||
      'Untitled',
  );

const nodeText = (node: FlowNode) =>
  String(node.data?.text || node.data?.description || node.data?.content || '');

const makeContentScript = (payload: {
  title: string;
  language: string;
  style: WebExportStyle;
  settings: WebExportSettings;
  nodes: WebExportNode[];
  edges: WebExportEdge[];
}) => `window.GALWRITER_CONTENT = ${JSON.stringify(payload, null, 2)};\n`;

const WEB_EXPORT_ICONS: Record<string, string> = {
  'app.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0ea5e9"/><path d="M18 16h28a4 4 0 0 1 4 4v26a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V20a4 4 0 0 1 4-4Z" fill="#082f49"/><path d="M23 26h18M23 34h13M23 42h20" stroke="#e0f2fe" stroke-width="4" stroke-linecap="round"/></svg>`,
  'arrow-left.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#f8fafc" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>`,
  'reset.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#f8fafc" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v6h6"/></svg>`,
  'play.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#f8fafc"><path d="M8 5.2v13.6c0 .8.9 1.3 1.6.9l10.2-6.8a1 1 0 0 0 0-1.7L9.6 4.3A1 1 0 0 0 8 5.2Z"/></svg>`,
  'pause.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#f8fafc"><path d="M7 5h3.2v14H7zM13.8 5H17v14h-3.2z"/></svg>`,
  'wand.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#f8fafc" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 4 5 5"/><path d="M14 5 3 16l5 5L19 10"/><path d="M5 3v4"/><path d="M3 5h4"/><path d="M19 17v4"/><path d="M17 19h4"/></svg>`,
  'eye.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#f8fafc" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>`,
  'eye-off.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#f8fafc" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 3 18 18"/><path d="M10.6 10.6A3 3 0 0 0 13.4 13.4"/><path d="M9.9 5.3A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17.7 17.7 0 0 1-2.3 3.4"/><path d="M6.6 6.8C3.6 8.8 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4.7-1.2"/></svg>`,
};

const makeIndexHtml = (title: string, language: string, faviconPath: string) => `<!doctype html>
<html lang="${language === 'zh' ? 'zh-CN' : language === 'ja' ? 'ja' : 'en'}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <link rel="icon" href="${escapeHtml(faviconPath)}" />
  <script src="./content.js"></script>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background: #10131a;
      color: #f8fafc;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    button { font: inherit; }
    .app {
      width: 100vw;
      height: 100vh;
      display: grid;
      grid-template-rows: auto 1fr;
      overflow: hidden;
      background:
        linear-gradient(180deg, rgba(15, 23, 42, 0.20), rgba(15, 23, 42, 0.84)),
        #10131a;
    }
    .app.immersive header {
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
      z-index: 5;
      // border-bottom: 0;
      // background: linear-gradient(180deg, rgba(0,0,0,0.72), rgba(0,0,0,0.34), transparent);
      // box-shadow: 0 16px 40px rgba(0,0,0,0.28);
    }
    .app.controls-hidden header {
      opacity: 0;
      pointer-events: none;
    }
    header {
      min-height: 56px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 18px;
      // border-bottom: 1px solid rgba(255,255,255,0.12);
      // background: rgba(10, 13, 20, 0.52);
      // backdrop-filter: blur(16px);
      transition: opacity 180ms ease;
    }
    h1 {
      min-width: 0;
      margin: 0;
      overflow: hidden;
      color: #f8fafc;
      font-size: 15px;
      font-weight: 900;
      letter-spacing: 0;
      text-overflow: ellipsis;
      text-shadow: 0 2px 12px rgba(0,0,0,0.72);
      white-space: nowrap;
    }
    .toolbar { margin-left: auto; display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
    .tool {
      border: 1px solid rgba(255,255,255,0.16);
      background: rgba(255,255,255,0.08);
      color: #f8fafc;
      border-radius: 8px;
      padding: 8px 11px;
      cursor: pointer;
      min-height: 38px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      text-decoration: none;
    }
    .tool img { width: 18px; height: 18px; display: block; }
    .tool:disabled { opacity: 0.4; cursor: not-allowed; }
    .playlist-wrap { position: relative; }
    .playlist-panel {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      z-index: 40;
      width: min(340px, calc(100vw - 24px));
      height: 360px;
      display: none;
      flex-direction: column;
      padding: 12px;
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 16px;
      background: rgba(8, 12, 20, 0.94);
      box-shadow: 0 24px 70px rgba(0,0,0,0.5);
      backdrop-filter: blur(18px);
    }
    .playlist-panel.open { display: flex; }
    .playlist-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 10px;
    }
    .playlist-title { font-size: 14px; font-weight: 900; }
    .playlist-hint { margin-top: 3px; color: rgba(255,255,255,0.46); font-size: 11px; }
    .playlist-close {
      width: 30px;
      height: 30px;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: rgba(255,255,255,0.64);
      cursor: pointer;
    }
    .playlist-close:hover { background: rgba(255,255,255,0.1); color: #fff; }
    .playlist-items { min-height: 0; flex: 1; overflow-y: auto; display: grid; align-content: start; gap: 8px; }
    .playlist-empty {
      height: 100%;
      display: grid;
      place-items: center;
      padding: 24px;
      border: 1px dashed rgba(255,255,255,0.16);
      border-radius: 12px;
      color: rgba(255,255,255,0.42);
      font-size: 12px;
      text-align: center;
    }
    .playlist-item {
      min-height: 56px;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      background: rgba(255,255,255,0.05);
    }
    .playlist-item.active { border-color: rgba(56,189,248,0.5); background: rgba(14,165,233,0.15); }
    .playlist-name {
      min-width: 0;
      flex: 1;
      overflow: hidden;
      text-align: center;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 13px;
    }
    .playlist-play {
      width: 36px;
      height: 36px;
      flex: 0 0 auto;
      border: 0;
      border-radius: 999px;
      background: #0ea5e9;
      color: #fff;
      cursor: pointer;
      font-size: 15px;
    }
    .playlist-play:hover { background: #38bdf8; }
    main {
      position: relative;
      min-height: 0;
      display: grid;
      place-items: center;
      padding: 0;
      overflow: hidden;
    }
    .app.immersive main {
      padding: 0;
    }
    .backdrop {
      position: absolute;
      inset: 0;
      background-position: center;
      background-size: cover;
      opacity: 0.72;
      transition: background-image 180ms ease, opacity 180ms ease;
    }
    .backdrop::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(8,11,18,0.25), rgba(8,11,18,0.72));
    }
    .app.immersive .backdrop { display: none; }
    .stage {
      position: relative;
      z-index: 1;
      width: 100%;
      height: 100%;
      max-height: none;
      display: grid;
      grid-template-rows: minmax(0, 1fr) auto;
      border: 0;
      background: transparent;
      border-radius: 0;
      overflow: hidden;
      box-shadow: none;
      backdrop-filter: blur(18px);
    }
    .app.immersive .stage {
      display: block;
      width: 100%;
      height: 100vh;
      max-height: 100vh;
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
      backdrop-filter: none;
    }
    .app.immersive .media {
      position: absolute;
      inset: 0;
      z-index: 0;
      width: 100%;
      height: 100%;
      margin: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
    }
    .media {
      position: relative;
      min-height: 0;
      width: fit-content;
      height: fit-content;
      max-width: calc(100% - clamp(28px, 5vw, 48px));
      max-height: calc(100% - clamp(28px, 5vw, 48px));
      place-self: center;
      display: inline-grid;
      place-items: center;
      margin: 0;
      background: rgba(0,0,0,0.24);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      overflow: hidden;
    }
    .presentation-scale {
      position: relative;
      display: inline-grid;
      place-items: center;
      transform-origin: center;
    }
    .app.immersive .presentation-scale {
      width: 100%;
      height: 100%;
    }
    .scene-image {
      position: relative;
      z-index: 1;
      display: block;
      width: auto;
      height: auto;
      max-width: min(100%, calc(100vw - clamp(28px, 5vw, 48px)));
      max-height: calc(100vh - 220px);
      object-fit: contain;
    }
    .presentation-scale > video {
      position: relative;
      z-index: 1;
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }
    .app.immersive .scene-image,
    .app.immersive .presentation-scale > video {
      width: 100%;
      height: 100%;
      max-width: none;
      max-height: none;
      object-fit: contain;
    }
    .media.empty { color: rgba(248,250,252,0.42); font-weight: 700; }
    .characters-layer {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 2;
      overflow: hidden;
    }
    .character-img {
      position: absolute;
      max-height: 92%;
      max-width: 72%;
      width: auto;
      object-fit: contain;
      object-position: bottom;
      transform-origin: center center;
    }
    .dialogue {
      border-top: 1px solid rgba(255,255,255,0.14);
      height: auto;
      max-height: min(45vh, 420px);
      padding: clamp(14px, 2.5vw, 20px) clamp(64px, 8vw, 96px);
      background: color-mix(in srgb, var(--panel-color, rgba(7, 10, 16, 0.82)), transparent 18%);
      box-shadow: 0 -14px 36px rgba(0,0,0,0.18);
      overflow: auto;
    }
    .app.immersive .dialogue {
      position: absolute;
      left: 50%;
      bottom: clamp(14px, 3vh, 24px);
      z-index: 4;
      margin: 0;
      width: min(960px, calc(100% - 112px));
      max-height: min(46vh, 430px);
      padding: clamp(14px, 2.5vw, 20px);
      transform: translateX(-50%);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 12px;
      background: color-mix(in srgb, var(--panel-color, rgba(7, 10, 16, 0.82)), transparent 36%);
      box-shadow: 0 24px 80px rgba(0,0,0,0.30);
      backdrop-filter: blur(18px);
    }
    .title {
      margin: 0 0 8px;
      color: var(--title-color, #f8fafc);
      font-size: var(--title-size, 18px);
      font-weight: 900;
      line-height: 1.18;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .text {
      color: var(--body-color, #e5e7eb);
      line-height: 1.55;
      font-size: var(--body-size, 16px);
      overflow-wrap: anywhere;
    }
    .text.typewriter-reserved { position: relative; }
    .typewriter-placeholder {
      display: block;
      visibility: hidden;
      white-space: pre-wrap;
    }
    .typewriter-visible {
      position: absolute;
      inset: 0;
      display: block;
      white-space: pre-wrap;
    }
    .zen-toggle {
      position: absolute;
      right: 24px;
      bottom: 24px;
      z-index: 18;
      width: 44px;
      height: 44px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.14);
      background: rgba(0,0,0,0.44);
      color: #f8fafc;
      box-shadow: 0 18px 48px rgba(0,0,0,0.28);
      backdrop-filter: blur(14px);
      cursor: pointer;
    }
    .zen-toggle:hover { background: rgba(0,0,0,0.62); }
    .zen-toggle img { width: 20px; height: 20px; display: block; margin: auto; }
    .text :first-child { margin-top: 0; }
    .text :last-child { margin-bottom: 0; }
    .choices {
      display: grid;
      gap: 10px;
      margin-top: 18px;
    }
    .choices.above { margin-bottom: 14px; margin-top: 0; }
    .choices.center {
      position: absolute;
      left: 50%;
      top: 50%;
      z-index: 6;
      width: min(520px, calc(100% - 32px));
      max-height: min(62vh, 420px);
      transform: translate(-50%, -50%);
      margin: 0;
    }
    .choice {
      width: 100%;
      border: 1px solid color-mix(in srgb, var(--choice-color, #0ea5e9), white 25%);
      background: color-mix(in srgb, var(--choice-color, #0ea5e9), transparent 20%);
      color: var(--choice-text-color, #ffffff);
      border-radius: 8px;
      padding: 12px 14px;
      text-align: left;
      line-height: 1.35;
      cursor: pointer;
      transition: background 140ms ease, border-color 140ms ease;
    }
    .choice:hover {
      background: color-mix(in srgb, var(--choice-color, #0ea5e9), transparent 68%);
      border-color: color-mix(in srgb, var(--choice-color, #0ea5e9), white 52%);
    }
    .anim-fade { animation: fadeIn 360ms ease both; }
    .anim-slideUp { animation: slideUp 360ms ease both; }
    .anim-typewriter { animation: fadeIn 180ms ease both; }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .end {
      min-height: 100%;
      display: grid;
      place-items: center;
      padding: 48px 20px;
      text-align: center;
      color: #e2e8f0;
      font-size: 24px;
      font-weight: 900;
    }
    @media (max-width: 720px) {
      main { padding: 0; }
      header { align-items: center; }
      h1 { max-width: 34vw; font-size: 13px; }
      .toolbar { width: auto; min-width: 0; justify-content: flex-end; }
      .tool { flex: 0 0 auto; }
      .stage {
        height: 100%;
        max-height: none;
      }
      .media {
        max-width: calc(100% - 24px);
        max-height: calc(100% - 24px);
      }
      .scene-image {
        max-width: calc(100vw - 24px);
        max-height: calc(100vh - 210px);
      }
      .app.immersive .stage {
        height: 100vh;
        max-height: 100vh;
      }
      .dialogue { padding: 16px; }
      .app:not(.immersive) .dialogue { padding-left: 56px; padding-right: 56px; }
      .app.immersive .dialogue {
        width: calc(100% - 24px);
        left: 12px;
        right: 12px;
        transform: none;
      }
    }
  </style>
</head>
<body>
  <div class="app">
    <header>
      <h1 id="projectTitle"></h1>
      <div class="toolbar">
        <button class="tool" id="backButton" type="button"></button>
        <button class="tool" id="resetButton" type="button"></button>
        <button class="tool" id="autoButton" type="button"></button>
        <div class="playlist-wrap">
          <button class="tool" id="playlistButton" type="button" aria-expanded="false"></button>
          <div class="playlist-panel" id="playlistPanel">
            <div class="playlist-head">
              <div>
                <div class="playlist-title" id="playlistTitle"></div>
                <div class="playlist-hint" id="playlistHint"></div>
              </div>
              <button class="playlist-close" id="playlistClose" type="button" aria-label="Close">&#10005;</button>
            </div>
            <div class="playlist-items" id="playlistItems"></div>
          </div>
        </div>
        <a class="tool" id="makeButton" href="https://mingwencui.com/AIwriter/?lang=zh" target="_blank" rel="noopener noreferrer"></a>
      </div>
    </header>
    <main>
      <div class="backdrop" id="backdrop"></div>
      <section class="stage" id="stage"></section>
      <button class="zen-toggle" id="zenButton" type="button" aria-label="Toggle controls"><img src="./icons/eye.svg" alt="" /></button>
      <audio id="playlistAudio" preload="auto" hidden></audio>
    </main>
  </div>
  <script>
    const content = window.GALWRITER_CONTENT || { nodes: [], edges: [], title: "GalWriter" };
    const style = content.style || {};
    const settings = content.settings || {};
    settings.layoutMode = settings.layoutMode || "immersive";
    settings.choicesPosition = settings.choicesPosition || "center";
    settings.interactionMode = settings.interactionMode || "typewriter";
    settings.typewriterSpeed = Math.max(0, Number(settings.typewriterSpeed) || 65);
    settings.autoAdvance = Boolean(settings.autoAdvance);
    settings.videoAutoPlay = Boolean(settings.videoAutoPlay);
    settings.blurBackground = Boolean(settings.blurBackground);
    settings.skipSingleChoicePopup = settings.skipSingleChoicePopup !== false;
    document.documentElement.style.setProperty("--title-size", Math.max(12, Number(style.titleFontSize) || 18) + "px");
    document.documentElement.style.setProperty("--body-size", Math.max(12, Number(style.bodyFontSize) || 18) + "px");
    document.documentElement.style.setProperty("--title-color", style.titleColor || "#f8fafc");
    document.documentElement.style.setProperty("--body-color", style.bodyColor || "#e5e7eb");
    document.documentElement.style.setProperty("--panel-color", style.panelColor || "rgba(7, 10, 16, 0.82)");
    document.documentElement.style.setProperty("--choice-color", style.choiceColor || "#0ea5e9");
    document.documentElement.style.setProperty("--choice-text-color", style.choiceTextColor || "#ffffff");
    const labels = content.language === "zh"
      ? { back: "\\u8fd4\\u56de", reset: "\\u91cd\\u5f00", autoOn: "\\u81ea\\u52a8\\u64ad\\u653e", autoOff: "\\u624b\\u52a8\\u64ad\\u653e", make: "\\u5236\\u4f5c\\u540c\\u6b3e", continue: "\\u7ee7\\u7eed", option: "\\u9009\\u9879", end: "\\u5267\\u672c\\u7ed3\\u675f", noStory: "\\u6ca1\\u6709\\u53ef\\u9884\\u89c8\\u7684\\u5267\\u672c", playlist: "\\u58f0\\u97f3\\u56de\\u653e", playlistHint: "\\u6700\\u8fd1\\u542c\\u8fc7\\u7684\\u5f55\\u97f3\\u6392\\u5728\\u6700\\u4e0a\\u65b9", playlistEmpty: "\\u542c\\u8fc7\\u7684\\u5f55\\u97f3\\u4f1a\\u663e\\u793a\\u5728\\u8fd9\\u91cc", untitledAudio: "\\u672a\\u547d\\u540d\\u5f55\\u97f3" }
      : content.language === "ja"
        ? { back: "\\u623b\\u308b", reset: "\\u3084\\u308a\\u76f4\\u3059", autoOn: "\\u81ea\\u52d5\\u518d\\u751f", autoOff: "\\u624b\\u52d5\\u518d\\u751f", make: "\\u540c\\u3058\\u3082\\u306e\\u3092\\u4f5c\\u308b", continue: "\\u7d9a\\u3051\\u308b", option: "\\u9078\\u629e\\u80a2", end: "\\u7d42\\u4e86", noStory: "\\u30d7\\u30ec\\u30d3\\u30e5\\u30fc\\u3067\\u304d\\u308b\\u811a\\u672c\\u304c\\u3042\\u308a\\u307e\\u305b\\u3093", playlist: "\\u97f3\\u58f0\\u518d\\u751f", playlistHint: "\\u6700\\u8fd1\\u8074\\u3044\\u305f\\u9332\\u97f3\\u3092\\u4e0a\\u306b\\u8868\\u793a", playlistEmpty: "\\u518d\\u751f\\u3057\\u305f\\u9332\\u97f3\\u304c\\u3053\\u3053\\u306b\\u8868\\u793a\\u3055\\u308c\\u307e\\u3059", untitledAudio: "\\u540d\\u79f0\\u672a\\u8a2d\\u5b9a\\u306e\\u9332\\u97f3" }
        : { back: "Back", reset: "Restart", autoOn: "Auto Play", autoOff: "Manual", make: "Make One", continue: "Continue", option: "Option", end: "The End", noStory: "No story to preview", playlist: "Audio replay", playlistHint: "Most recently heard first", playlistEmpty: "Audio you have heard will appear here", untitledAudio: "Untitled audio" };
    const nodeById = new Map(content.nodes.map((node) => [node.id, node]));
    const root = content.nodes.find((node) => node.data && node.data.isRoot) || content.nodes[0] || null;
    let currentId = root ? root.id : null;
    let history = [];

    const titleEl = document.getElementById("projectTitle");
    const stageEl = document.getElementById("stage");
    const backdropEl = document.getElementById("backdrop");
    const backButton = document.getElementById("backButton");
    const resetButton = document.getElementById("resetButton");
    const autoButton = document.getElementById("autoButton");
    const playlistButton = document.getElementById("playlistButton");
    const playlistPanel = document.getElementById("playlistPanel");
    const playlistClose = document.getElementById("playlistClose");
    const playlistTitle = document.getElementById("playlistTitle");
    const playlistHint = document.getElementById("playlistHint");
    const playlistItems = document.getElementById("playlistItems");
    const playlistAudio = document.getElementById("playlistAudio");
    const makeButton = document.getElementById("makeButton");
    const zenButton = document.getElementById("zenButton");
    titleEl.textContent = content.title || "GalWriter";
    backButton.innerHTML = '<img src="./icons/arrow-left.svg" alt="" /><span>' + labels.back + '</span>';
    resetButton.innerHTML = '<img src="./icons/reset.svg" alt="" /><span>' + labels.reset + '</span>';
    playlistButton.innerHTML = '<span aria-hidden="true">&#9835;</span><span>' + labels.playlist + '</span>';
    playlistTitle.textContent = labels.playlist;
    playlistHint.textContent = labels.playlistHint;
    makeButton.innerHTML = '<img src="./icons/wand.svg" alt="" /><span>' + labels.make + '</span>';
    updateAutoButton();
    document.querySelector(".app").classList.toggle("immersive", settings.layoutMode === "immersive");
    let typewriterTimers = [];
    let autoAdvanceTimer = null;
    let controlsHidden = false;
    let playedAudios = [];
    let currentAudioEnded = true;
    let currentVideoEnded = true;
    let regionAudio = null;
    let regionAudioKey = "";
    let regionFadeFrame = 0;

    function fadeRegionAudio(audio, from, to, seconds, done) {
      cancelAnimationFrame(regionFadeFrame);
      const duration = Math.max(0, Number(seconds) || 0) * 1000;
      if (!duration) {
        audio.volume = to;
        if (done) done();
        return;
      }
      const started = performance.now();
      const tick = (now) => {
        const progress = Math.min(1, (now - started) / duration);
        audio.volume = from + (to - from) * progress;
        if (progress < 1) regionFadeFrame = requestAnimationFrame(tick);
        else if (done) done();
      };
      regionFadeFrame = requestAnimationFrame(tick);
    }

    function syncRegionMusic(music) {
      const nextKey = music && music.url ? music.url : "";
      if (regionAudio && regionAudioKey === nextKey) {
        regionAudio.loop = music.loop !== false;
        regionAudio.volume = Math.max(0, Math.min(1, Number(music.volume) || 0));
        return;
      }
      const previous = regionAudio;
      const startNext = () => {
        if (!music || !music.url) return;
        const audio = new Audio(music.url);
        regionAudio = audio;
        regionAudioKey = nextKey;
        audio.loop = music.loop !== false;
        audio._fadeOut = Math.max(0, Number(music.fadeOut) || 0);
        const targetVolume = Math.max(0, Math.min(1, Number(music.volume) || 0));
        audio.volume = Number(music.fadeIn) > 0 ? 0 : targetVolume;
        audio.play().catch(() => {});
        fadeRegionAudio(audio, audio.volume, targetVolume, music.fadeIn);
      };
      if (!previous) {
        startNext();
        return;
      }
      fadeRegionAudio(previous, previous.volume, 0, previous._fadeOut || 0, () => {
        previous.pause();
        if (regionAudio === previous) {
          regionAudio = null;
          regionAudioKey = "";
        }
        startNext();
      });
    }

    function nodeTitle(node) {
      return (node && node.data && node.data.title) || labels.option;
    }

    function audioTitle(node) {
      if (node && node.data && node.data.title) return String(node.data.title);
      const temp = document.createElement("div");
      temp.innerHTML = node && node.data && node.data.text || "";
      const text = (temp.textContent || "").trim().replace(/\\s+/g, " ");
      return text ? text.slice(0, 42) : labels.untitledAudio;
    }

    function renderPlaylist() {
      playlistItems.innerHTML = "";
      if (!playedAudios.length) {
        const empty = document.createElement("div");
        empty.className = "playlist-empty";
        empty.textContent = labels.playlistEmpty;
        playlistItems.appendChild(empty);
        return;
      }
      playedAudios.forEach((item) => {
        const row = document.createElement("div");
        const active = playlistAudio.getAttribute("src") === item.url && !playlistAudio.paused;
        row.className = "playlist-item" + (active ? " active" : "");
        const name = document.createElement("span");
        name.className = "playlist-name";
        name.textContent = item.title;
        name.title = item.title;
        const play = document.createElement("button");
        play.className = "playlist-play";
        play.type = "button";
        play.textContent = active ? "\\u275a\\u275a" : "\\u25b6";
        play.setAttribute("aria-label", active ? "Pause" : "Play");
        play.addEventListener("click", () => togglePlaylistAudio(item));
        row.append(name, play);
        playlistItems.appendChild(row);
      });
    }

    function recordAudio(node, url) {
      if (!node || !url) return;
      playlistAudio.pause();
      const item = { nodeId: node.id, title: audioTitle(node), url };
      playedAudios = [
        item,
        ...playedAudios.filter((audio) => audio.nodeId !== item.nodeId && audio.url !== item.url),
      ];
      renderPlaylist();
    }

    function togglePlaylistAudio(item) {
      const nodeAudio = document.getElementById("nodeAudio");
      if (nodeAudio) nodeAudio.pause();
      if (playlistAudio.getAttribute("src") === item.url) {
        if (playlistAudio.paused) {
          playlistAudio.play().catch(() => {});
        } else {
          playlistAudio.pause();
        }
        return;
      }
      playlistAudio.src = item.url;
      playlistAudio.currentTime = 0;
      playlistAudio.play().catch(() => renderPlaylist());
    }

    function updateAutoButton() {
      autoButton.innerHTML = '<img src="./icons/' + (settings.autoAdvance ? 'pause.svg' : 'play.svg') + '" alt="" /><span>' + (settings.autoAdvance ? labels.autoOn : labels.autoOff) + '</span>';
      autoButton.setAttribute("aria-pressed", String(settings.autoAdvance));
    }

    function outEdges(id) {
      return content.edges.filter((edge) => edge.source === id);
    }

    let isTransitioning = false;

    function getPresentationTransform(type, isExit) {
      if (type === 'slide-left' || type === 'slideLeft') {
        return 'translateX(' + (isExit ? '-120%' : '100%') + ')';
      }
      if (type === 'slide-right' || type === 'slideRight') {
        return 'translateX(' + (isExit ? '120%' : '-100%') + ')';
      }
      if (type === 'slide-up' || type === 'slideUp') {
        return 'translateY(' + (isExit ? '-120%' : '100%') + ')';
      }
      if (type === 'slide-down' || type === 'slideDown') {
        return 'translateY(' + (isExit ? '120%' : '-100%') + ')';
      }
      if (type === 'zoom') return 'scale(0.82)';
      return '';
    }

    function goTo(id) {
      if (isTransitioning) return;
      if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer);
      
      const node = nodeById.get(currentId);
      let exitDuration = 0;
      
      if (node && node.data) {
        const data = node.data;
        const sceneExit = data.presentation && data.presentation.scene && data.presentation.scene.exit;
        const sceneExitDuration =
          sceneExit && sceneExit.type !== 'none' ? Math.max(0, sceneExit.duration || 0) : 0;
        let characterExitDuration = 0;
        if (data.presentation && Array.isArray(data.presentation.characters)) {
          data.presentation.characters.forEach((char) => {
            if (char.exit && char.exit.type !== 'none') {
              characterExitDuration = Math.max(characterExitDuration, char.exit.duration || 0);
            }
          });
        }
        exitDuration = characterExitDuration + sceneExitDuration;
        
        if (exitDuration > 0) {
          isTransitioning = true;
          
          const mediaEl = stageEl.querySelector('.scene-image, #nodeVideo');
          if (mediaEl && sceneExit && sceneExit.type !== 'none') {
            mediaEl.style.transition = 'opacity ' + sceneExit.duration + 'ms ease-out, transform ' + sceneExit.duration + 'ms ease-out';
            mediaEl.style.transitionDelay = characterExitDuration + 'ms';
            if (sceneExit.type === 'fade') {
              mediaEl.style.opacity = '0';
            } else {
              mediaEl.style.transform = getPresentationTransform(sceneExit.type, true);
            }
          }
          
          if (data.presentation && Array.isArray(data.presentation.characters)) {
            const charImgs = stageEl.querySelectorAll('.character-img');
            data.presentation.characters.forEach((char, idx) => {
              const imgEl = charImgs[idx];
              if (imgEl && char.exit && char.exit.type !== 'none') {
                const duration = char.exit.duration || 0;
                imgEl.style.transition = 'opacity ' + duration + 'ms ease-out, transform ' + duration + 'ms ease-out';
                if (char.exit.type === 'fade') {
                  imgEl.style.opacity = '0';
                } else {
                  const flipScale = char.flipX ? -1 : 1;
                  const scale = char.scale || 1;
                  const transformMotion = getPresentationTransform(char.exit.type, true);
                  imgEl.style.transform = 'translate(-50%, 0) ' + transformMotion + ' scale(' + scale + ') scaleX(' + flipScale + ')';
                }
              }
            });
          }
        }
      }
      
      if (exitDuration > 0) {
        setTimeout(() => {
          isTransitioning = false;
          if (currentId) history.push(currentId);
          currentId = id;
          render();
        }, exitDuration);
      } else {
        if (currentId) history.push(currentId);
        currentId = id;
        render();
      }
    }

    function animationClass(animation) {
      return animation && animation !== "none" ? " anim-" + animation : "";
    }

    function applyTypewriter(element, html, enabled, revealChoices) {
      if (!element) return;
      if (!enabled) {
        element.classList.remove("typewriter-reserved");
        element.innerHTML = html || "";
        if (revealChoices) showChoicesAndMaybeAdvance();
        return;
      }
      const temp = document.createElement("div");
      temp.innerHTML = html || "";
      const source = temp.textContent || "";
      element.classList.add("typewriter-reserved");
      element.innerHTML = "";
      const placeholder = document.createElement("span");
      placeholder.className = "typewriter-placeholder";
      placeholder.textContent = source || " ";
      placeholder.setAttribute("aria-hidden", "true");
      const visible = document.createElement("span");
      visible.className = "typewriter-visible";
      element.append(placeholder, visible);
      let index = 0;
      visible.textContent = "";
      const timer = setInterval(() => {
        index += 1;
        visible.textContent = source.slice(0, index);
        if (index >= source.length) {
          clearInterval(timer);
          typewriterTimers = typewriterTimers.filter((item) => item !== timer);
          if (revealChoices) showChoicesAndMaybeAdvance();
        }
      }, settings.typewriterSpeed);
      typewriterTimers.push(timer);
    }

    function choicesHtml(node, edges, className) {
      if (!edges.length) {
        return '<div class="choices ' + className + '"><button class="choice anim-fade" data-target="THE_END">' + labels.end + '</button></div>';
      }
      const buttons = edges.map((edge, index) => {
        const target = nodeById.get(edge.target);
        const label = nodeTitle(target) || edge.label || (edges.length === 1 ? labels.continue : labels.option + " " + (index + 1));
        return '<button class="choice anim-fade" data-target="' + escapeAttr(edge.target) + '">' + escapeHtml(label) + '</button>';
      }).join("");
      return '<div class="choices ' + className + '">' + buttons + '</div>';
    }

    function renderChoices(node, edges, position) {
      if (settings.skipSingleChoicePopup && position === "center" && edges.length <= 1) return "";
      return choicesHtml(node, edges, position);
    }

    function bindChoices() {
      stageEl.querySelectorAll("[data-target]").forEach((button) => {
        button.addEventListener("click", () => goTo(button.getAttribute("data-target")));
      });
    }

    function showChoicesAndMaybeAdvance() {
      stageEl.querySelectorAll(".choices").forEach((element) => {
        element.hidden = false;
      });
      bindChoices();
      const node = nodeById.get(currentId);
      const hasMedia = Boolean(
        node &&
          node.data &&
          (node.data.audioUrl || (node.data.videoUrl && !node.data.imageUrl)),
      );
      if (settings.autoAdvance && !hasMedia && outEdges(currentId).length <= 1) {
        autoAdvanceTimer = setTimeout(() => {
          const next = outEdges(currentId)[0]?.target || "THE_END";
          goTo(next);
        }, 900);
      }
    }

    function maybeAdvanceAfterMedia() {
      if (!settings.autoAdvance || outEdges(currentId).length > 1) return;
      if (currentAudioEnded && currentVideoEnded) {
        goTo(outEdges(currentId)[0]?.target || "THE_END");
      }
    }

    function continueFromText() {
      const edges = outEdges(currentId);
      if (edges.length <= 1) {
        goTo(edges[0]?.target || "THE_END");
      }
    }

    function render() {
      if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer);
      typewriterTimers.forEach((timer) => clearInterval(timer));
      typewriterTimers = [];
      backButton.disabled = history.length === 0;
      if (!currentId) {
        syncRegionMusic(null);
        backdropEl.style.backgroundImage = "";
        stageEl.innerHTML = '<div class="end">' + labels.noStory + '</div>';
        return;
      }
      if (currentId === "THE_END") {
        syncRegionMusic(null);
        stageEl.innerHTML = '<div class="end">' + labels.end + '</div>';
        return;
      }
      const node = nodeById.get(currentId);
      if (!node) {
        currentId = "THE_END";
        render();
        return;
      }
      const data = node.data || {};
      syncRegionMusic(data.backgroundMusic || null);
      const edges = outEdges(currentId);
      const choicePosition = settings.choicesPosition || "belowText";
      const hideCenteredTitle =
        settings.skipSingleChoicePopup && choicePosition === "center";
      const image = data.imageUrl || "";
      const video = data.videoUrl || "";
      currentAudioEnded = !data.audioUrl;
      currentVideoEnded = !video || Boolean(image);

      // 场景入场及基础样式计算
      const sceneEnter = data.presentation && data.presentation.scene && data.presentation.scene.enter;
      const hasSceneEnter = sceneEnter && sceneEnter.type !== "none";
      const sceneDuration = hasSceneEnter ? (sceneEnter.duration || 0) : 0;
      const sceneCrop = data.presentation && data.presentation.scene && data.presentation.scene.cropMode;
      const sceneScale = data.presentation && data.presentation.scene && data.presentation.scene.scale || 1;
      const sceneOffsetX = data.presentation && data.presentation.scene && data.presentation.scene.offsetX || 0;
      const sceneOffsetY = data.presentation && data.presentation.scene && data.presentation.scene.offsetY || 0;
      const sceneObjectFit = sceneCrop === 'contain' ? 'contain' : sceneCrop === 'stretch' ? 'fill' : 'cover';
      const immersive = settings.layoutMode === 'immersive';
      const finalCrop = immersive ? 'contain' : (sceneCrop ? sceneObjectFit : 'contain');
      const finalOffsetX = immersive ? 0 : sceneOffsetX;
      const finalOffsetY = immersive ? 0 : sceneOffsetY;
      
      const initSceneOpacity = (hasSceneEnter && sceneEnter.type === 'fade') ? 0 : 1;
      const initSceneTransform = hasSceneEnter ? getPresentationTransform(sceneEnter.type, false) : 'none';
      const initSceneStyle = 
        'object-fit: ' + finalCrop + '; ' +
        'object-position: ' + (50 + finalOffsetX) + '% ' + (50 + finalOffsetY) + '%; ' +
        'opacity: ' + initSceneOpacity + '; ' +
        'transform: ' + initSceneTransform + '; ' +
        'transition: opacity ' + sceneDuration + 'ms ease-out, transform ' + sceneDuration + 'ms ease-out;';

      const media = image
        ? '<img class="scene-image" src="' + escapeAttr(image) + '" alt="" style="' + initSceneStyle.replace('object-fit: ' + finalCrop, 'object-fit: contain') + '" />'
        : video
          ? '<video id="nodeVideo" src="' + escapeAttr(video) + '" controls playsinline style="' + initSceneStyle + '" ' + (settings.videoAutoPlay || settings.autoAdvance ? 'autoplay muted ' : '') + '></video>'
          : labels.noStory;

      let charactersHtml = "";
      if (data.presentation && Array.isArray(data.presentation.characters)) {
        charactersHtml = '<div class="characters-layer">' +
          data.presentation.characters.map((char) => {
            const charEnter = char.enter;
            const hasCharEnter = charEnter && charEnter.type !== "none";
            const charDuration = hasCharEnter ? (charEnter.duration || 0) : 0;
            
            const basePosition = char.position === "left" ? 24 : char.position === "right" ? 76 : 50;
            const left = "calc(" + basePosition + "% + " + (char.offsetX / 10) + "%)";
            const bottom = (char.offsetY / 10) + "%";
            const zIndex = Math.min(20, Math.max(1, char.layer || 1));
            const flipScale = char.flipX ? -1 : 1;
            const scale = char.scale || 1;
            
            const initCharOpacity = (hasCharEnter && charEnter.type === 'fade') ? 0 : 1;
            const initCharTransform = 'translate(-50%, 0) ' + (hasCharEnter ? getPresentationTransform(charEnter.type, false) : '') + ' scale(' + scale + ') scaleX(' + flipScale + ')';
            
            return '<img class="character-img" src="' + escapeAttr(char.imageUrl) + '" alt="' + escapeAttr(char.name || "") + '" ' +
              'style="' +
                'left: ' + left + '; ' +
                'bottom: ' + bottom + '; ' +
                'z-index: ' + zIndex + '; ' +
                'opacity: ' + initCharOpacity + '; ' +
                'transform: ' + initCharTransform + '; ' +
                'transition: opacity ' + charDuration + 'ms ease-out ' + sceneDuration + 'ms, transform ' + charDuration + 'ms ease-out ' + sceneDuration + 'ms;' +
              '" />';
          }).join("") +
          "</div>";
      }

      backdropEl.style.backgroundImage = image ? 'url("' + image.replace(/"/g, '\\"') + '")' : "";
      stageEl.innerHTML =
        '<div class="media ' + (!image && !video ? 'empty' : '') + '">' +
          '<div class="presentation-scale" style="transform: scale(' + sceneScale + ')">' +
            media + charactersHtml +
          '</div>' +
        '</div>' +
        '<div class="dialogue">' +
          (choicePosition === "aboveText" ? renderChoices(node, edges, "above") : "") +
          (hideCenteredTitle ? "" : '<h2 class="title' + animationClass(style.titleAnimation) + '">' + escapeHtml(data.title || "") + '</h2>') +
          '<div class="text' + animationClass(style.bodyAnimation) + '" id="nodeText">' + (data.text || "") + '</div>' +
          (data.audioUrl ? '<audio id="nodeAudio" src="' + escapeAttr(data.audioUrl) + '" preload="auto" hidden></audio>' : '') +
          (choicePosition === "belowText" ? renderChoices(node, edges, "below") : "") +
        '</div>' +
        (choicePosition === "center" ? renderChoices(node, edges, "center") : "");

      // 在下一个渲染帧中触发入场动画过渡到正常状态
      setTimeout(() => {
        const mediaEl = stageEl.querySelector('.scene-image, #nodeVideo');
        if (mediaEl) {
          mediaEl.style.opacity = '1';
          mediaEl.style.transform = 'none';
        }
        
        if (data.presentation && Array.isArray(data.presentation.characters)) {
          const charImgs = stageEl.querySelectorAll('.character-img');
          data.presentation.characters.forEach((char, idx) => {
            const imgEl = charImgs[idx];
            if (imgEl) {
              imgEl.style.opacity = '1';
              const flipScale = char.flipX ? -1 : 1;
              const scale = char.scale || 1;
              imgEl.style.transform = 'translate(-50%, 0) scale(' + scale + ') scaleX(' + flipScale + ')';
            }
          });
        }
      }, 50);
      const nodeAudio = document.getElementById("nodeAudio");
      if (nodeAudio) {
        nodeAudio.addEventListener("play", () => recordAudio(node, data.audioUrl));
        nodeAudio.addEventListener("ended", () => {
          currentAudioEnded = true;
          maybeAdvanceAfterMedia();
        });
        nodeAudio.play().catch(() => {});
      }
      const nodeVideo = document.getElementById("nodeVideo");
      if (nodeVideo) {
        nodeVideo.addEventListener("ended", () => {
          currentVideoEnded = true;
          maybeAdvanceAfterMedia();
        });
        if (settings.autoAdvance) nodeVideo.play().catch(() => {});
      }
      const hideChoicesDuringTypewriter = settings.autoAdvance && settings.interactionMode === "typewriter";
      stageEl.querySelectorAll(".choices").forEach((element) => {
        element.hidden = hideChoicesDuringTypewriter;
      });
      if (!hideChoicesDuringTypewriter) bindChoices();
      applyTypewriter(document.getElementById("nodeText"), data.text || "", settings.interactionMode === "typewriter" || style.bodyAnimation === "typewriter", true);
      if (settings.interactionMode !== "typewriter" && style.bodyAnimation !== "typewriter") showChoicesAndMaybeAdvance();
    }

    function escapeHtml(value) {
      return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
    }
    function escapeAttr(value) { return escapeHtml(value); }

    backButton.addEventListener("click", () => {
      const previous = history.pop();
      if (previous) {
        currentId = previous;
        render();
      }
    });
    resetButton.addEventListener("click", () => {
      history = [];
      currentId = root ? root.id : null;
      render();
    });
    autoButton.addEventListener("click", () => {
      settings.autoAdvance = !settings.autoAdvance;
      updateAutoButton();
      render();
    });
    playlistButton.addEventListener("click", () => {
      const open = !playlistPanel.classList.contains("open");
      playlistPanel.classList.toggle("open", open);
      playlistButton.setAttribute("aria-expanded", String(open));
    });
    playlistClose.addEventListener("click", () => {
      playlistPanel.classList.remove("open");
      playlistButton.setAttribute("aria-expanded", "false");
    });
    playlistAudio.addEventListener("play", renderPlaylist);
    playlistAudio.addEventListener("pause", renderPlaylist);
    playlistAudio.addEventListener("ended", renderPlaylist);
    zenButton.addEventListener("click", () => {
      controlsHidden = !controlsHidden;
      document.querySelector(".app").classList.toggle("controls-hidden", controlsHidden);
      zenButton.innerHTML = '<img src="./icons/' + (controlsHidden ? 'eye-off.svg' : 'eye.svg') + '" alt="" />';
    });
    document.querySelector(".app")?.addEventListener("click", (event) => {
      if (settings.autoAdvance || !currentId || currentId === "THE_END") return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          "header, button, a, video, audio, input, select, textarea, .playlist-panel"
        )
      ) {
        return;
      }
      continueFromText();
    });
    renderPlaylist();
    render();
  </script>
</body>
</html>`;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[char] || char;
  });
}

export async function exportInteractiveWebZip(
  nodes: FlowNode[],
  edges: FlowEdge[],
  options: WebExportOptions,
) {
  const blob = await buildInteractiveWebZipBlob(nodes, edges, options);
  const title = options.projectName?.trim() || 'galwriter-web';
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeFilePart(title)}-web.zip`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function buildInteractiveWebZipBlob(
  nodes: FlowNode[],
  edges: FlowEdge[],
  options: WebExportOptions,
) {
  const zip = new JSZip();
  const assetMap = new Map<string, string>();
  const title = options.projectName?.trim() || 'galwriter-web';
  const style: WebExportStyle = {
    titleFontSize: options.style?.titleFontSize || 34,
    bodyFontSize: options.style?.bodyFontSize || 18,
    titleColor: options.style?.titleColor || '#f8fafc',
    bodyColor: options.style?.bodyColor || '#e5e7eb',
    panelColor: options.style?.panelColor || 'rgba(7, 10, 16, 0.82)',
    titleAnimation: options.style?.titleAnimation || 'fade',
    bodyAnimation: options.style?.bodyAnimation || 'typewriter',
    choiceColor: options.style?.choiceColor || '#0ea5e9',
    choiceTextColor: options.style?.choiceTextColor || '#ffffff',
  };
  const settings: WebExportSettings = {
    layoutMode: options.settings?.layoutMode || 'immersive',
    choicesPosition: options.settings?.choicesPosition || 'center',
    blurBackground: options.settings?.blurBackground ?? true,
    skipSingleChoicePopup: options.settings?.skipSingleChoicePopup ?? true,
    interactionMode: options.settings?.interactionMode || 'typewriter',
    typewriterSpeed: options.settings?.typewriterSpeed ?? 65,
    autoAdvance: options.settings?.autoAdvance ?? false,
    videoAutoPlay: options.settings?.videoAutoPlay ?? false,
    hideCharacterTags: options.settings?.hideCharacterTags ?? true,
    hideSceneTags: options.settings?.hideSceneTags ?? true,
  };

  const webNodes: WebExportNode[] = [];
  for (const node of nodes.filter((candidate) => candidate.type === 'storyNode')) {
    const titleText = nodeTitle(node);
    const imageUrl = await addImageAsset(
      zip,
      typeof node.data?.imageUrl === 'string' ? node.data.imageUrl : undefined,
      `${titleText}-image`,
      assetMap,
    );
    const videoUrl = await addVideoAsset(
      zip,
      typeof node.data?.videoUrl === 'string' ? node.data.videoUrl : undefined,
      `${titleText}-video`,
      assetMap,
    );
    const audioUrl = await addAudioAsset(
      zip,
      typeof node.data?.audioUrl === 'string' ? node.data.audioUrl : undefined,
      `${titleText}-audio`,
      assetMap,
    );
    const regionMusicMatch = resolveRegionBackgroundMusic(nodes, node);
    const backgroundMusicUrl = await addAudioAsset(
      zip,
      regionMusicMatch?.music.url,
      `${titleText}-background-music`,
      assetMap,
    );

    let webPresentation: any = undefined;
    const rawPresentation = node.data?.presentation as any;
    if (rawPresentation && Array.isArray(rawPresentation.characters)) {
      const packedChars = [];
      for (const charConfig of rawPresentation.characters) {
        const charNode = nodes.find((n) => n.id === charConfig.sourceNodeId);
        if (charNode && charNode.type === 'characterNode') {
          const charData = charNode.data as any;
          const outfit = charConfig.outfitId
            ? charData.outfits?.find((item: any) => item.id === charConfig.outfitId)
            : charData.outfits?.find((item: any) => item.imageUrl);
          const rawCharImgUrl = outfit?.imageUrl || charData.avatarUrl;
          const charName = charData.characterName || charData.name || '';

          if (typeof rawCharImgUrl === 'string' && rawCharImgUrl.trim()) {
            const packedCharImgUrl = await addImageAsset(
              zip,
              rawCharImgUrl,
              `${charName || 'character'}-avatar`,
              assetMap,
            );
            packedChars.push({
              sourceNodeId: charConfig.sourceNodeId,
              position: charConfig.position || 'center',
              offsetX: Number(charConfig.offsetX) || 0,
              offsetY: Number(charConfig.offsetY) || 0,
              scale: Number(charConfig.scale) ?? 1,
              flipX: Boolean(charConfig.flipX),
              layer: Number(charConfig.layer) ?? 1,
              enter: structuredClone(charConfig.enter || { type: 'none', duration: 0 }),
              exit: structuredClone(charConfig.exit || { type: 'none', duration: 0 }),
              imageUrl: packedCharImgUrl,
              name: charName,
            });
          }
        }
      }
      webPresentation = {
        scene: rawPresentation.scene ? structuredClone(rawPresentation.scene) : undefined,
        characters: packedChars,
      };
    }

    webNodes.push({
      id: node.id,
      type: node.type,
      data: {
        title: titleText,
        text: filterMentionTags(nodeText(node), settings.hideCharacterTags, settings.hideSceneTags),
        color: typeof node.data?.color === 'string' ? node.data.color : undefined,
        imageUrl,
        videoUrl,
        audioUrl,
        backgroundMusic:
          regionMusicMatch && backgroundMusicUrl
            ? { ...regionMusicMatch.music, url: backgroundMusicUrl }
            : undefined,
        objectFit: typeof node.data?.objectFit === 'string' ? node.data.objectFit : undefined,
        showTextOverlay:
          typeof node.data?.showTextOverlay === 'boolean' ? node.data.showTextOverlay : undefined,
        isRoot: Boolean(node.data?.isRoot),
        presentation: webPresentation,
      },
    });
  }

  const webEdges: WebExportEdge[] = edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    label: typeof edge.data?.label === 'string' ? edge.data.label : undefined,
  }));

  const iconFolder = zip.folder('icons');
  Object.entries(WEB_EXPORT_ICONS).forEach(([fileName, svg]) => {
    iconFolder?.file(fileName, svg);
  });
  const faviconPath = await addExportLogoAsset(iconFolder);
  zip.file('index.html', makeIndexHtml(title, options.language, faviconPath));
  zip.file(
    'content.js',
    makeContentScript({
      title,
      language: options.language,
      style,
      settings,
      nodes: webNodes,
      edges: webEdges,
    }),
  );
  zip.folder('images');

  return zip.generateAsync({ type: 'blob' });
}
