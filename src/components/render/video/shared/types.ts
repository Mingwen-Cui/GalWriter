import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react';
import type { ReactNode } from 'react';

import type { Language } from '../../../../lib/i18n';
import type { TTSConfig } from '../../../../lib/tts';

export type RenderStatus = 'idle' | 'rendering' | 'done' | 'error';
export type ExportFormat = 'mp4' | 'mov' | 'mkv';
export type TextAnimation = 'none' | 'fade' | 'slideUp' | 'typewriter';
export type TextAlign = 'left' | 'center' | 'right';
export type TypewriterMode = 'character' | 'word' | 'sentence' | 'line';
export type RenderEditableObjectKind = 'dialogBox' | 'title' | 'body' | 'nameplate';
export type RenderFillType = 'solid' | 'gradient' | 'image';
export type RenderStrokePosition = 'inside' | 'center' | 'outside';
export type RenderShadowType = 'outer' | 'inner' | 'innerBlur';
export type TimelineScaleMode = 'seconds' | 'frames';
export type TimelineWheelMode = 'vertical' | 'horizontal';
export type AssetCardLayout = 'row' | 'grid';
export type ExportSettingsMode = 'video' | 'audio';
export type RenderWorkspaceMode = 'video' | 'web' | 'ppt' | 'code';
export type VideoWorkspaceMode = 'timeline' | 'interactive';
export type RenderWorkspaceLaunchIntent =
  | { workspaceMode: 'video'; videoWorkspaceMode: VideoWorkspaceMode }
  | { workspaceMode: 'web'; showStartMenu: boolean }
  | { workspaceMode: 'ppt'; entryMode: 'story' | 'manual' }
  | { workspaceMode: 'code'; codeTarget: 'renpy' | 'tyrano' | 'dialogic' };
export type VideoTextScaleMode = 'literal' | 'webRatio';
export type VideoCoverSourceType = 'videoFrame' | 'image' | 'gradient';
export type VideoCoverLogoPosition = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
export type VideoCoverElement = {
  id: string;
  kind: 'text' | 'image';
  text?: string;
  imageUrl?: string;
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  fontSize?: number;
  fontWeight?: number;
  textAlign?: TextAlign;
  textColor?: string;
  objectFit?: 'cover' | 'contain';
  /** Object-position percentage used when an image layer is cropped. */
  imageCropX?: number;
  imageCropY?: number;
  /** Extra zoom applied inside the image layer crop frame. */
  imageCropScale?: number;
} & Partial<WebMenuElement>;
export type VideoCoverSettings = {
  sourceType: VideoCoverSourceType;
  videoNodeId?: string;
  frameTime: number;
  imageUrl?: string;
  gradientStart: string;
  gradientEnd: string;
  title: string;
  subtitle: string;
  titleX: number;
  titleY: number;
  subtitleX: number;
  subtitleY: number;
  titleFontSize: number;
  subtitleFontSize: number;
  textAlign: TextAlign;
  logoPosition: VideoCoverLogoPosition;
  elements?: VideoCoverElement[];
  logoInitialized?: boolean;
  canvasSettings?: Partial<WebExportSettings>;
};
export type TimelineSegmentMetric = {
  node: FlowNode;
  start: number;
  duration: number;
  end: number;
};

export type VideoRenderModalProps = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  onClose: () => void;
  onUpdateNodeData?: (id: string, data: Record<string, unknown>) => void;
  language: Language;
  workspaceKey?: string;
  renderStyle: RenderStyle;
  updateRenderStyle: <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => void;
  voiceTtsConfig?: TTSConfig;
  callAIForTextResult?: (prompt: string) => Promise<{ content: string; reasoning?: string }>;
  launchIntent?: RenderWorkspaceLaunchIntent;
};

