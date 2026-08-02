import type { GalWriterIr, IrStatement } from '../../ir/irTypes';
import type { CodeDiagnostic, RenpyFile } from '../../types';
import type { TargetAssetCopy, TargetBuild } from '../targetTypes';
import {
  buildManifest,
  capability,
  conditionExpression,
  escapeAttribute,
  reportFile,
  serializeLiteral,
  supportDiagnostics,
  targetDiagnostics,
  todoComment,
} from '../targetUtils';

const fileName = (path: string) => path.split('/').pop() || path;
const scenarioName = (chapterId: string) => `${chapterId}.ks`;
const assetCopies = (ir: GalWriterIr): TargetAssetCopy[] =>
  ir.assets
    .filter((asset) => asset.referenced)
    .flatMap((asset) =>
      asset.kind === 'audio'
        ? [
            { assetPath: asset.path, targetPath: `data/bgm/${fileName(asset.path)}` },
            { assetPath: asset.path, targetPath: `data/sound/${fileName(asset.path)}` },
          ]
        : [
            {
              assetPath: asset.path,
              targetPath: `data/${asset.kind === 'image' ? 'image/galwriter' : 'video'}/${fileName(asset.path)}`,
            },
          ],
    );

const statementLines = (statement: IrStatement): string[] => {
  if (statement.kind === 'comment') return [`; ${statement.text}`];
  if (statement.kind === 'background')
    return [
      `[bg storage="../image/galwriter/${fileName(statement.assetPath)}" time="${Math.round(statement.transitionSeconds * 1000)}"]`,
    ];
  if (statement.kind === 'character-show')
    return [
      `[chara_mod name="${statement.codeName}" storage="../image/galwriter/${fileName(statement.assetPath)}" time="${Math.round(statement.transitionSeconds * 1000)}"]`,
      `[chara_show name="${statement.codeName}" time="${Math.round(statement.transitionSeconds * 1000)}"]`,
      `; TODO position=${statement.position}; tune x/y with chara_move if needed.`,
    ];
  if (statement.kind === 'character-update')
    return [
      ...(statement.assetPath
        ? [
            `[chara_mod name="${statement.codeName}" storage="../image/galwriter/${fileName(statement.assetPath)}" time="${Math.round(statement.transitionSeconds * 1000)}"]`,
          ]
        : []),
      ...(statement.position
        ? [
            `[chara_move name="${statement.codeName}" time="${Math.round(statement.transitionSeconds * 1000)}"]`,
            `; TODO position=${statement.position}; set target x/y.`,
          ]
        : []),
    ];
  if (statement.kind === 'character-hide') return [`[chara_hide name="${statement.codeName}"]`];
  if (statement.kind === 'dialogue')
    return [
      `[chara_ptext name="${escapeAttribute(statement.speakerName || '')}"]`,
      `${statement.text}[p]`,
    ];
  if (statement.kind === 'audio')
    return [
      statement.channel === 'bgm'
        ? `[playbgm storage="${fileName(statement.assetPath)}" loop="${statement.loop}"]`
        : `[playse storage="${fileName(statement.assetPath)}"${statement.channel === 'voice' ? ' stop="true"' : ''}]`,
    ];
  if (statement.kind === 'video') return [`[movie storage="${fileName(statement.assetPath)}"]`];
  if (statement.kind === 'variable')
    return [
      `[eval exp="f.${statement.codeName} ${statement.operation === 'set' ? '=' : statement.operation === 'add' ? '+=' : '-='} ${escapeAttribute(serializeLiteral(statement.value, 'javascript'))}"]`,
    ];
  return [todoComment(statement, ';')];
};

