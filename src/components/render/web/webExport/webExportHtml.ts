import { mountPresentationText } from '../../shared/presentationTextDom';
import type { WebMenuElement } from '../../video/shared/types';
import {
  playerControlCatalog,
  playbackSettingButtonConfig,
  playbackSettingButtonRoles,
} from '../playerSettingsPanelConfig';
import type { PlayerSettingsPanelConfig } from '../playerSettingsPanelConfig';
import { appearanceRuntimeScript } from '../../shared/paint/appearanceRuntime';
import type { Language } from '../../../../lib/i18n';
import { formatWebText } from '../i18n';
import {
  mountPlayerSettings,
  playerSettingsMarkup,
  PLAYER_SETTINGS_CSS,
} from '../playerSettingsPanel';
import {
  WEB_PLAYBACK_UI_CSS,
  webPlaybackCopy,
  webToolbarButtonLabel,
  webStoryTitle,
  mountWebHistory,
  mountWebEnding,
} from '../webPlaybackUi';
import { WEB_EXPORT_STYLES } from './webExportStyles';

export const makeIndexHtml = (
  title: string,
  language: Language,
  faviconPath: string,
  panelConfig?: PlayerSettingsPanelConfig,
  pageElements: WebMenuElement[] = [],
) => {
  const widgetRoles = new Set(playerControlCatalog(language).map((item) => String(item.id)));
  const widgets = JSON.stringify(
    Object.fromEntries(
      pageElements
        .filter((element) => element.kind === 'button' && widgetRoles.has(element.role || ''))
        .map((element) => [element.id, playerSettingsMarkup(language, panelConfig, element)]),
    ),
  ).replace(/</g, '\\u003c');
  const popupMarkup = JSON.stringify(
    Object.fromEntries(
      playbackSettingButtonRoles.map((role) => [
        role,
        playerSettingsMarkup(language, playbackSettingButtonConfig(panelConfig, role)),
      ]),
    ),
  ).replace(/</g, '\u003c');
  const authorWebsite = formatWebText(language, 'webExportAuthorWebsite');
  return `<!doctype html>
<html lang="${language === 'zh' ? 'zh-CN' : language === 'ja' ? 'ja' : 'en'}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <link rel="icon" href="${escapeHtml(faviconPath)}" />
  <script src="./content.js"></script>
  <style>${WEB_EXPORT_STYLES}
${PLAYER_SETTINGS_CSS}
${WEB_PLAYBACK_UI_CSS}</style>
</head>
<body>
  <div class="canvas-shell" id="canvasShell">
  <div class="app">
    <header hidden>
      <h1 id="projectTitle"></h1>
      <div class="toolbar">
        <button class="tool" id="backButton" type="button"></button>
        <button class="tool" id="resetButton" type="button"></button>
        <button class="tool" id="mainMenuButton" type="button"></button>
        <button class="tool" id="autoButton" type="button"></button>
        <div class="playlist-wrap">
          <button class="tool" id="playlistButton" type="button" aria-expanded="false"></button>
          <div class="playlist-backdrop" id="playlistBackdrop">
          <div class="playlist-panel" id="playlistPanel" role="dialog" aria-modal="true">
            <div class="playlist-head">
              <div>
                <div class="playlist-title" id="playlistTitle"></div>
                <div class="playlist-hint" id="playlistHint"></div>
              </div>
              <button class="playlist-close" id="playlistClose" type="button" aria-label="Close">&#10005;</button>
            </div>
            <div class="playlist-items" id="playlistItems"></div>
          </div>
          </div>
        </div>
        <a class="tool" id="makeButton" href="https://mingwencui.com/AIwriter/?lang=zh" target="_blank" rel="noopener noreferrer"></a>
      </div>
    </header>
    <main>
      <div class="backdrop" id="backdrop"></div>
      <section class="stage" id="stage"></section>
      <button class="zen-toggle" id="zenButton" type="button" aria-label="Toggle controls"><img src="./icons/eye.svg" alt="" /></button>
      <audio id="playlistAudio" preload="auto" hidden></audio>
    </main>
    <div class="playback-toolbar" id="playbackToolbar"></div>
  </div>
  <div class="start-screen" id="startScreen" role="dialog" aria-modal="true">
    <div class="start-panel">
      <img class="start-logo" src="${escapeHtml(faviconPath)}" alt="" />
      <div>
        <h2 class="start-title" id="startTitle"></h2>
        <p class="start-subtitle" id="startSubtitle"></p>
      </div>
      <div class="start-actions">
        <button class="start-action" id="flowOverviewButton" type="button"></button>
        <button class="start-action primary" id="continueGameButton" type="button"></button>
        <button class="start-action primary" id="saveSlotButton" type="button"></button>
        <button class="start-action" id="newGameButton" type="button"></button>
        <button class="start-action" id="settingsButton" type="button"></button>
      </div>
    </div>
    <div class="start-layer" id="startLayer"></div>
    <audio id="startMenuAudio" preload="auto" loop hidden></audio>
  </div>
  <div class="settings-backdrop" id="settingsBackdrop" role="dialog" aria-modal="true" aria-label="${language === 'zh' ? '播放设置' : language === 'ja' ? '再生設定' : 'Playback settings'}">
    <div id="playerSettingsRoot" hidden></div>
    <div class="start-layer" id="settingsCustomLayer"></div>
  </div>
  <div class="settings-backdrop" id="saveBackdrop">
    <div class="settings-panel save-panel" role="dialog" aria-modal="true">
      <div class="settings-head">
        <div class="settings-title" id="saveTitle"></div>
        <button class="settings-close" id="saveClose" type="button" aria-label="Close">&#10005;</button>
      </div>
      <div class="save-list" id="saveList"></div>
    </div>
  </div>
  <div class="flow-overview-backdrop" id="flowOverviewBackdrop" role="dialog" aria-modal="true" aria-label="Flow overview">
    <div class="flow-overview-panel" id="flowOverviewPanel">
      <div class="flow-overview-viewport" id="flowOverviewViewport">
        <button class="flow-overview-close flow-overview-close-floating" id="flowOverviewClose" type="button" aria-label="Close">&#10005;</button>
        <div class="flow-overview-canvas" id="flowOverviewCanvas"></div>
        <div class="flow-overview-custom-layer" id="flowOverviewCustomLayer"></div>
        <div class="flow-overview-minimap" id="flowOverviewMinimap" aria-hidden="true"></div>
      </div>
      <aside class="flow-overview-detail" id="flowOverviewDetail" hidden></aside>
      <audio id="flowOverviewAudio" preload="auto" hidden></audio>
    </div>
  </div>
  </div>
  <script>
    const content = window.GALWRITER_CONTENT || { nodes: [], edges: [], title: "GalWriter" };
    const playbackCopy = ${JSON.stringify(webPlaybackCopy(language))};
    const mountHistory = (${mountWebHistory.toString()});
    const mountEnding = (${mountWebEnding.toString()});
    const storyTitle = (${webStoryTitle.toString()});
    const toolbarButtonLabel = (${webToolbarButtonLabel.toString()});
    const popupSettingsMarkup = ${popupMarkup};
    const style = content.style || {};
    const customFontsReady = typeof FontFace === "undefined" || !document.fonts
      ? Promise.resolve()
      : Promise.all((Array.isArray(style.customFonts) ? style.customFonts : []).map(async (font) => {
          if (!font || !font.family || !font.dataUrl) return;
          try {
            const face = new FontFace(font.family, 'url("' + font.dataUrl + '") format("' + (font.format || 'woff2') + '")');
            document.fonts.add(await face.load());
          } catch (error) {
            console.warn("Unable to load custom font", font.label || font.family, error);
          }
        }));
    const settings = content.settings || {};
    settings.canvasWidth = Math.min(7680, Math.max(320, Math.round(Number(settings.canvasWidth) || 1920)));
    settings.canvasHeight = Math.min(4320, Math.max(180, Math.round(Number(settings.canvasHeight) || 1080)));
    settings.canvasRatioWidth = Math.min(100, Math.max(1, Math.round(Number(settings.canvasRatioWidth) || 16)));
    settings.canvasRatioHeight = Math.min(100, Math.max(1, Math.round(Number(settings.canvasRatioHeight) || 9)));
    settings.canvasRatioLocked = settings.canvasRatioLocked !== false;
    const canvasShell = document.getElementById("canvasShell");
    const resizeCanvas = () => {
      if (!canvasShell) return;
      const scale = Math.min(window.innerWidth / settings.canvasWidth, window.innerHeight / settings.canvasHeight);
      canvasShell.style.width = settings.canvasWidth + "px";
      canvasShell.style.height = settings.canvasHeight + "px";
      canvasShell.style.transform = "translate(-50%, -50%) scale(" + scale + ")";
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas, { passive: true });
    settings.layoutMode = settings.layoutMode || "immersive";
    settings.sceneFit = ["cover", "contain", "stretch"].includes(settings.sceneFit) ? settings.sceneFit : "cover";
    settings.sceneScale = Math.min(400, Math.max(25, Number(settings.sceneScale) || 100));
    settings.sceneScaleX = Math.min(400, Math.max(25, Number(settings.sceneScaleX) || settings.sceneScale));
    settings.sceneScaleY = Math.min(400, Math.max(25, Number(settings.sceneScaleY) || settings.sceneScale));
    settings.sceneOffsetX = Math.min(100, Math.max(-100, Number(settings.sceneOffsetX) || 0));
    settings.sceneOffsetY = Math.min(100, Math.max(-100, Number(settings.sceneOffsetY) || 0));
    settings.sceneBackgroundVisible = settings.sceneBackgroundVisible !== false;
    settings.sceneBackgroundType = ["solid", "gradient", "image"].includes(settings.sceneBackgroundType) ? settings.sceneBackgroundType : "solid";
    settings.sceneBackgroundColor = String(settings.sceneBackgroundColor || "#020617");
    settings.sceneBackgroundGradientStart = String(settings.sceneBackgroundGradientStart || "#020617");
    settings.sceneBackgroundGradientEnd = String(settings.sceneBackgroundGradientEnd || "#0f172a");
    settings.sceneBackgroundGradientAngle = Number(settings.sceneBackgroundGradientAngle) || 135;
    settings.sceneBackgroundImageUrl = String(settings.sceneBackgroundImageUrl || "");
    settings.choicesPosition = settings.choicesPosition || "center";
    settings.showStartMenu = settings.showStartMenu !== false;
    settings.startMenuTemplate = ["cinematic", "minimal", "glass"].includes(settings.startMenuTemplate) ? settings.startMenuTemplate : "cinematic";
    settings.startMenuBackgroundType = ["solid", "gradient", "image"].includes(settings.startMenuBackgroundType) ? settings.startMenuBackgroundType : (settings.startMenuBackgroundImageUrl ? "image" : "gradient");
    settings.startMenuBackgroundColor = String(settings.startMenuBackgroundColor || "#070b12");
    settings.startMenuBackgroundGradientStart = String(settings.startMenuBackgroundGradientStart || "#0f172a");
    settings.startMenuBackgroundGradientEnd = String(settings.startMenuBackgroundGradientEnd || "#0891b2");
    settings.startMenuBackgroundGradientAngle = Number.isFinite(Number(settings.startMenuBackgroundGradientAngle)) ? Number(settings.startMenuBackgroundGradientAngle) : 135;
    ["startMenuBackground", "archiveBackground", "settingsBackground", "dialogueBackground"].forEach(function(prefix) {
      ["GradientStartX", "GradientStartY", "GradientEndX", "GradientEndY"].forEach(function(key) {
        const value = Number(settings[prefix + key]);
        settings[prefix + key] = Number.isFinite(value) ? clamp(value, 0, 100, 0) : undefined;
      });
    });
    settings.startMenuBackgroundImageUrl = String(settings.startMenuBackgroundImageUrl || "");
    settings.archiveBackgroundType = ["solid", "gradient", "image"].includes(settings.archiveBackgroundType) ? settings.archiveBackgroundType : settings.startMenuBackgroundType;
    settings.archiveBackgroundColor = String(settings.archiveBackgroundColor || settings.startMenuBackgroundColor);
    settings.archiveBackgroundGradientStart = String(settings.archiveBackgroundGradientStart || settings.startMenuBackgroundGradientStart);
    settings.archiveBackgroundGradientEnd = String(settings.archiveBackgroundGradientEnd || settings.startMenuBackgroundGradientEnd);
    settings.archiveBackgroundGradientAngle = Number.isFinite(Number(settings.archiveBackgroundGradientAngle)) ? Number(settings.archiveBackgroundGradientAngle) : settings.startMenuBackgroundGradientAngle;
    settings.archiveBackgroundImageUrl = String(settings.archiveBackgroundImageUrl || settings.startMenuBackgroundImageUrl || "");
    settings.settingsBackgroundType = ["solid", "gradient", "image"].includes(settings.settingsBackgroundType) ? settings.settingsBackgroundType : settings.startMenuBackgroundType;
    settings.settingsBackgroundColor = String(settings.settingsBackgroundColor || settings.startMenuBackgroundColor);
    settings.settingsBackgroundGradientStart = String(settings.settingsBackgroundGradientStart || settings.startMenuBackgroundGradientStart);
    settings.settingsBackgroundGradientEnd = String(settings.settingsBackgroundGradientEnd || settings.startMenuBackgroundGradientEnd);
    settings.settingsBackgroundGradientAngle = Number.isFinite(Number(settings.settingsBackgroundGradientAngle)) ? Number(settings.settingsBackgroundGradientAngle) : settings.startMenuBackgroundGradientAngle;
    settings.settingsBackgroundImageUrl = String(settings.settingsBackgroundImageUrl || settings.startMenuBackgroundImageUrl || "");
    settings.dialogueBackgroundType = ["solid", "gradient", "image"].includes(settings.dialogueBackgroundType) ? settings.dialogueBackgroundType : settings.startMenuBackgroundType;
    settings.dialogueBackgroundColor = String(settings.dialogueBackgroundColor || settings.startMenuBackgroundColor);
    settings.dialogueBackgroundGradientStart = String(settings.dialogueBackgroundGradientStart || settings.startMenuBackgroundGradientStart);
    settings.dialogueBackgroundGradientEnd = String(settings.dialogueBackgroundGradientEnd || settings.startMenuBackgroundGradientEnd);
    settings.dialogueBackgroundGradientAngle = Number.isFinite(Number(settings.dialogueBackgroundGradientAngle)) ? Number(settings.dialogueBackgroundGradientAngle) : settings.startMenuBackgroundGradientAngle;
    settings.dialogueBackgroundImageUrl = String(settings.dialogueBackgroundImageUrl || settings.startMenuBackgroundImageUrl || "");
    settings.flowOverviewBackgroundType = ["solid", "gradient", "image"].includes(settings.flowOverviewBackgroundType) ? settings.flowOverviewBackgroundType : "solid";
    settings.flowOverviewBackgroundColor = String(settings.flowOverviewBackgroundColor || "#f8fafc");
    settings.flowOverviewBackgroundGradientStart = String(settings.flowOverviewBackgroundGradientStart || "#f8fafc");
    settings.flowOverviewBackgroundGradientEnd = String(settings.flowOverviewBackgroundGradientEnd || "#e0e7ff");
    settings.flowOverviewBackgroundGradientAngle = Number.isFinite(Number(settings.flowOverviewBackgroundGradientAngle)) ? Number(settings.flowOverviewBackgroundGradientAngle) : 135;
    settings.flowOverviewBackgroundGradientShape = ["linear", "radial", "diamond"].includes(settings.flowOverviewBackgroundGradientShape) ? settings.flowOverviewBackgroundGradientShape : "linear";
    settings.flowOverviewBackgroundImageUrl = String(settings.flowOverviewBackgroundImageUrl || "");
    ["flowOverviewBackground"].forEach(function(prefix) {
      ["GradientStartX", "GradientStartY", "GradientEndX", "GradientEndY"].forEach(function(key) {
        const value = Number(settings[prefix + key]);
        settings[prefix + key] = Number.isFinite(value) ? clamp(value, 0, 100, 0) : undefined;
      });
    });
    settings.flowOverviewMusicUrl = String(settings.flowOverviewMusicUrl || settings.flowOverviewBackgroundMusicUrl || "");
    settings.flowOverviewBackgroundMusicUrl = String(settings.flowOverviewBackgroundMusicUrl || settings.flowOverviewMusicUrl || "");
    settings.flowOverviewMusicVolume = clamp(settings.flowOverviewMusicVolume, 0, 100, 70);
    settings.flowOverviewMusicFadeIn = clamp(settings.flowOverviewMusicFadeIn, 0, 10, 0);
    settings.flowOverviewMusicFadeOut = clamp(settings.flowOverviewMusicFadeOut, 0, 10, 0);
    settings.flowOverviewMusicLoop = settings.flowOverviewMusicLoop !== false;
    settings.flowOverviewElements = Array.isArray(settings.flowOverviewElements) ? settings.flowOverviewElements.filter(Boolean) : [];
    settings.flowOverviewLayoutDirection = ["right", "down", "left", "up"].includes(settings.flowOverviewLayoutDirection) ? settings.flowOverviewLayoutDirection : "right";
    settings.flowOverviewCardSizes = settings.flowOverviewCardSizes && typeof settings.flowOverviewCardSizes === "object" ? settings.flowOverviewCardSizes : {};
    settings.flowOverviewMinimapWidth = clamp(settings.flowOverviewMinimapWidth, 160, 440, 220);
    settings.flowOverviewMinimapHeight = clamp(settings.flowOverviewMinimapHeight, 110, 320, 160);
    settings.startMenuBackgroundMusicUrl = String(settings.startMenuBackgroundMusicUrl || "");
    settings.startMenuMusicVolume = clamp(settings.startMenuMusicVolume, 0, 100, 70);
    settings.startMenuMusicFadeIn = clamp(settings.startMenuMusicFadeIn, 0, 10, 0);
    settings.startMenuMusicFadeOut = clamp(settings.startMenuMusicFadeOut, 0, 10, 0);
    settings.startMenuMusicLoop = settings.startMenuMusicLoop !== false;
    settings.startMenuMusicApplyToArchive = settings.startMenuMusicApplyToArchive !== false;
    settings.startMenuMusicApplyToSettings = settings.startMenuMusicApplyToSettings !== false;
    settings.startMenuButtonPosition = ["center", "bottomLeft", "bottomRight"].includes(settings.startMenuButtonPosition) ? settings.startMenuButtonPosition : "center";
    settings.startMenuButtonLayout = settings.startMenuButtonLayout === "horizontal" ? "horizontal" : "vertical";
    settings.startMenuButtonSize = ["compact", "normal", "large"].includes(settings.startMenuButtonSize) ? settings.startMenuButtonSize : "normal";
    settings.startMenuElements = (Array.isArray(settings.startMenuElements) ? settings.startMenuElements : []).map((element) =>
      element && (element.role === "title" || element.role === "subtitle")
        ? Object.assign({}, element, { textAlign: "center" })
        : element,
    );
    if (settings.startMenuElements.length > 0 && !settings.startMenuElements.some((element) => element && element.role === "flowOverview")) {
      settings.startMenuElements.push({
        id: "system-flow-overview",
        kind: "button",
        role: "flowOverview",
        text: content.language === "zh" ? "流程图总览" : content.language === "ja" ? "フロー概要" : "Flow overview",
        visible: true,
        x: 33,
        y: 41,
        width: 34,
        height: 8,
        scale: 1,
        rotation: 0,
        primary: false,
      });
    }
    settings.settingsPageElements = Array.isArray(settings.settingsPageElements) ? settings.settingsPageElements.filter(Boolean) : [];
    settings.startMenuPlacementBoundsLocked = Boolean(settings.startMenuPlacementBoundsLocked);
    settings.startMenuPlacementMinX = clamp(settings.startMenuPlacementMinX, 0, 94, 0);
    settings.startMenuPlacementMinY = clamp(settings.startMenuPlacementMinY, 0, 96, 0);
    settings.startMenuPlacementMaxX = clamp(settings.startMenuPlacementMaxX, settings.startMenuPlacementMinX + 6, 100, 100);
    settings.startMenuPlacementMaxY = clamp(settings.startMenuPlacementMaxY, settings.startMenuPlacementMinY + 4, 100, 100);
    settings.startMenuShowSave = settings.startMenuShowSave !== false;
    settings.startMenuShowNewGame = settings.startMenuShowNewGame !== false;
    settings.startMenuShowSettings = settings.startMenuShowSettings !== false;
    settings.interactionMode = settings.interactionMode || "typewriter";
    settings.typewriterSpeed = clamp(settings.typewriterSpeed, 10, 200, 65);
    settings.autoAdvance = Boolean(settings.autoAdvance);
    settings.textScale = clamp(settings.textScale, 85, 130, 100);
    settings.animationSpeed = clamp(settings.animationSpeed, 0.5, 2, 1);
    settings.soundEnabled = settings.soundEnabled !== false;
    settings.videoAutoPlay = Boolean(settings.videoAutoPlay);
    settings.blurBackground = Boolean(settings.blurBackground);
    settings.skipSingleChoicePopup = settings.skipSingleChoicePopup !== false;
    function colorInputValue(value, fallback) {
      const raw = String(value || "").trim();
      if (/^#[0-9a-f]{6}$/i.test(raw)) return raw;
      const rgba = raw.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/i);
      if (!rgba) return fallback || "#111827";
      return "#" + [rgba[1], rgba[2], rgba[3]].map((channel) => Number(channel).toString(16).padStart(2, "0")).join("");
    }
    function withAlpha(color, alpha) {
      const normalized = colorInputValue(color, "#111827");
      const red = parseInt(normalized.slice(1, 3), 16);
      const green = parseInt(normalized.slice(3, 5), 16);
      const blue = parseInt(normalized.slice(5, 7), 16);
      return "rgba(" + red + ", " + green + ", " + blue + ", " + Math.max(0, Math.min(1, Number(alpha))) + ")";
    }
    function normalizeGradientStops(stops, startColor, endColor, startFallback, endFallback) {
      if (Array.isArray(stops) && stops.length >= 2) {
        return stops.map(function(stop, index) {
          return {
            id: String(stop && stop.id ? stop.id : "stop-" + index),
            color: colorInputValue(stop && stop.color, startFallback || "#0ea5e9"),
            alpha: Math.max(0, Math.min(100, Number(stop && stop.alpha) || 0)),
            position: Math.max(0, Math.min(100, Number(stop && stop.position) || 0))
          };
        }).sort(function(a, b) { return a.position - b.position; });
      }
      return [
        { id: "start", color: colorInputValue(startColor, startFallback || "#0ea5e9"), alpha: 100, position: 0 },
        { id: "end", color: colorInputValue(endColor, endFallback || "#0f172a"), alpha: 100, position: 100 }
      ];
    }
    function gradientStopsCss(stops) {
      return stops.map(function(stop) {
        return withAlpha(stop.color, stop.alpha / 100) + " " + stop.position + "%";
      }).join(", ");
    }
    function linearGradientFromStops(angle, stops) {
      return "linear-gradient(" + angle + "deg, " + gradientStopsCss(stops) + ")";
    }
    function gradientFromStops(shape, angle, stops, geometry) {
      // Geometry is an editor direction handle. Its angle is already persisted separately;
      // its length must not shift color stops and create a large first-color band.
      void geometry;
      const cssStops = gradientStopsCss(stops);
      if (shape === "radial") return "radial-gradient(circle at center, " + cssStops + ")";
      if (shape === "diamond") return "conic-gradient(from " + angle + "deg at center, " + cssStops + ")";
      return "linear-gradient(" + angle + "deg, " + cssStops + ")";
    }
    function px(value, fallback) {
      const number = Number(value);
      return (Number.isFinite(number) ? number : fallback) + "px";
    }
    function percent(value, fallback) {
      const number = Number(value);
      return (Number.isFinite(number) ? number : fallback) + "%";
    }
    function clamp(value, min, max, fallback) {
      const number = Number(value);
      if (!Number.isFinite(number)) return fallback;
      return Math.min(max, Math.max(min, number));
    }
    function styleColor(color, alpha, fallback) {
      const numericAlpha = Number(alpha);
      return withAlpha(color || fallback, Number.isFinite(numericAlpha) ? numericAlpha / 100 : 1);
    }
    function customShadow(element, target) {
      if (element.shadowEnabled === false) return "";
      const shadows = Array.isArray(element.shadows) && element.shadows.length
        ? element.shadows.slice(0, 6)
        : [{ color: element.shadowColor, opacity: element.shadowOpacity, blur: element.shadowBlur, offsetX: element.shadowOffsetX, offsetY: element.shadowOffsetY }];
      return shadows.filter(function(shadow) { return shadow && shadow.enabled !== false && clamp(shadow.opacity, 0, 100, 0) > 0; }).map(function(shadow) {
        const opacity = clamp(shadow.opacity, 0, 100, 0);
        const x = Number.isFinite(Number(shadow.offsetX)) ? Number(shadow.offsetX) : 0;
        const y = Number.isFinite(Number(shadow.offsetY)) ? Number(shadow.offsetY) : (target === "text" ? 2 : 8);
        const blur = Number.isFinite(Number(shadow.blur)) ? Number(shadow.blur) : 18;
        return x + "px " + y + "px " + blur + "px " + styleColor(shadow.color, opacity, "#000000");
      }).join(", ");
    }
    function customBoxShadow(element) {
      if (element.shadowEnabled === false) return "";
      const shadows = Array.isArray(element.shadows) && element.shadows.length
        ? element.shadows.slice(0, 6)
        : [{ type: element.shadowType, color: element.shadowColor, opacity: element.shadowOpacity, blur: element.shadowBlur, offsetX: element.shadowOffsetX, offsetY: element.shadowOffsetY }];
      return shadows.filter(function(shadow) { return shadow && shadow.enabled !== false && clamp(shadow.opacity, 0, 100, 0) > 0; }).map(function(shadow) {
        const opacity = clamp(shadow.opacity, 0, 100, 0);
        const x = Number.isFinite(Number(shadow.offsetX)) ? Number(shadow.offsetX) : 0;
        const y = Number.isFinite(Number(shadow.offsetY)) ? Number(shadow.offsetY) : 8;
        const blur = Number.isFinite(Number(shadow.blur)) ? Number(shadow.blur) : 18;
        const color = styleColor(shadow.color, opacity, "#000000");
        if (shadow.type === "inner") return "inset " + x + "px " + y + "px " + blur + "px " + color;
        if (shadow.type === "innerBlur") return "inset 0 0 " + blur + "px " + color;
        return x + "px " + y + "px " + blur + "px " + color;
      }).join(", ");
    }
    function borderGradient(element) {
      return linearGradientFromStops(Number(element.borderGradientAngle) || 135, normalizeGradientStops(element.borderGradientStops, element.borderGradientStart || element.borderColor || "#ffffff", element.borderGradientEnd || "#4f46e5"));
    }
    ${appearanceRuntimeScript}
    function applyCustomBoxEffects(target, element) {
      if(element.appearance){gwAppearance(target,element.appearance);return;}
      const width = element.strokeEnabled === false ? 0 : Math.max(0, Number(element.borderWidth) || 0);
      const shadows = [];
      target.style.border = "";
      target.style.borderImage = "";
      target.style.outline = "";
      target.style.outlineOffset = "";
      target.style.boxSizing = "border-box";
      if (width > 0) {
        if (element.borderType === "gradient") {
          target.style.border = width + "px solid transparent";
          target.style.borderImage = borderGradient(element) + " 1";
        } else {
          const color = element.borderColor || "#ffffff";
          if (element.borderPosition === "inside") {
            target.style.border = "0";
            shadows.push("inset 0 0 0 " + width + "px " + color);
          } else if (element.borderPosition === "outside") {
            target.style.border = "0";
            target.style.outline = width + "px solid " + color;
            target.style.outlineOffset = "0";
          } else {
            target.style.border = "0";
            const halfWidth = width / 2;
            shadows.push("inset 0 0 0 " + halfWidth + "px " + color);
            shadows.push("0 0 0 " + halfWidth + "px " + color);
          }
        }
      }
      const shadow = customBoxShadow(element);
      if (shadow) shadows.push(shadow);
      target.style.boxShadow = shadows.join(", ");
    }
    function applyElementRadius(target, element, fallback) {
      const base = Number.isFinite(Number(element.borderRadius)) ? Number(element.borderRadius) : fallback;
      target.style.borderRadius = base + "px";
      target.style.borderTopLeftRadius = (Number.isFinite(Number(element.borderTopLeftRadius)) ? Number(element.borderTopLeftRadius) : base) + "px";
      target.style.borderTopRightRadius = (Number.isFinite(Number(element.borderTopRightRadius)) ? Number(element.borderTopRightRadius) : base) + "px";
      target.style.borderBottomRightRadius = (Number.isFinite(Number(element.borderBottomRightRadius)) ? Number(element.borderBottomRightRadius) : base) + "px";
      target.style.borderBottomLeftRadius = (Number.isFinite(Number(element.borderBottomLeftRadius)) ? Number(element.borderBottomLeftRadius) : base) + "px";
    }
    function applyTextPaint(target, element, fallbackColor) {
      if (element.textColorType === "gradient") {
        target.style.color = "transparent";
        target.style.backgroundImage = linearGradientFromStops(Number(element.textGradientAngle) || 90, normalizeGradientStops(element.textGradientStops, element.textGradientStart || element.textColor || "#ffffff", element.textGradientEnd || "#0ea5e9"));
        target.style.backgroundClip = "text";
        target.style.webkitBackgroundClip = "text";
        target.style.webkitTextFillColor = "transparent";
      } else {
        target.style.color = styleColor(element.textColor, element.textColorAlpha, fallbackColor || "#ffffff");
      }
      if (element.textBlendMode) target.style.mixBlendMode = element.textBlendMode;
    }
    function applyCustomTextStyle(target, element) {
      if (element.textVisible === false) target.textContent = "";
      if (Number.isFinite(Number(element.fontSize))) target.style.fontSize = Number(element.fontSize) + "px";
      if (Number.isFinite(Number(element.fontWeight))) target.style.fontWeight = String(Number(element.fontWeight));
      if (element.fontFamily) target.style.fontFamily = element.fontFamily;
      applyTextPaint(target, element, "#ffffff");
      if (element.textStrokeTarget !== "box" && element.strokeEnabled !== false && Number(element.textStrokeWidth) > 0) {
        target.style.webkitTextStroke = Number(element.textStrokeWidth) + "px " + (element.textStrokeColor || "#000000");
      }
      const shadow = customShadow(element, "text");
      if (shadow) target.style.textShadow = shadow;
      if (Number.isFinite(Number(element.letterSpacing))) target.style.letterSpacing = Number(element.letterSpacing) + "px";
      if (Number.isFinite(Number(element.lineHeight))) target.style.lineHeight = String(Number(element.lineHeight));
      if (element.textAlign) {
        target.style.textAlign = element.textAlign;
        target.style.justifyContent = element.textAlign === "center" ? "center" : element.textAlign === "right" ? "flex-end" : "flex-start";
      }
      applyElementRadius(target, element, 0);
      if (element.textStrokeTarget === "box") applyCustomBoxEffects(target, element);
    }
    function applyCustomButtonTextStyle(target, element, fallbackColor) {
      if (element.textVisible === false) target.textContent = "";
      if (Number.isFinite(Number(element.fontSize))) target.style.fontSize = Number(element.fontSize) + "px";
      if (Number.isFinite(Number(element.fontWeight))) target.style.fontWeight = String(Number(element.fontWeight));
      if (element.fontFamily) target.style.fontFamily = element.fontFamily;
      target.style.color = styleColor(element.textColor, element.textColorAlpha, fallbackColor || "#ffffff");
      if (Number.isFinite(Number(element.letterSpacing))) target.style.letterSpacing = Number(element.letterSpacing) + "px";
      if (Number.isFinite(Number(element.lineHeight))) target.style.lineHeight = String(Number(element.lineHeight));
      target.style.display = "flex";
      target.style.alignItems = "center";
      const align = element.textAlign || "center";
      target.style.textAlign = align;
      target.style.justifyContent = align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";
      target.style.whiteSpace = "pre-wrap";
    }
    function dialogueBackground() {
      if (style.dialogBackgroundType === "image" && style.dialogImageUrl) {
        return 'url("' + String(style.dialogImageUrl).replace(/"/g, '\\\\"') + '") center / cover';
      }
      if (style.dialogBackgroundType === "gradient") {
        const stops = Array.isArray(style.dialogGradientStops) && style.dialogGradientStops.length >= 2
          ? style.dialogGradientStops.slice().sort((a, b) => Number(a.position) - Number(b.position))
          : [
              { color: colorInputValue(style.dialogGradientStartColor, "#111827"), alpha: 0, position: 0 },
              { color: colorInputValue(style.dialogGradientColor, "#111827"), alpha: 86, position: 100 },
            ];
        const cssStops = stops.map((stop) => withAlpha(stop.color, Number(stop.alpha) / 100) + " " + clamp(stop.position, 0, 100, 0) + "%").join(", ");
        return "linear-gradient(" + clamp(style.dialogGradientAngle, 0, 360, 90) + "deg, " + cssStops + ")";
      }
      return withAlpha(style.panelColor || "#111827", (Number(style.panelColorAlpha ?? 82) || 82) / 100);
    }
    function nameplateBackground() {
      if (style.nameplateBackgroundType === "image" && style.nameplateImageUrl) {
        return 'url("' + String(style.nameplateImageUrl).replace(/"/g, '\\\\"') + '") center / cover';
      }
      if (style.nameplateBackgroundType === "gradient") {
        const stops = Array.isArray(style.nameplateGradientStops) && style.nameplateGradientStops.length >= 2
          ? style.nameplateGradientStops.slice().sort((a, b) => Number(a.position) - Number(b.position))
          : [
              { color: "#1e3a8a", alpha: 94, position: 0 },
              { color: "#0f172a", alpha: 94, position: 100 },
            ];
        const cssStops = stops.map((stop) => withAlpha(stop.color, Number(stop.alpha) / 100) + " " + clamp(stop.position, 0, 100, 0) + "%").join(", ");
        return "linear-gradient(" + clamp(style.nameplateGradientAngle, 0, 360, 90) + "deg, " + cssStops + ")";
      }
      return withAlpha(style.nameplateColor || "#172554", (Number(style.nameplateColorAlpha ?? 94) || 94) / 100);
    }
    const renderObjects = style.renderObjects || {};
    const dialogObject = renderObjects.dialogBox || {};
    const titleObject = renderObjects.title || {};
    const bodyObject = renderObjects.body || {};
    const nameplateObject = renderObjects.nameplate || {};
    const choiceObject = renderObjects.choice || {};
    function objectFill(object, fallback) {
      const fill = object.fill || {};
      if (fill.type === "gradient") {
        const stops = Array.isArray(fill.gradientStops) && fill.gradientStops.length
          ? fill.gradientStops
          : [{ color: fill.color || fallback, alpha: fill.alpha == null ? 100 : fill.alpha, position: 0 }, { color: fill.color || fallback, alpha: fill.alpha == null ? 100 : fill.alpha, position: 100 }];
        return "linear-gradient(" + clamp(fill.gradientAngle, 0, 360, 90) + "deg, " + stops.map(function(stop) { return withAlpha(stop.color || fallback, clamp(stop.alpha, 0, 100, 100) / 100) + " " + clamp(stop.position, 0, 100, 0) + "%"; }).join(", ") + ")";
      }
      if (fill.type === "image" && fill.imageUrl) return 'url("' + String(fill.imageUrl).replace(/"/g, '\\"') + '")';
      return withAlpha(fill.color || fallback, clamp(fill.alpha, 0, 100, 100) / 100);
    }
    function objectShadow(object) {
      const layers = Array.isArray(object.shadows) && object.shadows.length ? object.shadows : (object.shadow ? [object.shadow] : []);
      return layers.filter(function(shadow) { return shadow && shadow.enabled !== false && clamp(shadow.alpha, 0, 100, 0) > 0; }).map(function(shadow) {
        const inset = shadow.type === "outer" ? "" : "inset ";
        const x = shadow.type === "innerBlur" ? 0 : (Number(shadow.x) || 0);
        const y = shadow.type === "innerBlur" ? 0 : (Number(shadow.y) || 0);
        return inset + x + "px " + y + "px " + (Number(shadow.blur) || 0) + "px " + (Number(shadow.spread) || 0) + "px " + withAlpha(shadow.color || "#000000", clamp(shadow.alpha, 0, 100, 0) / 100);
      }).join(", ");
    }
    function objectTransform(object) {
      const x = Number(object.x) || 0;
      const y = Number(object.y) || 0;
      const rotation = Number(object.rotation) || 0;
      const flipX = object.flipX ? -1 : 1;
      const flipY = object.flipY ? -1 : 1;
      return "translate(" + x + "px, " + y + "px) rotate(" + rotation + "deg) scale(" + flipX + ", " + flipY + ")";
    }
    function dialogueLayout() {
      return content.nodes.find(node => node.data && node.data.dialogueText)?.data.dialogueText.dialog
        || { x: 0, y: 0, width: settings.canvasWidth, height: settings.canvasHeight, paddingX: 0 };
    }
    const resolvedDialogLayout = dialogueLayout();
    const presentationTextScale = Math.min(8, Math.max(0.25, settings.canvasHeight / 720)) * (settings.textScale / 100);
    document.documentElement.style.setProperty("--title-size", Math.max(18, (Number(titleObject.fontSize ?? style.titleFontSize) || 18) * presentationTextScale) + "px");
    document.documentElement.style.setProperty("--body-size", Math.max(16, (Number(bodyObject.fontSize ?? style.bodyFontSize) || 18) * presentationTextScale) + "px");
    document.documentElement.style.setProperty("--title-color", objectFill(titleObject, "#f8fafc"));
    document.documentElement.style.setProperty("--body-color", objectFill(bodyObject, "#e5e7eb"));
    document.documentElement.style.setProperty("--title-fill", objectFill(titleObject, "#f8fafc"));
    document.documentElement.style.setProperty("--body-fill", objectFill(bodyObject, "#e5e7eb"));
    document.documentElement.style.setProperty("--title-shadow", objectShadow(titleObject) || "none");
    document.documentElement.style.setProperty("--body-shadow", objectShadow(bodyObject) || "none");
    document.documentElement.style.setProperty("--title-font-family", titleObject.fontFamily || style.titleFontFamily || "inherit");
    document.documentElement.style.setProperty("--body-font-family", bodyObject.fontFamily || style.bodyFontFamily || "inherit");
    document.documentElement.style.setProperty("--title-line-height", String(Number(titleObject.lineHeight ?? style.titleLineHeight) || 1.18));
    document.documentElement.style.setProperty("--body-line-height", String(Number(bodyObject.lineHeight ?? style.bodyLineHeight) || 1.55));
    document.documentElement.style.setProperty("--title-letter-spacing", ((Number(titleObject.letterSpacing ?? style.titleLetterSpacing) || 0) * presentationTextScale) + "px");
    document.documentElement.style.setProperty("--body-letter-spacing", ((Number(bodyObject.letterSpacing ?? style.bodyLetterSpacing) || 0) * presentationTextScale) + "px");
    document.documentElement.style.setProperty("--title-align", titleObject.textAlign || style.titleAlign || "left");
    document.documentElement.style.setProperty("--body-align", bodyObject.textAlign || style.bodyAlign || "left");
    document.documentElement.style.setProperty("--title-width", percent(clamp(titleObject.width, 8, 100, 100), 100));
    document.documentElement.style.setProperty("--body-width", percent(clamp(bodyObject.width, 8, 100, 100), 100));
    document.documentElement.style.setProperty("--title-height", px(clamp(titleObject.height, 8, 320, 24), 24));
    document.documentElement.style.setProperty("--body-height", px(clamp(bodyObject.height, 8, 420, 64), 64));
    document.documentElement.style.setProperty("--title-transform", objectTransform(titleObject));
    document.documentElement.style.setProperty("--body-transform", objectTransform(bodyObject));
    document.documentElement.style.setProperty("--title-stroke", titleObject.stroke && titleObject.stroke.enabled ? (Number(titleObject.stroke.width) || 0) + "px " + colorInputValue(titleObject.stroke.color, "#000000") : "0 transparent");
    document.documentElement.style.setProperty("--body-stroke", bodyObject.stroke && bodyObject.stroke.enabled ? (Number(bodyObject.stroke.width) || 0) + "px " + colorInputValue(bodyObject.stroke.color, "#000000") : "0 transparent");
    document.documentElement.style.setProperty("--dialog-border-color", style.dialogVisible === false ? "transparent" : (dialogObject.stroke && dialogObject.stroke.enabled ? withAlpha(dialogObject.stroke.color || "#ffffff", clamp(dialogObject.stroke.alpha, 0, 100, 100) / 100) : "rgba(255,255,255,0.14)"));
    document.documentElement.style.setProperty("--dialog-border-width", dialogObject.stroke && dialogObject.stroke.enabled ? (Number(dialogObject.stroke.width) || 0) + "px" : "1px");
    document.documentElement.style.setProperty("--dialog-shadow", style.dialogVisible === false ? "none" : (objectShadow(dialogObject) || "0 24px 80px rgba(0,0,0,0.30)"));
    document.documentElement.style.setProperty("--dialog-backdrop-filter", style.dialogVisible === false ? "none" : "blur(18px)");
    document.documentElement.style.setProperty("--dialog-width", resolvedDialogLayout.width + "px");
    document.documentElement.style.setProperty("--dialog-height", resolvedDialogLayout.height + "px");
    document.documentElement.style.setProperty("--dialog-radius", px(dialogObject.radius ?? style.dialogRadius, 24));
    document.documentElement.style.setProperty("--dialog-padding-x", resolvedDialogLayout.paddingX + "px");
    document.documentElement.style.setProperty("--dialog-left", resolvedDialogLayout.x + "px");
    document.documentElement.style.setProperty("--dialog-top", resolvedDialogLayout.y + "px");
    document.documentElement.style.setProperty("--dialog-object-transform", "rotate(" + (Number(dialogObject.rotation) || 0) + "deg) scale(" + (dialogObject.flipX ? -1 : 1) + ", " + (dialogObject.flipY ? -1 : 1) + ")");
    document.documentElement.style.setProperty("--dialog-background", style.dialogVisible === false ? "transparent" : objectFill(dialogObject, "#111827"));
    const nameplateFontSize = Math.max(10, Number(nameplateObject.fontSize ?? style.nameplateFontSize) || 18);
    const nameplateScale = clamp(nameplateObject.width ?? style.nameplateScale, 55, 320, 100) / 100;
    document.documentElement.style.setProperty("--nameplate-font-size", nameplateFontSize + "px");
    document.documentElement.style.setProperty("--nameplate-font-family", nameplateObject.fontFamily || style.nameplateFontFamily || style.titleFontFamily || "inherit");
    document.documentElement.style.setProperty("--nameplate-width", px(clamp(nameplateObject.width ?? style.nameplateScale, 55, 520, 100), 100));
    document.documentElement.style.setProperty("--nameplate-height", px(clamp(nameplateObject.height, 8, 240, 50), 50));
    document.documentElement.style.setProperty("--nameplate-padding-x", Math.round(nameplateFontSize * 1.15 * nameplateScale) + "px");
    document.documentElement.style.setProperty("--nameplate-padding-y", Math.round(nameplateFontSize * 0.42 * nameplateScale) + "px");
    document.documentElement.style.setProperty("--nameplate-row-height", Math.ceil(nameplateFontSize + Math.round(nameplateFontSize * 0.42 * nameplateScale) * 2 + Math.max(8, nameplateFontSize * 0.45)) + "px");
    document.documentElement.style.setProperty("--nameplate-text-gap", px(style.nameplateTextGap, 8));
    document.documentElement.style.setProperty("--nameplate-radius", px(nameplateObject.radius ?? style.nameplateRadius, 14));
    document.documentElement.style.setProperty("--nameplate-color", styleColor(style.nameplateTextColor, style.nameplateTextColorAlpha ?? 100, "#ffffff"));
    document.documentElement.style.setProperty("--nameplate-background", nameplateBackground());
    document.documentElement.style.setProperty("--nameplate-offset-x", px(nameplateObject.x ?? style.nameplateOffsetX, 0));
    document.documentElement.style.setProperty("--nameplate-offset-y", px(nameplateObject.y ?? style.nameplateOffsetY, 0));
    document.documentElement.style.setProperty("--nameplate-top", style.nameplateInside ? "8px" : "0");
    document.documentElement.style.setProperty("--nameplate-object-transform", "rotate(" + (Number(nameplateObject.rotation) || 0) + "deg) scale(" + (nameplateObject.flipX ? -1 : 1) + ", " + (nameplateObject.flipY ? -1 : 1) + ")");
    document.documentElement.style.setProperty("--nameplate-translate-y", style.nameplateInside ? px(nameplateObject.y ?? style.nameplateOffsetY, 0) : "calc(-100% - 8px + " + px(nameplateObject.y ?? style.nameplateOffsetY, 0) + ")");
    document.documentElement.style.setProperty("--choice-color", style.choiceColor || "#0ea5e9");
    document.documentElement.style.setProperty("--choice-text-color", style.choiceTextColor || "#ffffff");
    document.documentElement.style.setProperty("--choice-gap", (Number(style.choiceGap ?? 8) || 8) + "px");
    document.documentElement.style.setProperty("--choice-width", clamp(choiceObject.width, 8, 100, 86) + "%");
    document.documentElement.style.setProperty("--choice-left", (Number(choiceObject.x) || 0) + "px");
    document.documentElement.style.setProperty("--choice-top", (Number(choiceObject.y) || 0) + "px");
    document.documentElement.style.setProperty("--choice-height", Math.max(0, Number(choiceObject.height) || 0) + "px");
    document.documentElement.style.setProperty("--choice-button-height", Math.max(24, Number(choiceObject.height) || 40) + "px");
    document.documentElement.style.setProperty("--choice-radius", Math.max(0, Number(choiceObject.radius) || 8) + "px");
    document.documentElement.style.setProperty("--choice-background", objectFill(choiceObject, style.choiceColor || "#0ea5e9"));
    document.documentElement.style.setProperty("--choice-border-color", choiceObject.stroke && choiceObject.stroke.enabled ? withAlpha(choiceObject.stroke.color || "#7dd3fc", clamp(choiceObject.stroke.alpha, 0, 100, 72) / 100) : "transparent");
    document.documentElement.style.setProperty("--choice-shadow", objectShadow(choiceObject) || "none");
    document.documentElement.style.setProperty("--choice-font-family", choiceObject.fontFamily || style.bodyFontFamily || "inherit");
    document.documentElement.style.setProperty("--choice-font-size", Math.max(10, Number(choiceObject.fontSize) || 18) + "px");
    document.documentElement.style.setProperty("--choice-font-weight", String(Number(choiceObject.fontWeight) || 700));
    document.documentElement.style.setProperty("--choice-letter-spacing", (Number(choiceObject.letterSpacing) || 0) + "px");
    document.documentElement.style.setProperty("--choice-line-height", String(Number(choiceObject.lineHeight) || 1.35));
    document.documentElement.style.setProperty("--choice-transform", "rotate(" + (Number(choiceObject.rotation) || 0) + "deg) scale(" + (choiceObject.flipX ? -1 : 1) + ", " + (choiceObject.flipY ? -1 : 1) + ")");
    const labels = content.language === "zh"
      ? { back: "\\u8fd4\\u56de", reset: "\\u91cd\\u5f00", mainMenu: "\\u4e3b\\u754c\\u9762", autoOn: "\\u81ea\\u52a8\\u64ad\\u653e", autoOff: "\\u624b\\u52a8\\u64ad\\u653e", make: "\\u5236\\u4f5c\\u540c\\u6b3e", continue: "\\u7ee7\\u7eed\\u6e38\\u620f", option: "\\u9009\\u9879", end: "\\u5267\\u672c\\u7ed3\\u675f", noStory: "\\u6ca1\\u6709\\u53ef\\u9884\\u89c8\\u7684\\u5267\\u672c", playlist: "\\u58f0\\u97f3\\u56de\\u653e", playlistHint: "\\u6700\\u8fd1\\u542c\\u8fc7\\u7684\\u5f55\\u97f3\\u6392\\u5728\\u6700\\u4e0a\\u65b9", playlistEmpty: "\\u542c\\u8fc7\\u7684\\u5f55\\u97f3\\u4f1a\\u663e\\u793a\\u5728\\u8fd9\\u91cc", untitledAudio: "\\u672a\\u547d\\u540d\\u5f55\\u97f3", saveSlot: "\\u5b58\\u6863", noSave: "\\u6ca1\\u6709\\u5b58\\u6863", newGame: "\\u65b0\\u6e38\\u620f", settings: "\\u8bbe\\u7f6e", savedAt: "\\u4e0a\\u6b21\\u8fdb\\u5ea6", saved: "\\u5df2\\u5b58\\u6863", archive: "\\u5b58\\u6863\\u5217\\u8868", deleteSave: "\\u5220\\u9664", autoPlay: "\\u81ea\\u52a8\\u64ad\\u653e", textSpeed: "\\u6253\\u5b57\\u901f\\u5ea6", controls: "\\u663e\\u793a\\u63a7\\u4ef6" }
      : content.language === "ja"
        ? { back: "\\u623b\\u308b", reset: "\\u3084\\u308a\\u76f4\\u3059", mainMenu: "\\u30e1\\u30a4\\u30f3", autoOn: "\\u81ea\\u52d5\\u518d\\u751f", autoOff: "\\u624b\\u52d5\\u518d\\u751f", make: "\\u540c\\u3058\\u3082\\u306e\\u3092\\u4f5c\\u308b", continue: "\\u7d9a\\u3051\\u308b", option: "\\u9078\\u629e\\u80a2", end: "\\u7d42\\u4e86", noStory: "\\u30d7\\u30ec\\u30d3\\u30e5\\u30fc\\u3067\\u304d\\u308b\\u811a\\u672c\\u304c\\u3042\\u308a\\u307e\\u305b\\u3093", playlist: "\\u97f3\\u58f0\\u518d\\u751f", playlistHint: "\\u6700\\u8fd1\\u8074\\u3044\\u305f\\u9332\\u97f3\\u3092\\u4e0a\\u306b\\u8868\\u793a", playlistEmpty: "\\u518d\\u751f\\u3057\\u305f\\u9332\\u97f3\\u304c\\u3053\\u3053\\u306b\\u8868\\u793a\\u3055\\u308c\\u307e\\u3059", untitledAudio: "\\u540d\\u79f0\\u672a\\u8a2d\\u5b9a\\u306e\\u9332\\u97f3", saveSlot: "\\u30bb\\u30fc\\u30d6", noSave: "\\u30bb\\u30fc\\u30d6\\u306a\\u3057", newGame: "\\u65b0\\u898f\\u30b2\\u30fc\\u30e0", settings: "\\u8a2d\\u5b9a", savedAt: "\\u524d\\u56de\\u306e\\u9032\\u6357", saved: "\\u30bb\\u30fc\\u30d6\\u6e08\\u307f", autoPlay: "\\u81ea\\u52d5\\u518d\\u751f", textSpeed: "\\u30c6\\u30ad\\u30b9\\u30c8\\u901f\\u5ea6", controls: "\\u64cd\\u4f5c\\u8868\\u793a" }
        : { back: "Back", reset: "Restart", mainMenu: "Menu", autoOn: "Auto Play", autoOff: "Manual", make: "Make One", continue: "Continue Game", option: "Option", end: "The End", noStory: "No story to preview", playlist: "Audio replay", playlistHint: "Most recently heard first", playlistEmpty: "Audio you have heard will appear here", untitledAudio: "Untitled audio", saveSlot: "Saves", noSave: "No save", newGame: "New Game", settings: "Settings", savedAt: "Last progress", saved: "Saved", archive: "Save slots", deleteSave: "Delete", autoPlay: "Auto play", textSpeed: "Text speed", controls: "Show controls" };
    labels.flowOverview = content.language === "zh" ? "\\u6d41\\u7a0b\\u56fe\\u603b\\u89c8" : content.language === "ja" ? "\\u30d5\\u30ed\\u30fc\\u6982\\u8981" : "Flow overview";
    const nodeById = new Map(content.nodes.map((node) => [node.id, node]));
    const root = content.nodes.find((node) => node.data && node.data.isRoot) || content.nodes[0] || null;
    let currentId = root ? root.id : null;
    let history = [];

    const titleEl = document.getElementById("projectTitle");
    const stageEl = document.getElementById("stage");
    const backdropEl = document.getElementById("backdrop");
    const backButton = document.getElementById("backButton");
    const resetButton = document.getElementById("resetButton");
    const mainMenuButton = document.getElementById("mainMenuButton");
    const autoButton = document.getElementById("autoButton");
    const playlistButton = document.getElementById("playlistButton");
    const playlistBackdrop = document.getElementById("playlistBackdrop");
    const playlistPanel = document.getElementById("playlistPanel");
    const playlistClose = document.getElementById("playlistClose");
    const playlistTitle = document.getElementById("playlistTitle");
    const playlistHint = document.getElementById("playlistHint");
    const playlistItems = document.getElementById("playlistItems");
    const playlistAudio = document.getElementById("playlistAudio");
    const makeButton = document.getElementById("makeButton");
    const zenButton = document.getElementById("zenButton");
    const startScreen = document.getElementById("startScreen");
    const startTitle = document.getElementById("startTitle");
    const startSubtitle = document.getElementById("startSubtitle");
    const startActions = document.querySelector(".start-actions");
    const startPanel = document.querySelector(".start-panel");
    const startLayer = document.getElementById("startLayer");
    const startMenuAudio = document.getElementById("startMenuAudio");
    const continueGameButton = document.getElementById("continueGameButton");
    const flowOverviewButton = document.getElementById("flowOverviewButton");
    const saveSlotButton = document.getElementById("saveSlotButton");
    const newGameButton = document.getElementById("newGameButton");
    const settingsButton = document.getElementById("settingsButton");
    const flowOverviewBackdrop = document.getElementById("flowOverviewBackdrop");
    const flowOverviewPanel = document.getElementById("flowOverviewPanel");
    const flowOverviewClose = document.getElementById("flowOverviewClose");
    const flowOverviewViewport = document.getElementById("flowOverviewViewport");
    const flowOverviewCanvas = document.getElementById("flowOverviewCanvas");
    const flowOverviewCustomLayer = document.getElementById("flowOverviewCustomLayer");
    const flowOverviewMinimap = document.getElementById("flowOverviewMinimap");
    const flowOverviewAudio = document.getElementById("flowOverviewAudio");
    const flowOverviewDetail = document.getElementById("flowOverviewDetail");
    const saveBackdrop = document.getElementById("saveBackdrop");
    const saveTitle = document.getElementById("saveTitle");
    const saveClose = document.getElementById("saveClose");
    const saveList = document.getElementById("saveList");
    const settingsBackdrop = document.getElementById("settingsBackdrop");
    gwAppearance(startScreen,settings.surfaceAppearances?.start);
    gwAppearance(saveBackdrop,settings.surfaceAppearances?.archive);
    gwAppearance(settingsBackdrop,settings.surfaceAppearances?.settings);
    gwAppearance(flowOverviewPanel,settings.surfaceAppearances?.flow);

    const playerSettingsRoot = document.getElementById("playerSettingsRoot");
    const settingsCustomLayer = document.getElementById("settingsCustomLayer");
    const playbackToolbar = document.getElementById("playbackToolbar");
    document.querySelector('.app').classList.add('has-playback-toolbar');
    // The playlist stays interactive when the obsolete header is hidden.
    canvasShell.appendChild(playlistBackdrop);
    settings.previewToolbarElements = Array.isArray(settings.previewToolbarElements) ? settings.previewToolbarElements : [];
    titleEl.textContent = content.title || "GalWriter";
    startTitle.textContent = content.title || "GalWriter";
    if (settings.startMenuBackgroundMusicUrl) {
      startMenuAudio.src = settings.startMenuBackgroundMusicUrl;
      startMenuAudio.volume = Math.max(0, Math.min(1, Number(settings.startMenuMusicVolume) / 100));
      startMenuAudio.loop = Boolean(settings.startMenuMusicLoop);
    }
    startScreen.classList.add("template-" + settings.startMenuTemplate);
    startScreen.classList.add("buttons-" + settings.startMenuButtonPosition.replace(/[A-Z]/g, (char) => "-" + char.toLowerCase()));
    startScreen.classList.add("button-size-" + settings.startMenuButtonSize);
    startScreen.classList.toggle("has-custom-elements", settings.startMenuElements.length > 0);
    function applySurfaceBackground(target, prefix) {
      if (!target) return;
      const type = settings[prefix + "Type"];
      const imageUrl = String(settings[prefix + "ImageUrl"] || "");
      target.style.background = "";
      target.style.backgroundImage = "";
      if (type === "image" && imageUrl) {
        target.style.backgroundImage = 'url("' + imageUrl.replace(/"/g, '\\"') + '")';
        target.style.backgroundPosition = "center";
        target.style.backgroundSize = "cover";
      } else if (type === "gradient") {
        target.style.background = gradientFromStops(settings[prefix + "GradientShape"], settings[prefix + "GradientAngle"], normalizeGradientStops(settings[prefix + "GradientStops"], settings[prefix + "GradientStart"], settings[prefix + "GradientEnd"], "#0f172a", "#0891b2"), { startX: settings[prefix + "GradientStartX"], startY: settings[prefix + "GradientStartY"], endX: settings[prefix + "GradientEndX"], endY: settings[prefix + "GradientEndY"] });
      } else if (type === "solid") {
        target.style.background = settings[prefix + "Color"];
      }
    }
    applySurfaceBackground(startScreen, "startMenuBackground");
    if (!settings.surfaceAppearances?.settings) applySurfaceBackground(settingsBackdrop, "settingsBackground");
    applySurfaceBackground(document.querySelector(".app"), "dialogueBackground");
    applySurfaceBackground(flowOverviewPanel, "flowOverviewBackground");
    applySurfaceBackground(flowOverviewViewport, "flowOverviewBackground");
    startActions.classList.toggle("horizontal", settings.startMenuButtonLayout === "horizontal");
    backButton.innerHTML = '<img src="./icons/arrow-left.svg" alt="" /><span>' + labels.back + '</span>';
    resetButton.innerHTML = '<img src="./icons/reset.svg" alt="" /><span>' + labels.reset + '</span>';
    mainMenuButton.innerHTML = '<span aria-hidden="true">&#8962;</span><span>' + labels.mainMenu + '</span>';
    mainMenuButton.hidden = !settings.showStartMenu;
    playlistButton.innerHTML = '<span aria-hidden="true">&#9835;</span><span>' + labels.playlist + '</span>';
    playlistTitle.textContent = labels.playlist;
    playlistHint.textContent = labels.playlistHint;
    makeButton.href = 'https://mingwencui.com/AIwriter/?lang=' + (content.language === 'ja' ? 'ja' : content.language === 'en' ? 'en' : 'zh');
    makeButton.innerHTML = '<img src="./icons/wand.svg" alt="" /><span>' + ${JSON.stringify(authorWebsite)} + '</span>';
    updateAutoButton();
    document.querySelector(".app").classList.toggle("immersive", settings.layoutMode === "immersive");
    let typewriterTimers = [];
    let autoAdvanceTimer = null;
    let playbackSession = 0;
    let autoAdvanceHoldId = null;
    let lastJumpedNode = null;
    let controlsHidden = false;
    let playedAudios = [];
    let currentAudioEnded = true;
    let currentVideoEnded = true;
    let gameStarted = !settings.showStartMenu;
    let settingsPopupOpen = false;
    let historyOpen = false;
    let historyCleanup = null;
    let historyHost = null;
    let suspendedStoryMedia = [];
    let suspendedStoryAnimations = [];
    function storyPlaybackActive() { return gameStarted && !historyOpen && !startScreen.classList.contains('open') && !settingsBackdrop.classList.contains('open') && !saveBackdrop.classList.contains('open') && !playlistBackdrop.classList.contains('open'); }
    function pauseStoryForPopup() {
      if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer);
      autoAdvanceTimer = null;
      const media = [...stageEl.querySelectorAll('audio,video'), regionAudio, sceneAmbientAudio].filter(Boolean);
      for (const item of media) {
        if (!item.paused && !suspendedStoryMedia.includes(item)) suspendedStoryMedia.push(item);
        item.pause();
      }
      for (const animation of stageEl.getAnimations({ subtree: true })) {
        if (animation.playState === 'running') {
          suspendedStoryAnimations.push(animation);
          animation.pause();
        }
      }
    }
    function resumeStoryAfterPopup() {
      if (!storyPlaybackActive()) return;
      suspendedStoryMedia.forEach(media => {
        if (media.isConnected || media === regionAudio || media === sceneAmbientAudio) media.play().catch(() => {});
      });
      suspendedStoryAnimations.forEach(animation => { if (animation.playState === 'paused') animation.play(); });
      suspendedStoryMedia = [];
      suspendedStoryAnimations = [];
      if (currentTextEnded) { showChoicesAndMaybeAdvance(); maybeAdvanceAfterMedia(); }
      updatePlaybackToolbar();
    }
    function closeDialogueHistory(resume = true) {
      historyCleanup?.(); historyCleanup = null;
      historyHost?.remove(); historyHost = null;
      historyOpen = false;
      playlistAudio.pause();
      if (resume && gameStarted && currentId !== 'THE_END') resumeStoryAfterPopup();
      else updatePlaybackToolbar();
    }
    function openDialogueHistory() {
      if (historyOpen) { closeDialogueHistory(); return; }
      pauseStoryForPopup();
      playlistAudio.pause();
      playlistBackdrop.classList.remove('open');
      historyOpen = true;
      const path = [...history, ...(currentId && currentId !== 'THE_END' ? [currentId] : [])];
      const entries = path.flatMap((id, index) => {
        const node = nodeById.get(id);
        if (!node || node.type === 'numberConditionNode' || node.data?.skip) return [];
        const text = document.createElement('div'); text.innerHTML = node.data.text || '';
        return [{ index, title: node.data.hideTitleInPlayback ? '' : storyTitle(node.data.title), text: text.textContent || '', audioUrl: node.data.audioUrl }];
      });
      historyHost = document.createElement('div'); canvasShell.appendChild(historyHost);
      historyCleanup = mountHistory(historyHost, entries, playbackCopy, () => closeDialogueHistory(), index => {
        closeDialogueHistory(false); restartPlaybackSession(); history = path.slice(0, index); currentId = path[index]; autoAdvanceHoldId = currentId; render(); writeSave();
      }, index => {
        const node = nodeById.get(path[index]);
        if (node?.data?.audioUrl) togglePlaylistAudio({ nodeId: node.id, title: storyTitle(node.data.title), url: node.data.audioUrl });
      });
      updatePlaybackToolbar();
    }
    let regionAudio = null;
    let regionAudioKey = "";
    let regionFadeFrame = 0;
    let sceneAmbientAudio = null;
    let sceneAmbientKey = "";
    let sceneAmbientFadeFrame = 0;
    let startMenuFadeFrame = 0;
    let regionUnlockCleanup = null;
    let zenPositionFrame = 0;
    let zenPositionObserver = null;
    const saveKey = "galwriter-web-saves:" + encodeURIComponent(String(content.title || "GalWriter"));
    const legacySaveKey = "galwriter-web-save:" + encodeURIComponent(String(content.title || "GalWriter"));
    let activeSaveId = null;
    let settingsWidgetControllers = [];
    const settingsWidgetMarkup = ${widgets};
    let settingsFocusReturn = null;
    let settingsNeedTextRefresh = false;
    let currentTextEnded = false;
    const playerPreferencesKey = saveKey + ":preferences";
    const playerDefaults = playerSettingsValues();
    function playerSettingsValues() {
      return { autoAdvance: settings.autoAdvance, interactionMode: settings.interactionMode,
        typewriterSpeed: settings.typewriterSpeed, textScale: settings.textScale,
        animationSpeed: settings.animationSpeed, soundEnabled: settings.soundEnabled,
        controlsVisible: !controlsHidden };
    }
    function restorePlayerPreferences() {
      try {
        const value = JSON.parse(localStorage.getItem(playerPreferencesKey) || "null");
        if (!value || typeof value !== "object") return;
        if (typeof value.autoAdvance === "boolean") settings.autoAdvance = value.autoAdvance;
        if (["immediate", "typewriter"].includes(value.interactionMode)) settings.interactionMode = value.interactionMode;
        settings.typewriterSpeed = clamp(value.typewriterSpeed, 10, 200, settings.typewriterSpeed);
        settings.textScale = clamp(value.textScale, 85, 130, settings.textScale);
        settings.animationSpeed = clamp(value.animationSpeed, 0.5, 2, settings.animationSpeed);
        if (typeof value.soundEnabled === "boolean") settings.soundEnabled = value.soundEnabled;
        if (typeof value.controlsVisible === "boolean") controlsHidden = !value.controlsVisible;
      } catch (_) { /* Storage can be unavailable in a local-file browser session. */ }
    }
    function persistPlayerPreferences() {
      try { localStorage.setItem(playerPreferencesKey, JSON.stringify(playerSettingsValues())); } catch (_) {}
    }
    restorePlayerPreferences();


    function readSaveCollection() {
      try {
        const raw = window.localStorage.getItem(saveKey) || window.localStorage.getItem(legacySaveKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const slots = Array.isArray(parsed?.slots) ? parsed.slots : [parsed];
        const validSlots = slots.filter((save) => save && typeof save.currentId === "string" && (save.currentId === "THE_END" || nodeById.has(save.currentId))).map((save) => ({
          ...save,
          id: typeof save.id === "string" && save.id ? save.id : "save-" + (Number(save.savedAt) || Date.now()) + "-legacy",
          createdAt: Number(save.createdAt) || Number(save.savedAt) || Date.now(),
          savedAt: Number(save.savedAt) || Date.now(),
        })).sort((left, right) => right.savedAt - left.savedAt);
        if (!validSlots.length) return null;
        const requestedActiveId = typeof parsed?.activeSaveId === "string" ? parsed.activeSaveId : null;
        return { version: 2, activeSaveId: validSlots.some((save) => save.id === requestedActiveId) ? requestedActiveId : validSlots[0].id, slots: validSlots };
      } catch (error) {
        console.warn("Could not read GalWriter web saves:", error);
        return null;
      }
    }

    function readSave(id = activeSaveId) {
      const collection = readSaveCollection();
      if (!collection) return null;
      const save = collection.slots.find((item) => item.id === id) || collection.slots.find((item) => item.id === collection.activeSaveId) || null;
      if (save) activeSaveId = save.id;
      return save;
    }

    function canContinueSave(save) {
      return Boolean(save && save.currentId && save.currentId !== "THE_END" && nodeById.has(save.currentId));
    }

    function writeSave() {
      if (!gameStarted) return;
      if (!currentId) return;
      try {
        const previous = readSave(activeSaveId);
        const payload = {
          id: activeSaveId || "save-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
          createdAt: previous?.createdAt || Date.now(),
          title: content.title || "GalWriter",
          currentId,
          history: Array.isArray(history) ? history.filter((id) => nodeById.has(id)) : [],
          settings: {
            autoAdvance: Boolean(settings.autoAdvance),
            interactionMode: settings.interactionMode,
            typewriterSpeed: Number(settings.typewriterSpeed) || 65,
            textScale: Number(settings.textScale) || 100,
            animationSpeed: Number(settings.animationSpeed) || 1,
            soundEnabled: settings.soundEnabled !== false,
          },
          controlsHidden: Boolean(controlsHidden),
          playedAudios,
          savedAt: Date.now(),
        };
        activeSaveId = payload.id;
        const collection = readSaveCollection();
        const otherSlots = (collection?.slots || []).filter((save) => save.id !== payload.id);
        window.localStorage.setItem(saveKey, JSON.stringify({ version: 2, activeSaveId: payload.id, slots: [payload, ...otherSlots].sort((left, right) => right.savedAt - left.savedAt) }));
        updateStartMenu();
      } catch (error) {
        console.warn("Could not write GalWriter web save:", error);
      }
    }

    function applySave(save) {
      if (!save) return false;
      currentId = save.currentId === "THE_END" ? "THE_END" : save.currentId;
      history = Array.isArray(save.history) ? save.history.filter((id) => nodeById.has(id)) : [];
      if (save.settings) {
        if (typeof save.settings.autoAdvance === "boolean") settings.autoAdvance = save.settings.autoAdvance;
        if (Number.isFinite(Number(save.settings.typewriterSpeed))) {
          settings.typewriterSpeed = Math.max(0, Number(save.settings.typewriterSpeed));
        }
        if (Number.isFinite(Number(save.settings.textScale))) settings.textScale = clamp(save.settings.textScale, 85, 130, 100);
        if (Number.isFinite(Number(save.settings.animationSpeed))) settings.animationSpeed = clamp(save.settings.animationSpeed, 0.5, 2, 1);
        if (typeof save.settings.soundEnabled === "boolean") settings.soundEnabled = save.settings.soundEnabled;
      }
      if (["immediate", "typewriter"].includes(save.settings?.interactionMode)) settings.interactionMode = save.settings.interactionMode;
      controlsHidden = Boolean(save.controlsHidden);
      restorePlayerPreferences();
      playedAudios = Array.isArray(save.playedAudios) ? save.playedAudios : [];
      document.querySelector(".app").classList.toggle("controls-hidden", controlsHidden);
      zenButton.innerHTML = '<img src="./icons/' + (controlsHidden ? 'eye-off.svg' : 'eye.svg') + '" alt="" />';
      updateAutoButton();
      updateSettingsPanel();
      return true;
    }

    function saveLabel(save) {
      if (!save || !save.savedAt) return labels.noSave;
      const date = new Date(save.savedAt);
      if (Number.isNaN(date.getTime())) return labels.savedAt;
      return labels.savedAt + " " + date.toLocaleString();
    }

    function saveProgressLabel(save) {
      const node = save?.currentId && save.currentId !== "THE_END" ? nodeById.get(save.currentId) : null;
      const text = node?.data?.title || node?.data?.text || (save?.currentId === "THE_END" ? labels.end : "");
      return String(text || "").replace(/<[^>]*>/g, "").replace(/\\s+/g, " ").trim().slice(0, 72);
    }

    function openSaveList() {
      const collection = readSaveCollection();
      saveTitle.textContent = labels.archive || labels.saveSlot;
      saveList.innerHTML = "";
      const slots = collection?.slots || [];
      if (!slots.length) {
        const empty = document.createElement("p");
        empty.textContent = labels.noSave;
        saveList.appendChild(empty);
      }
      const archiveControls = Array.isArray(settings.archivePageElements) ? settings.archivePageElements : [];
      const continueControl = archiveControls.find((element) => element && element.role === "slotContinue");
      const deleteControl = archiveControls.find((element) => element && element.role === "slotDelete");
      function applyArchiveActionButton(button, element, fallbackLabel, fallbackColor) {
        button.textContent = element?.text || fallbackLabel;
        if (!element) return;
        if (element.fillEnabled === false) button.style.background = "transparent";
        else if (element.backgroundType === "gradient") button.style.background = gradientFromStops(element.backgroundGradientShape, Number(element.backgroundGradientAngle) || 135, normalizeGradientStops(element.backgroundGradientStops, element.backgroundGradientStart || fallbackColor, element.backgroundGradientEnd || "#0f172a"), { startX: element.backgroundGradientStartX, startY: element.backgroundGradientStartY, endX: element.backgroundGradientEndX, endY: element.backgroundGradientEndY });
        else if (element.backgroundColor) button.style.background = element.backgroundColor;
        applyCustomButtonTextStyle(button, element, "#ffffff");
        applyCustomBoxEffects(button, element);
        applyElementRadius(button, element, 9);
      }
      slots.forEach((save) => {
        const row = document.createElement("div");
        row.className = "settings-row save-slot-row";
        const meta = document.createElement("div");
        meta.className = "settings-label";
        meta.textContent = saveLabel(save) + (saveProgressLabel(save) ? " · " + saveProgressLabel(save) : "");
        const actions = document.createElement("div");
        const continueButton = document.createElement("button");
        continueButton.type = "button";
        continueButton.className = "save-slot-action primary";
        applyArchiveActionButton(continueButton, continueControl, labels.continue, style.choiceColor || "#0ea5e9");
        continueButton.addEventListener("click", () => { activeSaveId = save.id; if (applySave(save)) { saveBackdrop.classList.remove("open"); startGameFromCurrent(); } });
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "save-slot-action";
        applyArchiveActionButton(deleteButton, deleteControl, labels.deleteSave || "Delete", "#475569");
        deleteButton.addEventListener("click", () => {
          const latest = readSaveCollection();
          const nextSlots = (latest?.slots || []).filter((item) => item.id !== save.id);
          activeSaveId = activeSaveId === save.id ? nextSlots[0]?.id || null : activeSaveId;
          window.localStorage.setItem(saveKey, JSON.stringify({ version: 2, activeSaveId, slots: nextSlots }));
          openSaveList(); updateStartMenu();
        });
        actions.append(continueButton, deleteButton);
        row.append(meta, actions);
        saveList.appendChild(row);
      });
      saveBackdrop.classList.add("open");
    }

    function renderCustomStartMenu(save, layer = startLayer, elements = settings.startMenuElements) {
      const hasCustomElements = elements.length > 0;
      if (layer === startLayer) startPanel.hidden = hasCustomElements;
      layer.hidden = !hasCustomElements;
      layer.innerHTML = "";
      if (!hasCustomElements) return;
      elements.forEach((element) => {
      if (!element || element.visible === false) return;
      const isToolbar = layer === playbackToolbar;
      if (isToolbar && ((!settings.showStartMenu && element.role === 'mainMenu') || (controlsHidden && element.role !== 'controlsToggle'))) return;
      const actionByRole = {
        history: { label: playbackCopy.history, onClick: openDialogueHistory },
        back: { label: labels.back, disabled: isToolbar && history.length === 0, onClick: isToolbar ? () => backButton.click() : closeSettingsPanel },
        return: { label: labels.back, disabled: isToolbar && history.length === 0, onClick: isToolbar ? () => backButton.click() : closeSettingsPanel },
        mainMenu: { label: labels.mainMenu, onClick: () => { closeSettingsPanel(); returnToMainMenu(); } },
        fullscreen: { label: "Fullscreen", onClick: () => { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); else document.documentElement.requestFullscreen?.().catch(() => {}); } },
        controlsToggle: { label: labels.controls, onClick: () => changePlayerSettings({ controlsVisible: controlsHidden }) },
        audio: { label: labels.playlist, onClick: () => { if (!isToolbar) closeSettingsPanel(); playlistButton.click(); } },
        auto: { label: labels.autoPlay, onClick: () => changePlayerSettings({ autoAdvance: !settings.autoAdvance }) },
        speed: { label: labels.textSpeed, onClick: () => changePlayerSettings({ typewriterSpeed: clamp(element.actionValue, 10, 200, 65) }) },
        textSize: { label: "Text size", onClick: () => changePlayerSettings({ textScale: clamp(element.actionValue, 85, 130, 100) }) },
        animationSpeed: { label: "Animation speed", onClick: () => changePlayerSettings({ animationSpeed: clamp(element.actionValue, 0.5, 2, 1) }) },
        sound: { label: "Sound", onClick: () => changePlayerSettings({ soundEnabled: !settings.soundEnabled }) },
        flowOverview: {
          label: labels.flowOverview,
          disabled: false,
          primary: false,
          onClick: openFlowOverview,
        },
        flowDirection: {
          label: content.language === "zh" ? "切换流程方向" : content.language === "ja" ? "フロー方向を切り替え" : "Cycle flow direction",
          disabled: false,
          primary: false,
          onClick: cycleFlowOverviewDirection,
        },
        flowFitView: {
          label: content.language === "zh" ? "适应流程图" : content.language === "ja" ? "全体を表示" : "Fit flow view",
          disabled: false,
          primary: false,
          onClick: fitFlowOverview,
        },
        continue: {
          label: labels.continue,
          disabled: !canContinueSave(save),
          primary: true,
          onClick: continueSavedGame,
        },
        save: {
          label: labels.saveSlot,
          disabled: false,
          primary: true,
          onClick: openSaveList,
        },
        new: {
          label: labels.newGame,
          disabled: false,
          primary: !settings.startMenuShowSave,
          onClick: startNewGame,
        },
        settings: {
          label: labels.settings,
          disabled: false,
          primary: false,
          onClick: openSettingsPanel,
        },
        link: {
          label: "Open link",
          disabled: !/^(https?:|mailto:|tel:)/i.test(String(element.linkUrl || "").trim()),
          primary: false,
          onClick: () => {
            const url = String(element.linkUrl || "").trim();
            if (!/^(https?:|mailto:|tel:)/i.test(url)) return;
            window.open(url, element.linkTarget === "_self" ? "_self" : "_blank", "noopener,noreferrer");
          },
        },
        volume: {
          label: "Volume",
          disabled: false,
          primary: false,
          onClick: () => {
            const nextVolume = clamp(element.actionValue, 0, 100, 70);
            settings.startMenuMusicVolume = nextVolume;
            startMenuAudio.volume = nextVolume / 100;
          },
        },
      };
        if (isToolbar && popupSettingsMarkup[element.role]) {
          actionByRole[element.role] = { label: element.text || element.role, onClick: () => {
            if (element.id === 'toolbar-auto') {
              autoAdvanceHoldId = null;
              changePlayerSettings({ autoAdvance: !settings.autoAdvance });
              if (!settings.autoAdvance) { if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null; }
              else if (currentTextEnded) showChoicesAndMaybeAdvance();
            } else openPlaybackSetting(element);
          } };
        }
        const wrapper = document.createElement("div");
        wrapper.className = "start-element";
        wrapper.style.left = Number(element.x || 0) + "%";
        wrapper.style.top = Number(element.y || 0) + "%";
        wrapper.style.width = Math.max(1, Number(element.width || 10)) + "%";
        wrapper.style.height = Math.max(1, Number(element.height || 6)) + "%";
        if (isToolbar && element.kind === "button" && element.textVisible === false) wrapper.style.aspectRatio = "1 / 1";
        wrapper.style.transform = "rotate(" + Number(element.rotation || 0) + "deg) scale(" + (Number(element.scale) || 1) + ")";
        wrapper.style.opacity = element.backgroundType === "gradient"
          ? "1"
          : String(Math.max(0, Math.min(100, Number(element.opacity ?? 100))) / 100);
        wrapper.style.zIndex = String(20 + (Number(element.zIndex) || 0));
        if (layer === flowOverviewCustomLayer && element.role === "flowMinimap") {
          flowOverviewMinimap.classList.add("is-embedded");
          wrapper.appendChild(flowOverviewMinimap);
          layer.appendChild(wrapper);
          return;
        }
        if (element.kind === "image") {
          if (!element.imageUrl) return;
          const image = document.createElement("img");
          image.className = "start-element-image";
          image.src = element.imageUrl;
          image.alt = "";
          image.style.backgroundColor = element.imageBackgroundColor || "transparent";
          applyElementRadius(image, element, 12);
          applyCustomBoxEffects(image, element);
          if (element.blendMode) image.style.mixBlendMode = element.blendMode;
          wrapper.appendChild(image);
        } else if (element.kind === "button") {
          const action = actionByRole[element.role] || null;
          const widget = layer === settingsCustomLayer ? settingsWidgetMarkup[element.id] : null;
          const button = document.createElement(widget ? "div" : "button");
          button.type = "button";
          button.className = "start-element-button" + (isToolbar ? ' gw-playback-control' + (element.textVisible !== false ? ' gw-playback-control-with-label' : '') : '') + ((element.primary || action?.primary) ? " primary" : "");
          const buttonLabel = isToolbar
            ? toolbarButtonLabel(element.role, element.text || '', content.language, Boolean(document.fullscreenElement), controlsHidden, settings.autoAdvance, element.id === 'toolbar-auto')
            : element.role === "flowBranch"
              ? flowOverviewBranchLabel || element.text || action?.label || ''
              : element.text || action?.label || '';
          button.textContent = "";
          if (!isToolbar && element.textVisible === false && (element.role === "flowDirection" || element.role === "flowFitView")) {
            const icon = document.createElement("span");
            icon.setAttribute("aria-hidden", "true");
            icon.innerHTML = element.role === "flowDirection"
              ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
              : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7M3 3v6h6"/></svg>';
            icon.firstElementChild.style.width = "52%";
            icon.firstElementChild.style.height = "52%";
            button.appendChild(icon);
          }
          button.disabled = Boolean(element.disabled || action?.disabled);
          button.inert = Boolean(element.disabled);
          if (isToolbar) {
            button.setAttribute('aria-label', buttonLabel || action?.label || element.role || 'Button');
            button.title = buttonLabel || action?.label || element.role || 'Button';
            if (element.id === 'toolbar-auto') button.setAttribute('aria-pressed', String(settings.autoAdvance));
            button.dataset.toolbarRole = element.role || '';
            button.style.setProperty('--gw-toolbar-icon-size', Math.max(12, Number(element.height || 4.8) / 4.8 * 20) + 'px');
          }
          if (element.fillEnabled === false) {
            button.style.background = "transparent";
          } else if (element.backgroundType === "image") {
            const imageBase = String(element.backgroundImageBackgroundColor || "").trim();
            const legacyBase = String(element.backgroundColor || "").trim();
            const imageBaseTransparent = imageBase === "transparent" || /^#[0-9a-f]{6}00$/i.test(imageBase) || /^rgba\\([^,]+,[^,]+,[^,]+,\\s*0(?:\\.0+)?\\)$/i.test(imageBase);
            const legacyBaseTransparent = legacyBase === "transparent" || /^#[0-9a-f]{6}00$/i.test(legacyBase) || /^rgba\\([^,]+,[^,]+,[^,]+,\\s*0(?:\\.0+)?\\)$/i.test(legacyBase);
            button.style.background = imageBase && !(imageBaseTransparent && !legacyBaseTransparent)
              ? imageBase
              : legacyBase || imageBase || "transparent";
            button.style.position = "relative";
            button.style.overflow = "hidden";
            if (element.backgroundImageUrl) {
              const fillImage = document.createElement("span");
              fillImage.style.position = "absolute";
              fillImage.style.inset = "0";
              fillImage.style.pointerEvents = "none";
              fillImage.style.backgroundImage = "url(\\"" + String(element.backgroundImageUrl).replace(/"/g, "\\\\\\"") + "\\")";
              fillImage.style.backgroundRepeat = "no-repeat";
              fillImage.style.backgroundSize = element.backgroundImageFit === "fit" ? "contain" : element.backgroundImageFit === "max" ? "cover" : String(Number(element.backgroundImageScale) || 100) + "%";
              fillImage.style.backgroundPosition = "calc(50% + " + (Number(element.backgroundImageOffsetX) || 0) + "px) calc(50% + " + (Number(element.backgroundImageOffsetY) || 0) + "px)";
              fillImage.style.transform = "rotate(" + (Number(element.backgroundImageRotation) || 0) + "deg)";
              fillImage.style.transformOrigin = "center";
              fillImage.style.opacity = String(clamp(element.backgroundImageAlpha, 0, 100, 100) / 100);
              button.appendChild(fillImage);
            }
          } else if (element.backgroundType === "gradient") {
            button.style.background = gradientFromStops(element.backgroundGradientShape, Number(element.backgroundGradientAngle) || 135, normalizeGradientStops(element.backgroundGradientStops, element.backgroundGradientStart || style.choiceColor || "#0ea5e9", element.backgroundGradientEnd || "#0f172a"), { startX: element.backgroundGradientStartX, startY: element.backgroundGradientStartY, endX: element.backgroundGradientEndX, endY: element.backgroundGradientEndY });
            button.style.backgroundColor = "transparent";
            button.style.backdropFilter = "none";
            button.style.webkitBackdropFilter = "none";
          } else if (element.backgroundColor) {
            button.style.background = element.backgroundColor;
          }
          applyCustomButtonTextStyle(button, element, element.primary ? style.choiceTextColor || "#ffffff" : "#f8fafc");
          applyCustomBoxEffects(button, element);
          if (Number.isFinite(Number(element.fontSize))) button.style.fontSize = Number(element.fontSize) + "px";
          if (Number.isFinite(Number(element.fontWeight))) button.style.fontWeight = String(Number(element.fontWeight));
          applyElementRadius(button, element, 12);
          if (element.blendMode) button.style.mixBlendMode = element.blendMode;
          if (isToolbar) {
            const icon = playbackToolbarIcon(element.role);
            if (icon) {
              const iconHost = document.createElement('span');
              iconHost.className = 'gw-playback-control-content';
              iconHost.style.cssText = 'position:relative;z-index:1;display:flex';
              iconHost.innerHTML = icon;
              button.appendChild(iconHost);
            }
          }
          if (widget) {
            button.style.overflow = "hidden";
            const host = document.createElement('div');
            host.className = 'gw-ps-widget-surface';
            host.innerHTML = widget;
            button.appendChild(host);
            settingsWidgetControllers.push(mountSettingsWidget(host, playerSettingsValues(), playerDefaults, changePlayerSettings, closeSettingsPanel, [element]));
            host.querySelectorAll('[data-role-label]').forEach((label) => {
              applyTextPaint(label, element, element.textColor || '#f8fafc');
              label.style.fontFamily = element.fontFamily || 'inherit';
              label.style.fontWeight = String(element.fontWeight || 500);
              label.style.visibility = element.textVisible === false ? 'hidden' : 'visible';
            });
          }
          if (!widget && element.textVisible !== false) {
            const label = document.createElement("span");
            label.textContent = buttonLabel;
            label.style.position = "relative";
            label.style.zIndex = "1";
            if (isToolbar) {
              label.className = 'gw-playback-label';
              (button.querySelector('.gw-playback-control-content') || button).appendChild(label);
            } else {
              applyTextPaint(label, element, element.primary ? style.choiceTextColor || "#ffffff" : "#f8fafc");
              button.appendChild(label);
            }
          }
          if (!widget && action?.onClick) button.addEventListener("click", () => {
            if (layer === settingsCustomLayer && ["save", "new", "continue"].includes(element.role)) closeSettingsPanel();
            action.onClick();
          });
          if (element.appearance && !isToolbar) {
            button.style.background = 'transparent'; button.style.border = '0'; button.style.boxShadow = 'none';
            gwAppearance(button, element.appearance, [element.borderTopLeftRadius ?? element.borderRadius ?? 12, element.borderTopRightRadius ?? element.borderRadius ?? 12, element.borderBottomRightRadius ?? element.borderRadius ?? 12, element.borderBottomLeftRadius ?? element.borderRadius ?? 12].map((value) => value + 'px').join(' '));
          }
          wrapper.appendChild(button);
        } else {
          const text = document.createElement("div");
          text.className = "start-element-text" + (element.role === "subtitle" ? " subtitle" : "");
          text.textContent = element.role === "subtitle" && !element.text ? (save ? saveLabel(save) : labels.noSave) : (element.text || "");
          applyCustomTextStyle(text, element);
          wrapper.appendChild(text);
        }
        layer.appendChild(wrapper);
      });
    }

    function playbackToolbarIcon(role) {
      const icons = {
        audio: '<path d="M21 15V6M18 9h3M3 6h12M3 10h12M3 14h7"/><circle cx="18" cy="18" r="3"/>',
        fullscreen: document.fullscreenElement
          ? '<path d="M8 3v5H3m18 0h-5V3M3 16h5v5m8 0v-5h5"/>'
          : '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5"/>',
        return: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
        back: '<path d="m12 19-7-7 7-7M5 12h14"/>',
        mainMenu: '<path d="m3 10 9-7 9 7v10H3zM9 20v-7h6v7"/>',
        settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',
        controlsToggle: controlsHidden
          ? '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12"/><circle cx="12" cy="12" r="3"/>'
          : '<path d="m3 3 18 18M10 5h2c6 0 10 7 10 7l-3 4M6 6c-2 2-4 6-4 6s4 7 10 7l4-1"/>',
      };
      icons.history = '<path d="M3 12a9 9 0 1 0 3-6.7M3 3v6h6M12 7v5l3 2"/>';
      icons.auto = settings.autoAdvance ? '<path d="M8 5v14M16 5v14" stroke-width="4"/>' : '<path d="m8 5 11 7-11 7z"/>';
      const paths = icons[role] || icons.settings;
      return paths ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>' : '';
    }
    function updatePlaybackToolbar() {
      renderCustomStartMenu(null, playbackToolbar, settings.previewToolbarElements);
      playbackToolbar.querySelectorAll('[data-toolbar-role]').forEach((button) => {
        const role = button.dataset.toolbarRole;
        if (role === 'history') button.setAttribute('aria-pressed', String(historyOpen));
        if (role === 'audio') button.setAttribute('aria-pressed', String(playlistBackdrop.classList.contains('open')));
        if (role === 'fullscreen') button.setAttribute('aria-pressed', String(Boolean(document.fullscreenElement)));
        if (role === 'controlsToggle') button.setAttribute('aria-pressed', String(!controlsHidden));
      });
      // Retain an escape from hidden controls when the authored toolbar has no toggle.
      zenButton.hidden = !controlsHidden || settings.previewToolbarElements.some((element) => element.visible !== false && !element.disabled && element.role === 'controlsToggle');
    }

    function updateStartMenu() {
      const save = readSave();
      const showSave = Boolean(settings.startMenuShowSave);
      const showNewGame = Boolean(settings.startMenuShowNewGame) || (!settings.startMenuShowSave && !settings.startMenuShowSettings);
      const showSettings = Boolean(settings.startMenuShowSettings);
      startSubtitle.textContent = save ? saveLabel(save) : labels.noSave;
      flowOverviewButton.textContent = labels.flowOverview;
      flowOverviewButton.hidden = false;
      continueGameButton.textContent = labels.continue;
      continueGameButton.disabled = !canContinueSave(save);
      continueGameButton.hidden = !canContinueSave(save);
      saveSlotButton.textContent = labels.saveSlot;
      saveSlotButton.disabled = false;
      saveSlotButton.hidden = !showSave;
      newGameButton.textContent = labels.newGame;
      newGameButton.hidden = !showNewGame;
      settingsButton.textContent = labels.settings;
      settingsButton.hidden = !showSettings;
      renderCustomStartMenu(save);
    }

    function fadeStartMenuAudio(from, to, seconds, done) {
      cancelAnimationFrame(startMenuFadeFrame);
      const duration = Math.max(0, Number(seconds) || 0) * 1000;
      if (!duration) {
        startMenuAudio.volume = to;
        if (done) done();
        return;
      }
      const started = performance.now();
      const tick = (now) => {
        const progress = Math.min(1, (now - started) / duration);
        startMenuAudio.volume = from + (to - from) * progress;
        if (progress < 1) startMenuFadeFrame = requestAnimationFrame(tick);
        else if (done) done();
      };
      startMenuFadeFrame = requestAnimationFrame(tick);
    }

    function playStartMenuMusic() {
      if (!settings.startMenuBackgroundMusicUrl) return;
      const targetVolume = Math.max(0, Math.min(1, Number(settings.startMenuMusicVolume) / 100));
      startMenuAudio.loop = Boolean(settings.startMenuMusicLoop);
      startMenuAudio.volume = Number(settings.startMenuMusicFadeIn) > 0 ? 0 : targetVolume;
      startMenuAudio.play().catch(() => {});
      fadeStartMenuAudio(startMenuAudio.volume, targetVolume, settings.startMenuMusicFadeIn);
    }

    function stopStartMenuMusic() {
      if (!settings.startMenuBackgroundMusicUrl) return;
      fadeStartMenuAudio(startMenuAudio.volume, 0, settings.startMenuMusicFadeOut, () => {
        startMenuAudio.pause();
      });
    }

    function playFlowOverviewMusic() {
      if (!settings.flowOverviewBackgroundMusicUrl) return;
      flowOverviewAudio.src = settings.flowOverviewBackgroundMusicUrl;
      flowOverviewAudio.loop = Boolean(settings.flowOverviewMusicLoop);
      const targetVolume = Math.max(0, Math.min(1, Number(settings.flowOverviewMusicVolume) / 100));
      flowOverviewAudio.volume = Number(settings.flowOverviewMusicFadeIn) > 0 ? 0 : targetVolume;
      flowOverviewAudio.play().catch(() => {});
      const duration = Math.max(0, Number(settings.flowOverviewMusicFadeIn) || 0) * 1000;
      if (!duration) return;
      const started = performance.now();
      const tick = (now) => {
        const progress = Math.min(1, (now - started) / duration);
        flowOverviewAudio.volume = progress * targetVolume;
        if (progress < 1 && flowOverviewBackdrop.classList.contains("open")) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    function stopFlowOverviewMusic() {
      if (!flowOverviewAudio) return;
      const from = Number(flowOverviewAudio.volume) || 0;
      const duration = Math.max(0, Number(settings.flowOverviewMusicFadeOut) || 0) * 1000;
      if (!duration) {
        flowOverviewAudio.pause();
        flowOverviewAudio.currentTime = 0;
        return;
      }
      const started = performance.now();
      const tick = (now) => {
        const progress = Math.min(1, (now - started) / duration);
        flowOverviewAudio.volume = from * (1 - progress);
        if (progress < 1) requestAnimationFrame(tick);
        else {
          flowOverviewAudio.pause();
          flowOverviewAudio.currentTime = 0;
        }
      };
      requestAnimationFrame(tick);
    }

    function syncStartMenuMusicForOverlay(kind, open) {
      if (!settings.startMenuBackgroundMusicUrl) return;
      if (!startScreen.classList.contains("open")) return;
      const keepPlaying =
        open &&
        ((kind === "archive" && settings.startMenuMusicApplyToArchive) ||
          (kind === "settings" && settings.startMenuMusicApplyToSettings));
      if (open && !keepPlaying) stopStartMenuMusic();
      if (!open) playStartMenuMusic();
    }

    function showStartMenu() {
      gameStarted = false;
      restartPlaybackSession();
      stageEl.querySelectorAll('audio,video').forEach(media => media.pause());
      playlistAudio.pause();
      syncRegionMusic(null); syncSceneAmbient(null);
      updateStartMenu();
      startScreen.classList.add("open");
      syncPlayerPresentation();
      playStartMenuMusic();
    }

    function hideStartMenu() {
      startScreen.classList.remove("open");
      stopStartMenuMusic();
    }

    function returnToMainMenu() {
      if (!settings.showStartMenu) return;
      if (historyOpen) closeDialogueHistory(false);
      writeSave();
      restartPlaybackSession();
      gwAppearance(stageEl.querySelector('.dialogue'),dialogObject.appearance,dialogObject.corners?dialogObject.corners.map(n=>n+'px').join(' '):null);
      gwAppearance(backdropEl,settings.surfaceAppearances?.game);
      const exportedDialogue=stageEl.querySelector('.dialogue');if(exportedDialogue&&dialogObject.zIndex!==undefined)exportedDialogue.style.zIndex=String(dialogObject.zIndex);
      const nodeAudio = document.getElementById("nodeAudio");
      const nodeVideo = document.getElementById("nodeVideo");
      if (nodeAudio) nodeAudio.pause();
      if (nodeVideo) nodeVideo.pause();
      playlistBackdrop.classList.remove("open");
      playlistButton.setAttribute("aria-expanded", "false");
      syncRegionMusic(null);
      showStartMenu();
    }

    function startGameFromCurrent() {
      gameStarted = true;
      hideStartMenu();
      renderPlaylist();
      render();
    }

    function startNewGame() {
      if (!root) return;
      if (historyOpen) closeDialogueHistory(false);
      playedAudios = []; playlistAudio.pause(); playlistAudio.removeAttribute('src');
      restartPlaybackSession();
      history = [];
      currentId = root ? root.id : null;
      autoAdvanceHoldId = currentId;
      activeSaveId = "save-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      startGameFromCurrent();
      writeSave();
    }

    function continueSavedGame() {
      const save = readSave();
      if (!save || !applySave(save)) return;
      startGameFromCurrent();
    }

    function syncPlayerPresentation() {
      updatePlaybackToolbar();
      const textScale = Math.min(8, Math.max(0.25, settings.canvasHeight / 720)) * settings.textScale / 100;
      document.documentElement.style.setProperty("--title-size", Math.max(18, (Number(titleObject.fontSize ?? style.titleFontSize) || 18) * textScale) + "px");
      document.documentElement.style.setProperty("--body-size", Math.max(16, (Number(bodyObject.fontSize ?? style.bodyFontSize) || 18) * textScale) + "px");
      document.documentElement.style.setProperty("--player-animation-speed", String(settings.animationSpeed));
      stageEl.querySelectorAll('[data-resolved-text] > div').forEach(host => {
        host.style.transform = 'scale(' + settings.textScale / 100 + ')';
      });
      document.querySelector(".app").classList.toggle("controls-hidden", controlsHidden);
      zenButton.innerHTML = '<img src="./icons/' + (controlsHidden ? 'eye-off.svg' : 'eye.svg') + '" alt="" />';
      document.querySelectorAll("audio,video").forEach((media) => {
        if (!media.hasAttribute("data-author-muted")) media.setAttribute("data-author-muted", String(media.muted));
        media.muted = !settings.soundEnabled || media.getAttribute("data-author-muted") === "true";
      });
      [regionAudio, sceneAmbientAudio].forEach((audio) => { if (audio) audio.muted = !settings.soundEnabled; });
    }
    function updateSettingsPanel() {
      settingsWidgetControllers.forEach((controller) => controller.sync(playerSettingsValues()));
      syncPlayerPresentation();
    }
    function changePlayerSettings(patch) {
      if (patch.controlsVisible !== undefined) controlsHidden = !patch.controlsVisible;
      Object.keys(playerDefaults).forEach((key) => {
        if (key !== "controlsVisible" && patch[key] !== undefined) settings[key] = patch[key];
      });
      if (patch.interactionMode !== undefined || patch.typewriterSpeed !== undefined) settingsNeedTextRefresh = true;
      updateSettingsPanel();
      updateAutoButton();
      persistPlayerPreferences();
      writeSave();
    }
    function openPlaybackSetting(element) {
      settingsFocusReturn = document.activeElement;
      pauseStoryForPopup();
      playlistAudio.pause();
      settingsWidgetControllers.forEach(controller => controller.destroy());
      settingsWidgetControllers = [];
      settingsPopupOpen = true;
      settingsBackdrop.classList.add('open', 'gw-playback-settings');
      settingsCustomLayer.hidden = true;
      playerSettingsRoot.hidden = false;
      playerSettingsRoot.innerHTML = popupSettingsMarkup[element.role] || popupSettingsMarkup.settings;
      settingsWidgetControllers.push(mountSettingsWidget(playerSettingsRoot, playerSettingsValues(), playerDefaults, patch => {
        if (patch.autoAdvance !== undefined) autoAdvanceHoldId = null;
        changePlayerSettings(patch);
      }, closeSettingsPanel, []));
      playerSettingsRoot.querySelector('button')?.focus({ preventScroll: true });
    }
    function openSettingsPanel() {
      settingsPopupOpen = false;
      settingsBackdrop.classList.remove('gw-playback-settings');
      playerSettingsRoot.hidden = true;
      settingsCustomLayer.hidden = false;
      settingsFocusReturn = document.activeElement;
      if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null; }
      updateSettingsPanel();
      settingsWidgetControllers.forEach((controller) => controller.destroy());
      settingsWidgetControllers = [];
      renderCustomStartMenu(readSave(), settingsCustomLayer, settings.settingsPageElements || []);
      settingsBackdrop.classList.add("open");
      syncStartMenuMusicForOverlay("settings", true);
      settingsCustomLayer.querySelector('button:not(:disabled),input:not(:disabled),select:not(:disabled)')?.focus({ preventScroll: true });
    }
    function closeSettingsPanel() {
      const wasPopup = settingsPopupOpen;
      settingsPopupOpen = false;
      settingsBackdrop.classList.remove('open', 'gw-playback-settings');
      if (wasPopup) {
        settingsWidgetControllers.forEach(controller => controller.destroy()); settingsWidgetControllers = [];
        playerSettingsRoot.replaceChildren(); playerSettingsRoot.hidden = true;
        settingsCustomLayer.hidden = false;
        if (settingsNeedTextRefresh) {
          clearPlaybackTimers();
          const node = nodeById.get(currentId);
          if (node) applyTypewriter(document.getElementById('nodeText'), node.data.text || '', node.data.rawText || node.data.text || '', node.data.presentation || null, settings.interactionMode === 'typewriter', true);
        }
        settingsNeedTextRefresh = false;
        resumeStoryAfterPopup();
        if (settingsFocusReturn?.isConnected) settingsFocusReturn.focus({ preventScroll: true });
        return;
      }
      syncStartMenuMusicForOverlay("settings", false);
      if (gameStarted && !startScreen.classList.contains("open")) {
        if (settingsNeedTextRefresh) {
          clearPlaybackTimers();
          const node = nodeById.get(currentId);
          if (node) applyTypewriter(document.getElementById("nodeText"), node.data.text || "", node.data.rawText || node.data.text || "", node.data.presentation || null, settings.interactionMode === "typewriter", true);
        } else if (currentTextEnded) { showChoicesAndMaybeAdvance(); maybeAdvanceAfterMedia(); }
      }
      settingsNeedTextRefresh = false;
      if (settingsFocusReturn?.isConnected) settingsFocusReturn.focus({ preventScroll: true });
    }

    function hasZenBottomRightSpace() {
      if (settings.layoutMode !== "immersive") return true;
      const dialogOffsetX = clamp(style.dialogOffsetX, -100, 100, 0);
      const dialogCenter = 50 + dialogOffsetX * 0.5;
      const dialogWidth = clamp(style.dialogWidth, 0, 100, 86);
      return Math.max(0, 100 - (dialogCenter + dialogWidth / 2)) >= 12;
    }

    function updateZenButtonPosition() {
      if (zenPositionFrame) cancelAnimationFrame(zenPositionFrame);
      zenPositionFrame = requestAnimationFrame(() => {
        if (!zenButton) return;
        if (hasZenBottomRightSpace()) {
          zenButton.style.setProperty("--zen-toggle-bottom", "24px");
          return;
        }
        const main = stageEl.closest("main");
        const dialogue = stageEl.querySelector(".dialogue");
        if (!main || !dialogue) {
          zenButton.style.setProperty("--zen-toggle-bottom", "24px");
          return;
        }
        const mainRect = main.getBoundingClientRect();
        const dialogueRect = dialogue.getBoundingClientRect();
        const nextBottom = Math.max(24, Math.ceil(mainRect.bottom - dialogueRect.top + 20));
        zenButton.style.setProperty("--zen-toggle-bottom", nextBottom + "px");
      });
    }

    function clearPlaybackTimers() {
      if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer);
      typewriterTimers.forEach((timer) => clearInterval(timer));
      autoAdvanceTimer = null;
      typewriterTimers = [];
    }

    // Keep the same story DOM and remaining delay while a playback popup is open.
    function schedulePlaybackStep(callback, delay) {
      let remaining = Math.max(0, delay);
      let previous = performance.now();
      const timer = setInterval(() => {
        const now = performance.now();
        if (storyPlaybackActive()) remaining -= now - previous;
        previous = now;
        if (remaining <= 0 && storyPlaybackActive()) {
          clearInterval(timer);
          typewriterTimers = typewriterTimers.filter(value => value !== timer);
          callback();
        }
      }, 16);
      typewriterTimers.push(timer);
      return timer;
    }

    function restartPlaybackSession() {
      playbackSession += 1;
      clearPlaybackTimers();
      suspendedStoryMedia = [];
      suspendedStoryAnimations = [];
      isTransitioning = false;
      lastJumpedNode = null;
    }

    function currentHistoryTotal() {
      return history.reduce((total, nodeId) => {
        const historyNode = nodeById.get(nodeId);
        const value = historyNode && historyNode.data ? historyNode.data.nodeValue : undefined;
        return total + (typeof value === "number" && Number.isFinite(value) ? value : 0);
      }, 0);
    }

    function numberConditionTarget(node) {
      const data = node.data || {};
      const sum = currentHistoryTotal();
      const ranges = Array.isArray(data.ranges) ? data.ranges : [];
      const matchedRange = ranges.find((range) =>
        range && range.min <= range.max && sum >= range.min && sum <= range.max
      );
      const sourceHandle = matchedRange
        ? "out-range-" + matchedRange.id
        : sum >= (Number(data.threshold) || 0)
          ? "out-greater"
          : "out-less-equal";
      const edge = outEdges(node.id).find((item) => item.sourceHandle === sourceHandle);
      return edge ? edge.target : "THE_END";
    }

    function watchZenButtonPosition() {
      if (zenPositionObserver) zenPositionObserver.disconnect();
      zenPositionObserver = null;
      const main = stageEl.closest("main");
      const dialogue = stageEl.querySelector(".dialogue");
      updateZenButtonPosition();
      if (!main || !dialogue || typeof ResizeObserver === "undefined") return;
      zenPositionObserver = new ResizeObserver(updateZenButtonPosition);
      zenPositionObserver.observe(main);
      zenPositionObserver.observe(dialogue);
    }

    function fadeRegionAudio(audio, from, to, seconds, done) {
      cancelAnimationFrame(regionFadeFrame);
      const duration = Math.max(0, Number(seconds) || 0) * 1000;
      if (!duration) {
        audio.volume = to;
        if (done) done();
        return;
      }
      const started = performance.now();
      const tick = (now) => {
        const progress = Math.min(1, (now - started) / duration);
        audio.volume = from + (to - from) * progress;
        if (progress < 1) regionFadeFrame = requestAnimationFrame(tick);
        else if (done) done();
      };
      regionFadeFrame = requestAnimationFrame(tick);
    }

    function clearRegionAudioUnlock() {
      if (regionUnlockCleanup) regionUnlockCleanup();
      regionUnlockCleanup = null;
    }

    function playRegionAudio(audio) {
      audio.play().then(clearRegionAudioUnlock).catch(() => {
        if (regionAudio !== audio) return;
        clearRegionAudioUnlock();
        const retry = () => {
          if (regionAudio !== audio) {
            clearRegionAudioUnlock();
            return;
          }
          audio.play().then(clearRegionAudioUnlock).catch(() => {});
        };
        const options = { capture: true, passive: true };
        window.addEventListener("pointerdown", retry, options);
        window.addEventListener("keydown", retry, options);
        window.addEventListener("touchend", retry, options);
        regionUnlockCleanup = () => {
          window.removeEventListener("pointerdown", retry, options);
          window.removeEventListener("keydown", retry, options);
          window.removeEventListener("touchend", retry, options);
        };
      });
    }

    function syncRegionMusic(music) {
      const nextKey = music && music.url ? music.url : "";
      if (regionAudio && regionAudioKey === nextKey) {
        regionAudio.loop = music.loop !== false;
        regionAudio.volume = Math.max(0, Math.min(1, Number(music.volume) || 0));
        if (regionAudio.paused) playRegionAudio(regionAudio);
        return;
      }
      const previous = regionAudio;
      const startNext = () => {
        if (!music || !music.url) return;
        const audio = new Audio(music.url);
        audio.muted = !settings.soundEnabled;
        regionAudio = audio;
        regionAudioKey = nextKey;
        audio.loop = music.loop !== false;
        audio._fadeOut = Math.max(0, Number(music.fadeOut) || 0);
        const targetVolume = Math.max(0, Math.min(1, Number(music.volume) || 0));
        audio.volume = Number(music.fadeIn) > 0 ? 0 : targetVolume;
        playRegionAudio(audio);
        fadeRegionAudio(audio, audio.volume, targetVolume, music.fadeIn);
      };
      clearRegionAudioUnlock();
      if (!previous) {
        startNext();
        return;
      }
      fadeRegionAudio(previous, previous.volume, 0, previous._fadeOut || 0, () => {
        previous.pause();
        if (regionAudio === previous) {
          regionAudio = null;
          regionAudioKey = "";
        }
        startNext();
      });
    }

    function fadeSceneAmbient(audio, from, to, seconds, done) {
      cancelAnimationFrame(sceneAmbientFadeFrame);
      const duration = Math.max(0, Number(seconds) || 0) * 1000;
      if (!duration) {
        audio.volume = to;
        if (done) done();
        return;
      }
      const started = performance.now();
      const tick = (now) => {
        const progress = Math.min(1, (now - started) / duration);
        audio.volume = from + (to - from) * progress;
        if (progress < 1) sceneAmbientFadeFrame = requestAnimationFrame(tick);
        else if (done) done();
      };
      sceneAmbientFadeFrame = requestAnimationFrame(tick);
    }

    function syncSceneAmbient(sound) {
      const nextKey = sound && sound.enabled && sound.url ? sound.url : "";
      if (sceneAmbientAudio && sceneAmbientKey === nextKey) {
        sceneAmbientAudio.loop = sound.loop !== false;
        sceneAmbientAudio.volume = Math.max(0, Math.min(1, Number(sound.volume) || 0));
        if (sceneAmbientAudio.paused) sceneAmbientAudio.play().catch(() => {});
        return;
      }
      const previous = sceneAmbientAudio;
      const startNext = () => {
        if (!nextKey) return;
        const audio = new Audio(nextKey);
        audio.muted = !settings.soundEnabled;
        sceneAmbientAudio = audio;
        sceneAmbientKey = nextKey;
        audio.loop = sound.loop !== false;
        audio._fadeOut = Math.max(0, Number(sound.fadeOut) || 0);
        const targetVolume = Math.max(0, Math.min(1, Number(sound.volume) || 0));
        audio.volume = Number(sound.fadeIn) > 0 ? 0 : targetVolume;
        audio.play().catch(() => {});
        fadeSceneAmbient(audio, audio.volume, targetVolume, sound.fadeIn);
      };
      if (!previous) {
        startNext();
        return;
      }
      fadeSceneAmbient(previous, previous.volume, 0, previous._fadeOut || 0, () => {
        previous.pause();
        if (sceneAmbientAudio === previous) {
          sceneAmbientAudio = null;
          sceneAmbientKey = "";
        }
        startNext();
      });
    }

    function nodeTitle(node) {
      return (node && node.data && node.data.title) || labels.option;
    }

    function audioTitle(node) {
      if (node && node.data && node.data.title) return String(node.data.title);
      const temp = document.createElement("div");
      temp.innerHTML = node && node.data && node.data.text || "";
      const text = (temp.textContent || "").trim().replace(/\\s+/g, " ");
      return text ? text.slice(0, 42) : labels.untitledAudio;
    }

    function renderPlaylist() {
      playlistItems.innerHTML = "";
      if (!playedAudios.length) {
        const empty = document.createElement("div");
        empty.className = "playlist-empty";
        empty.textContent = labels.playlistEmpty;
        playlistItems.appendChild(empty);
        return;
      }
      playedAudios.forEach((item) => {
        const row = document.createElement("div");
        const active = playlistAudio.getAttribute("src") === item.url && !playlistAudio.paused;
        row.className = "playlist-item" + (active ? " active" : "");
        const name = document.createElement("span");
        name.className = "playlist-name";
        name.textContent = item.title;
        name.title = item.title;
        const play = document.createElement("button");
        play.className = "playlist-play";
        play.type = "button";
        play.textContent = active ? "\\u275a\\u275a" : "\\u25b6";
        play.setAttribute("aria-label", active ? "Pause" : "Play");
        play.addEventListener("click", () => togglePlaylistAudio(item));
        row.append(name, play);
        playlistItems.appendChild(row);
      });
    }

    function recordAudio(node, url) {
      if (!node || !url) return;
      playlistAudio.pause();
      const item = { nodeId: node.id, title: audioTitle(node), url };
      playedAudios = [
        item,
        ...playedAudios.filter((audio) => audio.nodeId !== item.nodeId && audio.url !== item.url),
      ];
      renderPlaylist();
    }

    function togglePlaylistAudio(item) {
      gwAppearance(stageEl.querySelector('.dialogue'),dialogObject.appearance,dialogObject.corners?dialogObject.corners.map(n=>n+'px').join(' '):null);
      gwAppearance(backdropEl,settings.surfaceAppearances?.game);
      const exportedDialogue=stageEl.querySelector('.dialogue');if(exportedDialogue&&dialogObject.zIndex!==undefined)exportedDialogue.style.zIndex=String(dialogObject.zIndex);
      const nodeAudio = document.getElementById("nodeAudio");
      if (nodeAudio) nodeAudio.pause();
      if (playlistAudio.getAttribute("src") === item.url) {
        if (playlistAudio.paused) {
          playlistAudio.play().catch(() => {});
        } else {
          playlistAudio.pause();
        }
        return;
      }
      playlistAudio.src = item.url;
      playlistAudio.currentTime = 0;
      playlistAudio.play().catch(() => renderPlaylist());
    }

    function updateAutoButton() {
      autoButton.innerHTML = '<img src="./icons/' + (settings.autoAdvance ? 'pause.svg' : 'play.svg') + '" alt="" /><span>' + (settings.autoAdvance ? labels.autoOn : labels.autoOff) + '</span>';
      autoButton.setAttribute("aria-pressed", String(settings.autoAdvance));
    }

    function outEdges(id) {
      return content.edges.filter((edge) => edge.source === id);
    }

    function flowNodeText(node) {
      const data = node && node.data ? node.data : {};
      const raw = data.text || data.body || data.description || data.content || "";
      return String(raw).replace(/<[^>]*>/g, " ").replace(/\\s+/g, " ").trim().slice(0, 150);
    }

    function flowNodeTitle(node) {
      const data = node && node.data ? node.data : {};
      return String(data.title || data.name || data.label || node?.id || "Untitled");
    }

    function flowNodeImage(node) {
      const data = node && node.data ? node.data : {};
      return typeof data.imageUrl === "string" ? data.imageUrl : "";
    }

    let flowOverviewRootNodeId = "";
    let flowOverviewEdges = [];
    let flowOverviewLayoutDirection = settings.flowOverviewLayoutDirection || "right";
    let flowOverviewBranchLabel = "";

    function cycleFlowOverviewDirection() {
      const directions = ["right", "down", "left", "up"];
      const currentIndex = directions.indexOf(flowOverviewLayoutDirection);
      flowOverviewLayoutDirection = directions[(currentIndex + 1) % directions.length];
      if (flowOverviewBackdrop.classList.contains("open")) openFlowOverview();
    }

    function fitFlowOverview() {
      flowOverviewViewport.scrollTo({ left: 0, top: 0, behavior: "smooth" });
    }

    function flowPathNodeIds(targetId) {
      if (!targetId) return new Set();
      const parents = new Map();
      const visited = new Set([flowOverviewRootNodeId]);
      const queue = [flowOverviewRootNodeId];
      while (queue.length) {
        const source = queue.shift();
        flowOverviewEdges.forEach((edge) => {
          if (edge.source !== source || visited.has(edge.target)) return;
          visited.add(edge.target);
          parents.set(edge.target, source);
          queue.push(edge.target);
        });
      }
      const path = new Set([targetId]);
      let current = targetId;
      const guard = new Set();
      while (parents.has(current) && !guard.has(current)) {
        guard.add(current);
        current = parents.get(current);
        path.add(current);
      }
      return path;
    }

    function highlightFlowPath(targetId) {
      const path = flowPathNodeIds(targetId);
      flowOverviewCanvas.querySelectorAll(".flow-overview-node").forEach((card) => {
        card.classList.toggle("is-chain", path.has(card.getAttribute("data-node-id")));
      });
      flowOverviewCanvas.querySelectorAll(".flow-overview-edge").forEach((edge) => {
        edge.classList.toggle(
          "is-chain",
          path.has(edge.getAttribute("data-source")) && path.has(edge.getAttribute("data-target")),
        );
      });
    }

    function closeFlowOverview() {
      flowOverviewBackdrop.classList.remove("open");
      flowOverviewDetail.hidden = true;
      flowOverviewDetail.innerHTML = "";
      stopFlowOverviewMusic();
      flowOverviewCustomLayer.innerHTML = "";
      if (startScreen.classList.contains("open")) playStartMenuMusic();
    }

    function startGameFromFlowNode(nodeId) {
      const target = (Array.isArray(content.nodes) ? content.nodes : []).find((node) => node && node.id === nodeId);
      if (!target) return;
      if (historyOpen) closeDialogueHistory(false);
      restartPlaybackSession();
      history = [];
      currentId = target.id;
      autoAdvanceHoldId = currentId;
      activeSaveId = "save-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      closeFlowOverview();
      startGameFromCurrent();
      writeSave();
    }

    function showFlowNodeDetail(node) {
      if (!node) return;
      flowOverviewBranchLabel = flowNodeTitle(node);
      renderCustomStartMenu(null, flowOverviewCustomLayer, settings.flowOverviewElements);
      highlightFlowPath(node.id);
      const nextEdges = outEdges(node.id);
      flowOverviewDetail.hidden = false;
      flowOverviewDetail.innerHTML = "";
      const head = document.createElement("div");
      head.className = "flow-overview-detail-head";
      const heading = document.createElement("div");
      heading.className = "flow-overview-detail-title";
      heading.textContent = flowNodeTitle(node);
      const close = document.createElement("button");
      close.type = "button";
      close.className = "flow-overview-detail-close";
      close.textContent = "×";
      close.setAttribute("aria-label", content.language === "zh" ? "关闭剧情详情" : "Close story details");
      close.addEventListener("click", () => {
        flowOverviewDetail.hidden = true;
      });
      head.append(heading, close);

      const body = document.createElement("div");
      body.className = "flow-overview-detail-body";
      const text = document.createElement("p");
      text.className = "flow-overview-detail-text";
      text.textContent = flowNodeText(node) || (content.language === "zh" ? "暂无剧情文本" : "No story text");
      body.appendChild(text);

      const nextTitle = document.createElement("div");
      nextTitle.className = "flow-overview-detail-section-title";
      nextTitle.textContent = content.language === "zh" ? "后续剧情" : content.language === "ja" ? "次のストーリー" : "Next story";
      body.appendChild(nextTitle);
      if (nextEdges.length) {
        const nextList = document.createElement("div");
        nextList.className = "flow-overview-detail-list";
        nextEdges.forEach((edge) => {
          const nextNode = (Array.isArray(content.nodes) ? content.nodes : []).find((candidate) => candidate && candidate.id === edge.target);
          if (!nextNode) return;
          const item = document.createElement("button");
          item.type = "button";
          item.className = "flow-overview-detail-item";
          item.textContent = flowNodeTitle(nextNode);
          item.addEventListener("click", () => showFlowNodeDetail(nextNode));
          nextList.appendChild(item);
        });
        body.appendChild(nextList);
      } else {
        const empty = document.createElement("div");
        empty.className = "flow-overview-detail-empty";
        empty.textContent = content.language === "zh" ? "这是一个结束节点" : content.language === "ja" ? "終端ノードです" : "This is an ending node";
        body.appendChild(empty);
      }

      const play = document.createElement("button");
      play.type = "button";
      play.className = "flow-overview-detail-play";
      play.textContent = content.language === "zh" ? "从此处开始游戏" : content.language === "ja" ? "ここから再生" : "Play from here";
      play.addEventListener("click", () => startGameFromFlowNode(node.id));
      flowOverviewDetail.append(head, body, play);
    }

    function flowOverviewEdgePath(from, to) {
      const fromWidth = Number(from.width) || 220;
      const fromHeight = Number(from.height) || 132;
      const toWidth = Number(to.width) || 220;
      const toHeight = Number(to.height) || 132;
      if (flowOverviewLayoutDirection === "down" || flowOverviewLayoutDirection === "up") {
        const startX = from.x + fromWidth / 2;
        const endX = to.x + toWidth / 2;
        const startY = flowOverviewLayoutDirection === "down" ? from.y + fromHeight : from.y;
        const endY = flowOverviewLayoutDirection === "down" ? to.y : to.y + toHeight;
        const bend = Math.max(42, Math.abs(endY - startY) / 2);
        const sign = flowOverviewLayoutDirection === "down" ? 1 : -1;
        return "M " + startX + " " + startY + " C " + startX + " " + (startY + sign * bend) + ", " + endX + " " + (endY - sign * bend) + ", " + endX + " " + endY;
      }
      const startX = flowOverviewLayoutDirection === "right" ? from.x + fromWidth : from.x;
      const endX = flowOverviewLayoutDirection === "right" ? to.x : to.x + toWidth;
      const startY = from.y + fromHeight / 2;
      const endY = to.y + toHeight / 2;
      const bend = Math.max(42, Math.abs(endX - startX) / 2);
      const sign = flowOverviewLayoutDirection === "right" ? 1 : -1;
      return "M " + startX + " " + startY + " C " + (startX + sign * bend) + " " + startY + ", " + (endX - sign * bend) + " " + endY + ", " + endX + " " + endY;
    }

    function renderFlowOverviewMinimap(positionById, allEdges, canvasWidth, canvasHeight) {
      flowOverviewMinimap.innerHTML = "";
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 " + canvasWidth + " " + canvasHeight);
      svg.setAttribute("preserveAspectRatio", "none");
      allEdges.forEach((edge) => {
        const from = positionById.get(edge.source);
        const to = positionById.get(edge.target);
        if (!from || !to) return;
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", flowOverviewEdgePath(from, to));
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", "#94a3b8");
        path.setAttribute("stroke-width", "5");
        path.setAttribute("vector-effect", "non-scaling-stroke");
        svg.appendChild(path);
      });
      positionById.forEach((position, nodeId) => {
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", String(position.x));
        rect.setAttribute("y", String(position.y));
        rect.setAttribute("width", String(position.width || 220));
        rect.setAttribute("height", String(position.height || 132));
        rect.setAttribute("rx", "12");
        rect.setAttribute("fill", nodeId === flowOverviewRootNodeId ? "#818cf8" : "#cbd5e1");
        rect.setAttribute("fill-opacity", "0.9");
        svg.appendChild(rect);
      });
      flowOverviewMinimap.appendChild(svg);
    }

    function openFlowOverview() {
      const allNodes = Array.isArray(content.nodes) ? content.nodes.filter(Boolean) : [];
      const allEdges = Array.isArray(content.edges) ? content.edges.filter(Boolean) : [];
      applySurfaceBackground(flowOverviewPanel, "flowOverviewBackground");
      applySurfaceBackground(flowOverviewViewport, "flowOverviewBackground");
      flowOverviewViewport.style.setProperty("--flow-overview-minimap-width", settings.flowOverviewMinimapWidth + "px");
      flowOverviewViewport.style.setProperty("--flow-overview-minimap-height", settings.flowOverviewMinimapHeight + "px");
      if (startScreen.classList.contains("open")) stopStartMenuMusic();
      playFlowOverviewMusic();
      flowOverviewDetail.hidden = true;
      flowOverviewDetail.innerHTML = "";
      flowOverviewCanvas.innerHTML = "";
      if (!allNodes.length) {
        flowOverviewBranchLabel = content.language === "zh" ? "暂无剧情" : content.language === "ja" ? "ストーリーなし" : "No story";
        renderCustomStartMenu(null, flowOverviewCustomLayer, settings.flowOverviewElements);
        flowOverviewCanvas.textContent = labels.noStory;
        flowOverviewBackdrop.classList.add("open");
        return;
      }

      const rootNode = allNodes.find((node) => node.data && node.data.isRoot) || allNodes[0];
      flowOverviewRootNodeId = rootNode.id;
      flowOverviewBranchLabel = flowNodeTitle(rootNode);
      flowOverviewEdges = allEdges;
      const levelById = new Map([[rootNode.id, 0]]);
      const queue = [rootNode.id];
      while (queue.length) {
        const source = queue.shift();
        const nextLevel = (levelById.get(source) || 0) + 1;
        outEdges(source).forEach((edge) => {
          if (!levelById.has(edge.target)) {
            levelById.set(edge.target, nextLevel);
            queue.push(edge.target);
          }
        });
      }
      allNodes.forEach((node) => {
        if (!levelById.has(node.id)) levelById.set(node.id, 0);
      });
      const rowsByLevel = new Map();
      allNodes.forEach((node) => {
        const level = levelById.get(node.id) || 0;
        const row = rowsByLevel.get(level) || [];
        row.push(node);
        rowsByLevel.set(level, row);
      });
      const positionById = new Map();
      let maxRows = 1;
      rowsByLevel.forEach((row, level) => {
        maxRows = Math.max(maxRows, row.length);
        row.forEach((node, index) => positionById.set(node.id, { level, index }));
      });
      const maxLevel = Math.max(...Array.from(levelById.values()));
      positionById.forEach((position, nodeId) => {
        const horizontal = flowOverviewLayoutDirection === "right" || flowOverviewLayoutDirection === "left";
        const levelOffset = flowOverviewLayoutDirection === "left" || flowOverviewLayoutDirection === "up"
          ? maxLevel - position.level
          : position.level;
        position.x = 48 + (horizontal ? levelOffset * 282 : position.index * 282);
        position.y = 48 + (horizontal ? position.index * 150 : levelOffset * 180);
        const size = settings.flowOverviewCardSizes[nodeId] || {};
        position.width = clamp(size.width, 140, 420, 220);
        position.height = clamp(size.height, 90, 260, 132);
      });
      const horizontal = flowOverviewLayoutDirection === "right" || flowOverviewLayoutDirection === "left";
      const canvasWidth = Math.max(flowOverviewViewport.clientWidth - 1, (horizontal ? maxLevel + 1 : maxRows) * 282 + 96);
      const canvasHeight = Math.max(flowOverviewViewport.clientHeight - 1, (horizontal ? maxRows * 150 : (maxLevel + 1) * 180) + 96);
      flowOverviewCanvas.style.width = canvasWidth + "px";
      flowOverviewCanvas.style.height = canvasHeight + "px";

      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.className.baseVal = "flow-overview-svg";
      svg.setAttribute("width", String(canvasWidth));
      svg.setAttribute("height", String(canvasHeight));
      svg.setAttribute("viewBox", "0 0 " + canvasWidth + " " + canvasHeight);
      allEdges.forEach((edge) => {
        const from = positionById.get(edge.source);
        const to = positionById.get(edge.target);
        if (!from || !to) return;
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", flowOverviewEdgePath(from, to));
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", "#94a3b8");
        path.setAttribute("stroke-width", "2");
        path.classList.add("flow-overview-edge");
        path.setAttribute("data-source", edge.source);
        path.setAttribute("data-target", edge.target);
        svg.appendChild(path);
      });
      flowOverviewCanvas.appendChild(svg);
      renderFlowOverviewMinimap(positionById, allEdges, canvasWidth, canvasHeight);
      renderCustomStartMenu(null, flowOverviewCustomLayer, settings.flowOverviewElements);

      allNodes.forEach((node) => {
        const position = positionById.get(node.id);
        const card = document.createElement("div");
        card.className = "flow-overview-node" + (node.id === rootNode.id ? " root" : "");
        card.style.left = position.x + "px";
        card.style.top = position.y + "px";
        card.style.width = (position.width || 220) + "px";
        card.style.height = (position.height || 132) + "px";
        card.setAttribute("data-node-id", node.id);
        const imageUrl = flowNodeImage(node);
        if (imageUrl) {
          const image = document.createElement("img");
          image.className = "flow-overview-node-image";
          image.src = imageUrl;
          image.alt = "";
          card.appendChild(image);
        } else {
          card.classList.add("no-image");
        }
        card.tabIndex = 0;
        card.setAttribute("role", "button");
        card.setAttribute("aria-label", (content.language === "zh" ? "查看并从此处开始：" : "View and play from: ") + flowNodeTitle(node));
        card.addEventListener("click", () => showFlowNodeDetail(node));
        card.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            showFlowNodeDetail(node);
          }
        });
        flowOverviewCanvas.appendChild(card);
      });
      flowOverviewBackdrop.classList.add("open");
    }

    let isTransitioning = false;

    function getPresentationTransform(type, isExit) {
      if (type === 'slide-left' || type === 'slideLeft') {
        return 'translateX(' + (isExit ? '-120%' : '100%') + ')';
      }
      if (type === 'slide-right' || type === 'slideRight') {
        return 'translateX(' + (isExit ? '120%' : '-100%') + ')';
      }
      if (type === 'slide-up' || type === 'slideUp') {
        return 'translateY(' + (isExit ? '-120%' : '100%') + ')';
      }
      if (type === 'slide-down' || type === 'slideDown') {
        return 'translateY(' + (isExit ? '120%' : '-100%') + ')';
      }
      if (type === 'zoom') return 'scale(0.82)';
      return '';
    }

    function goTo(id) {
      if (!storyPlaybackActive() || isTransitioning) return;
      if (autoAdvanceTimer) {
        clearTimeout(autoAdvanceTimer);
        autoAdvanceTimer = null;
      }
      
      const node = nodeById.get(currentId);
      let exitDuration = 0;
      
      if (node && node.data) {
        const data = node.data;
        const sceneExit = data.presentation && data.presentation.scene && data.presentation.scene.exit;
        const sceneExitDuration =
          sceneExit && sceneExit.type !== 'none' ? Math.max(0, sceneExit.duration || 0) / settings.animationSpeed : 0;
        let characterExitDuration = 0;
        if (data.presentation && Array.isArray(data.presentation.characters)) {
          data.presentation.characters.forEach((char) => {
            if (char.exit && char.exit.type !== 'none') {
              characterExitDuration = Math.max(characterExitDuration, (char.exit.duration || 0) / settings.animationSpeed);
            }
          });
        }
        exitDuration = characterExitDuration + sceneExitDuration;
        
        if (exitDuration > 0) {
          isTransitioning = true;
          
          const mediaEl = stageEl.querySelector('.scene-image, #nodeVideo');
          if (mediaEl && sceneExit && sceneExit.type !== 'none') {
            mediaEl.style.transition = 'opacity ' + sceneExitDuration + 'ms ease-out, transform ' + sceneExitDuration + 'ms ease-out';
            mediaEl.style.transitionDelay = characterExitDuration + 'ms';
            if (sceneExit.type === 'fade') {
              mediaEl.style.opacity = '0';
            } else {
              mediaEl.style.transform = getPresentationTransform(sceneExit.type, true);
            }
          }
          
          if (data.presentation && Array.isArray(data.presentation.characters)) {
            const charImgs = stageEl.querySelectorAll('.character-img');
            data.presentation.characters.forEach((char, idx) => {
              const imgEl = charImgs[idx];
              if (imgEl && char.exit && char.exit.type !== 'none') {
                const duration = (char.exit.duration || 0) / settings.animationSpeed;
                imgEl.style.transition = 'opacity ' + duration + 'ms ease-out, transform ' + duration + 'ms ease-out';
                if (char.exit.type === 'fade') {
                  imgEl.style.opacity = '0';
                } else {
                  const flipScale = char.flipX ? -1 : 1;
                  const scale = char.scale || 1;
                  const transformMotion = getPresentationTransform(char.exit.type, true);
                  imgEl.style.transform = 'translate(-50%, 0) ' + transformMotion + ' scale(' + scale + ') scaleX(' + flipScale + ')';
                }
              }
            });
          }
        }
      }
      
      if (exitDuration > 0) {
        const sessionId = playbackSession;
        schedulePlaybackStep(() => {
          if (sessionId !== playbackSession) return;
          isTransitioning = false;
          if (currentId) history.push(currentId);
          currentId = id;
          render();
          writeSave();
        }, exitDuration);
      } else {
        if (currentId) history.push(currentId);
        currentId = id;
        render();
        writeSave();
      }
    }

    function animationClass(animation) {
      return animation && animation !== "none" ? " anim-" + animation : "";
    }

    function stripHtml(html) {
      const temp = document.createElement("div");
      temp.innerHTML = html || "";
      return temp.textContent || "";
    }

    function filterInlineMentionTags(html) {
      if (!html) return "";
      const temp = document.createElement("div");
      temp.innerHTML = html;
      temp.querySelectorAll('[data-mention-kind="video"]').forEach((node) => node.remove());
      if (settings.hideCharacterTags) {
        temp.querySelectorAll('[data-mention-kind="character"]').forEach((node) => node.remove());
      }
      if (settings.hideSceneTags) {
        temp.querySelectorAll('[data-mention-kind="scene"]').forEach((node) => node.remove());
      }
      return temp.innerHTML;
    }

    function findInlineAction(mention, presentation) {
      if (!presentation || !Array.isArray(presentation.inlineActions)) return null;
      const kind = mention.dataset.mentionKind;
      if (kind !== "character" && kind !== "scene") return null;
      const mentionId = mention.dataset.mentionId || "";
      const name = mention.dataset.mentionName || (mention.textContent || "").replace(/^@/, "");
      const sourceNodeId = mention.dataset.sourceNodeId || mention.dataset.mentionSourceNodeId || "";
      return presentation.inlineActions.find((item) => item.id === mentionId) ||
        presentation.inlineActions.find((item) => sourceNodeId && item.kind === kind && item.sourceNodeId === sourceNodeId) ||
        presentation.inlineActions.find((item) => name && item.kind === kind && item.name === name) ||
        null;
    }

    function buildInlinePlaybackSteps(rawHtml, displayHtml, presentation) {
      if (!rawHtml || !presentation || !Array.isArray(presentation.inlineActions) || !presentation.inlineActions.length) {
        return [{ kind: "text", html: displayHtml || rawHtml || "" }];
      }
      const temp = document.createElement("div");
      temp.innerHTML = rawHtml || "";
      const steps = [];
      let buffer = "";
      const hasMeaningfulTextOutsideMentions = (html) => {
        const probe = document.createElement("div");
        probe.innerHTML = html || "";
        probe.querySelectorAll(".mention-chip").forEach((node) => node.remove());
        return /[\\p{L}\\p{N}]/u.test(probe.textContent || "");
      };
      const mentionPlacement = (mention) => {
        const beforeRange = document.createRange();
        beforeRange.setStart(temp, 0);
        beforeRange.setEndBefore(mention);
        const afterRange = document.createRange();
        afterRange.setStartAfter(mention);
        afterRange.setEnd(temp, temp.childNodes.length);
        const before = document.createElement("div");
        const after = document.createElement("div");
        before.appendChild(beforeRange.cloneContents());
        after.appendChild(afterRange.cloneContents());
        if (!hasMeaningfulTextOutsideMentions(before.innerHTML)) return "start";
        if (!hasMeaningfulTextOutsideMentions(after.innerHTML)) return "end";
        return "inline";
      };
      const flush = () => {
        const html = filterInlineMentionTags(buffer);
        if (stripHtml(html).trim()) steps.push({ kind: "text", html });
        buffer = "";
      };
      Array.from(temp.childNodes).forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains("mention-chip")) {
          if (mentionPlacement(node) !== "inline") {
            buffer += node.outerHTML || "";
            return;
          }
          const action = findInlineAction(node, presentation);
          if (action) {
            flush();
            steps.push({ kind: "action", action });
            return;
          }
        }
        buffer += node.nodeType === Node.ELEMENT_NODE ? node.outerHTML : (node.textContent || "");
      });
      flush();
      return steps.length ? steps : [{ kind: "text", html: displayHtml || rawHtml || "" }];
    }

    function cssEscape(value) {
      if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(String(value || ""));
      return String(value || "").replace(/["\\\\]/g, "\\\\$&");
    }

    function clearInlineActionElement(element) {
      if (!element) return;
      element.classList.remove("inline-shake-x", "inline-shake-y", "inline-pulse", "inline-rotate", "inline-opacity", "inline-brightness");
      element.style.removeProperty("--inline-action-duration");
      element.style.removeProperty("--inline-action-strength");
      element.style.removeProperty("--inline-action-scale");
      element.style.removeProperty("--inline-action-step-duration");
      element.style.removeProperty("--inline-action-count");
      element.style.removeProperty("--inline-action-rotation");
      element.style.removeProperty("--inline-action-opacity");
      element.style.removeProperty("--inline-action-brightness");
      const baseTransform = element.dataset.baseTransform || "";
      if (baseTransform) element.style.transform = baseTransform;
    }

    function inlineActionTransform(action) {
      if (!action || action.action === "none" || action.action === "pulse") return "";
      if (action.action === "translate") return "translate(" + (action.offsetX || action.strength || 0) + "px, " + (action.offsetY || 0) + "px)";
      if (action.action === "translate-x") return "translateX(" + (action.offsetX || action.strength || 0) + "px)";
      if (action.action === "translate-y") return "translateY(" + (action.offsetY || action.strength || 0) + "px)";
      if (action.action === "scale") return "scale(" + (action.scale || 1.08) + ")";
      return "";
    }

    function isPersistentInlineAction(action) {
      return action && (
        action.action === "translate" ||
        action.action === "translate-x" ||
        action.action === "translate-y" ||
        action.action === "rotate" ||
        action.action === "opacity" ||
        action.action === "brightness"
      );
    }

    function playSceneSwitch(action) {
      const outgoing = stageEl.querySelector('.scene-image');
      const source = nodeById.get(action.sourceNodeId || "");
      const media = source && source.data && Array.isArray(source.data.images)
        ? source.data.images.find((item) => item && item.id === action.targetAssetId)
        : null;
      const targetUrl = media && media.imageUrl;
      if (!outgoing || !targetUrl) return;
      const duration = Math.max(180, Number(action.duration) || 420) / settings.animationSpeed;
      const host = outgoing.parentElement;
      if (!host) return;
      const reveal = document.createElement('div');
      reveal.style.cssText = 'position:absolute;inset:0;z-index:20;overflow:hidden;clip-path:inset(0 100% 0 0);transition:clip-path ' + duration + 'ms cubic-bezier(.2,.72,.25,1);pointer-events:none;';
      const incoming = outgoing.cloneNode(true);
      incoming.src = targetUrl;
      incoming.style.cssText = outgoing.style.cssText;
      incoming.style.position = 'absolute';
      incoming.style.inset = '0';
      incoming.style.width = '100%';
      incoming.style.height = '100%';
      reveal.appendChild(incoming);
      const flash = document.createElement('div');
      // The flash is 58% of the stage width. These two offsets keep its centre
      // on the reveal edge for the entire duration: 0% -> 100% of the stage.
      flash.style.cssText = 'position:absolute;top:-28%;left:0;z-index:31;width:58%;height:156%;pointer-events:none;opacity:0;background:radial-gradient(ellipse at center,rgba(255,255,255,.98) 0%,rgba(255,255,255,.68) 23%,rgba(255,255,255,0) 67%);mix-blend-mode:screen;transform:translateX(-50%);transition:transform ' + duration + 'ms cubic-bezier(.2,.72,.25,1),opacity ' + duration + 'ms cubic-bezier(.2,.72,.25,1);';
      host.append(reveal, flash);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        reveal.style.clipPath = 'inset(0 0 0 0)';
        flash.style.opacity = '1';
        flash.style.transform = 'translateX(122.414%)';
      }));
      const timer = schedulePlaybackStep(() => {
        outgoing.src = targetUrl;
        reveal.remove();
        flash.remove();
      }, duration);
      typewriterTimers.push(timer);
    }

    function applyInlineAction(action) {
      if (!action || action.action === "none") return;
      if (action.kind === 'scene' && action.action === 'switch') {
        playSceneSwitch(action);
        return;
      }
      const duration = Math.max(0, action.duration || 0) / settings.animationSpeed;
      const target =
        action.kind === "scene"
          ? stageEl.querySelector('.scene-image, #nodeVideo')
          : stageEl.querySelector('.character-img[data-source-id="' + cssEscape(action.sourceNodeId || "") + '"]') ||
            Array.from(stageEl.querySelectorAll(".character-img")).find((img) => (img.getAttribute("alt") || "") === (action.name || ""));
      if (!target) return;
      clearInlineActionElement(target);
      target.style.setProperty("--inline-action-duration", duration + "ms");
      const repeats = Math.max(1, Math.round(action.repeats || 1));
      target.style.setProperty("--inline-action-step-duration", Math.max(40, duration / repeats) + "ms");
      target.style.setProperty("--inline-action-count", repeats);
      target.style.setProperty("--inline-action-strength", Math.max(1, action.strength || 14) + "px");
      target.style.setProperty("--inline-action-scale", action.scale || 1.08);
      target.style.setProperty("--inline-action-rotation", Math.max(-360, Math.min(360, action.strength || 15)) + "deg");
      target.style.setProperty("--inline-action-opacity", Math.max(0, Math.min(1, (action.strength || 0) / 100)));
      target.style.setProperty("--inline-action-brightness", Math.max(0, Math.min(1, (action.strength || 0) / 100)));
      const baseTransform = target.dataset.baseTransform || target.style.transform || "";
      target.dataset.baseTransform = baseTransform;
      const transform = inlineActionTransform(action);
      if (transform) {
        target.style.transition = "transform " + duration + "ms ease";
        target.style.transform = (baseTransform ? baseTransform + " " : "") + transform;
      } else {
        if (action.action === "shake-x") target.classList.add("inline-shake-x");
        if (action.action === "shake-y") target.classList.add("inline-shake-y");
        if (action.action === "pulse") target.classList.add("inline-pulse");
        if (action.action === "rotate") target.classList.add("inline-rotate");
        if (action.action === "opacity") target.classList.add("inline-opacity");
        if (action.action === "brightness") target.classList.add("inline-brightness");
      }
      if (!isPersistentInlineAction(action)) {
        const resetTimer = schedulePlaybackStep(() => clearInlineActionElement(target), duration);
        typewriterTimers.push(resetTimer);
      }
    }

    const mountPresentationText = ${mountPresentationText.toString()};
    function mountResolvedText(node) {
      const data = node.data.dialogueText;
      if (!data) return;
      const panel = stageEl.querySelector('.dialogue');
      Object.assign(panel.style, { position: 'absolute', boxSizing: 'border-box', margin: '0', padding: '0',
        left: data.dialog.x + 'px', top: data.dialog.y + 'px', width: data.dialog.width + 'px', height: data.dialog.height + 'px' });
      const title = panel.querySelector('.title');
      if (title) title.hidden = true;
      const text = document.getElementById('nodeText');
      text.setAttribute('aria-hidden', 'true');
      Object.assign(text.style, { position: 'absolute', opacity: '0', pointerEvents: 'none', width: '1px', height: '1px', overflow: 'hidden' });
      const hosts = {};
      for (const kind of ['title', 'body']) {
        const block = data[kind];
        if (!block.visible || (kind === 'title' && !storyTitle(node.data.title))) continue;
        const frame = document.createElement('div');
        frame.dataset.resolvedText = kind;
        Object.assign(frame.style, { position: 'absolute', left: block.left + 'px', top: block.top + 'px',
          width: block.width + 'px', height: block.height + 'px', transformOrigin: 'center',
          transform: 'rotate(' + block.rotation + 'deg) scale(' + (block.flipX ? -1 : 1) + ',' + (block.flipY ? -1 : 1) + ')' });
        const host = document.createElement('div');
        mountPresentationText(host, block);
        host.style.transform = 'scale(' + settings.textScale / 100 + ')';
        frame.appendChild(host);
        panel.appendChild(frame);
        hosts[kind] = host;
      }
      text._revealText = function(count) {
        if (hosts.body) mountPresentationText(hosts.body, data.body, count);
      };
    }

    function applyTypewriter(element, html, rawHtml, presentation, enabled, revealChoices) {
      if (revealChoices) currentTextEnded = false;
      if (!element) { if (revealChoices) showChoicesAndMaybeAdvance(); return; }
      if (!enabled) {
        element.classList.remove("typewriter-reserved");
        element.innerHTML = html || "";
        if (element._revealText) element._revealText(Infinity);
        if (revealChoices) showChoicesAndMaybeAdvance();
        return;
      }
      const playbackSteps = buildInlinePlaybackSteps(rawHtml || html || "", html || "", presentation);
      const source = playbackSteps.filter((step) => step.kind === "text").map((step) => stripHtml(step.html)).join("");
      element.classList.add("typewriter-reserved");
      element.innerHTML = "";
      const placeholder = document.createElement("span");
      placeholder.className = "typewriter-placeholder";
      placeholder.textContent = source || " ";
      placeholder.setAttribute("aria-hidden", "true");
      const visible = document.createElement("span");
      visible.className = "typewriter-visible";
      element.append(placeholder, visible);
      let stepIndex = 0;
      let committedText = "";
      let segmentTimer = 0;
      visible.textContent = "";
      if (element._revealText) element._revealText(0);
      const playNextStep = () => {
        clearInterval(segmentTimer);
        const step = playbackSteps[stepIndex];
        if (!step) {
          visible.textContent = committedText;
          if (element._revealText) element._revealText(Array.from(committedText).length);
          if (revealChoices) showChoicesAndMaybeAdvance();
          return;
        }
        if (step.kind === "action") {
          applyInlineAction(step.action);
          const waitTimer = schedulePlaybackStep(() => {
            stepIndex += 1;
            playNextStep();
          }, Math.max(0, step.action.duration || 0) / settings.animationSpeed);
          typewriterTimers.push(waitTimer);
          return;
        }
        const segmentText = stripHtml(step.html);
        const segmentUnits = style.bodyTypewriterMode === "line"
          ? segmentText.split(/(\\n+)/)
          : (style.bodyTypewriterMode === "sentence" || style.bodyTypewriterMode === "word")
            ? (segmentText.match(/[^閵嗗偊绱掗敍?!?\\n]+[閵嗗偊绱掗敍?!?]*|\\n+/g) || Array.from(segmentText))
            : Array.from(segmentText);
        let segmentIndex = 0;
        segmentTimer = setInterval(() => {
          if (!storyPlaybackActive()) return;
          segmentIndex += 1;
          visible.textContent = committedText + segmentUnits.slice(0, segmentIndex).join("");
          if (element._revealText) element._revealText(Array.from(visible.textContent).length);
          if (segmentIndex >= segmentUnits.length) {
            clearInterval(segmentTimer);
            committedText += segmentText;
            stepIndex += 1;
            playNextStep();
          }
        }, settings.typewriterSpeed);
        typewriterTimers.push(segmentTimer);
      };
      playNextStep();
    }

    function choicesHtml(node, edges, className) {
      if (choiceObject.visible === false) return "";
      const choiceTransform = "rotate(" + (Number(choiceObject.rotation) || 0) + "deg) scale(" + (choiceObject.flipX ? -1 : 1) + ", " + (choiceObject.flipY ? -1 : 1) + ")";
      const rootStyle = "--choice-transform: " + (className === "center" ? "translate(-50%, -50%) " : "") + choiceTransform + ";";
      if (!edges.length) {
        return '<div class="choices ' + className + '" style="' + rootStyle + '"><button class="choice anim-fade" data-target="THE_END" style="--choice-item-x:0px;--choice-item-y:0px">' + labels.end + '</button></div>';
      }
      const buttons = edges.map((edge, index) => {
        const target = nodeById.get(edge.target);
        const label = nodeTitle(target) || edge.label || (edges.length === 1 ? labels.continue : labels.option + " " + (index + 1));
        const offsetX = index * (Number(style.choiceItemOffsetX) || 0);
        const offsetY = index * (Number(style.choiceItemOffsetY) || 0);
        return '<button class="choice anim-fade" data-target="' + escapeAttr(edge.target) + '" style="transform:translate(' + offsetX + 'px,' + offsetY + 'px)">' + escapeHtml(label) + '</button>';
      }).join("");
      return '<div class="choices ' + className + '" style="' + rootStyle + '">' + buttons + '</div>';
    }

    function renderChoices(node, edges, position) {
      if (settings.skipSingleChoicePopup && edges.length <= 1) return "";
      return choicesHtml(node, edges, position);
    }

    function bindChoices() {
      stageEl.querySelectorAll("[data-target]").forEach((button) => {
        button.onclick = (event) => {
          event.stopPropagation();
          autoAdvanceHoldId = null;
          goTo(button.getAttribute("data-target"));
        };
      });
    }

    function showChoicesAndMaybeAdvance() {
      if (!storyPlaybackActive()) return;
      currentTextEnded = true;
      if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null; }
      stageEl.querySelectorAll(".choices").forEach((element) => {
        element.hidden = false;
      });
      bindChoices();
      const node = nodeById.get(currentId);
      const hasMedia = Boolean(
        node &&
          node.data &&
          (node.data.audioUrl || (node.data.videoUrl && !node.data.imageUrl)),
      );
      if (hasMedia) { maybeAdvanceAfterMedia(); return; }
      if (
        !settingsBackdrop.classList.contains("open") &&
        settings.autoAdvance &&
        autoAdvanceHoldId !== currentId &&
        !hasMedia &&
        outEdges(currentId).length <= 1
      ) {
        const sessionId = playbackSession;
        autoAdvanceTimer = setTimeout(() => {
          if (sessionId !== playbackSession || !storyPlaybackActive()) return;
          const next = outEdges(currentId)[0]?.target || "THE_END";
          goTo(next);
        }, 900);
      }
    }

    function maybeAdvanceAfterMedia() {
      if (!storyPlaybackActive() || !currentId || currentId === "THE_END" || !currentTextEnded || settingsBackdrop.classList.contains("open") || startScreen.classList.contains("open")) return;
      if (!settings.autoAdvance || autoAdvanceHoldId === currentId || outEdges(currentId).length > 1) return;
      if (currentAudioEnded && currentVideoEnded) {
        goTo(outEdges(currentId)[0]?.target || "THE_END");
      }
    }

    function continueFromText() {
      if (!storyPlaybackActive() || !currentId || currentId === "THE_END") return;
      autoAdvanceHoldId = null;
      const edges = outEdges(currentId);
      if (edges.length <= 1) {
        goTo(edges[0]?.target || "THE_END");
      }
    }

    function render() {
      if (!storyPlaybackActive()) return;
      updatePlaybackToolbar();
      currentTextEnded = false;
      clearPlaybackTimers();
      backButton.disabled = history.length === 0;
      if (!currentId) {
        syncRegionMusic(null);
        syncSceneAmbient(null);
        backdropEl.style.backgroundImage = "";
        stageEl.innerHTML = '<div class="end">' + labels.noStory + '</div>';
        return;
      }
      if (currentId === "THE_END") {
        syncRegionMusic(null);
        syncSceneAmbient(null);
        playlistAudio.pause();
        const lastImage = stageEl.querySelector('.scene-image');
        if (lastImage?.src) backdropEl.style.backgroundImage = 'url("' + lastImage.src.replace(/"/g, '%22') + '")';
        stageEl.replaceChildren();
        const ending = document.createElement('div'); stageEl.appendChild(ending);
        mountEnding(ending, playbackCopy, settings.showStartMenu, startNewGame, () => {
          if (settings.showStartMenu) returnToMainMenu(); else ending.remove();
        });
        return;
      }
      const node = nodeById.get(currentId);
      if (!node) {
        currentId = "THE_END";
        render();
        return;
      }
      const data = node.data || {};
      if (node.type === "numberConditionNode") {
        if (currentId === lastJumpedNode) return;
        lastJumpedNode = currentId;
        history.push(currentId);
        currentId = numberConditionTarget(node);
        render();
        return;
      }
      if (data.skip === true) {
        if (currentId === lastJumpedNode) return;
        lastJumpedNode = currentId;
        history.push(currentId);
        currentId = outEdges(currentId)[0]?.target || "THE_END";
        render();
        return;
      }
      syncRegionMusic(data.backgroundMusic || null);
      syncSceneAmbient(data.presentation && data.presentation.scene && data.presentation.scene.ambientSound || null);
      const edges = outEdges(currentId);
      const choicePosition = settings.choicesPosition || "belowText";
      const hideCenteredTitle = style.titleVisible === false || data.hideTitleInPlayback === true || !storyTitle(data.title);
      const image = data.imageUrl || "";
      const video = data.videoUrl || "";
      currentAudioEnded = !data.audioUrl;
      currentVideoEnded = !video || Boolean(image);

      // 鍦烘櫙鍏ュ満鍙婂熀纭€鏍峰紡璁＄畻
      const sceneEnter = data.presentation && data.presentation.scene && data.presentation.scene.enter;
      const hasSceneEnter = sceneEnter && sceneEnter.type !== "none";
      const sceneDuration = hasSceneEnter ? (sceneEnter.duration || 0) / settings.animationSpeed : 0;
      const sceneCrop = data.presentation && data.presentation.scene && data.presentation.scene.cropMode;
      const sceneVisual = data.presentation && data.presentation.scene && data.presentation.scene.scenePresetEnabled
        ? data.presentation.scene.visualStyle || {}
        : {};
      const sceneBlur = Math.max(0, Math.min(12, Number(sceneVisual.backgroundBlur || 0)));
      const sceneFilter = sceneBlur ? 'blur(' + sceneBlur + 'px)' : 'none';
      const sceneLightOverlayUrl = data.presentation && data.presentation.scene && data.presentation.scene.scenePresetEnabled
        ? (data.presentation.scene.lightOverlayUrl || '')
        : '';
      const sceneLightOpacity = Math.max(0.2, Math.min(1, Number(sceneVisual.intensity || 50) / 100));
      const sceneScale = data.presentation && data.presentation.scene && data.presentation.scene.scale || 1;
      const sceneOffsetX = data.presentation && data.presentation.scene && data.presentation.scene.offsetX || 0;
      const sceneOffsetY = data.presentation && data.presentation.scene && data.presentation.scene.offsetY || 0;
      const sceneObjectFit = sceneCrop === 'contain' ? 'contain' : sceneCrop === 'stretch' ? 'fill' : 'cover';
      const immersive = settings.layoutMode === 'immersive';
      const sharedSceneFit = settings.sceneFit === 'stretch' ? 'fill' : settings.sceneFit;
      const finalCrop = immersive ? 'contain' : sharedSceneFit;
      const finalOffsetX = immersive ? 0 : sceneOffsetX;
      const finalOffsetY = immersive ? 0 : sceneOffsetY;
      const finalSceneScaleX = sceneScale * (immersive ? 1 : settings.sceneScaleX / 100);
      const finalSceneScaleY = sceneScale * (immersive ? 1 : settings.sceneScaleY / 100);
      
      const initSceneOpacity = (hasSceneEnter && sceneEnter.type === 'fade') ? 0 : 1;
      const initSceneTransform = hasSceneEnter ? getPresentationTransform(sceneEnter.type, false) : 'none';
      const initSceneStyle = 
        'object-fit: ' + finalCrop + '; ' +
        'object-position: ' + (50 + finalOffsetX) + '% ' + (50 + finalOffsetY) + '%; ' +
        'opacity: ' + initSceneOpacity + '; ' +
        'transform: ' + initSceneTransform + (sceneBlur ? ' scale(' + (1 + Math.min(0.06, sceneBlur / 100)) + ')' : '') + '; ' +
        'filter: ' + sceneFilter + '; ' +
        'transition: opacity ' + sceneDuration + 'ms ease-out, transform ' + sceneDuration + 'ms ease-out;';

      const media = image
        ? '<img class="scene-image" src="' + escapeAttr(image) + '" alt="" style="' + initSceneStyle.replace('object-fit: ' + finalCrop, 'object-fit: contain') + '" />'
        : video
          ? '<video id="nodeVideo" src="' + escapeAttr(video) + '" controls playsinline style="' + initSceneStyle + '" ' + (settings.videoAutoPlay || settings.autoAdvance ? 'autoplay muted ' : '') + '></video>'
          : labels.noStory;

      let charactersHtml = "";
      let nameplatesHtml = "";
      if (data.presentation && Array.isArray(data.presentation.characters)) {
        const dialogWidth = clamp(style.dialogWidth, 35, 100, 86);
        const dialogLeft = 50 + clamp(style.dialogOffsetX, -100, 100, 0) * 0.5 - dialogWidth / 2;
        const visibleNameplates = style.nameplateVisible !== false
          ? data.presentation.characters.filter((char) => char && char.name)
          : [];
        if (visibleNameplates.length) {
          const total = visibleNameplates.length;
          nameplatesHtml = '<div class="nameplate-layer ' + (style.nameplateInside ? 'inside' : 'outside') + '">' +
            visibleNameplates.map((char, idx) => {
              const basePosition = char.position === "left" ? 24 : char.position === "right" ? 76 : 50;
              const characterCenter = basePosition + (Number(char.offsetX) || 0) / 10;
              const localLeft = style.nameplateFollowCharacter === false
                ? 50 + (idx - (total - 1) / 2) * 18
                : Math.max(4, Math.min(96, ((characterCenter - dialogLeft) / dialogWidth) * 100));
              return '<div class="nameplate" style="left: ' + localLeft + '%">' + escapeHtml(char.name || "") + '</div>';
            }).join("") +
            '</div>';
        }
        charactersHtml = '<div class="characters-layer">' +
          data.presentation.characters.map((char) => {
            const charEnter = char.enter;
            const hasCharEnter = charEnter && charEnter.type !== "none";
            const charDuration = hasCharEnter ? (charEnter.duration || 0) / settings.animationSpeed : 0;
            
            const basePosition = char.position === "left" ? 24 : char.position === "right" ? 76 : 50;
            const left = "calc(" + basePosition + "% + " + (char.offsetX / 10) + "%)";
            const bottom = (char.offsetY / 10) + "%";
            const zIndex = Math.min(20, Math.max(1, char.layer || 1));
            const flipScale = char.flipX ? -1 : 1;
            const scale = char.scale || 1;
            
            const initCharOpacity = (hasCharEnter && charEnter.type === 'fade') ? 0 : 1;
            const initCharTransform = 'translate(-50%, 0) ' + (hasCharEnter ? getPresentationTransform(charEnter.type, false) : '') + ' scale(' + scale + ') scaleX(' + flipScale + ')';
            
            return '<img class="character-img" src="' + escapeAttr(char.imageUrl) + '" alt="' + escapeAttr(char.name || "") + '" data-source-id="' + escapeAttr(char.sourceNodeId || "") + '" ' +
              'style="' +
                'left: ' + left + '; ' +
                'bottom: ' + bottom + '; ' +
                'z-index: ' + zIndex + '; ' +
                'opacity: ' + initCharOpacity + '; ' +
                'transform: ' + initCharTransform + '; ' +
                'transition: opacity ' + charDuration + 'ms ease-out ' + sceneDuration + 'ms, transform ' + charDuration + 'ms ease-out ' + sceneDuration + 'ms;' +
              '" />';
          }).join("") +
          "</div>";
      }

      const lightOverlayHtml = sceneLightOverlayUrl
        ? '<img class="scene-light-overlay" src="' + escapeAttr(sceneLightOverlayUrl) + '" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;z-index:30;mix-blend-mode:soft-light;opacity:' + sceneLightOpacity + ';" />'
        : '';

      backdropEl.style.backgroundImage = image ? 'url("' + image.replace(/"/g, '\\"') + '")' : "";
      if (!immersive) {
        stageEl.style.background = !settings.sceneBackgroundVisible
          ? 'transparent'
          : settings.sceneBackgroundType === 'image' && settings.sceneBackgroundImageUrl
            ? 'center / cover no-repeat url("' + settings.sceneBackgroundImageUrl.replace(/"/g, '\\"') + '")'
            : settings.sceneBackgroundType === 'gradient'
              ? 'linear-gradient(' + settings.sceneBackgroundGradientAngle + 'deg, ' + (settings.sceneBackgroundGradientStops && settings.sceneBackgroundGradientStops.length >= 2 ? settings.sceneBackgroundGradientStops.map(function(stop) { var hex = String(stop.color || '#000000').slice(0, 7); var alpha = Math.round(Math.max(0, Math.min(100, Number(stop.alpha))) * 255 / 100).toString(16).padStart(2, '0'); return hex + alpha + ' ' + stop.position + '%'; }).join(', ') : settings.sceneBackgroundGradientStart + ', ' + settings.sceneBackgroundGradientEnd) + ')'
              : settings.sceneBackgroundColor;
      }
      stageEl.innerHTML =
        '<div class="media ' + (!image && !video ? 'empty' : '') + '">' +
          '<div class="presentation-scale" style="position:relative;transform: translate(' + (immersive ? 0 : settings.sceneOffsetX / 2) + '%, ' + (immersive ? 0 : settings.sceneOffsetY / 2) + '%) scale(' + finalSceneScaleX + ', ' + finalSceneScaleY + ')">' +
            media + charactersHtml + lightOverlayHtml +
          '</div>' +
        '</div>' +
        '<div class="dialogue">' +
          nameplatesHtml +
          (choicePosition === "aboveText" ? renderChoices(node, edges, "above") : "") +
          (hideCenteredTitle ? "" : '<h2 class="title' + animationClass(style.titleAnimation) + '">' + escapeHtml(data.title || "") + '</h2>') +
          '<div class="text' + animationClass(style.bodyAnimation) + '" id="nodeText">' + (data.text || "") + '</div>' +
          (data.audioUrl ? '<audio id="nodeAudio" src="' + escapeAttr(data.audioUrl) + '" preload="auto" hidden></audio>' : '') +
          (choicePosition === "belowText" ? renderChoices(node, edges, "below") : "") +
        '</div>' +
        (choicePosition === "center" ? renderChoices(node, edges, "center") : "");
      mountResolvedText(node);
      watchZenButtonPosition();

      // Start entrance transitions after the initial styles have been applied.
      setTimeout(() => {
        const mediaEl = stageEl.querySelector('.scene-image, #nodeVideo');
        if (mediaEl) {
          mediaEl.style.opacity = '1';
          mediaEl.style.transform = 'none';
          mediaEl.dataset.baseTransform = 'none';
        }
        
        if (data.presentation && Array.isArray(data.presentation.characters)) {
          const charImgs = stageEl.querySelectorAll('.character-img');
          data.presentation.characters.forEach((char, idx) => {
            const imgEl = charImgs[idx];
            if (imgEl) {
              imgEl.style.opacity = '1';
              const flipScale = char.flipX ? -1 : 1;
              const scale = char.scale || 1;
              const baseTransform = 'translate(-50%, 0) scale(' + scale + ') scaleX(' + flipScale + ')';
              imgEl.style.transform = baseTransform;
              imgEl.dataset.baseTransform = baseTransform;
            }
          });
        }
      }, 50);
      gwAppearance(stageEl.querySelector('.dialogue'),dialogObject.appearance,dialogObject.corners?dialogObject.corners.map(n=>n+'px').join(' '):null);
      gwAppearance(backdropEl,settings.surfaceAppearances?.game);
      const exportedDialogue=stageEl.querySelector('.dialogue');if(exportedDialogue&&dialogObject.zIndex!==undefined)exportedDialogue.style.zIndex=String(dialogObject.zIndex);
      syncPlayerPresentation();
      const nodeAudio = document.getElementById("nodeAudio");
      if (nodeAudio) {
        nodeAudio.addEventListener("play", () => recordAudio(node, data.audioUrl));
        nodeAudio.addEventListener("ended", () => {
          currentAudioEnded = true;
          maybeAdvanceAfterMedia();
        });
        nodeAudio.play().catch(() => {});
      }
      const nodeVideo = document.getElementById("nodeVideo");
      if (nodeVideo) {
        nodeVideo.addEventListener("ended", () => {
          currentVideoEnded = true;
          maybeAdvanceAfterMedia();
        });
        if (settings.autoAdvance) nodeVideo.play().catch(() => {});
      }
      const hideChoicesDuringTypewriter = settings.autoAdvance && settings.interactionMode === "typewriter";
      stageEl.querySelectorAll(".choices").forEach((element) => {
        element.hidden = hideChoicesDuringTypewriter;
      });
      if (!hideChoicesDuringTypewriter) bindChoices();
      applyTypewriter(
        document.getElementById("nodeText"),
        data.text || "",
        data.rawText || data.text || "",
        data.presentation || null,
        settings.interactionMode === "typewriter",
        true
      );
    }

    function escapeHtml(value) {
      return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
    }
    function escapeAttr(value) { return escapeHtml(value); }

    backButton.addEventListener("click", () => {
      restartPlaybackSession();
      let previous = history.pop();
      while (previous) {
        const previousNode = nodeById.get(previous);
        if (
          previousNode &&
          (previousNode.type === "numberConditionNode" || (previousNode.data && previousNode.data.skip === true))
        ) {
          previous = history.pop();
          continue;
        }
        break;
      }
      if (previous) {
        currentId = previous;
        render();
      } else {
        currentId = root ? root.id : null;
        render();
      }
      writeSave();
    });
    resetButton.addEventListener("click", () => {
      restartPlaybackSession();
      history = [];
      currentId = root ? root.id : null;
      autoAdvanceHoldId = currentId;
      render();
      writeSave();
    });
    mainMenuButton.addEventListener("click", returnToMainMenu);
    autoButton.addEventListener("click", () => {
      changePlayerSettings({ autoAdvance: !settings.autoAdvance });
      render();
    });
    continueGameButton.addEventListener("click", continueSavedGame);
    flowOverviewButton.addEventListener("click", openFlowOverview);
    saveSlotButton.addEventListener("click", openSaveList);
    newGameButton.addEventListener("click", startNewGame);
    settingsButton.addEventListener("click", openSettingsPanel);
    saveClose.addEventListener("click", () => saveBackdrop.classList.remove("open"));
    flowOverviewClose.addEventListener("click", closeFlowOverview);
    flowOverviewBackdrop.addEventListener("click", (event) => {
      if (event.target === flowOverviewBackdrop) closeFlowOverview();
    });
    saveBackdrop.addEventListener("click", (event) => {
      if (event.target === saveBackdrop) saveBackdrop.classList.remove("open");
    });
    const mountSettingsWidget = (${mountPlayerSettings.toString()});
    settingsBackdrop.addEventListener("click", (event) => {
      if (event.target === settingsBackdrop || event.target === playerSettingsRoot) closeSettingsPanel();
    });
    settingsBackdrop.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { event.preventDefault(); closeSettingsPanel(); return; }
      if (event.key !== "Tab") return;
      const items = Array.from(settingsBackdrop.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]')).filter((item) => item.getClientRects().length);
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
    playlistButton.addEventListener("click", () => {
      const open = !playlistBackdrop.classList.contains("open");
      if (open) pauseStoryForPopup();
      playlistBackdrop.classList.toggle("open", open);
      playlistButton.setAttribute("aria-expanded", String(open));
      if (!open) { playlistAudio.pause(); resumeStoryAfterPopup(); }
      updatePlaybackToolbar();
    });
    playlistClose.addEventListener("click", () => playlistButton.click());
    playlistBackdrop.addEventListener("click", (event) => {
      if (event.target !== playlistBackdrop) return;
      playlistButton.click();
    });
    playlistAudio.addEventListener("play", renderPlaylist);
    document.addEventListener("fullscreenchange", updatePlaybackToolbar);
    playlistAudio.addEventListener("pause", renderPlaylist);
    playlistAudio.addEventListener("ended", renderPlaylist);
    window.addEventListener("resize", updateZenButtonPosition);
    if (window.visualViewport) window.visualViewport.addEventListener("resize", updateZenButtonPosition);
    zenButton.addEventListener("click", () => {
      controlsHidden = !controlsHidden;
      document.querySelector(".app").classList.toggle("controls-hidden", controlsHidden);
      zenButton.innerHTML = '<img src="./icons/' + (controlsHidden ? 'eye-off.svg' : 'eye.svg') + '" alt="" />';
      updateSettingsPanel();
      persistPlayerPreferences();
      writeSave();
    });
    window.addEventListener("pagehide", writeSave);
    document.querySelector(".app")?.addEventListener("click", (event) => {
      if ((settings.autoAdvance && autoAdvanceHoldId !== currentId) || !currentId || currentId === "THE_END") return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          "header, button, a, video, audio, input, select, textarea, .playlist-backdrop"
        )
      ) {
        return;
      }
      continueFromText();
    });
    customFontsReady.finally(() => {
      updateSettingsPanel();
      updateAutoButton();
      if (settings.showStartMenu) {
        showStartMenu();
      } else {
        renderPlaylist();
        render();
      }
    });
  </script>
</body>
</html>`;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[char] || char;
  });
}
