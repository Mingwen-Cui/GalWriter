import { storyEditorEn } from './en';

export const storyEditorJa: typeof storyEditorEn = {
  copySuccess: 'クリップボードにコピーしました！',
  assistantMemoryDownloaded: 'アシスタントメモリをダウンロードしました',
  textCopied: 'テキストをコピーしました',
  voiceApiRequired: '設定 > AI設定 > 音声AI で音声APIに接続してください',
  imageApiRequired: '設定 > AI設定 > 画像AI で画像APIに接続してください',
  generatingAudio: '音声を生成中',
  existingAudio: '既存の音声',
  textAudioName: 'テキスト音声 {number}',
  audioGenerated: '音声を生成しました',
  audioGenerationFailed: '音声生成に失敗しました',
  unknownError: '不明なエラー',
  branchTitle: '分岐',
  storylineTraced: '現在のストーリーラインを追跡しました',
  aiGenerationFailed: 'AI生成に失敗しました',
  checkApiNetwork: 'APIキーとネットワーク接続を確認してください。',
  regionEmpty: 'このエリアにはAIへ送信できるカードがありません。',
  regionContext:
    '以下の「{regionTitle}」エリア内のカードを、現在の創作コンテキストとして使用してください。\n\n{content}',
  regionLimit: 'AIアシスタントには最大10個のエリアを追加できます。',
  selectionEmpty: '選択範囲内にAIへ送信できるカードがありません。',
  selectionContext: '以下の選択したカードを、現在の創作コンテキストとして使用してください。\n\n{content}',
  selectionLimit: 'AIアシスタントには最大10個のカードグループを追加できます。',
  selectionTitle: '選択したカード · {count}',
  plotUnable: 'ストーリーを生成できません',
  plotNoCards: 'このエリアには続きから生成できるストーリーカードがありません。',
  plotBriefDetail: '各カードを1〜3文で簡潔に展開してください。',
  plotDetailedDetail: '情景描写、動作、人物の会話を含め、各カードを詳しく展開してください。',
  plotStandardDetail: '各カードを2〜3文で展開してください。',
  plotDirectionRight: '右',
  plotDirectionLeft: '左',
  plotDirectionDown: '下',
  plotDirectionUp: '上',
  plotPrompt: `あなたはインタラクティブ脚本とビジュアルノベルのプロ作家です。

エリア内の既存ストーリー（順番どおり）：
{existingContent}

ユーザーが希望する今後の展開：
{direction}

カードの配置方向：
{layoutDirection}

上記の内容と方向に基づいて、続きのストーリーカードを {cardCount} 枚生成してください。
詳細度：{detailText}

必ず次の形式で返してください。各カードは ### 見出しで始め、次の行から本文を書き、ほかの説明は含めないでください：
### カードタイトル
本文

### カードタイトル
本文`,
  parsingFailed: '解析に失敗しました',
  parseResponseFailed: 'AIの返答を解析できませんでした。もう一度お試しください。',
  plotGenerationFailed: 'ストーリー生成に失敗しました',
  aiAnalysisFailed: 'AI分析に失敗しました',
  checkNetworkApi: 'ネットワークとAPI設定を確認してください。',
  quitTitle: 'アプリを終了しますか？',
  quitDescription: 'GalWriterを終了しますか？',
  quitConfirm: '終了',
  cancel: 'キャンセル',
  deleteProjectTitle: 'プロジェクトを削除しますか？',
  deleteProjectsDescription:
    'この {count} 件のプロジェクトを削除しますか？この操作は元に戻せません。',
  deleteProjectDescription: 'プロジェクト「{name}」を削除しますか？この操作は元に戻せません。',
  untitledProject: '名称未設定のプロジェクト',
  deleteProjectConfirm: 'プロジェクトを削除',
  closeConversationTitle: '会話を閉じますか？',
  closeConversationDescription: '「{name}」を閉じますか？',
  unnamedConversation: 'この会話',
  closeConversationConfirm: '会話を閉じる',
};
