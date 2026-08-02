import type { CodeExportTarget } from './codeExport/targets/targetTypes';

type TokenKind =
  | 'comment'
  | 'keyword'
  | 'label'
  | 'number'
  | 'operator'
  | 'string'
  | 'tag'
  | 'variable';
type Token = { kind?: TokenKind; value: string };
type TokenPattern = { kind: TokenKind; pattern: RegExp };

const commonPatterns: TokenPattern[] = [
  { kind: 'string', pattern: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g },
  { kind: 'number', pattern: /\b(?:0x[\da-f]+|\d+(?:\.\d+)?)\b/gi },
  { kind: 'operator', pattern: /(?:>=|<=|==|!=|\+=|-=|&&|\|\||[=+\-*/<>])/g },
];

const patternsFor = (target: CodeExportTarget, path: string): TokenPattern[] => {
  if (path.endsWith('.json'))
    return [
      { kind: 'comment', pattern: /\/\/.*$/g },
      { kind: 'label', pattern: /"(?:\\.|[^"\\])*"(?=\s*:)/g },
      ...commonPatterns,
      { kind: 'keyword', pattern: /\b(?:true|false|null)\b/g },
    ];
  if (path.endsWith('.md'))
    return [
      { kind: 'label', pattern: /^#{1,6}\s.*$/g },
      { kind: 'tag', pattern: /`[^`]+`/g },
      { kind: 'keyword', pattern: /\*\*[^*]+\*\*/g },
      { kind: 'operator', pattern: /^\s*[-*+]\s/g },
    ];
  if (target === 'tyrano')
    return [
      { kind: 'comment', pattern: /(?:;|\/\/).*$/g },
      { kind: 'label', pattern: /^\s*\*[A-Za-z_][\w-]*/g },
      { kind: 'tag', pattern: /\[(?:\/?[A-Za-z_][\w-]*)/g },
      ...commonPatterns,
      { kind: 'variable', pattern: /\b(?:f|sf|tf)\.[A-Za-z_]\w*/g },
      {
        kind: 'keyword',
        pattern: /\b(?:if|elsif|else|endif|eval|jump|glink|bg|playbgm|playse|movie|s)\b/g,
      },
    ];
  if (target === 'dialogic')
    return [
      { kind: 'comment', pattern: /#.*$/g },
      { kind: 'label', pattern: /^\s*(?:label\s+)?[A-Za-z_]\w*(?=:)/g },
      { kind: 'tag', pattern: /\[[^\]\s]+/g },
      ...commonPatterns,
      { kind: 'variable', pattern: /\{?[A-Za-z_][\w.]*\}?/g },
      { kind: 'keyword', pattern: /\b(?:join|leave|update|jump|label|if|elif|else|set|return)\b/g },
      { kind: 'operator', pattern: /^\s*-/g },
    ];
  return [
    { kind: 'comment', pattern: /#.*$/g },
    ...commonPatterns,
    { kind: 'label', pattern: /\b(?:label|jump|call)\s+[A-Za-z_]\w*/g },
    {
      kind: 'keyword',
      pattern:
        /\b(?:label|jump|call|return|menu|if|elif|else|define|default|scene|show|hide|play|queue|stop|voice|with|pause|python|init|image|transform)\b/g,
    },
    { kind: 'variable', pattern: /\b(?:persistent\.)?[A-Za-z_]\w*(?=\s*(?:=|\+=|-=))/g },
  ];
};

export const tokenizeCodeLine = (line: string, target: CodeExportTarget, path: string): Token[] => {
  const tokens: Token[] = [];
  const patterns = patternsFor(target, path);
  let offset = 0;
  while (offset < line.length) {
    let selected: { index: number; kind: TokenKind; value: string } | undefined;
    patterns.forEach(({ kind, pattern }) => {
      pattern.lastIndex = offset;
      const match = pattern.exec(line);
      if (!match) return;
      if (!selected || match.index < selected.index)
        selected = { index: match.index, kind, value: match[0] };
    });
    if (!selected) {
      tokens.push({ value: line.slice(offset) });
      break;
    }
    if (selected.index > offset) tokens.push({ value: line.slice(offset, selected.index) });
    tokens.push({ kind: selected.kind, value: selected.value });
    offset = selected.index + Math.max(selected.value.length, 1);
  }
  return tokens.length ? tokens : [{ value: '' }];
};

const tokenClass: Record<TokenKind, string> = {
  comment: 'text-[#7f8c98] italic',
  keyword: 'font-semibold text-[#c792ea]',
  label: 'font-semibold text-[#82aaff]',
  number: 'text-[#f78c6c]',
  operator: 'text-[#89ddff]',
  string: 'text-[#c3e88d]',
  tag: 'font-semibold text-[#ffcb6b]',
  variable: 'text-[#80cbc4]',
};

export function CodePreview({
  content,
  path,
  target,
}: {
  content: string;
  path: string;
  target: CodeExportTarget;
}) {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  const numberWidth = String(lines.length).length;
  return (
    <div className="min-w-max font-mono text-[12px] leading-6 text-[#d7dae0]" aria-label={path}>
      {lines.map((line, lineIndex) => (
        <div key={`${lineIndex}-${line}`} className="group flex min-h-6 hover:bg-white/[0.035]">
          <span
            className="mr-4 w-10 shrink-0 select-none border-r border-white/[0.06] pr-3 text-right text-[#53606d] group-hover:text-[#7f8c98]"
            aria-hidden="true"
          >
            {String(lineIndex + 1).padStart(numberWidth, ' ')}
          </span>
          <code className="whitespace-pre pr-8">
            {tokenizeCodeLine(line, target, path).map((token, tokenIndex) => (
              <span
                key={`${lineIndex}-${tokenIndex}-${token.value}`}
                className={token.kind ? tokenClass[token.kind] : undefined}
              >
                {token.value}
              </span>
            ))}
          </code>
        </div>
      ))}
    </div>
  );
}
