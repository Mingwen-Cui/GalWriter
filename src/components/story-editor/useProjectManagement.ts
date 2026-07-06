import React, { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Node, Edge } from '@xyflow/react';

import type { ProjectAIProfilesExport } from '../../domain/project';
import {
  type ProjectSnapshotData,
  useProjectSerialization,
} from '../../editor-features/project-io/useProjectSerialization';
import { localPersistenceService } from '../../editor-services/localPersistenceService';
import { createProjectSerializer } from '../../editor-services/projectSerializer';
import { createProjectThumbnail } from '../../editor-services/projectThumbnail';
import { useAutoSave } from '../../editor-services/useAutoSave';
import type {
  AIGenerationBalance,
  AIButtonsConfig,
  AIPromptsConfig,
  AssistantTask,
} from '../../editor-state/editorConfig';
import {
  defaultAIPrompts,
  defaultAIButtonsConfig,
} from '../../editor-state/editorConfig';
import {
  HOSTED_IMAGE_PROXY_PROFILE_ID,
  HOSTED_PROXY_PROFILE_ID,
  HOSTED_VOICE_PROXY_PROFILE_ID,
} from '../../lib/hostedProxy';
import type { Language } from '../../lib/i18n';
import { getTauriInvoke, isTauriRuntime } from '../../lib/tauriRuntime';
import { stableStringify } from '../../lib/stableStringify';
import { EXAMPLES_MANIFEST_URL, normalizeExampleTemplates } from './exampleTemplates';
import { INITIAL_NODES } from './initialGraph';
import { buildAutoProjectName, getPersistedProjectName } from './projectNames';
import { syncCloseButtonBehavior } from './windowBehavior';
import type { CloseButtonBehavior } from './constants';
import { DEFAULT_PROJECT_FILE_NAME } from './constants';
import type { ProjectExampleTemplate } from '../ProjectPickerModal';
import type { PendingProjectAction, ThemePreference } from './types';

// ---------------------------------------------------------------------------
// Params
// ---------------------------------------------------------------------------

