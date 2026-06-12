import { useState } from 'react';

import type { RenderStyle, WebExportSettings, WebHistoryState } from '../shared/types';

const DEFAULT_WEB_SETTINGS: WebExportSettings = {
  layoutMode: 'immersive',
  choicesPosition: 'center',
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
  titleFontSize: 34,
  bodyFontSize: 18,
  titleColor: '#ffffff',
  bodyColor: '#f8fafc',
  panelColor: '#111827',
  titleAnimation: 'none',
  bodyAnimation: 'typewriter',
};

export const useWebExportSettings = (defaultProjectName: string, isLocked: boolean) => {
  const [webProjectName, setWebProjectName] = useState(defaultProjectName);
  const [webChoiceColor, setWebChoiceColor] = useState('#0ea5e9');
  const [webChoiceTextColor, setWebChoiceTextColor] = useState('#ffffff');
  const [webSettings, setWebSettings] = useState<WebExportSettings>(DEFAULT_WEB_SETTINGS);
  const [webRenderStyle, setWebRenderStyle] = useState<RenderStyle>(DEFAULT_WEB_RENDER_STYLE);
  const [webPast, setWebPast] = useState<WebHistoryState[]>([]);
  const [webFuture, setWebFuture] = useState<WebHistoryState[]>([]);

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
