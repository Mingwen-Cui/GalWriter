import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react';
import JSZip from 'jszip';

import { resolveRegionBackgroundMusic } from '../../../../lib/regionMusic';
import { filterMentionTags } from '../../video/shared/storyNodes';
import type { RenderStyle } from '../../video/shared/types';
import { makeIndexHtml } from './webExportHtml';
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

const DEFAULT_EXPORT_RENDER_STYLE: RenderStyle = {
  titleVisible: true,
  titleFontSize: 28,
  bodyFontSize: 18,
  titleFontFamily: 'SimHei, "Noto Sans SC", sans-serif',
  bodyFontFamily: 'SimHei, "Noto Sans SC", sans-serif',
  titleColor: '#ffffff',
  bodyColor: '#f8fafc',
  titleColorAlpha: 100,
  bodyColorAlpha: 100,
  titleStrokeColor: '#000000',
  bodyStrokeColor: '#000000',
  titleStrokeWidth: 0,
  bodyStrokeWidth: 0,
  titleAlign: 'left',
  bodyAlign: 'left',
  titleLetterSpacing: 0,
  bodyLetterSpacing: 0,
  titleLineHeight: 1.25,
  bodyLineHeight: 1.45,
  titleAnimationLeadSeconds: 0,
  bodyAnimationLeadSeconds: 0,
  titleTypewriterMode: 'character',
  bodyTypewriterMode: 'character',
  panelColor: '#111827',
  panelColorAlpha: 82,
  dialogVisible: true,
  dialogWidth: 86,
  dialogHeight: 34,
  dialogHeightMode: 'fixed',
  dialogRadius: 24,
  dialogOffsetX: 0,
  dialogOffsetY: 0,
  dialogTextPaddingX: 9,
  dialogTextOffsetY: 0,
  dialogBackgroundType: 'solid',
  dialogGradientAngle: 90,
  dialogGradientStartColor: 'rgba(17, 24, 39, 0)',
  dialogGradientColor: 'rgba(17, 24, 39, 0.86)',
  dialogGradientStops: [
    { id: 'start', color: '#111827', alpha: 0, position: 0 },
    { id: 'end', color: '#111827', alpha: 86, position: 100 },
  ],
  dialogImageUrl: '',
  nameplateVisible: true,
  nameplateInside: false,
  nameplateFollowCharacter: true,
  nameplateFontSize: 18,
  nameplateFontFamily: 'SimHei, "Noto Sans SC", sans-serif',
  nameplateScale: 100,
  nameplateRadius: 14,
  nameplateTextColor: '#ffffff',
  nameplateTextColorAlpha: 100,
  nameplateOffsetX: 0,
  nameplateOffsetY: 0,
  nameplateTextGap: 8,
  nameplateBackgroundType: 'solid',
  nameplateColor: '#4f46e5',
  nameplateColorAlpha: 86,
  nameplateGradientAngle: 90,
  nameplateGradientStops: [
    { id: 'start', color: '#6366f1', alpha: 92, position: 0 },
    { id: 'end', color: '#ec4899', alpha: 82, position: 100 },
  ],
  nameplateImageUrl: '',
  titleAnimation: 'none',
  bodyAnimation: 'typewriter',
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
  const title = options.projectName?.trim() || 'galwriter-web';
  const style: WebExportStyle = {
    ...DEFAULT_EXPORT_RENDER_STYLE,
    ...options.style,
    choiceColor: options.style?.choiceColor || '#0ea5e9',
    choiceTextColor: options.style?.choiceTextColor || '#ffffff',
  };
  style.dialogImageUrl = await addImageAsset(
    zip,
    style.dialogImageUrl,
    `${title}-dialog-background`,
    assetMap,
  );
  style.nameplateImageUrl = await addImageAsset(
    zip,
    style.nameplateImageUrl,
    `${title}-nameplate-background`,
    assetMap,
  );
  const settings: WebExportSettings = {
    layoutMode: options.settings?.layoutMode || 'immersive',
    choicesPosition: options.settings?.choicesPosition || 'center',
    showStartMenu: options.settings?.showStartMenu ?? true,
    startMenuTemplate: options.settings?.startMenuTemplate || 'cinematic',
    startMenuBackgroundType: options.settings?.startMenuBackgroundType || 'gradient',
    startMenuBackgroundColor: options.settings?.startMenuBackgroundColor || '#070b12',
    startMenuBackgroundGradientStart:
      options.settings?.startMenuBackgroundGradientStart || '#0f172a',
    startMenuBackgroundGradientEnd: options.settings?.startMenuBackgroundGradientEnd || '#0891b2',
    startMenuBackgroundGradientAngle: options.settings?.startMenuBackgroundGradientAngle ?? 135,
    startMenuBackgroundImageUrl: options.settings?.startMenuBackgroundImageUrl || '',
    startMenuBackgroundMusicUrl: options.settings?.startMenuBackgroundMusicUrl || '',
    startMenuButtonPosition: options.settings?.startMenuButtonPosition || 'center',
    startMenuButtonLayout: options.settings?.startMenuButtonLayout || 'vertical',
    startMenuButtonSize: options.settings?.startMenuButtonSize || 'normal',
    startMenuElements: options.settings?.startMenuElements || [],
    archivePageElements: options.settings?.archivePageElements || [],
    settingsPageElements: options.settings?.settingsPageElements || [],
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
    typewriterSpeed: options.settings?.typewriterSpeed ?? 65,
    autoAdvance: options.settings?.autoAdvance ?? false,
    videoAutoPlay: options.settings?.videoAutoPlay ?? false,
    hideCharacterTags: options.settings?.hideCharacterTags ?? true,
    hideSceneTags: options.settings?.hideSceneTags ?? true,
  };
  settings.startMenuBackgroundImageUrl = await addImageAsset(
    zip,
    settings.startMenuBackgroundImageUrl,
    `${title}-start-background`,
    assetMap,
  );
  settings.startMenuBackgroundMusicUrl = await addAudioAsset(
    zip,
    settings.startMenuBackgroundMusicUrl,
    `${title}-start-menu-music`,
    assetMap,
  );
  const packMenuElements = (elements: WebExportSettings['startMenuElements'], pageName: string) =>
    Promise.all(
      elements.map(async (element) => ({
        ...element,
        imageUrl: await addImageAsset(
          zip,
          element.imageUrl,
          `${title}-${pageName}-${element.id || 'element'}`,
          assetMap,
        ),
        backgroundImageUrl: await addImageAsset(
          zip,
          element.backgroundImageUrl,
          `${title}-${pageName}-${element.id || 'button'}-background`,
          assetMap,
        ),
      })),
    );
  settings.startMenuElements = await packMenuElements(settings.startMenuElements, 'start');
  settings.archivePageElements = await packMenuElements(settings.archivePageElements, 'archive');
  settings.settingsPageElements = await packMenuElements(settings.settingsPageElements, 'settings');

  const webNodes: WebExportNode[] = [];
  for (const node of nodes.filter(
    (candidate) => candidate.type === 'storyNode' || candidate.type === 'numberConditionNode',
  )) {
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
        inlineActions: Array.isArray(rawPresentation.inlineActions)
          ? structuredClone(rawPresentation.inlineActions)
          : [],
      };
    }

    webNodes.push({
      id: node.id,
      type: node.type,
      data: {
        title: titleText,
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
