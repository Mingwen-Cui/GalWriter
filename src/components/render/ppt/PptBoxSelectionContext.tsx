import { createContext } from 'react';

export const PptBoxSelectionContext = createContext<ReadonlySet<string>>(new Set());

export const pptBoxSelectionKey = (target: string, targetId?: string) =>
  `ppt:${target}:${targetId || ''}`;

export const pptManualBoxSelectionKey = (elementId: string) => `manual:${elementId}`;
