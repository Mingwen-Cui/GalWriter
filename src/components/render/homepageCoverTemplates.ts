/**
 * Built-in visual-novel homepage covers shared by Web and PPT.
 *
 * The preview and current fallback artwork are deliberately separate from the
 * editable layer folders. Once a template receives clean AI layers, the
 * `layers/01-background.png` asset can replace the fallback without changing
 * either workspace's preset contract.
 */
export type HomepageCoverTemplate = {
  id: 'sakura-campus' | 'rainy-station' | 'gothic-moon' | 'deepsea-sci-fi';
  name: string;
  description: string;
  accent: string;
  previewUrl: string;
  backgroundUrl: string;
  backgroundColor: string;
  aiPrompt: string;
};

const userContentSuffix = ' User content: [describe your story here]';

export const homepageCoverTemplates: HomepageCoverTemplate[] = [
  {
    id: 'sakura-campus',
    name: '樱花校园',
    description: '暖春校园、左侧标题安全区、右侧人物构图。',
    accent: '#fb7185',
    previewUrl: '/web-homepage/page1/效果.png',
    backgroundUrl: '/web-homepage/page1/效果.png',
    backgroundColor: '#d89093',
    aiPrompt:
      'Create a polished 16:9 visual-novel game cover layout in a warm Japanese anime illustration style. Build it as separable compositing layers, not a flattened poster. Reserve the left 42% as a quiet high-contrast title and menu safe area. Keep the main subject on the right half. Use soft spring daylight, pale pink blossoms, gentle depth of field, and elegant light particles. No text, letters, logo, watermark, UI buttons, or readable signage. Deliver a clean cinematic background with room for editable typography and controls.' +
      userContentSuffix,
  },
  {
    id: 'rainy-station',
    name: '雨夜列车',
    description: '深蓝雨夜、右侧竖向菜单安全区、左侧人物构图。',
    accent: '#22d3ee',
    previewUrl: '/web-homepage/page2/效果.png',
    backgroundUrl: '/web-homepage/page2/效果.png',
    backgroundColor: '#07111f',
    aiPrompt:
      'Create a polished 16:9 visual-novel game cover layout in a cinematic dark-blue anime illustration style. Build it as separable compositing layers, not a flattened poster. Reserve the right 38% as a quiet high-contrast title and vertical menu safe area. Place the main character on the left third with a rainy train platform and receding train in the middle distance. Use wet reflective pavement, cyan rim light, subtle red signal accents, and atmospheric rain. No text, numbers, clock, logo, watermark, UI buttons, or readable signage.' +
      userContentSuffix,
  },
  {
    id: 'gothic-moon',
    name: '哥特月夜',
    description: '暗黑哥特、中心右侧标题与菜单安全区。',
    accent: '#a78bfa',
    previewUrl: '/web-homepage/page3/ChatGPT%20Image%202026%E5%B9%B48%E6%9C%8816%E6%97%A5%2022_50_23%20(3).png',
    backgroundUrl: '/web-homepage/page3/ChatGPT%20Image%202026%E5%B9%B48%E6%9C%8816%E6%97%A5%2022_50_23%20(3).png',
    backgroundColor: '#0b0713',
    aiPrompt:
      'Create a polished 16:9 visual-novel game cover layout in a refined dark gothic anime illustration style. Build it as separable compositing layers, not a flattened poster. Reserve the center-right 40% as a clean title and vertical menu safe area framed by elegant non-text decorative borders. Place the main subject on the left third with a moonlit cathedral or palace interior. Use deep navy, black, wine-red accents, silver moonlight, roses, candlelight, velvet curtains, and ornate metallic framing. No text, letters, logo, watermark, UI buttons, or readable symbols.' +
      userContentSuffix,
  },
  {
    id: 'deepsea-sci-fi',
    name: '深海科幻',
    description: '深海舷窗、左侧标题与底部横向菜单安全区。',
    accent: '#60a5fa',
    previewUrl: '/web-homepage/page4/ChatGPT%20Image%202026%E5%B9%B48%E6%9C%8816%E6%97%A5%2022_50_23%20(4).png',
    backgroundUrl: '/web-homepage/page4/ChatGPT%20Image%202026%E5%B9%B48%E6%9C%8816%E6%97%A5%2022_50_23%20(4).png',
    backgroundColor: '#061639',
    aiPrompt:
      'Create a polished 16:9 visual-novel game cover layout in a luminous underwater science-fiction anime illustration style. Build it as separable compositing layers, not a flattened poster. Reserve the lower 24% as a clean horizontal menu safe area and the left 28% as a high-contrast vertical title safe area. Place the main subject on the right third inside a futuristic underwater observation room, with deep-sea city lights, jellyfish, distant machinery, and blue-violet luminous water outside the window. No text, letters, logo, watermark, UI buttons, or readable interface.' +
      userContentSuffix,
  },
];

export const getHomepageCoverTemplate = (id: string | null | undefined) =>
  homepageCoverTemplates.find((template) => template.id === id);

export const defaultVideoCoverAiPrompt =
  'Create a polished 16:9 visual-novel video cover as separable compositing layers rather than a flattened poster. Reserve a clear high-contrast title area and a separate menu-safe area, keep the main subject away from those areas, use cinematic lighting and a coherent anime illustration style. No text, letters, logo, watermark, UI buttons, or readable signage. Leave all narrative-specific details for the user to add.' +
  userContentSuffix;
