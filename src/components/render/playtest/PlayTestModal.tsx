import {
  Eye,
  EyeOff,
  FastForward,
  ListMusic,
  Maximize2,
  Minimize2,
  Monitor,
  MoreHorizontal,
  PictureInPicture2,
  PlayCircle,
  RotateCcw,
  RotateCw,
  Settings,
  X,
} from 'lucide-react';
import React from 'react';

import { AudioPlaylistModal } from '../../AudioPlaylistModal';
import { VirtualPresentationStage } from '../../VirtualPresentationStage';
import { getSceneBackgroundStyle, getSceneGroupStyle } from '../canvas/sceneCanvasStyle';
import { getPlaytestText } from './i18n';
import { getPlaytestWindowText } from './i18n/playtest-window';
import {
  applyPlaytestRuntimeSettingsPatch,
  createPlaytestRuntimeSettings,
  type PlaytestRuntimeSettings,
} from './model/playtestCanvasModel';
import { PlaytestFloatingWindow, PlaytestWindowActions } from './PlaytestFloatingWindow';
import { PlaytestSettingsWorkbench } from './PlaytestSettingsWorkbench';
import type { PlayTestProps } from './types';
import { usePlaytestRuntime } from './usePlaytestRuntime';

export function PlayTestModal(props: PlayTestProps) {
  const [windowContentWidth, setWindowContentWidth] = React.useState<number | null>(null);
  const {
    onClose,
    language,
    isDarkMode,
    choicesColumns,
    setChoicesColumns,
    videoAutoPlay,
    layoutMode,
    interactionMode,
    setInteractionMode,
    typewriterSpeed,
    setTypewriterSpeed,
    choiceDelay,
    setChoiceDelay,
    choicesPosition,
    blurBackground,
    setBlurBackground,
    blurText,
    setBlurText,
    skipSingleChoicePopup,
    autoAdvance,
    setAutoAdvance,
    autoAdvanceDelay,
    setAutoAdvanceDelay,
    canvasSettings,
    onCanvasSettingsChange,
    renderStyle,
    updateRenderStyle,
    isMobile,
    t,
    videoRef,
    audioRef,
    playlistAudioRef,
    choicesRef,
    containerRef,
    immersiveDialogueRef,
    mobileImmersiveLayout,
    applyMobileLandscapeTransform,
    dismissRotateHint,
    showRotateHint,
    mobileClassicLayout,
    currentNode,
    currentTitle,
    sceneVideoUrl,
    sceneImageUrl,
    sceneVideoStartTime,
    dialogueBackgroundStyle,
    dialogueCornerRadius,
    renderObjectSelectionClass,
    selectRenderObject,
    recordCurrentAudio,
    togglePlaylistAudio,
    outEdges,
    waitsForBranchVideo,
    choicesReady,
    stopVideoLimitTimer,
    startVideoLimitTimer,
    handleSceneVideoTimeUpdate,
    handleTextContainerClick,
    renderChoices,
    toggleFullscreen,
    handleBack,
    handleRestartClick,
    showNodeAsCurrentPage,
    sceneStyle,
    renderPresentedCharacters,
    currentNodeId,
    history,
    showSettings,
    setShowSettings,
    showAudioPlaylist,
    setShowAudioPlaylist,
    playedAudios,
    playlistAudioUrl,
    isPlaylistAudioPlaying,
    setIsPlaylistAudioPlaying,
    setCurrentAudioEnded,
    setCurrentVideoEnded,
    isFullscreen,
    isFocusMode,
    setIsFocusMode,
    backExitHintVisible,
    displayedHtml,
    animationCompleted,
    timeLeft,
    emptyState,
    titleStyle,
    bodyStyle,
    dialogueShellStyle,
    dialogueFrameStyle,
    focusButtonStyle,
    classicMediaContainerStyle,
    classicMediaFrameStyle,
  } = usePlaytestRuntime(props, { windowContentWidth });
  const isWindowed = props.displayMode === 'windowed';
  const mobileWindowed = Boolean(isMobile && isWindowed);
  const { followSelectedCard, autoScaleOnHover } = props.windowSettings;
  const [showMobileWindowMenu, setShowMobileWindowMenu] = React.useState(false);

  React.useEffect(() => {
    if (!isWindowed || !followSelectedCard || !props.selectedNodeId) return;
    showNodeAsCurrentPage(props.selectedNodeId);
  }, [followSelectedCard, isWindowed, props.selectedNodeId, showNodeAsCurrentPage]);

  React.useEffect(() => {
    if (!isWindowed) return;
    setShowSettings(false);
    if (document.fullscreenElement === containerRef.current) {
      document.exitFullscreen().catch(() => undefined);
    }
  }, [containerRef, isWindowed, setShowSettings]);

  React.useEffect(() => {
    if (!mobileWindowed) setShowMobileWindowMenu(false);
  }, [mobileWindowed]);

  React.useEffect(() => {
    if (!isWindowed) setWindowContentWidth(null);
  }, [isWindowed]);

  const playtestText = getPlaytestText(language);
  const playtestWindowText = getPlaytestWindowText(language);
  const playtestRootClassName = `${isWindowed ? 'absolute inset-0 rounded-[18px]' : 'fixed inset-0'} ${
    isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-800'
  } z-[100] overflow-hidden transition-colors duration-300 ${
    applyMobileLandscapeTransform ? 'playtest-mobile-landscape' : ''
  }`;
  const wrapWindowedContent = (content: React.ReactNode) =>
    isWindowed ? (
      <PlaytestFloatingWindow
        language={language}
        aspectRatio={canvasSettings.canvasWidth / canvasSettings.canvasHeight}
        initialBounds={
          mobileWindowed ? props.windowSettings.mobileBounds : props.windowSettings.bounds
        }
        autoScaleOnHover={autoScaleOnHover}
        isMobile={mobileWindowed}
        layer={props.windowLayer}
        onBoundsChange={(bounds) =>
          props.setWindowSettings((current) =>
            mobileWindowed ? { ...current, mobileBounds: bounds } : { ...current, bounds },
          )
        }
        onDisplayBoundsChange={(bounds) => setWindowContentWidth(bounds.width)}
      >
        {content}
      </PlaytestFloatingWindow>
    ) : (
      content
    );

  if (emptyState) {
    return wrapWindowedContent(
      <div ref={containerRef} className={playtestRootClassName}>
        {emptyState}
      </div>,
    );
  }
  if (!currentNode && currentNodeId !== 'THE_END') return null;
  if (currentNode?.type === 'numberConditionNode') return null;
  const renderPlaytestSettingsPanel = () => {
    const runtimeSettings = createPlaytestRuntimeSettings({
      choicesColumns,
      interactionMode,
      typewriterSpeed,
      choiceDelay,
      blurBackground,
      blurText,
      autoAdvanceDelay,
    });
    const updateRuntimeSettings = (patch: Partial<PlaytestRuntimeSettings>) => {
      applyPlaytestRuntimeSettingsPatch(patch, {
        setChoicesColumns,
        setInteractionMode,
        setTypewriterSpeed,
        setChoiceDelay,
        setBlurBackground,
        setBlurText,
        setAutoAdvanceDelay,
      });
    };
    return (
      <PlaytestSettingsWorkbench
        language={language}
        canvasSettings={canvasSettings}
        onCanvasSettingsChange={onCanvasSettingsChange}
        runtimeSettings={runtimeSettings}
        onRuntimeSettingsChange={updateRuntimeSettings}
        renderStyle={renderStyle}
        updateRenderStyle={updateRenderStyle}
        layout="sidebar"
      />
    );
  };

  const classicFocusHidden =
    isFocusMode && mobileClassicLayout ? 'invisible pointer-events-none' : '';
  const hideEntireHeaderInFocusMode = isFocusMode && !mobileClassicLayout && !mobileWindowed;
  const useInlineFocusButton = isMobile && !isWindowed && layoutMode === 'immersive';
  const reserveClassicMediaSlot = layoutMode === 'classic';
  const hasSceneMedia = Boolean(sceneImageUrl || sceneVideoUrl);
  const playtestHeaderToneClass =
    layoutMode === 'immersive'
      ? 'absolute top-0 left-0 right-0 bg-gradient-to-b from-black/75 via-black/40 to-transparent text-white border-b-0'
      : isDarkMode
        ? 'bg-slate-900 border-b border-white/10 text-white'
        : 'bg-white border-b border-slate-200 text-slate-800';
  const playtestRoundIconButtonClass = `inline-flex shrink-0 items-center justify-center rounded-full p-0 leading-none [&>svg]:block [&>svg]:shrink-0 ${
    mobileWindowed ? 'h-7 w-7' : 'h-8 w-8 md:h-9 md:w-9'
  }`;

  const renderPlaytestTitle = () => (
    <div className="playtest-header-title flex min-w-0 items-center gap-2 md:gap-3">
      <PlayCircle
        className={`h-5 w-5 shrink-0 ${
          layoutMode === 'immersive'
            ? 'text-sky-400'
            : isDarkMode
              ? 'text-sky-400'
              : 'text-indigo-600'
        }`}
      />
      <span
        className={`truncate font-bold tracking-wide text-sm md:text-base ${mobileClassicLayout ? 'max-w-none' : 'max-w-[120px] md:max-w-none'} ${layoutMode === 'immersive' ? 'text-white drop-shadow-sm' : isDarkMode ? 'text-white' : 'text-slate-800'}`}
      >
        {t.playTestTitle}
      </span>
    </div>
  );

  const renderPlaytestBackButton = (extraClassName = '') => (
    <button
      onClick={handleBack}
      disabled={history.length === 0}
      className={`playtest-header-back flex shrink-0 items-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-all active:scale-95 md:text-sm ${
        layoutMode === 'immersive'
          ? 'bg-white/15 text-white hover:bg-white/25 disabled:bg-white/5'
          : isDarkMode
            ? 'bg-sky-500/20 text-sky-300 hover:bg-sky-500/30'
            : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
      } ${isWindowed ? 'px-2 [&>span]:hidden' : 'px-3'} disabled:scale-100 disabled:opacity-30 disabled:grayscale ${extraClassName}`}
      title={t.backHistory}
    >
      <RotateCcw className="h-3.5 w-3.5 md:h-4 md:w-4" />
      <span>{t.backHistory}</span>
    </button>
  );

  const renderPlaytestFocusButton = (className: string, style?: React.CSSProperties) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setIsFocusMode(!isFocusMode);
      }}
      className={`${className} inline-flex h-12 w-12 items-center justify-center rounded-full border p-0 leading-none shadow-xl backdrop-blur-lg transition-colors duration-200 active:scale-95 [&>svg]:block [&>svg]:shrink-0 ${
        isFocusMode
          ? isDarkMode
            ? 'border-white/10 bg-slate-900/35 text-slate-400 shadow-black/10 hover:bg-slate-900/50 hover:text-slate-300'
            : 'border-black/10 bg-black/35 text-white/55 shadow-black/10 hover:bg-black/45 hover:text-white/75'
          : isDarkMode
            ? 'border-white/10 bg-slate-900/20 text-slate-100 shadow-slate-950/30 hover:bg-slate-900/40 hover:text-white'
            : 'border-black/10 bg-white/20 text-slate-400 shadow-slate-200/30 hover:bg-white/40 hover:text-slate-900'
      }`}
      style={style}
      title={isFocusMode ? t.exitZenMode : t.enterZenMode}
    >
      {isFocusMode ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
    </button>
  );

  const renderPlaytestCloseButton = () => (
    <button
      onClick={onClose}
      className={`${playtestRoundIconButtonClass} transition-colors ${
        layoutMode === 'immersive'
          ? 'bg-white/10 hover:bg-red-500/30 text-white'
          : isDarkMode
            ? 'bg-white/10 hover:bg-red-500/20 text-white'
            : 'bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600'
      }`}
      title={t.close}
    >
      <X className="w-5 h-5" />
    </button>
  );

  const renderPlaytestDisplayModeButton = () => (
    <button
      type="button"
      onClick={() => {
        setShowSettings(false);
        setShowAudioPlaylist(false);
        setShowMobileWindowMenu(false);
        props.onDisplayModeChange(isWindowed ? 'fullscreen' : 'windowed');
      }}
      className={`${playtestRoundIconButtonClass} transition-colors ${
        layoutMode === 'immersive'
          ? 'bg-white/10 text-white hover:bg-white/20'
          : isDarkMode
            ? 'bg-white/10 text-white hover:bg-white/20'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
      title={
        isWindowed ? playtestWindowText.switchToFullscreen : playtestWindowText.switchToWindowed
      }
      aria-label={
        isWindowed ? playtestWindowText.switchToFullscreen : playtestWindowText.switchToWindowed
      }
    >
      {isWindowed ? <Monitor className="h-5 w-5" /> : <PictureInPicture2 className="h-5 w-5" />}
    </button>
  );

  const renderMobileWindowMoreActions = () => {
    const idleClass =
      layoutMode === 'immersive'
        ? 'bg-white/10 text-white'
        : isDarkMode
          ? 'bg-white/10 text-white'
          : 'bg-slate-100 text-slate-600';

    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowMobileWindowMenu((visible) => !visible)}
          className={`${playtestRoundIconButtonClass} transition-colors ${
            showMobileWindowMenu
              ? layoutMode === 'immersive'
                ? 'bg-white/25 text-white'
                : isDarkMode
                  ? 'bg-white/20 text-white'
                  : 'bg-indigo-100 text-indigo-600'
              : idleClass
          }`}
          title={playtestWindowText.moreActions}
          aria-label={playtestWindowText.moreActions}
          aria-expanded={showMobileWindowMenu}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

        {showMobileWindowMenu ? (
          <div
            className={`absolute right-0 top-full z-[360] mt-1 flex gap-1 rounded-xl border p-1 shadow-xl backdrop-blur-xl ${
              layoutMode === 'immersive' || isDarkMode
                ? 'border-white/10 bg-slate-900/95'
                : 'border-slate-200 bg-white/95'
            }`}
          >
            <button
              type="button"
              onClick={() => setAutoAdvance(!autoAdvance)}
              className={`${playtestRoundIconButtonClass} ${
                autoAdvance ? 'bg-sky-500/85 text-white' : idleClass
              }`}
              title={playtestText.autoAdvance}
              aria-label={playtestText.autoAdvance}
              aria-pressed={autoAdvance}
            >
              <FastForward className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAudioPlaylist((visible) => !visible);
                setShowMobileWindowMenu(false);
              }}
              className={`${playtestRoundIconButtonClass} ${
                showAudioPlaylist ? 'bg-indigo-100 text-indigo-600' : idleClass
              }`}
              title={playtestText.audioPlaylist}
              aria-label={playtestText.audioPlaylist}
              aria-pressed={showAudioPlaylist}
            >
              <ListMusic className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setIsFocusMode((active) => !active);
                setShowMobileWindowMenu(false);
              }}
              className={`${playtestRoundIconButtonClass} ${
                isFocusMode ? 'bg-violet-500/85 text-white' : idleClass
              }`}
              title={isFocusMode ? t.exitZenMode : t.enterZenMode}
              aria-label={isFocusMode ? t.exitZenMode : t.enterZenMode}
              aria-pressed={isFocusMode}
            >
              {isFocusMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        ) : null}

        <AudioPlaylistModal
          open={showAudioPlaylist}
          items={playedAudios}
          activeUrl={playlistAudioUrl}
          isPlaying={isPlaylistAudioPlaying}
          title={playtestText.audioPlaylist}
          hint={playtestText.audioPlaylistHint}
          emptyText={playtestText.audioPlaylistEmpty}
          closeLabel={t.close}
          dark={isDarkMode || layoutMode === 'immersive'}
          onClose={() => setShowAudioPlaylist(false)}
          onToggleAudio={togglePlaylistAudio}
        />
      </div>
    );
  };

  const renderPlaytestSecondaryActions = ({ includeClose = true } = {}) => (
    <>
      <button
        onClick={() => setAutoAdvance(!autoAdvance)}
        className={`${playtestRoundIconButtonClass} transition-colors ${
          autoAdvance
            ? layoutMode === 'immersive'
              ? 'bg-sky-500/80 text-white'
              : isDarkMode
                ? 'bg-sky-500/30 text-sky-200'
                : 'bg-indigo-100 text-indigo-600'
            : layoutMode === 'immersive'
              ? 'bg-white/10 text-white hover:bg-white/20'
              : isDarkMode
                ? 'bg-white/10 text-white hover:bg-white/20'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        }`}
        title={playtestText.autoAdvance}
      >
        <FastForward className="w-5 h-5" />
      </button>

      <div className="relative">
        <button
          onClick={() => {
            setShowAudioPlaylist((visible) => !visible);
            setShowSettings(false);
          }}
          className={`${playtestRoundIconButtonClass} transition-colors ${
            showAudioPlaylist
              ? layoutMode === 'immersive'
                ? 'bg-white/25 text-white'
                : isDarkMode
                  ? 'bg-white/20 text-white'
                  : 'bg-indigo-100 text-indigo-600'
              : layoutMode === 'immersive'
                ? 'bg-white/10 text-white hover:bg-white/20'
                : isDarkMode
                  ? 'bg-white/10 text-white hover:bg-white/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
          title={playtestText.audioPlaylist}
        >
          <ListMusic className="w-5 h-5" />
        </button>

        <AudioPlaylistModal
          open={showAudioPlaylist}
          items={playedAudios}
          activeUrl={playlistAudioUrl}
          isPlaying={isPlaylistAudioPlaying}
          title={playtestText.audioPlaylist}
          hint={playtestText.audioPlaylistHint}
          emptyText={playtestText.audioPlaylistEmpty}
          closeLabel={t.close}
          dark={isDarkMode || layoutMode === 'immersive'}
          onClose={() => setShowAudioPlaylist(false)}
          onToggleAudio={togglePlaylistAudio}
        />
      </div>

      {renderPlaytestDisplayModeButton()}

      {isWindowed && (
        <PlaytestWindowActions
          language={language}
          isDarkMode={isDarkMode}
          immersive={layoutMode === 'immersive'}
          buttonClassName={playtestRoundIconButtonClass}
          followSelectedCard={followSelectedCard}
          hasSelectedCard={Boolean(props.selectedNodeId)}
          autoScaleOnHover={autoScaleOnHover}
          showAutoScale={!isMobile}
          onFollowSelectedCardChange={(active) =>
            props.setWindowSettings((current) => ({
              ...current,
              followSelectedCard: active,
            }))
          }
          onAutoScaleOnHoverChange={(active) =>
            props.setWindowSettings((current) => ({
              ...current,
              autoScaleOnHover: active,
            }))
          }
        />
      )}

      {!isMobile && !isWindowed && (
        <button
          onClick={toggleFullscreen}
          className={`${playtestRoundIconButtonClass} transition-colors ${
            layoutMode === 'immersive'
              ? 'bg-white/10 hover:bg-white/20 text-white'
              : isDarkMode
                ? 'bg-white/10 hover:bg-white/20 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
          }`}
          title={isFullscreen ? t.exitFullscreen : t.enterFullscreen}
        >
          {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </button>
      )}

      {!isWindowed && (
        <div className="relative">
          <button
            onClick={() => {
              setShowSettings(!showSettings);
              setShowAudioPlaylist(false);
            }}
            className={`${playtestRoundIconButtonClass} transition-colors ${
              showSettings
                ? layoutMode === 'immersive'
                  ? 'bg-white/25 text-white'
                  : isDarkMode
                    ? 'bg-white/20'
                    : 'bg-slate-200'
                : layoutMode === 'immersive'
                  ? 'bg-white/10 text-white hover:bg-white/20'
                  : isDarkMode
                    ? 'bg-white/10 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-sky-500/10 hover:text-sky-400'
            }`}
            title={t.layoutSettings}
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      )}

      <div
        className={`hidden h-4 w-px md:block ${layoutMode === 'immersive' ? 'bg-white/20' : isDarkMode ? 'bg-white/10' : 'bg-slate-200'}`}
      />

      {includeClose ? renderPlaytestCloseButton() : null}
    </>
  );

  const playtestContent = (
    <div
      ref={containerRef}
      onClick={() => {
        if (showSettings) {
          setShowSettings(false);
          return;
        }
        handleTextContainerClick();
      }}
      className={playtestRootClassName}
    >
      <div
        onClick={(event) => {
          event.stopPropagation();
          handleTextContainerClick();
        }}
        className={`playtest-modal-root ${isWindowed ? 'playtest-modal-root--windowed' : ''} ${
          mobileWindowed ? 'playtest-modal-root--windowed-mobile' : ''
        } ${mobileImmersiveLayout ? 'playtest-modal-root--mobile-immersive' : ''} absolute inset-0 flex origin-left transform-gpu flex-col overflow-hidden border transition-transform duration-200 ease-out ${
          showSettings && !isMobile && !isWindowed ? 'scale-[0.77]' : 'scale-100'
        } ${
          showSettings
            ? isDarkMode
              ? 'border-white/15 shadow-black/40'
              : 'border-slate-200 shadow-slate-300/40'
            : 'border-transparent'
        }`}
      >
        {/* Header */}
        <div
          onClick={(e) => e.stopPropagation()}
          data-playtest-window-drag-handle={isWindowed ? 'true' : undefined}
          className={`playtest-header shrink-0 z-50 px-4 transition-all duration-300 md:px-6 ${
            hideEntireHeaderInFocusMode ? 'hidden' : ''
          } ${
            mobileWindowed
              ? 'playtest-header--windowed-mobile flex items-center justify-between'
              : mobileClassicLayout || mobileImmersiveLayout
                ? 'playtest-header--fullscreen-mobile flex min-h-14 items-center justify-between gap-2'
                : 'playtest-header--compact-row flex min-h-14 items-center justify-between'
          } ${isWindowed ? 'cursor-move touch-none select-none' : ''} ${playtestHeaderToneClass}`}
        >
          {mobileWindowed ? (
            <div className="playtest-header-actions flex w-full min-w-0 items-center justify-end gap-1">
              {renderPlaytestBackButton()}
              <PlaytestWindowActions
                language={language}
                isDarkMode={isDarkMode}
                immersive={layoutMode === 'immersive'}
                buttonClassName={playtestRoundIconButtonClass}
                followSelectedCard={followSelectedCard}
                hasSelectedCard={Boolean(props.selectedNodeId)}
                autoScaleOnHover={autoScaleOnHover}
                showAutoScale={false}
                onFollowSelectedCardChange={(active) =>
                  props.setWindowSettings((current) => ({
                    ...current,
                    followSelectedCard: active,
                  }))
                }
                onAutoScaleOnHoverChange={() => undefined}
              />
              {renderPlaytestDisplayModeButton()}
              {renderMobileWindowMoreActions()}
              {renderPlaytestCloseButton()}
            </div>
          ) : mobileClassicLayout || mobileImmersiveLayout ? (
            <>
              {renderPlaytestTitle()}
              <div
                className={`playtest-header-actions flex shrink-0 items-center gap-2 ${mobileClassicLayout ? classicFocusHidden : ''}`}
              >
                {renderPlaytestBackButton()}
                {renderPlaytestSecondaryActions()}
              </div>
            </>
          ) : (
            <>
              {renderPlaytestTitle()}
              <div
                className={`playtest-header-actions flex shrink-0 items-center ${
                  isWindowed ? 'gap-2' : 'gap-2 md:gap-4'
                }`}
              >
                {renderPlaytestBackButton()}
                {renderPlaytestSecondaryActions()}
              </div>
            </>
          )}
        </div>

        {backExitHintVisible && (
          <div
            className={`pointer-events-none inset-x-0 bottom-6 z-[320] flex justify-center px-4 ${
              isWindowed ? 'absolute' : 'fixed'
            }`}
          >
            <div className="rounded-full bg-slate-950/88 px-4 py-2 text-xs font-bold text-white shadow-xl backdrop-blur-md">
              {playtestText.backExitHint}
            </div>
          </div>
        )}

        {playlistAudioUrl && (
          <audio
            ref={playlistAudioRef}
            src={playlistAudioUrl}
            preload="auto"
            onPlay={() => setIsPlaylistAudioPlaying(true)}
            onPause={() => setIsPlaylistAudioPlaying(false)}
            onEnded={() => setIsPlaylistAudioPlaying(false)}
            className="hidden"
          />
        )}

        {/* Novel Container */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          <div
            className={`w-full h-full flex flex-col ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}
          >
            {currentNodeId === 'THE_END' ? (
              layoutMode === 'immersive' ? (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center animate-in fade-in duration-500 relative w-full h-full">
                  {/* 全景背景渐变 */}
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-900 z-0" />

                  <div className="relative z-10 flex flex-col items-center max-w-md p-8 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 shadow-2xl">
                    <div className="w-20 h-20 mb-6 rounded-full flex items-center justify-center bg-white/10 border border-white/20 text-sky-400 animate-pulse">
                      <PlayCircle className="w-10 h-10" />
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">
                      {t.storyEnd}
                    </h2>
                    <p className="text-slate-300 mb-8 max-w-sm">{t.branchEnded}</p>
                    <button
                      onClick={handleRestartClick}
                      className="px-10 py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl shadow-lg shadow-sky-500/20 transition-all active:scale-95 hover:scale-[1.03]"
                    >
                      {t.restart}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center animate-in fade-in duration-500">
                  <div
                    className={`w-20 h-20 mb-6 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-sky-500/20 text-sky-400' : 'bg-indigo-100 text-indigo-600'}`}
                  >
                    <PlayCircle className="w-10 h-10" />
                  </div>
                  <h2
                    className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'} mb-4 tracking-tight`}
                  >
                    {t.storyEnd}
                  </h2>
                  <p
                    className={`${isDarkMode ? 'text-slate-400' : 'text-slate-500'} mb-8 max-w-sm`}
                  >
                    {t.branchEnded}
                  </p>
                  <button
                    onClick={handleRestartClick}
                    className={`px-10 py-3 ${isDarkMode ? 'bg-sky-600 hover:bg-sky-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white font-bold rounded-xl shadow-lg transition-all active:scale-95`}
                  >
                    {t.restart}
                  </button>
                </div>
              )
            ) : layoutMode === 'immersive' ? (
              <div className="flex-1 flex flex-col min-h-0 relative w-full h-full">
                <div className="absolute inset-0 z-0 overflow-hidden">
                  <div className="absolute inset-0 overflow-hidden w-full h-full select-none pointer-events-none">
                    {sceneImageUrl ? (
                      <img
                        src={sceneImageUrl}
                        draggable={false}
                        onDragStart={(event) => event.preventDefault()}
                        className="preview-media-safe w-full h-full"
                        style={sceneStyle}
                        alt="Scene Background"
                      />
                    ) : sceneVideoUrl ? (
                      <video
                        key={currentNodeId}
                        ref={videoRef}
                        src={sceneVideoUrl}
                        playsInline
                        muted
                        loop={false}
                        autoPlay={videoAutoPlay || waitsForBranchVideo}
                        onLoadedMetadata={(event) => {
                          event.currentTarget.currentTime = Math.min(
                            sceneVideoStartTime,
                            Math.max(0, event.currentTarget.duration || 0),
                          );
                        }}
                        onPlay={startVideoLimitTimer}
                        onPause={stopVideoLimitTimer}
                        onTimeUpdate={handleSceneVideoTimeUpdate}
                        onEnded={() => {
                          stopVideoLimitTimer();
                          setCurrentVideoEnded(true);
                        }}
                        className="w-full h-full"
                        style={sceneStyle}
                      />
                    ) : (
                      <div
                        className={`w-full h-full ${isDarkMode ? 'bg-gradient-to-br from-slate-900 via-sky-950/40 to-slate-950' : 'bg-gradient-to-br from-indigo-50 via-slate-100 to-indigo-100'}`}
                      />
                    )}
                  </div>
                  {renderPresentedCharacters()}
                </div>

                {/* 2. 悬浮的选项与对话框 */}
                <div
                  className={`absolute inset-0 pointer-events-none ${
                    choicesPosition === 'center' && choicesReady && blurBackground
                      ? blurText
                        ? 'z-20'
                        : 'z-40'
                      : 'z-20'
                  }`}
                >
                  <div
                    className="pointer-events-auto absolute flex flex-col items-stretch justify-end gap-4"
                    style={dialogueFrameStyle}
                  >
                    {/* 选项区域 - 文字上方 */}
                    {choicesPosition === 'aboveText' && renderChoices(true)}

                    {useInlineFocusButton &&
                      renderPlaytestFocusButton(
                        'playtest-focus-button-inline pointer-events-auto relative z-[30] mb-1 self-end',
                      )}

                    {/* 透明半透明对话框 */}
                    <div
                      ref={immersiveDialogueRef}
                      onClick={(event) => {
                        if (showSettings) {
                          selectRenderObject(event, 'dialogBox');
                          return;
                        }
                        handleTextContainerClick();
                      }}
                      className={`pointer-events-auto relative w-full overflow-visible rounded-2xl border border-white/10 py-4 text-white shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-6 duration-500 ${renderObjectSelectionClass('dialogBox')}`}
                      style={dialogueShellStyle}
                    >
                      {currentNode?.data.audioUrl && (
                        <audio
                          key={currentNodeId}
                          ref={audioRef}
                          src={currentNode.data.audioUrl as string}
                          preload="auto"
                          onPlay={recordCurrentAudio}
                          onEnded={() => setCurrentAudioEnded(true)}
                          className="hidden"
                        />
                      )}

                      {renderStyle.titleVisible && currentTitle && (
                        <div
                          className={`mb-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] ${renderObjectSelectionClass('title')}`}
                          style={titleStyle}
                          onClick={(event) => selectRenderObject(event, 'title')}
                        >
                          {currentTitle}
                        </div>
                      )}

                      <div
                        className={`whitespace-pre-wrap break-words drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] ${renderObjectSelectionClass('body')}`}
                        style={bodyStyle}
                        onClick={(event) => selectRenderObject(event, 'body')}
                      >
                        <div dangerouslySetInnerHTML={{ __html: displayedHtml || '' }} />
                      </div>

                      {false && !animationCompleted && (
                        <div className="absolute right-4 bottom-2 text-[10px] text-white/50 animate-pulse select-none">
                          {interactionMode === 'typewriter' && playtestText.clickSkipTyping}
                          {interactionMode === 'timed' && playtestText.choicesIn(timeLeft)}
                          {interactionMode === 'clickToShow' && playtestText.clickShowChoices}
                        </div>
                      )}

                      {!animationCompleted && interactionMode === 'timed' && (
                        <div
                          className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-sky-400 to-indigo-500 transition-all duration-100"
                          style={{ width: `${(timeLeft / choiceDelay) * 100}%` }}
                        />
                      )}
                    </div>

                    {/* 选项区域 - 文字下方 */}
                    {choicesPosition === 'belowText' && renderChoices(true)}
                  </div>
                </div>

                {/* 选项区域 - 画面中间 */}
                {choicesPosition === 'center' &&
                  choicesReady &&
                  !(skipSingleChoicePopup && outEdges.length <= 1) && (
                    <div
                      className={`absolute inset-0 z-30 flex items-center justify-center p-6 bg-black/45 pointer-events-none animate-in fade-in duration-300 ${blurBackground ? 'backdrop-blur-[6px]' : 'backdrop-blur-none'}`}
                    >
                      <div className="w-full max-w-md max-h-[85vh] overflow-y-auto overflow-x-hidden pointer-events-auto">
                        {renderChoices(true)}
                      </div>
                    </div>
                  )}
              </div>
            ) : (
              // 经典排版
              <div
                className={`flex-1 flex flex-col min-h-0 relative ${
                  reserveClassicMediaSlot
                    ? `${mobileWindowed ? 'm-0.5 rounded-lg' : 'm-2 rounded-xl md:m-5'} overflow-hidden border shadow-2xl ${
                        isDarkMode
                          ? 'border-white/12 bg-slate-950/75 shadow-black/30'
                          : 'border-slate-200 bg-white/85 shadow-slate-900/10'
                      }`
                    : ''
                }`}
              >
                {/* 1. Media Area */}
                {reserveClassicMediaSlot && (
                  <div
                    className={`${
                      mobileWindowed
                        ? 'flex-1 min-h-0 p-0'
                        : mobileClassicLayout
                          ? 'playtest-classic-mobile-media w-full shrink-0 aspect-video p-0'
                          : 'flex-1 min-h-0 p-2 md:p-4'
                    } flex items-center justify-center relative group overflow-hidden ${showSettings && !renderStyle.selectedRenderObject ? 'ring-2 ring-inset ring-indigo-500' : ''} ${isDarkMode ? 'bg-slate-950' : 'bg-slate-100'}`}
                    style={{
                      ...classicMediaContainerStyle,
                      ...(hasSceneMedia
                        ? getSceneBackgroundStyle(canvasSettings)
                        : {
                            backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                            backgroundImage: 'none',
                          }),
                    }}
                    onClick={() => {
                      if (showSettings) updateRenderStyle('selectedRenderObject', undefined);
                    }}
                  >
                    {/* Ambient Background Layer */}
                    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none transition-all duration-1000">
                      {sceneImageUrl ? (
                        <img
                          src={sceneImageUrl}
                          draggable={false}
                          onDragStart={(event) => event.preventDefault()}
                          className="preview-media-safe w-full h-full object-cover blur-[60px] opacity-20 scale-125"
                          alt=""
                        />
                      ) : (
                        <div
                          className={`w-full h-full ${isDarkMode ? 'bg-gradient-radial from-sky-500/10' : 'bg-gradient-radial from-indigo-500/5'} to-transparent`}
                        />
                      )}
                    </div>

                    {/* Shared 1920x1080 presentation stage */}
                    <div
                      className={`relative z-10 overflow-hidden border ${
                        mobileClassicLayout || mobileWindowed
                          ? 'h-full w-full'
                          : 'max-h-full max-w-full'
                      } ${
                        isDarkMode
                          ? 'border-white/20 bg-slate-900'
                          : 'border-slate-300 bg-white shadow-sm'
                      } animate-in zoom-in-95 duration-500`}
                      style={classicMediaFrameStyle}
                    >
                      <VirtualPresentationStage
                        fit={mobileClassicLayout || mobileWindowed ? 'width' : 'cover'}
                        className="h-full w-full"
                        width={canvasSettings.canvasWidth}
                        height={canvasSettings.canvasHeight}
                      >
                        <div className="absolute inset-0 overflow-hidden">
                          <div
                            className="absolute inset-0"
                            style={getSceneGroupStyle(canvasSettings)}
                          >
                            {sceneImageUrl && (
                              <img
                                src={sceneImageUrl}
                                alt="Scene"
                                draggable={false}
                                onDragStart={(event) => event.preventDefault()}
                                className="preview-media-safe h-full w-full"
                                style={{
                                  ...sceneStyle,
                                }}
                              />
                            )}
                            {sceneVideoUrl && (
                              <video
                                key={currentNodeId}
                                ref={videoRef}
                                src={sceneVideoUrl}
                                controls
                                playsInline
                                draggable={false}
                                onDragStart={(e) => e.preventDefault()}
                                autoPlay={videoAutoPlay || waitsForBranchVideo}
                                onLoadedMetadata={(event) => {
                                  event.currentTarget.currentTime = Math.min(
                                    sceneVideoStartTime,
                                    Math.max(0, event.currentTarget.duration || 0),
                                  );
                                }}
                                onPlay={startVideoLimitTimer}
                                onPause={stopVideoLimitTimer}
                                onTimeUpdate={handleSceneVideoTimeUpdate}
                                onEnded={() => {
                                  stopVideoLimitTimer();
                                  setCurrentVideoEnded(true);
                                }}
                                className="h-full w-full"
                                style={sceneStyle}
                              />
                            )}
                            {renderPresentedCharacters()}
                          </div>
                        </div>
                      </VirtualPresentationStage>
                    </div>

                    {/* 选项区域 - 画面的中间（非全屏且有媒体时挂载在画面内） */}
                    {choicesPosition === 'center' &&
                      !isFullscreen &&
                      choicesReady &&
                      !(skipSingleChoicePopup && outEdges.length <= 1) && (
                        <div
                          className={`absolute inset-0 z-30 flex items-center justify-center ${mobileWindowed ? 'p-1' : 'p-4'} bg-black/45 pointer-events-none animate-in fade-in duration-300 ${blurBackground ? 'backdrop-blur-[6px]' : 'backdrop-blur-none'}`}
                        >
                          <div
                            className={`w-full max-w-sm max-h-[85vh] overflow-y-auto overflow-x-hidden pointer-events-auto ${mobileWindowed ? 'rounded-lg p-1' : 'rounded-2xl p-4'} bg-slate-900/95 border border-white/10 shadow-2xl`}
                          >
                            {renderChoices(false)}
                          </div>
                        </div>
                      )}
                  </div>
                )}

                {/* 选项区域 - 文字上方 */}
                {choicesPosition === 'aboveText' && choicesReady && (
                  <div
                    ref={choicesRef}
                    className={`${mobileWindowed ? 'p-1' : isWindowed ? 'p-3' : 'p-4 md:p-6 lg:px-48 xl:px-64'} ${isDarkMode ? 'bg-slate-900 border-white/10' : 'bg-slate-100 border-slate-200'} border-b shrink-0 z-40 shadow-sm`}
                  >
                    {renderChoices(false)}
                  </div>
                )}

                {/* 2. Text Area */}
                <div
                  onClick={(event) => {
                    if (showSettings) {
                      selectRenderObject(event, 'dialogBox');
                      return;
                    }
                    handleTextContainerClick();
                  }}
                  className={`${
                    !reserveClassicMediaSlot
                      ? 'flex-1'
                      : mobileWindowed
                        ? 'h-12 shrink-0'
                        : mobileClassicLayout
                          ? 'playtest-classic-mobile-text flex-1 min-h-[42vh] shrink-0'
                          : 'h-32 md:h-48 shrink-0'
                  } ${showSettings ? 'overflow-visible' : 'overflow-y-auto'} ${
                    mobileWindowed ? 'py-1' : isWindowed ? 'py-3' : 'py-4 md:py-8'
                  } ${
                    mobileWindowed
                      ? 'px-2'
                      : mobileClassicLayout
                        ? 'px-4'
                        : isWindowed
                          ? 'px-4'
                          : 'px-6 md:px-12 lg:px-48 xl:px-64'
                  } ${isDarkMode ? 'bg-slate-950/90' : 'bg-white/90'} backdrop-blur-xl border-t border-white/5 transition-all duration-300 relative ${
                    choicesPosition === 'center' && choicesReady && blurBackground
                      ? isFullscreen
                        ? blurText
                          ? 'z-20'
                          : 'z-40'
                        : blurText
                          ? 'z-20 blur-[5px] opacity-80'
                          : 'z-20'
                      : 'z-20'
                  } ${renderObjectSelectionClass('dialogBox')}`}
                  style={{
                    ...(renderStyle.dialogVisible
                      ? dialogueBackgroundStyle()
                      : {
                          background: 'transparent',
                          backgroundColor: 'transparent',
                          backgroundImage: 'none',
                          borderColor: 'transparent',
                          boxShadow: 'none',
                          backdropFilter: 'none',
                        }),
                    borderTopLeftRadius: reserveClassicMediaSlot ? 0 : dialogueCornerRadius,
                    borderTopRightRadius: reserveClassicMediaSlot ? 0 : dialogueCornerRadius,
                    paddingLeft: `${Math.max(2, renderStyle.dialogTextPaddingX ?? 9)}%`,
                    paddingRight: `${Math.max(2, renderStyle.dialogTextPaddingX ?? 9)}%`,
                  }}
                >
                  {currentNode?.data.audioUrl && (
                    <audio
                      key={currentNodeId}
                      ref={audioRef}
                      src={currentNode.data.audioUrl as string}
                      preload="auto"
                      onPlay={recordCurrentAudio}
                      onEnded={() => setCurrentAudioEnded(true)}
                      className="hidden"
                    />
                  )}
                  {renderStyle.titleVisible && currentTitle && (
                    <div
                      className={`mb-2 drop-shadow-sm ${renderObjectSelectionClass('title')}`}
                      style={titleStyle}
                      onClick={(event) => selectRenderObject(event, 'title')}
                    >
                      {currentTitle}
                    </div>
                  )}
                  <div
                    className={`whitespace-pre-wrap drop-shadow-sm ${renderObjectSelectionClass('body')}`}
                    style={bodyStyle}
                    onClick={(event) => selectRenderObject(event, 'body')}
                  >
                    <div dangerouslySetInnerHTML={{ __html: displayedHtml || '' }} />
                  </div>

                  {false && !animationCompleted && (
                    <div className="absolute right-4 bottom-2 text-[10px] opacity-40 animate-pulse select-none">
                      {interactionMode === 'typewriter' && playtestText.clickSkipTyping}
                      {interactionMode === 'timed' && playtestText.choicesIn(timeLeft)}
                      {interactionMode === 'clickToShow' && playtestText.clickShowChoices}
                    </div>
                  )}

                  {!animationCompleted && interactionMode === 'timed' && (
                    <div
                      className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-sky-400 to-indigo-500 transition-all duration-100"
                      style={{ width: `${(timeLeft / choiceDelay) * 100}%` }}
                    />
                  )}
                </div>

                {/* 3. Choices Area - 文字下方 */}
                {choicesPosition === 'belowText' && choicesReady && (
                  <div
                    ref={choicesRef}
                    className={`${mobileWindowed ? 'p-1' : isWindowed ? 'p-3' : 'p-4 md:p-6 lg:px-48 xl:px-64'} ${isDarkMode ? 'bg-slate-900 border-white/10' : 'bg-slate-100 border-slate-200'} border-t shrink-0 z-40 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]`}
                  >
                    {renderChoices(false)}
                  </div>
                )}

                {/* 选项区域 - 屏幕的中间（当全屏，或无媒体文件时挂载在整个视口中央） */}
                {choicesPosition === 'center' &&
                  (isFullscreen || !reserveClassicMediaSlot) &&
                  choicesReady &&
                  !(skipSingleChoicePopup && outEdges.length <= 1) && (
                    <div
                      className={`absolute inset-0 z-30 flex items-center justify-center p-6 bg-black/45 pointer-events-none animate-in fade-in duration-300 ${blurBackground ? 'backdrop-blur-[6px]' : 'backdrop-blur-none'}`}
                    >
                      <div className="w-full max-w-md max-h-[85vh] overflow-y-auto overflow-x-hidden pointer-events-auto p-4 bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl">
                        {renderChoices(false)}
                      </div>
                    </div>
                  )}
              </div>
            )}
          </div>
        </div>

        {/* 沉浸式模式切换按钮 */}
        {!mobileWindowed &&
          !useInlineFocusButton &&
          renderPlaytestFocusButton(
            `${isWindowed ? 'absolute' : 'fixed'} z-[260]`,
            focusButtonStyle,
          )}
      </div>

      {!isWindowed && showSettings && (
        <aside
          onClick={(event) => event.stopPropagation()}
          className={`z-[130] shadow-2xl ${
            isMobile
              ? `playtest-settings-mobile fixed inset-0 flex flex-col ${
                  isDarkMode ? 'bg-slate-950 text-white' : 'bg-white text-slate-800'
                }`
              : `absolute bottom-0 right-0 top-0 flex w-[23vw] min-w-[340px] max-w-[480px] flex-col overflow-hidden border-l p-4 ${
                  isDarkMode
                    ? 'border-white/10 bg-slate-950/96 text-white shadow-black/35'
                    : 'border-slate-200 bg-white text-slate-800 shadow-slate-300/35'
                }`
          }`}
        >
          {isMobile && (
            <div
              className={`flex shrink-0 items-center justify-between border-b px-4 py-3 ${
                isDarkMode ? 'border-white/10' : 'border-slate-200'
              }`}
            >
              <span className="text-sm font-bold">{playtestText.settingsTitle}</span>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors active:scale-95 ${
                  isDarkMode
                    ? 'bg-white/10 text-white hover:bg-white/20'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <X className="h-4 w-4" />
                {playtestText.closeSettings}
              </button>
            </div>
          )}
          <div
            className={`video-render-scroll web-workspace-inspector-scroll min-h-0 flex-1 overflow-y-auto ${
              isMobile ? 'p-4' : 'pr-1'
            }`}
          >
            {renderPlaytestSettingsPanel()}
          </div>
        </aside>
      )}

      {showRotateHint && (
        <div
          className="playtest-rotate-hint fixed inset-0 z-[200] flex cursor-pointer items-center justify-center bg-black/75 px-6 backdrop-blur-sm"
          onClick={(event) => {
            event.stopPropagation();
            dismissRotateHint();
          }}
        >
          <div className="pointer-events-none max-w-xs text-center text-white">
            <RotateCw className="mx-auto mb-4 h-12 w-12 animate-pulse text-sky-300" />
            <p className="text-base font-bold leading-relaxed">{playtestText.rotateTitle}</p>
            <p className="mt-2 text-xs leading-relaxed text-white/70">{playtestText.rotateHint}</p>
          </div>
        </div>
      )}
    </div>
  );

  return wrapWindowedContent(playtestContent);
}
