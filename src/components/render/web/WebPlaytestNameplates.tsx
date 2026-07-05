import {
  getNameplateCharacterCenterX,
  getNameplateCssBackground,
} from '../video/shared/nameplateRenderer';
import type { RenderStyle } from '../video/shared/types';
import { colorInputValue, withAlpha } from './webPlaytestStyleTools';

type NameplateItem = ReturnType<
  typeof import('../video/shared/nameplateRenderer').getNameplateItems
>[number];

type WebPlaytestNameplatesProps = {
  items: NameplateItem[];
  renderStyle: RenderStyle;
  dialogWidth: number;
};

export function WebPlaytestNameplates({
  items,
  renderStyle,
  dialogWidth,
}: WebPlaytestNameplatesProps) {
  if (!renderStyle.nameplateVisible || !items.length) return null;

  const fontSize = Math.max(10, renderStyle.nameplateFontSize ?? 18);
  const scale = Math.max(0.5, Math.min(2, (renderStyle.nameplateScale ?? 100) / 100));
  const paddingX = Math.round(fontSize * 1.15 * scale);
  const paddingY = Math.round(fontSize * 0.42 * scale);
  const rowHeight = Math.ceil(fontSize + paddingY * 2 + Math.max(8, fontSize * 0.45));
  const textGap = renderStyle.nameplateTextGap ?? 8;
  const top = 0;
  const translateY = `calc(-100% - 8px + ${renderStyle.nameplateOffsetY ?? 0}px)`;
  const baseStyle: React.CSSProperties = {
    ...(renderStyle.nameplateInside
      ? { background: 'transparent' }
      : getNameplateCssBackground(renderStyle)),
    color: withAlpha(
      colorInputValue(renderStyle.nameplateTextColor),
      (renderStyle.nameplateTextColorAlpha ?? 100) / 100,
    ),
    fontFamily: renderStyle.nameplateFontFamily || renderStyle.titleFontFamily,
    fontSize,
    lineHeight: 1,
    padding: `${paddingY}px ${paddingX}px`,
    borderRadius: Math.max(0, renderStyle.nameplateRadius ?? 14),
    boxShadow: renderStyle.nameplateInside ? 'none' : '0 10px 24px rgba(0, 0, 0, 0.24)',
    textShadow: renderStyle.nameplateInside
      ? '0 1px 10px rgba(0, 0, 0, 0.42)'
      : '0 1px 8px rgba(0, 0, 0, 0.32)',
    whiteSpace: 'nowrap',
    maxWidth: 'min(44%, 220px)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  if (!renderStyle.nameplateFollowCharacter) {
    if (renderStyle.nameplateInside) {
      return (
        <div
          className="pointer-events-none relative z-10 flex max-w-full justify-center gap-2"
          style={{
            minHeight: rowHeight,
            marginBottom: textGap,
            transform: `translate(${renderStyle.nameplateOffsetX ?? 0}px, ${renderStyle.nameplateOffsetY ?? 0}px)`,
          }}
        >
          {items.map((item) => (
            <div key={item.sourceNodeId} className="font-black" style={baseStyle}>
              {item.name}
            </div>
          ))}
        </div>
      );
    }
    return (
      <div
        className="pointer-events-none absolute left-1/2 z-10 flex max-w-full gap-2"
        style={{
          top,
          transform: `translate(calc(-50% + ${renderStyle.nameplateOffsetX ?? 0}px), ${translateY})`,
        }}
      >
        {items.map((item) => (
          <div key={item.sourceNodeId} className="font-black" style={baseStyle}>
            {item.name}
          </div>
        ))}
      </div>
    );
  }

  const dialogueLeft =
    50 + Math.max(-100, Math.min(100, renderStyle.dialogOffsetX ?? 0)) * 0.5 - dialogWidth / 2;
  if (renderStyle.nameplateInside) {
    return (
      <div
        className="pointer-events-none relative z-10"
        style={{ minHeight: rowHeight, marginBottom: textGap }}
      >
        {items.map((item) => {
          const characterPercent = getNameplateCharacterCenterX(item.config, 100);
          const localLeft = Math.max(
            4,
            Math.min(96, ((characterPercent - dialogueLeft) / dialogWidth) * 100),
          );
          return (
            <div
              key={item.sourceNodeId}
              className="absolute top-0 font-black"
              style={{
                ...baseStyle,
                left: `${localLeft}%`,
                transform: `translate(calc(-50% + ${renderStyle.nameplateOffsetX ?? 0}px), ${renderStyle.nameplateOffsetY ?? 0}px)`,
              }}
            >
              {item.name}
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10">
      {items.map((item) => {
        const characterPercent = getNameplateCharacterCenterX(item.config, 100);
        const localLeft = Math.max(
          4,
          Math.min(96, ((characterPercent - dialogueLeft) / dialogWidth) * 100),
        );
        return (
          <div
            key={item.sourceNodeId}
            className="absolute top-0 font-black"
            style={{
              ...baseStyle,
              left: `${localLeft}%`,
              top,
              transform: `translate(calc(-50% + ${renderStyle.nameplateOffsetX ?? 0}px), ${translateY})`,
            }}
          >
            {item.name}
          </div>
        );
      })}
    </div>
  );
}
