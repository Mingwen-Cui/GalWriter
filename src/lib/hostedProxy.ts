import type { TextAIProfile } from '../domain/project';

/**
 * NOTE: 固定 ID，用于标识网页托管代理的虚拟文本 AI 配置。
 * 该配置不存储在用户本地，始终在运行时注入，用户无法编辑或删除。
 */
export const HOSTED_PROXY_PROFILE_ID = '__hosted_proxy__';

/**
 * 网页托管代理虚拟配置对象。
 * 仅在非 Tauri（即网页部署）环境下使用，直接指向服务端 PHP 代理。
 */
export const HOSTED_PROXY_PROFILE: TextAIProfile = {
  id: HOSTED_PROXY_PROFILE_ID,
  name: '网络托管代理',
  kind: 'text',
  provider: 'hosted',
  apiKey: '',
  apiUrl: '',
  model: 'deepseek',
  thinkingMode: false,
};
