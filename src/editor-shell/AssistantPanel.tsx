import {
  BrainCircuit,
  ChevronDown,
  Loader2,
  Mic,
  PlusCircle,
  Redo2,
  Send,
  Undo2,
  X,
} from 'lucide-react';
import type {
  Dispatch,
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
  SetStateAction,
} from 'react';

import type { AssistantMessage } from '../editor-features/assistant/useAssistantPanel';
import type { Language } from '../lib/i18n';

type AssistantTask = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: AssistantMessage[];
};

interface AssistantPanelProps {
  assistantOpen: boolean;
  isMobile: boolean;
  assistantPanelWidth: number;
  assistantLoading: boolean;
  assistantListening: boolean;
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
  handleCloseAssistantTask: (taskId: string) => void;
  handleAssistantSend: (overrideText?: string) => Promise<void>;
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
  handleCloseAssistantTask,
  handleAssistantSend,
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
  if (!assistantOpen) return null;

  return (
    <aside
      className={`${
        isMobile
          ? 'fixed inset-y-0 left-6 right-0 z-[220] shadow-md'
          : 'relative z-[80] shrink-0 border-l border-[var(--header-border)] shadow-md'
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
      <div className="shrink-0 border-b border-slate-200 bg-slate-50/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="mb-2 flex items-center gap-2">
          <button
            onClick={handleNewAssistantTask}
            disabled={assistantLoading}
            className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-black text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
            title={language === 'zh' ? '新对话' : 'New conversation'}
          >
            <PlusCircle className="h-3.5 w-3.5" />
            {language === 'zh' ? '新对话' : 'New conversation'}
          </button>
          <button
            onClick={undo}
            disabled={!canUndo}
            className="flex h-8 w-8 shrink-0 items-center justify-center text-slate-400 transition-colors hover:text-indigo-600 disabled:opacity-40 dark:hover:text-indigo-300"
            title={language === 'zh' ? '撤回最近一次画布修改' : 'Undo canvas change'}
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="flex h-8 w-8 shrink-0 items-center justify-center text-slate-400 transition-colors hover:text-indigo-600 disabled:opacity-40 dark:hover:text-indigo-300"
            title={language === 'zh' ? '恢复撤回的画布修改' : 'Redo canvas change'}
          >
            <Redo2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setAssistantOpen(false)}
            className="flex h-8 w-8 shrink-0 items-center justify-center text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-white"
            title={language === 'zh' ? '关闭 AI 助手' : 'Close AI Assistant'}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="custom-scrollbar flex gap-2 overflow-x-auto pb-1">
          {assistantTasks.map((task) => (
            <div
              key={task.id}
              className={`min-w-[128px] max-w-[176px] rounded-lg border px-2.5 py-1.5 transition-colors ${
                task.id === activeAssistantTaskId
                  ? 'border-indigo-300 bg-white text-indigo-700 shadow-sm dark:border-indigo-600 dark:bg-slate-800 dark:text-indigo-200'
                  : 'border-slate-200 bg-transparent text-slate-500 hover:bg-white dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
              title={task.title}
            >
              <div className="flex items-start gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveAssistantTaskId(task.id)}
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
        className="custom-scrollbar flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        {assistantMessages.map((message) =>
          message.role === 'thought' ? (
            <div key={message.id} className="flex justify-start">
              <button
                type="button"
                onClick={() => toggleAssistantThought(message.id)}
                className="max-w-[88%] rounded-2xl rounded-bl-md border border-indigo-100 bg-indigo-50 px-3.5 py-2.5 text-left text-xs leading-relaxed text-indigo-700 transition-colors dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-200"
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
                className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  message.role === 'user'
                    ? 'rounded-br-md bg-indigo-600 text-white'
                    : 'rounded-bl-md border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100'
                }`}
              >
                {message.content}
              </div>
            </div>
          ),
        )}
        {assistantLoading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              {language === 'zh' ? '正在思考和整理卡片...' : 'Thinking and organizing cards...'}
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
        <div className="mb-2 flex gap-2">
          <button
            onClick={() =>
              handleAssistantSend('根据选中的卡片，给我三个后续剧情建议，不要生成卡片。')
            }
            disabled={assistantLoading}
            className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {language === 'zh' ? '建议' : 'Suggest'}
          </button>
          <button
            onClick={() => handleAssistantSend('根据选中的卡片，生成并布置三张后续剧情卡片。')}
            disabled={assistantLoading}
            className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-600 transition-colors hover:bg-indigo-100 disabled:opacity-50 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900"
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
            className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-600 transition-colors hover:bg-emerald-100 disabled:opacity-50 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900"
          >
            {language === 'zh' ? '填充选中' : 'Fill selected'}
          </button>
        </div>
        <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900">
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
                : 'border border-slate-200 bg-white text-slate-500 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:text-white'
            } flex items-center justify-center disabled:opacity-50`}
            title={language === 'zh' ? '语音输入' : 'Voice input'}
          >
            <Mic className="h-4 w-4" />
          </button>
          <button
            onClick={() => void handleAssistantSend()}
            disabled={assistantLoading || !assistantInput.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600"
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
    </aside>
  );
}