export type RenderStyle = {
  selectedRenderObject?: RenderEditableObjectKind;
  renderObjects?: RenderEditableObjects;
  /** Video-only text animation settings. Web playback keeps using its established animation path. */
  videoTextAnimations?: Partial<Record<'title' | 'body', RenderObjectAnimationStyle>>;
  titleVisible: boolean;
  titleFontSize: number;
  bodyFontSize: number;
  titleFontFamily: string;
  bodyFontFamily: string;
  titleColor: string;
  bodyColor: string;
  titleColorAlpha: number;
  bodyColorAlpha: number;
  titleStrokeColor: string;
  bodyStrokeColor: string;
  titleStrokeWidth: number;
  bodyStrokeWidth: number;
  titleAlign: TextAlign;
  bodyAlign: TextAlign;
  titleLetterSpacing: number;
  bodyLetterSpacing: number;
  titleLineHeight: number;
  bodyLineHeight: number;
  titleAnimationLeadSeconds: number;
  bodyAnimationLeadSeconds: number;
  titleTypewriterMode: TypewriterMode;
  bodyTypewriterMode: TypewriterMode;
  panelColor: string;
  panelColorAlpha?: number;
  dialogVisible: boolean;
  dialogWidth: number;
  dialogHeight: number;
  dialogHeightMode: 'fixed' | 'auto';
  dialogRadius: number;
  dialogOffsetX: number;
  dialogOffsetY: number;
  dialogTextPaddingX: number;
  dialogTextOffsetY: number;
  dialogBackgroundType: 'solid' | 'gradient' | 'image';
  dialogGradientAngle: number;
  dialogGradientStartColor: string;
  dialogGradientColor: string;
  dialogGradientStops: Array<{ id: string; color: string; alpha: number; position: number }>;
  dialogImageUrl: string;
  nameplateVisible: boolean;
  nameplateInside: boolean;
  nameplateFollowCharacter: boolean;
  nameplateFontSize: number;
  nameplateFontFamily: string;
  nameplateScale: number;
  nameplateRadius: number;
  nameplateTextColor: string;
  nameplateTextColorAlpha: number;
  nameplateOffsetX: number;
  nameplateOffsetY: number;
  nameplateTextGap: number;
  nameplateBackgroundType: 'solid' | 'gradient' | 'image';
  nameplateColor: string;
  nameplateColorAlpha: number;
  nameplateGradientAngle: number;
  nameplateGradientStops: Array<{ id: string; color: string; alpha: number; position: number }>;
  nameplateImageUrl: string;
  titleAnimation: TextAnimation;
  bodyAnimation: TextAnimation;
};

export type RenderColorStop = {
  id: string;
  color: string;
  alpha: number;
  position: number;
};

export type RenderGradientType = 'linear' | 'radial' | 'angular' | 'diamond';

export type RenderFillStyle = {
  enabled: boolean;
  type: RenderFillType;
  color: string;
  alpha: number;
  gradientAngle: number;
  gradientType?: RenderGradientType;
  gradientStops: RenderColorStop[];
  imageUrl: string;
  imageFit: 'fit' | 'max' | 'crop';
  imageAngle: number;
  imageAlpha: number;
  imageScale?: number;
  imageOffsetX?: number;
  imageOffsetY?: number;
  blendMode: string;
};

export type RenderStrokeStyle = {
  enabled: boolean;
  type: RenderFillType;
  color: string;
  alpha: number;
  width: number;
  position: RenderStrokePosition;
  gradientAngle: number;
  gradientType?: RenderGradientType;
  gradientStops: RenderColorStop[];
  imageUrl: string;
  dashed: boolean;
  lineCap: 'butt' | 'round' | 'square';
  lineJoin: 'miter' | 'round' | 'bevel';
};

export type RenderShadowStyle = {
  enabled: boolean;
  type: RenderShadowType;
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
  alpha: number;
};

export type RenderObjectAnimationStyle = {
  animation: TextAnimation;
  durationMs: number;
  typewriterMode: TypewriterMode;
};

export type RenderEditableObject = {
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  horizontalAlign: TextAlign;
  verticalAlign: 'top' | 'center' | 'bottom';
  fill: RenderFillStyle;
  stroke: RenderStrokeStyle;
  shadow: RenderShadowStyle;
  /** Extra shadow layers.  `shadow` remains the compatibility-first primary layer. */
  shadows?: RenderShadowStyle[];
  animation: RenderObjectAnimationStyle;
};

