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
  type LanguageCode,
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
  language: LanguageCode;
}

export interface AISceneSettingGenerationParams {
  type: 'scene';
  data: SceneNodeData;
  language: LanguageCode;
}

export type AISettingRequest = AISettingGenerationParams | AISceneSettingGenerationParams;

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

    // NOTE: hosted 模式由服务端代理持有密钥，ollama 本地无需 key，其余均需用户填写
    if (!key && config.provider !== 'ollama' && config.provider !== 'hosted') {
      throw new Error('请先点击右侧工具栏的设置按钮，在"AI 接口配置"里添加 API Key。');
    }

    if (config.provider === 'hosted') {
      const proxyUrl = configuredUrl || '/api/proxy.php';
      const backendProvider = configuredModel || 'deepseek';
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: backendProvider,
          prompt,
          options: { thinkingMode: config.thinkingMode },
        }),
      });

      // NOTE: 先读取原始文本，再手动解析 JSON
      // 若服务器返回 HTML（如 404 页面或 PHP 未启用），给出清晰的错误提示
      const rawText = await response.text();
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(rawText) as Record<string, unknown>;
      } catch {
        const preview = rawText.slice(0, 120).replace(/\n/g, ' ');
        const returnedPhpSource = /^\s*<\?php\b/i.test(rawText);
        throw new Error(
          (returnedPhpSource
            ? `服务器把 /api/proxy.php 当作普通文件返回，说明当前服务器没有执行 PHP。` +
              `本地开发请在“设置 → AI 配置 → 文本 AI”中选择并配置自己的模型；` +
              `网站部署请启用 PHP 后端并确认该接口返回 JSON。\n`
            : `服务端代理返回了非 JSON 响应，请确认 /api/proxy.php 已正确部署且服务器支持 PHP。\n`) +
          `服务器响应状态：${response.status}，内容预览：${preview}`,
        );
      }

      if (!response.ok || data['error']) {
        throw new Error(String(data['error']) || `服务端代理错误 (${response.status})`);
      }
      return {
        content: String(data['content'] ?? ''),
        reasoning: data['reasoning'] != null ? String(data['reasoning']) : undefined,
      };
    }


    if (config.provider === 'ollama') {
      const model = configuredModel || 'gemma4';
      const endpoint = configuredUrl
        ? /\/generate\/?$/i.test(configuredUrl)
          ? configuredUrl
          : `${configuredUrl.replace(/\/$/, '')}/generate`
        : 'http://localhost:11434/api/generate';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API 错误: ${await response.text()}`);
      }

      const data = await response.json();
      return {
        content: data.response || '',
      };
    }

    if (config.provider === 'deepseek') {
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

    if (config.provider === 'openai' || config.provider === 'custom' || config.provider === 'kimi' || config.provider === 'qwen' || config.provider === 'glm' || config.provider === 'copilot' || config.provider === 'claude') {
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

    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
      model:
        configuredModel ||
        (config.thinkingMode ? 'gemini-2.0-flash-thinking-exp' : 'gemini-2.0-flash'),
      contents: prompt,
    });
    return { content: response.text || '' };
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
