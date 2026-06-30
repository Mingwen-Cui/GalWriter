import type { Edge, MarkerType, Node } from '@xyflow/react';
import type JSZip from 'jszip';
import type { Dispatch, SetStateAction } from 'react';

import type {
  AIButtonsConfig,
  AIPromptsConfig,
  ImportedProjectSettings,
  PresentationTemplates,
  StoryEdge,
  StoryNode,
  StoryProject,
} from '../domain/project';
import type {
  AssistantTask,
  EditorProjectSettings,
  EditorProjectSettingsSetters,
} from '../editor-state/editorConfig';

export type ProjectSnapshotData = StoryProject;
const LEGACY_RENDER_STYLE_FONT = '"Microsoft YaHei", "Noto Sans SC", Arial, sans-serif';
const NEXT_RENDER_STYLE_FONT = 'SimHei, "Noto Sans SC", sans-serif';

const migrateLegacyRenderStyleDefaults = (
  style: ImportedProjectSettings['sharedRenderStyle'],
): ImportedProjectSettings['sharedRenderStyle'] => {
  if (!style) return style;
  return {
    ...style,
    titleFontSize: style.titleFontSize === 56 ? 28 : style.titleFontSize,
    bodyFontSize: style.bodyFontSize === 38 ? 18 : style.bodyFontSize,
    titleFontFamily:
      style.titleFontFamily === LEGACY_RENDER_STYLE_FONT ? NEXT_RENDER_STYLE_FONT : style.titleFontFamily,
    bodyFontFamily:
      style.bodyFontFamily === LEGACY_RENDER_STYLE_FONT ? NEXT_RENDER_STYLE_FONT : style.bodyFontFamily,
  };
};

const clampCardToolbarScale = (value: unknown) => {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseFloat(value)
        : Number.NaN;
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(3, Math.max(0.5, parsed));
};

export type ProjectSerializerEdgeDefaults = {
  markerEnd: {
    type: MarkerType;
    width?: number;
    height?: number;
    color?: string;
  };
  style: StoryEdge['style'];
};

export interface ProjectSerializerOptions {
  defaultEdgeOptions: ProjectSerializerEdgeDefaults;
  defaultAIPrompts: AIPromptsConfig;
  defaultAIButtonsConfig: AIButtonsConfig;
}

export interface ExportZipParams {
  projectData: ProjectSnapshotData;
  fileName: string;
  filePath?: string | null;
  thumbnailDataUrl?: string | null;
  defaultSaveDir?: string | null;
}

export interface ProjectExportResult {
  projectData: ProjectSnapshotData;
  filePath: string | null;
  canceled: boolean;
}

export interface ExportBundleProjectParams {
  projectData: ProjectSnapshotData;
  projectName: string;
  thumbnailDataUrl?: string | null;
}

export interface ExportProjectBundleParams {
  projects: ExportBundleProjectParams[];
  fileName: string;
  defaultSaveDir?: string | null;
}

export interface ImportedProjectEntry {
  projectData: ProjectSnapshotData;
  suggestedProjectName: string;
  zip: JSZip | null;
  thumbnailDataUrl?: string | null;
}

export interface ApplyImportedProjectParams {
  projectData: ProjectSnapshotData;
  settingsSetters: EditorProjectSettingsSetters;
  setAssistantTasks: Dispatch<SetStateAction<AssistantTask[]>>;
  setActiveAssistantTaskId: Dispatch<SetStateAction<string>>;
}

const base64ToBlob = (base64: string) => {
  const parts = base64.split(';base64,');
  if (parts.length !== 2) return null;
  const contentType = parts[0].split(':')[1];
  const byteCharacters = atob(parts[1]);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);

    for (let i = 0; i < slice.length; i += 1) {
      byteNumbers[i] = slice.charCodeAt(i);
    }

    byteArrays.push(new Uint8Array(byteNumbers));
  }

  return new Blob(byteArrays, { type: contentType });
};

const loadJSZip = async () => (await import('jszip')).default;

const urlToBlob = async (url: string) => {
  if (!url) return null;
  if (url.startsWith('data:')) return base64ToBlob(url);
  if (url.startsWith('blob:')) {
    try {
      const response = await fetch(url);
      return await response.blob();
    } catch (error) {
      console.error('Failed to fetch blob URL', error);
      return null;
    }
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      return await response.blob();
    } catch (error) {
      console.warn('Failed to fetch external project media URL', url, error);
      return null;
    }
  }
  return null;
};

