type TauriWindow = Window & {
  __TAURI__?: unknown;
  __TAURI_INTERNALS__?: unknown;
};

export const isTauriRuntime = () => {
  if (typeof window === 'undefined') return false;

  const runtimeWindow = window as TauriWindow;
  return Boolean(runtimeWindow.__TAURI__ || runtimeWindow.__TAURI_INTERNALS__);
};

export const getTauriInvoke = async () => {
  const tauriCore = await import('@tauri-apps/api/core');
  return (
    tauriCore.invoke ||
    (tauriCore as any).default?.invoke ||
    (window as any).__TAURI__?.core?.invoke
  );
};
