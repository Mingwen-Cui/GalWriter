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

export type AITextStreamHandlers = {
  onDelta?: (delta: string) => void;
  onReasoningDelta?: (delta: string) => void;
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
  if (mode === 'structure') return prompts.analyzeStructure.replace('{{combinedText}}', combinedText);
  if (mode === 'suggestions') return prompts.analyzeSuggestions.replace('{{combinedText}}', combinedText);
  if (mode === 'direction') return prompts.analyzeDirection.replace('{{combinedText}}', combinedText);
  if (mode === 'solution') {
    return prompts.analyzeSolution
      .replace('{{combinedText}}', combinedText)
      .replace('{{previousResult}}', previousResult);
  }

  return prompts.analyzeSummary.replace('{{combinedText}}', combinedText);
};

const requiresApiKey = (provider: AiProvider) => provider !== 'ollama' && provider !== 'hosted';

const isChatCompletionProvider = (provider: AiProvider) =>
  provider === 'deepseek' ||
  provider === 'openai' ||
  provider === 'custom' ||
  provider === 'kimi' ||
  provider === 'qwen' ||
  provider === 'glm' ||
  provider === 'copilot' ||
  provider === 'claude';

export const createAIClient = (config: AIClientConfig) => {
  const key = () => config.apiKey.trim();
  const configuredModel = () => config.model.trim();
  const configuredUrl = () => config.apiUrl.trim();

  const ensureApiKey = () => {
    if (requiresApiKey(config.provider) && !key()) {
      throw new Error('请先在设置 > AI 配置中填写文本 API Key。');
    }
  };

  const getChatModel = () => {
    if (config.provider === 'deepseek') {
      return configuredModel() || (config.thinkingMode ? 'deepseek-reasoner' : 'deepseek-chat');
    }
    return configuredModel() || 'gpt-4o';
  };

  const getChatEndpoint = () => {
    const url = configuredUrl();
    if (url) {
      return /\/chat\/completions\/?$/i.test(url)
        ? url
        : `${url.replace(/\/$/, '')}/chat/completions`;
    }
    return config.provider === 'deepseek'
      ? 'https://api.deepseek.com/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';
  };

  const readOpenAICompatibleStream = async (
    response: Response,
    handlers: AITextStreamHandlers = {},
  ): Promise<AITextResult> => {
    if (!response.body) {
      const data = await response.json();
      return { content: data.choices?.[0]?.message?.content || '' };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    let reasoning = '';

    const consumeEvent = (eventText: string) => {
      eventText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.replace(/^data:\s*/, ''))
        .forEach((dataLine) => {
          if (!dataLine || dataLine === '[DONE]') return;
          try {
            const data = JSON.parse(dataLine);
            const delta = data.choices?.[0]?.delta;
            const contentDelta =
              delta?.content ??
              delta?.text ??
              data.delta?.text ??
              data.delta?.content?.[0]?.text ??
              '';
            const reasoningDelta = delta?.reasoning_content ?? delta?.reasoning ?? '';
            if (contentDelta) {
              content += contentDelta;
              handlers.onDelta?.(contentDelta);
            }
            if (reasoningDelta) {
              reasoning += reasoningDelta;
              handlers.onReasoningDelta?.(reasoningDelta);
            }
          } catch {
            // Provider keepalive or non-JSON event.
          }
        });
    };

    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || '';
      events.forEach(consumeEvent);
      if (done) break;
    }
    if (buffer.trim()) consumeEvent(buffer);

    return { content, reasoning: reasoning || undefined };
  };

  const callHostedProxy = async (prompt: string): Promise<AITextResult> => {
    const proxyUrl = configuredUrl() || 'api/proxy.php';
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: configuredModel() || 'deepseek',
        prompt,
        options: { thinkingMode: config.thinkingMode },
      }),
    });

    const rawText = await response.text();
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      const preview = rawText.slice(0, 120).replace(/\n/g, ' ');
      if (response.status === 404) {
        throw new Error(
          `服务端代理不存在（404）：请确认已将 dist/api/proxy.php 上传到网站服务器，或在“代理地址”中填写正确路径。当前请求地址：${proxyUrl}`,
        );
      }
      throw new Error(`服务端代理返回了非 JSON 响应（${response.status}）：${preview}`);
    }

    if (!response.ok || data.error) {
      throw new Error(String(data.error || `服务端代理错误 (${response.status})`));
    }

    return {
      content: String(data.content ?? ''),
      reasoning: data.reasoning != null ? String(data.reasoning) : undefined,
    };
  };

  const callOllama = async (prompt: string, stream: boolean): Promise<Response> => {
    const endpoint = configuredUrl()
      ? /\/generate\/?$/i.test(configuredUrl())
        ? configuredUrl()
        : `${configuredUrl().replace(/\/$/, '')}/generate`
      : 'http://localhost:11434/api/generate';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: configuredModel() || 'gemma4',
        prompt,
        stream,
      }),
    });
    if (!response.ok) throw new Error(`Ollama API 错误: ${await response.text()}`);
    return response;
  };

  const generateText = async (prompt: string): Promise<AITextResult> => {
    ensureApiKey();

    if (config.provider === 'hosted') return callHostedProxy(prompt);

    if (config.provider === 'ollama') {
      const response = await callOllama(prompt, false);
      const data = await response.json();
      return { content: data.response || '' };
    }

    if (isChatCompletionProvider(config.provider)) {
      const response = await fetch(getChatEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key()}`,
        },
        body: JSON.stringify({
          model: getChatModel(),
          messages: [{ role: 'user', content: prompt }],
          stream: false,
        }),
      });

      if (!response.ok) throw new Error(`AI API 错误: ${await response.text()}`);

      const data = await response.json();
      const choice = data.choices?.[0];
      return {
        content: choice?.message?.content || '',
        reasoning: config.thinkingMode ? choice?.message?.reasoning_content : undefined,
      };
    }

    const ai = new GoogleGenAI({ apiKey: key() });
    const response = await ai.models.generateContent({
      model:
        configuredModel() ||
        (config.thinkingMode ? 'gemini-2.0-flash-thinking-exp' : 'gemini-2.0-flash'),
      contents: prompt,
    });
    return { content: response.text || '' };
  };

  const generateTextStream = async (
    prompt: string,
    handlers: AITextStreamHandlers = {},
  ): Promise<AITextResult> => {
    ensureApiKey();

    if (config.provider === 'ollama') {
      const response = await callOllama(prompt, true);
      if (!response.body) return generateText(prompt);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let content = '';

      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';
        lines.forEach((line) => {
          if (!line.trim()) return;
          try {
            const data = JSON.parse(line);
            const delta = data.response || '';
            if (delta) {
              content += delta;
              handlers.onDelta?.(delta);
            }
          } catch {
            // Partial JSON line.
          }
        });
        if (done) break;
      }

      return { content };
    }

    if (isChatCompletionProvider(config.provider)) {
      const response = await fetch(getChatEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key()}`,
        },
        body: JSON.stringify({
          model: getChatModel(),
          messages: [{ role: 'user', content: prompt }],
          stream: true,
        }),
      });
      if (!response.ok) throw new Error(`AI API 错误: ${await response.text()}`);
      return readOpenAICompatibleStream(response, handlers);
    }

    const result = await generateText(prompt);
    handlers.onDelta?.(result.content);
    if (result.reasoning) handlers.onReasoningDelta?.(result.reasoning);
    return result;
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
    generateTextStream,
    analyze,
    generateSetting,
  };
};

export type AIClient = ReturnType<typeof createAIClient>;
