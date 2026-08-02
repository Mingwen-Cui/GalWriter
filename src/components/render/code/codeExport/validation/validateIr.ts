import { assetDiagnostics } from '../assets';
import type { GalWriterIr } from '../ir/irTypes';
import { validateRenpyIdentifier } from '../model';
import type { CodeDiagnostic } from '../types';

export const validateIr = (ir: GalWriterIr): CodeDiagnostic[] => {
  const diagnostics: CodeDiagnostic[] = [];
  if (!ir.metadata.entryNodeId || !ir.metadata.entryLabel)
    diagnostics.push({
      id: 'ir-no-entry',
      level: 'error',
      message: 'The IR has no visible story entry.',
    });
  const labels = new Map<string, string>();
  ir.chapters
    .flatMap((chapter) => chapter.blocks)
    .forEach((block) => {
      const previous = labels.get(block.label);
      if (previous)
        diagnostics.push({
          id: `ir-label-${block.nodeId}`,
          level: 'error',
          message: `Duplicate IR label ${block.label} conflicts with ${previous}.`,
          nodeId: block.nodeId,
        });
      else labels.set(block.label, block.nodeId);
      block.statements.forEach((statement) => {
        if (statement.kind === 'todo')
          diagnostics.push({
            id: `ir-todo-${statement.nodeId}-${statement.feature}`,
            level: statement.feature.startsWith('missing-') ? 'error' : 'warning',
            message: `IR TODO (${statement.feature}): ${statement.detail}`,
            nodeId: statement.nodeId,
          });
        if (
          statement.kind === 'variable' &&
          (statement.operation === 'add' || statement.operation === 'subtract') &&
          statement.variableType !== 'number'
        )
          diagnostics.push({
            id: `ir-variable-operation-${statement.nodeId}-${statement.variableId}`,
            level: 'error',
            message: `Only number variables support ${statement.operation}.`,
            nodeId: statement.nodeId,
          });
      });
    });
  ir.chapters
    .flatMap((chapter) => chapter.blocks)
    .forEach((block) => {
      const targets =
        block.control.kind === 'jump'
          ? [block.control]
          : block.control.kind === 'choice'
            ? block.control.options
            : block.control.kind === 'condition'
              ? block.control.branches
              : [];
      targets.forEach((target) => {
        if (!labels.has(target.targetLabel))
          diagnostics.push({
            id: `ir-target-${block.nodeId}-${target.edgeId}`,
            level: 'error',
            message: `Control flow target ${target.targetLabel} does not exist in the IR.`,
            nodeId: block.nodeId,
          });
      });
      if (
        block.control.kind === 'condition' &&
        !block.control.branches.some((branch) => branch.condition.kind === 'else')
      )
        diagnostics.push({
          id: `ir-condition-fallback-${block.nodeId}`,
          level: 'error',
          message: 'Condition block has no fallback branch.',
          nodeId: block.nodeId,
        });
    });
  const names = new Map<string, string>();
  [
    ...ir.characters.map((item) => ({
      id: item.sourceNodeId,
      code: item.codeName,
      kind: 'character',
    })),
    ...ir.variables.map((item) => ({ id: item.id, code: item.codeName, kind: 'variable' })),
  ].forEach((item) => {
    const invalid = validateRenpyIdentifier(item.code);
    if (invalid)
      diagnostics.push({
        id: `ir-code-${item.kind}-${item.id}`,
        level: 'error',
        message: invalid,
        nodeId: item.kind === 'character' ? item.id : undefined,
      });
    const previous = names.get(item.code.toLowerCase());
    if (previous)
      diagnostics.push({
        id: `ir-code-duplicate-${item.kind}-${item.id}`,
        level: 'error',
        message: `Duplicate code name ${item.code} conflicts with ${previous}.`,
      });
    else names.set(item.code.toLowerCase(), `${item.kind} ${item.id}`);
  });
  diagnostics.push(...assetDiagnostics(ir.assets));
  return diagnostics;
};
