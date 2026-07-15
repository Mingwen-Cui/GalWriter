import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Language } from '../../../lib/i18n';
import { getCharacterStageBounds } from '../../../lib/presentation';
import { VirtualPresentationStage } from '../../VirtualPresentationStage';
import {
  resolvePresentationDialogueLayout,
  resolvePresentationTextScale,
} from '../video/shared/presentationLayout';
import { getRenderObjects, updateRenderObject } from '../video/shared/renderObjects';
import type {
  PptAnimationDirection,
  PptAnimationEffect,
  PptAnimationPhase,
  PptAnimationStart,
  PptAnimationTarget,
  PptExportSettings,
  PptManualElement,
  PptManualSlide,
  PptObjectAnimation,
  PptSlideTransition,
  PptTransitionEffect,
  RenderEditableObject,
  RenderEditableObjectKind,
  RenderStyle,
  WebExportSettings,
} from '../video/shared/types';
import {
  WebEditableElementFrame,
  type WebEditableResizeHandle,
} from '../web/WebEditableElementFrame';
import { getPptCopy, type PptCopy } from './i18n';
import { getPptWorkspaceCopy, type PptWorkspaceCopy } from './i18n/index';
import { targetLabel } from './pptAnimationLabels';
import { findAnimation, previewStyle } from './pptAnimationPreview';
import { PptCopyContext, type PptCopyContextValue } from './pptCopyContext';
import { PptInsertRibbon } from './PptInsertRibbon';
import {
  createManualButton,
  createManualImage,
  createManualSlide,
  createManualText,
  duplicateManualSlide,
  updateManualElement,
} from './pptManualContent';
import { PptManualSlideCanvas } from './PptManualSlideCanvas';
import { pptSceneColors, resolvePptScenes } from './pptSceneResolver';
import { resolvePptTagAnimations } from './pptTagAnimations';
import { AnimationRibbon, SlideList, SlideSorter } from './PptWorkspaceControls';
import { PlayerOverlay, PptFooterBar } from './PptWorkspaceFooter';
import {
  composePptSlides,
  DEFAULT_PPT_TRANSITION,
  insertPptSlideOrder,
  PPT_CONTENT_HEIGHT,
  PPT_CONTENT_WIDTH,
  pptCanvasViewportClass,
  type PptSelection,
  type PptSlideItem,
  type PptWorkspaceSidebarTab,
  type PptWorkspaceViewMode,
} from './pptWorkspaceModel';
import { NotesPanel, PptSidebar } from './PptWorkspaceSidebar';

type ViewMode = PptWorkspaceViewMode;
type SidebarTab = PptWorkspaceSidebarTab;
export type SlideItem = PptSlideItem;
export type Selection = PptSelection;
export type Scene = ReturnType<typeof resolvePptScenes>[number];
type Copy = PptCopyContextValue;
export type VideoTimelineTrack = { durationMs: number; loop: boolean };

export const PHASES: Array<{ value: PptAnimationPhase; key: 'enter' | 'emphasis' | 'exit' }> = [
  { value: 'enter', key: 'enter' },
  { value: 'emphasis', key: 'emphasis' },
  { value: 'exit', key: 'exit' },
];
export const EMPHASIS_EFFECTS: Array<{
  value: PptAnimationEffect;
  key: keyof PptWorkspaceCopy;
  glyph: string;
}> = [
  { value: 'pulse', key: 'pulse', glyph: '✦' },
  { value: 'colorPulse', key: 'colorPulse', glyph: '✺' },
  { value: 'bounce', key: 'bounce', glyph: '↗' },
  { value: 'teeter', key: 'teeter', glyph: '◒' },
  { value: 'growShrink', key: 'growShrink', glyph: '⌁' },
  { value: 'spin', key: 'spin', glyph: '↻' },
  { value: 'blink', key: 'blink', glyph: '✧' },
  { value: 'wave', key: 'wave', glyph: '〰' },
  { value: 'wiggle', key: 'wiggle', glyph: '↔' },
  { value: 'desaturate', key: 'desaturate', glyph: '◐' },
  { value: 'darken', key: 'darken', glyph: '◕' },
  { value: 'lighten', key: 'lighten', glyph: '◌' },
  { value: 'transparency', key: 'transparency', glyph: '◍' },
];
export const effectLabel = (copy: Copy, effect: PptAnimationEffect) => {
  if (effect === 'line') return copy.line;
  if (effect === 'none') return copy.noAnimation;
  const emphasis = EMPHASIS_EFFECTS.find((item) => item.value === effect);
  return emphasis
    ? copy[emphasis.key]
    : (
        {
          appear: copy.appear,
          fade: copy.fade,
          fly: copy.fly,
          float: copy.float,
          wipe: copy.wipe,
          zoom: copy.zoom,
        } as Record<string, string>
      )[effect] || copy.noAnimation;
};
export const startLabel = (copy: PptCopy, start: PptAnimationStart) =>
  copy[
    start === 'onClick' ? 'onClick' : start === 'withPrevious' ? 'withPrevious' : 'afterPrevious'
  ];
export const directionLabel = (copy: PptCopy, direction: PptAnimationDirection) =>
  copy[
    direction === 'left'
      ? 'fromLeft'
      : direction === 'right'
        ? 'fromRight'
        : direction === 'up'
          ? 'fromTop'
          : 'fromBottom'
  ];
const animationKey = (target: PptAnimationTarget, targetId?: string) =>
  `${target}:${targetId || ''}`;
type TimedPptObjectAnimation = PptObjectAnimation & { timelineStartMs: number };
const withTimelineStarts = (animations: PptObjectAnimation[]): TimedPptObjectAnimation[] => {
  let previousStart = 0;
  let previousDuration = 0;
  return animations.map((animation) => {
    const timelineStartMs =
      animation.start === 'withPrevious'
        ? previousStart + animation.delayMs
        : previousStart + previousDuration + animation.delayMs;
    previousStart = timelineStartMs;
    previousDuration = animation.durationMs;
    return { ...animation, timelineStartMs };
  });
};
export const getTimelineDuration = (animations: PptObjectAnimation[], mediaDurationMs = 0) =>
  Math.max(
    1000,
    mediaDurationMs,
    ...withTimelineStarts(animations).map(
      (animation) => animation.timelineStartMs + animation.durationMs,
    ),
  );
