import type { AssetEntry, RenpyExportSettings, RenpyVariableType } from '../types';

export type IrTrace = { nodeId: string; edgeId?: string };
export type IrSupportLevel = 'full' | 'degraded' | 'unsupported';

export type IrCharacter = {
  sourceNodeId: string;
  codeName: string;
  displayName: string;
  abbreviation: string;
  defaultSpritePath?: string;
  expressions: Record<string, string>;
};

export type IrVariable = {
  id: string;
  codeName: string;
  displayName: string;
  type: RenpyVariableType;
  initialValue: number | boolean | string;
};

export type IrStatement =
  | ({ kind: 'comment'; text: string } & IrTrace)
  | ({ kind: 'background'; assetPath: string; transitionSeconds: number } & IrTrace)
  | ({
      kind: 'character-show';
      characterId: string;
      codeName: string;
      displayName: string;
      expression?: string;
      assetPath: string;
      position: 'left' | 'center' | 'right';
      transitionSeconds: number;
    } & IrTrace)
  | ({
      kind: 'character-update';
      characterId: string;
      codeName: string;
      displayName: string;
      expression?: string;
      assetPath?: string;
      position?: 'left' | 'center' | 'right';
      transitionSeconds: number;
    } & IrTrace)
  | ({ kind: 'character-hide'; characterId: string; codeName: string } & IrTrace)
  | ({
      kind: 'dialogue';
      speakerId?: string;
      speakerCode?: string;
      speakerName?: string;
      expression?: string;
      text: string;
    } & IrTrace)
  | ({
      kind: 'audio';
      channel: 'bgm' | 'sound' | 'voice';
      assetPath: string;
      loop: boolean;
    } & IrTrace)
  | ({ kind: 'video'; assetPath: string } & IrTrace)
  | ({
      kind: 'variable';
      variableId: string;
      codeName: string;
      variableType: RenpyVariableType;
      operation: 'add' | 'subtract' | 'set';
      value: number | boolean | string;
    } & IrTrace)
  | ({ kind: 'todo'; feature: string; detail: string } & IrTrace);

export type IrCondition =
  | { kind: 'range'; variableId: string; codeName: string; min: number; max: number }
  | { kind: 'gte'; variableId: string; codeName: string; value: number }
  | { kind: 'else' };

export type IrControl =
  | { kind: 'jump'; targetLabel: string; targetNodeId: string; edgeId: string }
  | { kind: 'return' }
  | {
      kind: 'choice';
      options: Array<{ text: string; targetLabel: string; targetNodeId: string; edgeId: string }>;
    }
  | {
      kind: 'condition';
      branches: Array<{
        condition: IrCondition;
        targetLabel: string;
        targetNodeId: string;
        edgeId: string;
      }>;
    };

export type IrBlock = {
  nodeId: string;
  label: string;
  title: string;
  chapterId: string;
  statements: IrStatement[];
  control: IrControl;
};

export type IrChapter = { id: string; title: string; sourceRegionId?: string; blocks: IrBlock[] };

export type GalWriterIr = {
  format: 'galwriter-story-ir';
  version: 1;
  metadata: {
    projectName: string;
    entryNodeId: string | null;
    entryLabel: string | null;
    generatedBy: 'GalWriter AI';
  };
  characters: IrCharacter[];
  variables: IrVariable[];
  chapters: IrChapter[];
  assets: AssetEntry[];
  settings: RenpyExportSettings;
};
