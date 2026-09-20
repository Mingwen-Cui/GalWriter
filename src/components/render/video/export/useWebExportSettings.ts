import { resolveSettingsPageElements } from '../../web/webMenuPageElements';
import { useEffect, useState, useRef } from 'react';

import defaultMainInterfaceBackgroundUrl from '../../../../assets/common/default-main-interface-background.jpg';
import type { Language } from '../../../../lib/i18n';
import { canvasPatchFromWebSettings, useSharedCanvasSettings } from '../../canvas/canvasSettings';
import { buildRehearsalTemplate } from '../../web/webExperienceTemplates';
import type {
  RenderStyle,
  WebExportSettings,
  WebHistoryState,
  WebMenuElement,
} from '../shared/types';

const DEFAULT_WEB_SETTINGS: WebExportSettings = {
  canvasWidth: 1920,
  canvasHeight: 1080,
  canvasRatioWidth: 16,
  canvasRatioHeight: 9,
  canvasRatioLocked: true,
  layoutMode: 'immersive',
  sceneFit: 'cover',
  sceneScale: 50,
  sceneScaleX: 50,
  sceneScaleY: 50,
  sceneOffsetX: 0,
  sceneOffsetY: -20,
  sceneBackgroundVisible: true,
  sceneBackgroundType: 'solid',
  sceneBackgroundColor: '#020617',
  sceneBackgroundGradientStart: '#020617',
  sceneBackgroundGradientEnd: '#0f172a',
  sceneBackgroundGradientAngle: 135,
  sceneBackgroundImageUrl: '',
  choicesPosition: 'center',
  showStartMenu: true,
  startMenuTemplate: 'cinematic',
  startMenuBackgroundType: 'image',
  startMenuBackgroundColor: '#FFFFFF',
  startMenuBackgroundGradientStart: '#FFFFFF',
  startMenuBackgroundGradientEnd: '#EEF2FF',
  startMenuBackgroundGradientAngle: 135,
  startMenuBackgroundImageUrl: defaultMainInterfaceBackgroundUrl,
  startMenuBackgroundVideoUrl: '',
  startMenuBackgroundVideoLoop: true,
  startMenuBackgroundVideoMuted: true,
  startMenuBackgroundVideoFit: 'crop',
  flowOverviewBackgroundType: 'image',
  flowOverviewBackgroundColor: '#FFFFFF',
  flowOverviewBackgroundGradientStart: '#FFFFFF',
  flowOverviewBackgroundGradientEnd: '#EEF2FF',
  flowOverviewBackgroundGradientAngle: 135,
  flowOverviewBackgroundImageUrl: defaultMainInterfaceBackgroundUrl,
  flowOverviewBackgroundVideoUrl: '',
  flowOverviewBackgroundVideoLoop: true,
  flowOverviewBackgroundVideoMuted: true,
  flowOverviewBackgroundVideoFit: 'crop',
  flowOverviewBackgroundMusicUrl: '',
  flowOverviewMusicVolume: 70,
  flowOverviewMusicFadeIn: 0,
  flowOverviewMusicFadeOut: 0,
  flowOverviewMusicLoop: true,
  flowOverviewElements: [],
  flowOverviewLayoutDirection: 'right',
  flowOverviewCardSizes: {},
  flowOverviewMinimapWidth: 220,
  flowOverviewMinimapHeight: 160,
  startMenuBackgroundMusicUrl: '',
  startMenuMusicVolume: 70,
  startMenuMusicFadeIn: 0,
  startMenuMusicFadeOut: 0,
  startMenuMusicLoop: true,
  startMenuMusicApplyToArchive: true,
  startMenuMusicApplyToSettings: true,
  startMenuButtonPosition: 'center',
  startMenuButtonLayout: 'vertical',
  startMenuButtonSize: 'normal',
  startMenuElements: [],
  archivePageElements: [],
  settingsPageElements: [],
  previewToolbarElements: [],
  dialogueOverlayElements: [],
  startMenuPlacementBoundsLocked: false,
  startMenuPlacementMinX: 0,
  startMenuPlacementMinY: 0,
  startMenuPlacementMaxX: 100,
  startMenuPlacementMaxY: 100,
  startMenuShowSave: true,
  startMenuShowNewGame: true,
  startMenuShowSettings: true,
  blurBackground: true,
  skipSingleChoicePopup: true,
  interactionMode: 'typewriter',
  typewriterSpeed: 65,
  autoAdvance: false,
  textScale: 100,
  animationSpeed: 1,
  soundEnabled: true,
  videoAutoPlay: false,
  hideCharacterTags: true,
  hideSceneTags: true,
};

