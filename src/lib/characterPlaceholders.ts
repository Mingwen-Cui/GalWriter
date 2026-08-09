export const CHARACTER_PLACEHOLDER_IDS = [
  'arc',
  'veil',
  'frame',
  'cloak',
  'flare',
  'compact',
] as const;

export type CharacterPlaceholderId = (typeof CHARACTER_PLACEHOLDER_IDS)[number];

const isPlaceholderId = (value: unknown): value is CharacterPlaceholderId =>
  typeof value === 'string' && (CHARACTER_PLACEHOLDER_IDS as readonly string[]).includes(value);

const hashCharacterId = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

/**
 * A chosen ID is persisted, while existing image-less characters get a stable
 * fallback based on their node ID without having to migrate project data.
 */
export const getCharacterPlaceholderId = (
  nodeId: string | undefined,
  selectedId?: unknown,
): CharacterPlaceholderId => {
  if (isPlaceholderId(selectedId)) return selectedId;
  return CHARACTER_PLACEHOLDER_IDS[hashCharacterId(nodeId || 'new-character') % CHARACTER_PLACEHOLDER_IDS.length];
};

type Silhouette = {
  head: string;
  bust: string;
  body: string;
  accent: string;
};

const silhouettes: Record<CharacterPlaceholderId, Silhouette> = {
  arc: {
    head: '<path d="M239 345c-16-177 43-286 159-286 117 0 177 109 160 286l-51-34-25 65H316l-25-65Z"/><ellipse cx="400" cy="214" rx="92" ry="111" fill="#273750"/><path d="M245 255c31-33 67-49 108-49 61 0 107 34 145 101l-22-149c-91-77-192-36-231 97Z"/>',
    bust: '<path d="M94 724c31-139 84-235 162-285l83-59h122l92 59c78 50 131 146 153 285Z"/><path fill="#263650" d="m164 724 80-182 92 65 64-93 75 93 94-65 67 182Z"/><path d="M234 724 318 519l83 49 83-49 86 205Z"/>',
    body: '<path d="M138 1296 160 780c9-214 92-368 206-368 85 0 140 42 184 124l79 147 59 613Z"/><path d="M155 1296 86 1050l78-298 100 83-15 461Z"/><path d="m645 1296 86-240-110-244-95 95 58 389Z"/><path fill="#263650" d="m284 1296 33-548 83-121 92 121 37 548Z"/><path d="M275 460 400 624l126-164-33 339-93-96-93 96Z"/><path d="M252 403c-20-208 44-332 148-332s168 124 148 332l-55-55-93 56-92-56Z"/><ellipse cx="400" cy="229" rx="106" ry="126" fill="#273750"/>',
    accent: '#6f83a6',
  },
  veil: {
    head: '<path d="M208 389c-2-231 71-332 193-332 120 0 194 101 191 332l-68-79-5 153H301l-5-153Z"/><ellipse cx="402" cy="224" rx="86" ry="112" fill="#25344d"/><path d="M244 250c44-70 96-93 154-93 74 0 132 41 177 125l-34-157C439 35 289 76 244 250Z"/>',
    bust: '<path d="M69 724c36-157 112-269 222-324l71-38h75l69 38c114 55 190 167 225 324Z"/><path fill="#26344f" d="M150 724c41-116 92-186 151-209l99 103 103-103c55 23 106 93 150 209Z"/><path d="M211 724c11-115 47-191 111-230l78 130 80-130c67 39 104 115 112 230Z"/>',
    body: '<path d="m85 1296 70-562c28-200 117-330 246-330 128 0 217 130 244 330l70 562Z"/><path d="m85 1296 54-188 51-420 95 155-67 453Z"/><path d="m715 1296-60-198-53-414-94 159 77 453Z"/><path fill="#26344f" d="m251 1296 62-574 87-118 87 118 63 574Z"/><path d="M216 407c-6-239 69-349 184-349 116 0 191 110 184 349l-74-87-8 147H298l-8-147Z"/><ellipse cx="402" cy="240" rx="104" ry="130" fill="#25344d"/><path d="m265 457 135 168 137-168-46 329-91-93-92 93Z"/>',
    accent: '#8b769d',
  },
  frame: {
    head: '<path d="m273 83 127-47 131 47 61 131-63 169H271l-63-169Z"/><ellipse cx="400" cy="213" rx="87" ry="107" fill="#23364c"/><path d="m273 88 127-48 131 48-21 105-110-42-109 42Z"/>',
    bust: '<path d="M38 724 139 495l139-102h244l139 102 101 229Z"/><path fill="#23364c" d="m126 724 74-163 105 72 95-102 97 102 104-72 75 163Z"/><path d="m251 724 52-173 97 78 99-78 52 173Z"/>',
    body: '<path d="m80 1296 74-555 125-313h242l125 313 74 555Z"/><path d="m80 1296 34-269 52-312 133 139-71 442Z"/><path d="m720 1296-34-269-52-312-133 139 71 442Z"/><path fill="#23364c" d="m279 1296 21-513 100-154 100 154 21 513Z"/><path d="m201 490 101 85 98-123 99 123 102-85-80 230-121-73-121 73Z"/><path d="m255 78 145-52 145 52 58 140-70 188H267l-70-188Z"/><ellipse cx="400" cy="221" rx="105" ry="128" fill="#23364c"/>',
    accent: '#5d93a2',
  },
  cloak: {
    head: '<path d="M202 401c16-248 87-355 198-355s182 107 198 355l-85-61-17 151H304l-17-151Z"/><ellipse cx="400" cy="233" rx="79" ry="103" fill="#26354e"/><path d="M209 402c26-95 75-161 144-190l47 56 48-56c69 29 118 95 144 190l-80-66-112 61-111-61Z"/>',
    bust: '<path d="M35 724 143 487c68-90 154-137 257-137 104 0 190 47 257 137l108 237Z"/><path fill="#26354e" d="M128 724c40-124 94-202 162-235l110 121 111-121c69 33 123 111 161 235Z"/><path d="m207 724 79-185 114 95 115-95 78 185Z"/>',
    body: '<path d="m39 1296 85-454 69-256c46-179 123-287 207-287s161 108 207 287l69 256 85 454Z"/><path d="m39 1296 51-197 106-302 90 179-105 320Z"/><path d="m761 1296-51-197-106-302-90 179 105 320Z"/><path fill="#26354e" d="m215 1296 76-497 109-136 109 136 76 497Z"/><path d="m200 448c14-262 87-402 200-402s186 140 200 402l-91-91-109 75-108-75Z"/><ellipse cx="400" cy="244" rx="104" ry="132" fill="#26354e"/><path d="m267 502 133 159 134-159-48 369-86-107-85 107Z"/>',
    accent: '#747ca9',
  },
  flare: {
    head: '<path d="M179 309c21-188 94-273 218-273 87 0 151 43 192 129l91 29-89 74 4 120-87-63-108 58-111-58-84 63Z"/><ellipse cx="400" cy="213" rx="84" ry="108" fill="#2a354d"/><path d="M221 254c48-85 108-112 179-112 74 0 134 32 181 96l-24-116C445 8 283 71 221 254Z"/>',
    bust: '<path d="M60 724c28-154 100-256 216-307l104-43 20 72 20-72 104 43c116 51 188 153 216 307Z"/><path fill="#2a354d" d="m147 724 69-157 107 81 77-107 77 107 108-81 68 157Z"/><path d="m214 724 88-174 98 89 99-89 88 174Z"/>',
    body: '<path d="m90 1296 43-499c18-218 110-368 267-368s249 150 267 368l43 499Z"/><path d="m90 1296 44-257 52-305 109 154-54 408Z"/><path d="m710 1296-44-257-52-305-109 154 54 408Z"/><path fill="#2a354d" d="m252 1296 34-528 114-142 114 142 34 528Z"/><path d="m210 426c14-196 81-313 190-313 81 0 141 43 180 129l101 36-93 74-8 112-80-64-100 67-100-67-79 64-8-112-92-74Z"/><ellipse cx="400" cy="225" rx="104" ry="127" fill="#2a354d"/><path d="m253 471 147 162 148-162-57 351-91-109-90 109Z"/>',
    accent: '#a07892',
  },
  compact: {
    head: '<path d="M259 356c-7-185 45-300 141-300 95 0 148 115 141 300l-62-45-11 96H332l-11-96Z"/><ellipse cx="400" cy="230" rx="78" ry="103" fill="#25374e"/><path d="m293 165 54-87 55 55 52-55 55 87-38 127-71-33-71 33Z"/>',
    bust: '<path d="M123 724c22-139 98-239 215-282l62-25 62 25c117 43 193 143 215 282Z"/><path fill="#25374e" d="m198 724 57-137 89 65 56-74 56 74 89-65 57 137Z"/><path d="m245 724 59-132 96 84 97-84 58 132Z"/>',
    body: '<path d="m141 1296 29-500c12-211 97-347 230-347s218 136 230 347l29 500Z"/><path d="m141 1296 31-253 40-296 106 137-35 412Z"/><path d="m659 1296-31-253-40-296-106 137 35 412Z"/><path fill="#25374e" d="m267 1296 22-522 111-126 111 126 22 522Z"/><path d="M254 414c-10-218 45-357 146-357s156 139 146 357l-67-67-79 60-79-60Z"/><ellipse cx="400" cy="241" rx="103" ry="130" fill="#25374e"/><path d="m281 466 119 145 120-145-45 322-75-88-74 88Z"/>',
    accent: '#688d91',
  },
};

const svgDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

const avatarSvg = ({ head, bust, accent }: Silhouette) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#18233a"/><stop offset="1" stop-color="#0d1321"/></linearGradient>
    <radialGradient id="glow" cx="50%" cy="34%" r="70%"><stop stop-color="${accent}" stop-opacity=".42"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="800" height="800" fill="url(#bg)"/>
  <rect width="800" height="800" fill="url(#glow)"/>
  <g fill="#34445f" stroke="${accent}" stroke-opacity=".72" stroke-width="9" stroke-linejoin="round">${bust}${head}</g>
</svg>`;

const spriteSvg = ({ body, accent }: Silhouette) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1400">
  <g fill="#34445f" stroke="${accent}" stroke-opacity=".75" stroke-width="12" stroke-linejoin="round">${body}</g>
</svg>`;

export const getCharacterPlaceholderAvatarUrl = (id: CharacterPlaceholderId) =>
  svgDataUrl(avatarSvg(silhouettes[id]));

export const getCharacterPlaceholderSpriteUrl = (id: CharacterPlaceholderId) =>
  svgDataUrl(spriteSvg(silhouettes[id]));

export const CHARACTER_PLACEHOLDER_OPTIONS =
  CHARACTER_PLACEHOLDER_IDS.map((id) => ({
    id,
    avatarUrl: getCharacterPlaceholderAvatarUrl(id),
    spriteUrl: getCharacterPlaceholderSpriteUrl(id),
  }));
