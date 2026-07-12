export type ParsedColorValue = { hex: string; alpha: number };

const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
const byteHex = (value: number) => clampByte(value).toString(16).padStart(2, '0');

export const parseColorValue = (
  value: string | undefined,
  fallback = '#000000ff',
): ParsedColorValue => {
  const source = String(value || '').trim();
  const hex = source.match(/^#([0-9a-f]{3,8})$/i)?.[1];
  if (hex) {
    const expanded = hex.length === 3 || hex.length === 4
      ? hex.split('').map((part) => part + part).join('')
      : hex;
    if (expanded.length === 6 || expanded.length === 8) {
      return {
        hex: `#${expanded.slice(0, 6).toLowerCase()}`,
        alpha: expanded.length === 8 ? Math.round((Number.parseInt(expanded.slice(6), 16) / 255) * 100) : 100,
      };
    }
  }
  const rgb = source.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*[,/]\s*([\d.]+)%?)?\s*\)$/i);
  if (rgb) {
    const rawAlpha = rgb[4] === undefined ? 1 : Number(rgb[4]);
    const alpha = source.includes('%') ? rawAlpha : rawAlpha <= 1 ? rawAlpha * 100 : rawAlpha;
    return {
      hex: `#${byteHex(Number(rgb[1]))}${byteHex(Number(rgb[2]))}${byteHex(Number(rgb[3]))}`,
      alpha: Math.max(0, Math.min(100, Math.round(alpha))),
    };
  }
  return source === fallback ? { hex: '#000000', alpha: 100 } : parseColorValue(fallback, '#000000ff');
};

export const toHex8 = (color: string | undefined, alpha?: number, fallback = '#000000ff') => {
  const parsed = parseColorValue(color, fallback);
  const safeAlpha = Math.max(0, Math.min(100, alpha ?? parsed.alpha));
  return `${parsed.hex}${byteHex((safeAlpha / 100) * 255)}`;
};

export const colorWithAlpha = (color: string | undefined, alpha?: number) =>
  toHex8(color, alpha);