const PROJECT_MEDIA_URL_FIELDS = new Set([
  'imageUrl',
  'videoUrl',
  'audioUrl',
  'avatarUrl',
  'coverImageUrl',
  'previousImageUrl',
  'previousVideoUrl',
]);

const PROJECT_MEDIA_OBJECT_URL_FIELDS = new Set(['url']);
const PROJECT_HTML_MEDIA_FIELDS = new Set(['text', 'content']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const readStoredPresentationTemplates = (): PresentationTemplates => {
  const parseTemplates = (key: string) => {
    try {
      const stored = localStorage.getItem(key);
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error(`Failed to parse ${key}:`, error);
      return [];
    }
  };

  return {
    characters: parseTemplates('galwriter-char-templates'),
    scenes: parseTemplates('galwriter-scene-templates'),
  };
};

const restoreStoredPresentationTemplates = (templates: PresentationTemplates | undefined) => {
  if (!templates) return;
  localStorage.setItem(
    'galwriter-char-templates',
    JSON.stringify(Array.isArray(templates.characters) ? templates.characters : []),
  );
  localStorage.setItem(
    'galwriter-scene-templates',
    JSON.stringify(Array.isArray(templates.scenes) ? templates.scenes : []),
  );
  window.dispatchEvent(new Event('galwriter-templates-changed'));
};

const stripAutoStoryNodeRuntimeStyle = (style: Node['style'] | undefined): Node['style'] => {
  if (!style) return style;
  const { height: _height, minHeight: _minHeight, ...rest } = style;
  return rest;
};

const isEmbeddableMediaUrl = (value: string) =>
  value.startsWith('data:') ||
  value.startsWith('blob:') ||
  value.startsWith('http://') ||
  value.startsWith('https://');

const isProjectAssetUrl = (value: string) => value.startsWith('assets/');

const extensionFromBlob = (blob: Blob, fallback = 'bin') => {
  const [kind, subtype] = blob.type.split('/');
  if (blob.type === 'audio/mpeg') return 'mp3';
  if (subtype) return subtype.split(';')[0].replace(/[^a-z0-9.+-]/gi, '') || fallback;
  if (kind === 'image') return 'png';
  if (kind === 'audio') return 'mp3';
  if (kind === 'video') return 'mp4';
  return fallback;
};

const sanitizeAssetPart = (value: string) =>
  value
    .replace(/[^a-z0-9_-]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'media';

const shouldPackUrlField = (
  key: string,
  value: string,
  parent: Record<string, unknown> | null,
) => {
  if (!isEmbeddableMediaUrl(value)) return false;
  if (PROJECT_MEDIA_URL_FIELDS.has(key)) return true;
  if (!PROJECT_MEDIA_OBJECT_URL_FIELDS.has(key) || !parent) return false;
  return (
    typeof parent.source === 'string' ||
    typeof parent.mimeType === 'string' ||
    typeof parent.type === 'string' ||
    typeof parent.loop === 'boolean' ||
    typeof parent.fadeIn === 'number' ||
    typeof parent.fadeOut === 'number' ||
    typeof parent.createdAt === 'number'
  );
};

const shouldRestoreUrlField = (
  key: string,
  value: string,
  parent: Record<string, unknown> | null,
) => {
  if (!isProjectAssetUrl(value)) return false;
  if (PROJECT_MEDIA_URL_FIELDS.has(key)) return true;
  if (!PROJECT_MEDIA_OBJECT_URL_FIELDS.has(key) || !parent) return false;
  return (
    typeof parent.source === 'string' ||
    typeof parent.mimeType === 'string' ||
    typeof parent.type === 'string' ||
    typeof parent.loop === 'boolean' ||
    typeof parent.fadeIn === 'number' ||
    typeof parent.fadeOut === 'number' ||
    typeof parent.createdAt === 'number'
  );
};

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read blob.'));
    reader.readAsDataURL(blob);
  });

