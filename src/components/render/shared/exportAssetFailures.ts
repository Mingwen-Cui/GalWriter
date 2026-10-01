import type { Language } from '../../../lib/i18n';

export type ExportAssetFailure = {
  kind: 'image' | 'audio' | 'video';
  label: string;
  source: string;
  reason: string;
};

export const formatExportAssetFailures = (
  language: Language,
  format: string,
  failures: ExportAssetFailure[],
) => {
  const details = failures
    .map((failure) => {
      const source = failure.source.startsWith('data:') ? 'embedded data' : failure.source;
      return `- ${failure.kind}: ${failure.label} [${source}] (${failure.reason})`;
    })
    .join('\n');
  if (language === 'zh')
    return `${format}已中止：${failures.length} 个素材无法读取或打包。请检查素材是否仍可访问后重试：\n${details}`;
  if (language === 'ja')
    return `${format}を中止しました。${failures.length} 件の素材を読み込めないか、パッケージ化できません。素材を確認して再試行してください：\n${details}`;
  return `${format} stopped because ${failures.length} asset(s) could not be read or packaged. Check the assets and retry:\n${details}`;
};
