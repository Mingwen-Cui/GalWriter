import type { RenderCustomFont, RenderFontFamilyOption } from './types';

const registeredFontIds = new Set<string>();

export const DEFAULT_RENDER_FONT_OPTIONS: RenderFontFamilyOption[] = [
  { label: 'Microsoft YaHei', value: '"Microsoft YaHei", "Noto Sans SC", Arial, sans-serif' },
  { label: 'SimSun', value: 'SimSun, "Noto Serif SC", serif' },
  { label: 'SimHei', value: 'SimHei, "Noto Sans SC", sans-serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Serif', value: 'Georgia, "Times New Roman", serif' },
];

export const fontFamilyValue = (family: string) => `"${family.replace(/"/g, '\\"')}"`;

export const customFontFamilyValue = (font: RenderCustomFont) => fontFamilyValue(font.family);

export const customFontOptions = (fonts: RenderCustomFont[] = []): RenderFontFamilyOption[] =>
  fonts.map((font) => ({ label: font.label, value: customFontFamilyValue(font) }));

export const renderFontOptions = (
  presets: RenderFontFamilyOption[] | undefined,
  customFonts: RenderCustomFont[] | undefined,
) => {
  const savedOptions = presets?.length ? presets : DEFAULT_RENDER_FONT_OPTIONS;
  return [
    ...savedOptions,
    ...customFontOptions(customFonts).filter(
      (font) => !savedOptions.some((option) => option.value === font.value),
    ),
  ];
};

export const registerCustomRenderFonts = async (fonts: RenderCustomFont[] = []) => {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') return;
  await Promise.all(
    fonts.map(async (font) => {
      if (!font?.id || !font.family || !font.dataUrl || registeredFontIds.has(font.id)) return;
      registeredFontIds.add(font.id);
      try {
        const face = new FontFace(font.family, `url("${font.dataUrl}") format("${font.format}")`);
        const loaded = await face.load();
        document.fonts.add(loaded);
      } catch (error) {
        registeredFontIds.delete(font.id);
        console.warn(`Unable to load custom font: ${font.label}`, error);
      }
    }),
  );
};

export const readCustomFontFile = async (file: File): Promise<RenderCustomFont> => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const formatByExtension = {
    woff2: 'woff2',
    woff: 'woff',
    ttf: 'truetype',
    otf: 'opentype',
  } as const;
  const format = extension ? formatByExtension[extension as keyof typeof formatByExtension] : null;
  if (!format) throw new Error('unsupported-format');
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('read-failed'));
    reader.readAsDataURL(file);
  });
  const label = file.name.replace(/\.[^.]+$/, '').trim() || 'Custom Font';
  const id = `custom-font-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return { id, label, family: `GalWriter Custom ${id.slice(-8)}`, format, dataUrl };
};
