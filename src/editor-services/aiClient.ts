import { GoogleGenAI } from '@google/genai';

import type {
  AIPromptsConfig,
  AiProvider,
  CharacterNodeData,
  SceneNodeData,
} from '../domain/project';
import {
  buildCharacterSettingPrompt,
  buildCharacterUpdates,
  buildSceneSettingPrompt,
  buildSceneUpdates,
  parseSettingJson,
  type GeneratedCharacterSetting,
  type GeneratedSceneSetting,
} from '../lib/settingDice';

export type AITextResult = {
  content: string;
  reasoning?: string;
};

export interface AIClientConfig {
  provider: AiProvider;
  apiKey: string;
  apiUrl: string;
  model: string;
  thinkingMode: boolean;
}

export interface AIAnalyzeParams {
  mode: 'summary' | 'structure' | 'suggestions' | 'direction' | 'solution';
  combinedText: string;
  prompts: AIPromptsConfig;
  previousResult?: string;
}

export interface AISettingGenerationParams {
  type: 'character';
  data: CharacterNodeData;
  language: 'zh' | 'en';
}

export interface AISceneSettingGenerationParams {
  type: 'scene';
  data: SceneNodeData;
  language: 'zh' | 'en';
}

export type AISettingRequest = AISettingGenerationParams | AISceneSettingGenerationParams;

const createAIProxyCaller = async (
  provider: AiProvider,
  prompt: string,
  options: Record<string, unknown>,
) => {
  let response: Response;

  try {
    response = await fetch('./api/proxy.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, prompt, options }),
    });
  } catch {
    throw new Error('无法连接到代理接口，请检查PHP 后端是否已正确部署并运行');
  }

  let data: { error?: string; content?: string; reasoning?: string };
  try {
    data = await response.json();
  } catch {
    throw new Error(
      `代理接口返回了无效格式(HTTP ${response.status})。请检查 ./api/proxy.php 是否存在。`,
    );
  }

  if (!response.ok || data.error) {
    throw new Error(data.error || `代理接口请求失败(HTTP ${response.status})`);
  }

  return data;
};

const createAnalyzePrompt = ({
  mode,
  combinedText,
  prompts,
  previousResult = '',
}: AIAnalyzeParams) => {
  if (mode === 'structure') {
    return prompts.analyzeStructure.replace('{{combinedText}}', combinedText);
  }
  if (mode === 'suggestions') {
    return prompts.analyzeSuggestions.replace('{{combinedText}}', combinedText);
  }
  if (mode === 'direction') {
    return prompts.analyzeDirection.replace('{{combinedText}}', combinedText);
  }
  if (mode === 'solution') {
    return prompts.analyzeSolution
      .replace('{{combinedText}}', combinedText)
      .replace('{{previousResult}}', previousResult);
  }

  return prompts.analyzeSummary.replace('{{combinedText}}', combinedText);
};

export const createAIClient = (config: AIClientConfig) => {
  const generateText = async (prompt: string): Promise<AITextResult> => {
    const key = config.apiKey.trim();
    const configuredModel = config.model.trim();
    const configuredUrl = config.apiUrl.trim();

    if (config.provider === 'deepseek') {
      if (key) {
        const model = configuredModel || (config.thinkingMode ? 'deepseek-reasoner' : 'deepseek-chat');
        const endpoint = configuredUrl
          ? /\/chat\/completions\/?$/i.test(configuredUrl)
            ? configuredUrl
            : `${configuredUrl.replace(/\/$/, '')}/chat/completions`
          : 'https://api.deepseek.com/chat/completions';
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            stream: false,
          }),
        });

        if (!response.ok) {
          throw new Error(`DeepSeek API 错误: ${await response.text()}`);
        }

        const data = await response.json();
        const choice = data.choices?.[0];
        return {
          content: choice?.message?.content || '',
          reasoning: config.thinkingMode ? choice?.message?.reasoning_content : undefined,
        };
      }

      const data = await createAIProxyCaller('deepseek', prompt, {
        thinkingMode: config.thinkingMode,
      });
      return {
        content: data.content || '',
        reasoning: config.thinkingMode ? data.reasoning : undefined,
      };
    }

    if (config.provider === 'openai' || config.provider === 'custom' || config.provider === 'kimi' || config.provider === 'qwen' || config.provider === 'glm' || config.provider === 'copilot' || config.provider === 'claude') {
      if (key) {
        const model = configuredModel || 'gpt-4o';
        const endpoint = configuredUrl
          ? /\/chat\/completions\/?$/i.test(configuredUrl)
            ? configuredUrl
            : `${configuredUrl.replace(/\/$/, '')}/chat/completions`
          : 'https://api.openai.com/v1/chat/completions';
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            stream: false,
          }),
        });

        if (!response.ok) {
          throw new Error(`OpenAI API 错误: ${await response.text()}`);
        }

        const data = await response.json();
        return { content: data.choices?.[0]?.message?.content || '' };
      }

      const data = await createAIProxyCaller('openai', prompt, {});
      return { content: data.content || '' };
    }

    if (key) {
      const ai = new GoogleGenAI({ apiKey: key });
      const response = await ai.models.generateContent({
        model:
          configuredModel ||
          (config.thinkingMode ? 'gemini-2.0-flash-thinking-exp' : 'gemini-2.0-flash'),
        contents: prompt,
      });
      return { content: response.text || '' };
    }

    const data = await createAIProxyCaller('gemini', prompt, {
      thinkingMode: config.thinkingMode,
    });
    return {
      content: data.content || '',
      reasoning: config.thinkingMode ? data.reasoning : undefined,
    };
  };

  const analyze = async (params: AIAnalyzeParams) => {
    const prompt = createAnalyzePrompt(params);
    return generateText(prompt);
  };

  const generateSetting = async (request: AISettingRequest) => {
    if (request.type === 'character') {
      const prompt = buildCharacterSettingPrompt(request.data, request.language);
      const result = await generateText(prompt);
      const generated = parseSettingJson<GeneratedCharacterSetting>(result.content);

      return {
        result,
        updates: buildCharacterUpdates(request.data, generated),
      };
    }

    const prompt = buildSceneSettingPrompt(request.data, request.language);
    const result = await generateText(prompt);
    const generated = parseSettingJson<GeneratedSceneSetting>(result.content);

    return {
      result,
      updates: buildSceneUpdates(request.data, generated),
    };
  };

  return {
    generateText,
    analyze,
    generateSetting,
  };
};

export type AIClient = ReturnType<typeof createAIClient>;
