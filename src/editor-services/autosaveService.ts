import {
  clearAutoSave,
  clearNamedAutoSave,
  getAutoSave,
  getNamedAutoSave,
  saveAutoSave,
  saveNamedAutoSave,
} from '../lib/db';

export interface AutoSaveRecord {
  snapshot: string;
  timestamp: number;
}

export const autosaveService = {
  save(snapshot: string) {
    return saveAutoSave(snapshot);
  },
  saveForProject(projectId: string, snapshot: string) {
    return saveNamedAutoSave(projectId, snapshot);
  },
  load(): Promise<AutoSaveRecord | null> {
    return getAutoSave();
  },
  loadForProject(projectId: string): Promise<AutoSaveRecord | null> {
    return getNamedAutoSave(projectId);
  },
  clear() {
    return clearAutoSave();
  },
  clearForProject(projectId: string) {
    return clearNamedAutoSave(projectId);
  },
};