type InitialWebExportState = {
  projectName?: string;
  choiceColor?: string;
  choiceTextColor?: string;
  settings?: Partial<WebExportSettings>;
  past?: WebHistoryState[];
  future?: WebHistoryState[];
};

const isTransparentImageBaseColor = (color: string | undefined) => {
  const value = color?.trim().toLowerCase();
  if (!value || value === 'transparent') return true;
  if (/^#[0-9a-f]{8}$/i.test(value)) return value.slice(-2) === '00';
  const rgba = value.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)$/);
  return rgba ? Number(rgba[1]) <= 0 : false;
};

const normalizeImageFillBaseColor = (element: WebMenuElement) => {
  if (
    element.backgroundType !== 'image' ||
    !isTransparentImageBaseColor(element.backgroundImageBackgroundColor) ||
    isTransparentImageBaseColor(element.backgroundColor)
  )
    return element;
  return { ...element, backgroundImageBackgroundColor: element.backgroundColor };
};

const defaultFlowOverviewElements: WebMenuElement[] = [
  {
    id: 'flow-direction-control',
    kind: 'button',
    role: 'flowDirection',
    text: '',
    visible: true,
    x: 88.2,
    y: 0.8,
    width: 2.2,
    height: 4.2,
    scale: 1,
    rotation: 0,
    textVisible: false,
    backgroundColor: '#ffffff',
    borderColor: 'rgba(15,23,42,0.28)',
    borderWidth: 1,
    borderRadius: 8,
    textColor: '#334155',
    fillEnabled: true,
    strokeEnabled: true,
    shadowEnabled: false,
  },
  {
    id: 'flow-fit-view-control',
    kind: 'button',
    role: 'flowFitView',
    text: '',
    visible: true,
    x: 90.8,
    y: 0.8,
    width: 2.2,
    height: 4.2,
    scale: 1,
    rotation: 0,
    textVisible: false,
    backgroundColor: '#ffffff',
    borderColor: 'rgba(15,23,42,0.28)',
    borderWidth: 1,
    borderRadius: 8,
    textColor: '#64748b',
    fillEnabled: true,
    strokeEnabled: true,
    shadowEnabled: false,
  },
  {
    id: 'flow-current-branch',
    kind: 'button',
    role: 'flowBranch',
    text: '开始',
    visible: true,
    x: 1.5,
    y: 7,
    width: 14,
    height: 6,
    scale: 1,
    rotation: 0,
    textVisible: true,
    textAlign: 'left',
    backgroundColor: '#fffffff0',
    borderColor: 'rgba(15,23,42,0.28)',
    borderWidth: 1,
    borderRadius: 12,
    textColor: '#334155',
    fontSize: 13,
    fontWeight: 800,
    fillEnabled: true,
    strokeEnabled: true,
    shadowEnabled: true,
    shadowOpacity: 16,
    shadowBlur: 12,
    shadowOffsetY: 3,
  },
  {
    id: 'flow-minimap',
    kind: 'button',
    role: 'flowMinimap',
    text: '',
    visible: true,
    x: 79,
    y: 75,
    width: 19,
    height: 21,
    scale: 1,
    rotation: 0,
    textVisible: false,
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
    borderRadius: 14,
    fillEnabled: false,
    strokeEnabled: false,
    shadowEnabled: false,
  },
];

const ensureFlowOverviewControls = (settings: WebExportSettings): WebExportSettings => {
  const elements = settings.flowOverviewElements || [];
  const controls = defaultFlowOverviewElements.filter(
    (defaultElement) => !elements.some((element) => element.role === defaultElement.role),
  );
  return controls.length > 0
    ? { ...settings, flowOverviewElements: [...controls, ...elements] }
    : settings;
};

