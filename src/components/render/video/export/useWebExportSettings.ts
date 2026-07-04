import { useState } from 'react';

import type { RenderStyle, WebExportSettings, WebHistoryState } from '../shared/types';

const DEFAULT_WEB_SETTINGS: WebExportSettings = {
  layoutMode: 'immersive',
  choicesPosition: 'center',
  showStartMenu: true,
  startMenuTemplate: 'cinematic',
  startMenuButtonPosition: 'center',
  startMenuButtonLayout: 'vertical',
  startMenuShowSave: true,
  startMenuShowNewGame: true,
  startMenuShowSettings: true,
  blurBackground: true,
  skipSingleChoicePopup: true,
  interactionMode: 'typewriter',
  typewriterSpeed: 65,
  autoAdvance: false,
  videoAutoPlay: false,
  hideCharacterTags: true,
  hideSceneTags: true,
};

const DEFAULT_WEB_RENDER_STYLE: RenderStyle = {
  titleVisible: true,
  titleFontSize: 28,
  bodyFontSize: 18,
  titleFontFamily: 'SimHei, "Noto Sans SC", sans-serif',
  bodyFontFamily: 'SimHei, "Noto Sans SC", sans-serif',
  titleColor: '#ffffff',
  bodyColor: '#f8fafc',
  titleColorAlpha: 100,
  bodyColorAlpha: 100,
  titleStrokeColor: '#000000',
  bodyStrokeColor: '#000000',
  titleStrokeWidth: 0,
  bodyStrokeWidth: 0,
  titleAlign: 'left',
  bodyAlign: 'left',
  titleLetterSpacing: 0,
  bodyLetterSpacing: 0,
  titleLineHeight: 1.25,
  bodyLineHeight: 1.45,
  titleAnimationLeadSeconds: 0,
  bodyAnimationLeadSeconds: 0,
  titleTypewriterMode: 'character',
  bodyTypewriterMode: 'character',
  panelColor: '#111827',
  panelColorAlpha: 82,
  dialogVisible: true,
  dialogWidth: 86,
  dialogHeight: 34,
  dialogHeightMode: 'fixed',
  dialogRadius: 24,
  dialogOffsetX: 0,
  dialogOffsetY: 0,
  dialogTextPaddingX: 9,
  dialogTextOffsetY: 0,
  dialogBackgroundType: 'solid',
  dialogGradientAngle: 90,
  dialogGradientStartColor: 'rgba(17, 24, 39, 0)',
  dialogGradientColor: 'rgba(17, 24, 39, 0.86)',
  dialogGradientStops: [
    { id: 'start', color: '#111827', alpha: 0, position: 0 },
    { id: 'end', color: '#111827', alpha: 86, position: 100 },
  ],
  dialogImageUrl: '',
  nameplateVisible: true,
  nameplateInside: false,
  nameplateFollowCharacter: true,
  nameplateFontSize: 18,
  nameplateFontFamily: 'SimHei, "Noto Sans SC", sans-serif',
  nameplateScale: 100,
  nameplateRadius: 14,
  nameplateTextColor: '#ffffff',
  nameplateTextColorAlpha: 100,
  nameplateOffsetX: 0,
  nameplateOffsetY: 0,
  nameplateTextGap: 8,
  nameplateBackgroundType: 'solid',
  nameplateColor: '#4f46e5',
  nameplateColorAlpha: 86,
  nameplateGradientAngle: 90,
  nameplateGradientStops: [
    { id: 'start', color: '#6366f1', alpha: 92, position: 0 },
    { id: 'end', color: '#ec4899', alpha: 82, position: 100 },
  ],
  nameplateImageUrl: '',
  titleAnimation: 'none',
  bodyAnimation: 'typewriter',
};

type InitialWebExportState = {
  projectName?: string;
  choiceColor?: string;
  choiceTextColor?: string;
  settings?: Partial<WebExportSettings>;
  renderStyle?: Partial<RenderStyle>;
  past?: WebHistoryState[];
  future?: WebHistoryState[];
};

export const useWebExportSettings = (
  defaultProjectName: string,
  isLocked: boolean,
  initial?: InitialWebExportState,
) => {
  const [webProjectName, setWebProjectName] = useState(
    () => initial?.projectName || defaultProjectName,
  );
  const [webChoiceColor, setWebChoiceColor] = useState(() => initial?.choiceColor || '#0ea5e9');
  const [webChoiceTextColor, setWebChoiceTextColor] = useState(
    () => initial?.choiceTextColor || '#ffffff',
  );
  const [webSettings, setWebSettings] = useState<WebExportSettings>(() => ({
    ...DEFAULT_WEB_SETTINGS,
    ...initial?.settings,
  }));
  const [webRenderStyle, setWebRenderStyle] = useState<RenderStyle>(() => ({
    ...DEFAULT_WEB_RENDER_STYLE,
    ...initial?.renderStyle,
  }));
  const [webPast, setWebPast] = useState<WebHistoryState[]>(() => initial?.past || []);
  const [webFuture, setWebFuture] = useState<WebHistoryState[]>(() => initial?.future || []);

  const captureWebState = (): WebHistoryState => ({
    settings: { ...webSettings },
    renderStyle: { ...webRenderStyle },
    choiceColor: webChoiceColor,
    choiceTextColor: webChoiceTextColor,
  });

  const restoreWebState = (snapshot: WebHistoryState) => {
    setWebSettings(snapshot.settings);
    setWebRenderStyle(snapshot.renderStyle);
    setWebChoiceColor(snapshot.choiceColor);
    setWebChoiceTextColor(snapshot.choiceTextColor);
  };

  const pushWebHistory = () => {
    setWebPast((prev) => [...prev, captureWebState()]);
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
    setWebRenderStyle((prev) => ({ ...prev, [key]: value }));
  };

  const updateWebSettings = <K extends keyof WebExportSettings>(
    key: K,
    value: WebExportSettings[K],
  ) => {
    if (webSettings[key] === value) return;
    pushWebHistory();
    setWebSettings((prev) => ({ ...prev, [key]: value }));
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
    updateWebRenderStyle,
    updateWebChoiceColor,
    updateWebChoiceTextColor,
  };
};
