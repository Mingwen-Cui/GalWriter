import { getVideoTextForChinesePreference } from '../i18n';
import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react';
import type { Dispatch, SetStateAction } from 'react';

import type { Language } from '../../../../lib/i18n';
import { buildInteractiveWebZipBlob, exportInteractiveWebZip } from '../../web/webExport';
import { saveRenderedWebPlayer, saveRenderedWebZip } from '../export/tauriRenderAdapter';
import { isTauriRuntime } from '../shared/mediaUtils';
import type { RenderStatus, RenderStyle, WebExportSettings } from '../shared/types';

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
  const exportWebProject = async ({
    format = 'web-zip',
    projectName,
    exportNodes = nodes,
    exportEdges = edges,
  }: {
    format?: 'web-zip' | 'windows-installer';
    projectName?: string;
    exportNodes?: FlowNode[];
    exportEdges?: FlowEdge[];
  } = {}) => {
    if (status === 'rendering') return { exported: false, error: 'Another render operation is already running.' };
    if (format === 'windows-installer' && !isTauriRuntime()) {
      setStatus('error');
      setError(getVideoTextForChinesePreference(isZh, 'webExportWindowsInstallerDesktopRequired'));
      return { exported: false, error: 'Windows player export requires the desktop app.' };
    }
    if (!exportNodes.some((node) => node.type === 'storyNode' && !node.data?.hidden)) {
      setStatus('error');
      setError(
        getVideoTextForChinesePreference(
          isZh,
          'componentsrendervideoVideoRenderModaluseWebProjectExportIsZhText55',
        ),
      );
      return { exported: false, error: 'No visible story cards are available to export.' };
    }
    const exportTitle = projectName?.trim() || webProjectName.trim() || defaultWebProjectName || 'galwriter-web';
    setStatus('rendering');
    setError('');
    setSavedPath('');
    setProgressValue(15);
    setProgress(
      getVideoTextForChinesePreference(
        isZh,
        format === 'windows-installer'
          ? 'webExportPreparingWindowsPlayer'
          : 'componentsrendervideoVideoRenderModaluseWebProjectExportIsZhText63',
      ),
    );

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
        const blob = await buildInteractiveWebZipBlob(exportNodes, exportEdges, options);
        setProgressValue(70);
        setProgress(
          getVideoTextForChinesePreference(
            isZh,
            format === 'windows-installer'
              ? 'webExportSavingWindowsPlayer'
              : 'componentsrendervideoVideoRenderModaluseWebProjectExportIsZhText79',
          ),
        );
        const input = {
          fileName: format === 'windows-installer' ? exportTitle : `${exportTitle}-web`,
          bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
          outputDir: webOutputDir,
        };
        const result =
          format === 'windows-installer'
            ? await saveRenderedWebPlayer(input)
            : await saveRenderedWebZip(input);
        setSavedPath(result.path);
        setStatus('done');
        setProgressValue(100);
        setProgress(
          getVideoTextForChinesePreference(
            isZh,
            format === 'windows-installer'
              ? 'webExportWindowsPlayerDone'
              : 'componentsrendervideoVideoRenderModaluseWebProjectExportIsZhText92',
          ),
        );
        return { exported: true, filePath: result.path, projectName: exportTitle, format };
      } else {
        await exportInteractiveWebZip(exportNodes, exportEdges, options);
        const filePath = `${exportTitle}-web.zip`;
        setSavedPath(filePath);
        setStatus('done');
        setProgressValue(100);
        setProgress(
          getVideoTextForChinesePreference(
            isZh,
            'componentsrendervideoVideoRenderModaluseWebProjectExportIsZhText92',
          ),
        );
        return { exported: true, filePath, projectName: exportTitle, format };
      }
    } catch (error: any) {
      console.error('Web export failed:', error);
      setStatus('error');
      setError(
        error?.message ||
          getVideoTextForChinesePreference(
            isZh,
            format === 'windows-installer'
              ? 'webExportWindowsPlayerFailed'
              : 'componentsrendervideoVideoRenderModaluseWebProjectExportIsZhText96',
          ),
      );
      return { exported: false, error: error?.message || 'Web export failed.' };
    }
  };

  return { exportWebProject };
};
