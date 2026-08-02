export type RenpyVariableType = 'number' | 'boolean' | 'string';
export type RenpySplitMode = 'single' | 'group' | 'background';

export type RenpyCharacterConfig = {
  sourceNodeId: string;
  displayName: string;
  codeName: string;
  abbreviation: string;
  defaultSprite?: string;
  expressions: Record<string, string>;
};

export type RenpyVariableConfig = {
  id: string;
  displayName: string;
  codeName: string;
  type: RenpyVariableType;
  initialValue: number | boolean | string;
};

export type RenpyVariableChange = {
  variableId: string;
  operation: 'add' | 'subtract' | 'set';
  value: number | boolean | string;
};

export type RenpyNodeConfig = {
  speakerId?: string;
  expression?: string;
  variableChanges?: RenpyVariableChange[];
};

export type RenpyConditionConfig = {
  variableId: string;
  threshold?: number;
  ranges?: Array<{ id: string; min: number; max: number }>;
};

export type RenpyExportSettings = {
  version: 2;
  splitMode: RenpySplitMode;
  characters: RenpyCharacterConfig[];
  variables: RenpyVariableConfig[];
  nodes: Record<string, RenpyNodeConfig>;
  conditions: Record<string, RenpyConditionConfig>;
};

export type CodeDiagnosticLevel = 'error' | 'warning' | 'info';

export type CodeDiagnostic = {
  id: string;
  level: CodeDiagnosticLevel;
  message: string;
  nodeId?: string;
  assetPath?: string;
};

export type RenpyFile = { path: string; content: string; generated?: boolean };

export type AssetKind = 'image' | 'audio' | 'video';
export type AssetCompatibility = 'compatible' | 'risk' | 'unknown' | 'unreadable';

export type AssetEntry = {
  id: string;
  source: string;
  sourceNodeIds: string[];
  path: string;
  kind: AssetKind;
  extension: string;
  compatibility: AssetCompatibility;
  referenced: boolean;
  note?: string;
};

export type RenpyManifestNode = { file: string; label: string };

export type RenpyProjectPreview = {
  files: RenpyFile[];
  diagnostics: CodeDiagnostic[];
  entryId?: string;
  assets: AssetEntry[];
  manifest: {
    format: 'galwriter-renpy-manifest';
    version: 2;
    entryId: string | null;
    nodes: Record<string, RenpyManifestNode>;
    assets: Array<Omit<AssetEntry, 'source'>>;
  };
  settings: RenpyExportSettings;
};
