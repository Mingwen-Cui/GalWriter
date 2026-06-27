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
  const globalInvoke = (window as any).__TAURI__?.core?.invoke;
  if (typeof globalInvoke === 'function') return globalInvoke;

  try {
    const tauriCore = await import('@tauri-apps/api/core');
    const moduleInvoke = tauriCore?.invoke;
    const defaultInvoke = (tauriCore as any)?.default?.invoke;
    if (typeof moduleInvoke === 'function') return moduleInvoke;
    if (typeof defaultInvoke === 'function') return defaultInvoke;
  } catch {
    // Running outside Tauri, for example in the browser preview.
  }

  return null;
};