export const generateTyranoTarget = (ir: GalWriterIr): TargetBuild => {
  const capabilities = [
    capability(
      'flow',
      'Core story flow',
      'full',
      'Labels, cross-file jumps, choices, variables and range conditions use native tags.',
    ),
    capability(
      'characters',
      'Characters and portraits',
      'degraded',
      'Static portraits are generated; precise left/center/right positioning is left as readable TODO comments.',
    ),
    capability(
      'media',
      'Audio and video',
      'full',
      'BGM, voice/sound and movie tags are generated into standard data folders.',
    ),
    capability(
      'animation',
      'Complex inline animation',
      'degraded',
      'Basic transition times are mapped; complex inline actions require manual tags.',
    ),
  ];
  const diagnostics: CodeDiagnostic[] = [
    ...targetDiagnostics(ir, 'tyrano'),
    ...supportDiagnostics('tyrano', capabilities),
  ];
  const copies = assetCopies(ir);
  const chapterByLabel = new Map(
    ir.chapters.flatMap((chapter) =>
      chapter.blocks.map((block) => [block.label, chapter.id] as const),
    ),
  );
  const jump = (label: string) =>
    `[jump storage="${scenarioName(chapterByLabel.get(label) || 'story')}" target="*${label}"]`;
  const nodes: Record<string, { file: string; label: string }> = {};
  const files: RenpyFile[] = ir.chapters.map((chapter) => {
    const path = `data/scenario/${scenarioName(chapter.id)}`;
    const lines = ['; Generated from GalWriter IR. Edit custom.ks for hand-written code.', ''];
    chapter.blocks.forEach((block) => {
      nodes[block.nodeId] = { file: path, label: block.label };
      lines.push(`*${block.label}`);
      block.statements.forEach((statement) => lines.push(...statementLines(statement)));
      if (block.control.kind === 'return') lines.push('[s]');
      else if (block.control.kind === 'jump') lines.push(jump(block.control.targetLabel));
      else if (block.control.kind === 'choice') {
        block.control.options.forEach((option) =>
          lines.push(
            `[glink text="${escapeAttribute(option.text)}" storage="${scenarioName(chapterByLabel.get(option.targetLabel) || 'story')}" target="*${option.targetLabel}"]`,
          ),
        );
        lines.push('[s]');
      } else {
        block.control.branches.forEach((branch, index) =>
          lines.push(
            branch.condition.kind === 'else'
              ? index === 0
                ? '[if exp="true"]'
                : '[else]'
              : `[${index === 0 ? 'if' : 'elsif'} exp="${escapeAttribute(conditionExpression(branch.condition, 'javascript'))}"]`,
            jump(branch.targetLabel),
          ),
        );
        lines.push('[endif]');
      }
      lines.push('');
    });
    return { path, content: `${lines.join('\n')}\n`, generated: true };
  });
  const entryChapter = ir.metadata.entryLabel
    ? chapterByLabel.get(ir.metadata.entryLabel) || 'story'
    : 'story';
  const definitions = ir.characters.flatMap((character) =>
    character.defaultSpritePath
      ? [
          `[chara_new name="${character.codeName}" storage="../image/galwriter/${fileName(character.defaultSpritePath)}" jname="${escapeAttribute(character.displayName)}"]`,
        ]
      : [`; TODO character ${character.codeName} has no default portrait.`],
  );
  const initialVariables = ir.variables.map(
    (variable) =>
      `[eval exp="f.${variable.codeName} = ${escapeAttribute(serializeLiteral(variable.initialValue, 'javascript'))}"]`,
  );
  files.unshift({
    path: 'data/scenario/first.ks',
    content: [
      `; GalWriter AI TyranoScript entry`,
      ...definitions,
      ...initialVariables,
      ir.metadata.entryLabel
        ? `[jump storage="${scenarioName(entryChapter)}" target="*${ir.metadata.entryLabel}"]`
        : '[s]',
      '',
    ].join('\n'),
    generated: true,
  });
  const manifest = buildManifest('tyrano', ir, nodes, copies);
  files.push(
    {
      path: 'data/scenario/custom.ks.example',
      content: '; Copy to custom.ks once and keep it when replacing generated files.\n',
      generated: false,
    },
    {
      path: 'galwriter_manifest.json',
      content: `${JSON.stringify(manifest, null, 2)}\n`,
      generated: true,
    },
    reportFile('tyrano', ir, diagnostics, capabilities),
    {
      path: 'README.md',
      content:
        '# GalWriter AI TyranoScript project\n\nCopy these files into a TyranoScript V6 project. `data/scenario/first.ks` is the entry scenario. Copy `custom.ks.example` once for hand-written tags.\n',
      generated: true,
    },
  );
  return { target: 'tyrano', files, manifest, diagnostics, capabilities, assetCopies: copies };
};