const processHtmlMedia = async (html: string, assetsFolder: JSZip | null, nodeId: string) => {
  if (!html) return html;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const elements = doc.querySelectorAll('img, video, source, audio');
  let index = 0;

  for (const element of Array.from(elements)) {
    const src = element.getAttribute('src');
    if (!src || !isEmbeddableMediaUrl(src)) continue;

    const blob = await urlToBlob(src);
    if (!blob) continue;

    const type = blob.type.split('/')[0];
    const ext = blob.type.split('/')[1] || 'bin';
    const fileName = `inline_${nodeId}_${type}_${(index += 1)}.${ext}`;
    assetsFolder?.file(fileName, blob);
    element.setAttribute('src', `assets/${fileName}`);
  }

  return doc.body.innerHTML;
};

const restoreHtmlMedia = async (html: string, zip: JSZip | null) => {
  if (!html || !zip) return html;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const elements = doc.querySelectorAll('img, video, source, audio');

  for (const element of Array.from(elements)) {
    const src = element.getAttribute('src');
    if (!src || !src.startsWith('assets/')) continue;
    const assetFile = zip.file(src);
    if (!assetFile) continue;
    const blob = await assetFile.async('blob');
    element.setAttribute('src', URL.createObjectURL(blob));
  }

  return doc.body.innerHTML;
};

const packProjectMediaValue = async (
  value: unknown,
  assetsFolder: JSZip | null,
  context: string,
  parent: Record<string, unknown> | null = null,
  key = '',
  counters = { media: 0, html: 0 },
): Promise<unknown> => {
  if (typeof value === 'string') {
    if (PROJECT_HTML_MEDIA_FIELDS.has(key)) {
      counters.html += 1;
      return processHtmlMedia(value, assetsFolder, `${context}_html_${counters.html}`);
    }

    if (!shouldPackUrlField(key, value, parent)) return value;

    const blob = await urlToBlob(value);
    if (!blob) return value;

    counters.media += 1;
    const extension = extensionFromBlob(blob);
    const mediaFileName = `media_${sanitizeAssetPart(context)}_${sanitizeAssetPart(key)}_${counters.media}.${extension}`;
    assetsFolder?.file(mediaFileName, blob);
    return `assets/${mediaFileName}`;
  }

  if (Array.isArray(value)) {
    return Promise.all(
      value.map((item, index) =>
        packProjectMediaValue(
          item,
          assetsFolder,
          `${context}_${sanitizeAssetPart(key || 'item')}_${index + 1}`,
          null,
          '',
          counters,
        ),
      ),
    );
  }

  if (isRecord(value)) {
    const next: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      next[childKey] = await packProjectMediaValue(
        childValue,
        assetsFolder,
        `${context}_${sanitizeAssetPart(childKey)}`,
        value,
        childKey,
        counters,
      );
    }
    return next;
  }

  return value;
};

const restoreProjectMediaValue = async (
  value: unknown,
  zip: JSZip | null,
  parent: Record<string, unknown> | null = null,
  key = '',
): Promise<unknown> => {
  if (typeof value === 'string') {
    if (PROJECT_HTML_MEDIA_FIELDS.has(key)) return restoreHtmlMedia(value, zip);
    if (!zip || !shouldRestoreUrlField(key, value, parent)) return value;
    const assetFile = zip.file(value);
    if (!assetFile) return value;
    const blob = await assetFile.async('blob');
    return URL.createObjectURL(blob);
  }

  if (Array.isArray(value)) {
    return Promise.all(
      value.map((item) => restoreProjectMediaValue(item, zip, null, '')),
    );
  }

  if (isRecord(value)) {
    const next: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      next[childKey] = await restoreProjectMediaValue(childValue, zip, value, childKey);
    }
    return next;
  }

  return value;
};

