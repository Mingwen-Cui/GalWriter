import volumeTestJingleUrl from '../../../../assets/common/audio/volume-test-jingle.ogg';
import volumeTestJingleLicense from '../../../../assets/common/audio/volume-test-jingle.LICENSE.md?raw';
import { DEFAULT_TYPEWRITER_INTERVAL_MS } from '../../../../lib/typewriterTiming';
import { normalizeWebFlowView } from '../webFlowView';
import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react';
import JSZip from 'jszip';

import { resolveKnownAppAssetUrl } from '../../../../lib/appAssets';
import { resolveCharacterImageUrl } from '../../../../lib/inlineAssetSwitch';
import { resolveRegionBackgroundMusic } from '../../../../lib/regionMusic';
import { resolveSceneAmbientPresetUrl } from '../../../../lib/sceneTemplates';
import { resolveSceneLightOverlayUrl } from '../../../../lib/sceneVisualStyle';
import { htmlToSpeechText } from '../../../../lib/tts';
import {
  type ExportAssetFailure,
  formatExportAssetFailures,
} from '../../shared/exportAssetFailures';
import { packDialogueText } from '../../shared/packedText';
import type { SurfaceAppearance } from '../../shared/paint/appearance';
import { validateExportAssetBlob } from '../../shared/validateExportAsset';
import { buildDefaultRenderObjects } from '../../video/shared/renderObjects';
import { filterMentionTags } from '../../video/shared/storyNodes';
import type { RenderStyle } from '../../video/shared/types';
import { DEFAULT_RENDER_STYLE } from '../../video/VideoRenderModal/workspaceStorage';
import {
  alignDefaultFlowOverviewControls,
  resolveWebToolbarElements,
} from '../webExperienceTemplates';
import { buildUniversalWebTemplate } from '../universalExperienceTemplate';
import { resolveSettingsPageElements, resolveArchivePageElements } from '../webMenuPageElements';
import { LOCAL_PREVIEW_CMD, LOCAL_PREVIEW_SERVER } from './localPreviewLauncher';
import { makeIndexHtml } from './webExportHtml';
import { usedRenderStyle, usedSurfaceSettings } from './webExportAssetUsage';
import { playableWebScope } from './webExportScope';
import { buildExportWebFlow } from './webExportFlow';
import type {
  WebExportEdge,
  WebExportNode,
  WebExportOptions,
  WebExportSettings,
  WebExportStyle,
} from './webExportTypes';

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
  failures: Map<string, ExportAssetFailure>,
) => {
  if (typeof url !== 'string' || !url.trim()) return url;
  const resolvedUrl = resolveKnownAppAssetUrl(url);
  if (assetMap.has(resolvedUrl)) return assetMap.get(resolvedUrl);
  if (
    !resolvedUrl.startsWith('blob:') &&
    !resolvedUrl.startsWith('data:video/') &&
    !/^https?:\/\//i.test(resolvedUrl) &&
    !/^\.?\//.test(resolvedUrl)
  ) {
    failures.set(`video:${resolvedUrl}`, {
      kind: 'video',
      label: hint,
      source: resolvedUrl,
      reason: 'unsupported or local-only source URL',
    });
    return resolvedUrl;
  }

  try {
    const response = await fetch(resolvedUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    await validateExportAssetBlob(blob, 'video', resolvedUrl);
    const extension = getImageExtension(resolvedUrl, VIDEO_EXTENSION_BY_MIME[blob.type] || 'mp4');
    const fileName = `videos/${safeFilePart(hint)}-${assetMap.size + 1}.${extension}`;
    zip.file(fileName, blob);
    const relativePath = `./${fileName}`;
    assetMap.set(resolvedUrl, relativePath);
    return relativePath;
  } catch (error) {
    failures.set(`video:${resolvedUrl}`, {
      kind: 'video',
      label: hint,
      source: resolvedUrl,
      reason: error instanceof Error ? error.message : String(error),
    });
    return resolvedUrl;
  }
};

const addAudioAsset = async (
  zip: JSZip,
  url: string | undefined,
  hint: string,
  assetMap: Map<string, string>,
  failures: Map<string, ExportAssetFailure>,
) => {
  if (typeof url !== 'string' || !url.trim()) return url;
  const resolvedUrl = resolveKnownAppAssetUrl(url);
  if (assetMap.has(resolvedUrl)) return assetMap.get(resolvedUrl);
  try {
    const response = await fetch(resolvedUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    await validateExportAssetBlob(blob, 'audio', resolvedUrl);
    const extension =
      blob.type === 'audio/mpeg'
        ? 'mp3'
        : getImageExtension(resolvedUrl, blob.type.split('/')[1] || 'bin');
    const fileName = `audio/${safeFilePart(hint)}-${assetMap.size + 1}.${extension}`;
    zip.file(fileName, blob);
    const relativePath = `./${fileName}`;
    assetMap.set(resolvedUrl, relativePath);
    return relativePath;
  } catch (error) {
    failures.set(`audio:${resolvedUrl}`, {
      kind: 'audio',
      label: hint,
      source: resolvedUrl,
      reason: error instanceof Error ? error.message : String(error),
    });
    return resolvedUrl;
  }
};

const addImageAsset = async (
  zip: JSZip,
  url: string | undefined,
  hint: string,
  assetMap: Map<string, string>,
  failures: Map<string, ExportAssetFailure>,
) => {
  if (typeof url !== 'string' || !url.trim()) return url;
  const resolvedUrl = typeof url === 'string' ? resolveKnownAppAssetUrl(url) : url;
  if (!isPackableImage(resolvedUrl)) {
    failures.set(`image:${String(resolvedUrl)}`, {
      kind: 'image',
      label: hint,
      source: String(resolvedUrl),
      reason: 'unsupported or local-only source URL',
    });
    return resolvedUrl;
  }
  if (assetMap.has(resolvedUrl)) return assetMap.get(resolvedUrl);

  try {
    const response = await fetch(resolvedUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    await validateExportAssetBlob(blob, 'image', resolvedUrl);
    const extension = getImageExtension(resolvedUrl, IMAGE_EXTENSION_BY_MIME[blob.type] || 'png');
    const fileName = `images/${safeFilePart(hint)}-${assetMap.size + 1}.${extension}`;
    zip.file(fileName, blob);
    const relativePath = `./${fileName}`;
    assetMap.set(resolvedUrl, relativePath);
    return relativePath;
  } catch (error) {
    failures.set(`image:${resolvedUrl}`, {
      kind: 'image',
      label: hint,
      source: resolvedUrl,
      reason: error instanceof Error ? error.message : String(error),
    });
    return resolvedUrl;
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

import { webStoryTitle } from '../webPlaybackUi';

const nodeTitle = (node: FlowNode) =>
  webStoryTitle(
    node.data?.title || node.data?.characterName || node.data?.sceneName || node.data?.label || '',
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
  flow: ReturnType<typeof buildExportWebFlow>;
}) => `window.GALWRITER_CONTENT=${JSON.stringify(payload)};\n`;

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
  const assetFailures = new Map<string, ExportAssetFailure>();
  // Several surfaces can request the same media concurrently. Share their
  // in-flight load as well as the completed path so it is written only once.
  const once = (loader: typeof addImageAsset) => {
    const pending = new Map<string, ReturnType<typeof addImageAsset>>();
    return (...args: Parameters<typeof addImageAsset>) => {
      const source = args[1] ? resolveKnownAppAssetUrl(args[1]) : '';
      if (!source) return loader(...args);
      if (!pending.has(source)) pending.set(source, loader(...args));
      return pending.get(source)!;
    };
  };
  const packImageAsset = once(addImageAsset);
  const packVideoAsset = once(addVideoAsset);
  const packAudioAsset = once(addAudioAsset);
  const title = options.projectName?.trim() || 'galwriter-web';
  const defaultTemplate = buildUniversalWebTemplate(options.language, title);
  options = {
    ...options,
    settings: { ...defaultTemplate.settings, ...options.settings },
  };
  let style: WebExportStyle = {
    ...DEFAULT_RENDER_STYLE,
    ...defaultTemplate.renderStyle,
    ...options.style,
    choiceColor: options.style?.choiceColor || defaultTemplate.choiceColor,
    choiceTextColor: options.style?.choiceTextColor || defaultTemplate.choiceTextColor,
  };
  let settings: WebExportSettings = {
    canvasWidth: options.settings?.canvasWidth ?? 1920,
    canvasHeight: options.settings?.canvasHeight ?? 1080,
    canvasRatioWidth: options.settings?.canvasRatioWidth ?? 16,
    canvasRatioHeight: options.settings?.canvasRatioHeight ?? 9,
    canvasRatioLocked: options.settings?.canvasRatioLocked !== false,
    layoutMode: options.settings?.layoutMode || 'immersive',
    sceneFit: options.settings?.sceneFit || 'cover',
    sceneScale: options.settings?.sceneScale ?? 50,
    sceneScaleX: options.settings?.sceneScaleX ?? options.settings?.sceneScale ?? 50,
    sceneScaleY: options.settings?.sceneScaleY ?? options.settings?.sceneScale ?? 50,
    sceneOffsetX: options.settings?.sceneOffsetX ?? 0,
    sceneOffsetY: options.settings?.sceneOffsetY ?? -20,
    sceneBackgroundVisible: options.settings?.sceneBackgroundVisible !== false,
    sceneBackgroundType: options.settings?.sceneBackgroundType || 'solid',
    sceneBackgroundColor: options.settings?.sceneBackgroundColor || '#020617',
    sceneBackgroundGradientStart: options.settings?.sceneBackgroundGradientStart || '#020617',
    sceneBackgroundGradientEnd: options.settings?.sceneBackgroundGradientEnd || '#0f172a',
    sceneBackgroundGradientAngle: options.settings?.sceneBackgroundGradientAngle ?? 135,
    sceneBackgroundImageUrl: options.settings?.sceneBackgroundImageUrl || '',
    choicesPosition: options.settings?.choicesPosition || 'center',
    showStartMenu: options.settings?.showStartMenu ?? true,
    startMenuTemplate: options.settings?.startMenuTemplate || 'cinematic',
    startMenuBackgroundType: options.settings?.startMenuBackgroundType || 'gradient',
    startMenuBackgroundColor: options.settings?.startMenuBackgroundColor || '#070b12',
    startMenuBackgroundGradientStart:
      options.settings?.startMenuBackgroundGradientStart || '#0f172a',
    startMenuBackgroundGradientEnd: options.settings?.startMenuBackgroundGradientEnd || '#0891b2',
    startMenuBackgroundGradientAngle: options.settings?.startMenuBackgroundGradientAngle ?? 135,
    startMenuBackgroundGradientShape: options.settings?.startMenuBackgroundGradientShape,
    startMenuBackgroundGradientStartX: options.settings?.startMenuBackgroundGradientStartX,
    startMenuBackgroundGradientStartY: options.settings?.startMenuBackgroundGradientStartY,
    startMenuBackgroundGradientEndX: options.settings?.startMenuBackgroundGradientEndX,
    startMenuBackgroundGradientEndY: options.settings?.startMenuBackgroundGradientEndY,
    startMenuBackgroundGradientStops: options.settings?.startMenuBackgroundGradientStops,
    startMenuBackgroundImageUrl: options.settings?.startMenuBackgroundImageUrl || '',
    archiveBackgroundType: options.settings?.archiveBackgroundType,
    archiveBackgroundColor: options.settings?.archiveBackgroundColor,
    archiveBackgroundGradientStart: options.settings?.archiveBackgroundGradientStart,
    archiveBackgroundGradientEnd: options.settings?.archiveBackgroundGradientEnd,
    archiveBackgroundGradientAngle: options.settings?.archiveBackgroundGradientAngle,
    archiveBackgroundGradientShape: options.settings?.archiveBackgroundGradientShape,
    archiveBackgroundGradientStartX: options.settings?.archiveBackgroundGradientStartX,
    archiveBackgroundGradientStartY: options.settings?.archiveBackgroundGradientStartY,
    archiveBackgroundGradientEndX: options.settings?.archiveBackgroundGradientEndX,
    archiveBackgroundGradientEndY: options.settings?.archiveBackgroundGradientEndY,
    archiveBackgroundGradientStops: options.settings?.archiveBackgroundGradientStops,
    archiveBackgroundImageUrl: options.settings?.archiveBackgroundImageUrl || '',
    settingsBackgroundType: options.settings?.settingsBackgroundType,
    settingsBackgroundColor: options.settings?.settingsBackgroundColor,
    settingsBackgroundGradientStart: options.settings?.settingsBackgroundGradientStart,
    settingsBackgroundGradientEnd: options.settings?.settingsBackgroundGradientEnd,
    settingsBackgroundGradientAngle: options.settings?.settingsBackgroundGradientAngle,
    settingsBackgroundGradientShape: options.settings?.settingsBackgroundGradientShape,
    settingsBackgroundGradientStartX: options.settings?.settingsBackgroundGradientStartX,
    settingsBackgroundGradientStartY: options.settings?.settingsBackgroundGradientStartY,
    settingsBackgroundGradientEndX: options.settings?.settingsBackgroundGradientEndX,
    settingsBackgroundGradientEndY: options.settings?.settingsBackgroundGradientEndY,
    settingsBackgroundGradientStops: options.settings?.settingsBackgroundGradientStops,
    settingsBackgroundImageUrl: options.settings?.settingsBackgroundImageUrl || '',
    dialogueBackgroundType: options.settings?.dialogueBackgroundType,
    dialogueBackgroundColor: options.settings?.dialogueBackgroundColor,
    dialogueBackgroundGradientStart: options.settings?.dialogueBackgroundGradientStart,
    dialogueBackgroundGradientEnd: options.settings?.dialogueBackgroundGradientEnd,
    dialogueBackgroundGradientAngle: options.settings?.dialogueBackgroundGradientAngle,
    dialogueBackgroundGradientShape: options.settings?.dialogueBackgroundGradientShape,
    dialogueBackgroundGradientStartX: options.settings?.dialogueBackgroundGradientStartX,
    dialogueBackgroundGradientStartY: options.settings?.dialogueBackgroundGradientStartY,
    dialogueBackgroundGradientEndX: options.settings?.dialogueBackgroundGradientEndX,
    dialogueBackgroundGradientEndY: options.settings?.dialogueBackgroundGradientEndY,
    dialogueBackgroundGradientStops: options.settings?.dialogueBackgroundGradientStops,
    dialogueBackgroundImageUrl: options.settings?.dialogueBackgroundImageUrl || '',
    flowOverviewBackgroundType: options.settings?.flowOverviewBackgroundType || 'solid',
    flowOverviewBackgroundColor: options.settings?.flowOverviewBackgroundColor || '#f8fafc',
    flowOverviewBackgroundGradientStart:
      options.settings?.flowOverviewBackgroundGradientStart || '#f8fafc',
    flowOverviewBackgroundGradientEnd:
      options.settings?.flowOverviewBackgroundGradientEnd || '#e0e7ff',
    flowOverviewBackgroundGradientAngle:
      options.settings?.flowOverviewBackgroundGradientAngle ?? 135,
    flowOverviewBackgroundGradientShape: options.settings?.flowOverviewBackgroundGradientShape,
    flowOverviewBackgroundGradientStartX: options.settings?.flowOverviewBackgroundGradientStartX,
    flowOverviewBackgroundGradientStartY: options.settings?.flowOverviewBackgroundGradientStartY,
    flowOverviewBackgroundGradientEndX: options.settings?.flowOverviewBackgroundGradientEndX,
    flowOverviewBackgroundGradientEndY: options.settings?.flowOverviewBackgroundGradientEndY,
    flowOverviewBackgroundGradientStops: options.settings?.flowOverviewBackgroundGradientStops,
    flowOverviewBackgroundImageUrl: options.settings?.flowOverviewBackgroundImageUrl || '',
    flowOverviewBackgroundVideoUrl: options.settings?.flowOverviewBackgroundVideoUrl || '',
    flowOverviewBackgroundVideoLoop: options.settings?.flowOverviewBackgroundVideoLoop !== false,
    flowOverviewBackgroundVideoMuted: options.settings?.flowOverviewBackgroundVideoMuted !== false,
    flowOverviewBackgroundVideoFit: options.settings?.flowOverviewBackgroundVideoFit || 'crop',
    flowOverviewBackgroundMusicUrl: options.settings?.flowOverviewBackgroundMusicUrl || '',
    flowOverviewMusicVolume: options.settings?.flowOverviewMusicVolume ?? 70,
    flowOverviewMusicFadeIn: options.settings?.flowOverviewMusicFadeIn ?? 0,
    flowOverviewMusicFadeOut: options.settings?.flowOverviewMusicFadeOut ?? 0,
    flowOverviewMusicLoop: options.settings?.flowOverviewMusicLoop !== false,
    flowOverviewElements: alignDefaultFlowOverviewControls(
      options.settings?.flowOverviewElements || [],
      options.settings?.canvasWidth,
      options.settings?.canvasHeight,
      options.language,
    ),
    menuTheme: options.settings?.menuTheme,
    flowOverviewLayoutDirection: options.settings?.flowOverviewLayoutDirection || 'right',
    flowOverviewView: normalizeWebFlowView(options.settings?.flowOverviewView),
    flowOverviewControlsInitialized: options.settings?.flowOverviewControlsInitialized,
    flowOverviewCardSizes: options.settings?.flowOverviewCardSizes || {},
    flowOverviewMinimapWidth: options.settings?.flowOverviewMinimapWidth ?? 220,
    flowOverviewMinimapHeight: options.settings?.flowOverviewMinimapHeight ?? 160,
    startMenuBackgroundMusicUrl: options.settings?.startMenuBackgroundMusicUrl || '',
    startMenuMusicVolume: options.settings?.startMenuMusicVolume ?? 70,
    startMenuMusicFadeIn: options.settings?.startMenuMusicFadeIn ?? 0,
    startMenuMusicFadeOut: options.settings?.startMenuMusicFadeOut ?? 0,
    startMenuMusicLoop: options.settings?.startMenuMusicLoop ?? true,
    startMenuMusicApplyToArchive: options.settings?.startMenuMusicApplyToArchive ?? true,
    startMenuMusicApplyToSettings: options.settings?.startMenuMusicApplyToSettings ?? true,
    startMenuButtonPosition: options.settings?.startMenuButtonPosition || 'center',
    startMenuButtonLayout: options.settings?.startMenuButtonLayout || 'vertical',
    startMenuButtonSize: options.settings?.startMenuButtonSize || 'normal',
    startMenuElements: options.settings?.startMenuElements || [],
    archivePageElements: resolveArchivePageElements(
      options.settings || {},
      options.language,
      '#0ea5e9',
      '#ffffff',
    ),
    settingsPageElements: resolveSettingsPageElements(
      options.settings || {},
      options.language,
      '#0ea5e9',
      '#ffffff',
    ),
    settingsPageElementsInitialized: true,
    playerSettingsPanel: options.settings?.playerSettingsPanel,
    previewToolbarElements: resolveWebToolbarElements(
      options.settings?.previewToolbarElements,
      options.language,
      options.settings?.canvasWidth,
      options.settings?.canvasHeight,
    ),
    dialogueOverlayElements: options.settings?.dialogueOverlayElements || [],
    startMenuPlacementBoundsLocked: options.settings?.startMenuPlacementBoundsLocked ?? false,
    startMenuPlacementMinX: options.settings?.startMenuPlacementMinX ?? 0,
    startMenuPlacementMinY: options.settings?.startMenuPlacementMinY ?? 0,
    startMenuPlacementMaxX: options.settings?.startMenuPlacementMaxX ?? 100,
    startMenuPlacementMaxY: options.settings?.startMenuPlacementMaxY ?? 100,
    startMenuShowSave: options.settings?.startMenuShowSave ?? true,
    startMenuShowNewGame: options.settings?.startMenuShowNewGame ?? true,
    startMenuShowSettings: options.settings?.startMenuShowSettings ?? true,
    blurBackground: options.settings?.blurBackground ?? true,
    skipSingleChoicePopup: options.settings?.skipSingleChoicePopup ?? true,
    interactionMode: options.settings?.interactionMode || 'typewriter',
    typewriterSpeed: options.settings?.typewriterSpeed ?? DEFAULT_TYPEWRITER_INTERVAL_MS,
    autoAdvance: options.settings?.autoAdvance ?? false,
    textScale: options.settings?.textScale ?? 100,
    animationSpeed: options.settings?.animationSpeed ?? 1,
    soundEnabled: options.settings?.soundEnabled ?? true,
    musicVolume: Math.max(0, Math.min(100, options.settings?.musicVolume ?? 100)),
    voiceVolume: Math.max(0, Math.min(100, options.settings?.voiceVolume ?? 100)),
    videoAutoPlay: options.settings?.videoAutoPlay ?? false,
    hideCharacterTags: true,
    hideSceneTags: true,
  };
  settings.surfaceAppearances = options.settings?.surfaceAppearances;
  settings = usedSurfaceSettings(settings);
  style = {
    ...usedRenderStyle(style as RenderStyle, [
      ...settings.startMenuElements,
      ...settings.archivePageElements,
      ...settings.settingsPageElements,
      ...settings.previewToolbarElements,
      ...settings.dialogueOverlayElements,
      ...settings.flowOverviewElements,
    ]),
    choiceColor: style.choiceColor,
    choiceTextColor: style.choiceTextColor,
  };
  style.dialogImageUrl = await packImageAsset(
    zip,
    style.dialogImageUrl,
    `${title}-dialog-background`,
    assetMap,
    assetFailures,
  );
  style.nameplateImageUrl = await packImageAsset(
    zip,
    style.nameplateImageUrl,
    `${title}-nameplate-background`,
    assetMap,
    assetFailures,
  );
  const packAppearance = async (
    appearance: SurfaceAppearance | undefined,
    label: string,
  ): Promise<SurfaceAppearance | undefined> =>
    appearance
      ? {
          ...appearance,
          strokes: await Promise.all(
            appearance.strokes.map(async (stroke, i) => ({
              ...stroke,
              paint: stroke.paint
                ? {
                    ...stroke.paint,
                    imageUrl: await packImageAsset(
                      zip,
                      stroke.paint.imageUrl,
                      `${label}-stroke-${i}`,
                      assetMap,
                      assetFailures,
                    ),
                  }
                : undefined,
            })),
          ),
          fills: await Promise.all(
            appearance.fills.map(async (fill, i) => ({
              ...fill,
              imageUrl: await packImageAsset(
                zip,
                fill.imageUrl,
                `${label}-fill-${i}`,
                assetMap,
                assetFailures,
              ),
              videoUrl: await packVideoAsset(
                zip,
                fill.videoUrl,
                `${label}-video-${i}`,
                assetMap,
                assetFailures,
              ),
            })),
          ),
        }
      : undefined;
  const usedSurfaces = settings.surfaceAppearances;
  settings.surfaceAppearances = {};
  for (const [surface, appearance] of Object.entries(usedSurfaces || {}))
    settings.surfaceAppearances[surface as 'start' | 'archive' | 'settings' | 'game' | 'flow'] =
      await packAppearance(appearance, `${title}-${surface}`);
  if (style.renderObjects)
    style.renderObjects = Object.fromEntries(
      await Promise.all(
        Object.entries(style.renderObjects).map(async ([key, object]) => [
          key,
          {
            ...object,
            appearance: await packAppearance(object.appearance, `${title}-${key}`),
            fill: {
              ...object.fill,
              imageUrl: await packImageAsset(
                zip,
                object.fill.imageUrl,
                `${title}-${key}-fill`,
                assetMap,
                assetFailures,
              ),
            },
          },
        ]),
      ),
    ) as typeof style.renderObjects;
  settings.startMenuBackgroundImageUrl = await packImageAsset(
    zip,
    settings.startMenuBackgroundImageUrl,
    `${title}-start-background`,
    assetMap,
    assetFailures,
  );
  settings.sceneBackgroundImageUrl = await packImageAsset(
    zip,
    settings.sceneBackgroundImageUrl,
    `${title}-scene-background`,
    assetMap,
    assetFailures,
  );
  settings.archiveBackgroundImageUrl = await packImageAsset(
    zip,
    settings.archiveBackgroundImageUrl,
    `${title}-archive-background`,
    assetMap,
    assetFailures,
  );
  settings.settingsBackgroundImageUrl = await packImageAsset(
    zip,
    settings.settingsBackgroundImageUrl,
    `${title}-settings-background`,
    assetMap,
    assetFailures,
  );
  settings.dialogueBackgroundImageUrl = await packImageAsset(
    zip,
    settings.dialogueBackgroundImageUrl,
    `${title}-dialogue-background`,
    assetMap,
    assetFailures,
  );
  settings.flowOverviewBackgroundImageUrl = await packImageAsset(
    zip,
    settings.flowOverviewBackgroundImageUrl,
    `${title}-flow-overview-background`,
    assetMap,
    assetFailures,
  );
  settings.flowOverviewBackgroundMusicUrl = await packAudioAsset(
    zip,
    settings.flowOverviewBackgroundMusicUrl,
    `${title}-flow-overview-music`,
    assetMap,
    assetFailures,
  );
  settings.startMenuBackgroundMusicUrl = await packAudioAsset(
    zip,
    settings.startMenuBackgroundMusicUrl,
    `${title}-start-menu-music`,
    assetMap,
    assetFailures,
  );
  const packMenuElements = (elements: WebExportSettings['startMenuElements'], pageName: string) =>
    Promise.all(
      elements.map(async (element) => ({
        ...element,
        appearance: await packAppearance(element.appearance, `${title}-${pageName}-${element.id}`),
        imageUrl: await packImageAsset(
          zip,
          element.imageUrl,
          `${title}-${pageName}-${element.id || 'element'}`,
          assetMap,
          assetFailures,
        ),
        backgroundImageUrl: await packImageAsset(
          zip,
          element.backgroundImageUrl,
          `${title}-${pageName}-${element.id || 'button'}-background`,
          assetMap,
          assetFailures,
        ),
      })),
    );
  settings.startMenuElements = await packMenuElements(settings.startMenuElements, 'start');
  settings.archivePageElements = await packMenuElements(settings.archivePageElements, 'archive');
  settings.settingsPageElements = await packMenuElements(settings.settingsPageElements, 'settings');
  settings.previewToolbarElements = await packMenuElements(
    settings.previewToolbarElements,
    'toolbar',
  );
  settings.dialogueOverlayElements = await packMenuElements(
    settings.dialogueOverlayElements,
    'dialogue',
  );
  settings.flowOverviewElements = await packMenuElements(
    settings.flowOverviewElements,
    'flow-overview',
  );

  const webNodes: WebExportNode[] = [];
  const playable = playableWebScope(nodes, edges);
  for (const node of playable.nodes) {
    if (node.type === 'numberConditionNode') {
      webNodes.push({
        id: node.id,
        type: node.type,
        data: {
          title: nodeTitle(node),
          isRoot: Boolean(node.data?.isRoot),
          hidden: Boolean(node.data?.hidden),
          skip: Boolean(node.data?.skip),
          nodeValue:
            typeof node.data?.nodeValue === 'number' && Number.isFinite(node.data.nodeValue)
              ? node.data.nodeValue
              : undefined,
          threshold:
            typeof node.data?.threshold === 'number' && Number.isFinite(node.data.threshold)
              ? node.data.threshold
              : 0,
          ranges: Array.isArray(node.data?.ranges)
            ? (node.data.ranges as any[])
                .map((range) => ({
                  id: String(range.id || ''),
                  min: Number(range.min),
                  max: Number(range.max),
                }))
                .filter(
                  (range) => range.id && Number.isFinite(range.min) && Number.isFinite(range.max),
                )
            : [],
        },
      });
      continue;
    }

    // Routing cards still affect progression and numeric state, but never render media.
    if (node.data?.skip) {
      webNodes.push({
        id: node.id,
        type: node.type,
        data: {
          title: nodeTitle(node),
          isRoot: Boolean(node.data?.isRoot),
          skip: true,
          nodeValue: typeof node.data?.nodeValue === 'number' ? node.data.nodeValue : undefined,
        },
      });
      continue;
    }

    const titleText = nodeTitle(node);
    const imageUrl = await packImageAsset(
      zip,
      typeof node.data?.imageUrl === 'string' ? node.data.imageUrl : undefined,
      `${titleText}-image`,
      assetMap,
      assetFailures,
    );
    const videoUrl = await packVideoAsset(
      zip,
      !imageUrl && typeof node.data?.videoUrl === 'string' ? node.data.videoUrl : undefined,
      `${titleText}-video`,
      assetMap,
      assetFailures,
    );
    const audioUrl = await packAudioAsset(
      zip,
      typeof node.data?.audioUrl === 'string' ? node.data.audioUrl : undefined,
      `${titleText}-audio`,
      assetMap,
      assetFailures,
    );
    const regionMusicMatch = resolveRegionBackgroundMusic(nodes, node);
    const backgroundMusicUrl = await packAudioAsset(
      zip,
      regionMusicMatch?.music.url,
      `${titleText}-background-music`,
      assetMap,
      assetFailures,
    );

    let webPresentation: any = undefined;
    const rawPresentation = node.data?.presentation as any;
    if (rawPresentation && Array.isArray(rawPresentation.characters)) {
      const rawSceneSource = rawPresentation.scene
        ? nodes.find(
            (candidate) =>
              candidate.id === rawPresentation.scene.sourceNodeId && candidate.type === 'sceneNode',
          )
        : undefined;
      const sceneData = rawSceneSource?.data as
        | { scenePresetEnabled?: boolean; visualStyle?: unknown; ambientSound?: any }
        | undefined;
      const rawAmbientSound = sceneData?.scenePresetEnabled ? sceneData.ambientSound : undefined;
      const resolvedAmbientUrl = rawAmbientSound?.enabled
        ? rawAmbientSound.source === 'preset'
          ? await resolveSceneAmbientPresetUrl(rawAmbientSound)
          : rawAmbientSound.url
        : undefined;
      const ambientSoundUrl = await packAudioAsset(
        zip,
        resolvedAmbientUrl,
        `${titleText}-scene-ambience`,
        assetMap,
        assetFailures,
      );
      const lightOverlaySourceUrl = resolveSceneLightOverlayUrl(
        sceneData?.visualStyle as any,
        sceneData?.scenePresetEnabled === true,
      );
      const lightOverlayUrl = lightOverlaySourceUrl
        ? await packImageAsset(
            zip,
            lightOverlaySourceUrl,
            `${titleText}-scene-light`,
            assetMap,
            assetFailures,
          )
        : undefined;
      const packedChars = [];
      for (const charConfig of rawPresentation.characters) {
        const charNode = nodes.find((n) => n.id === charConfig.sourceNodeId);
        if (charNode && charNode.type === 'characterNode') {
          const charData = charNode.data as any;
          const rawCharImgUrl = resolveCharacterImageUrl(charData, charConfig);
          const charName = charData.characterName || charData.name || '';

          if (typeof rawCharImgUrl === 'string' && rawCharImgUrl.trim()) {
            const packedCharImgUrl = await packImageAsset(
              zip,
              rawCharImgUrl,
              `${charName || 'character'}-avatar`,
              assetMap,
              assetFailures,
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
      const packedActions = [];
      for (const action of rawPresentation.inlineActions || []) {
        const packedAction = structuredClone(action);
        if (action.action === 'switch' && action.targetAssetId) {
          const source = nodes.find((candidate) => candidate.id === action.sourceNodeId);
          const assets =
            action.kind === 'scene'
              ? (source?.data as any)?.images
              : (source?.data as any)?.outfits;
          const target = assets?.find((asset: any) => asset.id === action.targetAssetId);
          packedAction.targetImageUrl = await packImageAsset(
            zip,
            target?.imageUrl,
            `${action.kind}-switch-${action.id}`,
            assetMap,
            assetFailures,
          );
        }
        packedActions.push(packedAction);
      }
      webPresentation = {
        scene: rawPresentation.scene
          ? {
              ...structuredClone(rawPresentation.scene),
              visualStyle: sceneData?.visualStyle,
              scenePresetEnabled: sceneData?.scenePresetEnabled === true,
              lightOverlayUrl: lightOverlayUrl || undefined,
              ambientSound:
                rawAmbientSound && ambientSoundUrl
                  ? { ...rawAmbientSound, url: ambientSoundUrl }
                  : undefined,
            }
          : undefined,
        characters: packedChars,
        inlineActions: packedActions,
      };
    }

    const dialogueText = await packDialogueText(
      style as RenderStyle,
      settings.canvasWidth,
      settings.canvasHeight,
      htmlToSpeechText(titleText),
      htmlToSpeechText(
        filterMentionTags(nodeText(node), settings.hideCharacterTags, settings.hideSceneTags),
      ),
      node.data?.hideTitleInPlayback === true,
    );
    webNodes.push({
      id: node.id,
      type: node.type,
      data: {
        title: titleText,
        dialogueText,
        text: filterMentionTags(nodeText(node), settings.hideCharacterTags, settings.hideSceneTags),
        rawText: nodeText(node),
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
        hideTitleInPlayback: node.data?.hideTitleInPlayback === true,
        isRoot: Boolean(node.data?.isRoot),
        hidden: Boolean(node.data?.hidden),
        skip: Boolean(node.data?.skip),
        nodeValue:
          typeof node.data?.nodeValue === 'number' && Number.isFinite(node.data.nodeValue)
            ? node.data.nodeValue
            : undefined,
        presentation: webPresentation,
      },
    });
  }

  if (assetFailures.size > 0)
    throw new Error(
      formatExportAssetFailures(options.language, '网页导出', [...assetFailures.values()]),
    );

  const webEdges: WebExportEdge[] = playable.edges.map((edge) => ({
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
  zip.file(
    'index.html',
    makeIndexHtml(
      title,
      options.language,
      faviconPath,
      settings.playerSettingsPanel,
      settings.settingsPageElements,
    ),
  );
  zip.file(
    'content.js',
    makeContentScript({
      title,
      language: options.language,
      style,
      settings,
      nodes: webNodes,
      edges: webEdges,
      flow: buildExportWebFlow(webNodes, webEdges),
    }),
  );
  const testMusicResponse = await fetch(volumeTestJingleUrl);
  if (!testMusicResponse.ok) throw new Error('Unable to load bundled volume test music');
  zip.file('audio/volume-test-jingle.ogg', await testMusicResponse.blob());
  zip.file('audio/volume-test-jingle.LICENSE.md', volumeTestJingleLicense);
  zip.folder('images');
  if (!options.standalonePlayer) {
    zip.file('start-preview.cmd', LOCAL_PREVIEW_CMD);
    zip.file('preview-server.ps1', LOCAL_PREVIEW_SERVER);
    zip.file(
      'README.txt',
      'Windows：解压后双击 start-preview.cmd，通过本机 HTTP 地址打开网页。播放期间保留启动窗口，关闭窗口即停止服务。无需安装 Node.js 或 Python。\r\n' +
        '直接打开 index.html 仍可使用；如果浏览器提示 file: 来源限制，请使用上述启动入口。\r\n' +
        'Windows: Extract the archive and double-click start-preview.cmd. Keep its window open while playing. No Node.js or Python installation is required.\r\n',
    );
  }

  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
}
