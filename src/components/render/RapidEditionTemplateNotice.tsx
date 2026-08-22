import { Download } from 'lucide-react';

import { FULL_BUILD_DOWNLOAD_URL } from '../../lib/appAssets';
import type { Language } from '../../lib/i18n';

type RapidEditionTemplateNoticeProps = {
  language: Language;
  kind: 'cover' | 'preset';
};

const copy = (language: Language, kind: RapidEditionTemplateNoticeProps['kind']) => {
  if (language === 'zh') {
    return {
      title: kind === 'cover' ? '在线下载封面模板' : '在线下载预设模板',
      description: '极速版不内置图片资源，可在线下载完整版安装包使用。',
      action: '下载完整版安装包',
    };
  }
  if (language === 'ja') {
    return {
      title:
        kind === 'cover' ? 'カバーテンプレートをオンラインで入手' : 'プリセットをオンラインで入手',
      description:
        '高速版には画像素材が含まれていません。フル版インストーラーをオンラインで入手できます。',
      action: 'フル版をダウンロード',
    };
  }
  return {
    title: kind === 'cover' ? 'Download cover templates online' : 'Download presets online',
    description:
      'The rapid build does not include image assets. Download the full installer online to use them.',
    action: 'Download full installer',
  };
};

export function RapidEditionTemplateNotice({ language, kind }: RapidEditionTemplateNoticeProps) {
  const text = copy(language, kind);

  return (
    <div className="col-span-full flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/70 px-4 py-4 text-center">
      <div className="text-xs font-black text-indigo-700">{text.title}</div>
      <div className="text-[10px] font-bold leading-4 text-indigo-600/80">{text.description}</div>
      <a
        href={FULL_BUILD_DOWNLOAD_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-[11px] font-black text-white transition-colors hover:bg-indigo-700"
      >
        <Download className="h-3.5 w-3.5" />
        {text.action}
      </a>
    </div>
  );
}