const applyProjectSettings = (
  incomingSettings: ImportedProjectSettings | undefined,
  setters: EditorProjectSettingsSetters,
  defaultPrompts: AIPromptsConfig,
  defaultButtonsConfig: AIButtonsConfig,
) => {
  if (!incomingSettings) {
    setters.setAccentColor('');
    setters.setPlotStructureGenerateDirection('down');
    setters.setAiGenerationBalance('dialogue');
    return;
  }

  if (incomingSettings.sharedRenderStyle) {
    const sharedRenderStyle = migrateLegacyRenderStyleDefaults(incomingSettings.sharedRenderStyle);
    setters.setSharedRenderStyle((previous) => ({
      ...previous,
      ...sharedRenderStyle,
    }));
  }
  if (incomingSettings.canvasBg) setters.setCanvasBg(incomingSettings.canvasBg);
  if (incomingSettings.edgeStyle) setters.setEdgeStyle(incomingSettings.edgeStyle);
  if (incomingSettings.pasteAsPlainText !== undefined) {
    setters.setPasteAsPlainText(incomingSettings.pasteAsPlainText);
  }
  if (incomingSettings.showNodeActions !== undefined) {
    setters.setShowNodeActions(incomingSettings.showNodeActions);
  }
  if (incomingSettings.showStats !== undefined) setters.setShowStats(incomingSettings.showStats);
  if (incomingSettings.saveAssistantConversations !== undefined) {
    setters.setSaveAssistantConversations(incomingSettings.saveAssistantConversations);
  }
  setters.setAllowAssistantImageGeneration(incomingSettings.allowAssistantImageGeneration !== false);
  setters.setSkipAssistantAgentAnimation(incomingSettings.skipAssistantAgentAnimation === true);
  setters.setAssistantMemorySkillEnabled(incomingSettings.assistantMemorySkillEnabled === true);
  setters.setAssistantMemoryNotes(
    Array.isArray(incomingSettings.assistantMemoryNotes)
      ? incomingSettings.assistantMemoryNotes
          .filter((note): note is string => typeof note === 'string' && note.trim().length > 0)
          .slice(0, 24)
      : [],
  );
  if (incomingSettings.presetColors) setters.setPresetColors(incomingSettings.presetColors);
  if (incomingSettings.showPresetColors !== undefined) {
    setters.setShowPresetColors(incomingSettings.showPresetColors);
  }
  setters.setAccentColor(
    typeof incomingSettings.accentColor === 'string' ? incomingSettings.accentColor : '',
  );
  if (incomingSettings.showTitles !== undefined) setters.setShowTitles(incomingSettings.showTitles);
  if (incomingSettings.storyTitlePlacement === 'inside') {
    setters.setStoryTitlePlacement('inside');
  } else if (incomingSettings.storyTitlePlacement === 'outside-left') {
    setters.setStoryTitlePlacement('outside-left');
  } else if (
    incomingSettings.storyTitlePlacement === 'outside-right' ||
    (incomingSettings.storyTitlePlacement as string) === 'outside'
  ) {
    setters.setStoryTitlePlacement('outside-right');
  }
  if (incomingSettings.generateLength) setters.setGenerateLength(incomingSettings.generateLength);
  if (
    incomingSettings.ttsNarrationMode === 'body' ||
    incomingSettings.ttsNarrationMode === 'title' ||
    incomingSettings.ttsNarrationMode === 'all'
  ) {
    setters.setTtsNarrationMode(incomingSettings.ttsNarrationMode);
  }
  if (incomingSettings.imageSize) setters.setImageSize(incomingSettings.imageSize);
  if (
    incomingSettings.characterImageMode === 'three-view' ||
    incomingSettings.characterImageMode === 'transparent-sprite'
  ) {
    setters.setCharacterImageMode(incomingSettings.characterImageMode);
  } else {
    setters.setCharacterImageMode('transparent-sprite');
  }
  setters.setHideStoryImageButtonWithTags(incomingSettings.hideStoryImageButtonWithTags !== false);
  if (
    incomingSettings.sceneImageMode === 'storyboard-16:9' ||
    incomingSettings.sceneImageMode === 'follow-api'
  ) {
    setters.setSceneImageMode(incomingSettings.sceneImageMode);
  } else {
    setters.setSceneImageMode('storyboard-16:9');
  }
  if (
    incomingSettings.plotStructureGenerateDirection === 'up' ||
    incomingSettings.plotStructureGenerateDirection === 'down' ||
    incomingSettings.plotStructureGenerateDirection === 'left' ||
    incomingSettings.plotStructureGenerateDirection === 'right'
  ) {
    setters.setPlotStructureGenerateDirection(incomingSettings.plotStructureGenerateDirection);
  } else {
    setters.setPlotStructureGenerateDirection('down');
  }
  if (
    incomingSettings.aiGenerationBalance === 'dialogue' ||
    incomingSettings.aiGenerationBalance === 'action'
  ) {
    setters.setAiGenerationBalance(incomingSettings.aiGenerationBalance);
  } else {
    setters.setAiGenerationBalance('dialogue');
  }
  const shouldUseCustomPrompts =
    Boolean(incomingSettings.aiPrompts) || incomingSettings.customAiPromptsEnabled === true;
  setters.setCustomAiPromptsEnabled(shouldUseCustomPrompts);
  if (incomingSettings.aiPrompts) {
    setters.setAiPrompts({ ...defaultPrompts, ...incomingSettings.aiPrompts });
  } else {
    setters.setAiPrompts(defaultPrompts);
  }
  if (incomingSettings.aiButtonsConfig) {
    setters.setAiButtonsConfig({
      ...defaultButtonsConfig,
      ...incomingSettings.aiButtonsConfig,
    });
  }
  if (incomingSettings.scrollMode) setters.setScrollMode(incomingSettings.scrollMode);
  if (incomingSettings.showMiniMap !== undefined) {
    setters.setShowMiniMap(incomingSettings.showMiniMap);
  }
  if (incomingSettings.miniMapPosition === 'left' || incomingSettings.miniMapPosition === 'right') {
    setters.setMiniMapPosition(incomingSettings.miniMapPosition);
  }
  if (incomingSettings.showControls !== undefined) {
    setters.setShowControls(incomingSettings.showControls);
  }
  setters.setShowHoverButtonAnimations(incomingSettings.showHoverButtonAnimations ?? true);
  if (typeof incomingSettings.projectTitle === 'string') {
    setters.setProjectTitle(incomingSettings.projectTitle);
  }
  if (
    incomingSettings.toolbarLayout === 'horizontal' ||
    incomingSettings.toolbarLayout === 'vertical'
  ) {
    setters.setToolbarLayout(incomingSettings.toolbarLayout);
  }
  if (
    incomingSettings.selectionMenuLayout === 'horizontal' ||
    incomingSettings.selectionMenuLayout === 'vertical'
  ) {
    setters.setSelectionMenuLayout(incomingSettings.selectionMenuLayout);
  }
  setters.setCardToolbarScale(clampCardToolbarScale(incomingSettings.cardToolbarScale));
  if (incomingSettings.language) setters.setLanguage(incomingSettings.language);
  if (incomingSettings.theme) setters.setTheme(incomingSettings.theme);
  if (incomingSettings.bubbleStyle === 'glass' || incomingSettings.bubbleStyle === 'flat') {
    setters.setBubbleStyle(incomingSettings.bubbleStyle);
  }
  if (incomingSettings.playTestDarkMode !== undefined) {
    setters.setPlayTestDarkMode(incomingSettings.playTestDarkMode);
  }
  if (incomingSettings.playTestChoicesColumns !== undefined) {
    setters.setPlayTestChoicesColumns(incomingSettings.playTestChoicesColumns);
  }
  if (incomingSettings.playTestVideoAutoPlay !== undefined) {
    setters.setPlayTestVideoAutoPlay(incomingSettings.playTestVideoAutoPlay);
  }
  if (incomingSettings.playTestLayoutMode) {
    setters.setPlayTestLayoutMode(incomingSettings.playTestLayoutMode);
  }
  if (incomingSettings.playTestInteractionMode) {
    setters.setPlayTestInteractionMode(incomingSettings.playTestInteractionMode);
  }
  if (incomingSettings.playTestTypewriterSpeed !== undefined) {
    setters.setPlayTestTypewriterSpeed(incomingSettings.playTestTypewriterSpeed);
  }
  if (incomingSettings.playTestChoiceDelay !== undefined) {
    setters.setPlayTestChoiceDelay(incomingSettings.playTestChoiceDelay);
  }
  if (incomingSettings.playTestChoicesPosition) {
    setters.setPlayTestChoicesPosition(incomingSettings.playTestChoicesPosition);
  }
  if (incomingSettings.playTestBlurBackground !== undefined) {
    setters.setPlayTestBlurBackground(incomingSettings.playTestBlurBackground);
  }
  if (incomingSettings.playTestBlurText !== undefined) {
    setters.setPlayTestBlurText(incomingSettings.playTestBlurText);
  }
  if (incomingSettings.playTestSkipSingleChoicePopup !== undefined) {
    setters.setPlayTestSkipSingleChoicePopup(incomingSettings.playTestSkipSingleChoicePopup);
  }
  if (incomingSettings.playTestDimBackground !== undefined) {
    setters.setPlayTestDimBackground(incomingSettings.playTestDimBackground);
  }
  if (incomingSettings.playTestAutoAdvance !== undefined) {
    setters.setPlayTestAutoAdvance(incomingSettings.playTestAutoAdvance);
  }
  if (incomingSettings.playTestAutoAdvanceDelay !== undefined) {
    setters.setPlayTestAutoAdvanceDelay(incomingSettings.playTestAutoAdvanceDelay);
  }
  if (incomingSettings.playTestHideCharacterTags !== undefined) {
    setters.setPlayTestHideCharacterTags(incomingSettings.playTestHideCharacterTags);
  }
  if (incomingSettings.playTestHideSceneTags !== undefined) {
    setters.setPlayTestHideSceneTags(incomingSettings.playTestHideSceneTags);
  }
};

