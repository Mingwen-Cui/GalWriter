export type WebSelectionMode = 'replace' | 'add' | 'remove';

export const webSelectionMode = (event: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }): WebSelectionMode =>
  event.ctrlKey || event.metaKey ? 'remove' : event.shiftKey ? 'add' : 'replace';

export const combineWebSelection = (previous: string[], hits: string[], mode: WebSelectionMode): string[] =>
  mode === 'remove' ? previous.filter((id) => !hits.includes(id))
    : mode === 'add' ? [...new Set([...previous, ...hits])] : hits;

type Box = { x: number; y: number; width: number; height: number };
export const webMarqueeHits = (element: Box & { id: string }, box: Box): boolean => {
  // A page backdrop intersects every small marquee. Select it only when enclosed.
  if (['settings-background', 'settings-panel', 'archive-panel'].includes(element.id)) {
    return element.x >= box.x && element.y >= box.y &&
      element.x + element.width <= box.x + box.width && element.y + element.height <= box.y + box.height;
  }
  return box.width > 0 && box.height > 0 && element.x < box.x + box.width &&
    element.x + element.width > box.x && element.y < box.y + box.height && element.y + element.height > box.y;
};