const choiceSlideId = (sceneId: string) => `choice:${sceneId}`;
export const DEFAULT_TRANSITION = DEFAULT_PPT_TRANSITION;
export const TRANSITIONS: Array<{ value: PptTransitionEffect; key: keyof PptCopy; glyph: string }> =
  [
    { value: 'none', key: 'none', glyph: '□' },
    { value: 'smooth', key: 'smooth', glyph: '◇' },
    { value: 'fade', key: 'fadeTransition', glyph: '◌' },
    { value: 'push', key: 'push', glyph: '⇢' },
    { value: 'wipe', key: 'wipe', glyph: '▸' },
    { value: 'split', key: 'split', glyph: '⇆' },
    { value: 'reveal', key: 'reveal', glyph: '▣' },
    { value: 'cut', key: 'cut', glyph: '▰' },
    { value: 'randomBars', key: 'randomBars', glyph: '▥' },
  ];

type Props = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  language: Language;
  projectName: string;
  webSettings: WebExportSettings;
  renderStyle: RenderStyle;
  updateRenderStyle: <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => void;
  pptSettings: PptExportSettings;
  updatePptSettings: (patch: Partial<PptExportSettings>) => void;
  ribbonTab: 'insert' | 'animation' | 'transition';
  ribbonCollapsed: boolean;
};

