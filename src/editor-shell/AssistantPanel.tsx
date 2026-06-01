import {
  BrainCircuit,
  ChevronDown,
  Download,
  FileText,
  Loader2,
  Mic,
  Plus,
  PlusCircle,
  Redo2,
  Send,
  Trash2,
  Undo2,
  UploadCloud,
  X,
} from 'lucide-react';
import type {
  Dispatch,
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
  SetStateAction,
} from 'react';
import { useEffect, useRef, useState } from 'react';

import type { AssistantMessage, AssistantTask } from '../editor-state/editorConfig';
import type { AssistantDocument } from '../lib/documentReader';
import type { Language } from '../lib/i18n';

interface AssistantPanelProps {
  assistantOpen: boolean;
  isMobile: boolean;
  assistantPanelWidth: number;
  assistantLoading: boolean;
  assistantListening: boolean;
  assistantDocuments: AssistantDocument[];
  assistantDocumentLoading: boolean;
  assistantInput: string;
  selectedAssistantTargetNodesCount: number;
  assistantTasks: AssistantTask[];
  activeAssistantTaskId: string;
  assistantMessages: AssistantMessage[];
  assistantMessagesRef: MutableRefObject<HTMLDivElement | null>;
  setAssistantOpen: Dispatch<SetStateAction<boolean>>;
  setAssistantInput: Dispatch<SetStateAction<string>>;
  setActiveAssistantTaskId: Dispatch<SetStateAction<string>>;
  handleNewAssistantTask: () => void;
  handleRenameAssistantTask: (taskId: string, title: string) => void;
  handleCloseAssistantTask: (taskId: string) => void;
  handleAssistantSend: (overrideText?: string) => Promise<void>;
  handleAssistantDocumentUpload: (files: FileList | null) => Promise<void>;
  handleRemoveAssistantDocument: (documentId: string) => void;
  handleAssistantVoiceInput: () => void;
  toggleAssistantThought: (messageId: string) => void;
  handleAssistantResizePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handleAssistantResizePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handleAssistantResizePointerUp: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  language: Language;
}

