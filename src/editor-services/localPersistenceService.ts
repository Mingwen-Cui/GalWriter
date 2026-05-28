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

  renameProject(projectId: string, projectName: string) {
    return renameLocalProject(projectId, projectName);
  },

  deleteProject(projectId: string) {
    return deleteLocalProject(projectId);
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
};