interface UseProjectManagementParams {
  nodes: Node[];
  edges: Edge[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;

  language: Language;
  isMobile: boolean;

  editorProjectSettings: any;
  editorProjectSettingsSetters: any;

  savedAIProfiles: any[];
  setSavedAIProfiles: React.Dispatch<React.SetStateAction<any[]>>;
  activeTextProfileId: string | null;
  setActiveTextProfileId: React.Dispatch<React.SetStateAction<string | null>>;
  activeImageProfileId: string | null;
  setActiveImageProfileId: React.Dispatch<React.SetStateAction<string | null>>;
  activeBackgroundRemovalProfileId: string | null;
  setActiveBackgroundRemovalProfileId: React.Dispatch<React.SetStateAction<string | null>>;
  activeVoiceProfileId: string | null;
  setActiveVoiceProfileId: React.Dispatch<React.SetStateAction<string | null>>;
  getExportedAIProfiles: () => ProjectAIProfilesExport | null;

  theme: ThemePreference;
  setTheme: React.Dispatch<React.SetStateAction<ThemePreference>>;
  closeButtonBehavior: CloseButtonBehavior;
  setCloseButtonBehavior: React.Dispatch<React.SetStateAction<CloseButtonBehavior>>;

  isDirty: boolean;
  setIsDirty: (dirty: boolean) => void;
  lastSavedSnapshot: React.MutableRefObject<string>;

  setHistory: React.Dispatch<
    React.SetStateAction<{
      past: { nodes: Node[]; edges: Edge[] }[];
      future: { nodes: Node[]; edges: Edge[] }[];
    }>
  >;
  lastHistoryState: React.MutableRefObject<{ nodes: Node[]; edges: Edge[] }>;

  // From useAssistantSystem
  assistantTasks: AssistantTask[];
  activeAssistantTaskId: string | null;
  setAssistantTasks: React.Dispatch<React.SetStateAction<AssistantTask[]>>;
  setActiveAssistantTaskId: React.Dispatch<React.SetStateAction<string | null>>;
  resetAssistantTasks: (tasks?: AssistantTask[], activeId?: string | null) => void;

  saveFileName: string;
  setSaveFileName: React.Dispatch<React.SetStateAction<string>>;
  projectTitle: string;
  setProjectTitle: React.Dispatch<React.SetStateAction<string>>;
  setShowSaveNameModal: React.Dispatch<React.SetStateAction<boolean>>;
  setShowProjectHome: React.Dispatch<React.SetStateAction<boolean>>;
  setProjectIdsPendingDeletion: React.Dispatch<React.SetStateAction<string[]>>;
  setShowProjectSavePrompt: React.Dispatch<React.SetStateAction<boolean>>;
  setShowAppClosePrompt: React.Dispatch<React.SetStateAction<boolean>>;
  setProjectListLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setLastSavedTime: React.Dispatch<React.SetStateAction<number | null>>;

  jsonInputRef: React.MutableRefObject<HTMLInputElement | null>;
  importModeRef: React.MutableRefObject<'replace' | 'new'>;
  pendingInitialSnapshotSyncProjectIdRef: React.MutableRefObject<string | null>;
  pendingInitialSnapshotCandidateRef: React.MutableRefObject<string>;

  createCurrentProjectThumbnail: () => Promise<string>;
  defaultProjectSaveDir: string | null;
  setDefaultProjectSaveDir: React.Dispatch<React.SetStateAction<string | null>>;
  defaultEdgeOptions: any;

  // Shared state (declared in StoryEditor, used before this hook is called)
  currentProjectId: string | null;
  setCurrentProjectId: React.Dispatch<React.SetStateAction<string | null>>;
  currentProjectFilePath: string | null;
  setCurrentProjectFilePath: React.Dispatch<React.SetStateAction<string | null>>;
  projectIdToLoad: string | null;
  setProjectIdToLoad: React.Dispatch<React.SetStateAction<string | null>>;
  pendingHomeProjectId: string | null;
  setPendingHomeProjectId: React.Dispatch<React.SetStateAction<string | null>>;
  currentProjectPersisted: boolean;
  setCurrentProjectPersisted: React.Dispatch<React.SetStateAction<boolean>>;
  projectSummaries: Awaited<ReturnType<typeof localPersistenceService.listProjects>>;
  setProjectSummaries: React.Dispatch<React.SetStateAction<Awaited<ReturnType<typeof localPersistenceService.listProjects>>>>;
  exampleTemplates: ProjectExampleTemplate[];
  setExampleTemplates: React.Dispatch<React.SetStateAction<ProjectExampleTemplate[]>>;
  examplesLoading: boolean;
  setExamplesLoading: React.Dispatch<React.SetStateAction<boolean>>;
  examplesError: string | null;
  setExamplesError: React.Dispatch<React.SetStateAction<string | null>>;
  pendingProjectAction: PendingProjectAction | null;
  setPendingProjectAction: React.Dispatch<React.SetStateAction<PendingProjectAction | null>>;
  isProjectSnapshotSynced: boolean;
  setIsProjectSnapshotSynced: React.Dispatch<React.SetStateAction<boolean>>;
  isSavingProject: boolean;
  setIsSavingProject: React.Dispatch<React.SetStateAction<boolean>>;
  didHydrateLocalState: boolean;
  setDidHydrateLocalState: React.Dispatch<React.SetStateAction<boolean>>;

  showToast: (message: string, tone?: 'success' | 'error') => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useProjectManagement(params: UseProjectManagementParams) {
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    language,
    isMobile,
    editorProjectSettings,
    editorProjectSettingsSetters,
    savedAIProfiles,
    setSavedAIProfiles,
    activeTextProfileId,
    setActiveTextProfileId,
    activeImageProfileId,
    setActiveImageProfileId,
    activeBackgroundRemovalProfileId,
    setActiveBackgroundRemovalProfileId,
    activeVoiceProfileId,
    setActiveVoiceProfileId,
    getExportedAIProfiles,
    theme,
    setTheme,
    closeButtonBehavior,
    setCloseButtonBehavior,
    isDirty,
    setIsDirty,
    lastSavedSnapshot,
    setHistory,
    lastHistoryState,
    assistantTasks,
    activeAssistantTaskId,
    setAssistantTasks,
    setActiveAssistantTaskId,
    resetAssistantTasks,
    saveFileName,
    setSaveFileName,
    projectTitle,
    setProjectTitle,
    setShowSaveNameModal,
    setShowProjectHome,
    setProjectIdsPendingDeletion,
    setShowProjectSavePrompt,
    setShowAppClosePrompt,
    setProjectListLoading,
    setLastSavedTime,
    jsonInputRef,
    importModeRef,
    pendingInitialSnapshotSyncProjectIdRef,
    pendingInitialSnapshotCandidateRef,
    createCurrentProjectThumbnail,
    defaultProjectSaveDir,
    setDefaultProjectSaveDir,
    defaultEdgeOptions,

    currentProjectId,
    setCurrentProjectId,
    currentProjectFilePath,
    setCurrentProjectFilePath,
    projectIdToLoad,
    setProjectIdToLoad,
    pendingHomeProjectId,
    setPendingHomeProjectId,
    currentProjectPersisted,
    setCurrentProjectPersisted,
    projectSummaries,
    setProjectSummaries,
    exampleTemplates,
    setExampleTemplates,
    examplesLoading,
    setExamplesLoading,
    examplesError,
    setExamplesError,
    pendingProjectAction,
    setPendingProjectAction,
    isProjectSnapshotSynced,
    setIsProjectSnapshotSynced,
    isSavingProject,
    setIsSavingProject,
    didHydrateLocalState,
    setDidHydrateLocalState,

    showToast,
  } = params;

  // =========================================================================
  // Internal refs
  // =========================================================================
  const isSavingProjectRef = useRef(false);

  // =========================================================================
  // useProjectSerialization
  // =========================================================================
  const {
    getProjectSnapshot,
    applyProjectData,
    confirmExportJSON,
    importProjectFile,
    handleImportZIP,
  } = useProjectSerialization({
    nodes,
    edges,
    settings: editorProjectSettings,
    settingsSetters: editorProjectSettingsSetters,
    assistantTasks,
    activeAssistantTaskId,
    setAssistantTasks,
    setActiveAssistantTaskId,
    saveFileName,
    currentProjectId,
    currentProjectFilePath,
    defaultProjectSaveDir,
    setNodes,
    setEdges,
    setIsDirty,
    setShowSaveNameModal,
    lastSavedSnapshotRef: lastSavedSnapshot,
    showToast,
    getProjectThumbnailDataUrl: createCurrentProjectThumbnail,
    getExportedAIProfiles,
    onProjectFilePathSaved: async (filePath) => {
      setCurrentProjectFilePath(filePath);
      if (currentProjectId) {
        await localPersistenceService.saveProjectFilePath(currentProjectId, filePath);
      }
    },
    onImportedProject: async ({
      projectData,
      suggestedProjectName,
      replaceCurrentProject,
      zip,
      thumbnailDataUrl,
    }) => {
      const restoredProjectData = zip
        ? await createProjectSerializer({
            defaultEdgeOptions,
            defaultAIPrompts,
            defaultAIButtonsConfig,
          }).restoreImportedProject(projectData, zip)
        : projectData;
      const shouldReplaceCurrentProject =
        replaceCurrentProject && currentProjectId && importModeRef.current !== 'new';

      if (shouldReplaceCurrentProject) {
        await restoreProjectSession(currentProjectId, restoredProjectData, suggestedProjectName);
        importModeRef.current = 'replace';
        return true;
      }

      const nextProjectId = uuidv4();
      const normalizedName = suggestedProjectName.trim() || DEFAULT_PROJECT_FILE_NAME;
      await restoreProjectSession(nextProjectId, restoredProjectData, normalizedName);
      await localPersistenceService.saveLocalProject({
        id: nextProjectId,
        projectName: normalizedName,
        projectData: restoredProjectData,
        updatedAt: Date.now(),
        thumbnailDataUrl: thumbnailDataUrl ?? null,
      });
      importModeRef.current = 'replace';
      await refreshProjectSummaries();
      return true;
    },
    defaultEdgeOptions,
    defaultAIPrompts,
    defaultAIButtonsConfig,
  });

  // =========================================================================
  // refreshProjectSummaries
  // =========================================================================
  const refreshProjectSummaries = useCallback(async () => {
    const projects = await localPersistenceService.listProjects();
    setProjectSummaries(projects);
  }, []);

  // =========================================================================
  // loadExampleTemplates
  // =========================================================================
  const loadExampleTemplates = useCallback(async () => {
    if (isTauriRuntime()) return;

    setExamplesLoading(true);
    setExamplesError(null);
    try {
      const response = await fetch(EXAMPLES_MANIFEST_URL, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      setExampleTemplates(normalizeExampleTemplates(await response.json()));
    } catch (error) {
      console.warn('Failed to load example templates', error);
      setExampleTemplates([]);
      setExamplesError(
        language === 'zh'
          ? '没有读取到 examples/manifest.json。上传模板 ZIP 后，请同时上传模板清单。'
          : 'Could not load examples/manifest.json. Upload the template manifest with your ZIP files.',
      );
    } finally {
      setExamplesLoading(false);
    }
  }, [language]);

  // =========================================================================
  // handleApplySettingsToOtherProjects
  // =========================================================================
  const handleApplySettingsToOtherProjects = useCallback(
    async (targetProjectIds: string[]) => {
      try {
        const updatedCount = await localPersistenceService.applySettingsToOtherProjects(
          editorProjectSettings,
          currentProjectId,
          targetProjectIds,
        );
        await refreshProjectSummaries();

        showToast(
          language === 'zh'
            ? updatedCount > 0
              ? `已应用到 ${updatedCount} 个其他项目`
              : '没有可应用的其他项目'
            : updatedCount > 0
              ? `Applied to ${updatedCount} other project${updatedCount === 1 ? '' : 's'}`
              : 'No other projects to apply',
        );
      } catch (error) {
        console.error('Failed to apply settings to other projects:', error);
        showToast(
          language === 'zh' ? '应用到其他项目失败' : 'Failed to apply settings to other projects',
          'error',
        );
      }
    },
    [currentProjectId, editorProjectSettings, language, refreshProjectSummaries, showToast],
  );

  // =========================================================================
  // restoreProjectSession
  // =========================================================================
  const restoreProjectSession = useCallback(
    async (
      projectId: string,
      projectData: ProjectSnapshotData,
      projectName: string,
      options?: { fromHome?: boolean; updatedAt?: number },
    ) => {
      await applyProjectData(projectData, { markSaved: true });
      const projectFilePath = await localPersistenceService.getProjectFilePath(projectId);

      pendingInitialSnapshotSyncProjectIdRef.current = projectId;
      pendingInitialSnapshotCandidateRef.current = '';
      setIsProjectSnapshotSynced(false);
      setCurrentProjectId(projectId);
      setCurrentProjectFilePath(projectFilePath);
      setSaveFileName(projectName.trim() || DEFAULT_PROJECT_FILE_NAME);
      setProjectTitle(projectData.settings?.projectTitle?.trim() || '');
      setLastSavedTime(options?.updatedAt || null);
      setCurrentProjectPersisted(true);
      resetAssistantTasks(projectData.assistantTasks, projectData.activeAssistantTaskId || null);
      lastHistoryState.current = {
        nodes: projectData.nodes as Node[],
        edges: projectData.edges as Edge[],
      };
      setHistory({ past: [], future: [] });
      setShowProjectHome(false);
      await localPersistenceService.saveLastProjectId(projectId);
      if (options?.fromHome) {
        showToast(language === 'zh' ? '已打开本地项目' : 'Project opened');
      }
    },
    [applyProjectData, language, resetAssistantTasks, showToast, setHistory, lastHistoryState, setSaveFileName, setProjectTitle, setShowProjectHome, setLastSavedTime, pendingInitialSnapshotSyncProjectIdRef, pendingInitialSnapshotCandidateRef],
  );

  // =========================================================================
  // useAutoSave
  // =========================================================================
  const { autoSaveData, showAutoSaveModal, discardAutoSave, recoverAutoSave, clearAutoSave } =
    useAutoSave<ProjectSnapshotData>({
      projectId: currentProjectId,
      getProjectSnapshot,
      lastSavedSnapshotRef: lastSavedSnapshot,
      setIsDirty,
      applyRecoveredProject: async (projectData) => {
        await applyProjectData(projectData, { markSaved: false });
        lastHistoryState.current = {
          nodes: projectData.nodes as Node[],
          edges: projectData.edges as Edge[],
        };
        setHistory({ past: [], future: [] });
        setIsDirty(true);
      },
      showToast,
      language,
      enabled: Boolean(didHydrateLocalState && currentProjectId && isProjectSnapshotSynced),
    });

  // =========================================================================
  // resetEditorToBlankState
  // =========================================================================
  const resetEditorToBlankState = useCallback(() => {
    const blankNodes = INITIAL_NODES.map((node) => ({ ...node, data: { ...node.data } })) as Node[];
    const blankSnapshot = {
      nodes: blankNodes,
      edges: [] as Edge[],
      settings: {
        ...editorProjectSettings,
        projectTitle: '',
      },
      assistantTasks: undefined,
      activeAssistantTaskId: undefined,
    } as ProjectSnapshotData;

    setCurrentProjectId(null);
    setCurrentProjectFilePath(null);
    setProjectIdToLoad(null);
    setPendingHomeProjectId(null);
    setCurrentProjectPersisted(false);
    setSaveFileName(DEFAULT_PROJECT_FILE_NAME);
    setProjectTitle('');
    resetAssistantTasks(undefined, null);
    setNodes(blankNodes);
    setEdges([]);
    lastHistoryState.current = { nodes: blankNodes, edges: [] as Edge[] };
    setHistory({ past: [], future: [] });
    lastSavedSnapshot.current = stableStringify(blankSnapshot);
    setIsDirty(false);
    setIsProjectSnapshotSynced(true);
  }, [editorProjectSettings, resetAssistantTasks, setEdges, setNodes, setHistory, lastHistoryState, lastSavedSnapshot, setIsDirty, setSaveFileName, setProjectTitle]);

  // =========================================================================
  // saveCurrentProject
  // =========================================================================
  const saveCurrentProject = useCallback(async () => {
    if (isSavingProjectRef.current) return false;

    isSavingProjectRef.current = true;
    setIsSavingProject(true);

    try {
      const savedAt = Date.now();
      const projectId = currentProjectId ?? uuidv4();
      const snapshot = JSON.parse(getProjectSnapshot()) as ProjectSnapshotData;
      const persistedProjectName = getPersistedProjectName(projectTitle, saveFileName, savedAt);
      const persistedProjectTitle = projectTitle.trim() || persistedProjectName;

      snapshot.settings = {
        ...snapshot.settings,
        projectTitle: persistedProjectTitle,
      };

      const thumbnailDataUrl = await createCurrentProjectThumbnail();
      await localPersistenceService.saveLocalProject({
        id: projectId,
        projectName: persistedProjectName,
        projectData: snapshot,
        updatedAt: savedAt,
        thumbnailDataUrl,
      });

      setCurrentProjectId(projectId);
      setCurrentProjectPersisted(true);
      setSaveFileName(persistedProjectName);
      setProjectTitle(persistedProjectTitle);
      setLastSavedTime(savedAt);
      lastSavedSnapshot.current = stableStringify(snapshot);
      setIsDirty(false);
      setIsProjectSnapshotSynced(true);
      await clearAutoSave();
      await refreshProjectSummaries();
      showToast(language === 'zh' ? '项目已保存到本地' : 'Project saved locally');
      return true;
    } catch (error) {
      console.error('Failed to save project:', error);
      const message = error instanceof Error ? error.message : String(error);
      showToast(language === 'zh' ? `保存失败: ${message}` : `Save failed: ${message}`);
      return false;
    } finally {
      isSavingProjectRef.current = false;
      setIsSavingProject(false);
    }
  }, [
    currentProjectId,
    createCurrentProjectThumbnail,
    getProjectSnapshot,
    language,
    clearAutoSave,
    projectTitle,
    refreshProjectSummaries,
    saveFileName,
    showToast,
    setIsDirty,
    lastSavedSnapshot,
    setLastSavedTime,
    setSaveFileName,
    setProjectTitle,
  ]);

  // Save shortcut (Ctrl+S)
  React.useEffect(() => {
    const handleSaveShortcut = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const modifier = isMac ? event.metaKey : event.ctrlKey;
      if (!modifier || event.key.toLowerCase() !== 's' || event.altKey) return;

      event.preventDefault();
      event.stopPropagation();
      void saveCurrentProject();
    };

    document.addEventListener('keydown', handleSaveShortcut, true);
    return () => document.removeEventListener('keydown', handleSaveShortcut, true);
  }, [saveCurrentProject]);

  // =========================================================================
  // handleCreateProject
  // =========================================================================
  const handleCreateProject = useCallback(async () => {
    const projectId = uuidv4();
    const projectName = DEFAULT_PROJECT_FILE_NAME;
    const emptyProject = {
      nodes: INITIAL_NODES.map((node) => ({ ...node, data: { ...node.data } })) as Node[],
      edges: [] as Edge[],
      settings: {
        ...editorProjectSettings,
        projectTitle: '',
      },
      assistantTasks: undefined,
      activeAssistantTaskId: undefined,
    } as ProjectSnapshotData;

    await restoreProjectSession(projectId, emptyProject, projectName);
    lastSavedSnapshot.current = stableStringify(emptyProject);
    setCurrentProjectPersisted(false);
    setPendingHomeProjectId(null);
    setProjectIdToLoad(null);
  }, [editorProjectSettings, refreshProjectSummaries, restoreProjectSession, lastSavedSnapshot]);

  // =========================================================================
  // handleRenameProject
  // =========================================================================
  const handleRenameProject = useCallback(
    async (projectId: string, nextName: string) => {
      const normalizedName = nextName.trim();

      const persistedName = normalizedName || buildAutoProjectName();
      await localPersistenceService.renameProject(projectId, persistedName);
      if (projectId === currentProjectId) {
        setSaveFileName(persistedName);
        setProjectTitle(persistedName);
      }
      await refreshProjectSummaries();
    },
    [currentProjectId, refreshProjectSummaries, setSaveFileName, setProjectTitle],
  );

  // =========================================================================
  // handleDeleteProject / handleDeleteProjects
  // =========================================================================
  const handleDeleteProject = useCallback(
    async (projectId: string) => {
      await localPersistenceService.deleteProject(projectId);

      if (projectId === currentProjectId) {
        resetEditorToBlankState();
        setShowProjectHome(true);
      }

      await refreshProjectSummaries();
    },
    [currentProjectId, refreshProjectSummaries, resetEditorToBlankState, setShowProjectHome],
  );

  const handleDeleteProjects = useCallback(
    async (projectIds: string[]) => {
      const uniqueProjectIds = Array.from(new Set(projectIds));
      if (uniqueProjectIds.length === 0) return;

      await Promise.all(
        uniqueProjectIds.map((projectId) => localPersistenceService.deleteProject(projectId)),
      );

      if (currentProjectId && uniqueProjectIds.includes(currentProjectId)) {
        resetEditorToBlankState();
        setShowProjectHome(true);
      }

      await refreshProjectSummaries();
    },
    [currentProjectId, refreshProjectSummaries, resetEditorToBlankState, setShowProjectHome],
  );

  // =========================================================================
  // performPendingProjectAction
  // =========================================================================
  const performPendingProjectAction = useCallback(
    async (action: PendingProjectAction | null) => {
      if (!action) return;

      if (action.type === 'create') {
        await handleCreateProject();
        return;
      }

      if (action.type === 'open') {
        setPendingHomeProjectId(action.projectId);
        setProjectIdToLoad(action.projectId);
        return;
      }

      if (action.type === 'import-new') {
        importModeRef.current = 'new';
        jsonInputRef.current?.click();
        return;
      }

      if (action.type === 'import-example') {
        try {
          importModeRef.current = 'new';
          const response = await fetch(action.template.file, { cache: 'no-store' });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const blob = await response.blob();
          const fileName =
            action.template.file.split('/').pop()?.split('?')[0] || `${action.template.id}.zip`;
          await importProjectFile(
            new File([blob], fileName, { type: blob.type || 'application/zip' }),
          );
        } catch (error) {
          console.error('Failed to import example template', error);
          showToast(
            language === 'zh' ? '模板导入失败，请检查 examples 文件。' : 'Template import failed.',
            'error',
          );
        }
        return;
      }

      if (action.type === 'close-window') {
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          await getCurrentWindow().destroy();
          return;
        } catch (error) {
          console.warn('Failed to close Tauri window, falling back to browser close', error);
        }

        window.close();
      }
    },
    [handleCreateProject, importProjectFile, language, showToast, importModeRef, jsonInputRef],
  );

