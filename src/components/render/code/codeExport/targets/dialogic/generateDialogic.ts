import { defaultAssetCopies, targetPathForAsset } from '../../assets/assetManifest';
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

const statementLines = (statement: IrStatement): string[] => {
  if (statement.kind === 'comment') return [`# ${statement.text}`];
  if (statement.kind === 'background')
    return [
      `[background path="${targetPathForAsset('dialogic', statement.assetPath, 'image')}" fade="${statement.transitionSeconds}"]`,
    ];
  if (statement.kind === 'character-show')
    return [
      `join ${statement.codeName}${statement.expression ? ` (${statement.expression})` : ''} ${statement.position} [fade_time="${statement.transitionSeconds}"]`,
    ];
  if (statement.kind === 'character-update')
    return [
      `update ${statement.codeName}${statement.expression ? ` (${statement.expression})` : ''}${statement.position ? ` ${statement.position}` : ''} [fade_time="${statement.transitionSeconds}"]`,
    ];
  if (statement.kind === 'character-hide') return [`leave ${statement.codeName}`];
  if (statement.kind === 'dialogue')
    return [
      `${statement.speakerCode ? `${statement.speakerCode}${statement.expression ? ` (${statement.expression})` : ''}: ` : ''}${statement.text}`,
    ];
  if (statement.kind === 'variable')
    return [
      `set {${statement.codeName}} ${statement.operation === 'set' ? '=' : statement.operation === 'add' ? '+=' : '-='} ${serializeLiteral(statement.value, 'godot')}`,
    ];
  if (statement.kind === 'audio')
    return [
      `# TODO [${statement.channel}] Dialogic audio event must be configured for ${targetPathForAsset('dialogic', statement.assetPath, 'audio')}`,
    ];
  if (statement.kind === 'video')
    return [
      `# TODO [video] Add a Dialogic custom event or Godot signal for ${targetPathForAsset('dialogic', statement.assetPath, 'video')}`,
    ];
  return [todoComment(statement, '#')];
};

export const generateDialogicTarget = (ir: GalWriterIr): TargetBuild => {
  const capabilities = [
    capability(
      'flow',
      'Core story flow',
      'full',
      'Native timeline labels, jumps, choices, variables and indentation-based conditions are generated.',
    ),
    capability(
      'characters',
      'Characters and portraits',
      'degraded',
      'Join/update/leave syntax is supported, but .dch character resources and portrait presets must be created in Dialogic.',
    ),
    capability(
      'background',
      'Backgrounds',
      'full',
      'Background events use Godot res:// asset paths.',
    ),
    capability(
      'media',
      'Audio and video',
      'unsupported',
      'Dialogic project-specific audio/video events are emitted as explicit TODO comments and report items.',
    ),
    capability(
      'animation',
      'Complex inline animation',
      'degraded',
      'Basic fade and positions are kept; complex inline actions require manual Dialogic events.',
    ),
  ];
  const mediaDiagnostics: CodeDiagnostic[] = ir.chapters
    .flatMap((chapter) => chapter.blocks)
    .flatMap((block) =>
      block.statements
        .filter((statement) => statement.kind === 'audio' || statement.kind === 'video')
        .map((statement) => ({
          id: `dialogic-media-${block.nodeId}-${statement.kind}-${'channel' in statement ? statement.channel : 'video'}`,
          level: 'warning' as const,
          message: `Dialogic requires manual ${statement.kind === 'video' ? 'video' : statement.channel} event setup for ${statement.assetPath}.`,
          nodeId: block.nodeId,
        })),
    );
  const diagnostics = [
    ...targetDiagnostics(ir, 'dialogic'),
    ...mediaDiagnostics,
    ...supportDiagnostics('dialogic', capabilities),
  ];
  const copies = defaultAssetCopies('dialogic', ir.assets);
  const chapterByLabel = new Map(
    ir.chapters.flatMap((chapter) =>
      chapter.blocks.map((block) => [block.label, chapter.id] as const),
    ),
  );
  const jump = (label: string) => `jump ${chapterByLabel.get(label) || 'story'}/${label}`;
  const nodes: Record<string, { file: string; label: string }> = {};
  const files: RenpyFile[] = ir.chapters.map((chapter) => {
    const path = `timelines/${chapter.id}.dtl`;
    const lines = ['# Generated from GalWriter IR.', ''];
    chapter.blocks.forEach((block) => {
      nodes[block.nodeId] = { file: path, label: block.label };
      lines.push(`label ${block.label}`);
      block.statements.forEach((statement) => lines.push(...statementLines(statement)));
      if (block.control.kind === 'return') lines.push('return');
      else if (block.control.kind === 'jump') lines.push(jump(block.control.targetLabel));
      else if (block.control.kind === 'choice')
        block.control.options.forEach((option) =>
          lines.push(`- ${option.text}`, `\t${jump(option.targetLabel)}`),
        );
      else
        block.control.branches.forEach((branch, index) =>
          lines.push(
            branch.condition.kind === 'else'
              ? index === 0
                ? 'if true:'
                : 'else:'
              : `${index === 0 ? 'if' : 'elif'} ${conditionExpression(branch.condition, 'dialogic')}:`,
            `\t${jump(branch.targetLabel)}`,
          ),
        );
      lines.push('');
    });
    return { path, content: `${lines.join('\n')}\n`, generated: true };
  });
  const entryChapter = ir.metadata.entryLabel
    ? chapterByLabel.get(ir.metadata.entryLabel) || 'story'
    : 'story';
  files.unshift(
    {
      path: 'timelines/start.dtl',
      content: [
        '# GalWriter AI Dialogic entry',
        ...ir.variables.map(
          (variable) =>
            `set {${variable.codeName}} = ${serializeLiteral(variable.initialValue, 'godot')}`,
        ),
        ir.metadata.entryLabel ? `jump ${entryChapter}/${ir.metadata.entryLabel}` : 'return',
        '',
      ].join('\n'),
      generated: true,
    },
    {
      path: 'project.godot',
      content: `[application]\nconfig/name="${ir.metadata.projectName.replace(/"/g, '\\"')}"\n\n[rendering]\nrenderer/rendering_method="gl_compatibility"\n`,
      generated: true,
    },
    {
      path: 'dialogic_setup/characters.json',
      content: `${JSON.stringify(
        ir.characters.map((character) => ({
          id: character.codeName,
          displayName: character.displayName,
          portraits: character.expressions,
          defaultPortrait: character.defaultSpritePath,
        })),
        null,
        2,
      )}\n`,
      generated: true,
    },
    {
      path: 'dialogic_setup/variables.json',
      content: `${JSON.stringify(ir.variables, null, 2)}\n`,
      generated: true,
    },
  );
  const manifest = buildManifest('dialogic', ir, nodes, copies);
  files.push(
    {
      path: 'galwriter_manifest.json',
      content: `${JSON.stringify(manifest, null, 2)}\n`,
      generated: true,
    },
    reportFile('dialogic', ir, diagnostics, capabilities),
    {
      path: 'README.md',
      content:
        '# GalWriter AI Godot + Dialogic 2 export\n\n1. Open this minimal Godot project or copy `timelines/` and `assets/` into an existing project.\n2. Install Dialogic 2.\n3. Create Dialogic variables and `.dch` character resources using `dialogic_setup/*.json`.\n4. Import the `.dtl` timelines and start `timelines/start.dtl`.\n5. Resolve every TODO for audio/video or project-specific presentation events.\n',
      generated: true,
    },
  );
  return { target: 'dialogic', files, manifest, diagnostics, capabilities, assetCopies: copies };
};