const normalizeWebImageFillBaseColors = (settings: WebExportSettings): WebExportSettings => {
  const keys = [
    'startMenuElements',
    'archivePageElements',
    'settingsPageElements',
    'previewToolbarElements',
    'dialogueOverlayElements',
    'flowOverviewElements',
  ] as const;
  let next = settings;
  keys.forEach((key) => {
    const elements = settings[key];
    if (!elements?.length) return;
    const normalized = elements.map(normalizeImageFillBaseColor);
    if (normalized.some((element, index) => element !== elements[index])) {
      next = { ...next, [key]: normalized };
    }
  });
  return next;
};

const applyDefaultMainInterfaceBackground = (settings: WebExportSettings): WebExportSettings => {
  const isPreviousBuiltInGradient =
    settings.startMenuBackgroundType === 'gradient' &&
    !settings.startMenuBackgroundImageUrl &&
    settings.startMenuBackgroundColor === '#FFFFFF' &&
    settings.startMenuBackgroundGradientStart === '#FFFFFF' &&
    settings.startMenuBackgroundGradientEnd === '#EEF2FF' &&
    settings.startMenuBackgroundGradientAngle === 135;
  return isPreviousBuiltInGradient
    ? {
        ...settings,
        startMenuBackgroundType: 'image',
        startMenuBackgroundImageUrl: defaultMainInterfaceBackgroundUrl,
      }
    : settings;
};

