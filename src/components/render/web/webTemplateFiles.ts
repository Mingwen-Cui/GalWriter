import JSZip from 'jszip';
import type { RenderStyle, WebExportSettings } from '../video/shared/types';

export type WebTemplateSnapshot = {
  settings: Partial<WebExportSettings>;
  renderStyle?: Partial<RenderStyle>;
  choiceColor?: string;
  choiceTextColor?: string;
  surface?: 'start' | 'archive' | 'settings' | 'game' | 'flow';
};
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export async function readWebTemplateFile(
  file: Pick<File, 'name' | 'text' | 'arrayBuffer'>,
): Promise<WebTemplateSnapshot> {
  let value: unknown;
  if (/\.zip$/i.test(file.name)) {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const manifestFile = zip.file('template.json');
    if (!manifestFile) throw new Error('Missing template.json');
    const manifest: unknown = JSON.parse(await manifestFile.async('string'));
    if (!record(manifest)) throw new Error('Invalid template manifest');
    const assetCache = new Map<string, string>();
    const restoreAssets = async (input: unknown, folder = ''): Promise<unknown> => {
      if (typeof input === 'string' && !/^(?:[a-z]+:|\/)/i.test(input)) {
        const parts: string[] = [];
        for (const part of `${folder}${input}`.split('/')) {
          if (part === '..') parts.pop();
          else if (part && part !== '.') parts.push(part);
        }
        const path = parts.join('/');
        const asset = path.startsWith('assets/') ? zip.file(path) : null;
        if (!asset) return input;
        if (assetCache.has(path)) return assetCache.get(path)!;
        const extension = path.split('.').pop()?.toLowerCase();
        const mime = (
          {
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            png: 'image/png',
            webp: 'image/webp',
            svg: 'image/svg+xml',
            gif: 'image/gif',
            avif: 'image/avif',
            bmp: 'image/bmp',
          } as Record<string, string>
        )[extension || ''];
        if (!mime) throw new Error('Unsupported template asset');
        const url = `data:${mime};base64,${await asset.async('base64')}`;
        assetCache.set(path, url);
        return url;
      }
      if (Array.isArray(input))
        return Promise.all(input.map((item) => restoreAssets(item, folder)));
      if (!record(input)) return input;
      return Object.fromEntries(
        await Promise.all(
          Object.entries(input).map(async ([key, entry]) => [
            key,
            await restoreAssets(entry, folder),
          ]),
        ),
      );
    };
    const restored = (await restoreAssets(manifest)) as Record<string, unknown>;
    if (manifest.kind === 'galwriter-web-template' && record(manifest.pages)) {
      const settings = record(restored.settings) ? { ...restored.settings } : {};
      let renderStyle = restored.renderStyle;
      for (const path of Object.values(manifest.pages)) {
        if (typeof path !== 'string') throw new Error('Invalid page path');
        const pageFile = zip.file(path);
        if (!pageFile) throw new Error(`Missing ${path}`);
        const page = await restoreAssets(
          JSON.parse(await pageFile.async('string')),
          path.replace(/[^/]+$/, ''),
        );
        if (!record(page) || !record(page.settings)) throw new Error('Invalid template page');
        Object.assign(settings, page.settings);
        if (page.renderStyle) renderStyle = page.renderStyle;
      }
      value = { ...restored, settings, renderStyle };
    } else value = restored;
  } else value = JSON.parse(await file.text());
  if (!record(value) || !record(value.settings) || !Object.keys(value.settings).length)
    throw new Error('Invalid web template');
  const settings = value.settings;
  for (const key of [
    'startMenuElements',
    'archivePageElements',
    'settingsPageElements',
    'flowOverviewElements',
    'previewToolbarElements',
    'dialogueOverlayElements',
  ]) {
    if (!(key in settings)) continue;
    if (
      !Array.isArray(settings[key]) ||
      settings[key].some(
        (element) =>
          !record(element) ||
          typeof element.id !== 'string' ||
          !['text', 'button', 'image', 'shape'].includes(String(element.kind)) ||
          ['x', 'y', 'width', 'height'].some(
            (field) => typeof element[field] !== 'number' || !Number.isFinite(element[field]),
          ),
      )
    )
      throw new Error('Invalid canvas element');
  }
  return value as WebTemplateSnapshot;
}
