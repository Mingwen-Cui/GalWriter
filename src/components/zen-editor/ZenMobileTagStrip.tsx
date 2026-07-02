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
            className={`zen-editor-mobile-tag shrink-0 truncate rounded-md px-2 text-xs font-bold ${
              activeKind === 'character' && activeId === tag.id
                ? 'bg-indigo-500 text-white'
                : 'bg-indigo-500/10 text-indigo-500'
            }`}
          >
            @{tag.name}
          </button>
        ))}
        {videoUrl && (
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onVideoClick}
            className={`zen-editor-mobile-tag shrink-0 truncate rounded-md px-2 text-xs font-bold ${
              activeKind === 'scene' && activeId === nodeId
                ? 'bg-blue-500 text-white'
                : 'bg-blue-500/10 text-blue-500'
            }`}
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
            className={`zen-editor-mobile-tag shrink-0 truncate rounded-md px-2 text-xs font-bold ${
              activeKind === 'scene' && activeId === tag.id
                ? 'bg-blue-500 text-white'
                : 'bg-blue-500/10 text-blue-500'
            }`}
          >
            @{tag.name}
          </button>
        ))}
      </div>
    </div>
  );
}