export type RenderEditableTextObject = RenderEditableObject & {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  underline: boolean;
  strikethrough: boolean;
  letterSpacing: number;
  lineHeight: number;
  textAlign: TextAlign;
  textVerticalAlign: 'top' | 'center' | 'bottom';
};

export type RenderEditableObjects = {
  dialogBox: RenderEditableObject;
  title: RenderEditableTextObject;
  body: RenderEditableTextObject;
  nameplate: RenderEditableTextObject;
};

export type WebMenuElement = {
  id: string;
  kind: 'button' | 'text' | 'image';
  role?:
    | 'save'
    | 'continue'
    | 'new'
    | 'settings'
    | 'title'
    | 'subtitle'
    | 'custom'
    | 'back'
    | 'slot'
    | 'slotContinue'
    | 'slotDelete'
    | 'auto'
    | 'speed'
    | 'textSize'
    | 'animationSpeed'
    | 'sound'
    | 'controls'
    | 'audio'
    | 'fullscreen'
    | 'return'
    | 'mainMenu'
    | 'controlsToggle'
    | 'link'
    | 'volume';
  text: string;
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  rotation: number;
  primary?: boolean;
  disabled?: boolean;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  textColor?: string;
  textColorAlpha?: number;
  textColorType?: 'solid' | 'gradient';
  textGradientStart?: string;
  textGradientEnd?: string;
  textGradientAngle?: number;
  textGradientStops?: Array<{ id: string; color: string; alpha: number; position: number }>;
  textBlendMode?: string;
  textVisible?: boolean;
  textStrokeColor?: string;
  textStrokeWidth?: number;
  textStrokeTarget?: 'text' | 'box';
  fillEnabled?: boolean;
  strokeEnabled?: boolean;
  shadowEnabled?: boolean;
  textAlign?: TextAlign;
  letterSpacing?: number;
  lineHeight?: number;
  backgroundType?: 'solid' | 'gradient' | 'image';
  backgroundColor?: string;
  backgroundGradientStart?: string;
  backgroundGradientEnd?: string;
  backgroundGradientAngle?: number;
  backgroundGradientShape?: 'linear' | 'radial' | 'diamond';
  backgroundGradientStartX?: number;
  backgroundGradientStartY?: number;
  backgroundGradientEndX?: number;
  backgroundGradientEndY?: number;
  backgroundGradientStops?: Array<{ id: string; color: string; alpha: number; position: number }>;
  backgroundImageUrl?: string;
  /** Solid color rendered below an image fill, including transparent PNG areas and contain gaps. */
  backgroundImageBackgroundColor?: string;
  backgroundImageFit?: 'fit' | 'max' | 'crop';
  backgroundImageAlpha?: number;
  backgroundImageRotation?: number;
  backgroundImageScale?: number;
  backgroundImageOffsetX?: number;
  backgroundImageOffsetY?: number;
  borderType?: 'solid' | 'gradient';
  borderColor?: string;
  borderGradientStart?: string;
  borderGradientEnd?: string;
  borderGradientAngle?: number;
  borderGradientStops?: Array<{ id: string; color: string; alpha: number; position: number }>;
  borderPosition?: 'inside' | 'center' | 'outside';
  borderWidth?: number;
  borderRadius?: number;
  borderTopLeftRadius?: number;
  borderTopRightRadius?: number;
  borderBottomRightRadius?: number;
  borderBottomLeftRadius?: number;
  shadowColor?: string;
  shadowType?: 'outer' | 'inner' | 'innerBlur';
  shadowOpacity?: number;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadows?: Array<{
    id: string;
    type: 'outer' | 'inner' | 'innerBlur';
    color: string;
    opacity: number;
    blur: number;
    offsetX: number;
    offsetY: number;
    enabled?: boolean;
  }>;
  zIndex?: number;
  opacity?: number;
  blendMode?: string;
  imageUrl?: string;
  /** Solid color rendered below a standalone image, including transparent PNG areas. */
  imageBackgroundColor?: string;
  linkUrl?: string;
  linkTarget?: '_blank' | '_self';
  actionValue?: number;
  actionValueInputMode?: 'drag' | 'slider';
};

