import type { ArticleTeachingRoleTemplate } from './types';

export const ARTICLE_TEACHING_ROLE_TEMPLATES: ArticleTeachingRoleTemplate[] = [
  {
    id: 'patient-step-guide',
    name: '耐心拆解型',
    teachingMode: 'interactive',
    generationInstruction:
      '使用耐心拆解型教学角色，把文章改写为分步骤、强反馈、适合初学者理解的 Galgame 教学剧情。每个知识点都要先提问或确认，再给出解释和下一步引导。',
    card: {
      type: 'character',
      characterName: '教学角色 A',
      traits: '候选教学者。语气温和，适合把复杂文章拆成容易理解的步骤。',
      personality: '耐心、清晰、善于确认读者是否理解。',
      features: '人物图片暂时留空，后续可以替换为正式立绘。',
      background: '负责把上传文章转化为单人 Galgame 教学流程。',
      other: '选择后，AI 会按“分步解释、即时确认、逐段反馈”的方式改写文章。',
    },
  },
  {
    id: 'active-question-coach',
    name: '互动提问型',
    teachingMode: 'interactive',
    generationInstruction:
      '使用互动提问型教学角色，把文章改写为问答推进的 Galgame 教学剧情。重点安排问题、读者思考点、回答反馈和小结，让学习节奏更活泼。',
    card: {
      type: 'character',
      characterName: '教学角色 B',
      traits: '候选教学者。表达更活泼，适合用提问和反馈推动学习。',
      personality: '主动、亲切、节奏轻快。',
      features: '人物图片暂时留空，后续可以替换为正式立绘。',
      background: '负责用单人讲解或问答方式带读者理解文章。',
      other: '选择后，AI 会按“提问、反馈、再追问”的方式改写文章。',
    },
  },
  {
    id: 'logical-lecture-guide',
    name: '理性讲课型',
    teachingMode: 'lecture',
    generationInstruction:
      '使用理性讲课型教学角色，把文章改写为结构清晰的讲课式 Galgame 教学剧情。强调概念定义、论证顺序、章节层级和每章重点句。',
    card: {
      type: 'character',
      characterName: '教学角色 C',
      traits: '候选教学者。风格冷静，适合严谨梳理论点、概念和结构。',
      personality: '理性、简洁、重视逻辑顺序。',
      features: '人物图片暂时留空，后续可以替换为正式立绘。',
      background: '负责把文章知识点组织成清楚的章节教学。',
      other: '选择后，AI 会按“定义、论证、例子、小结”的讲课结构改写文章。',
    },
  },
  {
    id: 'storytelling-mentor',
    name: '故事引导型',
    teachingMode: 'interactive',
    generationInstruction:
      '使用故事引导型教学角色，把文章改写为带情境引导的 Galgame 教学剧情。用温柔的叙事过渡把章节串起来，但不要稀释文章原本的概念和论证。',
    card: {
      type: 'character',
      characterName: '教学角色 D',
      traits: '候选教学者。风格柔和，适合用故事化方式引导读者学习。',
      personality: '细腻、鼓励式、擅长总结。',
      features: '人物图片暂时留空，后续可以替换为正式立绘。',
      background: '负责把文章转成单人 Galgame 教学演出。',
      other: '选择后，AI 会按“情境导入、温柔解释、阶段总结”的方式改写文章。',
    },
  },
];
