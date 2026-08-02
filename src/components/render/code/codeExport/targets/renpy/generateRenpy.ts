import { defaultAssetCopies } from '../../assets/assetManifest';
import type { GalWriterIr, IrStatement } from '../../ir/irTypes';
import type { CodeDiagnostic, RenpyFile } from '../../types';
import type { TargetBuild } from '../targetTypes';
import {
  buildManifest,
  capability,
  conditionExpression,
  reportFile,
  serializeLiteral,
  supportDiagnostics,
  targetDiagnostics,
  todoComment,
} from '../targetUtils';

const escapeText = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\{/g, '{{').replace(/\[/g, '[[');
const statementLines = (statement: IrStatement): string[] => {
  if (statement.kind === 'comment') return [`    # ${statement.text}`];
  if (statement.kind === 'background')
    return [`    scene expression Image("${statement.assetPath}") with dissolve`];
  if (statement.kind === 'character-show')
    return [
      `    show expression Image("${statement.assetPath}") as ${statement.codeName}_sprite at ${statement.position}`,
    ];
  if (statement.kind === 'character-update')
    return statement.assetPath
      ? [
          `    show expression Image("${statement.assetPath}") as ${statement.codeName}_sprite at ${statement.position || 'center'}`,
        ]
      : [
          `    # Character update for ${statement.codeName}: position=${statement.position || 'unchanged'}`,
        ];
  if (statement.kind === 'character-hide') return [`    hide ${statement.codeName}_sprite`];
  if (statement.kind === 'dialogue')
    return [`    ${statement.speakerCode || 'narrator'} "${escapeText(statement.text)}"`];
  if (statement.kind === 'audio')
    return [
      statement.channel === 'bgm'
        ? `    play music "${statement.assetPath}"${statement.loop ? '' : ' noloop'}`
        : statement.channel === 'voice'
          ? `    voice "${statement.assetPath}"`
          : `    play sound "${statement.assetPath}"`,
    ];
  if (statement.kind === 'video') return [`    $ renpy.movie_cutscene("${statement.assetPath}")`];
  if (statement.kind === 'variable')
    return [
      `    $ ${statement.codeName} ${statement.operation === 'set' ? '=' : statement.operation === 'add' ? '+=' : '-='} ${serializeLiteral(statement.value, 'python')}`,
    ];
  return [`    ${todoComment(statement, '#')}`];
};

export const generateRenpyTarget = (ir: GalWriterIr): TargetBuild => {
  const capabilities = [
    capability(
      'flow',
      'Core story flow',
      'full',
      'Labels, jumps, choices, returns, variables and range conditions map directly.',
    ),
    capability(
      'characters',
      'Characters and portraits',
      'full',
      'Dialogue speakers and static portraits are generated.',
    ),
    capability(
      'media',
      'Audio and video',
      'full',
      'BGM, sound, voice and movie cutscenes are generated.',
    ),
    capability(
      'animation',
      'Complex inline animation',
      'degraded',
      'Core fades and positions are kept; complex inline actions become TODO comments.',
    ),
  ];
  const diagnostics: CodeDiagnostic[] = [
    ...targetDiagnostics(ir, 'renpy'),
    ...supportDiagnostics('renpy', capabilities),
  ];
  const copies = defaultAssetCopies('renpy', ir.assets);
  const nodes: Record<string, { file: string; label: string }> = {};
  const files: RenpyFile[] = [];
  ir.chapters.forEach((chapter) => {
    const path = `game/scenes/${chapter.id}.rpy`;
    const lines = ['# Generated from GalWriter IR. Do not edit; use custom.rpy.', ''];
    chapter.blocks.forEach((block) => {
      nodes[block.nodeId] = { file: path, label: block.label };
      lines.push(`label ${block.label}:`);
      block.statements.forEach((statement) => lines.push(...statementLines(statement)));
      if (block.control.kind === 'return') lines.push('    return');
      else if (block.control.kind === 'jump') lines.push(`    jump ${block.control.targetLabel}`);
      else if (block.control.kind === 'choice') {
        lines.push('    menu:');
        block.control.options.forEach((option) =>
          lines.push(
            `        "${escapeText(option.text)}":`,
            `            jump ${option.targetLabel}`,
          ),
        );
      } else
        block.control.branches.forEach((branch, index) =>
          lines.push(
            `    ${index === 0 ? 'if' : branch.condition.kind === 'else' ? 'else' : 'elif'}${branch.condition.kind === 'else' ? (index === 0 ? ' True' : '') : ` ${conditionExpression(branch.condition, 'python')}`}:`,
            `        jump ${branch.targetLabel}`,
          ),
        );
      lines.push('');
    });
    files.push({ path, content: `${lines.join('\n')}\n`, generated: true });
  });
  const manifest = buildManifest('renpy', ir, nodes, copies);
  files.unshift(
    {
      path: 'game/script.rpy',
      content: `# Generated entry point.\nlabel start:\n${ir.metadata.entryLabel ? `    jump ${ir.metadata.entryLabel}` : '    return'}\n`,
      generated: true,
    },
    {
      path: 'game/definitions.rpy',
      content: [
        `# Generated from GalWriter IR.`,
        'define narrator = Character(None)',
        ...ir.characters.flatMap((character) => [
          `define ${character.codeName} = Character("${escapeText(character.displayName)}")`,
          ...(character.abbreviation
            ? [`define ${character.abbreviation} = ${character.codeName}`]
            : []),
        ]),
        '',
        ...ir.variables.map(
          (variable) =>
            `default ${variable.codeName} = ${serializeLiteral(variable.initialValue, 'python')}`,
        ),
        '',
      ].join('\n'),
      generated: true,
    },
  );
  files.push(
    {
      path: 'game/custom.rpy.example',
      content: '# Copy to custom.rpy once. GalWriter never exports custom.rpy.\n',
      generated: false,
    },
    {
      path: 'game/galwriter_manifest.json',
      content: `${JSON.stringify(manifest, null, 2)}\n`,
      generated: true,
    },
    reportFile('renpy', ir, diagnostics, capabilities),
    {
      path: 'README.md',
      content:
        '# GalWriter AI Ren’Py project\n\nOpen in Ren’Py Launcher. Copy `game/custom.rpy.example` to `game/custom.rpy` for hand-written code.\n',
      generated: true,
    },
  );
  return { target: 'renpy', files, manifest, diagnostics, capabilities, assetCopies: copies };
};