export function AssistantPanel({
  assistantOpen,
  isMobile,
  assistantPanelWidth,
  assistantLoading,
  assistantListening,
  assistantDocuments,
  assistantDocumentLoading,
  assistantInput,
  selectedAssistantTargetNodesCount,
  assistantTasks,
  activeAssistantTaskId,
  assistantMessages,
  assistantMessagesRef,
  setAssistantOpen,
  setAssistantInput,
  setActiveAssistantTaskId,
  handleNewAssistantTask,
  handleRenameAssistantTask,
  handleCloseAssistantTask,
  handleAssistantSend,
  handleAssistantDocumentUpload,
  handleRemoveAssistantDocument,
  handleAssistantVoiceInput,
  toggleAssistantThought,
  handleAssistantResizePointerDown,
  handleAssistantResizePointerMove,
  handleAssistantResizePointerUp,
  undo,
  redo,
  canUndo,
  canRedo,
  language,
}: AssistantPanelProps) {
  const [shouldRender, setShouldRender] = useState(assistantOpen);
  const [panelVisible, setPanelVisible] = useState(assistantOpen);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState('');
  const [documentUploadOpen, setDocumentUploadOpen] = useState(false);
  const [documentDragActive, setDocumentDragActive] = useState(false);
  const documentInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (assistantOpen) {
      setShouldRender(true);
      const frame = window.requestAnimationFrame(() => setPanelVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }

    setPanelVisible(false);
    setShouldRender(false);
  }, [assistantOpen]);

  if (!shouldRender) return null;

  const startRenamingTask = (task: AssistantTask) => {
    setEditingTaskId(task.id);
    setEditingTaskTitle(task.title);
  };

  const commitRenamingTask = () => {
    if (!editingTaskId) return;
    handleRenameAssistantTask(editingTaskId, editingTaskTitle);
    setEditingTaskId(null);
    setEditingTaskTitle('');
  };

  const uploadAccept =
    '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.markdown,.csv,.tsv,.json,.xml,.html,.htm,.rtf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/*';

  const handleDocumentFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    void handleAssistantDocumentUpload(files);
    setDocumentUploadOpen(false);
    setDocumentDragActive(false);
  };

  return (
    <aside
      className={`${
        isMobile
          ? 'assistant-panel-mobile fixed inset-y-0 left-6 right-0 z-[220] shadow-sm'
          : 'assistant-panel-desktop relative z-[80] shrink-0 border-l border-[var(--header-border)] shadow-sm'
      } assistant-panel-shell ${
        panelVisible ? 'assistant-panel-entered' : 'assistant-panel-exiting'
      } flex flex-col overflow-hidden bg-white/95 backdrop-blur-xl dark:bg-slate-950/95`}
      style={isMobile ? undefined : { width: assistantPanelWidth }}
    >
      {!isMobile && (
        <div
          onPointerDown={handleAssistantResizePointerDown}
          onPointerMove={handleAssistantResizePointerMove}
          onPointerUp={handleAssistantResizePointerUp}
          className="absolute bottom-0 left-0 top-0 z-20 w-2 -translate-x-1 cursor-ew-resize bg-transparent hover:bg-indigo-400/20"
          title={language === 'zh' ? '拖拽调整 AI 助手宽度' : 'Drag to resize AI assistant'}
        />
      )}
      <div className="assistant-panel-header shrink-0 border-b border-slate-200 bg-slate-50/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="assistant-top-actions mb-2 flex items-center gap-2 overflow-hidden rounded-lg">
          <button
            onClick={handleNewAssistantTask}
            disabled={assistantLoading}
            className="assistant-glass-action assistant-glass-action-new flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-black text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
            title={language === 'zh' ? '新对话' : 'New conversation'}
          >
            <PlusCircle className="h-3.5 w-3.5" />
            {language === 'zh' ? '新对话' : 'New conversation'}
          </button>
          <button
            onClick={undo}
            disabled={!canUndo}
            className="assistant-glass-action assistant-glass-action-undo flex h-8 w-8 shrink-0 items-center justify-center text-slate-400 transition-colors hover:text-indigo-600 disabled:opacity-40 dark:hover:text-indigo-300"
            title={language === 'zh' ? '撤回最近一次画布修改' : 'Undo canvas change'}
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="assistant-glass-action assistant-glass-action-redo flex h-8 w-8 shrink-0 items-center justify-center text-slate-400 transition-colors hover:text-indigo-600 disabled:opacity-40 dark:hover:text-indigo-300"
            title={language === 'zh' ? '恢复撤回的画布修改' : 'Redo canvas change'}
          >
            <Redo2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setAssistantOpen(false)}
            className="assistant-glass-action assistant-glass-action-close flex h-8 w-8 shrink-0 items-center justify-center text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-white"
            title={language === 'zh' ? '关闭 AI 助手' : 'Close AI Assistant'}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="assistant-task-tabs custom-scrollbar flex gap-2 overflow-x-auto pb-1">
          {assistantTasks.map((task) => (
            <div
              key={task.id}
              className={`assistant-task-tab min-w-[128px] max-w-[176px] rounded-lg border px-2.5 py-1.5 transition-colors ${
                task.id === activeAssistantTaskId
                  ? 'border-indigo-300 bg-white text-indigo-700 shadow-sm dark:border-indigo-600 dark:bg-slate-800 dark:text-indigo-200'
                  : 'border-slate-200 bg-transparent text-slate-500 hover:bg-white dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
              title={task.title}
            >
              <div className="flex items-start gap-1.5">
                {editingTaskId === task.id ? (
                  <div className="min-w-0 flex-1 text-left">
                    <input
                      value={editingTaskTitle}
                      onChange={(event) => setEditingTaskTitle(event.target.value)}
                      onBlur={commitRenamingTask}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          commitRenamingTask();
                        }
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          setEditingTaskId(null);
                          setEditingTaskTitle('');
                        }
                      }}
                      autoFocus
                      className="w-full bg-transparent text-[11px] font-black outline-none"
                    />
                    <div className="truncate text-[9px] opacity-60">
                      {new Date(task.updatedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveAssistantTaskId(task.id)}
                    onDoubleClick={() => startRenamingTask(task)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="truncate text-[11px] font-black">{task.title}</div>
                    <div className="truncate text-[9px] opacity-60">
                      {new Date(task.updatedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleCloseAssistantTask(task.id)}
                  className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-slate-400 transition-colors hover:text-rose-500 dark:hover:text-rose-300"
                  title={language === 'zh' ? '关闭对话' : 'Close conversation'}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        ref={assistantMessagesRef}
        className="assistant-message-area custom-scrollbar flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        {assistantMessages.map((message) =>
          message.role === 'thought' ? (
            <div key={message.id} className="flex justify-start">
              <button
                type="button"
                onClick={() => toggleAssistantThought(message.id)}
                className="assistant-message-bubble assistant-message-thought max-w-[88%] rounded-2xl rounded-bl-md border border-indigo-100 bg-indigo-50 px-3.5 py-2.5 text-left text-xs leading-relaxed text-indigo-700 transition-colors dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-200"
              >
                <div className="mb-1 flex items-center gap-2 font-black">
                  <BrainCircuit className="h-3.5 w-3.5" />
                  <span>{message.collapsed ? 'AI 已完成思考' : 'AI 正在思考'}</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${
                      message.collapsed ? '-rotate-90' : ''
                    }`}
                  />
                </div>
                {!message.collapsed && (
                  <div className="whitespace-pre-wrap text-indigo-700/90 dark:text-indigo-100/90">
                    {message.content}
                  </div>
                )}
              </button>
            </div>
          ) : (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`assistant-message-bubble max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  message.role === 'user'
                    ? 'assistant-message-user rounded-br-md bg-indigo-600 text-white'
                    : 'assistant-message-ai rounded-bl-md border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100'
                }`}
              >
                {message.content}
              </div>
            </div>
          ),
        )}
        {assistantLoading && (
          <div className="flex justify-start">
            <div className="assistant-message-bubble assistant-message-loading flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              {language === 'zh' ? '正在思考和整理卡片...' : 'Thinking and organizing cards...'}
            </div>
          </div>
        )}
      </div>

      <div className="assistant-input-panel shrink-0 border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
        <div className="mb-2 flex items-center gap-2">
          <input
            ref={documentInputRef}
            type="file"
            multiple
            accept={uploadAccept}
            className="hidden"
            onChange={(event) => {
              handleDocumentFiles(event.target.files);
              event.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => documentInputRef.current?.click()}
            disabled={assistantLoading || assistantDocumentLoading}
            className="hidden"
            title={language === 'zh' ? '上传 PDF 或 Word 文档作为参考' : 'Upload PDF or Word reference documents'}
          >
            {assistantDocumentLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <UploadCloud className="h-3.5 w-3.5" />
            )}
            <span>{language === 'zh' ? '参考文档' : 'Docs'}</span>
          </button>
          {assistantDocuments.length > 0 && (
            <div className="custom-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
              {assistantDocuments.map((document) => (
                <div
                  key={document.id}
                  className="flex h-8 max-w-[160px] shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                  title={document.name}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                  <span className="truncate">{document.name}</span>
                  <a
                    href={document.objectUrl}
                    download={document.name}
                    className="flex h-4 w-4 shrink-0 items-center justify-center text-slate-400 transition-colors hover:text-indigo-600"
                    title={language === 'zh' ? '下载文档' : 'Download document'}
                  >
                    <Download className="h-3 w-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleRemoveAssistantDocument(document.id)}
                    className="flex h-4 w-4 shrink-0 items-center justify-center text-slate-400 transition-colors hover:text-rose-500"
                    title={language === 'zh' ? '移除文档' : 'Remove document'}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="assistant-quick-actions mb-2 flex gap-2">
          <button
            onClick={() =>
              handleAssistantSend('根据选中的卡片，给我三个后续剧情建议，不要生成卡片。')
            }
            disabled={assistantLoading}
            className="assistant-bottom-glass-action assistant-bottom-action-suggest rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {language === 'zh' ? '建议' : 'Suggest'}
          </button>
          <button
            onClick={() => handleAssistantSend('根据选中的卡片，生成并布置三张后续剧情卡片。')}
            disabled={assistantLoading}
            className="assistant-bottom-glass-action assistant-bottom-action-generate rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-600 transition-colors hover:bg-indigo-100 disabled:opacity-50 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900"
          >
            {language === 'zh' ? '生成卡片' : 'Generate cards'}
          </button>
          <button
            onClick={() =>
              handleAssistantSend(
                '填充或修改选中的空白卡片。剧情卡片写标题和正文；人物设定卡片写人物名、性格、特点、背景；场景设定卡片写场景名、位置、物品、氛围。',
              )
            }
            disabled={assistantLoading || selectedAssistantTargetNodesCount === 0}
            className="assistant-bottom-glass-action assistant-bottom-action-fill rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-600 transition-colors hover:bg-emerald-100 disabled:opacity-50 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900"
          >
            {language === 'zh' ? '填充选中' : 'Fill selected'}
          </button>
        </div>
        <div className="assistant-input-box flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setDocumentUploadOpen(true)}
            disabled={assistantLoading || assistantDocumentLoading}
            className="assistant-input-icon-button flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:text-indigo-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:text-white"
            title={language === 'zh' ? '上传参考文件' : 'Upload reference files'}
          >
            {assistantDocumentLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </button>
          <textarea
            value={assistantInput}
            onChange={(event) => setAssistantInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void handleAssistantSend();
              }
            }}
            placeholder={
              language === 'zh'
                ? '和 AI 讨论剧情，或让它生成/修改人物、场景、剧情卡片...'
                : 'Discuss the story with AI, or ask it to generate or revise characters, scenes, and story cards...'
            }
            rows={2}
            className="custom-scrollbar max-h-28 flex-1 resize-none bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-white"
          />
          <button
            onClick={handleAssistantVoiceInput}
            disabled={assistantLoading || assistantListening}
            className={`h-9 w-9 shrink-0 rounded-xl transition-colors ${
              assistantListening
                ? 'animate-pulse bg-rose-500 text-white'
                : 'assistant-input-icon-button border border-slate-200 bg-white text-slate-500 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:text-white'
            } flex items-center justify-center disabled:opacity-50`}
            title={language === 'zh' ? '语音输入' : 'Voice input'}
          >
            <Mic className="h-4 w-4" />
          </button>
          <button
            onClick={() => void handleAssistantSend()}
            disabled={assistantLoading || !assistantInput.trim()}
            className="assistant-send-button flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600"
            title={language === 'zh' ? '发送' : 'Send'}
          >
            {assistantLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
      {documentUploadOpen && (
        <div className="fixed inset-0 z-[360] flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-black text-slate-800 dark:text-white">
                  {language === 'zh' ? '上传参考文件' : 'Upload reference files'}
                </div>
                <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {language === 'zh'
                    ? '支持 PDF、Word、Excel、PPT 和常见文本文件'
                    : 'Supports PDF, Word, Excel, PPT, and common text files'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDocumentUploadOpen(false);
                  setDocumentDragActive(false);
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-900 dark:hover:text-white"
                title={language === 'zh' ? '关闭' : 'Close'}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => documentInputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                setDocumentDragActive(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setDocumentDragActive(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setDocumentDragActive(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                handleDocumentFiles(event.dataTransfer.files);
              }}
              disabled={assistantDocumentLoading}
              className={`flex min-h-44 w-full flex-col items-center justify-center rounded-xl border border-dashed p-5 text-center transition-colors disabled:opacity-60 ${
                documentDragActive
                  ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/50 dark:text-indigo-200'
                  : 'border-slate-300 bg-slate-50 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-600 dark:hover:bg-indigo-950/40'
              }`}
            >
              {assistantDocumentLoading ? (
                <Loader2 className="mb-3 h-8 w-8 animate-spin" />
              ) : (
                <UploadCloud className="mb-3 h-8 w-8" />
              )}
              <div className="text-sm font-black">
                {language === 'zh' ? '拖拽文件到这里，或点击上传' : 'Drop files here, or click to upload'}
              </div>
              <div className="mt-2 max-w-xs text-xs leading-relaxed opacity-80">
                {language === 'zh'
                  ? '为保证安全，只提取可读取的文本内容；不会执行宏、脚本或外部链接。旧版 .doc/.xls/.ppt 可能无法读取，请优先使用新版格式。'
                  : 'For safety, only readable text is extracted. Macros, scripts, and external links are not executed. Legacy .doc/.xls/.ppt files may not be readable; modern formats are preferred.'}
              </div>
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
