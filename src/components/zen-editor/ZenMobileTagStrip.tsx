import type { ZenTag } from './types';

export function ZenMobileTagStrip({
  nodeId,
  videoUrl,
  cardVideoMentionName,
  characterTags,
  sceneTags,
  activeKind,
  activeId,
  onCharacterClick,
  onSceneClick,
  onVideoClick,
}: {
  nodeId: string;
  videoUrl?: string;
  cardVideoMentionName: string;
  characterTags: ZenTag[];
  sceneTags: ZenTag[];
  activeKind?: 'character' | 'scene';
  activeId?: string;
  onCharacterClick: (tag: ZenTag) => void;
  onSceneClick: (tag: ZenTag) => void;
  onVideoClick: () => void;
}) {
  return (
    <div className="zen-editor-mobile-tags hidden border-b border-[var(--card-border)] bg-[var(--card-bg)] px-2 py-1.5">
      <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto">
        {characterTags.map((tag) => (
          <button
            key={`mobile-character-${tag.id}`}
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onCharacterClick(tag)}
            className="zen-editor-mobile-tag mention-tag-button mention-tag-character"
            aria-pressed={activeKind === 'character' && activeId === tag.id}
            title={`@${tag.name}`}
          >
            @{tag.name}
          </button>
        ))}
        {videoUrl && (
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onVideoClick}
            className="zen-editor-mobile-tag mention-tag-button mention-tag-video"
            aria-pressed={activeKind === 'scene' && activeId === nodeId}
            title={`@${cardVideoMentionName}`}
          >
            @{cardVideoMentionName}
          </button>
        )}
        {sceneTags.map((tag) => (
          <button
            key={`mobile-scene-${tag.id}`}
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onSceneClick(tag)}
            className="zen-editor-mobile-tag mention-tag-button mention-tag-scene"
            aria-pressed={activeKind === 'scene' && activeId === tag.id}
            title={`@${tag.name}`}
          >
            @{tag.name}
          </button>
        ))}
      </div>
    </div>
  );
}
