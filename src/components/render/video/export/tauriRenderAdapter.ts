import type {
  RenderOutputDirectoryResult,
  RenderSaveResult,
  SaveRenderedVideoInput,
  SaveRenderedWebZipInput,
} from './renderExportTypes';

type TauriInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

const loadInvoke = async (): Promise<TauriInvoke> => {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke as TauriInvoke;
};

export const chooseRenderOutputDir = async (initialDir: string) => {
  const invoke = await loadInvoke();
  return invoke<RenderOutputDirectoryResult>('choose_render_output_dir', { initialDir });
};

export const getDefaultRenderDir = async () => {
  const invoke = await loadInvoke();
  return invoke<RenderSaveResult>('default_render_dir');
};

export const saveRenderedVideo = async (input: SaveRenderedVideoInput) => {
  const invoke = await loadInvoke();
  return invoke<RenderSaveResult>('save_rendered_video', input);
};

export const saveRenderedWebZip = async (input: SaveRenderedWebZipInput) => {
  const invoke = await loadInvoke();
  return invoke<RenderSaveResult>('save_rendered_web_zip', input);
};
