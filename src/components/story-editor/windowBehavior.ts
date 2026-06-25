import { getTauriInvoke, isTauriRuntime } from '../../lib/tauriRuntime';

type CloseButtonBehavior = 'minimize' | 'quit';

export const syncCloseButtonBehavior = async (behavior: CloseButtonBehavior) => {
  try {
    if (!isTauriRuntime()) return;

    const invoke = await getTauriInvoke();
    await invoke('set_close_button_minimizes', {
      minimizeOnClose: behavior === 'minimize',
    });
  } catch (error) {
    if (isTauriRuntime()) {
      console.error('Failed to sync close button behavior:', error);
    }
  }
};
