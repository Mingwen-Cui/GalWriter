/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReactFlowProvider } from '@xyflow/react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { StoryEditor } from './components/StoryEditor';
import { localPersistenceService } from './editor-services/localPersistenceService';
import { DialogProvider } from './editor-shell/DialogProvider';
import type { Language } from './lib/i18n';

export default function App() {
  const [language, setLanguage] = useState<Language>('zh');
  const languageWasChangedRef = useRef(false);

  useEffect(() => {
    void localPersistenceService
      .loadAppSettings()
      .then((settings) => {
        if (languageWasChangedRef.current) return;
        const savedLanguage = settings.language;
        setLanguage(savedLanguage === 'en' || savedLanguage === 'ja' ? savedLanguage : 'zh');
      })
      .catch((error) => {
        console.error('Failed to load app language', error);
      });
  }, []);

  const handleLanguageChange = useCallback((nextLanguage: Language) => {
    languageWasChangedRef.current = true;
    setLanguage(nextLanguage);
    void localPersistenceService.saveLanguage(nextLanguage).catch((error) => {
      console.error('Failed to save app language', error);
    });
  }, []);

  return (
    <DialogProvider language={language}>
      <ReactFlowProvider>
        <StoryEditor appLanguage={language} onAppLanguageChange={handleLanguageChange} />
      </ReactFlowProvider>
    </DialogProvider>
  );
}
