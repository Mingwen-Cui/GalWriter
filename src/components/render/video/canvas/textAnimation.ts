export const revealLines = (lines: string[], visibleChars: number) => {
  let remaining = visibleChars;
  return lines.map((line) => {
    if (remaining <= 0) return '';
    const visible = line.slice(0, remaining);
    remaining -= line.length;
    return visible;
  });
};

export const animatedTextState = (
  animation: 'none' | 'fade' | 'slideUp' | 'typewriter',
  lines: string[],
  animationLeadSeconds: number,
  elapsed?: number,
  duration?: number,
  forceFinal = false,
) => {
  if (forceFinal || !elapsed || !duration || animation === 'none') {
    return { lines, alpha: 1, offsetY: 0 };
  }

  const animationDuration = Math.max(0.1, duration - animationLeadSeconds);
  const progress = Math.min(1, Math.max(0, elapsed / animationDuration));
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

  const totalChars = lines.reduce((sum, line) => sum + line.length, 0);
  return {
    lines: revealLines(lines, Math.ceil(totalChars * progress)),
    alpha: 1,
    offsetY: 0,
  };
};
