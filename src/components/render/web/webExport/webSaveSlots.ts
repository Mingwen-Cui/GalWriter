export type WebSaveSlot = {
  id: string;
  createdAt: number;
  savedAt: number;
  currentId: string;
  history: string[];
  settings: {
    autoAdvance: boolean;
    typewriterSpeed: number;
  };
  controlsHidden: boolean;
  playedAudios: string[];
};

export type WebSaveCollection = {
  version: 2;
  activeSlotId: string | null;
  slots: WebSaveSlot[];
};

type LegacyWebSave = Omit<WebSaveSlot, 'id' | 'createdAt'> & Partial<Pick<WebSaveSlot, 'id' | 'createdAt'>> & {
  version?: number;
  title?: string;
};

export const webSaveCollectionVersion = 2 as const;

const isPlayableSave = (value: unknown, nodeIds?: ReadonlySet<string>): value is LegacyWebSave => {
  if (!value || typeof value !== 'object') return false;
  const save = value as Partial<LegacyWebSave>;
  return (
    typeof save.currentId === 'string' &&
    (save.currentId === 'THE_END' || !nodeIds || nodeIds.has(save.currentId))
  );
};

const normalizeSlot = (value: LegacyWebSave, nodeIds?: ReadonlySet<string>): WebSaveSlot | null => {
  if (!isPlayableSave(value, nodeIds)) return null;
  const now = Date.now();
  return {
    id: typeof value.id === 'string' && value.id ? value.id : `save-${now}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Number.isFinite(Number(value.createdAt)) ? Number(value.createdAt) : Number(value.savedAt) || now,
    savedAt: Number.isFinite(Number(value.savedAt)) ? Number(value.savedAt) : now,
    currentId: value.currentId,
    history: Array.isArray(value.history)
      ? value.history.filter((id): id is string => typeof id === 'string' && (!nodeIds || nodeIds.has(id)))
      : [],
    settings: {
      autoAdvance: Boolean(value.settings?.autoAdvance),
      typewriterSpeed: Number.isFinite(Number(value.settings?.typewriterSpeed))
        ? Math.max(0, Number(value.settings?.typewriterSpeed))
        : 65,
    },
    controlsHidden: Boolean(value.controlsHidden),
    playedAudios: Array.isArray(value.playedAudios)
      ? value.playedAudios.filter((item): item is string => typeof item === 'string')
      : [],
  };
};

export const parseWebSaveCollection = (
  raw: string | null,
  nodeIds?: ReadonlySet<string>,
): WebSaveCollection | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const candidate = parsed as Partial<WebSaveCollection>;
    if (Array.isArray(candidate.slots)) {
      const slots = candidate.slots
        .map((slot) => normalizeSlot(slot, nodeIds))
        .filter((slot): slot is WebSaveSlot => Boolean(slot));
      return {
        version: webSaveCollectionVersion,
        activeSlotId: slots.some((slot) => slot.id === candidate.activeSlotId)
          ? candidate.activeSlotId || null
          : slots[0]?.id || null,
        slots,
      };
    }
    const legacy = normalizeSlot(parsed as LegacyWebSave, nodeIds);
    return legacy
      ? { version: webSaveCollectionVersion, activeSlotId: legacy.id, slots: [legacy] }
      : null;
  } catch {
    return null;
  }
};

export const getActiveWebSaveSlot = (collection: WebSaveCollection | null) =>
  collection?.slots.find((slot) => slot.id === collection.activeSlotId) || null;

export const upsertWebSaveSlot = (
  collection: WebSaveCollection | null,
  slot: WebSaveSlot,
): WebSaveCollection => {
  const slots = collection?.slots || [];
  const nextSlots = [slot, ...slots.filter((item) => item.id !== slot.id)]
    .sort((left, right) => right.savedAt - left.savedAt);
  return { version: webSaveCollectionVersion, activeSlotId: slot.id, slots: nextSlots };
};

export const removeWebSaveSlot = (collection: WebSaveCollection, slotId: string): WebSaveCollection => {
  const slots = collection.slots.filter((slot) => slot.id !== slotId);
  return {
    version: webSaveCollectionVersion,
    activeSlotId: collection.activeSlotId === slotId ? slots[0]?.id || null : collection.activeSlotId,
    slots,
  };
};

export const getWebSaveStorageKey = (projectTitle: string) =>
  `galwriter-web-saves:${encodeURIComponent(projectTitle || 'GalWriter')}`;

export const readWebSaveCollection = (projectTitle: string, nodeIds?: ReadonlySet<string>) => {
  if (typeof window === 'undefined') return null;
  const key = getWebSaveStorageKey(projectTitle);
  const legacyKey = `galwriter-web-save:${encodeURIComponent(projectTitle || 'GalWriter')}`;
  try {
    return parseWebSaveCollection(window.localStorage.getItem(key) || window.localStorage.getItem(legacyKey), nodeIds);
  } catch {
    return null;
  }
};

export const writeWebSaveCollection = (projectTitle: string, collection: WebSaveCollection) => {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(getWebSaveStorageKey(projectTitle), JSON.stringify(collection));
    return true;
  } catch {
    return false;
  }
};