  // =========================================================================
  // requestProjectAction & confirm/discard/cancel
  // =========================================================================
  const requestProjectAction = useCallback(
    (action: PendingProjectAction) => {
      if (!isDirty) {
        void performPendingProjectAction(action);
        return;
      }

      setPendingProjectAction(action);
      setShowProjectSavePrompt(true);
    },
    [isDirty, performPendingProjectAction, setShowProjectSavePrompt],
  );

  const handleConfirmSaveCurrentProject = useCallback(async () => {
    const action = pendingProjectAction;
    setShowProjectSavePrompt(false);
    setPendingProjectAction(null);
    const didSave = await saveCurrentProject();
    if (!didSave) return;
    await performPendingProjectAction(action);
  }, [pendingProjectAction, performPendingProjectAction, saveCurrentProject, setShowProjectSavePrompt]);

  const handleDiscardCurrentProjectChanges = useCallback(async () => {
    const action = pendingProjectAction;
    setShowProjectSavePrompt(false);
    setPendingProjectAction(null);
    await clearAutoSave();

    if (currentProjectId && currentProjectPersisted) {
      const savedProject = await localPersistenceService.loadProject(currentProjectId);
      if (savedProject) {
        await restoreProjectSession(
          savedProject.id,
          savedProject.projectData,
          savedProject.projectName,
          { updatedAt: savedProject.updatedAt },
        );
      } else {
        resetEditorToBlankState();
      }
    } else {
      resetEditorToBlankState();
    }

    await performPendingProjectAction(action);
  }, [
    clearAutoSave,
    currentProjectId,
    currentProjectPersisted,
    pendingProjectAction,
    performPendingProjectAction,
    resetEditorToBlankState,
    restoreProjectSession,
    setShowProjectSavePrompt,
  ]);

