export const revealCharacters = (lines: string[], visibleChars: number) => {
  let remaining = visibleChars;
  return lines.map((line) => {
    if (remaining <= 0) return '';
    const chars = Array.from(line);
    const visible = chars.slice(0, remaining).join('');
    remaining -= chars.length;
    return visible;
  });
};

export const revealWords = (lines: string[], visibleWords: number) => {
  let remaining = visibleWords;
  return lines.map((line) => {
    if (remaining <= 0) return '';
    const tokens = line.match(/\S+\s*/g) || [];
    const visible = tokens.slice(0, remaining).join('');
    remaining -= tokens.length;
    return visible;
  });
};

const sentenceTokens = (line: string) => line.match(/[^。！？.!?]+[。！？.!?]?\s*/g) || [];

export const revealSentences = (lines: string[], visibleSentences: number) => {
  let remaining = visibleSentences;
  return lines.map((line) => {
    if (remaining <= 0) return '';
    const tokens = sentenceTokens(line);
    if (!tokens.length) return '';
    const visible = tokens.slice(0, remaining).join('');
    remaining -= tokens.length;
    return visible;
  });
};

export const revealLineBlocks = (lines: string[], visibleLines: number) =>
  lines.map((line, index) => (index < visibleLines ? line : ''));

export const objectAnimationState = (
  animation: 'none' | 'fade' | 'slideUp' | 'typewriter',
  durationMs: number,
  elapsed?: number,
  forceFinal = false,
) => {
  if (forceFinal || elapsed === undefined || animation === 'none') {
    return { alpha: 1, offsetY: 0, reveal: 1 };
  }

  const progress = Math.min(1, Math.max(0, elapsed / Math.max(0.05, durationMs / 1000)));
  if (animation === 'fade') return { alpha: progress, offsetY: 0, reveal: 1 };
  if (animation === 'slideUp') return { alpha: progress, offsetY: (1 - progress) * 28, reveal: 1 };
  // A typewriter effect on a non-text object is a left-to-right reveal.
  return { alpha: 1, offsetY: 0, reveal: progress };
};

export const animatedTextState = (
  animation: 'none' | 'fade' | 'slideUp' | 'typewriter',
  lines: string[],
  animationDurationMs: number,
  elapsed?: number,
  forceFinal = false,
  typewriterMode: 'character' | 'word' | 'sentence' | 'line' = 'character',
) => {
  if (forceFinal || elapsed === undefined || animation === 'none') {
    return { lines, alpha: 1, offsetY: 0 };
  }

  const progress = Math.min(1, Math.max(0, elapsed / Math.max(0.05, animationDurationMs / 1000)));
  if (animation === 'fade') {
    return {
      lines,
      alpha: progress,
      offsetY: 0,
    };
  }
  if (animation === 'slideUp') {
    return {
      lines,
      alpha: progress,
      offsetY: (1 - progress) * 28,
    };
  }

  if (typewriterMode === 'sentence' || typewriterMode === 'word') {
    const totalSentences = lines.reduce((sum, line) => sum + sentenceTokens(line).length, 0);
    return {
      lines: revealSentences(lines, Math.ceil(totalSentences * progress)),
      alpha: 1,
      offsetY: 0,
    };
  }

  if (typewriterMode === 'line') {
    return {
      lines: revealLineBlocks(lines, Math.ceil(lines.length * progress)),
      alpha: 1,
      offsetY: 0,
    };
  }

  const totalChars = lines.reduce((sum, line) => sum + Array.from(line).length, 0);
  return {
    lines: revealCharacters(lines, Math.ceil(totalChars * progress)),
    alpha: 1,
    offsetY: 0,
  };
};
