export const CHARACTER_APPEARANCE_CANVAS = {
  width: 2048,
  height: 3072,
  faceAnchor: { x: 1024, y: 1024 },
} as const;

export type AppearanceOption = {
  id: string;
  label: string;
  /** Exact public/ path. Face, hair and clothing may live in separate folders. */
  assetPath: string;
};

export type CharacterAppearanceGender = 'female' | 'male';

export type AppearanceAdjustment = {
  hairX: number;
  hairY: number;
  hairScale: number;
  spriteHeadX: number;
  spriteHeadY: number;
  spriteHeadScale: number;
};

export const DEFAULT_APPEARANCE_ADJUSTMENT: AppearanceAdjustment = {
  hairX: 0,
  hairY: 0,
  hairScale: 100,
  spriteHeadX: 0,
  spriteHeadY: 0,
  spriteHeadScale: 100,
};

export type CharacterAppearanceCatalog = {
  characterId: string;
  gender: CharacterAppearanceGender;
  installed: boolean;
  assetRoot: string;
  faces: AppearanceOption[];
  hairs: AppearanceOption[];
  outfits: AppearanceOption[];
};

const numberedOptions = (folder: string, prefix: string, count: number, label: string): AppearanceOption[] =>
  Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    return {
      id: `${prefix}${number}`,
      label: `${label} ${number}`,
      assetPath: `${folder}/${prefix}${number}.png`,
    };
  });

export const DEMO_APPEARANCE_CATALOG: CharacterAppearanceCatalog = {
  characterId: 'avatar',
  gender: 'female',
  installed: true,
  assetRoot: 'presets/characters/female',
  faces: [
    { id: 'neutral', label: '\u5e73\u9759', assetPath: 'presets/characters/female/face/neutral.png' },
    { id: 'smile', label: '\u5fae\u7b11', assetPath: 'presets/characters/female/face/smile.png' },
    { id: 'angry', label: '\u751f\u6c14', assetPath: 'presets/characters/female/face/angry.png' },
    { id: 'sad', label: '\u96be\u8fc7', assetPath: 'presets/characters/female/face/sad.png' },
  ],
  hairs: numberedOptions('presets/characters/female/hair', 'hair', 12, '\u53d1\u578b'),
  outfits: [
    { id: 'school', label: '\u6821\u670d', assetPath: 'presets/characters/female/cloth/school.png' },
    { id: 'hoodie', label: '\u8fde\u5e3d\u886b', assetPath: 'presets/characters/female/cloth/hoodie.png' },
    { id: 'jacket', label: '\u5939\u514b', assetPath: 'presets/characters/female/cloth/jacket.png' },
    { id: 'knit', label: '\u9488\u7ec7\u886b', assetPath: 'presets/characters/female/cloth/knit.png' },
    ...[1, 2, 3, 4, 5, 8, 9, 10, 11, 12].map((number) => ({
      id: `cloth${number}`,
      label: `\u670d\u88c5 ${number}`,
      assetPath: `presets/characters/female/cloth/cloth${number}.png`,
    })),
  ],
};

export const MALE_APPEARANCE_CATALOG: CharacterAppearanceCatalog = {
  characterId: 'avatar',
  gender: 'male',
  installed: true,
  assetRoot: 'presets/characters/male',
  faces: numberedOptions('presets/characters/male', 'face', 4, '\u8868\u60c5'),
  hairs: numberedOptions('presets/characters/male', 'hair', 7, '\u53d1\u578b'),
  outfits: numberedOptions('presets/characters/male', 'cloth', 9, '\u670d\u88c5'),
};

export const CHARACTER_APPEARANCE_CATALOGS: Record<CharacterAppearanceGender, CharacterAppearanceCatalog> = {
  female: DEMO_APPEARANCE_CATALOG,
  male: MALE_APPEARANCE_CATALOG,
};

export const getCharacterAppearanceCatalog = (gender: CharacterAppearanceGender) =>
  CHARACTER_APPEARANCE_CATALOGS[gender];

export type CharacterAppearance = {
  characterId: string;
  gender: CharacterAppearanceGender;
  assetRoot: string;
  faceId: string;
  hairId: string;
  outfitId: string;
  faceAssetPath: string;
  hairAssetPath: string;
  outfitAssetPath: string;
  colors: { primary: string; secondary: string; accent: string; skin: string; hair: string };
  faceTransform: { offsetX: number; offsetY: number; scale: number };
};

const defaultColors = {
  primary: '#2d6fb7',
  secondary: '#f3c969',
  accent: '#d75b7c',
  skin: '#f0bf9b',
  hair: '#273252',
};

export const createCharacterAppearance = (
  gender: CharacterAppearanceGender,
  selection?: Partial<Pick<CharacterAppearance, 'faceId' | 'hairId' | 'outfitId'>>,
): CharacterAppearance => {
  const catalog = getCharacterAppearanceCatalog(gender);
  const face = catalog.faces.find((option) => option.id === selection?.faceId) || catalog.faces[0];
  const hair = catalog.hairs.find((option) => option.id === selection?.hairId) || catalog.hairs[0];
  const outfit = catalog.outfits.find((option) => option.id === selection?.outfitId) || catalog.outfits[0];

  return {
    characterId: catalog.characterId,
    gender,
    assetRoot: catalog.assetRoot,
    faceId: face?.id || '',
    hairId: hair?.id || '',
    outfitId: outfit?.id || '',
    faceAssetPath: face?.assetPath || '',
    hairAssetPath: hair?.assetPath || '',
    outfitAssetPath: outfit?.assetPath || '',
    colors: defaultColors,
    faceTransform: { offsetX: 0, offsetY: 0, scale: 1 },
  };
};

export const createDemoCharacterAppearance = () => createCharacterAppearance('female');

export type AppearanceLayer = {
  id: 'face' | 'outfit' | 'hair';
  url: string;
};

export const getCharacterAppearanceAssetUrl = (assetPath: string) =>
  `${import.meta.env.BASE_URL}${assetPath.replace(/^\/+/, '')}`;

/** Full-color layers share the same canvas: face first, outfit second, hair last. */
export const resolveAppearanceLayers = (appearance: CharacterAppearance): AppearanceLayer[] => [
  { id: 'face', url: getCharacterAppearanceAssetUrl(appearance.faceAssetPath) },
  { id: 'outfit', url: getCharacterAppearanceAssetUrl(appearance.outfitAssetPath) },
  { id: 'hair', url: getCharacterAppearanceAssetUrl(appearance.hairAssetPath) },
];

export const CHARACTER_APPEARANCE_ASSET_GUIDE = `${import.meta.env.BASE_URL}assets/character-appearance/ASSET_GUIDE.md`;