export type WebExportSettings = {
  canvasWidth: number;
  canvasHeight: number;
  canvasRatioWidth: number;
  canvasRatioHeight: number;
  canvasRatioLocked: boolean;
  layoutMode: 'classic' | 'immersive';
  sceneFit: 'cover' | 'contain' | 'stretch';
  sceneScale: number;
  sceneScaleX: number;
  sceneScaleY: number;
  sceneOffsetX: number;
  sceneOffsetY: number;
  sceneBackgroundVisible: boolean;
  sceneBackgroundType: 'solid' | 'gradient' | 'image';
  sceneBackgroundColor: string;
  sceneBackgroundGradientStart: string;
  sceneBackgroundGradientEnd: string;
  sceneBackgroundGradientAngle: number;
  sceneBackgroundImageUrl: string;
  choicesPosition: 'center' | 'aboveText' | 'belowText';
  showStartMenu: boolean;
  startMenuTemplate: 'cinematic' | 'minimal' | 'glass';
  startMenuBackgroundType: 'solid' | 'gradient' | 'image' | 'video';
  startMenuBackgroundColor: string;
  startMenuBackgroundGradientStart: string;
  startMenuBackgroundGradientEnd: string;
  startMenuBackgroundGradientAngle: number;
  startMenuBackgroundGradientShape?: 'linear' | 'radial' | 'diamond';
  startMenuBackgroundGradientStartX?: number;
  startMenuBackgroundGradientStartY?: number;
  startMenuBackgroundGradientEndX?: number;
  startMenuBackgroundGradientEndY?: number;
  startMenuBackgroundGradientStops?: Array<{
    id: string;
    color: string;
    alpha: number;
    position: number;
  }>;
  startMenuBackgroundImageUrl: string;
  startMenuBackgroundVideoUrl?: string;
  startMenuBackgroundVideoLoop?: boolean;
  startMenuBackgroundVideoMuted?: boolean;
  startMenuBackgroundVideoFit?: 'crop' | 'fit';
  archiveBackgroundType?: 'solid' | 'gradient' | 'image' | 'video';
  archiveBackgroundColor?: string;
  archiveBackgroundGradientStart?: string;
  archiveBackgroundGradientEnd?: string;
  archiveBackgroundGradientAngle?: number;
  archiveBackgroundGradientShape?: 'linear' | 'radial' | 'diamond';
  archiveBackgroundGradientStartX?: number;
  archiveBackgroundGradientStartY?: number;
  archiveBackgroundGradientEndX?: number;
  archiveBackgroundGradientEndY?: number;
  archiveBackgroundGradientStops?: Array<{
    id: string;
    color: string;
    alpha: number;
    position: number;
  }>;
  archiveBackgroundImageUrl?: string;
  archiveBackgroundVideoUrl?: string;
  archiveBackgroundVideoLoop?: boolean;
  archiveBackgroundVideoMuted?: boolean;
  archiveBackgroundVideoFit?: 'crop' | 'fit';
  settingsBackgroundType?: 'solid' | 'gradient' | 'image' | 'video';
  settingsBackgroundColor?: string;
  settingsBackgroundGradientStart?: string;
  settingsBackgroundGradientEnd?: string;
  settingsBackgroundGradientAngle?: number;
  settingsBackgroundGradientShape?: 'linear' | 'radial' | 'diamond';
  settingsBackgroundGradientStartX?: number;
  settingsBackgroundGradientStartY?: number;
  settingsBackgroundGradientEndX?: number;
  settingsBackgroundGradientEndY?: number;
  settingsBackgroundGradientStops?: Array<{
    id: string;
    color: string;
    alpha: number;
    position: number;
  }>;
  settingsBackgroundImageUrl?: string;
  settingsBackgroundVideoUrl?: string;
  settingsBackgroundVideoLoop?: boolean;
  settingsBackgroundVideoMuted?: boolean;
  settingsBackgroundVideoFit?: 'crop' | 'fit';
  dialogueBackgroundType?: 'solid' | 'gradient' | 'image' | 'video';
  dialogueBackgroundColor?: string;
  dialogueBackgroundGradientStart?: string;
  dialogueBackgroundGradientEnd?: string;
  dialogueBackgroundGradientAngle?: number;
  dialogueBackgroundGradientShape?: 'linear' | 'radial' | 'diamond';
  dialogueBackgroundGradientStartX?: number;
  dialogueBackgroundGradientStartY?: number;
  dialogueBackgroundGradientEndX?: number;
  dialogueBackgroundGradientEndY?: number;
  dialogueBackgroundGradientStops?: Array<{
    id: string;
    color: string;
    alpha: number;
    position: number;
  }>;
  dialogueBackgroundImageUrl?: string;
  dialogueBackgroundVideoUrl?: string;
  dialogueBackgroundVideoLoop?: boolean;
  dialogueBackgroundVideoMuted?: boolean;
  dialogueBackgroundVideoFit?: 'crop' | 'fit';
  startMenuBackgroundMusicUrl: string;
  startMenuMusicVolume: number;
  startMenuMusicFadeIn: number;
  startMenuMusicFadeOut: number;
  startMenuMusicLoop: boolean;
  startMenuMusicApplyToArchive: boolean;
  startMenuMusicApplyToSettings: boolean;
  startMenuButtonPosition: 'center' | 'bottomLeft' | 'bottomRight';
  startMenuButtonLayout: 'vertical' | 'horizontal';
  startMenuButtonSize: 'compact' | 'normal' | 'large';
  startMenuElements: WebMenuElement[];
  archivePageElements: WebMenuElement[];
  settingsPageElements: WebMenuElement[];
  previewToolbarElements: WebMenuElement[];
  dialogueOverlayElements: WebMenuElement[];
  startMenuPlacementBoundsLocked: boolean;
  startMenuPlacementMinX: number;
  startMenuPlacementMinY: number;
  startMenuPlacementMaxX: number;
  startMenuPlacementMaxY: number;
  startMenuShowSave: boolean;
  startMenuShowNewGame: boolean;
  startMenuShowSettings: boolean;
  blurBackground: boolean;
  skipSingleChoicePopup: boolean;
  interactionMode: 'immediate' | 'typewriter';
  typewriterSpeed: number;
  autoAdvance: boolean;
  textScale: number;
  animationSpeed: number;
  soundEnabled: boolean;
  videoAutoPlay: boolean;
  hideCharacterTags: boolean;
  hideSceneTags: boolean;
};

