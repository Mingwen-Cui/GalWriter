import type {
  CharacterPresentation,
  PresentationAnimation,
  PresentationMotion,
  ScenePresentation,
  StoryPresentation,
} from '../domain/project';

export const MIN_CHARACTER_LAYER = 1;
export const MAX_CHARACTER_LAYER = 20;

export const clampCharacterLayer = (value: number | undefined) =>
  Math.min(
    MAX_CHARACTER_LAYER,
    Math.max(MIN_CHARACTER_LAYER, Number.isFinite(value) ? Math.round(value!) : 1),
  );

export const createPresentationMotion = (
  type: PresentationAnimation,
  duration = 500,
): PresentationMotion => ({ type, duration });

export const createCharacterPresentation = (
  sourceNodeId: string,
  linkedByEdge = false,
): CharacterPresentation => ({
  sourceNodeId,
  linkedByEdge,
  position: 'center',
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  flipX: false,
  layer: MIN_CHARACTER_LAYER,
  enter: createPresentationMotion('none', 0),
  exit: createPresentationMotion('none', 0),
});

export const createScenePresentation = (
  sourceNodeId: string,
  previousImageUrl?: string,
  linkedByEdge = false,
  previousShowTextOverlay?: boolean,
): ScenePresentation => ({
  sourceNodeId,
  linkedByEdge,
  cropMode: 'contain',
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  videoStartTime: 0,
  videoLoop: false,
  videoMaxDuration: 30,
  enter: createPresentationMotion('none', 0),
  exit: createPresentationMotion('none', 0),
  previousImageUrl,
  previousShowTextOverlay,
});

export const normalizeStoryPresentation = (
  value: StoryPresentation | undefined,
): StoryPresentation => ({
  scene: value?.scene,
  characters: Array.isArray(value?.characters) ? value.characters : [],
});

export const getCharacterStagePosition = (config: CharacterPresentation) => {
  const basePosition = config.position === 'left' ? 24 : config.position === 'right' ? 76 : 50;
  return {
    left: `calc(${basePosition}% + ${config.offsetX / 10}%)`,
    bottom: `${config.offsetY / 10}%`,
  };
};

type CharacterPresentationSettings = Omit<
  CharacterPresentation,
  'sourceNodeId' | 'linkedByEdge' | 'outfitId'
>;
type ScenePresentationSettings = Omit<
  ScenePresentation,
  | 'sourceNodeId'
  | 'linkedByEdge'
  | 'imageId'
  | 'previousImageUrl'
  | 'previousShowTextOverlay'
  | 'previousVideoUrl'
>;

let characterPresentationClipboard: CharacterPresentationSettings | null = null;
let scenePresentationClipboard: ScenePresentationSettings | null = null;

export const copyCharacterPresentationSettings = (config: CharacterPresentation) => {
  const {
    sourceNodeId: _sourceNodeId,
    linkedByEdge: _linkedByEdge,
    outfitId: _outfitId,
    ...settings
  } = config;
  characterPresentationClipboard = structuredClone(settings);
};

export const pasteCharacterPresentationSettings = (
  current: CharacterPresentation,
): CharacterPresentation =>
  characterPresentationClipboard
    ? { ...current, ...structuredClone(characterPresentationClipboard) }
    : current;

export const hasCharacterPresentationClipboard = () => characterPresentationClipboard !== null;

export const copyScenePresentationSettings = (config: ScenePresentation) => {
  const {
    sourceNodeId: _sourceNodeId,
    linkedByEdge: _linkedByEdge,
    imageId: _imageId,
    previousImageUrl: _previousImageUrl,
    previousVideoUrl: _previousVideoUrl,
    previousShowTextOverlay: _previousShowTextOverlay,
    ...settings
  } = config;
  scenePresentationClipboard = structuredClone(settings);
};

export const pasteScenePresentationSettings = (current: ScenePresentation): ScenePresentation =>
  scenePresentationClipboard
    ? { ...current, ...structuredClone(scenePresentationClipboard) }
    : current;

export const hasScenePresentationClipboard = () => scenePresentationClipboard !== null;

export const getPresentationMotionDuration = (motion: PresentationMotion | undefined) =>
  motion && motion.type !== 'none' ? Math.max(0, motion.duration || 0) : 0;

export const getCharacterEnterDelay = (presentation: StoryPresentation) =>
  getPresentationMotionDuration(presentation.scene?.enter);

export const getSceneExitDelay = (presentation: StoryPresentation) =>
  Math.max(
    0,
    ...presentation.characters.map((character) => getPresentationMotionDuration(character.exit)),
  );

export const getPresentationExitDuration = (presentation: StoryPresentation) =>
  getSceneExitDelay(presentation) + getPresentationMotionDuration(presentation.scene?.exit);

export const getPresentationTransform = (animation: PresentationAnimation, exiting: boolean) => {
  const distance = exiting ? 120 : 100;
  if (animation === 'slide-left') return `translateX(${exiting ? -distance : distance}%)`;
  if (animation === 'slide-right') return `translateX(${exiting ? distance : -distance}%)`;
  if (animation === 'slide-up') return `translateY(${exiting ? -distance : distance}%)`;
  if (animation === 'slide-down') return `translateY(${exiting ? distance : -distance}%)`;
  if (animation === 'zoom') return 'scale(0.82)';
  return 'none';
};