const restoreProjectNodes = async (nodes: Node[], zip: JSZip | null) =>
  Promise.all(
    nodes.map(async (node) => {
      const isAutoSizedStoryNode =
        node.type === 'storyNode' && node.data?.sizeMode !== 'custom';
      const restoredNode: Node = {
        ...node,
        ...(isAutoSizedStoryNode
          ? {
              height: undefined,
              measured: undefined,
              style: stripAutoStoryNodeRuntimeStyle(node.style),
            }
          : {}),
        data: { ...node.data },
        dragHandle: node.type === 'backgroundNode' ? '.custom-drag-handle' : node.dragHandle,
      };
      restoredNode.data = (await restoreProjectMediaValue(
        restoredNode.data,
        zip,
      )) as Node['data'];

      return restoredNode;
    }),
  );

const triggerDownload = (content: Blob, fileName: string) => {
  const url = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

const safeZipFolderName = (name: string, fallback: string) => {
  const cleaned = name
    .trim()
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 80);
  return cleaned || fallback;
};

const saveZipWithTauri = async (
  content: Blob,
  fileName: string,
  filePath?: string | null,
  defaultSaveDir?: string | null,
): Promise<ProjectExportResult | null> => {
  if (!(window as any).__TAURI__) return null;

  try {
    const tauriCore = await import('@tauri-apps/api/core');
    const invoke =
      tauriCore.invoke ||
      (tauriCore as any).default?.invoke ||
      (window as any).__TAURI__?.core?.invoke;
    if (!invoke) return null;

    const bytes = Array.from(new Uint8Array(await content.arrayBuffer()));
    const result = (await invoke('save_project_zip', {
      fileName,
      bytes,
      filePath: filePath || null,
      defaultDir: defaultSaveDir || null,
    })) as { path?: string | null };

    return {
      projectData: {} as ProjectSnapshotData,
      filePath: result.path || null,
      canceled: !result.path,
    };
  } catch (error) {
    console.error('Failed to save ZIP with Tauri', error);
    throw error;
  }
};

