export const CHARACTER_APPEARANCE_CANVAS = {
  // The modular preset PNGs are authored on this exact transparent canvas.
  // Rendering at the native size prevents a 2:3 resize from cutting off the
  // lower body or shifting the head relative to hair and clothing.
  width: 1024,
  height: 1820,
  faceAnchor: { x: 512, y: 512 },
} as const;

/** Close, upper-body crop used by the square front-portrait card. */
export const CHARACTER_APPEARANCE_PORTRAIT_CROP = {
  x: 208,
  y: 28,
  width: 608,
  height: 608,
} as const;

/** Bump this when the preset canvas/compositing contract changes. */
export const CHARACTER_APPEARANCE_SPRITE_VERSION = 'preset-v4-1024x1820';
const CHARACTER_APPEARANCE_ASSET_VERSION = '2026-08-12-v4';

export type AppearanceOption = {
  id: string;
  label: string;
  /** Exact public/ path used for the menu thumbnail and the front-most layer. */
  assetPath: string;
  /** Matching rear hair piece. Empty for legacy, single-piece hairstyles. */
  backAssetPath?: string;
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

const numberedOptions = (
  folder: string,
  prefix: string,
  count: number,
  label: string,
): AppearanceOption[] =>
  Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    return {
      id: `${prefix}${number}`,
      label: `${label} ${number}`,
      assetPath: `${folder}/${prefix}${number}.png`,
    };
  });

const pairedHairOptions = (folder: string, count: number, label: string): AppearanceOption[] =>
  Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    return {
      id: `hair${number}`,
      label: `${label} ${number}`,
      assetPath: `${folder}/hair${number}f.png`,
      backAssetPath: `${folder}/hair${number}b.png`,
    };
  });

// The female source pack has two legacy, incomplete layers: hair3 only has a
// front piece and hair4 only has a rear piece. Keep the usable single-layer
// hair3 style, but do not expose hair4 as a selectable style because it cannot
// produce a complete head.
const femaleHairOptions: AppearanceOption[] = [
  1,
  2,
  3,
  5,
  6,
  7,
  8,
  9,
].map((number) => ({
  id: `hair${number}`,
  label: `发型 ${number}`,
  assetPath: `presets/characters/female/hair/hair${number}f.png`,
  ...(number === 3
    ? {}
    : { backAssetPath: `presets/characters/female/hair/hair${number}b.png` }),
}));

export const DEMO_APPEARANCE_CATALOG: CharacterAppearanceCatalog = {
  characterId: 'avatar',
  gender: 'female',
  installed: true,
  assetRoot: 'presets/characters/female',
  // Current full-canvas face layers. Retired smile/angry/sad files were
  // removed, but their stale paths could still appear in browser caches.
  faces: [
    {
      id: 'neutral',
      label: '\u5e73\u9759',
      assetPath: 'presets/characters/female/face/neutral.png',
    },
    { id: 'face3', label: '\u9762\u90e8 2', assetPath: 'presets/characters/female/face/face3.png' },
    { id: 'face4', label: '\u9762\u90e8 3', assetPath: 'presets/characters/female/face/face4.png' },
    { id: 'face5', label: '\u9762\u90e8 4', assetPath: 'presets/characters/female/face/face5.png' },
    {
      id: 'face6',
      label: '\u9762\u90e8 5',
      assetPath: 'presets/characters/female/face/face6 2.png',
    },
    {
      id: 'face7',
      label: '\u9762\u90e8 6',
      assetPath: 'presets/characters/female/face/face7 2.png',
    },
    {
      id: 'face8',
      label: '\u9762\u90e8 7',
      assetPath: 'presets/characters/female/face/face8 2.png',
    },
    {
      id: 'neutral3',
      label: '\u9762\u90e8 8',
      assetPath: 'presets/characters/female/face/neutral 3.png',
    },
    {
      id: 'neutral4',
      label: '\u9762\u90e8 9',
      assetPath: 'presets/characters/female/face/neutral 4.png',
    },
  ],
  hairs: femaleHairOptions,
  outfits: [
    {
      id: 'school',
      label: '\u6821\u670d',
      assetPath: 'presets/characters/female/cloth/school.png',
    },
    {
      id: 'hoodie',
      label: '\u8fde\u5e3d\u886b',
      assetPath: 'presets/characters/female/cloth/hoodie.png',
    },
    {
      id: 'jacket',
      label: '\u5939\u514b',
      assetPath: 'presets/characters/female/cloth/jacket.png',
    },
    {
      id: 'knit',
      label: '\u9488\u7ec7\u886b',
      assetPath: 'presets/characters/female/cloth/knit.png',
    },
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
  faces: numberedOptions('presets/characters/male/face', 'face', 4, '\u8111\u888b'),
  // Male and female templates use the same paired rear/front hair contract.
  hairs: pairedHairOptions('presets/characters/male/hair', 7, '\u53d1\u578b'),
  outfits: numberedOptions('presets/characters/male/cloth', 'cloth', 9, '\u670d\u88c5'),
};

export const CHARACTER_APPEARANCE_CATALOGS: Record<
  CharacterAppearanceGender,
  CharacterAppearanceCatalog
> = {
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
  /** The foreground lock/bangs. `hairAssetPath` stays as a compatibility alias. */
  hairAssetPath: string;
  frontHairAssetPath: string;
  backHairAssetPath: string;
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
  const outfit =
    catalog.outfits.find((option) => option.id === selection?.outfitId) || catalog.outfits[0];

  return {
    characterId: catalog.characterId,
    gender,
    assetRoot: catalog.assetRoot,
    faceId: face?.id || '',
    hairId: hair?.id || '',
    outfitId: outfit?.id || '',
    faceAssetPath: face?.assetPath || '',
    hairAssetPath: hair?.assetPath || '',
    frontHairAssetPath: hair?.assetPath || '',
    backHairAssetPath: hair?.backAssetPath || '',
    outfitAssetPath: outfit?.assetPath || '',
    colors: defaultColors,
    faceTransform: { offsetX: 0, offsetY: 0, scale: 1 },
  };
};

export const createDemoCharacterAppearance = () => createCharacterAppearance('female');

export type AppearanceLayer = {
  id: 'backHair' | 'head' | 'outfit' | 'frontHair';
  url: string;
};

export const getCharacterAppearanceAssetUrl = (assetPath: string) =>
  `${import.meta.env.BASE_URL}${assetPath.replace(/^\/+/, '')}?v=${CHARACTER_APPEARANCE_ASSET_VERSION}`;

/**
 * Modular PNGs share one coordinate space: back hair → clothing → head with
 * expression → front hair. This avoids the independent head-crop alignment
 * that made the previous assets drift apart.
 */
export const resolveAppearanceLayers = (appearance: CharacterAppearance): AppearanceLayer[] => [
  ...(appearance.backHairAssetPath
    ? [
        {
          id: 'backHair' as const,
          url: getCharacterAppearanceAssetUrl(appearance.backHairAssetPath),
        },
      ]
    : []),
  { id: 'outfit', url: getCharacterAppearanceAssetUrl(appearance.outfitAssetPath) },
  { id: 'head', url: getCharacterAppearanceAssetUrl(appearance.faceAssetPath) },
  { id: 'frontHair', url: getCharacterAppearanceAssetUrl(appearance.frontHairAssetPath) },
];

export const getCharacterAppearanceAssetUrls = (appearance: CharacterAppearance) =>
  resolveAppearanceLayers(appearance).map((layer) => layer.url);

export const CHARACTER_APPEARANCE_ASSET_GUIDE = `${import.meta.env.BASE_URL}assets/character-appearance/ASSET_GUIDE.md`;