export type SegmentRenderInfo = {
  node: FlowNode;
  durationSecs: number;
  startSecs?: number;
  audioUrl?: string;
  videoUrl?: string;
  volume?: number;
  loop?: boolean;
  fadeIn?: number;
  fadeOut?: number;
};

export type RenderedFramePayload = {
  bytes: number[];
  durationSecs: number;
};

export type AssetRegionOption = {
  id: string;
  label: string;
  type:
    | 'all'
    | 'outside'
    | 'mediaImage'
    | 'mediaVideo'
    | 'mediaAudio'
    | 'dynamicGroup'
    | 'background';
};

export type TimelineHistoryState = {
  timelineIds: string[];
  timelineSourceById: Record<string, string>;
  timelineExcludedSourceIds?: string[];
  selectedIds: string[];
  videoTrackIds: string[];
  audioTrackIds: string[];
  videoTrackByNodeId: Record<string, string>;
  audioTrackByNodeId: Record<string, string>;
  timelineStartById: Record<string, number>;
  timelineDurationById?: Record<string, number>;
  timelineDataOverrides?: Record<string, Record<string, unknown>>;
  keyShotIds?: string[];
  activePreviewId: string;
};

export type WebHistoryState = {
  settings: WebExportSettings;
  renderStyle: RenderStyle;
  choiceColor: string;
  choiceTextColor: string;
};

/** PPT only stores presentation rules. All visual fields come from WebExportSettings + RenderStyle. */
/**
 * PPT animations are deliberately split into the three stages used by the
 * story presentation: entering, performing on stage, and exiting.
 */
export type PptAnimationPhase = 'enter' | 'emphasis' | 'exit';
export type PptAnimationEffect =
  | 'none'
  | 'line'
  | 'pulse'
  | 'colorPulse'
  | 'bounce'
  | 'teeter'
  | 'growShrink'
  | 'spin'
  | 'blink'
  | 'wave'
  | 'wiggle'
  | 'desaturate'
  | 'darken'
  | 'lighten'
  | 'transparency'
  // Legacy values are retained so existing saved projects still load.
  | 'appear'
  | 'fade'
  | 'fly'
  | 'float'
  | 'wipe'
  | 'zoom';
