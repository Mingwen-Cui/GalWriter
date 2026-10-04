import type { WebMenuElement } from '../video/shared/types';

export const SETTINGS_BACKGROUND_STYLE = {
  borderRadius: 61,
  borderTopLeftRadius: 61, borderTopRightRadius: 61,
  borderBottomLeftRadius: 61, borderBottomRightRadius: 61,
  opacity: 100, fillEnabled: true,
  backgroundType: 'gradient' as const,
  backgroundGradientStart: '#ffffff', backgroundGradientEnd: '#e8ecf8',
  backgroundGradientAngle: 270, backgroundGradientShape: 'linear' as const,
  backgroundGradientStops: [
    { id: 'settings-bg-start', color: '#ffffff', alpha: 80, position: 0 },
    { id: 'settings-bg-end', color: '#e8ecf8', alpha: 94, position: 100 },
  ],
};

/** Shared, serializable colours for the editor and the offline player. */
export type WebThemeVisuals = {
  panel: string;
  panelEnd: string;
  canvas: string;
  canvasEnd: string;
  ink: string;
  muted: string;
  accent: string;
  accentEnd: string;
  onAccent: string;
  edge: string;
  radius: number;
  font: string;
  dark: boolean;
};

const sans = '"Noto Sans SC", "Microsoft YaHei", system-ui, sans-serif';
const serif = '"Noto Serif SC", "Songti SC", SimSun, Georgia, serif';

export const defaultWebTheme: WebThemeVisuals = {
  panel: '#ffffff', panelEnd: '#f0f2fb', canvas: '#f6f7fc', canvasEnd: '#e8ecf8',
  ink: '#252a59', muted: '#68719a', accent: '#7169d8', accentEnd: '#5750b5',
  onAccent: '#ffffff', edge: '#dce0ef', radius: 22, font: sans, dark: false,
};

export const webThemePalettes: Record<string, WebThemeVisuals> = {
  'sakura-campus': {
    panel: '#fffaf7', panelEnd: '#f6e8ec', canvas: '#f8efed', canvasEnd: '#ecdce5',
    ink: '#4b3442', muted: '#856573', accent: '#b96b83', accentEnd: '#98566f',
    onAccent: '#ffffff', edge: '#e6cbd3', radius: 24, font: sans, dark: false,
  },
  'rainy-station': {
    panel: '#142534', panelEnd: '#0c1927', canvas: '#111f30', canvasEnd: '#07111e',
    ink: '#e5edf5', muted: '#a2b9cb', accent: '#437d95', accentEnd: '#2b586f',
    onAccent: '#f1fbff', edge: '#39566a', radius: 12, font: sans, dark: true,
  },
  'gothic-moon': {
    panel: '#2b2237', panelEnd: '#181321', canvas: '#211a2e', canvasEnd: '#100d19',
    ink: '#f1eaf4', muted: '#c2af95', accent: '#79628e', accentEnd: '#574568',
    onAccent: '#fff4df', edge: '#756349', radius: 6, font: serif, dark: true,
  },
  'deepsea-sci-fi': {
    panel: '#153047', panelEnd: '#0a1c32', canvas: '#102b40', canvasEnd: '#07152b',
    ink: '#e1f1f7', muted: '#9ebfce', accent: '#387f9b', accentEnd: '#275572',
    onAccent: '#edfbff', edge: '#39667e', radius: 18, font: sans, dark: true,
  },
};

export const webThemeCssVariables = (theme: WebThemeVisuals = defaultWebTheme): Record<string, string> => ({
  '--gw-panel': theme.panel,
  '--gw-panel-end': theme.panelEnd,
  '--gw-ink': theme.ink,
  '--gw-muted': theme.muted,
  '--gw-accent': theme.accent,
  '--gw-accent-end': theme.accentEnd,
  '--gw-on-accent': theme.onAccent,
  '--gw-edge': theme.edge,
  '--gw-radius': `${theme.radius}px`,
  '--gw-font': theme.font,
  '--gw-scheme': theme.dark ? 'dark' : 'light',
  '--vr-accent': theme.accent,
  '--vr-accent-strong': theme.accentEnd,
  '--vr-surface': theme.panel,
  '--vr-surface-soft': theme.panelEnd,
  '--vr-text': theme.ink,
  '--vr-text-soft': theme.muted,
  '--vr-text-muted': theme.muted,
  '--vr-border': theme.edge,
});

