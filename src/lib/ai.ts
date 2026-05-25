import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('GEMINI_API_KEY is missing. AI continuation will not work.');
}

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export async function generateContinuation(previousStoryText: string): Promise<string> {
  if (!ai) {
    throw new Error('GEMINI_API_KEY is missing. Please configure it in the settings.');
  }

  const prompt = `You are an expert Galgame and Visual Novel interactive script writer.
The user wants you to write the next segment of the story based on the player's choice.
Read the story so far, and the specific OPTION the player just chose. Provide a reasonable continuation block (the resulting scene).
Keep it engaging and concise (e.g., 50-150 words). Do not include the next set of choices at the end, just the narrative and dialogue. Match the tone and language of the provided story (if Chinese, reply in Chinese).

Story so far:
${previousStoryText}

Next segment limit to roughly 100-200 words.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      temperature: 0.7,
    }
  });

  return response.text || '';
}