export type PptAnimationStart = 'onClick' | 'withPrevious' | 'afterPrevious';
export type PptAnimationDirection = 'left' | 'right' | 'up' | 'down';
export type PptAnimationTarget =
  | 'cover-title'
  | 'cover-subtitle'
  | 'cover-description'
  | 'background'
  | 'character'
  | 'dialog-panel'
  | 'dialog-title'
  | 'dialog-body'
  | 'nameplate'
  | 'choice';

/** Text boxes that can be locally overridden from the PPT workspace. */
export type PptTextOverrideTarget =
  | 'cover-title'
  | 'cover-subtitle'
  | 'cover-description'
  | 'dialog-title'
  | 'dialog-body'
  | 'nameplate';
export type PptTextOverrides = Record<string, Partial<Record<PptTextOverrideTarget, string>>>;
/** Logical 1920×1080 frames for text boxes that are independently arranged in PPT. */
export type PptTextBoxLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  visible?: boolean;
  /** Web-style presentation options retained locally for this PPT text box. */
  webStyle?: PptManualElementWebStyle;
};
export type PptTextBoxLayouts = Record<
  string,
  Partial<Record<PptTextOverrideTarget, PptTextBoxLayout>>
>;

export type PptObjectAnimation = {
  id: string;
  target: PptAnimationTarget;
  targetId?: string;
  /** Tag-generated entries stay linked to the story card and are not saved as manual PPT overrides. */
  source?: 'tag' | 'manual';
  /** The mention span that triggered a middle-of-scene animation. */
  mentionId?: string;
  /** Extra native timing parameters copied from an inline story-tag action. */
  repeats?: number;
  strength?: number;
  offsetX?: number;
  offsetY?: number;
  scale?: number;
  /** Resolved replacement asset for a tag-driven native cross-fade. */
  switchImageUrl?: string;
  action?:
    | 'shake-x'
    | 'shake-y'
    | 'translate'
    | 'scale'
    | 'pulse'
    | 'rotate'
    | 'opacity'
    | 'brightness'
    | 'switch';
  /** A PPT-native dialogue preset expanded to editable line text boxes at export. */
  textBuild?: {
    mode: 'line-wipe';
    lineGapMs: number;
  };
  /** Missing phase means a legacy entrance animation. */
  phase?: PptAnimationPhase;
  effect: PptAnimationEffect;
  start: PptAnimationStart;
  durationMs: number;
  delayMs: number;
  direction: PptAnimationDirection;
};

export type PptTransitionEffect =
  | 'none'
  | 'smooth'
  | 'fade'
  | 'push'
  | 'wipe'
  | 'split'
  | 'reveal'
  | 'cut'
  | 'randomBars';
export type PptSlideTransition = {
  effect: PptTransitionEffect;
  durationMs: number;
  direction: PptAnimationDirection;
  advanceOnClick: boolean;
  advanceAfterMs?: number;
};

/**
 * PPT keeps its own pixel-based canvas, while reusing the Web workspace's
 * inspector. This stores the visual options that have a direct counterpart in
 * that inspector without coupling manual slide content to web export settings.
 */
export type PptManualElementWebStyle = Partial<
  Omit<
    WebMenuElement,
    | 'id'
    | 'kind'
    | 'role'
    | 'text'
    | 'visible'
    | 'x'
    | 'y'
    | 'width'
    | 'height'
    | 'scale'
    | 'rotation'
  >
>;

export type PptManualElementBase = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  visible?: boolean;
  webStyle?: PptManualElementWebStyle;
};
export type PptManualImageElement = PptManualElementBase & {
  kind: 'image';
  src: string;
  alt?: string;
};
export type PptManualTextElement = PptManualElementBase & {
  kind: 'text';
  text: string;
  fontSize: number;
  fontFamily?: string;
  color: string;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
};
export type PptManualButtonElement = PptManualElementBase & {
  kind: 'button';
  text: string;
  variant: 'primary' | 'secondary' | 'link';
  action: 'none' | 'slide' | 'url';
  targetSlideId?: string;
  url?: string;
};
export type PptManualElement =
  | PptManualImageElement
  | PptManualTextElement
  | PptManualButtonElement;