export function decorateWebPageElements(items: WebMenuElement[], theme = defaultWebTheme): WebMenuElement[] {
  return items.map((element) => {
    if (element.kind === 'text') return {
      ...element, fontFamily: theme.font,
      textColor: element.role === 'title' || element.id.endsWith('-title') || element.id.endsWith('-heading') ? theme.ink : theme.muted,
    };
    const primary = element.primary;
    const panel = element.kind === 'shape';
    return {
      ...element, fontFamily: theme.font, textColor: primary ? theme.onAccent : theme.ink,
      backgroundType: 'gradient', backgroundColor: primary ? theme.accent : theme.panel,
      backgroundGradientStart: primary ? theme.accent : theme.panel,
      backgroundGradientEnd: primary ? theme.accentEnd : theme.panelEnd,
      backgroundGradientAngle: panel ? 155 : 135,
      backgroundGradientShape: 'linear', backgroundGradientStops: undefined,
      borderColor: theme.edge, borderWidth: 1, borderRadius: element.settingsLayoutVersion ? (element.kind === 'button' && ['back', 'reset'].includes(element.role || '') ? theme.radius : 0) : ['flowDirection', 'flowFitView', 'mainMenu'].includes(element.role || '') ? 999 : panel ? theme.radius + 8 : theme.radius,
      shadowEnabled: element.shadowEnabled !== false, shadowColor: theme.dark ? '#000000' : '#34344f',
      shadowOpacity: panel ? 10 : primary ? 16 : 5, shadowBlur: panel ? 40 : primary ? 22 : 12,
      shadowOffsetX: 0, shadowOffsetY: panel ? 14 : primary ? 6 : 3,
      // Generated presets use editable legacy paint fields, with no stale layered override.
      appearance: undefined,
      ...(['settings-background', 'archive-panel'].includes(element.id) ? SETTINGS_BACKGROUND_STYLE : {}),
    };
  });
}

export const WEB_FLOW_THEME_CSS = `
.gw-flow-theme { color:var(--gw-ink); font-family:var(--gw-font); }
.gw-flow-theme .gw-flow-card { border-color:var(--gw-edge); border-radius:var(--gw-radius); box-shadow:0 8px 24px #00000018; }
.gw-flow-theme .gw-flow-card:hover,.gw-flow-theme .gw-flow-card.is-active { border-color:var(--gw-accent); box-shadow:0 0 0 2px var(--gw-edge),0 12px 28px #00000024; }
.gw-flow-theme .gw-flow-card-empty { background:linear-gradient(145deg,var(--gw-panel),var(--gw-panel-end)); }
.gw-flow-theme .gw-flow-detail { color:var(--gw-ink); border-color:var(--gw-edge); background:linear-gradient(155deg,var(--gw-panel),var(--gw-panel-end)); border-radius:var(--gw-radius); }
.gw-flow-theme .gw-flow-detail .gw-flow-detail-head { border-color:var(--gw-edge); }
.gw-flow-theme .gw-flow-detail .gw-flow-muted { color:var(--gw-muted); }
.gw-flow-theme .gw-flow-detail .gw-flow-ink { color:var(--gw-ink); }
.gw-flow-theme .gw-flow-detail .gw-flow-detail-summary,.gw-flow-theme .gw-flow-detail .gw-flow-detail-item { color:var(--gw-ink); border-color:var(--gw-edge); background:var(--gw-panel-end); }
.gw-flow-theme .gw-flow-detail .gw-flow-detail-play { color:var(--gw-on-accent); background:linear-gradient(135deg,var(--gw-accent),var(--gw-accent-end)); }
.flow-overview-panel.gw-flow-theme { border-color:var(--gw-edge); border-radius:var(--gw-radius); color:var(--gw-ink); }
.gw-flow-theme .flow-overview-close { color:var(--gw-ink); border-color:var(--gw-edge); background:linear-gradient(135deg,var(--gw-panel),var(--gw-panel-end)); }
.gw-flow-theme .flow-overview-node { border-color:var(--gw-edge); border-radius:var(--gw-radius); }
.gw-flow-theme .flow-overview-node:hover,.gw-flow-theme .flow-overview-node:focus-visible,.gw-flow-theme .flow-overview-node.root,.gw-flow-theme .flow-overview-node.is-chain { border-color:var(--gw-accent); box-shadow:0 0 0 2px var(--gw-edge),0 10px 24px #00000024; }
.gw-flow-theme .flow-overview-node.no-image { background:linear-gradient(145deg,var(--gw-panel),var(--gw-panel-end)); }
.gw-flow-theme .flow-overview-edge.is-chain { stroke:var(--gw-accent) !important; }
.gw-flow-theme .flow-overview-detail { color:var(--gw-ink); border-color:var(--gw-edge); border-radius:var(--gw-radius); background:linear-gradient(155deg,var(--gw-panel),var(--gw-panel-end)); }
.gw-flow-theme .flow-overview-detail-head { border-color:var(--gw-edge); }
.gw-flow-theme .flow-overview-detail-title { color:var(--gw-ink); }
.gw-flow-theme .flow-overview-detail-text,.gw-flow-theme .flow-overview-detail-section-title,.gw-flow-theme .flow-overview-detail-empty { color:var(--gw-muted); }
.gw-flow-theme .flow-overview-detail-item,.gw-flow-theme .flow-overview-detail-close { color:var(--gw-ink); border-color:var(--gw-edge); background:var(--gw-panel-end); }
.gw-flow-theme .flow-overview-detail-play { color:var(--gw-on-accent); background:linear-gradient(135deg,var(--gw-accent),var(--gw-accent-end)); box-shadow:0 6px 18px #00000020; }
.gw-flow-theme .flow-overview-minimap,.gw-flow-theme .flow-overview-minimap-controls,.gw-flow-theme .flow-overview-minimap-control { color:var(--gw-ink); border-color:var(--gw-edge); background:var(--gw-panel); }
`;
