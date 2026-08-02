import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react';
import JSZip from 'jszip';

export type CodeDiagnosticLevel = 'error' | 'warning' | 'info';

export type CodeDiagnostic = {
  id: string;
  level: CodeDiagnosticLevel;
  message: string;
  nodeId?: string;
};

export type RenpyFile = { path: string; content: string };

export type RenpyProjectPreview = {
  files: RenpyFile[];
  diagnostics: CodeDiagnostic[];
  entryId?: string;
  assets: AssetEntry[];
};

const safeFilePart = (value: string, fallback = 'galwriter') =>
  value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || fallback;

const safeIdentifier = (value: string, fallback = 'node') => {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return /^[a-z_]/.test(normalized) ? normalized.slice(0, 48) : `${fallback}_${normalized.slice(0, 42)}`;
};

const escapeRenpy = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const htmlToText = (value: unknown) => {
  if (typeof value !== 'string') return '';
  if (!/[<>&]/.test(value)) return value.trim();
  const documentValue = typeof document === 'undefined' ? null : document;
  if (!documentValue) return value.replace(/<[^>]+>/g, '').trim();
  const wrapper = documentValue.createElement('div');
  wrapper.innerHTML = value.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/p>/gi, '\n');
  return (wrapper.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
};

const getString = (data: Record<string, unknown> | undefined, key: string) =>
  typeof data?.[key] === 'string' ? data[key].trim() : '';

const isStory = (node: FlowNode) => node.type === 'storyNode' && node.data?.hidden !== true;
const isCondition = (node: FlowNode) => node.type === 'numberConditionNode' && node.data?.hidden !== true;
const labelFor = (id: string) => `gw_${safeIdentifier(id, 'story')}`;

const inferChoiceLabel = (edge: FlowEdge, target: FlowNode | undefined, index: number, count: number) =>
  getString(edge.data, 'label') ||
  getString(target?.data, 'title') ||
  (count === 1 ? 'Continue' : `Option ${index + 1}`);

const assetExtension = (url: string, fallback: string) => {
  const dataMime = url.match(/^data:([^;,]+)/i)?.[1]?.toLowerCase();
  const fromMime: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
    'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'video/mp4': 'mp4', 'video/webm': 'webm',
  };
  if (dataMime && fromMime[dataMime]) return fromMime[dataMime];
  return url.split('?')[0].split('#')[0].match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase() || fallback;
};

type AssetKind = 'image' | 'audio' | 'video';
type AssetEntry = { source: string; path: string; kind: AssetKind };

const isMaterializable = (url: string) =>
  url.startsWith('blob:') || url.startsWith('data:') || /^https?:\/\//i.test(url) || /^\.?\//.test(url);

const createAssetRegistry = () => {
  const entries = new Map<string, AssetEntry>();
  const register = (url: string, kind: AssetKind, hint: string) => {
    if (!url) return '';
    const existing = entries.get(url);
    if (existing) return existing.path;
    const directory = kind === 'image' ? 'images' : kind === 'audio' ? 'audio' : 'movies';
    const path = `${directory}/${safeFilePart(hint, kind)}-${entries.size + 1}.${assetExtension(url, kind === 'image' ? 'png' : kind === 'audio' ? 'ogg' : 'mp4')}`;
    entries.set(url, { source: url, path, kind });
    return path;
  };
  return { entries, register };
};

