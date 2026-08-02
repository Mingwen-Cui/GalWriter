import type { Node } from '@xyflow/react';
import { useMemo } from 'react';

import type { Language } from '../../lib/i18n';

interface UseEditorFooterHintParams {
  assistantOpen: boolean;
  language: Language;
  selectedNodes: Node[];
  defaultHint: string;
}

const CHINESE_HINTS: Record<string, string> = {
  storyNode:
    '剧情卡片可以编辑标题、正文和分支选项。拖动卡片边缘的连接点，可以把剧情路径串起来。',
  characterNode:
    '人物卡片用于整理角色名、性格、特点和背景。勾选显示项后，卡片会把对应设定展示在画布上。',
  sceneNode:
    '场景卡片用于记录地点、物品、氛围和补充描述。勾选显示项后，卡片会把对应场景信息展示在画布上。',
  plotStructureNode:
    '剧情结构卡片会根据背景区域里的卡片生成后续剧情。先把它放进背景区域，再填写方向和生成数量。',
  summaryNode:
    '文本汇总卡片可以整理连接进来的剧情内容。调整编号、箭头和标题选项，可以改变输出格式。',
  batchReplaceNode:
    '批量替换卡片会处理背景区域内的文本内容。先设置查找和替换规则，再对目标区域执行。',
  numberConditionNode:
    '数字判断卡片用于按数值条件分出路径。设置阈值后，把不同结果连接到后续剧情。',
  textNode: '文字标签适合做章节标注和画布说明。双击文字可以快速编辑内容。',
  backgroundNode:
    '背景区域可以把相关卡片包在一起管理。点击锁定按钮可以切换是否允许移动和调整。',
  groupNode: '分组区域用于整理一组相关卡片。拖动区域可以移动整组内容的位置。',
  aiNode:
    'AI 汇总分析卡片会读取连接进来的剧情卡片。把需要分析的内容用箭头连入它，再执行汇总。',
  multi:
    '已选中多张卡片，可以一起拖动或使用框选菜单整理。批量操作前请确认选中的范围是否正确。',
};

const ENGLISH_HINTS: Record<string, string> = {
  storyNode:
    'Story cards let you edit titles, body text, and branch choices. Drag connection handles to link the story path.',
  characterNode:
    'Character cards organize names, personalities, traits, and backstory. Toggle visible fields to show those details on the canvas.',
  sceneNode:
    'Scene cards record locations, items, atmosphere, and extra description. Toggle visible fields to show those scene details on the canvas.',
  plotStructureNode:
    'Plot structure cards generate continuations from cards inside a background area. Place one inside the area, then set direction and card count.',
  summaryNode:
    'Summary cards collect connected story content. Change numbering, arrows, and title options to adjust the output format.',
  batchReplaceNode:
    'Batch replace cards process text inside a background area. Set find and replace rules before running it on the target area.',
  numberConditionNode:
    'Number condition cards split paths by numeric rules. Set the threshold, then connect each result to the next story step.',
  textNode:
    'Text labels are useful for chapter marks and canvas notes. Double-click the text to edit it quickly.',
  backgroundNode:
    'Background areas group related cards together. Use the lock button to switch whether it can move and resize.',
  groupNode:
    'Group areas organize a set of related cards. Drag the area to move the grouped content together.',
  aiNode:
    'AI summary cards read story cards connected into them. Connect the content you want analyzed, then run the summary.',
  multi:
    'Multiple cards are selected, so you can drag or organize them together. Check the selected range before using batch actions.',
};

export function useEditorFooterHint({
  assistantOpen,
  language,
  selectedNodes,
  defaultHint,
}: UseEditorFooterHintParams) {
  return useMemo(() => {
    if (assistantOpen) {
      return language === 'zh'
        ? 'AI 生成内容仅供参考，请结合自己的剧情判断使用。'
        : 'AI-generated content is for reference only; review it against your own story. Save important settings and project work regularly to avoid losing changes.';
    }

    const selectedType =
      selectedNodes.length === 1
        ? selectedNodes[0].type
        : selectedNodes.length > 1
          ? 'multi'
          : 'default';
    const hints = language === 'zh' ? CHINESE_HINTS : ENGLISH_HINTS;

    return hints[selectedType || 'default'] || defaultHint;
  }, [assistantOpen, defaultHint, language, selectedNodes]);
}