/** Background settings are intentionally local to one PPT slide. */
export type PptSlideBackgroundStyle = {
  type: 'solid' | 'gradient' | 'image' | 'video';
  color: string;
  gradientStart: string;
  gradientEnd: string;
  gradientAngle: number;
  gradientStartX?: number;
  gradientStartY?: number;
  gradientEndX?: number;
  gradientEndY?: number;
  gradientShape?: 'linear' | 'radial' | 'diamond';
  gradientStops?: Array<{ id: string; color: string; alpha: number; position: number }>;
  imageUrl?: string;
  videoUrl?: string;
  videoLoop?: boolean;
  videoMuted?: boolean;
  videoFit?: 'crop' | 'fit';
};
export type PptSlideBackgroundStyles = Record<string, PptSlideBackgroundStyle>;
export type PptManualSlide = {
  id: string;
  title: string;
  backgroundColor: string;
  backgroundStyle?: PptSlideBackgroundStyle;
  elements: PptManualElement[];
};
/** Inserted elements attached to a story-generated slide, keyed by the stable slide id. */
export type PptSlideElements = Record<string, PptManualElement[]>;
/** Slide-local fill colors for generated PPT pages. Manual slides own their color directly. */
export type PptSlideBackgroundColors = Record<string, string>;

export type PptExportSettings = {
  layout: 'LAYOUT_WIDE' | 'LAYOUT_STANDARD';
  /** How existing 16:9 slide content is scaled when the page ratio changes. */
  layoutContentMode?: 'maximize' | 'fit';
  branchMode: 'interactive' | 'linear' | 'all';
  density: 'oneNodePerSlide' | 'mergeShortDialogue';
  includeCover: boolean;
  includeNotes: boolean;
  speakerNotes?: Record<string, string>;
  /** Per-slide animation timelines. They are kept separate from visual render settings. */
  animations?: Record<string, PptObjectAnimation[]>;
  /** Per-slide page transitions, independent of object animations. */
  transitions?: Record<string, PptSlideTransition>;
  /** PPT-native video playback is configured per story slide and defaults to one pass. */
  videoLoopByScene?: Record<string, boolean>;
  /** Text edited in the PPT workspace without changing the source story cards. */
  textOverrides?: PptTextOverrides;
  /** Per-slide PPT text-box geometry, independent from the shared render style. */
  textBoxLayouts?: PptTextBoxLayouts;
  /** Elements inserted onto generated slides, instead of creating a separate manual slide. */
  slideElements?: PptSlideElements;
  /** Per-slide background fill overrides; they never change the shared web/render background. */
  slideBackgroundColors?: PptSlideBackgroundColors;
  /** Full current-slide background styles, independent from shared web settings. */
  slideBackgroundStyles?: PptSlideBackgroundStyles;
  /** Slides skipped during workspace playback and exported as hidden PowerPoint slides. */
  hiddenSlideIds?: string[];
  /** Slides removed only from this PPT arrangement; the source story cards stay untouched. */
  deletedSlideIds?: string[];
  /** User-created pages stay separate from story-generated slides and retain their own content. */
  manualSlides?: PptManualSlide[];
  /** A stable mixed sequence of generated and user-created slide ids. */
  slideOrder?: string[];
};

/** Snapshots used by the PPT workspace undo and redo controls. */
export type PptHistoryState = PptExportSettings;

export type RenderContextMenuTarget = {
  kind: 'asset' | 'timeline' | 'audio' | 'preview' | 'empty';
  nodeId?: string;
  selectedNodeIds?: string[];
  trackId?: string;
  trackKind?: 'video' | 'audio';
};

export type RenderContextMenuState = RenderContextMenuTarget & {
  x: number;
  y: number;
};

export type RenderContextMenuItem = {
  label: string;
  icon: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  danger?: boolean;
};

export type RenderContextMenuSection = {
  items: RenderContextMenuItem[];
};