export function buildRenpyProjectPreview(nodes: FlowNode[], edges: FlowEdge[]): RenpyProjectPreview {
  const diagnostics: CodeDiagnostic[] = [];
  const runtimeNodes = nodes.filter((node) => isStory(node) || isCondition(node));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const runtimeIds = new Set(runtimeNodes.map((node) => node.id));
  const entry = runtimeNodes.find((node) => node.data?.isRoot) || runtimeNodes.find(isStory);
  const assets = createAssetRegistry();

  if (!entry) {
    diagnostics.push({ id: 'no-entry', level: 'error', message: 'No visible story node is available as the game entry.' });
  }

  edges.forEach((edge) => {
    if (!runtimeIds.has(edge.source) || !runtimeIds.has(edge.target)) {
      diagnostics.push({
        id: `invalid-edge-${edge.id}`,
        level: 'warning',
        message: 'This connection points to a non-runtime or hidden node and will not be exported.',
        nodeId: edge.source,
      });
    }
  });

  const characterDefinitions = new Map<string, { code: string; display: string }>();
  nodes.filter((node) => node.type === 'characterNode').forEach((node) => {
    const display = getString(node.data, 'characterName');
    if (display) characterDefinitions.set(node.id, { code: safeIdentifier(display, 'character'), display });
  });

  const definitionLines = [
    '# This file is generated by GalWriter AI. Edit custom.rpy for hand-written code.',
    'define narrator = Character(None)',
    ...[...characterDefinitions.values()].map(({ code, display }) => `define ${code} = Character("${escapeRenpy(display)}")`),
    '',
    'default gw_score = 0',
  ];

  const scriptLines = [
    '# Generated by GalWriter AI. This file can be regenerated safely.',
    'label start:',
    entry ? `    jump ${labelFor(entry.id)}` : '    return',
    '',
  ];

  runtimeNodes.forEach((node) => {
    const data = node.data || {};
    const outgoing = edges.filter((edge) => edge.source === node.id && runtimeIds.has(edge.target));
    scriptLines.push(`label ${labelFor(node.id)}:`, `    # [GalWriter node: ${node.id}] ${getString(data, 'title')}`);

    if (isCondition(node)) {
      const threshold = typeof data.threshold === 'number' ? data.threshold : 0;
      const ranges = Array.isArray(data.ranges) ? data.ranges.filter((range): range is { id: string; min: number; max: number } =>
        !!range && typeof range.id === 'string' && typeof range.min === 'number' && typeof range.max === 'number') : [];
      const branches = ranges.map((range) => ({
        condition: `${range.min} <= gw_score <= ${range.max}`,
        edge: outgoing.find((edge) => edge.sourceHandle === `out-range-${range.id}`),
      }));
      branches.push({ condition: `gw_score >= ${threshold}`, edge: outgoing.find((edge) => edge.sourceHandle === 'out-greater') });
      branches.push({ condition: 'True', edge: outgoing.find((edge) => edge.sourceHandle === 'out-less-equal') });
      branches.forEach((branch, index) => {
        if (!branch.edge) {
          diagnostics.push({ id: `condition-${node.id}-${index}`, level: 'error', message: `A condition output is not connected (${branch.condition}).`, nodeId: node.id });
          return;
        }
        scriptLines.push(`    ${index === 0 ? 'if' : branch.condition === 'True' ? 'else' : 'elif'}${branch.condition === 'True' ? '' : ` ${branch.condition}`}:`, `        jump ${labelFor(branch.edge.target)}`);
      });
      scriptLines.push('');
      return;
    }

    const imageUrl = getString(data, 'imageUrl');
    const videoUrl = getString(data, 'videoUrl');
    const audioUrl = getString(data, 'audioUrl');
    if (imageUrl) scriptLines.push(`    scene expression Image("${assets.register(imageUrl, 'image', getString(data, 'title') || node.id)}") with dissolve`);
    if (videoUrl) {
      const videoPath = assets.register(videoUrl, 'video', getString(data, 'title') || node.id);
      scriptLines.push(`    $ renpy.movie_cutscene("${videoPath}")`);
    }
    if (audioUrl) scriptLines.push(`    voice "${assets.register(audioUrl, 'audio', getString(data, 'title') || node.id)}"`);
    const music = data.backgroundMusic as { url?: unknown; loop?: unknown } | undefined;
    if (typeof music?.url === 'string' && music.url.trim()) {
      scriptLines.push(`    play music "${assets.register(music.url, 'audio', `bgm-${node.id}`)}"${music.loop === false ? ' noloop' : ''}`);
    }

    const presentation = data.presentation as { characters?: Array<{ sourceNodeId?: string; name?: string; position?: string; imageUrl?: string }> } | undefined;
    presentation?.characters?.forEach((character) => {
      const defined = character.sourceNodeId ? characterDefinitions.get(character.sourceNodeId) : undefined;
      const name = defined?.display || character.name || 'Character';
      const sprite = character.imageUrl ? assets.register(character.imageUrl, 'image', name) : '';
      if (sprite) scriptLines.push(`    show expression Image("${sprite}") at ${character.position === 'right' ? 'right' : character.position === 'center' ? 'truecenter' : 'left'}`);
    });

    const text = htmlToText(data.text);
    if (text) text.split('\n').filter(Boolean).forEach((line) => scriptLines.push(`    narrator "${escapeRenpy(line)}"`));
    if (typeof data.nodeValue === 'number' && data.nodeValue !== 0) scriptLines.push(`    $ gw_score += ${data.nodeValue}`);

    if (outgoing.length === 0) {
      scriptLines.push('    return', '');
    } else if (outgoing.length === 1) {
      scriptLines.push(`    jump ${labelFor(outgoing[0].target)}`, '');
    } else {
      scriptLines.push('    menu:');
      outgoing.forEach((edge, index) => {
        scriptLines.push(`        "${escapeRenpy(inferChoiceLabel(edge, nodeById.get(edge.target), index, outgoing.length))}":`, `            jump ${labelFor(edge.target)}`);
      });
      scriptLines.push('');
    }
  });

  const manifest = {
    format: 'galwriter-renpy-manifest', version: 1, entryId: entry?.id || null,
    labels: Object.fromEntries(runtimeNodes.map((node) => [node.id, labelFor(node.id)])),
    assets: [...assets.entries.values()].map(({ source: _source, ...entryValue }) => entryValue),
  };
  const reportLines = [
    '# GalWriter AI code export report', '',
    `- Entry: ${entry?.id || 'not found'}`,
    `- Runtime nodes: ${runtimeNodes.length}`,
    `- Errors: ${diagnostics.filter((item) => item.level === 'error').length}`,
    `- Warnings: ${diagnostics.filter((item) => item.level === 'warning').length}`,
    '',
    ...diagnostics.map((item) => `- **${item.level.toUpperCase()}**${item.nodeId ? ` (${item.nodeId})` : ''}: ${item.message}`),
  ];
  return {
    entryId: entry?.id,
    diagnostics,
    assets: [...assets.entries.values()],
    files: [
      { path: 'game/script.rpy', content: scriptLines.join('\n') },
      { path: 'game/definitions.rpy', content: definitionLines.join('\n') + '\n' },
      { path: 'game/custom.rpy', content: '# Put hand-written Ren\'Py code here. GalWriter AI will not overwrite this file.\n' },
      { path: 'game/galwriter_manifest.json', content: JSON.stringify(manifest, null, 2) + '\n' },
      { path: 'CODE_EXPORT_REPORT.md', content: reportLines.join('\n') + '\n' },
      { path: 'README.md', content: '# GalWriter AI Ren\'Py project\n\nOpen this folder with the Ren\'Py Launcher, then choose **Launch Project**.\n' },
    ],
  };
}

export async function buildRenpyProjectZip(nodes: FlowNode[], edges: FlowEdge[], projectName: string) {
  const preview = buildRenpyProjectPreview(nodes, edges);
  if (preview.diagnostics.some((item) => item.level === 'error')) {
    throw new Error('Fix code export errors before creating the Ren\'Py project.');
  }
  const zip = new JSZip();
  preview.files.forEach((file) => zip.file(file.path, file.content));
  await Promise.all(preview.assets.filter((asset) => isMaterializable(asset.source)).map(async (asset) => {
    try {
      const response = await fetch(asset.source);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      zip.file(`game/${asset.path}`, await response.blob());
    } catch (error) {
      throw new Error(`Could not package a referenced asset: ${asset.source} (${error instanceof Error ? error.message : 'unknown error'})`);
    }
  }));
  return { blob: await zip.generateAsync({ type: 'blob' }), fileName: `${safeFilePart(projectName, 'galwriter')}-renpy.zip`, preview };
}