export function PptWorkspace({
  nodes,
  edges,
  language,
  projectName,
  webSettings,
  renderStyle,
  updateRenderStyle,
  pptSettings,
  updatePptSettings,
  ribbonTab,
  ribbonCollapsed,
}: Props) {
  const copy: Copy = { ...getPptCopy(language), ...getPptWorkspaceCopy(language) };
  const scenes = useMemo(
    () => resolvePptScenes(nodes, edges, webSettings),
    [nodes, edges, webSettings],
  );
  const generatedSlides = useMemo<SlideItem[]>(
    () => [
      ...(pptSettings.includeCover
        ? [{ id: 'cover', title: projectName || copy.untitled, kind: 'cover' as const }]
        : []),
      ...scenes.flatMap((scene) => [
        { id: scene.id, title: scene.title, kind: 'scene' as const, sceneId: scene.id },
        ...(pptSettings.branchMode !== 'linear' && scene.choices.length > 1
          ? [
              {
                id: choiceSlideId(scene.id),
                title: `选择：${scene.title}`,
                kind: 'choice' as const,
                sceneId: scene.id,
              },
            ]
          : []),
      ]),
    ],
    [pptSettings.branchMode, pptSettings.includeCover, projectName, scenes],
  );
  const manualSlides = pptSettings.manualSlides || [];
  const slides = useMemo(
    () => composePptSlides(generatedSlides, manualSlides, pptSettings.slideOrder),
    [generatedSlides, manualSlides, pptSettings.slideOrder],
  );
  const [selectedId, setSelectedId] = useState(() => slides[0]?.id || 'cover');
  const [selectedObject, setSelectedObject] = useState<Selection | null>(null);
  const [selectedPhase, setSelectedPhase] = useState<PptAnimationPhase>('enter');
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('timeline');
  const [viewMode, setViewMode] = useState<ViewMode>('normal');
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesHeight, setNotesHeight] = useState(150);
  const [zoom, setZoom] = useState(100);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewRunId, setPreviewRunId] = useState(0);
  const [timelinePlayheadMs, setTimelinePlayheadMs] = useState<number>();
  const [videoDurationByScene, setVideoDurationByScene] = useState<Record<string, number>>({});
  const playerRef = useRef<HTMLDivElement>(null);
  const stageViewportRef = useRef<HTMLElement>(null);
  const previewTimerRef = useRef<number | null>(null);
  const previewFrameRef = useRef<number | null>(null);
  const stageWheelAtRef = useRef(0);
  const selectedIndex = Math.max(
    0,
    slides.findIndex((slide) => slide.id === selectedId),
  );
  const activeSlide = slides.find((slide) => slide.id === selectedId);
  const manualSlide = activeSlide?.manualSlideId
    ? manualSlides.find((slide) => slide.id === activeSlide.manualSlideId)
    : undefined;
  const [selectedManualElementId, setSelectedManualElementId] = useState<string>();
  const scene = activeSlide?.sceneId
    ? scenes.find((item) => item.id === activeSlide.sceneId)
    : undefined;
  const colors = pptSceneColors(renderStyle, webSettings);
  const animations = pptSettings.animations || {};
  const transitions = pptSettings.transitions || {};
  const savedAnimations = animations[selectedId] || [];
  // Story tags are the source of truth for character / scene animation.
  // Keep them visible in the native PPT timeline without serialising a second
  // copy into the workspace settings.
  const tagAnimations = scene ? resolvePptTagAnimations(scene) : [];
  const currentAnimations = useMemo(
    () => withTimelineStarts([...tagAnimations, ...savedAnimations]),
    [savedAnimations, tagAnimations],
  );
  const currentTransition = transitions[selectedId] || DEFAULT_TRANSITION;
  const currentVideoLoop = scene ? (pptSettings.videoLoopByScene?.[scene.id] ?? false) : false;
  const currentVideoTrack: VideoTimelineTrack | undefined = scene?.backgroundVideoUrl
    ? { durationMs: videoDurationByScene[scene.id] || 5000, loop: currentVideoLoop }
    : undefined;
  const updateCurrentVideoDuration = useCallback(
    (durationMs: number) => {
      if (!scene || !Number.isFinite(durationMs) || durationMs <= 0) return;
      const roundedDurationMs = Math.round(durationMs);
      setVideoDurationByScene((previous) =>
        previous[scene.id] === roundedDurationMs
          ? previous
          : { ...previous, [scene.id]: roundedDurationMs },
      );
    },
    [scene],
  );

  useEffect(() => {
    if (!slides.some((slide) => slide.id === selectedId)) setSelectedId(slides[0]?.id || 'cover');
  }, [selectedId, slides]);
  useEffect(
    () => () => {
      if (previewTimerRef.current) window.clearTimeout(previewTimerRef.current);
      if (previewFrameRef.current) window.cancelAnimationFrame(previewFrameRef.current);
    },
    [],
  );

  const selectSlide = useCallback((id: string) => {
    setSelectedId(id);
    setSelectedObject(null);
    setSidebarTab('timeline');
    setIsPreviewing(false);
    setTimelinePlayheadMs(undefined);
    setSelectedManualElementId(undefined);
  }, []);
  const saveManualSlides = (nextSlides: PptManualSlide[], nextOrder?: string[]) =>
    updatePptSettings({
      manualSlides: nextSlides,
      slideOrder: nextOrder || pptSettings.slideOrder,
    });
  const addManualSlide = (slide = createManualSlide(copy.manualSlide), afterId = selectedId) => {
    const nextSlides = [...manualSlides, slide];
    const knownIds = [
      ...generatedSlides.map((item) => item.id),
      ...nextSlides.map((item) => item.id),
    ];
    saveManualSlides(
      nextSlides,
      insertPptSlideOrder(pptSettings.slideOrder, knownIds, afterId, slide.id),
    );
    selectSlide(slide.id);
    return slide;
  };
  const appendManualElement = (element: PptManualElement) => {
    if (manualSlide) {
      saveManualSlides(
        manualSlides.map((slide) =>
          slide.id === manualSlide.id
            ? { ...slide, elements: [...slide.elements, element] }
            : slide,
        ),
      );
      setSelectedManualElementId(element.id);
      return;
    }
    const slide = addManualSlide();
    saveManualSlides(
      [...manualSlides, { ...slide, elements: [element] }],
      insertPptSlideOrder(
        pptSettings.slideOrder,
        [
          ...generatedSlides.map((item) => item.id),
          ...manualSlides.map((item) => item.id),
          slide.id,
        ],
        selectedId,
        slide.id,
      ),
    );
    setSelectedManualElementId(element.id);
  };
  const updateActiveManualElement = (elementId: string, patch: Partial<PptManualElement>) => {
    if (!manualSlide) return;
    saveManualSlides(
      manualSlides.map((slide) =>
        slide.id === manualSlide.id ? updateManualElement(slide, elementId, patch) : slide,
      ),
    );
  };
  const updateActiveManualSlide = (patch: Partial<PptManualSlide>) => {
    if (!manualSlide) return;
    saveManualSlides(
      manualSlides.map((slide) => (slide.id === manualSlide.id ? { ...slide, ...patch } : slide)),
    );
  };
  const deleteActiveManualElement = (elementId: string) => {
    if (!manualSlide) return;
    saveManualSlides(
      manualSlides.map((slide) =>
        slide.id === manualSlide.id
          ? { ...slide, elements: slide.elements.filter((element) => element.id !== elementId) }
          : slide,
      ),
    );
    setSelectedManualElementId(undefined);
  };
  const selectManualElement = (elementId: string) => {
    setSelectedManualElementId(elementId);
    setSidebarTab('style');
  };
  const duplicateCurrentManualSlide = () => {
    const next = manualSlide
      ? duplicateManualSlide(manualSlide, copy.duplicateSlide)
      : createManualSlide(copy.manualSlide);
    addManualSlide(next);
  };
  const selectIndex = useCallback(
    (index: number) =>
      selectSlide(slides[Math.max(0, Math.min(slides.length - 1, index))]?.id || 'cover'),
    [selectSlide, slides],
  );
  const next = useCallback(() => selectIndex(selectedIndex + 1), [selectIndex, selectedIndex]);
  const previous = useCallback(() => selectIndex(selectedIndex - 1), [selectIndex, selectedIndex]);
  const goToScene = useCallback(
    (sceneId: string) => {
      const index = slides.findIndex(
        (slide) => slide.kind === 'scene' && slide.sceneId === sceneId,
      );
      if (index >= 0) selectIndex(index);
    },
    [selectIndex, slides],
  );
  const handleStageWheel = useCallback(
    (event: WheelEvent) => {
      if (!event.deltaY) return;
      event.preventDefault();
      const now = Date.now();
      if (now - stageWheelAtRef.current < 280) return;
      stageWheelAtRef.current = now;
      if (event.deltaY > 0) next();
      else previous();
    },
    [next, previous],
  );
  useEffect(() => {
    const stageViewport = stageViewportRef.current;
    if (!stageViewport) return;
    stageViewport.addEventListener('wheel', handleStageWheel, { passive: false });
    return () => stageViewport.removeEventListener('wheel', handleStageWheel);
  }, [handleStageWheel]);
  const selectObject = (selection: Selection) => {
    setSelectedObject(selection);
    setSidebarTab('style');
    const renderObject = (
      {
        'dialog-panel': 'dialogBox',
        'dialog-title': 'title',
        'dialog-body': 'body',
        nameplate: 'nameplate',
      } as const
    )[selection.target];
    if (renderObject) updateRenderStyle('selectedRenderObject', renderObject);
  };
  const updatePptObject = useCallback(
    (kind: RenderEditableObjectKind, patch: Partial<RenderEditableObject>) => {
      updateRenderStyle('renderObjects', updateRenderObject(renderStyle, kind, patch));
      if ('visible' in patch) {
        if (kind === 'title') updateRenderStyle('titleVisible', Boolean(patch.visible));
        if (kind === 'dialogBox') updateRenderStyle('dialogVisible', Boolean(patch.visible));
        if (kind === 'nameplate') updateRenderStyle('nameplateVisible', Boolean(patch.visible));
      }
    },
    [renderStyle, updateRenderStyle],
  );
  const replaceTimeline = (nextTimeline: PptObjectAnimation[]) => {
    updatePptSettings({
      animations: {
        ...animations,
        [selectedId]: nextTimeline.filter((item) => item.source !== 'tag'),
      },
    });
  };
  const updateTransition = (patch: Partial<PptSlideTransition>) => {
    updatePptSettings({
      transitions: { ...transitions, [selectedId]: { ...currentTransition, ...patch } },
    });
  };
  const applyTransitionToAll = () => {
    updatePptSettings({
      transitions: Object.fromEntries(slides.map((slide) => [slide.id, { ...currentTransition }])),
    });
  };
  const getAnimation = (selection = selectedObject, phase = selectedPhase) =>
    selection
      ? currentAnimations.find(
          (item) =>
            animationKey(item.target, item.targetId) ===
              animationKey(selection.target, selection.targetId) &&
            (item.phase || 'enter') === phase,
        )
      : undefined;
  const updateSelectedAnimation = (patch: Partial<PptObjectAnimation>) => {
    if (!selectedObject) return undefined;
    // A PPT edit is an explicit local override. Never mutate the projected
    // tag entry, otherwise a later tag edit could leave stale copies behind.
    const existing = savedAnimations.find(
      (item) =>
        animationKey(item.target, item.targetId) ===
          animationKey(selectedObject.target, selectedObject.targetId) &&
        (item.phase || 'enter') === selectedPhase,
    );
    const base: PptObjectAnimation = existing || {
      id: `${selectedId}-${animationKey(selectedObject.target, selectedObject.targetId)}-${selectedPhase}`,
      target: selectedObject.target,
      targetId: selectedObject.targetId,
      phase: selectedPhase,
      effect: selectedPhase === 'emphasis' ? 'pulse' : 'line',
      source: 'manual',
      start: currentAnimations.length ? 'afterPrevious' : 'onClick',
      durationMs: 500,
      delayMs: 0,
      direction: 'left',
    };
    const next = { ...base, ...patch };
    const nextTimeline = existing
      ? [
          ...tagAnimations,
          ...savedAnimations.map((item) => (item.id === existing.id ? next : item)),
        ]
      : [...tagAnimations, ...savedAnimations, next];
    replaceTimeline(nextTimeline);
    return nextTimeline;
  };
  const applyEffect = (effect: PptAnimationEffect) => {
    if (!selectedObject) return;
    const existing = getAnimation(undefined, selectedPhase);
    if (effect === 'none') {
      if (existing) replaceTimeline(currentAnimations.filter((item) => item.id !== existing.id));
      return;
    }
    const nextTimeline = updateSelectedAnimation({ effect });
    if (nextTimeline) preview(nextTimeline);
  };
  const moveAnimation = (id: string, direction: -1 | 1) => {
    const index = currentAnimations.findIndex((item) => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= currentAnimations.length) return;
    if (currentAnimations[index].source === 'tag' || currentAnimations[target].source === 'tag')
      return;
    const nextTimeline = [...currentAnimations];
    [nextTimeline[index], nextTimeline[target]] = [nextTimeline[target], nextTimeline[index]];
    replaceTimeline(nextTimeline);
  };
  const preview = (timeline: PptObjectAnimation[] = currentAnimations) => {
    if (previewTimerRef.current) window.clearTimeout(previewTimerRef.current);
    if (previewFrameRef.current) window.cancelAnimationFrame(previewFrameRef.current);
    setIsPreviewing(false);
    setTimelinePlayheadMs(undefined);
    setPreviewRunId((value) => value + 1);
    const duration = getTimelineDuration(timeline, currentVideoTrack?.durationMs);
    const startedAt = performance.now();
    const tick = (now: number) => {
      const elapsed = Math.min(duration, Math.max(0, now - startedAt));
      setTimelinePlayheadMs(elapsed);
      if (elapsed < duration) previewFrameRef.current = window.requestAnimationFrame(tick);
      else setIsPreviewing(false);
    };
    window.requestAnimationFrame(() => {
      setTimelinePlayheadMs(0);
      setIsPreviewing(true);
      previewFrameRef.current = window.requestAnimationFrame(tick);
    });
  };
  const pausePreview = () => {
    if (previewFrameRef.current) window.cancelAnimationFrame(previewFrameRef.current);
    setIsPreviewing(false);
  };
  const seekTimeline = (milliseconds: number) => {
    if (previewFrameRef.current) window.cancelAnimationFrame(previewFrameRef.current);
    setIsPreviewing(false);
    setTimelinePlayheadMs(milliseconds);
  };
  const playFromStart = () => {
    selectIndex(0);
    setIsPlaying(true);
  };
  const closePlayer = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    setIsPlaying(false);
  };

  useEffect(() => {
    if (!isPlaying && viewMode !== 'reading') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        ['ArrowRight', 'ArrowDown', ' ', 'PageDown'].includes(event.key) &&
        (!isPlaying || currentTransition.advanceOnClick)
      ) {
        event.preventDefault();
        next();
      }
      if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key)) {
        event.preventDefault();
        previous();
      }
      if (event.key === 'Home') {
        event.preventDefault();
        selectIndex(0);
      }
      if (event.key === 'End') {
        event.preventDefault();
        selectIndex(slides.length - 1);
      }
      if (event.key === 'Escape' && isPlaying) void closePlayer();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    currentTransition.advanceOnClick,
    isPlaying,
    next,
    previous,
    selectIndex,
    slides.length,
    viewMode,
  ]);
  useEffect(() => {
    if (!isPlaying || currentTransition.advanceAfterMs === undefined) return;
    const timeout = window.setTimeout(next, Math.max(0, currentTransition.advanceAfterMs));
    return () => window.clearTimeout(timeout);
  }, [currentTransition.advanceAfterMs, isPlaying, next, selectedId]);
  useEffect(() => {
    if (!isPlaying || document.fullscreenElement) return;
    playerRef.current?.requestFullscreen().catch(() => {
      /* Fullscreen is optional. */
    });
  }, [isPlaying]);
  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) setIsPlaying(false);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);
  const startNotesResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = notesHeight;
    const onMove = (moveEvent: PointerEvent) =>
      setNotesHeight(Math.min(420, Math.max(92, startHeight + startY - moveEvent.clientY)));
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <PptCopyContext.Provider value={copy}>
      <main className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[var(--vr-bg)] pb-9">
        {!ribbonCollapsed &&
          (ribbonTab === 'insert' ? (
            <PptInsertRibbon
              copy={copy}
              onNewSlide={() => addManualSlide()}
              onDuplicateSlide={duplicateCurrentManualSlide}
              onInsertText={() => appendManualElement(createManualText(copy.text))}
              onInsertButton={() => appendManualElement(createManualButton(copy.button))}
              onInsertImage={(src, name) => appendManualElement(createManualImage(src, name))}
            />
          ) : (
            <AnimationRibbon
              activeTab={ribbonTab}
              selected={selectedObject}
              phase={selectedPhase}
              setPhase={setSelectedPhase}
              animation={getAnimation()}
              onApply={applyEffect}
              onPreview={preview}
              onUpdate={updateSelectedAnimation}
              transition={currentTransition}
              onUpdateTransition={updateTransition}
              onApplyTransitionToAll={applyTransitionToAll}
            />
          ))}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {viewMode === 'normal' ? (
            <SlideList
              slides={slides}
              scenes={scenes}
              selectedId={selectedId}
              timelines={animations}
              transitions={transitions}
              projectName={projectName}
              webSettings={webSettings}
              renderStyle={renderStyle}
              colors={colors}
              layout={pptSettings.layout}
              manualSlides={manualSlides}
              onSelect={selectSlide}
            />
          ) : null}
          <section
            ref={stageViewportRef}
            className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-[var(--vr-bg)]"
          >
            {viewMode === 'sorter' ? (
              <SlideSorter
                slides={slides}
                scenes={scenes}
                selectedId={selectedId}
                timelines={animations}
                transitions={transitions}
                projectName={projectName}
                webSettings={webSettings}
                renderStyle={renderStyle}
                colors={colors}
                layout={pptSettings.layout}
                manualSlides={manualSlides}
                onSelect={(id) => {
                  selectSlide(id);
                  setViewMode('normal');
                }}
              />
            ) : (
              <div
                className={`flex h-full min-h-0 flex-col ${viewMode === 'reading' ? 'bg-slate-950' : ''}`}
              >
                <div className="min-h-0 flex-1 overflow-auto p-6 lg:p-10">
                  <div className="mx-auto flex min-h-full max-w-5xl items-center justify-center">
                    <div
                      className={`relative w-full shrink-0 overflow-hidden bg-slate-950 transition-transform duration-150 ${pptCanvasViewportClass(pptSettings.layout)}`}
                      style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'center' }}
                    >
                      <VirtualPresentationStage
                        fit="contain"
                        width={PPT_CONTENT_WIDTH}
                        height={PPT_CONTENT_HEIGHT}
                        className="absolute inset-0 h-full w-full"
                      >
                        <SlideCanvas
                          key={`${selectedId}:${previewRunId}`}
                          selectedId={selectedId}
                          isChoiceSlide={activeSlide?.kind === 'choice'}
                          scene={scene}
                          manualSlide={manualSlide}
                          videoLoop={currentVideoLoop}
                          projectName={projectName}
                          webSettings={webSettings}
                          renderStyle={renderStyle}
                          colors={colors}
                          animations={currentAnimations}
                          transition={currentTransition}
                          selected={selectedObject}
                          previewing={isPreviewing}
                          previewAtMs={timelinePlayheadMs}
                          onVideoDurationChange={updateCurrentVideoDuration}
                          editable
                          onSelect={selectObject}
                          onUpdateObject={updatePptObject}
                          onChoose={goToScene}
                          selectedManualElementId={selectedManualElementId}
                          onSelectManualElement={selectManualElement}
                          onUpdateManualElement={updateActiveManualElement}
                        />
                      </VirtualPresentationStage>
                    </div>
                  </div>
                </div>
                {notesOpen ? (
                  <NotesPanel
                    height={notesHeight}
                    onResizeStart={startNotesResize}
                    value={pptSettings.speakerNotes?.[selectedId]}
                    onChange={(value) =>
                      updatePptSettings({
                        speakerNotes: { ...pptSettings.speakerNotes, [selectedId]: value },
                      })
                    }
                  />
                ) : null}
              </div>
            )}
          </section>
          {viewMode === 'normal' ? (
            <PptSidebar
              language={language}
              renderStyle={renderStyle}
              updateRenderStyle={updateRenderStyle}
              activeTab={sidebarTab}
              setActiveTab={setSidebarTab}
              selected={selectedObject}
              animation={getAnimation()}
              animations={currentAnimations}
              videoTrack={currentVideoTrack}
              playheadMs={timelinePlayheadMs ?? 0}
              onPlayheadChange={seekTimeline}
              scene={scene}
              pptSettings={pptSettings}
              updatePptSettings={updatePptSettings}
              onSelectAnimation={(animation) => {
                setSelectedObject({
                  target: animation.target,
                  targetId: animation.targetId,
                  label: targetLabel(copy, animation, scene),
                });
                setSelectedPhase(animation.phase || 'enter');
              }}
              onSelectVideo={() => {
                setSelectedObject({ target: 'background', label: copy.background });
              }}
              onMove={moveAnimation}
              onDelete={(id) => replaceTimeline(currentAnimations.filter((item) => item.id !== id))}
              onPreview={preview}
              previewing={isPreviewing}
              onPausePreview={pausePreview}
              onUpdate={updateSelectedAnimation}
              manualSlide={manualSlide}
              selectedManualElementId={selectedManualElementId}
              slides={slides}
              onUpdateManualSlide={updateActiveManualSlide}
              onUpdateManualElement={updateActiveManualElement}
              onDeleteManualElement={deleteActiveManualElement}
            />
          ) : null}
        </div>
        {isPlaying ? (
          <PlayerOverlay
            playerRef={playerRef}
            selectedId={selectedId}
            isChoiceSlide={activeSlide?.kind === 'choice'}
            scene={scene}
            manualSlide={manualSlide}
            videoLoop={currentVideoLoop}
            projectName={projectName}
            webSettings={webSettings}
            renderStyle={renderStyle}
            colors={colors}
            animations={currentAnimations}
            transition={currentTransition}
            layout={pptSettings.layout}
            selectedIndex={selectedIndex}
            total={slides.length}
            onNext={next}
            onPrevious={previous}
            onClose={closePlayer}
            onChoose={goToScene}
          />
        ) : null}
        <PptFooterBar
          viewMode={viewMode}
          setViewMode={setViewMode}
          notesOpen={notesOpen}
          setNotesOpen={setNotesOpen}
          zoom={zoom}
          setZoom={setZoom}
          onFit={() => setZoom(100)}
          onPlay={playFromStart}
        />
      </main>
    </PptCopyContext.Provider>
  );
}

