/** Insert slide properties without confusing an object's extLst with the slide's. */
export const replacePptSlideProperty = (
  xml: string,
  property: 'transition' | 'timing',
  replacement: string,
) => {
  const children: Array<{ name: string; start: number; end: number }> = [];
  let depth = 0;
  let child: { name: string; start: number; end: number } | undefined;
  let rootEnd = xml.lastIndexOf('</p:sld>');
  for (const match of xml.matchAll(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<[^>]+>/g)) {
    const tag = match[0];
    if (tag.startsWith('<?') || tag.startsWith('<!')) continue;
    const closing = tag.startsWith('</');
    const name = tag.match(/^<\/?([^\s/>]+)/)?.[1];
    if (!name) continue;
    if (closing) {
      depth -= 1;
      if (depth === 1 && child) {
        child.end = match.index! + tag.length;
        children.push(child);
        child = undefined;
      }
      if (depth === 0) rootEnd = match.index!;
    } else {
      const selfClosing = /\/\s*>$/.test(tag);
      if (depth === 1) {
        child = { name, start: match.index!, end: match.index! + tag.length };
        if (selfClosing) {
          children.push(child);
          child = undefined;
        }
      }
      if (!selfClosing) depth += 1;
    }
  }
  const propertyName = `p:${property}`;
  const propertyPattern = new RegExp(`<${propertyName}\\b`);
  const rank = (node: (typeof children)[number]) => {
    if (node.name === 'p:cSld') return 0;
    if (node.name === 'p:clrMapOvr') return 1;
    if (node.name === 'p:transition') return 2;
    if (node.name === 'p:timing') return 3;
    if (node.name === 'p:extLst') return 4;
    if (node.name === 'mc:AlternateContent') {
      const content = xml.slice(node.start, node.end);
      if (/<p:transition\b/.test(content)) return 2;
      if (/<p:timing\b/.test(content)) return 3;
    }
    return 5;
  };
  const removed = children.filter(
    (node) => node.name === propertyName ||
      (node.name === 'mc:AlternateContent' && propertyPattern.test(xml.slice(node.start, node.end))),
  );
  const anchor = children.find(
    (node) => !removed.includes(node) && rank(node) > (property === 'transition' ? 2 : 3),
  )?.start ?? rootEnd;
  if (anchor < 0) throw new Error('PPTX export is missing the slide root element');
  const edits = [
    ...removed.map((node) => ({ ...node, value: '' })),
    { start: anchor, end: anchor, value: replacement },
  ].sort((left, right) => right.start - left.start);
  return edits.reduce(
    (result, edit) => result.slice(0, edit.start) + edit.value + result.slice(edit.end),
    xml,
  );
};
