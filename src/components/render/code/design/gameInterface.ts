import { parseColorValue } from '../../shared/paint/colorValue';
import type { CodeExportTarget } from '../codeExport/targets/targetTypes';

export type GameInterfaceSettings = {
  width: number; height: number; background: string;
  panelColor: string; panelAlpha: number; panelX: number; panelY: number; panelWidth: number; panelHeight: number;
  fontSize: number; textColor: string; nameColor: string; accentColor: string; radius: number; textSpeed: number;
};
export type GameInterfaceProfiles = Partial<Record<CodeExportTarget, GameInterfaceSettings>>;
export const DEFAULT_GAME_INTERFACE: GameInterfaceSettings = {
  width: 1280, height: 720, background: '#111827', panelColor: '#090e1a', panelAlpha: 94,
  panelX: 4, panelY: 67, panelWidth: 92, panelHeight: 30,
  fontSize: 24, textColor: '#f8fafc', nameColor: '#9bdcff', accentColor: '#4f46e5', radius: 14, textSpeed: 45,
};
export const GAME_INTERFACE_CAPABILITIES = {
  dialogic: { canvas: true, background: true, nameColor: true, accent: true, radius: true },
  renpy: { canvas: true, background: true, nameColor: true, accent: true, radius: false },
  tyrano: { canvas: false, background: false, nameColor: false, accent: false, radius: false },
  'ir-json': { canvas: true, background: true, nameColor: true, accent: true, radius: true },
} as const;
export const GAME_TARGET_NAMES = {dialogic: 'Godot', renpy: 'Ren’Py', tyrano: 'TyranoScript', 'ir-json': 'IR JSON'} as const;
export function normalizeGameInterface(input?: Partial<GameInterfaceSettings>): GameInterfaceSettings {
  const value = {...DEFAULT_GAME_INTERFACE};
  const ranges: Partial<Record<keyof GameInterfaceSettings, [number, number]>> = {
    width: [640,3840], height:[360,2160], panelAlpha:[0,100], panelX:[0,95], panelY:[0,95],
    panelWidth:[10,100], panelHeight:[15,70], fontSize:[12,72], radius:[0,48], textSpeed:[1,200],
  };
  for (const [key, [min,max]] of Object.entries(ranges)) {
    const n = Number(input?.[key as keyof GameInterfaceSettings]);
    if (Number.isFinite(n)) Object.assign(value, {[key]: Math.max(min,Math.min(max,Math.round(n)))});
  }
  value.panelWidth = Math.min(value.panelWidth, 100 - value.panelX);
  value.panelHeight = Math.min(value.panelHeight, 100 - value.panelY);
  for (const key of ['background','panelColor','textColor','nameColor','accentColor'] as const) value[key] = parseColorValue(input?.[key], value[key]).hex;
  return value;
}
export function resolveGameInterface(profiles: GameInterfaceProfiles | undefined, target: CodeExportTarget): GameInterfaceSettings {
  const value = normalizeGameInterface(profiles?.[target]);
  const caps = GAME_INTERFACE_CAPABILITIES[target];
  if (!caps.canvas) {value.width = 1280; value.height = 720;}
  if (!caps.radius) value.radius = 0;
  return value;
}
