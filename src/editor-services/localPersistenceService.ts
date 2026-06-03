import type {
  ApiKeySettings,
  ProjectSettings,
  SavedAIProfile,
  StoryProject,
} from '../domain/project';
import {
  deleteLocalProject,
  getAIProfiles,
  getApiSettings,
  getAppSettings,
  getLocalProject,
  listLocalProjects,
  renameLocalProject,
  getMostRecentLocalProject,
  saveApiSettings,
  saveAIProfiles,
  saveAppSettings,
  saveLocalProject,
  type LocalAIProfilesState,
  type LocalProjectSummary,
  type LocalApiKeySettings,
} from '../lib/db';

export interface LocalProjectSnapshot {
  id: string;
  projectName: string;
  projectData: StoryProject;
  updatedAt: number;
  thumbnailDataUrl?: string | null;
}

export interface LocalEditorSecrets extends ApiKeySettings {
  aiProvider: ProjectSettings['aiProvider'];
  imageApiUrl: string;
  imageModel: string;
  imageSize: string;
  ttsApiUrl: string;
  ttsModel: string;
  ttsVoice: string;
  ttsProvider: ProjectSettings['ttsProvider'];
  thinkingMode: boolean;
}

export interface LocalAIProfilesSnapshot extends LocalAIProfilesState {}

export interface ResumeState {
  project: LocalProjectSnapshot | null;
  theme: 'light' | 'dark' | null;
}

const toProjectRecord = (snapshot: LocalProjectSnapshot) => ({
  id: snapshot.id,
  projectName: snapshot.projectName,
  snapshot: snapshot.projectData,
  updatedAt: snapshot.updatedAt,
  thumbnailDataUrl: snapshot.thumbnailDataUrl ?? null,
});

const toProjectSnapshot = (
  record: Awaited<ReturnType<typeof getLocalProject>>,
): LocalProjectSnapshot | null => {
  if (!record) return null;
  return {
    id: record.id,
    projectName: record.projectName,
    projectData: record.snapshot,
    updatedAt: record.updatedAt,
    thumbnailDataUrl: record.thumbnailDataUrl ?? null,
  };
};

export const localPersistenceService = {
  async saveEditorSecrets(settings: LocalEditorSecrets) {
    await saveApiSettings(settings satisfies LocalApiKeySettings);
  },

  loadEditorSecrets() {
    return getApiSettings();
  },

  loadAppSettings() {
    return getAppSettings();
  },

  saveAIProfiles(state: LocalAIProfilesSnapshot) {
    return saveAIProfiles(state);
  },

  loadAIProfiles() {
    return getAIProfiles();
  },

  listProjects(): Promise<LocalProjectSummary[]> {
    return listLocalProjects();
  },

  async loadProject(projectId: string): Promise<LocalProjectSnapshot | null> {
    return toProjectSnapshot(await getLocalProject(projectId));
  },

  async saveTheme(theme: 'light' | 'dark') {
    await saveAppSettings({ theme });
  },

  async saveCloseButtonBehavior(closeButtonBehavior: 'minimize' | 'quit') {
    await saveAppSettings({ closeButtonBehavior });
  },

  async getProjectFilePath(projectId: string): Promise<string | null> {
    const appSettings = await getAppSettings();
    return appSettings.projectFilePaths[projectId] || null;
  },

  async saveProjectFilePath(projectId: string, filePath: string) {
    const appSettings = await getAppSettings();
    await saveAppSettings({
      projectFilePaths: {
        ...appSettings.projectFilePaths,
        [projectId]: filePath,
      },
    });
  },

  async getDefaultProjectSaveDir(): Promise<string | null> {
    const appSettings = await getAppSettings();
    return appSettings.defaultProjectSaveDir || null;
  },

  async saveDefaultProjectSaveDir(defaultProjectSaveDir: string | null) {
    await saveAppSettings({ defaultProjectSaveDir });
  },

  renameProject(projectId: string, projectName: string) {
    return renameLocalProject(projectId, projectName);
  },

  async deleteProject(projectId: string) {
    await deleteLocalProject(projectId);
    const appSettings = await getAppSettings();
    const { [projectId]: _deletedPath, ...projectFilePaths } = appSettings.projectFilePaths;
    await saveAppSettings({ projectFilePaths });
  },

  async saveLastProjectId(projectId: string) {
    await saveAppSettings({ lastProjectId: projectId });
  },

  async loadResumeState(): Promise<ResumeState> {
    const appSettings = await getAppSettings();
    const exactProject = appSettings.lastProjectId
      ? await getLocalProject(appSettings.lastProjectId)
      : null;
    const fallbackProject = exactProject ? null : await getMostRecentLocalProject();

    return {
      theme: appSettings.theme,
      project: toProjectSnapshot(exactProject ?? fallbackProject),
    };
  },

  async saveLocalProject(snapshot: LocalProjectSnapshot) {
    await Promise.all([
      saveLocalProject(toProjectRecord(snapshot)),
      saveAppSettings({ lastProjectId: snapshot.id }),
    ]);
  },

  async applySettingsToOtherProjects(
    settings: ProjectSettings,
    currentProjectId: string | null,
    targetProjectIds?: string[],
  ) {
    const projects = await listLocalProjects();
    const targetIdSet = targetProjectIds ? new Set(targetProjectIds) : null;
    const targetProjects = projects.filter(
      (project) => project.id !== currentProjectId && (!targetIdSet || targetIdSet.has(project.id)),
    );

    const results = await Promise.all(
      targetProjects.map(async (project) => {
        const snapshot = toProjectSnapshot(await getLocalProject(project.id));
        if (!snapshot) return false;

        await saveLocalProject(
          toProjectRecord({
            ...snapshot,
            projectData: {
              ...snapshot.projectData,
              settings: {
                ...settings,
                projectTitle: snapshot.projectData.settings.projectTitle,
              },
            },
            updatedAt: Date.now(),
          }),
        );
        return true;
      }),
    );

    return results.filter(Boolean).length;
  },
};