export const useWebExportSettings = (
  defaultProjectName: string,
  language: Language,
  isLocked: boolean,
  workspaceKey: string,
  initial: InitialWebExportState | undefined,
  styleBinding: {
    value: RenderStyle;
    update: <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => void;
  },
) => {
  const defaultPreset = buildRehearsalTemplate(language, defaultProjectName);
  const sharedCanvas = useSharedCanvasSettings(
    workspaceKey,
    canvasPatchFromWebSettings(initial?.settings || {}),
  );
  const [webProjectName, setWebProjectName] = useState(
    () => initial?.projectName || defaultProjectName,
  );
  const [webChoiceColor, setWebChoiceColor] = useState(() => initial?.choiceColor || '#0ea5e9');
  const [webChoiceTextColor, setWebChoiceTextColor] = useState(
    () => initial?.choiceTextColor || '#ffffff',
  );
  const [webSettings, setWebSettings] = useState<WebExportSettings>(() =>
    ensureFlowOverviewControls(
      applyDefaultMainInterfaceBackground(normalizeWebImageFillBaseColors({
        ...DEFAULT_WEB_SETTINGS,
        ...defaultPreset.settings,
        ...initial?.settings,
        ...sharedCanvas.settings,
      })),
    ),
  );
  useEffect(() => {
    setWebSettings((previous) =>
      ensureFlowOverviewControls(
        applyDefaultMainInterfaceBackground(
          normalizeWebImageFillBaseColors({ ...previous, ...sharedCanvas.settings }),
        ),
      ),
    );
  }, [sharedCanvas.settings]);
  useEffect(() => {
    setWebSettings((previous) =>
      ensureFlowOverviewControls(
        applyDefaultMainInterfaceBackground(normalizeWebImageFillBaseColors(previous)),
      ),
    );
  }, [webSettings]);
  const webRenderStyle = styleBinding.value;
  const applyRenderStyle = (style: RenderStyle) => {
    (Object.keys(style) as Array<keyof RenderStyle>).forEach((key) =>
      styleBinding.update(key, style[key]),
    );
  };
  const [webPast, setWebPast] = useState<WebHistoryState[]>(() => initial?.past || []);
  const [webFuture, setWebFuture] = useState<WebHistoryState[]>(() => initial?.future || []);

  const captureWebState = (): WebHistoryState => ({
    settings: normalizeWebImageFillBaseColors(webSettings),
    renderStyle: structuredClone(webRenderStyle),
    choiceColor: webChoiceColor,
    choiceTextColor: webChoiceTextColor,
  });

  const restoreWebState = (snapshot: WebHistoryState) => {
    setWebSettings(normalizeWebImageFillBaseColors(snapshot.settings));
    sharedCanvas.update(canvasPatchFromWebSettings(snapshot.settings));
    applyRenderStyle(snapshot.renderStyle);
    setWebChoiceColor(snapshot.choiceColor);
    setWebChoiceTextColor(snapshot.choiceTextColor);
  };

  const historyQueued = useRef(false);
  const pushWebHistory = () => {
    if (historyQueued.current) return;
    historyQueued.current = true;
    queueMicrotask(() => {
      historyQueued.current = false;
    });
    setWebPast((prev) => [...prev.slice(-49), captureWebState()]);
    setWebFuture([]);
  };

  const undoWeb = () => {
    if (webPast.length === 0 || isLocked) return;
    const previous = webPast[webPast.length - 1];
    setWebPast((prev) => prev.slice(0, -1));
    setWebFuture((prev) => [captureWebState(), ...prev]);
    restoreWebState(previous);
  };

  const redoWeb = () => {
    if (webFuture.length === 0 || isLocked) return;
    const next = webFuture[0];
    setWebFuture((prev) => prev.slice(1));
    setWebPast((prev) => [...prev, captureWebState()]);
    restoreWebState(next);
  };

  const updateWebRenderStyle = <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => {
    if (webRenderStyle[key] === value) return;
    pushWebHistory();
    styleBinding.update(key, value);
  };

  const applySettingsPatch = (previous: WebExportSettings, patch: Partial<WebExportSettings>) => {
    if (!('settingsPageElements' in patch))
      return normalizeWebImageFillBaseColors({ ...previous, ...patch });
    const next = patch.settingsPageElements || [];
    const removed = resolveSettingsPageElements(
      previous,
      language,
      webChoiceColor,
      webChoiceTextColor,
    ).filter((item) => !next.some((entry) => entry.id === item.id));
    const archive = [
      ...(previous.settingsPageRemovedElements || []).filter(
        (item) => !removed.some((entry) => entry.id === item.id),
      ),
      ...removed,
    ].filter((item) => !next.some((entry) => entry.id === item.id));
    return normalizeWebImageFillBaseColors({
      ...previous,
      ...patch,
      settingsPageElementsInitialized: true,
      settingsPageRemovedElements: archive,
    });
  };

  const updateWebSettings = <K extends keyof WebExportSettings>(
    key: K,
    value: WebExportSettings[K],
  ) => {
    if (webSettings[key] === value) return;
    pushWebHistory();
    setWebSettings((prev) => applySettingsPatch(prev, { [key]: value }));
    const sharedPatch = canvasPatchFromWebSettings({ [key]: value } as Partial<WebExportSettings>);
    if (Object.keys(sharedPatch).length) sharedCanvas.update(sharedPatch);
  };

  const updateWebSettingsBulk = (patch: Partial<WebExportSettings>) => {
    const entries = Object.entries(patch) as Array<
      [keyof WebExportSettings, WebExportSettings[keyof WebExportSettings]]
    >;
    if (entries.length === 0) return;
    if (entries.every(([key, value]) => webSettings[key] === value)) return;
    pushWebHistory();
    setWebSettings((prev) => applySettingsPatch(prev, patch));
    const sharedPatch = canvasPatchFromWebSettings(patch);
    if (Object.keys(sharedPatch).length) sharedCanvas.update(sharedPatch);
  };

  const updateWebChoiceColor = (value: string) => {
    if (webChoiceColor === value) return;
    pushWebHistory();
    setWebChoiceColor(value);
  };

  const updateWebChoiceTextColor = (value: string) => {
    if (webChoiceTextColor === value) return;
    pushWebHistory();
    setWebChoiceTextColor(value);
  };

  return {
    webProjectName,
    setWebProjectName,
    webChoiceColor,
    webChoiceTextColor,
    webSettings,
    webRenderStyle,
    webPast,
    webFuture,
    undoWeb,
    redoWeb,
    updateWebSettings,
    updateWebSettingsBulk,
    updateWebRenderStyle,
    updateWebChoiceColor,
    updateWebChoiceTextColor,
  };
};
