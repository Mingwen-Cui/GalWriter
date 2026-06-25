import type { Node } from '@xyflow/react';

export const replaceMentionNameInText = (html: string, oldName: string, newName: string) => {
  if (!oldName || oldName === newName || !html.includes(`@${oldName}`)) return html;

  const oldMention = `@${oldName}`;
  const newMention = `@${newName}`;

  if (typeof document === 'undefined') {
    return html.split(oldMention).join(newMention);
  }

  const container = document.createElement('div');
  container.innerHTML = html;

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let current = walker.nextNode();

  while (current) {
    textNodes.push(current as Text);
    current = walker.nextNode();
  }

  textNodes.forEach((textNode) => {
    if (textNode.nodeValue?.includes(oldMention)) {
      textNode.nodeValue = textNode.nodeValue.split(oldMention).join(newMention);
    }
  });

  container.querySelectorAll<HTMLElement>('.mention-chip').forEach((mention) => {
    if (mention.dataset.mentionName === oldName) {
      mention.dataset.mentionName = newName;
    }
  });

  return container.innerHTML;
};

export const getSettingRename = (node: Node, data: Record<string, unknown>) => {
  if (node.type === 'characterNode' && typeof data.characterName === 'string') {
    const oldName = ((node.data?.characterName as string) || '').trim();
    const newName = data.characterName.trim();
    if (oldName && newName && oldName !== newName) return { oldName, newName };
  }

  if (node.type === 'sceneNode' && typeof data.sceneName === 'string') {
    const oldName = ((node.data?.sceneName as string) || '').trim();
    const newName = data.sceneName.trim();
    if (oldName && newName && oldName !== newName) return { oldName, newName };
  }

  return null;
};
