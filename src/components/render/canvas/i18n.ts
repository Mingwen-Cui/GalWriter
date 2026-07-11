import type { Language } from '../../../lib/i18n';

const canvasText = {
  zh: {
    title: '画布', split: '图文分离', merged: '图文合并', expand: '展开', collapse: '收起',
    width: '宽度分辨率', height: '高度分辨率', ratioWidth: '宽度比例', ratioHeight: '高度比例',
    lockRatio: '锁定宽高比', skipSingle: '单选自动跳过', choicePosition: '选项位置',
    top: '上', middle: '中', bottom: '下', autoAdvance: '自动翻页', videoAutoplay: '视频自动播放',
    hideCharacterTags: '隐藏人物标签', hideSceneTags: '隐藏场景标签',
  },
  ja: {
    title: 'キャンバス', split: '分離', merged: '統合', expand: '展開', collapse: '折りたたむ',
    width: '幅解像度', height: '高さ解像度', ratioWidth: '横比率', ratioHeight: '縦比率',
    lockRatio: '縦横比を固定', skipSingle: '単一選択を省略', choicePosition: '選択肢位置',
    top: '上', middle: '中', bottom: '下', autoAdvance: '自動進行', videoAutoplay: '動画自動再生',
    hideCharacterTags: '人物タグを隠す', hideSceneTags: 'シーンタグを隠す',
  },
  en: {
    title: 'Canvas', split: 'Split', merged: 'Merged', expand: 'Expand', collapse: 'Collapse',
    width: 'Width', height: 'Height', ratioWidth: 'Ratio W', ratioHeight: 'Ratio H',
    lockRatio: 'Lock aspect ratio', skipSingle: 'Skip single choice', choicePosition: 'Choice position',
    top: 'Top', middle: 'Mid', bottom: 'Bot', autoAdvance: 'Auto advance', videoAutoplay: 'Video autoplay',
    hideCharacterTags: 'Hide character tags', hideSceneTags: 'Hide scene tags',
  },
} as const;

export const getCanvasText = (language: Language) => canvasText[language] || canvasText.en;