export function SlideCanvas({
  selectedId,
  isChoiceSlide = false,
  scene,
  videoLoop = false,
  projectName,
  webSettings,
  renderStyle,
  colors,
  animations,
  transition,
  selected,
  previewing,
  previewAtMs,
  onVideoDurationChange,
  editable = false,
  onSelect,
  onUpdateObject,
  onChoose,
  manualSlide,
  selectedManualElementId,
  onSelectManualElement,
  onUpdateManualElement,
}: {
  selectedId: string;
  isChoiceSlide?: boolean;
  scene?: Scene;
  videoLoop?: boolean;
  projectName: string;
  webSettings: WebExportSettings;
  renderStyle: RenderStyle;
  colors: ReturnType<typeof pptSceneColors>;
  animations: PptObjectAnimation[];
  transition: PptSlideTransition;
  selected: Selection | null;
  previewing: boolean;
  previewAtMs?: number;
  onVideoDurationChange?: (durationMs: number) => void;
  editable?: boolean;
  onSelect: (selection: Selection) => void;
  onUpdateObject?: (kind: RenderEditableObjectKind, patch: Partial<RenderEditableObject>) => void;
  onChoose?: (targetId: string) => void;
  manualSlide?: PptManualSlide;
  selectedManualElementId?: string;
  onSelectManualElement?: (elementId: string) => void;
  onUpdateManualElement?: (elementId: string, patch: Partial<PptManualElement>) => void;
}) {
  const transitionStyle =
    transition.effect === 'none' ? undefined : { animationDuration: `${transition.durationMs}ms` };
  return (
    <div
      className={`ppt-slide-canvas ppt-transition-${transition.effect} relative aspect-video w-full overflow-hidden rounded-xl border border-white/15 bg-slate-950 shadow-2xl`}
      style={{
        backgroundColor:
          selectedId === 'cover' ? webSettings.startMenuBackgroundColor : colors.background,
        ...transitionStyle,
      }}
    >
      {manualSlide ? (
        <PptManualSlideCanvas
          slide={manualSlide}
          editable={editable}
          selectedElementId={selectedManualElementId}
          onSelectElement={onSelectManualElement}
          onUpdateElement={onUpdateManualElement}
          onNavigateSlide={onChoose}
        />
      ) : selectedId === 'cover' ? (
        <CoverPreview
          projectName={projectName}
          selected={selected}
          animations={animations}
          previewing={previewing}
          previewAtMs={previewAtMs}
          onSelect={onSelect}
        />
      ) : scene ? (
        isChoiceSlide ? (
          <ChoicePreview scene={scene} colors={colors} onChoose={onChoose} />
        ) : (
          <ScenePreview
            scene={scene}
            videoLoop={videoLoop}
            renderStyle={renderStyle}
            colors={colors}
            selected={selected}
            animations={animations}
            previewing={previewing}
            previewAtMs={previewAtMs}
            onVideoDurationChange={onVideoDurationChange}
            editable={editable}
            onSelect={onSelect}
            onUpdateObject={onUpdateObject}
          />
        )
      ) : null}
    </div>
  );
}

