import { storyEditorEn } from './en';

export const storyEditorZh: typeof storyEditorEn = {
  copySuccess: '复制成功！',
  assistantMemoryDownloaded: '偏好记忆已下载',
  textCopied: '已复制文本',
  voiceApiRequired: '请先在设置 > AI 配置 > 语音 AI 中连接语音 API',
  imageApiRequired: '请先在设置 > AI 配置 > 图片 AI 中连接图片 API',
  generatingAudio: '正在生成文字音频',
  existingAudio: '已有音频',
  textAudioName: '文字音频 {number}',
  audioGenerated: '文字音频已生成',
  audioGenerationFailed: '文字音频生成失败',
  unknownError: '未知错误',
  branchTitle: '分支',
  storylineTraced: '已追踪当前故事线',
  aiGenerationFailed: 'AI 生成失败',
  checkApiNetwork: '请检查 API 密钥和网络连接。',
  regionEmpty: '这个区域里还没有可发送给 AI 的内容。',
  regionContext:
    '请阅读并使用以下「{regionTitle}」区域内的卡片内容作为当前创作上下文：\n\n{content}',
  regionLimit: 'AI 助手最多可附加 10 组区域内容。',
  plotUnable: '无法生成剧情',
  plotNoCards: '区域内没有找到可续写的剧情卡片。',
  plotBriefDetail: '每段 1-3 句话，简洁推进剧情。',
  plotDetailedDetail: '每段详细展开，包含场景描写、动作和人物对话。',
  plotStandardDetail: '每段 2-3 句话。',
  plotDirectionRight: '向右',
  plotDirectionLeft: '向左',
  plotDirectionDown: '向下',
  plotDirectionUp: '向上',
  plotPrompt: `你是一位专业的互动剧本/视觉小说创作者。

以下是区域内已有剧情（按顺序排列）：
{existingContent}

用户希望的后续发展方向：
{direction}

剧情卡片生成方向：
{layoutDirection}

请根据上述内容和发展方向，生成 {cardCount} 张后续剧情卡片。
详细程度要求：{detailText}

请严格按以下格式返回，每张卡片以 ### 标题开头，正文换行后直接写内容。不要包含其他说明：
### 卡片标题
正文内容

### 卡片标题
正文内容`,
  parsingFailed: '解析失败',
  parseResponseFailed: 'AI 返回内容无法解析，请重试。',
  plotGenerationFailed: '剧情生成失败',
  aiAnalysisFailed: 'AI 分析失败',
  checkNetworkApi: '请检查网络和 API 配置。',
  quitTitle: '退出应用？',
  quitDescription: '确定要关闭旮旯作家 · GalWriter 吗？',
  quitConfirm: '退出应用',
  cancel: '取消',
  deleteProjectTitle: '删除项目？',
  deleteProjectsDescription: '确定要删除这 {count} 个项目吗？此操作不可撤销。',
  deleteProjectDescription: '确定要删除项目「{name}」吗？此操作不可撤销。',
  untitledProject: '未命名项目',
  deleteProjectConfirm: '删除项目',
  closeConversationTitle: '关闭对话？',
  closeConversationDescription: '确定要关闭「{name}」吗？',
  unnamedConversation: '这个对话',
  closeConversationConfirm: '关闭对话',
};
