export type LanguageCode = 'zh' | 'en' | 'ja';

export type GeneratedCharacterSetting = {
  characterName?: string;
  identity?: string;
  appearance?: string;
  personality?: string;
  habits?: string;
  speechStyle?: string;
  experience?: string;
  relationships?: string;
  notes?: string;
};

export type GeneratedSceneSetting = {
  sceneName?: string;
  location?: string;
  time?: string;
  weather?: string;
  visual?: string;
  sound?: string;
  items?: string;
  notes?: string;
};

const asText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

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
    data.identity,
    data.appearance,
    data.traits,
    data.personality,
    data.habits,
    data.speechStyle,
    data.experience,
    data.relationships,
    data.notes,
    data.features,
    data.background,
    data.other,
  ].some((value) => asText(value).length > 0);

export const hasUsefulSceneInfo = (data: Record<string, unknown>) =>
  [
    data.sceneName,
    data.location,
    data.time,
    data.weather,
    data.visual,
    data.sound,
    data.items,
    data.notes,
    data.description,
    data.atmosphere,
    data.other,
  ].some((value) => asText(value).length > 0);

export const buildCharacterSettingPrompt = (data: Record<string, unknown>, lang: LanguageCode) => {
  const useExisting = hasUsefulCharacterInfo(data);
  const context = joinContext([
    ['Name', data.characterName],
    ['Identity', data.identity],
    ['Appearance', data.appearance || data.features],
    ['Personality', data.personality],
    ['Habits', data.habits],
    ['Speech style', data.speechStyle],
    ['Past experience', data.experience || data.background],
    ['Relationships', data.relationships],
    ['Notes', data.notes || data.other || data.traits],
  ]);
  const outputLanguage =
    lang === 'zh' ? 'Simplified Chinese' : lang === 'ja' ? 'Japanese' : 'English';

  return `You are a visual novel character designer.
Task: ${useExisting ? 'fill in the missing parts of this character profile without changing the usable existing details' : 'create a fresh, distinct character profile'}.
Output language: ${outputLanguage}.
Preserve any usable existing details. Do not contradict them. Keep every field short and concrete: one or two sentences at most. Describe the person only; do not add plot, scene events, goals, conflicts, or story development.

Available information:
${context}

Return ONLY valid JSON, with no markdown fences and no extra text.
JSON keys:
{
  "characterName": "short name",
  "identity": "age, occupation, or social identity",
  "appearance": "appearance and usual clothing",
  "personality": "personality",
  "habits": "small habits or usual reactions",
  "speechStyle": "how this person speaks",
  "experience": "one or two concise past experiences",
  "relationships": "basic relationship notes with important people",
  "notes": "other stable personal details"
}`;
};

export const buildSceneSettingPrompt = (data: Record<string, unknown>, lang: LanguageCode) => {
  const useExisting = hasUsefulSceneInfo(data);
  const context = joinContext([
    ['Name', data.sceneName],
    ['Location', data.location],
    ['Time', data.time],
    ['Weather', data.weather],
    ['Visual details', data.visual || data.description],
    ['Sound', data.sound],
    ['Items', data.items],
    ['Notes', data.notes || [data.other, data.atmosphere].filter(asText).join('; ')],
  ]);
  const outputLanguage =
    lang === 'zh' ? 'Simplified Chinese' : lang === 'ja' ? 'Japanese' : 'English';

  return `You are a visual novel scene designer.
Task: ${useExisting ? 'fill in the missing parts of this place profile without changing usable existing details' : 'create a fresh, distinct place profile'}.
Output language: ${outputLanguage}.
Preserve any usable existing details. Do not contradict them. Keep every field short and concrete: one or two sentences at most. Describe the place only; do not add characters, plot, events, goals, conflicts, or story development.

Available information:
${context}

Return ONLY valid JSON, with no markdown fences and no extra text.
JSON keys:
{
  "sceneName": "short scene name",
  "location": "where this place is",
  "time": "time of day or season",
  "weather": "weather or indoor air condition",
  "visual": "visible layout, light, and colors",
  "sound": "ambient sounds",
  "items": "notable objects",
  "notes": "other stable place details"
}`;
};

export function parseSettingJson<T extends Record<string, unknown>>(text: string): T {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI did not return JSON.');
  }

  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

export const buildCharacterUpdates = (
  data: Record<string, unknown>,
  generated: GeneratedCharacterSetting,
) => {
  const updates: Record<string, unknown> = {};

  if (asText(generated.characterName)) {
    updates.characterName = asText(generated.characterName);
  }

  if (asText(generated.identity)) {
    updates.identity = asText(generated.identity);
  }

  if (asText(generated.appearance)) {
    updates.appearance = asText(generated.appearance);
  }

  if (asText(generated.personality)) {
    updates.showPersonality = true;
    updates.personality = asText(generated.personality);
  }

  if (asText(generated.habits)) {
    updates.habits = asText(generated.habits);
  }

  if (asText(generated.speechStyle)) {
    updates.speechStyle = asText(generated.speechStyle);
  }

  if (asText(generated.experience)) {
    updates.experience = asText(generated.experience);
  }

  if (asText(generated.relationships)) {
    updates.relationships = asText(generated.relationships);
  }

  if (asText(generated.notes)) {
    updates.notes = asText(generated.notes);
  }

  return updates;
};

export const buildSceneUpdates = (
  data: Record<string, unknown>,
  generated: GeneratedSceneSetting,
) => {
  const updates: Record<string, unknown> = {};

  if (asText(generated.sceneName)) {
    updates.sceneName = asText(generated.sceneName);
  }

  if (asText(generated.location)) {
    updates.location = asText(generated.location);
  }

  if (asText(generated.time)) {
    updates.time = asText(generated.time);
  }

  if (asText(generated.weather)) {
    updates.weather = asText(generated.weather);
  }

  if (asText(generated.visual)) {
    updates.visual = asText(generated.visual);
  }

  if (asText(generated.sound)) {
    updates.sound = asText(generated.sound);
  }

  if (asText(generated.items)) {
    updates.items = asText(generated.items);
  }

  if (asText(generated.notes)) {
    updates.notes = asText(generated.notes);
  }

  return updates;
};
