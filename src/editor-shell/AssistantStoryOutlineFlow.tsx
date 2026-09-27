import { ArrowDown, Maximize2, Minimize2 } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';

import type { AssistantStoryOutline } from '../editor-state/editorConfig';
import type { Language } from '../lib/i18n';
import { assistantPanelCopy } from './i18n/assistant';

type Props = {
  outline: AssistantStoryOutline;
  language: Language;
  onChange: (outline: AssistantStoryOutline) => void;
};

const textFor = (language: Language, zh: string, ja: string, en: string) =>
  language === 'ja' ? ja : language === 'en' ? en : zh;

const formatCount = (count: number, language: Language) =>
  assistantPanelCopy(language).profileFlow.outlineCount.replace(
    '{count}',
    Math.round(count).toLocaleString(language === 'zh' ? 'zh-CN' : language),
  );

export function AssistantStoryOutlineFlow({ outline, language, onChange }: Props) {
  const [maximized, setMaximized] = useState(false);
  const fullscreenLabel = textFor(language, '最大化流程图', 'フロー図を最大化', 'Maximize flowchart');
  const restoreLabel = textFor(language, '退出最大化', '最大化を終了', 'Exit maximized view');
  const stageLabel = textFor(language, '个阶段', '段階', 'stages');

  const flow = (
    <section className={`assistant-story-outline ${maximized ? 'assistant-story-outline--maximized' : ''}`}>
      <header className="assistant-story-outline__header">
        <div className="assistant-story-outline__summary">
          <strong>{outline.lengthLabel}</strong>
          <span>{formatCount(outline.estimatedCharacterCount, language)}</span>
          <span>{outline.stages.length} {stageLabel}</span>
        </div>
        <button
          type="button"
          className="assistant-story-outline__maximize"
          title={maximized ? restoreLabel : fullscreenLabel}
          aria-label={maximized ? restoreLabel : fullscreenLabel}
          onClick={() => setMaximized((current) => !current)}
        >
          {maximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          <span>{maximized ? textFor(language, '还原', '戻す', 'Restore') : textFor(language, '最大化', '最大化', 'Maximize')}</span>
        </button>
      </header>

      <div className="assistant-story-outline__viewport">
        <div className="assistant-story-outline__flow">
          {outline.stages.map((stage, index) => (
            <div className="assistant-story-outline__step" key={`${index}-${stage.title}`}>
              <article
                className="assistant-story-outline__node"
                style={{ minHeight: `${Math.min(176, 94 + stage.estimatedCharacterCount / 80)}px` }}
              >
                <div className="assistant-story-outline__node-heading">
                  <span className="assistant-story-outline__index">{index + 1}</span>
                  <input
                    aria-label={textFor(language, `第 ${index + 1} 段标题`, `第${index + 1}段のタイトル`, `Stage ${index + 1} title`)}
                    value={stage.title}
                    onChange={(event) => {
                      const stages = outline.stages.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, title: event.target.value } : item,
                      );
                      onChange({ ...outline, stages });
                    }}
                  />
                  <span className="assistant-story-outline__count">
                    {formatCount(stage.estimatedCharacterCount, language)}
                  </span>
                </div>
                <textarea
                  aria-label={textFor(language, `第 ${index + 1} 段内容`, `第${index + 1}段の内容`, `Stage ${index + 1} summary`)}
                  rows={3}
                  value={stage.subtitle}
                  onChange={(event) => {
                    const stages = outline.stages.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, subtitle: event.target.value } : item,
                    );
                    onChange({ ...outline, stages });
                  }}
                />
              </article>
              {index < outline.stages.length - 1 && (
                <div className="assistant-story-outline__connector" aria-hidden="true">
                  <ArrowDown size={17} strokeWidth={2.2} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  return maximized ? createPortal(flow, document.body) : flow;
}