function CoverPreview({
  projectName,
  selected,
  animations,
  previewing,
  previewAtMs,
  onSelect,
}: {
  projectName: string;
  selected: Selection | null;
  animations: PptObjectAnimation[];
  previewing: boolean;
  previewAtMs?: number;
  onSelect: (selection: Selection) => void;
}) {
  return (
    <div className="grid h-full place-items-center bg-black/35 px-10 text-center">
      <div>
        <Selectable
          selection={{ target: 'cover-title', label: '封面标题' }}
          selected={selected}
          animation={findAnimation(animations, 'cover-title')}
          previewing={previewing}
          previewAtMs={previewAtMs}
          onSelect={onSelect}
        >
          <h1 className="text-4xl font-black text-white">{projectName || 'GalWriter AI'}</h1>
        </Selectable>
        <Selectable
          selection={{ target: 'cover-subtitle', label: '封面副标题' }}
          selected={selected}
          animation={findAnimation(animations, 'cover-subtitle')}
          previewing={previewing}
          previewAtMs={previewAtMs}
          onSelect={onSelect}
        >
          <p className="mt-4 text-sm text-white/75">由 GalWriter AI 生成</p>
        </Selectable>
      </div>
    </div>
  );
}

function ScenePreview({
  scene,
  videoLoop,
  renderStyle,
  colors: _colors,
  selected,
  animations,
  previewing,
  previewAtMs,
  onVideoDurationChange,
  editable,
  onSelect,
  onUpdateObject,
}: {
  scene: Scene;
  videoLoop: boolean;
  renderStyle: RenderStyle;
  colors: ReturnType<typeof pptSceneColors>;
  selected: Selection | null;
  animations: PptObjectAnimation[];
  previewing: boolean;
  previewAtMs?: number;
  onVideoDurationChange?: (durationMs: number) => void;
  editable: boolean;
  onSelect: (selection: Selection) => void;
  onUpdateObject?: (kind: RenderEditableObjectKind, patch: Partial<RenderEditableObject>) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const objects = getRenderObjects(renderStyle);
  const title = objects.title;
  const body = objects.body;
  const panel = objects.dialogBox;
  const nameplate = objects.nameplate;
  const hasTitle = title.visible && Boolean(scene.title.trim());
  // Match the web preview's logical 720px-canvas text sizing on the 1080px stage.
  const titlePaint = textPaint(title, true);
  const bodyPaint = textPaint(body, true);
  const panelStyle = objectPaint(panel);
  const panelLayout = resolvePresentationDialogueLayout(1920, 1080, renderStyle);
  const panelCss = {
    left: `${panelLayout.x / 19.2}%`,
    top: `${panelLayout.y / 10.8}%`,
    width: `${panelLayout.width / 19.2}%`,
    height: `${panelLayout.height / 10.8}%`,
    padding: `${panelLayout.paddingY / 10.8}% ${panelLayout.paddingX / 19.2}%`,
  };
  useEffect(() => {
    const video = videoRef.current;
    if (!video || previewAtMs === undefined || previewing) return;
    const durationMs = video.duration * 1000;
    if (!Number.isFinite(durationMs) || durationMs <= 0) return;
    const nextTimeMs = videoLoop ? previewAtMs % durationMs : Math.min(previewAtMs, durationMs);
    video.currentTime = nextTimeMs / 1000;
    video.pause();
  }, [previewAtMs, previewing, videoLoop]);
  return (
    <>
      <Selectable
        className="absolute inset-0 z-0"
        selection={{ target: 'background', label: '场景背景' }}
        selected={selected}
        animation={findAnimation(animations, 'background')}
        previewing={previewing}
        previewAtMs={previewAtMs}
        onSelect={onSelect}
      >
        {scene.backgroundVideoUrl ? (
          <video
            ref={videoRef}
            src={scene.backgroundVideoUrl}
            autoPlay
            muted
            loop={videoLoop}
            playsInline
            onLoadedMetadata={(event) =>
              onVideoDurationChange?.(event.currentTarget.duration * 1000)
            }
            className="h-full w-full object-cover"
          />
        ) : scene.backgroundUrl ? (
          <img src={scene.backgroundUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full" />
        )}
      </Selectable>
      <div className="pointer-events-none absolute inset-0 z-[1] bg-black/10" />
      {scene.characters.map((character) => {
        const selection = {
          target: 'character' as const,
          targetId: character.sourceNodeId,
          label: `角色：${character.name || '未命名'}`,
        };
        return (
          <Selectable
            key={character.sourceNodeId}
            className="absolute"
            selection={selection}
            selected={selected}
            animation={findAnimation(animations, 'character', character.sourceNodeId)}
            previewing={previewing}
            previewAtMs={previewAtMs}
            onSelect={onSelect}
            style={{
              ...getCharacterStageBounds(character),
              transform: `translate(-50%, 0) scale(${character.scale || 1}) scaleX(${character.flipX ? -1 : 1})`,
              transformOrigin: 'bottom center',
              zIndex: 10 + (character.layer || 1),
            }}
          >
            <img
              src={character.imageUrl}
              alt={character.name || ''}
              className="h-full max-w-full w-auto object-contain"
            />
          </Selectable>
        );
      })}
      <PptEditableObject
        kind="dialogBox"
        target="dialog-panel"
        label="对话框"
        object={panel}
        selected={selected}
        animation={findAnimation(animations, 'dialog-panel')}
        previewing={previewing}
        previewAtMs={previewAtMs}
        editable={editable}
        onSelect={onSelect}
        onUpdate={onUpdateObject}
        className="absolute z-40"
        style={{ ...panelCss, ...panelStyle }}
      >
        {hasTitle ? (
          <PptEditableObject
            kind="title"
            target="dialog-title"
            label="对话标题"
            object={title}
            selected={selected}
            animation={findAnimation(animations, 'dialog-title')}
            previewing={previewing}
            previewAtMs={previewAtMs}
            editable={editable}
            onSelect={onSelect}
            onUpdate={onUpdateObject}
            className="absolute z-20"
            style={{
              left: `${title.x}px`,
              top: `${title.y}px`,
              width: `${title.width}%`,
              height: `${title.height}px`,
              ...titlePaint,
            }}
          >
            {scene.title}
          </PptEditableObject>
        ) : null}
        <PptEditableObject
          kind="body"
          target="dialog-body"
          label="对话正文"
          object={body}
          selected={selected}
          animation={findAnimation(animations, 'dialog-body')}
          previewing={previewing}
          previewAtMs={previewAtMs}
          editable={editable}
          onSelect={onSelect}
          onUpdate={onUpdateObject}
          className="absolute z-20 whitespace-pre-wrap"
          style={{
            left: `${body.x}px`,
            top: `calc(${hasTitle ? title.height + 8 : 0}px + ${body.y}px)`,
            width: `${body.width}%`,
            height: `${body.height}px`,
            ...bodyPaint,
          }}
        >
          {scene.text}
        </PptEditableObject>
      </PptEditableObject>
      {nameplate.visible && renderStyle.nameplateVisible ? (
        <PptEditableObject
          kind="nameplate"
          target="nameplate"
          label="人物名牌"
          object={nameplate}
          selected={selected}
          animation={findAnimation(animations, 'nameplate')}
          previewing={previewing}
          previewAtMs={previewAtMs}
          editable={editable}
          onSelect={onSelect}
          onUpdate={onUpdateObject}
          className="absolute z-50 grid place-items-center px-3 text-center"
          style={{
            left: `${(panelLayout.x + nameplate.x) / 19.2}%`,
            bottom: `${(1080 - (panelLayout.y + panelLayout.height) - nameplate.y) / 10.8}%`,
            width: `${nameplate.width}%`,
            height: `${nameplate.height}px`,
            ...objectPaint(nameplate),
            ...textPaint(nameplate),
            color: alphaColor(
              renderStyle.nameplateTextColor,
              renderStyle.nameplateTextColorAlpha ?? 100,
            ),
          }}
        >
          {scene.characters.find((character) => character.name)?.name || scene.title}
        </PptEditableObject>
      ) : null}
    </>
  );
}

const alphaColor = (value: string, alpha: number) => {
  const normalized = /^#[0-9a-f]{6}$/i.test(value) ? value : '#111827';
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha / 100})`;
};
const fillPaint = (object: RenderEditableObject) => {
  const fill = object.fill;
  if (fill.type === 'image' && fill.imageUrl) return `url("${fill.imageUrl.replace(/"/g, '\\"')}")`;
  if (fill.type === 'gradient')
    return `linear-gradient(${fill.gradientAngle}deg, ${[...fill.gradientStops]
      .sort((a, b) => a.position - b.position)
      .map((stop) => `${alphaColor(stop.color, stop.alpha)} ${stop.position}%`)
      .join(', ')})`;
  return alphaColor(fill.color, fill.alpha);
};
const objectPaint = (object: RenderEditableObject): React.CSSProperties => ({
  background: fillPaint(object),
  backgroundSize: object.fill.type === 'image' ? 'cover' : undefined,
  backgroundPosition: object.fill.type === 'image' ? 'center' : undefined,
  borderRadius: object.radius,
  border: object.stroke.enabled
    ? `${object.stroke.width}px solid ${alphaColor(object.stroke.color, object.stroke.alpha)}`
    : undefined,
  boxShadow: object.shadow.enabled
    ? `${object.shadow.x}px ${object.shadow.y}px ${object.shadow.blur}px ${object.shadow.spread}px ${alphaColor(object.shadow.color, object.shadow.alpha)}`
    : undefined,
  transform: `rotate(${object.rotation}deg) scale(${object.flipX ? -1 : 1}, ${object.flipY ? -1 : 1})`,
  transformOrigin: 'center',
  boxSizing: 'border-box',
});
const textPaint = (
  object: RenderEditableObject,
  scaleForPresentation = false,
): React.CSSProperties => {
  const text = object as import('../video/shared/types').RenderEditableTextObject;
  const gradient = text.fill.type === 'gradient' || text.fill.type === 'image';
  const presentationTextScale = scaleForPresentation
    ? resolvePresentationTextScale(PPT_CONTENT_HEIGHT)
    : 1;
  return {
    color: gradient ? 'transparent' : alphaColor(text.fill.color, text.fill.alpha),
    backgroundImage: gradient ? fillPaint(text) : undefined,
    backgroundClip: gradient ? 'text' : undefined,
    WebkitBackgroundClip: gradient ? 'text' : undefined,
    WebkitTextStroke: text.stroke.enabled
      ? `${text.stroke.width}px ${text.stroke.color}`
      : undefined,
    fontFamily: text.fontFamily,
    fontSize: text.fontSize * presentationTextScale,
    fontWeight: text.fontWeight,
    letterSpacing: text.letterSpacing * presentationTextScale,
    lineHeight: text.lineHeight,
    textAlign: text.textAlign,
    textDecoration:
      `${text.underline ? 'underline' : ''} ${text.strikethrough ? 'line-through' : ''}`.trim(),
    overflow: 'hidden',
    boxSizing: 'border-box',
    padding: 0,
    transform: `rotate(${text.rotation}deg) scale(${text.flipX ? -1 : 1}, ${text.flipY ? -1 : 1})`,
    transformOrigin: 'center',
  };
};
function PptEditableObject({
  kind,
  target,
  label,
  object,
  selected,
  animation,
  previewing,
  previewAtMs,
  editable,
  onSelect,
  onUpdate,
  className,
  style,
  children,
}: {
  kind: RenderEditableObjectKind;
  target: PptAnimationTarget;
  label: string;
  object: RenderEditableObject;
  selected: Selection | null;
  animation: PptObjectAnimation[];
  previewing: boolean;
  previewAtMs?: number;
  editable: boolean;
  onSelect: (selection: Selection) => void;
  onUpdate?: (kind: RenderEditableObjectKind, patch: Partial<RenderEditableObject>) => void;
  className: string;
  style: React.CSSProperties;
  children: ReactNode;
}) {
  const selection = { target, label };
  const isSelected = selected?.target === target;
  const beginDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!editable || !onUpdate || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect(selection);
    const startX = event.clientX;
    const startY = event.clientY;
    const initial = object;
    const move = (moveEvent: PointerEvent) =>
      onUpdate(kind, {
        x: Math.round(initial.x + moveEvent.clientX - startX),
        y: Math.round(initial.y + moveEvent.clientY - startY),
      });
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  };
  const beginResize = (event: React.PointerEvent<HTMLElement>, handle: WebEditableResizeHandle) => {
    if (!onUpdate) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const initial = object;
    const rect = event.currentTarget.parentElement?.getBoundingClientRect();
    const widthScale = rect ? 100 / rect.width : 1;
    const heightScale = rect ? 100 / rect.height : 1;
    const move = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) * widthScale;
      const dy = (moveEvent.clientY - startY) * heightScale;
      let x = initial.x;
      let y = initial.y;
      let width = initial.width;
      let height = initial.height;
      if (handle.includes('e')) width += dx;
      if (handle.includes('w')) {
        width -= dx;
        x += moveEvent.clientX - startX;
      }
      if (handle.includes('s')) height += dy;
      if (handle.includes('n')) {
        height -= dy;
        y += moveEvent.clientY - startY;
      }
      onUpdate(kind, {
        x: Math.round(x),
        y: Math.round(y),
        width: Math.max(8, Math.round(width)),
        height: Math.max(8, Math.round(height)),
      });
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  };
  const beginRotate = (event: React.PointerEvent<HTMLElement>) => {
    if (!onUpdate) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const start = Math.atan2(event.clientY - centerY, event.clientX - centerX);
    const move = (moveEvent: PointerEvent) =>
      onUpdate(kind, {
        rotation: Math.round(
          object.rotation +
            ((Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX) - start) * 180) /
              Math.PI,
        ),
      });
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  };
  if (!object.visible && !editable) return null;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`选择${label}`}
      data-render-object={kind}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(selection);
      }}
      onPointerDown={beginDrag}
      className={`ppt-selectable ${isSelected ? 'is-selected' : ''} ${editable ? 'cursor-grab' : ''} ${className}`}
      style={{
        ...style,
        ...previewStyle(animation, previewing, previewAtMs),
        opacity: object.visible ? undefined : 0.3,
      }}
    >
      {children}
      {animation.length ? <span className="ppt-animation-index">✦</span> : null}
      {editable && isSelected && onUpdate ? (
        <WebEditableElementFrame
          visible={object.visible}
          onToggleVisible={(event) => {
            event.stopPropagation();
            onUpdate(kind, { visible: !object.visible });
          }}
          onRotatePointerDown={beginRotate}
          onResizePointerDown={beginResize}
        />
      ) : null}
    </div>
  );
}

