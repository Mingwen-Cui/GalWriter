export type LanguageCode = 'zh' | 'en';

export type GeneratedCharacterSetting = {
  characterName?: string;
  personality?: string;
  features?: string;
  background?: string;
  other?: string;
  traits?: string;
};

export type GeneratedSceneSetting = {
  sceneName?: string;
  location?: string;
  items?: string;
  atmosphere?: string;
  other?: string;
  description?: string;
};

const asText = (value: unknown) => typeof value === 'string' ? value.trim() : '';

const joinContext = (entries: Array<[string, unknown]>) => {
  const lines = entries
    .map(([label, value]) => {
      const text = asText(value);
      return text ? `${label}: ${text}` : '';
    })
    .filter(Boolean);

  return lines.length > 0 ? lines.join('\n') : 'No usable information yet.';
};

export const hasUsefulCharacterInfo = (data: Record<string, unknown>) =>
  [
    data.characterName,
    data.traits,
    data.personality,
    data.features,
    data.background,
    data.other,
  ].some((value) => asText(value).length > 0);

export const hasUsefulSceneInfo = (data: Record<string, unknown>) =>
  [
    data.sceneName,
    data.description,
    data.location,
    data.items,
    data.atmosphere,
    data.other,
  ].some((value) => asText(value).length > 0);

export const buildCharacterSettingPrompt = (data: Record<string, unknown>, lang: LanguageCode) => {
  const useExisting = hasUsefulCharacterInfo(data);
  const context = joinContext([
    ['Name', data.characterName],
    ['General setting', data.traits],
    ['Personality', data.personality],
    ['Character features', data.features],
    ['Background', data.background],
    ['Other', data.other],
  ]);
  const outputLanguage = lang === 'zh' ? 'Simplified Chinese' : 'English';

  return `You are a visual novel character designer.
Task: ${useExisting ? 'expand the available character information into a richer, coherent setting' : 'randomly create a fresh character setting'}.
Output language: ${outputLanguage}.
Preserve any usable existing details. Do not contradict them. Make the result specific, vivid, and directly usable in a galgame/visual novel project.

Available information:
${context}

Return ONLY valid JSON, with no markdown fences and no extra text.
JSON keys:
{
  "characterName": "short name",
  "personality": "detailed personality description",
  "features": "appearance, habits, memorable traits",
  "background": "origin, relationships, motivation, conflict",
  "other": "extra useful notes",
  "traits": "a complete integrated setting that combines the above"
}`;
};

export const buildSceneSettingPrompt = (data: Record<string, unknown>, lang: LanguageCode) => {
  const useExisting = hasUsefulSceneInfo(data);
  const context = joinContext([
    ['Name', data.sceneName],
    ['General description', data.description],
    ['Location', data.location],
    ['Items', data.items],
    ['Atmosphere', data.atmosphere],
    ['Other', data.other],
  ]);
  const outputLanguage = lang === 'zh' ? 'Simplified Chinese' : 'English';

  return `You are a visual novel scene designer.
Task: ${useExisting ? 'expand the available scene information into a richer, coherent setting' : 'randomly create a fresh scene setting'}.
Output language: ${outputLanguage}.
Preserve any usable existing details. Do not contradict them. Make the result specific, sensory, and directly usable in a galgame/visual novel project.

Available information:
${context}

Return ONLY valid JSON, with no markdown fences and no extra text.
JSON keys:
{
  "sceneName": "short scene name",
  "location": "detailed location description",
  "items": "important objects and interactable details",
  "atmosphere": "light, sound, smell, mood, time, weather",
  "other": "extra useful notes",
  "description": "a complete integrated scene description that combines the above"
}`;
};

export function parseSettingJson<T extends Record<string, unknown>>(text: string): T {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI did not return JSON.');
  }

  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

export const buildCharacterUpdates = (
  data: Record<string, unknown>,
  generated: GeneratedCharacterSetting
) => {
  const updates: Record<string, unknown> = {};

  if (asText(generated.characterName)) {
    updates.characterName = asText(generated.characterName);
  }

  if (asText(generated.personality)) {
    updates.showPersonality = true;
    updates.personality = asText(generated.personality);
  }

  if (asText(generated.features)) {
    updates.showFeatures = true;
    updates.features = asText(generated.features);
  }

  if (asText(generated.background)) {
    updates.showBackground = true;
    updates.background = asText(generated.background);
  }

  if (asText(generated.other)) {
    updates.showOther = true;
    updates.other = asText(generated.other);
  }

  if (asText(generated.traits)) {
    updates.traits = asText(generated.traits);
  }

  return updates;
};

export const buildSceneUpdates = (
  data: Record<string, unknown>,
  generated: GeneratedSceneSetting
) => {
  const updates: Record<string, unknown> = {};

  if (asText(generated.sceneName)) {
    updates.sceneName = asText(generated.sceneName);
  }

  if (asText(generated.location)) {
    updates.showLocation = true;
    updates.location = asText(generated.location);
  }

  if (asText(generated.items)) {
    updates.showItems = true;
    updates.items = asText(generated.items);
  }

  if (asText(generated.atmosphere)) {
    updates.showAtmosphere = true;
    updates.atmosphere = asText(generated.atmosphere);
  }

  if (asText(generated.other)) {
    updates.showOther = true;
    updates.other = asText(generated.other);
  }

  if (asText(generated.description)) {
    updates.description = asText(generated.description);
  }

  return updates;
};
