/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReactFlowProvider } from '@xyflow/react';

import { StoryEditor } from './components/StoryEditor';
import { StartupSplash } from './components/StartupSplash';
import { DialogProvider } from './editor-shell/DialogProvider';
import { useState } from 'react';
import type { Language } from './lib/i18n';

export default function App() {
  const [language, setLanguage] = useState<Language>('zh');

  return (
    <DialogProvider language={language}>
      <StartupSplash />
      <ReactFlowProvider>
        <StoryEditor appLanguage={language} onAppLanguageChange={setLanguage} />
      </ReactFlowProvider>
    </DialogProvider>
  );
}