function ChoicePreview({
  scene,
  colors: _colors,
  onChoose,
}: {
  scene: Scene;
  colors: ReturnType<typeof pptSceneColors>;
  onChoose?: (targetId: string) => void;
}) {
  return (
    <>
      <div className="absolute inset-0 z-0">
        {scene.backgroundVideoUrl ? (
          <video
            src={scene.backgroundVideoUrl}
            muted
            playsInline
            preload="auto"
            onLoadedMetadata={(event) => {
              const video = event.currentTarget;
              if (!Number.isFinite(video.duration) || video.duration <= 0) return;
              video.currentTime = Math.max(0, video.duration - Math.min(0.08, video.duration / 20));
            }}
            onSeeked={(event) => event.currentTarget.pause()}
            className="h-full w-full object-cover"
          />
        ) : scene.backgroundUrl ? (
          <img src={scene.backgroundUrl} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="absolute inset-0 z-[1] bg-slate-950/55" />
      <div className="absolute inset-x-[16%] top-[16%] z-20 text-center text-white">
        <p className="text-sm font-bold tracking-[0.28em] text-white/70">CHOOSE YOUR ROUTE</p>
        <h2 className="mt-3 text-3xl font-black">你的选择是？</h2>
        <div className="mt-9 space-y-3">
          {scene.choices.map((choice, index) =>
            onChoose ? (
              <button
                key={`${choice.label}-${index}`}
                type="button"
                onClick={() => choice.targetId && onChoose(choice.targetId)}
                className="block w-full rounded-xl border border-white/30 bg-slate-950/70 px-6 py-4 text-left shadow-lg transition hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-slate-900/85"
              >
                <span className="mr-3 inline-grid h-7 w-7 place-items-center rounded-full bg-indigo-500 text-xs font-black">
                  {index + 1}
                </span>
                <span className="text-lg font-bold">{choice.label}</span>
              </button>
            ) : (
              <div
                key={`${choice.label}-${index}`}
                className="block w-full rounded-xl border border-white/30 bg-slate-950/70 px-6 py-4 text-left shadow-lg"
              >
                <span className="mr-3 inline-grid h-7 w-7 place-items-center rounded-full bg-indigo-500 text-xs font-black">
                  {index + 1}
                </span>
                <span className="text-lg font-bold">{choice.label}</span>
              </div>
            ),
          )}
        </div>
      </div>
    </>
  );
}

function Selectable({
  selection,
  selected,
  animation,
  previewing,
  previewAtMs,
  onSelect,
  className = '',
  style,
  children,
}: {
  selection: Selection;
  selected: Selection | null;
  animation: PptObjectAnimation[];
  previewing: boolean;
  previewAtMs?: number;
  onSelect: (selection: Selection) => void;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
}) {
  const active =
    selected &&
    animationKey(selected.target, selected.targetId) ===
      animationKey(selection.target, selection.targetId);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`选择${selection.label}`}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(selection);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(selection);
        }
      }}
      className={`ppt-selectable ${active ? 'is-selected' : ''} ${className}`}
      style={{ ...style, ...previewStyle(animation, previewing, previewAtMs) }}
    >
      {children}
      {animation.length ? <span className="ppt-animation-index">✦</span> : null}
    </div>
  );
}
