import type {
  BackgroundRemovalAIProfile,
  ImageAIProfile,
  TextAIProfile,
  VoiceAIProfile,
} from '../../domain/project';
import type { Language } from '../../lib/i18n';
import type { ProjectExampleTemplate } from '../ProjectPickerModal';

export type PendingProjectAction =
  | { type: 'create' }
  | { type: 'open'; projectId: string }
  | { type: 'import-new' }
  | { type: 'import-example'; template: ProjectExampleTemplate }
  | { type: 'close-window' };

export interface StoryEditorProps {
  appLanguage: Language;
  onAppLanguageChange: (language: Language) => void;
}

export type AIProfileSeed =
  | Partial<TextAIProfile>
  | Partial<ImageAIProfile>
  | Partial<BackgroundRemovalAIProfile>
  | Partial<VoiceAIProfile>;
export type AIProfileUpdates =
  | Partial<TextAIProfile>
  | Partial<ImageAIProfile>
  | Partial<BackgroundRemovalAIProfile>
  | Partial<VoiceAIProfile>;
export type ThemePreference = 'light' | 'dark' | 'system';
