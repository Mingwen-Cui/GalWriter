import { DEFAULT_PROJECT_FILE_NAME } from './constants';

export const formatProjectTimestamp = (timestamp: number) => {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
};

export const buildAutoProjectName = () => `新建项目`;

export const getProjectDisplayName = (projectTitle: string, saveFileName: string) => {
  const normalizedTitle = projectTitle.trim();
  if (normalizedTitle) return normalizedTitle;

  const normalizedFileName = saveFileName.trim();
  if (normalizedFileName && normalizedFileName !== DEFAULT_PROJECT_FILE_NAME)
    return normalizedFileName;

  return '';
};

export const getPersistedProjectName = (projectTitle: string, saveFileName: string) => {
  const displayName = getProjectDisplayName(projectTitle, saveFileName);
  return displayName || buildAutoProjectName();
};
