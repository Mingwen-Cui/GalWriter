import type { Edge, MarkerType, Node } from '@xyflow/react';
import JSZip from 'jszip';
import type { Dispatch, SetStateAction } from 'react';

import type {
  AIButtonsConfig,
  AIPromptsConfig,
  ImportedProjectSettings,
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
  return null;
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
    if (!src || (!src.startsWith('data:') && !src.startsWith('blob:'))) continue;

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

const applyProjectSettings = (
  incomingSettings: ImportedProjectSettings | undefined,
  setters: EditorProjectSettingsSetters,
  defaultPrompts: AIPromptsConfig,
  defaultButtonsConfig: AIButtonsConfig,
) => {
  if (!incomingSettings) return;

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
  if (incomingSettings.presetColors) setters.setPresetColors(incomingSettings.presetColors);
  if (incomingSettings.showPresetColors !== undefined) {
    setters.setShowPresetColors(incomingSettings.showPresetColors);
  }
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
  if (
    incomingSettings.sceneImageMode === 'storyboard-16:9' ||
    incomingSettings.sceneImageMode === 'follow-api'
  ) {
    setters.setSceneImageMode(incomingSettings.sceneImageMode);
  } else {
    setters.setSceneImageMode('storyboard-16:9');
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
      const restoredNode: Node = {
        ...node,
        data: { ...node.data },
        dragHandle: node.type === 'backgroundNode' ? '.custom-drag-handle' : node.dragHandle,
      };

      for (const field of ['imageUrl', 'videoUrl', 'audioUrl']) {
        const value = restoredNode.data[field];
        if (typeof value !== 'string' || !value.startsWith('assets/') || !zip) continue;
        const assetFile = zip.file(value);
        if (!assetFile) continue;
        const blob = await assetFile.async('blob');
        restoredNode.data[field] = URL.createObjectURL(blob);
      }

      if (typeof restoredNode.data.text === 'string') {
        restoredNode.data.text = await restoreHtmlMedia(restoredNode.data.text, zip);
      }

      if (typeof restoredNode.data.content === 'string') {
        restoredNode.data.content = await restoreHtmlMedia(restoredNode.data.content, zip);
      }

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
    const simpleNodes = nodes.map((node) => ({
      id: node.id,
      position: node.position,
      type: node.type,
      style: node.style,
      data: { ...node.data },
      width: node.measured?.width || node.width,
      height: node.measured?.height || node.height,
      dragHandle: node.dragHandle,
    })) as StoryNode[];

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

        for (const field of ['imageUrl', 'videoUrl', 'audioUrl']) {
          const value = nextNode.data[field];
          if (typeof value !== 'string') continue;
          if (!value.startsWith('data:') && !value.startsWith('blob:')) continue;

          const blob = await urlToBlob(value);
          if (!blob) continue;

          const extension = blob.type.split('/')[1] || 'bin';
          const mediaFileName = `media_${node.id}_${field}.${extension}`;
          assetsFolder?.file(mediaFileName, blob);
          nextNode.data[field] = `assets/${mediaFileName}`;
        }

        if (typeof nextNode.data.text === 'string') {
          nextNode.data.text = await processHtmlMedia(nextNode.data.text, assetsFolder, node.id);
        }

        if (typeof nextNode.data.content === 'string') {
          nextNode.data.content = await processHtmlMedia(
            nextNode.data.content,
            assetsFolder,
            node.id,
          );
        }

        return nextNode;
      }),
    );

    const exportProject = {
      ...projectData,
      nodes: processedNodes,
    };

    zip.file('project.json', JSON.stringify(exportProject, null, 2));
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
      JSON.stringify(
        {
          type: 'galwriter-project-bundle',
          version: 1,
          projectCount: projects.length,
          exportedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
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
