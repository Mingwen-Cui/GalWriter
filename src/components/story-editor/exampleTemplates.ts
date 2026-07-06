import type { ProjectExampleTemplate } from '../ProjectPickerModal';

export const EXAMPLES_MANIFEST_URL = 'examples/manifest.json';

export const resolveExampleAssetUrl = (path: string) => {
  if (/^(?:https?:)?\/\//i.test(path) || path.startsWith('data:')) return path;
  if (typeof window === 'undefined') return path;
  return new URL(path, new URL(EXAMPLES_MANIFEST_URL, window.location.href)).toString();
};

export const normalizeExampleTemplates = (manifest: unknown): ProjectExampleTemplate[] => {
  const examples = (manifest as { examples?: unknown })?.examples;
  if (!Array.isArray(examples)) return [];

  return examples
    .map((entry, index): ProjectExampleTemplate | null => {
      const item = entry as Record<string, unknown>;
      const file = typeof item.file === 'string' ? item.file.trim() : '';
      const title = typeof item.title === 'string' ? item.title.trim() : '';
      if (!file || !title) return null;

      const thumbnail = typeof item.thumbnail === 'string' ? item.thumbnail.trim() : '';
      const id =
        typeof item.id === 'string' && item.id.trim()
          ? item.id.trim()
          : `${file.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'template'}-${index}`;

      return {
        id,
        title,
        file: resolveExampleAssetUrl(file),
        description: typeof item.description === 'string' ? item.description.trim() : undefined,
        thumbnail: thumbnail ? resolveExampleAssetUrl(thumbnail) : undefined,
        sizeLabel: typeof item.sizeLabel === 'string' ? item.sizeLabel.trim() : undefined,
      } satisfies ProjectExampleTemplate;
    })
    .filter((entry): entry is ProjectExampleTemplate => Boolean(entry));
};
