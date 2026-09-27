import { useSyncExternalStore } from 'react';

export type ShortcutAction = 'copy' | 'paste' | 'cut' | 'undo' | 'redo' | 'delete' | 'selectAll' | 'duplicate' | 'save';
export type ShortcutMap = Record<ShortcutAction, string>;
export type KeyboardMouseSettings = { selectionButton: 'left' | 'right'; shortcuts: ShortcutMap };

export const DEFAULT_SHORTCUTS: ShortcutMap = {
  copy: 'Ctrl+C', paste: 'Ctrl+V', cut: 'Ctrl+X', undo: 'Ctrl+Z', redo: 'Ctrl+Y',
  delete: 'Delete', selectAll: 'Ctrl+A', duplicate: 'Ctrl+D', save: 'Ctrl+S',
};
export const DEFAULT_KEYBOARD_MOUSE_SETTINGS: KeyboardMouseSettings = {
  selectionButton: 'left', shortcuts: DEFAULT_SHORTCUTS,
};

const STORAGE_KEY = 'galwriter.keyboardMouseSettings.v1';
const CHANGE_EVENT = 'galwriter-keyboard-mouse-settings-change';
let cached: KeyboardMouseSettings = DEFAULT_KEYBOARD_MOUSE_SETTINGS;
let initialized = false;

function load(): KeyboardMouseSettings {
  if (typeof window === 'undefined') return DEFAULT_KEYBOARD_MOUSE_SETTINGS;
  if (!initialized) {
    initialized = true;
    try {
      const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null') as Partial<KeyboardMouseSettings> | null;
      cached = {
        selectionButton: parsed?.selectionButton === 'right' ? 'right' : 'left',
        shortcuts: { ...DEFAULT_SHORTCUTS, ...(parsed?.shortcuts || {}) },
      };
    } catch { cached = DEFAULT_KEYBOARD_MOUSE_SETTINGS; }
  }
  return cached;
}

export function getKeyboardMouseSettings() { return load(); }

export function updateKeyboardMouseSettings(patch: Partial<KeyboardMouseSettings>) {
  const current = load();
  cached = { ...current, ...patch, shortcuts: { ...current.shortcuts, ...(patch.shortcuts || {}) } };
  initialized = true;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cached)); } catch { /* Keep the in-memory preference for this session. */ }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useKeyboardMouseSettings() {
  return useSyncExternalStore(
    (listener) => {
      window.addEventListener(CHANGE_EVENT, listener);
      window.addEventListener('storage', listener);
      return () => { window.removeEventListener(CHANGE_EVENT, listener); window.removeEventListener('storage', listener); };
    },
    load,
    () => DEFAULT_KEYBOARD_MOUSE_SETTINGS,
  );
}

