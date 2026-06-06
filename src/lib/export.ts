import type { CharacterNodeData, SceneImage, SceneNodeData } from '../domain/project';

/** 将人物设定节点 data 格式化为可导出的 Markdown 纯文本 */
export function formatCharacterNodeText(data: CharacterNodeData | Record<string, unknown>): string {
  const parts: string[] = [];

  const addSection = (label: string, value: unknown) => {
    const text = typeof value === 'string' ? value.trim() : '';
    if (text) parts.push(`**${label}**\n${text}`);
  };

  const useSplitTraits =
    !!data.showPersonality || !!data.showFeatures || !!data.showBackground || !!data.showOther;

  if (useSplitTraits) {
    if (data.showPersonality) addSection('性格', data.personality);
    if (data.showFeatures) addSection('人物特点', data.features);
    if (data.showBackground) addSection('人物背景', data.background);
    if (data.showOther) addSection('其他', data.other);
  } else {
    addSection('综合设定', data.traits);
  }

  const outfits = Array.isArray(data.outfits) ? (data.outfits as CharacterNodeData['outfits']) : [];
  if (outfits.length > 0) {
    const outfitLines = outfits.map((o) => `- ${(o.name || '未命名穿着').trim()}`).join('\n');
    parts.push(`**三视图 / 穿着**\n${outfitLines}`);
  }

  if (parts.length === 0) return '（暂无设定内容）';
  return parts.join('\n\n');
}

/** 将场景设定节点 data 格式化为可导出的 Markdown 纯文本 */
export function formatSceneNodeText(data: SceneNodeData | Record<string, unknown>): string {
  const parts: string[] = [];

  const addSection = (label: string, value: unknown) => {
    const text = typeof value === 'string' ? value.trim() : '';
    if (text) parts.push(`**${label}**\n${text}`);
  };

  const useSplitDetails =
    !!data.showLocation || !!data.showItems || !!data.showAtmosphere || !!data.showOther;

  if (useSplitDetails) {
    if (data.showLocation) addSection('位置描写', data.location);
    if (data.showItems) addSection('场景物品', data.items);
    if (data.showAtmosphere) addSection('氛围环境', data.atmosphere);
    if (data.showOther) addSection('其他', data.other);
  } else {
    addSection('综合描述', data.description);
  }

  const images = Array.isArray(data.images) ? (data.images as SceneImage[]) : [];
  if (images.length > 0) {
    const imageLines = images
      .map((img) => {
        const label = (img.name || '未命名图片').trim();
        return img.isPanorama ? `- ${label}（360°全景图）` : `- ${label}`;
      })
      .join('\n');
    parts.push(`**场景图片**\n${imageLines}`);
  }

  if (parts.length === 0) return '（暂无设定内容）';
  return parts.join('\n\n');
}

