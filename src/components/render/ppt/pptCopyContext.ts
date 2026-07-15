import { createContext, useContext } from 'react';

import type { PptCopy } from './i18n';
import type { PptWorkspaceCopy } from './i18n/index';

export type PptCopyContextValue = PptCopy & PptWorkspaceCopy;

export const PptCopyContext = createContext<PptCopyContextValue | null>(null);

export const usePptCopy = () => {
  const value = useContext(PptCopyContext);
  if (!value) throw new Error('PptCopyContext is missing.');
  return value;
};
