import {
  Loader2,
  Mic,
  Pause,
  Play,
  SkipForward,
  Square,
  Trash2,
  Upload,
  Volume2,
} from 'lucide-react';
import type { RefObject } from 'react';

import type { StoryAudioClip } from '../../domain/project';

type RecordingState = 'idle' | 'recording' | 'paused' | 'encoding';

export function ZenAudioPanel({
  recordingState,
  waveformLevels,
  isGeneratingAudio,
  onGenerateAudio,
  onAudioClipsChange,
  audioImportInputRef,
  audioPlayerRef,
  normalizedAudioClips,
  playableAudioClips,
  activeAudioClip,
  isAudioPlaying,
  editingAudioId,
  editingAudioName,
  startRecording,
  stopRecording,
  toggleRecordingPause,
  importAudioFiles,
  playClip,
  toggleClipPlayback,
  playNextClip,
  setIsAudioPlaying,
  setEditingAudioId,
  setEditingAudioName,
  finishRenamingClip,
  startRenamingClip,
  toggleClipSkipped,
  deleteClip,
}: {
  recordingState: RecordingState;
  waveformLevels: number[];
  isGeneratingAudio: boolean;
  onGenerateAudio?: () => Promise<void> | void;
  onAudioClipsChange?: (clips: StoryAudioClip[]) => void;
  audioImportInputRef: RefObject<HTMLInputElement | null>;
  audioPlayerRef: RefObject<HTMLAudioElement | null>;
  normalizedAudioClips: StoryAudioClip[];
  playableAudioClips: StoryAudioClip[];
  activeAudioClip?: StoryAudioClip;
  isAudioPlaying: boolean;
  editingAudioId: string | null;
  editingAudioName: string;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  toggleRecordingPause: () => void;
  importAudioFiles: (files: FileList) => void;
  playClip: (clip: StoryAudioClip) => void;
  toggleClipPlayback: (clip: StoryAudioClip) => void;
  playNextClip: () => void;
  setIsAudioPlaying: (playing: boolean) => void;
  setEditingAudioId: (id: string | null) => void;
  setEditingAudioName: (name: string) => void;
  finishRenamingClip: () => void;
  startRenamingClip: (clip: StoryAudioClip) => void;
  toggleClipSkipped: (clipId: string) => void;
  deleteClip: (clipId: string) => void;
}) {
  return (
    <div className="space-y-4 text-sm text-[var(--text-primary)]">
      <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3">
        <div className="mb-2 flex items-center justify-between">
          <strong>录音控制</strong>
          <span className="text-xs font-bold text-[var(--text-muted)]">
            {recordingState === 'recording'
              ? '正在录音'
              : recordingState === 'paused'
                ? '已暂停'
                : recordingState === 'encoding'
                  ? '正在生成 MP3'
                  : '未录音'}
          </span>
        </div>
        <div
          className={`mb-3 flex h-16 items-center justify-center gap-1 rounded-xl border px-3 transition-colors ${
            recordingState === 'recording'
              ? 'border-rose-500/30 bg-rose-500/10'
              : recordingState === 'paused'
                ? 'border-amber-500/30 bg-amber-500/10 opacity-60'
                : 'border-[var(--card-border)] bg-[var(--app-bg)]'
          }`}
          aria-label={recordingState === 'recording' ? '正在接收麦克风声音' : '麦克风音量波形'}
        >
          {waveformLevels.map((level, index) => (
            <span
              key={index}
              className={`w-1 rounded-full transition-[height,background-color] duration-75 ${
                recordingState === 'recording'
                  ? 'bg-rose-500'
                  : recordingState === 'paused'
                    ? 'bg-amber-500'
                    : 'bg-[var(--text-muted)]/30'
              }`}
              style={{
                height:
                  recordingState === 'recording' || recordingState === 'paused'
                    ? `${Math.max(5, level * 48)}px`
                    : `${5 + ((index * 7) % 12)}px`,
              }}
            />
          ))}
        </div>
        <div className="zen-editor-audio-action-grid grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              if (recordingState === 'recording' || recordingState === 'paused') {
                stopRecording();
              } else {
                void startRecording();
              }
            }}
            disabled={!onAudioClipsChange || recordingState === 'encoding'}
            className="zen-editor-audio-record-action flex items-center justify-center gap-2 rounded-lg bg-rose-500 px-3 py-2 font-bold text-white disabled:opacity-50"
          >
            {recordingState === 'recording' || recordingState === 'paused' ? (
              <>
                <Square className="h-4 w-4 fill-current" />
                停止录音
              </>
            ) : recordingState === 'encoding' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                生成 MP3
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" />
                开始录音
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onGenerateAudio}
            disabled={!onGenerateAudio || isGeneratingAudio}
            className="zen-editor-audio-generate-action flex items-center justify-center gap-2 rounded-lg bg-sky-500 px-3 py-2 font-bold text-white disabled:opacity-50"
          >
            {isGeneratingAudio ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                生成中
              </>
            ) : (
              <>
                <Volume2 className="h-4 w-4" />
                AI 音频
              </>
            )}
          </button>
          <button
            type="button"
            onClick={toggleRecordingPause}
            disabled={recordingState !== 'recording' && recordingState !== 'paused'}
            className="zen-editor-audio-pause-action flex items-center justify-center gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--app-bg)] px-3 py-2 font-bold disabled:opacity-40"
          >
            {recordingState === 'paused' ? (
              <>
                <Play className="h-4 w-4" />
                继续录音
              </>
            ) : (
              <>
                <Pause className="h-4 w-4" />
                暂停录音
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <strong>音频播放列表</strong>
          <div className="mt-0.5 text-xs text-[var(--text-muted)]">顺序播放 · 跳过已标记音频</div>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={audioImportInputRef}
            type="file"
            accept="audio/*"
            multiple
            className="hidden"
            onChange={(event) => {
              const files = event.target.files;
              if (files && files.length > 0) importAudioFiles(files);
              event.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => audioImportInputRef.current?.click()}
            disabled={!onAudioClipsChange}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--app-bg)] px-3 py-2 text-xs font-black disabled:opacity-40"
          >
            <Upload className="h-4 w-4" />
            上传
          </button>
          <button
            type="button"
            onClick={() => {
              const first = playableAudioClips[0];
              if (first) playClip(first);
            }}
            disabled={playableAudioClips.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-2 text-xs font-black text-white disabled:opacity-40"
          >
            <Play className="h-4 w-4" />
            顺序播放
          </button>
        </div>
      </div>

      {activeAudioClip && (
        <audio
          ref={audioPlayerRef}
          src={activeAudioClip.url}
          controls
          preload="metadata"
          onPlay={() => setIsAudioPlaying(true)}
          onPause={() => setIsAudioPlaying(false)}
          onEnded={playNextClip}
          className="h-10 w-full"
        />
      )}

      <div className="space-y-2">
        {normalizedAudioClips.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--card-border)] p-6 text-center text-xs text-[var(--text-muted)]">
            暂无音频。可使用录音、AI 音频或上传按钮添加。
          </div>
        ) : (
          normalizedAudioClips.map((clip, index) => {
            const active = activeAudioClip?.id === clip.id;
            return (
              <div
                key={clip.id}
                className={`rounded-xl border p-3 ${
                  active
                    ? 'border-sky-500/50 bg-sky-500/10'
                    : 'border-[var(--card-border)] bg-[var(--app-bg)]'
                } ${clip.skipped ? 'opacity-55' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleClipPlayback(clip)}
                    disabled={clip.skipped}
                    className="rounded-lg bg-sky-500/10 p-2 text-sky-500 disabled:opacity-40"
                    title={active && isAudioPlaying ? '暂停' : '播放'}
                  >
                    {active && isAudioPlaying ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    {editingAudioId === clip.id ? (
                      <input
                        autoFocus
                        value={editingAudioName}
                        onChange={(event) => setEditingAudioName(event.target.value)}
                        onBlur={finishRenamingClip}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') finishRenamingClip();
                          if (event.key === 'Escape') {
                            setEditingAudioId(null);
                            setEditingAudioName('');
                          }
                        }}
                        className="w-full rounded border border-sky-500/40 bg-[var(--card-bg)] px-2 py-1 font-bold outline-none"
                        aria-label="重命名音频"
                      />
                    ) : (
                      <div
                        className="truncate font-bold"
                        onDoubleClick={() => startRenamingClip(clip)}
                        title="双击重命名"
                      >
                        {index + 1}. {clip.name}
                      </div>
                    )}
                    <div className="text-[10px] uppercase text-[var(--text-muted)]">
                      {clip.source === 'recording'
                        ? 'MP3 录音'
                        : clip.source === 'tts'
                          ? '文字转音频'
                          : '已有音频'}
                      {clip.skipped ? ' · 已跳过' : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleClipSkipped(clip.id)}
                    className={`rounded-lg p-2 ${
                      clip.skipped ? 'bg-amber-500 text-white' : 'bg-amber-500/10 text-amber-500'
                    }`}
                    title={clip.skipped ? '恢复播放' : '播放时跳过'}
                  >
                    <SkipForward className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteClip(clip.id)}
                    className="rounded-lg bg-rose-500/10 p-2 text-rose-500"
                    title="删除音频"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
