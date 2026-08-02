export const richTextToPlainText = (value: unknown) => {
  if (typeof value !== 'string') return '';
  if (!/[<>&]/.test(value)) return value.trim();
  if (typeof document === 'undefined')
    return value
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();
  const wrapper = document.createElement('div');
  wrapper.innerHTML = value.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/p>/gi, '\n');
  return (wrapper.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
};
