import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react';
import type { Dispatch, SetStateAction } from 'react';

import type { Language } from '../../../../lib/i18n';
import { buildInteractiveWebZipBlob, exportInteractiveWebZip } from '../../web/webExport';
import { saveRenderedWebZip } from '../export/tauriRenderAdapter';
import { isTauriRuntime } from '../shared/mediaUtils';
import type {
  RenderStatus,
  RenderStyle,
  WebExportSettings,
} from '../shared/types';

export const useWebProjectExport = ({
  nodes,
  edges,
  status,
  language,
  isZh,
  webProjectName,
  defaultWebProjectName,
  webRenderStyle,
  webChoiceColor,
  webChoiceTextColor,
  webSettings,
  webOutputDir,
  setStatus,
  setError,
  setSavedPath,
  setProgress,
  setProgressValue,
}: {
  nodes: FlowNode[];
  edges: FlowEdge[];
  status: RenderStatus;
  language: Language;
  isZh: boolean;
  webProjectName: string;
  defaultWebProjectName: string;
  webRenderStyle: RenderStyle;
  webChoiceColor: string;
  webChoiceTextColor: string;
  webSettings: WebExportSettings;
  webOutputDir: string;
  setStatus: Dispatch<SetStateAction<RenderStatus>>;
  setError: Dispatch<SetStateAction<string>>;
  setSavedPath: Dispatch<SetStateAction<string>>;
  setProgress: Dispatch<SetStateAction<string>>;
  setProgressValue: Dispatch<SetStateAction<number>>;
}) => {
  const exportWebProject = async () => {
    if (status === 'rendering') return;
    if (!nodes.some((node) => node.type === 'storyNode' && !node.data?.hidden)) {
      setStatus('error');
      setError(isZh ? '没有可导出的剧本节点' : 'No story nodes to export');
      return;
    }
    const exportTitle = webProjectName.trim() || defaultWebProjectName || 'galwriter-web';
    setStatus('rendering');
    setError('');
    setSavedPath('');
    setProgressValue(15);
    setProgress(isZh ? '正在生成网页 ZIP...' : 'Generating web ZIP...');

    try {
      const options = {
        projectName: exportTitle,
        language,
        style: {
          ...webRenderStyle,
          choiceColor: webChoiceColor,
          choiceTextColor: webChoiceTextColor,
        },
        settings: webSettings,
      };
      if (isTauriRuntime()) {
        const blob = await buildInteractiveWebZipBlob(nodes, edges, options);
        setProgressValue(70);
        setProgress(isZh ? '正在保存网页 ZIP...' : 'Saving web ZIP...');
        const result = await saveRenderedWebZip({
          fileName: `${exportTitle}-web`,
          bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
          outputDir: webOutputDir,
        });
        setSavedPath(result.path);
      } else {
        await exportInteractiveWebZip(nodes, edges, options);
        setSavedPath(`${exportTitle}-web.zip`);
      }
      setStatus('done');
      setProgressValue(100);
      setProgress(isZh ? '网页 ZIP 已导出' : 'Web ZIP exported');
    } catch (error: any) {
      console.error('Web export failed:', error);
      setStatus('error');
      setError(error?.message || (isZh ? '网页导出失败' : 'Web export failed'));
    }
  };

  return { exportWebProject };
};