  const handleCancelProjectAction = useCallback(() => {
    setShowProjectSavePrompt(false);
    setPendingProjectAction(null);
  }, [setShowProjectSavePrompt]);

  // =========================================================================
  // App close handlers
  // =========================================================================
  React.useEffect(() => {
    if (!isTauriRuntime()) return;

    let unlistenCloseRequest: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        if (cancelled) return;
        unlistenCloseRequest = await listen('galwriter-close-requested', () => {
          if (isDirty) {
            requestProjectAction({ type: 'close-window' });
            return;
          }

          setShowAppClosePrompt(true);
        });
      } catch (error) {
        console.error('Failed to listen for app close requests:', error);
      }
    })();

    return () => {
      cancelled = true;
      void unlistenCloseRequest?.();
    };
  }, [isDirty, requestProjectAction, setShowAppClosePrompt]);

  React.useEffect(() => {
    if (isTauriRuntime()) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const handleConfirmAppClose = useCallback(() => {
    setShowAppClosePrompt(false);
    void performPendingProjectAction({ type: 'close-window' });
  }, [performPendingProjectAction, setShowAppClosePrompt]);

  const handleCancelAppClose = useCallback(() => {
    setShowAppClosePrompt(false);
  }, [setShowAppClosePrompt]);

  // =========================================================================
  // Export
  // =========================================================================
  const handleExportProjectFromList = useCallback(
    async (projectId: string) => {
      try {
        const project = await localPersistenceService.loadProject(projectId);
        if (!project) {
          showToast(language === 'zh' ? '找不到要导出的项目' : 'Project not found for export');
          return;
        }
        const serializer = createProjectSerializer({
          defaultEdgeOptions,
          defaultAIPrompts,
          defaultAIButtonsConfig,
        });
        const filePath = await localPersistenceService.getProjectFilePath(projectId);
        const result = await serializer.exportZip({
          projectData: project.projectData,
          fileName: project.projectName,
          filePath,
          thumbnailDataUrl:
            project.thumbnailDataUrl ??
            createProjectThumbnail(
              project.projectData.nodes as Node[],
              project.projectData.edges as Edge[],
              project.projectData.settings?.canvasBg,
              {
                showTitles: project.projectData.settings?.showTitles,
                storyTitlePlacement: project.projectData.settings?.storyTitlePlacement,
              },
            ),
          defaultSaveDir: defaultProjectSaveDir,
        });
        if (result.canceled) return;
        if (result.filePath) {
          await localPersistenceService.saveProjectFilePath(projectId, result.filePath);
          if (projectId === currentProjectId) {
            setCurrentProjectFilePath(result.filePath);
          }
        }
        window.setTimeout(() => {
          const savedLocation = result.filePath
            ? result.filePath
            : language === 'zh'
              ? '浏览器下载文件夹'
              : 'your browser downloads folder';
          showToast(
            language === 'zh'
              ? `ZIP 备份已导出到：${savedLocation}`
              : `ZIP backup exported to: ${savedLocation}`,
          );
        }, 0);
        showToast(language === 'zh' ? '项目导出成功' : 'Project exported successfully');
      } catch (e) {
        console.error(e);
        showToast(language === 'zh' ? '导出失败' : 'Export failed');
      }
    },
    [currentProjectId, defaultProjectSaveDir, language, showToast],
  );

  const handleExportProjectsBundleFromList = useCallback(
    async (projectIds: string[]) => {
      try {
        const serializer = createProjectSerializer({
          defaultEdgeOptions,
          defaultAIPrompts,
          defaultAIButtonsConfig,
        });
        const projects = (
          await Promise.all(
            projectIds.map(async (projectId) => {
              const project = await localPersistenceService.loadProject(projectId);
              if (!project) return null;
              return {
                projectData: project.projectData,
                projectName: project.projectName,
                thumbnailDataUrl:
                  project.thumbnailDataUrl ??
                  createProjectThumbnail(
                    project.projectData.nodes as Node[],
                    project.projectData.edges as Edge[],
                    project.projectData.settings?.canvasBg,
                    {
                      showTitles: project.projectData.settings?.showTitles,
                      storyTitlePlacement: project.projectData.settings?.storyTitlePlacement,
                    },
                  ),
              };
            }),
          )
        ).filter((project): project is NonNullable<typeof project> => Boolean(project));

        if (projects.length === 0) {
          showToast(language === 'zh' ? '找不到要导出的项目' : 'Projects not found for export');
          return;
        }

        const result = await serializer.exportProjectBundle({
          projects,
          fileName: `GalWriter项目整合包-${new Date().toISOString().slice(0, 10)}.zip`,
          defaultSaveDir: defaultProjectSaveDir,
        });
        if (result.canceled) return;
        window.setTimeout(() => {
          const savedLocation = result.filePath
            ? result.filePath
            : language === 'zh'
              ? '浏览器下载文件夹'
              : 'your browser downloads folder';
          showToast(
            language === 'zh'
              ? `ZIP 整合包已导出到：${savedLocation}`
              : `ZIP bundle exported to: ${savedLocation}`,
          );
        }, 0);
        showToast(
          language === 'zh' ? '项目整合包导出成功' : 'Project bundle exported successfully',
        );
      } catch (e) {
        console.error(e);
        showToast(language === 'zh' ? '整合包导出失败' : 'Bundle export failed');
      }
    },
    [defaultProjectSaveDir, language, showToast],
  );

  // =========================================================================
  // Home actions
  // =========================================================================
  const handleOpenProject = useCallback(
    async (projectId: string) => {
      requestProjectAction({ type: 'open', projectId });
    },
    [requestProjectAction],
  );

  const handleImportProjectFromHome = useCallback(() => {
    requestProjectAction({ type: 'import-new' });
  }, [requestProjectAction]);

  const handleImportExampleTemplate = useCallback(
    (template: ProjectExampleTemplate) => {
      requestProjectAction({ type: 'import-example', template });
    },
    [requestProjectAction],
  );

  const handleDownloadExampleTemplate = useCallback((template: ProjectExampleTemplate) => {
    const link = document.createElement('a');
    link.href = template.file;
    link.download = template.file.split('/').pop()?.split('?')[0] || `${template.id}.zip`;
    link.rel = 'noopener';
    link.click();
  }, []);

  const openImportPicker = useCallback(() => {
    importModeRef.current = 'replace';
    jsonInputRef.current?.click();
  }, [importModeRef, jsonInputRef]);

  const handleChooseDefaultProjectSaveLocation = useCallback(async () => {
    if (!isTauriRuntime()) {
      showToast(
        language === 'zh'
          ? '默认保存位置仅在桌面端可设置'
          : 'Default save location can only be set in the app',
        'error',
      );
      return;
    }

    try {
      const invoke = await getTauriInvoke();
      const result = (await invoke('choose_project_default_save_dir', {
        initialDir: defaultProjectSaveDir,
      })) as { path?: string | null } | undefined;

      if (!result?.path) return;
      setDefaultProjectSaveDir(result.path);
      await localPersistenceService.saveDefaultProjectSaveDir(result.path);
      showToast(language === 'zh' ? '默认保存位置已更新' : 'Default save location updated');
    } catch (error) {
      console.error('Failed to choose default project save location:', error);
      showToast(language === 'zh' ? '设置默认保存位置失败' : 'Failed to set default save location');
    }
  }, [defaultProjectSaveDir, language, showToast, setDefaultProjectSaveDir]);

  // =========================================================================
  // Hydration effect
  // =========================================================================
  React.useEffect(() => {
    let cancelled = false;

    const hydrateLocalState = async () => {
      try {
        const [appSettings, savedProfilesState, projects] = await Promise.all([
          localPersistenceService.loadAppSettings(),
          localPersistenceService.loadAIProfiles(),
          localPersistenceService.listProjects(),
        ]);

        if (cancelled) return;
        setProjectSummaries(projects);
        setProjectListLoading(false);
        setShowProjectHome(!isMobile && projects.length > 0);
        setDefaultProjectSaveDir(appSettings.defaultProjectSaveDir || null);
        if (!isTauriRuntime()) {
          void loadExampleTemplates();
        }

        setSavedAIProfiles(savedProfilesState.profiles);
        const savedTextProfileId = savedProfilesState.activeTextProfileId;
        const shouldUseHostedProxyByDefault = !isTauriRuntime() && !import.meta.env.DEV;
        setActiveTextProfileId(
          shouldUseHostedProxyByDefault ? HOSTED_PROXY_PROFILE_ID : savedTextProfileId,
        );
        setActiveImageProfileId(
          shouldUseHostedProxyByDefault
            ? HOSTED_IMAGE_PROXY_PROFILE_ID
            : savedProfilesState.activeImageProfileId,
        );
        setActiveBackgroundRemovalProfileId(
          savedProfilesState.activeBackgroundRemovalProfileId ?? null,
        );
        setActiveVoiceProfileId(
          shouldUseHostedProxyByDefault
            ? HOSTED_VOICE_PROXY_PROFILE_ID
            : savedProfilesState.activeVoiceProfileId,
        );

        setTheme(appSettings.theme ?? 'system');
        setCloseButtonBehavior(appSettings.closeButtonBehavior);
        void syncCloseButtonBehavior(appSettings.closeButtonBehavior);
      } catch (error) {
        console.error('Failed to hydrate local editor state', error);
      } finally {
        if (!cancelled) {
          setDidHydrateLocalState(true);
        }
      }
    };

    void hydrateLocalState();

    return () => {
      cancelled = true;
    };
  }, [loadExampleTemplates, isMobile, setShowProjectHome, setDefaultProjectSaveDir, setSavedAIProfiles, setActiveTextProfileId, setActiveImageProfileId, setActiveBackgroundRemovalProfileId, setActiveVoiceProfileId, setTheme, setCloseButtonBehavior, setProjectListLoading]);

  // =========================================================================
  // Project loading effect
  // =========================================================================
  React.useEffect(() => {
    if (!didHydrateLocalState || !projectIdToLoad) return;

    let cancelled = false;

    const loadSelectedProject = async () => {
      const project = await localPersistenceService.loadProject(projectIdToLoad);
      if (!project || cancelled) return;

      await restoreProjectSession(project.id, project.projectData, project.projectName, {
        fromHome: pendingHomeProjectId === project.id,
        updatedAt: project.updatedAt,
      });
      if (!cancelled) {
        setPendingHomeProjectId(null);
        setProjectIdToLoad(null);
        await refreshProjectSummaries();
      }
    };

    void loadSelectedProject();

    return () => {
      cancelled = true;
    };
  }, [
    didHydrateLocalState,
    pendingHomeProjectId,
    projectIdToLoad,
    refreshProjectSummaries,
    restoreProjectSession,
  ]);

  // =========================================================================
  // Snapshot sync effect
  // =========================================================================
  React.useEffect(() => {
    if (!currentProjectId) {
      pendingInitialSnapshotSyncProjectIdRef.current = null;
      pendingInitialSnapshotCandidateRef.current = '';
      setIsDirty(false);
      setIsProjectSnapshotSynced(true);
      return;
    }

    const currentSnapshot = getProjectSnapshot();
    const savedSnapshot = lastSavedSnapshot.current;
    if (pendingInitialSnapshotSyncProjectIdRef.current === currentProjectId) {
      if (pendingInitialSnapshotCandidateRef.current === currentSnapshot) {
        lastSavedSnapshot.current = currentSnapshot;
        pendingInitialSnapshotSyncProjectIdRef.current = null;
        pendingInitialSnapshotCandidateRef.current = '';
        setIsProjectSnapshotSynced(true);
      } else {
        pendingInitialSnapshotCandidateRef.current = currentSnapshot;
        setIsProjectSnapshotSynced(false);
      }
      setIsDirty(false);
      return;
    }

    setIsProjectSnapshotSynced(true);
    setIsDirty(currentSnapshot !== savedSnapshot);
  }, [currentProjectId, getProjectSnapshot, setIsDirty, lastSavedSnapshot, pendingInitialSnapshotSyncProjectIdRef, pendingInitialSnapshotCandidateRef]);

  // =========================================================================
  // Return
  // =========================================================================
  return {
    // Serialization
    getProjectSnapshot,
    applyProjectData,
    confirmExportJSON,
    importProjectFile,
    handleImportZIP,

    // Auto-save
    autoSaveData,
    showAutoSaveModal,
    discardAutoSave,
    recoverAutoSave,
    clearAutoSave,

    // Project management
    refreshProjectSummaries,
    loadExampleTemplates,
    handleApplySettingsToOtherProjects,
    restoreProjectSession,
    resetEditorToBlankState,
    saveCurrentProject,
    handleCreateProject,
    handleRenameProject,
    handleDeleteProject,
    handleDeleteProjects,
    performPendingProjectAction,
    requestProjectAction,
    handleConfirmSaveCurrentProject,
    handleDiscardCurrentProjectChanges,
    handleCancelProjectAction,
    handleConfirmAppClose,
    handleCancelAppClose,
    handleExportProjectFromList,
    handleExportProjectsBundleFromList,
    handleOpenProject,
    handleImportProjectFromHome,
    handleImportExampleTemplate,
    handleDownloadExampleTemplate,
    openImportPicker,
    handleChooseDefaultProjectSaveLocation,

    // State
    currentProjectId,
    setCurrentProjectId,
    currentProjectFilePath,
    projectIdToLoad,
    setProjectIdToLoad,
    pendingHomeProjectId,
    setPendingHomeProjectId,
    currentProjectPersisted,
    projectSummaries,
    exampleTemplates,
    examplesLoading,
    examplesError,
    pendingProjectAction,
    isProjectSnapshotSynced,
    isSavingProject,
    didHydrateLocalState,
  };
}
