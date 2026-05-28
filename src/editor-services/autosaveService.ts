import { clearAutoSave, getAutoSave, saveAutoSave } from '../lib/db';

export interface AutoSaveRecord {
  snapshot: string;
  timestamp: number;
}

export const autosaveService = {
  save(snapshot: string) {
    return saveAutoSave(snapshot);
  },
  load(): Promise<AutoSaveRecord | null> {
    return getAutoSave();
  },
  clear() {
    return clearAutoSave();
  },
};