export const createProjectSerializer = (options: ProjectSerializerOptions) => {
  const createSnapshot = ({
    nodes,
    edges,
    settings,
    assistantTasks,
    activeAssistantTaskId,
  }: {
    nodes: Node[];
    edges: Edge[];
    settings: EditorProjectSettings;
    assistantTasks: AssistantTask[];
    activeAssistantTaskId: string;
  }) => {
    const simpleNodes = nodes.map((node) => {
      const isAutoSizedStoryNode =
        node.type === 'storyNode' && node.data?.sizeMode !== 'custom';

        return {
          id: node.id,
          position: node.position,
          type: node.type,
          style: isAutoSizedStoryNode
            ? stripAutoStoryNodeRuntimeStyle(node.style)
            : node.style,
          data: { ...node.data },
          width: node.measured?.width || node.width,
          height: isAutoSizedStoryNode ? undefined : node.measured?.height || node.height,
        dragHandle: node.dragHandle,
      };
    }) as StoryNode[];

    const simpleEdges: StoryEdge[] = edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      data: { label: typeof edge.data?.label === 'string' ? edge.data.label : '' },
    }));

    const settingsForSnapshot = { ...settings };
    if (!settingsForSnapshot.customAiPromptsEnabled) {
      delete settingsForSnapshot.aiPrompts;
    }

    return {
      nodes: simpleNodes,
      edges: simpleEdges,
      settings: settingsForSnapshot,
      presentationTemplates: readStoredPresentationTemplates(),
      assistantTasks: settings.saveAssistantConversations ? assistantTasks : undefined,
      activeAssistantTaskId: settings.saveAssistantConversations
        ? activeAssistantTaskId
        : undefined,
    } as ProjectSnapshotData;
  };

  const writeProjectToZip = async (
    zip: JSZip,
    projectData: ProjectSnapshotData,
    thumbnailDataUrl?: string | null,
  ) => {
    const assetsFolder = zip.folder('assets');

    const processedNodes = await Promise.all(
      projectData.nodes.map(async (node) => {
        const nextNode = { ...node, data: { ...node.data } };
        nextNode.data = (await packProjectMediaValue(
          nextNode.data,
          assetsFolder,
          node.id,
        )) as StoryNode['data'];

        return nextNode;
      }),
    );

    const exportProject = {
      ...projectData,
      nodes: processedNodes,
    };

    zip.file('project.json', JSON.stringify(exportProject));
    if (thumbnailDataUrl) {
      const thumbnailBlob = await urlToBlob(thumbnailDataUrl);
      if (thumbnailBlob) {
        zip.file('thumbnail.svg', thumbnailBlob);
      }
    }

    return exportProject;
  };

  const exportZip = async ({
    projectData,
    fileName,
    filePath,
    thumbnailDataUrl,
    defaultSaveDir,
  }: ExportZipParams): Promise<ProjectExportResult> => {
    const JSZip = await loadJSZip();
    const zip = new JSZip();
    const exportProject = await writeProjectToZip(zip, projectData, thumbnailDataUrl);

    const content = await zip.generateAsync({ type: 'blob' });
    const normalizedFileName = fileName.endsWith('.zip') ? fileName : `${fileName}.zip`;
    const desktopResult = await saveZipWithTauri(
      content,
      normalizedFileName,
      filePath,
      defaultSaveDir,
    );
    if (desktopResult) {
      return {
        ...desktopResult,
        projectData: exportProject,
      };
    }

    triggerDownload(content, normalizedFileName);

    return {
      projectData: exportProject,
      filePath: null,
      canceled: false,
    };
  };

  const exportProjectBundle = async ({
    projects,
    fileName,
    defaultSaveDir,
  }: ExportProjectBundleParams): Promise<ProjectExportResult> => {
    const JSZip = await loadJSZip();
    const zip = new JSZip();
    const usedFolders = new Set<string>();

    for (const [index, project] of projects.entries()) {
      const baseFolderName = safeZipFolderName(project.projectName, `project-${index + 1}`);
      let folderName = baseFolderName;
      let duplicateIndex = 2;
      while (usedFolders.has(folderName)) {
        folderName = `${baseFolderName}-${duplicateIndex}`;
        duplicateIndex += 1;
      }
      usedFolders.add(folderName);

      const projectFolder = zip.folder(folderName);
      if (!projectFolder) continue;
      await writeProjectToZip(projectFolder, project.projectData, project.thumbnailDataUrl);
    }

    zip.file(
      'galwriter-project-bundle.json',
      JSON.stringify({
        type: 'galwriter-project-bundle',
        version: 1,
        projectCount: projects.length,
        exportedAt: new Date().toISOString(),
      }),
    );

    const content = await zip.generateAsync({ type: 'blob' });
    const normalizedFileName = fileName.endsWith('.zip') ? fileName : `${fileName}.zip`;
    const desktopResult = await saveZipWithTauri(content, normalizedFileName, null, defaultSaveDir);
    if (desktopResult) return desktopResult;

    triggerDownload(content, normalizedFileName);

    return {
      projectData: {} as ProjectSnapshotData,
      filePath: null,
      canceled: false,
    };
  };

  const importProjectEntries = async (file: File): Promise<ImportedProjectEntry[]> => {
    if (file.name.endsWith('.json')) {
      return [
        {
          projectData: JSON.parse(await file.text()) as ProjectSnapshotData,
          suggestedProjectName: file.name.replace(/\.json$/i, '').trim() || 'imported-project',
          zip: null,
          thumbnailDataUrl: null,
        },
      ];
    }

    const JSZip = await loadJSZip();
    const zip = await JSZip.loadAsync(file);
    const projectJsonFile = zip.file('project.json');
    if (!projectJsonFile) {
      const projectJsonFiles = Object.values(zip.files).filter(
        (entry) => !entry.dir && /(^|\/)project\.json$/i.test(entry.name),
      );
      if (projectJsonFiles.length === 0) {
        throw new Error('Invalid project: project.json not found');
      }

      return Promise.all(
        projectJsonFiles.map(async (entry) => {
          const folderPrefix = entry.name.replace(/project\.json$/i, '');
          const entryZip = new JSZip();
          const filesInFolder = Object.values(zip.files).filter(
            (fileEntry) => !fileEntry.dir && fileEntry.name.startsWith(folderPrefix),
          );

          await Promise.all(
            filesInFolder.map(async (fileEntry) => {
              const relativePath = fileEntry.name.slice(folderPrefix.length);
              entryZip.file(relativePath, await fileEntry.async('blob'));
            }),
          );

          const entryProjectJson = entryZip.file('project.json');
          if (!entryProjectJson) throw new Error('Invalid bundled project');
          const thumbnailFile = entryZip.file('thumbnail.svg') ?? entryZip.file('thumbnail.png');
          const folderName = folderPrefix.replace(/\/$/, '').split('/').pop() || 'imported-project';

          return {
            projectData: JSON.parse(await entryProjectJson.async('string')) as ProjectSnapshotData,
            suggestedProjectName: folderName.trim() || 'imported-project',
            zip: entryZip,
            thumbnailDataUrl: thumbnailFile
              ? await blobToDataUrl(await thumbnailFile.async('blob'))
              : null,
          };
        }),
      );
    }

    const thumbnailFile = zip.file('thumbnail.svg') ?? zip.file('thumbnail.png');

    return [
      {
        projectData: JSON.parse(await projectJsonFile.async('string')) as ProjectSnapshotData,
        suggestedProjectName: file.name.replace(/\.(zip|json)$/i, '').trim() || 'imported-project',
        zip,
        thumbnailDataUrl: thumbnailFile
          ? await blobToDataUrl(await thumbnailFile.async('blob'))
          : null,
      },
    ];
  };

  const importZip = async (file: File) => {
    const [entry] = await importProjectEntries(file);
    if (!entry) throw new Error('Invalid project: project.json not found');
    return entry;
  };

  const restoreImportedProject = async (
    projectData: ProjectSnapshotData,
    zip: JSZip | null = null,
  ): Promise<ProjectSnapshotData> => {
    const restoredNodes = await restoreProjectNodes(projectData.nodes as Node[], zip);
    const restoredEdges = (projectData.edges || []).map((edge) => ({
      ...edge,
      markerEnd: options.defaultEdgeOptions.markerEnd,
      style: options.defaultEdgeOptions.style,
    }));

    return {
      ...projectData,
      nodes: restoredNodes as StoryNode[],
      edges: restoredEdges as StoryEdge[],
    };
  };

  const applyImportedProject = async (
    {
      projectData,
      settingsSetters,
      setAssistantTasks,
      setActiveAssistantTaskId,
    }: ApplyImportedProjectParams,
    zip: JSZip | null = null,
  ) => {
    const restoredProject = await restoreImportedProject(projectData, zip);

    applyProjectSettings(
      restoredProject.settings,
      settingsSetters,
      options.defaultAIPrompts,
      options.defaultAIButtonsConfig,
    );
    restoreStoredPresentationTemplates(restoredProject.presentationTemplates);

    if (
      restoredProject.settings?.saveAssistantConversations !== false &&
      Array.isArray(restoredProject.assistantTasks) &&
      restoredProject.assistantTasks.length > 0
    ) {
      setAssistantTasks(restoredProject.assistantTasks);
      const incomingActiveTaskId = restoredProject.activeAssistantTaskId;
      setActiveAssistantTaskId(
        incomingActiveTaskId &&
          restoredProject.assistantTasks.some((task) => task.id === incomingActiveTaskId)
          ? incomingActiveTaskId
          : restoredProject.assistantTasks[0].id,
      );
    }

    return restoredProject;
  };

  return {
    createSnapshot,
    exportZip,
    exportProjectBundle,
    importProjectEntries,
    importZip,
    restoreImportedProject,
    applyImportedProject,
    applyProjectSettings: (
      incomingSettings: ImportedProjectSettings | undefined,
      setters: EditorProjectSettingsSetters,
    ) =>
      applyProjectSettings(
        incomingSettings,
        setters,
        options.defaultAIPrompts,
        options.defaultAIButtonsConfig,
      ),
  };
};
