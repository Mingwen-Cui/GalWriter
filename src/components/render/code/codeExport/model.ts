import type { Node as FlowNode } from '@xyflow/react';

import type {
  RenpyCharacterConfig,
  RenpyExportSettings,
  RenpyVariableConfig,
  RenpyVariableType,
} from './types';

const RENPY_RESERVED = new Set(
  [
    'and',
    'as',
    'assert',
    'async',
    'await',
    'break',
    'class',
    'continue',
    'def',
    'default',
    'define',
    'del',
    'elif',
    'else',
    'except',
    'exec',
    'False',
    'finally',
    'for',
    'from',
    'global',
    'if',
    'import',
    'in',
    'init',
    'is',
    'label',
    'lambda',
    'menu',
    'None',
    'not',
    'or',
    'pass',
    'python',
    'raise',
    'return',
    'scene',
    'show',
    'stop',
    'style',
    'True',
    'try',
    'while',
    'with',
    'yield',
    'renpy',
    'config',
    'store',
    'narrator',
    'start',
  ].map((value) => value.toLowerCase()),
);

export const stableHash = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

export const sanitizeRenpyIdentifier = (value: string, fallback: string) => {
  let normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!normalized || !/^[a-z_]/.test(normalized))
    normalized = `${fallback}_${stableHash(value || fallback).slice(0, 6)}`;
  if (RENPY_RESERVED.has(normalized.toLowerCase())) normalized = `${fallback}_${normalized}`;
  return normalized.slice(0, 48);
};

export const validateRenpyIdentifier = (value: string) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value))
    return 'Code names may contain only letters, numbers, and underscores, and cannot start with a number.';
  if (RENPY_RESERVED.has(value.toLowerCase()))
    return 'This code name conflicts with a Ren’Py or Python reserved name.';
  return '';
};

const stringValue = (node: FlowNode, key: string) =>
  typeof node.data?.[key] === 'string' ? String(node.data[key]).trim() : '';

const defaultCharacter = (node: FlowNode): RenpyCharacterConfig => {
  const displayName =
    stringValue(node, 'characterName') || stringValue(node, 'title') || 'Character';
  const outfits = Array.isArray(node.data?.outfits)
    ? (node.data.outfits as Array<{ name?: string; imageUrl?: string }>)
    : [];
  const expressions = Object.fromEntries(
    outfits
      .filter((item) => item.name && item.imageUrl)
      .map((item) => [String(item.name), String(item.imageUrl)]),
  );
  return {
    sourceNodeId: node.id,
    displayName,
    codeName: sanitizeRenpyIdentifier(displayName, 'character'),
    abbreviation: '',
    defaultSprite:
      outfits.find((item) => item.imageUrl)?.imageUrl ||
      stringValue(node, 'avatarUrl') ||
      undefined,
    expressions,
  };
};

export const createDefaultVariable = (
  index = 0,
  type: RenpyVariableType = 'number',
): RenpyVariableConfig => ({
  id: index === 0 ? 'gw_score' : `variable_${index + 1}`,
  displayName: index === 0 ? 'Score' : `Variable ${index + 1}`,
  codeName: index === 0 ? 'gw_score' : `gw_variable_${index + 1}`,
  type,
  initialValue: type === 'number' ? 0 : type === 'boolean' ? false : '',
});

export const normalizeRenpyExportSettings = (
  nodes: FlowNode[],
  input?: Partial<RenpyExportSettings>,
): RenpyExportSettings => {
  const existingCharacters = new Map(
    (input?.characters || []).map((item) => [item.sourceNodeId, item]),
  );
  const characters = nodes
    .filter((node) => node.type === 'characterNode' && node.data?.hidden !== true)
    .map((node) => {
      const merged = { ...defaultCharacter(node), ...existingCharacters.get(node.id) };
      return {
        ...merged,
        codeName: merged.codeName || defaultCharacter(node).codeName,
        expressions: merged.expressions || {},
      };
    });
  const variables = input?.variables?.length
    ? input.variables.map((variable, index) => ({
        ...createDefaultVariable(index, variable.type),
        ...variable,
        codeName: variable.codeName || createDefaultVariable(index, variable.type).codeName,
      }))
    : [createDefaultVariable()];
  if (!variables.some((variable) => variable.id === 'gw_score'))
    variables.unshift(createDefaultVariable());
  return {
    version: 2,
    splitMode:
      input?.splitMode === 'group' || input?.splitMode === 'background'
        ? input.splitMode
        : 'single',
    characters,
    variables,
    nodes: input?.nodes || {},
    conditions: input?.conditions || {},
  };
};

export const repairRenpyCodeNames = (settings: RenpyExportSettings): RenpyExportSettings => {
  const used = new Set<string>(['narrator', 'start']);
  const unique = (value: string, fallback: string) => {
    const base = sanitizeRenpyIdentifier(value, fallback);
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate.toLowerCase())) candidate = `${base}_${suffix++}`;
    used.add(candidate.toLowerCase());
    return candidate;
  };
  return {
    ...settings,
    characters: settings.characters.map((character) => ({
      ...character,
      codeName: unique(character.codeName || character.displayName, 'character'),
    })),
    variables: settings.variables.map((variable) => ({
      ...variable,
      codeName: unique(variable.codeName || variable.displayName, 'variable'),
    })),
  };
};

export const variableInitialValue = (variable: RenpyVariableConfig) => {
  if (variable.type === 'number') return Number(variable.initialValue) || 0;
  if (variable.type === 'boolean') return Boolean(variable.initialValue);
  return String(variable.initialValue ?? '');
};
