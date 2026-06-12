import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react';
import {
  ChevronRight,
  Eye,
  EyeOff,
  FastForward,
  Layout,
  Loader2,
  Maximize2,
  Minimize2,
  Moon,
  PlayCircle,
  RotateCcw,
  Settings,
  Sun,
  X,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import type {
  CharacterNodeData,
  CharacterPresentation,
  SceneNodeData,
  StoryPresentation,
} from '../domain/project';
import { Language, translations } from '../lib/i18n';
import {
  clampCharacterLayer,
  getCharacterStagePosition,
  getPresentationTransform,
  normalizeStoryPresentation,
} from '../lib/presentation';

// Helper: HTML-Aware Safe Slicing for Typewriter Effect
function sliceHtmlByTextLength(
  html: string,
  maxTextLength: number,
): { slicedHtml: string; totalTextLength: number } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const container = doc.body.firstChild as HTMLElement;

  let currentTextLength = 0;

  function cloneNodeLimit(node: Node): Node | null {
    if (node.nodeType === Node.TEXT_NODE) {
      const textContent = node.textContent || '';
      const remaining = maxTextLength - currentTextLength;
      if (remaining <= 0) {
        return null;
      }
      if (textContent.length <= remaining) {
        currentTextLength += textContent.length;
        return document.createTextNode(textContent);
      } else {
        currentTextLength += remaining;
        return document.createTextNode(textContent.slice(0, remaining));
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const clonedEl = el.cloneNode(false) as HTMLElement;

      for (let i = 0; i < el.childNodes.length; i++) {
        const child = el.childNodes[i];
        const clonedChild = cloneNodeLimit(child);
        if (clonedChild) {
          clonedEl.appendChild(clonedChild);
        }
        if (currentTextLength >= maxTextLength) {
          break;
        }
      }
      const isVoidTag = ['br', 'img', 'hr', 'input'].includes(clonedEl.tagName.toLowerCase());
      if (clonedEl.childNodes.length > 0 || isVoidTag) {
        return clonedEl;
      }
      return null;
    }
    return null;
  }

  const resultContainer = document.createElement('div');
  if (container) {
    for (let i = 0; i < container.childNodes.length; i++) {
      const clonedChild = cloneNodeLimit(container.childNodes[i]);
      if (clonedChild) {
        resultContainer.appendChild(clonedChild);
      }
      if (currentTextLength >= maxTextLength) {
        break;
      }
    }
  }

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  const totalTextLength = tempDiv.textContent?.length || 0;

  return {
    slicedHtml: resultContainer.innerHTML,
    totalTextLength,
  };
}

interface PlayTestProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  onClose: () => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  choicesColumns: number;
  setChoicesColumns: (val: number) => void;
  videoAutoPlay: boolean;
  setVideoAutoPlay: (val: boolean) => void;
  layoutMode: 'classic' | 'immersive';
  setLayoutMode: (val: 'classic' | 'immersive') => void;

  interactionMode: string;
  setInteractionMode: (val: string) => void;
  typewriterSpeed: number;
  setTypewriterSpeed: (val: number) => void;
  choiceDelay: number;
  setChoiceDelay: (val: number) => void;

  choicesPosition: 'center' | 'aboveText' | 'belowText';
  setChoicesPosition: (val: 'center' | 'aboveText' | 'belowText') => void;
  blurBackground: boolean;
  setBlurBackground: (val: boolean) => void;
  blurText: boolean;
  setBlurText: (val: boolean) => void;
  skipSingleChoicePopup: boolean;
  setSkipSingleChoicePopup: (val: boolean) => void;
  autoAdvance: boolean;
  setAutoAdvance: (val: boolean) => void;
  autoAdvanceDelay: number;
  setAutoAdvanceDelay: (val: number) => void;
  hideCharacterTags: boolean;
  setHideCharacterTags: (val: boolean) => void;
  hideSceneTags: boolean;
  setHideSceneTags: (val: boolean) => void;
}

export function PlayTestModal({
  nodes,
  edges,
  onClose,
  language,
  onLanguageChange,
  isDarkMode,
  setIsDarkMode,
  choicesColumns,
  setChoicesColumns,
  videoAutoPlay,
  setVideoAutoPlay,
  layoutMode,
  setLayoutMode,

  interactionMode,
  setInteractionMode,
  typewriterSpeed,
  setTypewriterSpeed,
  choiceDelay,
  setChoiceDelay,

  choicesPosition,
  setChoicesPosition,
  blurBackground,
  setBlurBackground,
  blurText,
  setBlurText,
  skipSingleChoicePopup,
  setSkipSingleChoicePopup,
  autoAdvance,
  setAutoAdvance,
  autoAdvanceDelay,
  setAutoAdvanceDelay,
  hideCharacterTags,
  setHideCharacterTags,
  hideSceneTags,
  setHideSceneTags,
}: PlayTestProps) {
  const t = translations[language];
  const root = nodes.find((n) => n.data.isRoot) || nodes[0];
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(root?.id || null);
  const [history, setHistory] = useState<string[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioPreloadRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const choicesRef = useRef<HTMLDivElement>(null);

  const [showSettings, setShowSettings] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);

  // 新增：文本呈现打字机与定时显现状态
  const [displayedHtml, setDisplayedHtml] = useState('');
  const [animationCompleted, setAnimationCompleted] = useState(interactionMode === 'immediate');
  const [timeLeft, setTimeLeft] = useState(0);
  const [presentationVisible, setPresentationVisible] = useState(false);
  const [presentationExiting, setPresentationExiting] = useState(false);
  const typewriterTimerRef = useRef<any>(null);
  const timedTimerRef = useRef<any>(null);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 跳转到指定节点并重置动画完成状态，避免切换时按钮闪烁
   * @param nodeId 目标节点 ID
   */
  const navigateToNode = React.useCallback(
    (nodeId: string | null) => {
      setCurrentNodeId(nodeId);
      if (interactionMode !== 'immediate') {
        setAnimationCompleted(false);
      } else {
        setAnimationCompleted(true);
      }
    },
    [interactionMode],
  );

  const currentNode = nodes.find((n) => n.id === currentNodeId);
  const presentation = normalizeStoryPresentation(
    currentNode?.data.presentation as StoryPresentation | undefined,
  );
  const sceneSource = presentation.scene
    ? nodes.find((node) => node.id === presentation.scene?.sourceNodeId)
    : null;
  const sceneImageUrl =
    (sceneSource?.data as SceneNodeData | undefined)?.coverImageUrl ||
    (currentNode?.data.imageUrl as string | undefined);
  const presentedCharacters = presentation.characters
    .map((config) => {
      const source = nodes.find((node) => node.id === config.sourceNodeId);
      if (!source || source.type !== 'characterNode') return null;
      const characterData = source.data as CharacterNodeData;
      const outfit = config.outfitId
        ? characterData.outfits?.find((item) => item.id === config.outfitId)
        : characterData.outfits?.find((item) => item.imageUrl);
      const imageUrl = outfit?.imageUrl || characterData.avatarUrl;
      if (!imageUrl) return null;
      return { config, data: characterData, imageUrl };
    })
    .filter(
      (
        item,
      ): item is {
        config: CharacterPresentation;
        data: CharacterNodeData;
        imageUrl: string;
      } => Boolean(item),
    );
  const rawTextHtml =
    currentNodeId !== 'THE_END' && currentNode ? (currentNode.data.text as string) || '' : '';
  const textHtml = React.useMemo(() => {
    if ((!hideCharacterTags && !hideSceneTags) || !rawTextHtml) return rawTextHtml;
    const container = document.createElement('div');
    container.innerHTML = rawTextHtml;
    if (hideCharacterTags) {
      container
        .querySelectorAll('[data-mention-kind="character"]')
        .forEach((node) => node.remove());
    }
    if (hideSceneTags) {
      container.querySelectorAll('[data-mention-kind="scene"]').forEach((node) => node.remove());
    }
    return container.innerHTML;
  }, [hideCharacterTags, hideSceneTags, rawTextHtml]);
  const outEdges = edges.filter((e) => e.source === currentNodeId);
  const autoAdvanceTarget = outEdges.length === 1 ? outEdges[0].target : 'THE_END';
  const advanceToTarget = React.useCallback(
    (targetId: string) => {
      if (presentationExiting) return;
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
      const exitDuration = Math.max(
        presentation.scene?.exit.type === 'none' ? 0 : presentation.scene?.exit.duration || 0,
        ...presentation.characters.map((character) =>
          character.exit.type === 'none' ? 0 : character.exit.duration || 0,
        ),
      );
      setPresentationExiting(true);
      window.setTimeout(() => {
        setHistory((prev) => [...prev, currentNodeId || '']);
        navigateToNode(targetId);
      }, exitDuration);
    },
    [currentNodeId, navigateToNode, presentation, presentationExiting],
  );

  useEffect(() => {
    setPresentationExiting(false);
    setPresentationVisible(false);
    const frame = requestAnimationFrame(() => setPresentationVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [currentNodeId]);

  // 触发打字机或延时逻辑
  useEffect(() => {
    if (typewriterTimerRef.current) clearInterval(typewriterTimerRef.current);
    if (timedTimerRef.current) clearTimeout(timedTimerRef.current);
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }

    if (currentNodeId === 'THE_END' || !currentNode) {
      setDisplayedHtml('');
      setAnimationCompleted(true);
      return;
    }

    if (interactionMode === 'immediate') {
      setDisplayedHtml(textHtml);
      setAnimationCompleted(true);
    } else if (interactionMode === 'typewriter') {
      setAnimationCompleted(false);
      const { totalTextLength } = sliceHtmlByTextLength(textHtml, 9999);
      if (totalTextLength === 0) {
        setDisplayedHtml(textHtml);
        setAnimationCompleted(true);
        return;
      }

      let currentLen = 0;
      setDisplayedHtml(sliceHtmlByTextLength(textHtml, 0).slicedHtml);

      typewriterTimerRef.current = setInterval(() => {
        currentLen += 1;
        const { slicedHtml, totalTextLength: len } = sliceHtmlByTextLength(textHtml, currentLen);
        setDisplayedHtml(slicedHtml);
        if (currentLen >= len) {
          if (typewriterTimerRef.current) clearInterval(typewriterTimerRef.current);
          setAnimationCompleted(true);
        }
      }, typewriterSpeed);
    } else if (interactionMode === 'timed') {
      setDisplayedHtml(textHtml);
      setAnimationCompleted(false);
      setTimeLeft(choiceDelay);

      const intervalTick = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 0.1) {
            clearInterval(intervalTick);
            return 0;
          }
          return Number((prev - 0.1).toFixed(1));
        });
      }, 100);

      timedTimerRef.current = setTimeout(() => {
        clearInterval(intervalTick);
        setAnimationCompleted(true);
      }, choiceDelay * 1000);

      return () => {
        clearInterval(intervalTick);
        if (timedTimerRef.current) clearTimeout(timedTimerRef.current);
      };
    } else if (interactionMode === 'clickToShow') {
      setDisplayedHtml(textHtml);
      setAnimationCompleted(false);
    }

    return () => {
      if (typewriterTimerRef.current) clearInterval(typewriterTimerRef.current);
      if (timedTimerRef.current) clearTimeout(timedTimerRef.current);
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
    };
  }, [currentNodeId, textHtml, interactionMode, typewriterSpeed, choiceDelay]);

  useEffect(() => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }

    if (
      !autoAdvance ||
      !animationCompleted ||
      !currentNode ||
      currentNodeId === 'THE_END' ||
      currentNode.type === 'numberConditionNode' ||
      currentNode.data.skip === true ||
      outEdges.length > 1
    ) {
      return;
    }

    autoAdvanceTimerRef.current = setTimeout(
      () => {
        advanceToTarget(autoAdvanceTarget);
      },
      Math.max(0, autoAdvanceDelay) * 1000,
    );

    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
    };
  }, [
    advanceToTarget,
    animationCompleted,
    autoAdvance,
    autoAdvanceDelay,
    autoAdvanceTarget,
    currentNode,
    currentNodeId,
    outEdges.length,
  ]);

  const handleTextContainerClick = () => {
    if (!animationCompleted) {
      if (typewriterTimerRef.current) clearInterval(typewriterTimerRef.current);
      if (timedTimerRef.current) clearTimeout(timedTimerRef.current);

      setDisplayedHtml(textHtml);
      setAnimationCompleted(true);
    } else {
      // 如果打字完毕，且开启了“单选项隐藏居中弹窗”的设置，并且当前没有多分支选项（<= 1个分支）
      if (choicesPosition === 'center' && skipSingleChoicePopup && outEdges.length <= 1) {
        const nextTarget = outEdges.length === 1 ? outEdges[0].target : 'THE_END';
        advanceToTarget(nextTarget);
      }
    }
  };

  const renderChoices = (isImmersive: boolean) => {
    if (!animationCompleted) return null;

    const effectiveCols = choicesPosition === 'center' ? 1 : choicesColumns;
    const gridClass = `grid ${effectiveCols === 1 ? 'grid-cols-1' : effectiveCols === 2 ? 'grid-cols-2' : 'grid-cols-3'} gap-3 w-full mb-1 animate-in fade-in duration-300 ${
      choicesPosition === 'center' ? 'px-3 py-3' : ''
    }`;

    return (
      <div className={gridClass} onClick={(e) => e.stopPropagation()}>
        {outEdges.length > 0 ? (
          outEdges.map((edge, index) => {
            let targetNode = nodes.find((n) => n.id === edge.target);

            if (targetNode?.type === 'numberConditionNode') {
              let sum = 0;
              for (const hId of [...history, currentNodeId]) {
                const prevNode = nodes.find((n) => n.id === hId);
                if (prevNode && typeof prevNode.data.nodeValue === 'number') {
                  sum += prevNode.data.nodeValue;
                }
              }
              const ranges =
                (targetNode.data.ranges as { id: string; min: number; max: number }[]) || [];
              let targetHandle = '';

              const matchedRange = ranges.find((r) => sum >= r.min && sum <= r.max);
              if (matchedRange) {
                targetHandle = `out-range-${matchedRange.id}`;
              } else {
                const threshold = (targetNode.data.threshold as number) || 0;
                targetHandle = sum > threshold ? 'out-greater' : 'out-less-equal';
              }

              const condEdges = edges.filter((e) => e.source === targetNode!.id);
              const condEdge = condEdges.find((e) => e.sourceHandle === targetHandle);

              if (condEdge) {
                const finalTarget = nodes.find((n) => n.id === condEdge.target);
                if (finalTarget) {
                  targetNode = finalTarget;
                }
              }
            }

            while (targetNode && targetNode.data.skip === true) {
              const nextEdges = edges.filter((e) => e.source === targetNode!.id);
              if (nextEdges.length > 0) {
                const nextTarget = nodes.find((n) => n.id === nextEdges[0].target);
                if (nextTarget) {
                  targetNode = nextTarget;
                } else {
                  break;
                }
              } else {
                targetNode = undefined;
                break;
              }
            }

            const targetTitle = targetNode?.data?.title as string | undefined;
            const nodeColor = (targetNode?.data.color as string) || '#ffffff';
            const isWhite =
              nodeColor.toLowerCase() === '#ffffff' || nodeColor.toLowerCase() === 'white';

            const defaultLabel = outEdges.length === 1 ? t.continue : `${t.option} ${index + 1}`;
            const label = targetTitle || edge.data?.label || defaultLabel;

            if (isImmersive) {
              let customBg = 'rgba(255, 255, 255, 0.15)';
              if (!isWhite && nodeColor.startsWith('#')) {
                if (nodeColor.length === 7) {
                  customBg = `${nodeColor}55`; // 33% opacity
                } else if (nodeColor.length === 4) {
                  customBg = `${nodeColor}5`;
                } else {
                  customBg = nodeColor;
                }
              }

              const btnClass = `w-full px-5 py-3.5 rounded-xl border backdrop-blur-md transition-all hover:scale-[1.02] active:scale-[0.98] group flex items-center shadow-lg hover:shadow-xl hover:brightness-110 text-white ${
                choicesPosition === 'center'
                  ? 'text-center justify-center'
                  : 'text-left justify-between'
              }`;

              return (
                <button
                  key={edge.id}
                  onClick={() => handleChoiceClick(edge.target)}
                  className={btnClass}
                  style={{
                    backgroundColor: customBg,
                    borderColor: isWhite ? 'rgba(255, 255, 255, 0.25)' : nodeColor,
                  }}
                >
                  <span className="font-bold text-sm md:text-base tracking-wide drop-shadow-sm">
                    {label as string}
                  </span>
                  {choicesPosition !== 'center' && (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center bg-white/10 group-hover:bg-white/20 transition-all">
                      <ChevronRight className="w-4 h-4 transform group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  )}
                </button>
              );
            } else {
              const btnClass = `w-full px-6 py-4 rounded-2xl border-2 transition-all hover:scale-[1.02] active:scale-[0.98] group flex items-center shadow-sm hover:shadow-md ${
                choicesPosition === 'center'
                  ? 'text-center justify-center'
                  : 'text-left justify-between'
              } ${isDarkMode && isWhite ? 'hover:bg-white/5' : ''}`;

              return (
                <button
                  key={edge.id}
                  onClick={() => handleChoiceClick(edge.target)}
                  className={btnClass}
                  style={{
                    backgroundColor: isDarkMode && isWhite ? '#1e293b' : nodeColor,
                    borderColor: isWhite ? (isDarkMode ? '#334155' : '#e2e8f0') : nodeColor,
                    color: isWhite ? (isDarkMode ? '#f1f5f9' : '#334155') : '#1e293b',
                  }}
                >
                  <span className="font-bold text-sm md:text-base tracking-wide">
                    {label as string}
                  </span>
                  {choicesPosition !== 'center' && (
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isWhite ? (isDarkMode ? 'bg-white/10' : 'bg-slate-200/50') : 'bg-black/10'}`}
                    >
                      <ChevronRight className="w-5 h-5 transform group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  )}
                </button>
              );
            }
          })
        ) : isImmersive ? (
          <button
            onClick={() => handleChoiceClick('THE_END')}
            className={`w-full px-6 py-4 rounded-xl border border-white/20 bg-black/40 hover:bg-black/60 backdrop-blur-md transition-all group flex items-center text-slate-300 ${
              choicesPosition === 'center'
                ? 'text-center justify-center'
                : 'text-left justify-between'
            }`}
          >
            <span className="font-bold italic text-sm md:text-base">{t.draftEnded}</span>
            {choicesPosition !== 'center' && (
              <ChevronRight className="w-5 h-5 text-slate-400 animate-pulse" />
            )}
          </button>
        ) : (
          <button
            onClick={() => handleChoiceClick('THE_END')}
            className={`w-full px-8 py-5 rounded-2xl border-2 border-dashed transition-all group flex items-center ${
              choicesPosition === 'center'
                ? 'text-center justify-center'
                : 'text-left justify-between'
            } ${isDarkMode ? 'border-white/20 hover:border-sky-500/50 hover:bg-sky-500/10 text-slate-400' : 'border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 text-slate-600'}`}
          >
            <span className="font-bold italic text-base">{t.draftEnded}</span>
            {choicesPosition !== 'center' && (
              <ChevronRight
                className={`w-6 h-6 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'} animate-pulse`}
              />
            )}
          </button>
        )}
      </div>
    );
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current
        .requestFullscreen()
        .then(() => {
          setIsFullscreen(true);
        })
        .catch((err) => {
          console.error('Fullscreen error:', err);
        });
    } else {
      document
        .exitFullscreen()
        .then(() => {
          setIsFullscreen(false);
        })
        .catch((err) => {
          console.error('Fullscreen error:', err);
        });
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const rootId = (nodes.find((n) => n.data.isRoot) || nodes[0])?.id || null;
    navigateToNode(rootId);
    setHistory([]);
  }, []);

  useEffect(() => {
    if (
      currentNodeId !== 'THE_END' &&
      currentNodeId &&
      !nodes.find((n) => n.id === currentNodeId)
    ) {
      const newRoot = nodes.find((n) => n.data.isRoot) || nodes[0];
      navigateToNode(newRoot?.id || null);
      setHistory([]);
    }
  }, [nodes, currentNodeId]);

  useEffect(() => {
    if (currentNodeId && currentNodeId !== 'THE_END') {
      if (videoAutoPlay && videoRef.current) {
        // Try to play with sound first
        videoRef.current.play().catch(() => {
          // If failed (browser restriction), play muted
          if (videoRef.current) {
            videoRef.current.muted = true;
            videoRef.current.play().catch((e) => console.error('Muted autoplay failed', e));
          }
        });
      }
      // Also autoplay audio if it exists, as it's often background music or narration
      if (videoAutoPlay && audioRef.current) {
        audioRef.current.play().catch((e) => console.log('Audio autoplay blocked', e));
      }
    }
  }, [currentNodeId, videoAutoPlay]);

  useEffect(() => {
    if (!currentNodeId || currentNodeId === 'THE_END') return;

    const preloadAudio = (url: unknown) => {
      if (typeof url !== 'string' || !url.trim() || audioPreloadRef.current.has(url)) return;
      const audio = new Audio(url);
      audio.preload = 'auto';
      audio.load();
      audioPreloadRef.current.set(url, audio);
    };

    const preloadNodeAudio = (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      preloadAudio(node?.data.audioUrl);
    };

    preloadNodeAudio(currentNodeId);
    edges
      .filter((edge) => edge.source === currentNodeId)
      .forEach((edge) => preloadNodeAudio(edge.target));
  }, [currentNodeId, nodes, edges]);

  // 自动跳过数字判断卡片
  const lastJumpedNode = useRef<string | null>(null);

  useEffect(() => {
    if (currentNodeId && currentNodeId !== 'THE_END' && currentNodeId !== lastJumpedNode.current) {
      const node = nodes.find((n) => n.id === currentNodeId);
      if (node && node.type === 'numberConditionNode') {
        lastJumpedNode.current = currentNodeId;
        // 计算历史中卡片的数值总和
        let sum = 0;
        for (const hId of history) {
          const prevNode = nodes.find((n) => n.id === hId);
          if (prevNode && typeof prevNode.data.nodeValue === 'number') {
            sum += prevNode.data.nodeValue;
          }
        }

        const ranges = (node.data.ranges as { id: string; min: number; max: number }[]) || [];
        let targetHandle = '';

        const matchedRange = ranges.find((r) => sum >= r.min && sum <= r.max);
        if (matchedRange) {
          targetHandle = `out-range-${matchedRange.id}`;
        } else {
          const threshold = (node.data.threshold as number) || 0;
          targetHandle = sum > threshold ? 'out-greater' : 'out-less-equal';
        }

        const outEdges = edges.filter((e) => e.source === currentNodeId);
        const validEdges = outEdges.filter((e) => e.sourceHandle === targetHandle);

        if (validEdges.length > 0) {
          const nextId = validEdges[0].target;
          setHistory((prev) => [...prev, currentNodeId]);
          navigateToNode(nextId);
        } else {
          setHistory((prev) => [...prev, currentNodeId]);
          navigateToNode('THE_END');
        }
      }
    }
  }, [currentNodeId, nodes, edges, history]);

  // 自动跳过标记了 skip 的普通卡片
  useEffect(() => {
    if (currentNodeId && currentNodeId !== 'THE_END' && currentNodeId !== lastJumpedNode.current) {
      const node = nodes.find((n) => n.id === currentNodeId);
      if (node && node.data.skip === true) {
        lastJumpedNode.current = currentNodeId;
        const outEdges = edges.filter((e) => e.source === currentNodeId);
        if (outEdges.length > 0) {
          const nextId = outEdges[0].target;
          setHistory((prev) => [...prev, currentNodeId]);
          navigateToNode(nextId);
        } else {
          setHistory((prev) => [...prev, currentNodeId]);
          navigateToNode('THE_END');
        }
      }
    }
  }, [currentNodeId, nodes, edges]);

  if (!currentNodeId) {
    return (
      <div
        className={`fixed inset-0 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-800'} z-[100] flex flex-col items-center justify-center p-6 text-center transition-colors duration-300`}
      >
        <div className="max-w-md">
          <h2 className={`text-2xl font-bold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
            {t.noScript}
          </h2>
          <p className={`${isDarkMode ? 'text-slate-400' : 'text-slate-600'} mb-8`}>
            {t.createStartNode}
          </p>
          <button
            onClick={onClose}
            className={`px-8 py-3 ${isDarkMode ? 'bg-sky-600 hover:bg-sky-700 shadow-sky-900/20' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'} text-white rounded-xl font-medium shadow-lg transition-all active:scale-95`}
          >
            {t.close}
          </button>
        </div>
      </div>
    );
  }

  if (!currentNode && currentNodeId !== 'THE_END') return null;

  // 如果是条件节点，它在后台自动运算并跳转，这里显示空或加载中
  if (currentNode && currentNode.type === 'numberConditionNode') {
    return (
      <div
        className={`fixed inset-0 ${isDarkMode ? 'bg-slate-950' : 'bg-white'} z-[100] flex items-center justify-center transition-colors duration-300`}
      >
        <div className="animate-pulse flex flex-col items-center">
          <Loader2
            className={`w-8 h-8 ${isDarkMode ? 'text-sky-400' : 'text-indigo-500'} animate-spin mb-4`}
          />
          <span
            className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}
          >
            计算条件中...
          </span>
        </div>
      </div>
    );
  }

  const handleChoiceClick = (targetId: string) => {
    advanceToTarget(targetId);
  };

  const handleBack = () => {
    if (history.length > 0) {
      const newHistory = [...history];
      let prev = newHistory.pop();

      // 跳过自动跳转的节点，避免回退后又自动前进
      while (prev) {
        const prevNode = nodes.find((n) => n.id === prev);
        if (prevNode?.type === 'numberConditionNode' || prevNode?.data.skip === true) {
          if (newHistory.length > 0) {
            prev = newHistory.pop();
          } else {
            const rootNode = nodes.find((n) => n.data.isRoot) || nodes[0];
            prev = rootNode?.id;
            break;
          }
        } else {
          break;
        }
      }

      setHistory(newHistory);
      navigateToNode(prev!);
    }
  };

  const hasMedia = !!(sceneImageUrl || currentNode?.data.videoUrl || presentedCharacters.length);
  const sceneMotion = presentationExiting ? presentation.scene?.exit : presentation.scene?.enter;
  const sceneAnimationActive = presentationExiting || !presentationVisible;
  const sceneObjectFit =
    presentation.scene?.cropMode === 'contain'
      ? 'contain'
      : presentation.scene?.cropMode === 'stretch'
        ? 'fill'
        : 'cover';
  const sceneStyle: React.CSSProperties = {
    objectFit: sceneObjectFit,
    objectPosition: `${50 + (presentation.scene?.offsetX || 0)}% ${
      50 + (presentation.scene?.offsetY || 0)
    }%`,
    opacity: sceneAnimationActive && sceneMotion?.type === 'fade' ? 0 : 1,
    transform: `scale(${presentation.scene?.scale || 1}) ${
      sceneAnimationActive && sceneMotion
        ? getPresentationTransform(sceneMotion.type, presentationExiting)
        : ''
    }`,
    transitionProperty: 'opacity, transform',
    transitionDuration: `${sceneMotion?.type === 'none' ? 0 : sceneMotion?.duration || 0}ms`,
    transitionTimingFunction: 'ease-out',
  };

  const renderPresentedCharacters = (constrainToClassicStage = false) => (
    <div
      className={`absolute inset-y-0 z-10 overflow-hidden pointer-events-none ${
        constrainToClassicStage
          ? 'left-1/2 w-full max-w-[1200px] -translate-x-1/2'
          : 'left-0 right-0'
      }`}
    >
      {presentedCharacters.map(({ config, data, imageUrl }) => {
        const motion = presentationExiting ? config.exit : config.enter;
        const animationActive = presentationExiting || !presentationVisible;
        const animationTransform =
          animationActive && motion
            ? getPresentationTransform(motion.type, presentationExiting)
            : '';
        return (
          <img
            key={config.sourceNodeId}
            src={imageUrl}
            alt={data.characterName}
            className="absolute max-h-[92%] max-w-[72%] w-auto object-contain object-bottom"
            style={{
              ...getCharacterStagePosition(config),
              zIndex: clampCharacterLayer(config.layer),
              opacity: animationActive && motion.type === 'fade' ? 0 : 1,
              translate: '-50% 0',
              transform: `${animationTransform} scale(${config.scale}) scaleX(${config.flipX ? -1 : 1})`,
              transformOrigin: 'center center',
              transitionProperty: 'opacity, transform',
              transitionDuration: `${motion.type === 'none' ? 0 : motion.duration}ms`,
              transitionTimingFunction: 'ease-out',
            }}
          />
        );
      })}
    </div>
  );

  return (
    <div
      ref={containerRef}
      onClick={handleTextContainerClick}
      className={`fixed inset-0 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-800'} z-[100] flex flex-col transition-colors duration-300 overflow-hidden cursor-pointer`}
    >
      {/* Header */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`h-14 flex items-center justify-between px-4 md:px-6 shrink-0 z-50 transition-all duration-300 ${
          isFocusMode ? 'hidden' : ''
        } ${
          layoutMode === 'immersive'
            ? 'absolute top-0 left-0 right-0 bg-gradient-to-b from-black/75 via-black/40 to-transparent text-white border-b-0'
            : isDarkMode
              ? 'bg-slate-900 border-b border-white/10 text-white'
              : 'bg-white border-b border-slate-200 text-slate-800'
        }`}
      >
        <div className="flex items-center gap-2 md:gap-3">
          <PlayCircle
            className={`w-5 h-5 ${layoutMode === 'immersive' ? 'text-sky-400' : isDarkMode ? 'text-sky-400' : 'text-indigo-600'}`}
          />
          <span
            className={`font-bold tracking-wide text-sm md:text-base truncate max-w-[120px] md:max-w-none ${layoutMode === 'immersive' ? 'text-white drop-shadow-sm' : isDarkMode ? 'text-white' : 'text-slate-800'}`}
          >
            {t.playTestTitle}
          </span>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <button
            onClick={handleBack}
            disabled={history.length === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-bold transition-all active:scale-95 ${
              layoutMode === 'immersive'
                ? 'bg-white/15 text-white hover:bg-white/25 disabled:bg-white/5'
                : isDarkMode
                  ? 'bg-sky-500/20 text-sky-300 hover:bg-sky-500/30'
                  : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
            } disabled:opacity-30 disabled:grayscale disabled:scale-100`}
            title={t.backHistory}
          >
            <RotateCcw className="w-3.5 h-3.5 md:w-4 md:h-4" />
            <span>{t.backHistory}</span>
          </button>

          <button
            onClick={() => setAutoAdvance(!autoAdvance)}
            className={`p-1.5 md:p-2 rounded-full transition-colors ${
              autoAdvance
                ? layoutMode === 'immersive'
                  ? 'bg-sky-500/80 text-white'
                  : isDarkMode
                    ? 'bg-sky-500/30 text-sky-200'
                    : 'bg-indigo-100 text-indigo-600'
                : layoutMode === 'immersive'
                  ? 'bg-white/10 text-white hover:bg-white/20'
                  : isDarkMode
                    ? 'bg-white/10 text-white hover:bg-white/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
            title={language === 'zh' ? '自动翻页' : 'Auto advance'}
          >
            <FastForward className="w-5 h-5" />
          </button>

          {layoutMode === 'classic' && (
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-1.5 md:p-2 rounded-full transition-colors ${
                isDarkMode
                  ? 'bg-white/10 hover:bg-white/20 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
              title={isDarkMode ? '切换到亮色模式' : '切换到黑暗模式'}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          )}

          {/* 全屏切换 */}
          <button
            onClick={toggleFullscreen}
            className={`p-1.5 md:p-2 rounded-full transition-colors ${
              layoutMode === 'immersive'
                ? 'bg-white/10 hover:bg-white/20 text-white'
                : isDarkMode
                  ? 'bg-white/10 hover:bg-white/20 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
            title={isFullscreen ? t.exitFullscreen : t.enterFullscreen}
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>

          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-1.5 md:p-2 rounded-full transition-colors ${
                showSettings
                  ? layoutMode === 'immersive'
                    ? 'bg-white/25 text-white'
                    : isDarkMode
                      ? 'bg-white/20'
                      : 'bg-slate-200'
                  : layoutMode === 'immersive'
                    ? 'bg-white/10 text-white hover:bg-white/20'
                    : isDarkMode
                      ? 'bg-white/10 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-sky-500/10 hover:text-sky-400'
              }`}
              title={t.layoutSettings}
            >
              <Settings className="w-5 h-5" />
            </button>

            {showSettings && (
              <div
                onClick={(e) => e.stopPropagation()}
                className={`absolute right-0 mt-2 w-[min(calc(100vw-1rem),42rem)] rounded-2xl shadow-2xl border z-[110] p-3 md:p-4 scale-in max-h-[85vh] overflow-y-auto ${
                  layoutMode === 'immersive'
                    ? 'bg-black/85 border-white/10 text-white backdrop-blur-md'
                    : isDarkMode
                      ? 'bg-slate-900 border-white/10 text-white'
                      : 'bg-white border-slate-200 text-slate-800'
                }`}
              >
                {/* 界面排版选择 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div
                    className={`rounded-xl border p-3 order-0 ${
                      layoutMode === 'immersive'
                        ? 'bg-white/5 border-white/10'
                        : isDarkMode
                          ? 'bg-white/5 border-white/10'
                          : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div
                      className={`text-xs font-bold uppercase tracking-wider mb-2 ${layoutMode === 'immersive' ? 'text-slate-400' : isDarkMode ? 'text-slate-500' : 'text-slate-400'} px-1`}
                    >
                      {t.playtestLayoutMode}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setLayoutMode('classic')}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors text-center ${layoutMode === 'classic' ? (isDarkMode ? 'bg-sky-600 text-white' : 'bg-indigo-600 text-white') : 'bg-white/10 text-slate-300 hover:bg-white/20'}`}
                      >
                        {t.layoutClassic}
                      </button>
                      <button
                        onClick={() => setLayoutMode('immersive')}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors text-center ${layoutMode === 'immersive' ? 'bg-sky-600 text-white' : isDarkMode ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                      >
                        {t.layoutImmersive}
                      </button>
                    </div>
                  </div>

                  <div
                    className={`rounded-xl border p-3 space-y-3 order-7 ${
                      layoutMode === 'immersive'
                        ? 'bg-white/5 border-white/10'
                        : isDarkMode
                          ? 'bg-white/5 border-white/10'
                          : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold uppercase tracking-wider ${layoutMode === 'immersive' ? 'text-slate-400' : isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
                      >
                        {language === 'zh' ? '自动翻页' : 'Auto Advance'}
                      </span>
                      <button
                        onClick={() => setAutoAdvance(!autoAdvance)}
                        className={`w-10 h-5 rounded-full transition-colors relative focus:outline-none ${autoAdvance ? (layoutMode === 'immersive' ? 'bg-sky-500' : isDarkMode ? 'bg-sky-500' : 'bg-indigo-600') : 'bg-slate-600'}`}
                      >
                        <div
                          className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${autoAdvance ? 'left-6' : 'left-1'}`}
                        />
                      </button>
                    </div>
                    <div className={`mt-3 ${autoAdvance ? 'opacity-100' : 'opacity-45'}`}>
                      <div className="flex justify-between text-[10px] font-bold mb-2">
                        <span
                          className={
                            layoutMode === 'immersive' || isDarkMode
                              ? 'text-slate-400'
                              : 'text-slate-500'
                          }
                        >
                          {language === 'zh' ? '等待' : 'Delay'}
                        </span>
                        <span
                          className={layoutMode === 'immersive' ? 'text-sky-300' : 'text-sky-500'}
                        >
                          {autoAdvanceDelay}s
                        </span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        step={1}
                        value={autoAdvanceDelay}
                        disabled={!autoAdvance}
                        onChange={(e) => setAutoAdvanceDelay(parseInt(e.target.value, 10))}
                        className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-sky-500 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div className="flex items-center justify-between border-t border-white/10 pt-3">
                      <span
                        className={`text-xs font-bold uppercase tracking-wider ${layoutMode === 'immersive' ? 'text-slate-400' : isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
                      >
                        {t.videoAutoPlay}
                      </span>
                      <button
                        onClick={() => setVideoAutoPlay(!videoAutoPlay)}
                        className={`w-10 h-5 rounded-full transition-colors relative focus:outline-none ${videoAutoPlay ? (layoutMode === 'immersive' ? 'bg-sky-500' : isDarkMode ? 'bg-sky-500' : 'bg-indigo-600') : 'bg-slate-600'}`}
                      >
                        <div
                          className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${videoAutoPlay ? 'left-6' : 'left-1'}`}
                        />
                      </button>
                    </div>
                    <div className="border-t border-white/10 pt-3 space-y-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        {language === 'zh' ? '标签显示' : 'Tag Display'}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">
                          {language === 'zh' ? '隐藏人物标签' : 'Hide character tags'}
                        </span>
                        <button
                          onClick={() => setHideCharacterTags(!hideCharacterTags)}
                          className={`w-10 h-5 rounded-full transition-colors relative focus:outline-none ${hideCharacterTags ? (layoutMode === 'immersive' || isDarkMode ? 'bg-sky-500' : 'bg-indigo-600') : 'bg-slate-600'}`}
                        >
                          <div
                            className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${hideCharacterTags ? 'left-6' : 'left-1'}`}
                          />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">
                          {language === 'zh' ? '隐藏场景标签' : 'Hide scene tags'}
                        </span>
                        <button
                          onClick={() => setHideSceneTags(!hideSceneTags)}
                          className={`w-10 h-5 rounded-full transition-colors relative focus:outline-none ${hideSceneTags ? (layoutMode === 'immersive' || isDarkMode ? 'bg-sky-500' : 'bg-indigo-600') : 'bg-slate-600'}`}
                        >
                          <div
                            className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${hideSceneTags ? 'left-6' : 'left-1'}`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`rounded-xl border p-3 order-2 ${choicesPosition === 'center' ? 'hidden' : ''} ${
                      layoutMode === 'immersive'
                        ? 'bg-white/5 border-white/10'
                        : isDarkMode
                          ? 'bg-white/5 border-white/10'
                          : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div
                      className={`text-xs font-bold uppercase tracking-wider mb-3 ${layoutMode === 'immersive' ? 'text-slate-400' : isDarkMode ? 'text-slate-500' : 'text-slate-400'} px-1`}
                    >
                      {t.choiceColumns}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[1, 2, 3].map((cols) => (
                        <button
                          key={cols}
                          onClick={() => {
                            setChoicesColumns(cols);
                            setShowSettings(false);
                          }}
                          className={`w-full text-center px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2 ${
                            choicesColumns === cols
                              ? layoutMode === 'immersive'
                                ? 'bg-sky-600 text-white'
                                : isDarkMode
                                  ? 'bg-sky-600 text-white'
                                  : 'bg-indigo-600 text-white'
                              : layoutMode === 'immersive'
                                ? 'text-slate-300 hover:bg-white/10'
                                : isDarkMode
                                  ? 'text-slate-300 hover:bg-white/10'
                                  : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span>{t[`column${cols}` as keyof typeof t]}</span>
                          {choicesColumns === cols && (
                            <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div
                    className={`rounded-xl border p-3 space-y-3 order-6 ${
                      layoutMode === 'immersive'
                        ? 'bg-white/5 border-white/10'
                        : isDarkMode
                          ? 'bg-white/5 border-white/10'
                          : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div
                      className={`text-xs font-bold uppercase tracking-wider ${layoutMode === 'immersive' ? 'text-slate-400' : isDarkMode ? 'text-slate-500' : 'text-slate-400'} px-1`}
                    >
                      {language === 'zh' ? '文本显示' : 'Text Transition'}
                    </div>
                    <select
                      value={interactionMode}
                      onChange={(e) => setInteractionMode(e.target.value)}
                      className={`w-full px-2 py-1.5 rounded-lg text-xs font-medium border outline-none ${
                        layoutMode === 'immersive'
                          ? 'bg-slate-900 border-white/20 text-white'
                          : isDarkMode
                            ? 'bg-slate-800 border-slate-700 text-white'
                            : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      <option
                        value="immediate"
                        className={
                          layoutMode === 'immersive' || isDarkMode
                            ? 'bg-slate-900 text-white'
                            : 'bg-white text-slate-800'
                        }
                      >
                        {language === 'zh' ? '立即显现' : 'Immediate'}
                      </option>
                      <option
                        value="typewriter"
                        className={
                          layoutMode === 'immersive' || isDarkMode
                            ? 'bg-slate-900 text-white'
                            : 'bg-white text-slate-800'
                        }
                      >
                        {language === 'zh' ? '打字机' : 'Typewriter'}
                      </option>
                      <option
                        value="timed"
                        className={
                          layoutMode === 'immersive' || isDarkMode
                            ? 'bg-slate-900 text-white'
                            : 'bg-white text-slate-800'
                        }
                      >
                        {language === 'zh' ? '延时展现' : 'Timed Delay'}
                      </option>
                      <option
                        value="clickToShow"
                        className={
                          layoutMode === 'immersive' || isDarkMode
                            ? 'bg-slate-900 text-white'
                            : 'bg-white text-slate-800'
                        }
                      >
                        {language === 'zh' ? '点击显示' : 'Click to Show'}
                      </option>
                    </select>

                    {interactionMode === 'typewriter' && (
                      <div className="space-y-1">
                        <div className="flex justify-between items-center px-1">
                          <span className="text-[10px] opacity-70">
                            {language === 'zh' ? '速度' : 'Speed'}
                          </span>
                          <span className="text-[10px] opacity-70">{typewriterSpeed}ms</span>
                        </div>
                        <input
                          type="range"
                          min={10}
                          max={100}
                          step={5}
                          value={typewriterSpeed}
                          onChange={(e) => setTypewriterSpeed(parseInt(e.target.value))}
                          className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-sky-400"
                        />
                      </div>
                    )}

                    {interactionMode === 'timed' && (
                      <div className="space-y-1">
                        <div className="flex justify-between items-center px-1">
                          <span className="text-[10px] opacity-70">
                            {language === 'zh' ? '延迟' : 'Delay'}
                          </span>
                          <span className="text-[10px] opacity-70">{choiceDelay}s</span>
                        </div>
                        <input
                          type="range"
                          min={0.5}
                          max={10}
                          step={0.5}
                          value={choiceDelay}
                          onChange={(e) => setChoiceDelay(parseFloat(e.target.value))}
                          className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-sky-400"
                        />
                      </div>
                    )}
                  </div>

                  <div
                    className={`rounded-xl border p-3 space-y-3 order-1 ${
                      layoutMode === 'immersive'
                        ? 'bg-white/5 border-white/10'
                        : isDarkMode
                          ? 'bg-white/5 border-white/10'
                          : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div
                      className={`text-xs font-bold uppercase tracking-wider ${layoutMode === 'immersive' ? 'text-slate-400' : isDarkMode ? 'text-slate-500' : 'text-slate-400'} px-1`}
                    >
                      {language === 'zh' ? '选项按钮位置' : 'Choices Position'}
                    </div>
                    <select
                      value={choicesPosition}
                      onChange={(e) => setChoicesPosition(e.target.value as any)}
                      className={`w-full px-2 py-1.5 rounded-lg text-xs font-medium border outline-none ${
                        layoutMode === 'immersive'
                          ? 'bg-slate-900 border-white/20 text-white'
                          : isDarkMode
                            ? 'bg-slate-800 border-slate-700 text-white'
                            : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      <option
                        value="center"
                        className={
                          layoutMode === 'immersive' || isDarkMode
                            ? 'bg-slate-900 text-white'
                            : 'bg-white text-slate-800'
                        }
                      >
                        {language === 'zh' ? '画面中间' : 'Center'}
                      </option>
                      <option
                        value="aboveText"
                        className={
                          layoutMode === 'immersive' || isDarkMode
                            ? 'bg-slate-900 text-white'
                            : 'bg-white text-slate-800'
                        }
                      >
                        {language === 'zh' ? '文字上方' : 'Above Text'}
                      </option>
                      <option
                        value="belowText"
                        className={
                          layoutMode === 'immersive' || isDarkMode
                            ? 'bg-slate-900 text-white'
                            : 'bg-white text-slate-800'
                        }
                      >
                        {language === 'zh' ? '文字下方' : 'Below Text'}
                      </option>
                    </select>
                  </div>

                  <div
                    className={`rounded-xl border p-3 space-y-3 order-3 ${
                      layoutMode === 'immersive'
                        ? 'bg-white/5 border-white/10'
                        : isDarkMode
                          ? 'bg-white/5 border-white/10'
                          : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold uppercase tracking-wider ${layoutMode === 'immersive' ? 'text-slate-400' : isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
                      >
                        {language === 'zh' ? '选项背景虚化' : 'Blur Background'}
                      </span>
                      <button
                        onClick={() => setBlurBackground(!blurBackground)}
                        className={`w-10 h-5 rounded-full transition-colors relative focus:outline-none ${blurBackground ? (layoutMode === 'immersive' ? 'bg-sky-500' : isDarkMode ? 'bg-sky-500' : 'bg-indigo-600') : 'bg-slate-600'}`}
                      >
                        <div
                          className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${blurBackground ? 'left-6' : 'left-1'}`}
                        />
                      </button>
                    </div>

                    {blurBackground && (
                      <div className="flex items-center justify-between border-t border-white/10 pt-3 animate-in fade-in duration-200">
                        <span
                          className={`text-xs font-bold uppercase tracking-wider ${layoutMode === 'immersive' ? 'text-slate-400' : isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
                        >
                          {language === 'zh' ? '虚化模糊文字' : 'Blur Story Text'}
                        </span>
                        <button
                          onClick={() => setBlurText(!blurText)}
                          className={`w-10 h-5 rounded-full transition-colors relative focus:outline-none ${blurText ? (layoutMode === 'immersive' ? 'bg-sky-500' : isDarkMode ? 'bg-sky-500' : 'bg-indigo-600') : 'bg-slate-600'}`}
                        >
                          <div
                            className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${blurText ? 'left-6' : 'left-1'}`}
                          />
                        </button>
                      </div>
                    )}
                  </div>

                  {choicesPosition === 'center' && (
                    <div
                      className={`rounded-xl border p-3 flex items-center justify-between animate-in fade-in duration-200 order-5 ${
                        layoutMode === 'immersive'
                          ? 'bg-white/5 border-white/10'
                          : isDarkMode
                            ? 'bg-white/5 border-white/10'
                            : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <span
                        className={`text-xs font-bold uppercase tracking-wider ${layoutMode === 'immersive' ? 'text-slate-400' : isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}
                      >
                        {language === 'zh' ? '单选项隐藏弹窗' : 'Skip Single Popup'}
                      </span>
                      <button
                        onClick={() => setSkipSingleChoicePopup(!skipSingleChoicePopup)}
                        className={`w-10 h-5 rounded-full transition-colors relative focus:outline-none ${skipSingleChoicePopup ? (layoutMode === 'immersive' ? 'bg-sky-500' : isDarkMode ? 'bg-sky-500' : 'bg-indigo-600') : 'bg-slate-600'}`}
                      >
                        <div
                          className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${skipSingleChoicePopup ? 'left-6' : 'left-1'}`}
                        />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div
            className={`w-px h-4 ${layoutMode === 'immersive' ? 'bg-white/20' : isDarkMode ? 'bg-white/10' : 'bg-slate-200'}`}
          ></div>

          <button
            onClick={onClose}
            className={`p-1.5 md:p-2 rounded-full transition-colors ${
              layoutMode === 'immersive'
                ? 'bg-white/10 hover:bg-red-500/30 text-white'
                : isDarkMode
                  ? 'bg-white/10 hover:bg-red-500/20 text-white'
                  : 'bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Novel Container */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        <div
          className={`w-full h-full flex flex-col ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}
        >
          {currentNodeId === 'THE_END' ? (
            layoutMode === 'immersive' ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center animate-in fade-in duration-500 relative w-full h-full">
                {/* 全景背景渐变 */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-900 z-0" />

                <div className="relative z-10 flex flex-col items-center max-w-md p-8 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 shadow-2xl">
                  <div className="w-20 h-20 mb-6 rounded-full flex items-center justify-center bg-white/10 border border-white/20 text-sky-400 animate-pulse">
                    <PlayCircle className="w-10 h-10" />
                  </div>
                  <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">
                    {t.storyEnd}
                  </h2>
                  <p className="text-slate-300 mb-8 max-w-sm">{t.branchEnded}</p>
                  <button
                    onClick={() => {
                      setHistory([]);
                      navigateToNode(root?.id || null);
                    }}
                    className="px-10 py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl shadow-lg shadow-sky-500/20 transition-all active:scale-95 hover:scale-[1.03]"
                  >
                    {t.restart}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center animate-in fade-in duration-500">
                <div
                  className={`w-20 h-20 mb-6 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-sky-500/20 text-sky-400' : 'bg-indigo-100 text-indigo-600'}`}
                >
                  <PlayCircle className="w-10 h-10" />
                </div>
                <h2
                  className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'} mb-4 tracking-tight`}
                >
                  {t.storyEnd}
                </h2>
                <p className={`${isDarkMode ? 'text-slate-400' : 'text-slate-500'} mb-8 max-w-sm`}>
                  {t.branchEnded}
                </p>
                <button
                  onClick={() => {
                    setHistory([]);
                    navigateToNode(root?.id || null);
                  }}
                  className={`px-10 py-3 ${isDarkMode ? 'bg-sky-600 hover:bg-sky-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white font-bold rounded-xl shadow-lg transition-all active:scale-95`}
                >
                  {t.restart}
                </button>
              </div>
            )
          ) : layoutMode === 'immersive' ? (
            <div className="flex-1 flex flex-col min-h-0 relative w-full h-full">
              {/* 1. 全景大图/视频背景 */}
              <div className="absolute inset-0 z-0 overflow-hidden w-full h-full select-none pointer-events-none">
                {sceneImageUrl ? (
                  <img
                    src={sceneImageUrl}
                    className="w-full h-full"
                    style={sceneStyle}
                    alt="Scene Background"
                  />
                ) : currentNode?.data.videoUrl ? (
                  <video
                    key={currentNodeId}
                    ref={videoRef}
                    src={currentNode.data.videoUrl as string}
                    playsInline
                    muted
                    loop
                    autoPlay={videoAutoPlay}
                    className="w-full h-full object-cover transition-all duration-1000"
                  />
                ) : (
                  <div
                    className={`w-full h-full ${isDarkMode ? 'bg-gradient-to-br from-slate-900 via-sky-950/40 to-slate-950' : 'bg-gradient-to-br from-indigo-50 via-slate-100 to-indigo-100'}`}
                  />
                )}
              </div>
              {renderPresentedCharacters()}

              {/* 2. 悬浮的选项与对话框 */}
              <div
                className={`absolute inset-0 flex flex-col justify-end p-4 md:p-6 lg:pb-10 lg:px-48 xl:px-64 pointer-events-none ${
                  choicesPosition === 'center' && animationCompleted && blurBackground
                    ? blurText
                      ? 'z-20'
                      : 'z-40'
                    : 'z-20'
                }`}
              >
                <div className="w-full flex flex-col gap-4 max-w-4xl mx-auto pointer-events-auto">
                  {/* 选项区域 - 文字上方 */}
                  {choicesPosition === 'aboveText' && renderChoices(true)}

                  {/* 透明半透明对话框 */}
                  <div
                    onClick={handleTextContainerClick}
                    className="w-full p-6 rounded-2xl bg-black/65 backdrop-blur-md border border-white/10 text-white shadow-2xl relative animate-in slide-in-from-bottom-6 duration-500 cursor-pointer overflow-hidden"
                  >
                    {currentNode?.data.audioUrl && (
                      <div className="mb-3 p-1.5 rounded-lg bg-white/5 border border-white/10">
                        <audio
                          key={currentNodeId}
                          ref={audioRef}
                          src={currentNode.data.audioUrl as string}
                          preload="auto"
                          controls
                          className="w-full h-7 opacity-75 hover:opacity-100 transition-opacity"
                        />
                      </div>
                    )}

                    <div className="text-base md:text-lg lg:text-xl leading-relaxed whitespace-pre-wrap font-serif tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] max-h-[150px] overflow-y-auto pr-1">
                      <div dangerouslySetInnerHTML={{ __html: displayedHtml || '' }} />
                    </div>

                    {!animationCompleted && (
                      <div className="absolute right-4 bottom-2 text-[10px] text-white/50 animate-pulse select-none">
                        {interactionMode === 'typewriter' &&
                          (language === 'zh' ? '点击跳过打字...' : 'Click to skip...')}
                        {interactionMode === 'timed' &&
                          (language === 'zh'
                            ? `选项将在 ${timeLeft}s 后出现`
                            : `Choices in ${timeLeft}s`)}
                        {interactionMode === 'clickToShow' &&
                          (language === 'zh'
                            ? '点击文本显示选项...'
                            : 'Click text to show options...')}
                      </div>
                    )}

                    {!animationCompleted && interactionMode === 'timed' && (
                      <div
                        className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-sky-400 to-indigo-500 transition-all duration-100"
                        style={{ width: `${(timeLeft / choiceDelay) * 100}%` }}
                      />
                    )}
                  </div>

                  {/* 选项区域 - 文字下方 */}
                  {choicesPosition === 'belowText' && renderChoices(true)}
                </div>
              </div>

              {/* 选项区域 - 画面中间 */}
              {choicesPosition === 'center' &&
                animationCompleted &&
                !(skipSingleChoicePopup && outEdges.length <= 1) && (
                  <div
                    className={`absolute inset-0 z-30 flex items-center justify-center p-6 bg-black/45 pointer-events-none animate-in fade-in duration-300 ${blurBackground ? 'backdrop-blur-[6px]' : 'backdrop-blur-none'}`}
                  >
                    <div className="w-full max-w-md max-h-[85vh] overflow-y-auto overflow-x-hidden pointer-events-auto">
                      {renderChoices(true)}
                    </div>
                  </div>
                )}
            </div>
          ) : (
            // 经典排版
            <div className="flex-1 flex flex-col min-h-0 relative">
              {/* 1. Media Area */}
              {hasMedia && (
                <div
                  className={`flex-1 min-h-0 flex items-center justify-center p-2 md:p-6 relative group overflow-hidden ${isDarkMode ? 'bg-slate-950' : 'bg-slate-100'}`}
                >
                  {/* Ambient Background Layer */}
                  <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none transition-all duration-1000">
                    {sceneImageUrl ? (
                      <img
                        src={sceneImageUrl}
                        className="w-full h-full object-cover blur-[60px] opacity-20 scale-125"
                        alt=""
                      />
                    ) : (
                      <div
                        className={`w-full h-full ${isDarkMode ? 'bg-gradient-radial from-sky-500/10' : 'bg-gradient-radial from-indigo-500/5'} to-transparent`}
                      />
                    )}
                  </div>

                  {/* Media Wrapper */}
                  <div className="relative z-10 w-full h-full flex items-center justify-center animate-in zoom-in-95 duration-500">
                    {sceneImageUrl && (
                      <img
                        src={sceneImageUrl}
                        alt="Scene"
                        className="h-full w-full rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] border border-white/10"
                        style={{
                          maxWidth: 'min(100%, 1200px)',
                          ...sceneStyle,
                          boxShadow: isDarkMode
                            ? '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
                            : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        }}
                      />
                    )}
                    {currentNode?.data.videoUrl && (
                      <video
                        key={currentNodeId}
                        ref={videoRef}
                        src={currentNode.data.videoUrl as string}
                        controls
                        playsInline
                        draggable={false}
                        onDragStart={(e) => e.preventDefault()}
                        autoPlay={videoAutoPlay}
                        className="max-h-full max-w-full object-contain rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] border border-white/10 transition-transform duration-500 hover:scale-[1.01]"
                        style={{
                          maxWidth: 'min(100%, 1200px)',
                          boxShadow: isDarkMode
                            ? '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
                            : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        }}
                      />
                    )}
                  </div>
                  {renderPresentedCharacters(true)}

                  {/* 选项区域 - 画面的中间（非全屏且有媒体时挂载在画面内） */}
                  {choicesPosition === 'center' &&
                    !isFullscreen &&
                    animationCompleted &&
                    !(skipSingleChoicePopup && outEdges.length <= 1) && (
                      <div
                        className={`absolute inset-0 z-30 flex items-center justify-center p-4 bg-black/45 pointer-events-none animate-in fade-in duration-300 ${blurBackground ? 'backdrop-blur-[6px]' : 'backdrop-blur-none'}`}
                      >
                        <div className="w-full max-w-sm max-h-[85vh] overflow-y-auto overflow-x-hidden pointer-events-auto p-4 bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl">
                          {renderChoices(false)}
                        </div>
                      </div>
                    )}
                </div>
              )}

              {/* 选项区域 - 文字上方 */}
              {choicesPosition === 'aboveText' && animationCompleted && (
                <div
                  ref={choicesRef}
                  className={`p-4 md:p-6 lg:px-48 xl:px-64 ${isDarkMode ? 'bg-slate-900 border-white/10' : 'bg-slate-100 border-slate-200'} border-b shrink-0 z-40 shadow-sm`}
                >
                  {renderChoices(false)}
                </div>
              )}

              {/* 2. Text Area */}
              <div
                onClick={handleTextContainerClick}
                className={`${hasMedia ? 'h-32 md:h-48 shrink-0' : 'flex-1'} overflow-y-auto px-6 py-4 md:px-12 md:py-8 lg:px-48 xl:px-64 ${isDarkMode ? 'bg-slate-950/90' : 'bg-white/90'} backdrop-blur-xl border-t border-white/5 cursor-pointer overflow-hidden transition-all duration-300 relative ${
                  choicesPosition === 'center' && animationCompleted && blurBackground
                    ? isFullscreen
                      ? blurText
                        ? 'z-20'
                        : 'z-40'
                      : blurText
                        ? 'z-20 blur-[5px] opacity-80'
                        : 'z-20'
                    : 'z-20'
                }`}
              >
                {currentNode?.data.audioUrl && (
                  <div
                    className={`mb-6 p-2 rounded-xl backdrop-blur-sm ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-900/5 border-slate-200'} border`}
                  >
                    <audio
                      key={currentNodeId}
                      ref={audioRef}
                      src={currentNode.data.audioUrl as string}
                      preload="auto"
                      controls
                      className="w-full h-8 opacity-80 hover:opacity-100 transition-opacity"
                    />
                  </div>
                )}
                <div
                  className={`text-lg md:text-xl lg:text-2xl ${isDarkMode ? 'text-slate-100' : 'text-slate-800'} leading-relaxed whitespace-pre-wrap font-serif tracking-wide drop-shadow-sm`}
                >
                  <div dangerouslySetInnerHTML={{ __html: displayedHtml || '' }} />
                </div>

                {!animationCompleted && (
                  <div className="absolute right-4 bottom-2 text-[10px] opacity-40 animate-pulse select-none">
                    {interactionMode === 'typewriter' &&
                      (language === 'zh' ? '点击跳过打字...' : 'Click to skip...')}
                    {interactionMode === 'timed' &&
                      (language === 'zh'
                        ? `选项将在 ${timeLeft}s 后出现`
                        : `Choices in ${timeLeft}s`)}
                    {interactionMode === 'clickToShow' &&
                      (language === 'zh' ? '点击文本显示选项...' : 'Click text to show options...')}
                  </div>
                )}

                {!animationCompleted && interactionMode === 'timed' && (
                  <div
                    className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-sky-400 to-indigo-500 transition-all duration-100"
                    style={{ width: `${(timeLeft / choiceDelay) * 100}%` }}
                  />
                )}
              </div>

              {/* 3. Choices Area - 文字下方 */}
              {choicesPosition === 'belowText' && animationCompleted && (
                <div
                  ref={choicesRef}
                  className={`p-4 md:p-6 lg:px-48 xl:px-64 ${isDarkMode ? 'bg-slate-900 border-white/10' : 'bg-slate-100 border-slate-200'} border-t shrink-0 z-40 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]`}
                >
                  {renderChoices(false)}
                </div>
              )}

              {/* 选项区域 - 屏幕的中间（当全屏，或无媒体文件时挂载在整个视口中央） */}
              {choicesPosition === 'center' &&
                (isFullscreen || !hasMedia) &&
                animationCompleted &&
                !(skipSingleChoicePopup && outEdges.length <= 1) && (
                  <div
                    className={`absolute inset-0 z-30 flex items-center justify-center p-6 bg-black/45 pointer-events-none animate-in fade-in duration-300 ${blurBackground ? 'backdrop-blur-[6px]' : 'backdrop-blur-none'}`}
                  >
                    <div className="w-full max-w-md max-h-[85vh] overflow-y-auto overflow-x-hidden pointer-events-auto p-4 bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl">
                      {renderChoices(false)}
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>
      </div>

      {/* 沉浸式模式切换按钮 */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsFocusMode(!isFocusMode);
        }}
        className={`absolute bottom-6 right-6 z-[120] p-3.5 rounded-full shadow-xl backdrop-blur-lg transition-all duration-300 hover:scale-110 active:scale-95 border ${
          isFocusMode
            ? isDarkMode
              ? 'bg-slate-800/80 hover:bg-slate-800 text-sky-400 border-sky-500/40 shadow-sky-950/20'
              : 'bg-black/80 hover:bg-black text-sky-400 border-sky-500/30 shadow-black/20'
            : isDarkMode
              ? 'bg-slate-900/20 hover:bg-slate-900/40 text-slate-100 hover:text-white border-white/10 shadow-slate-950/30'
              : 'bg-white/20 hover:bg-white/40 text-slate-400 hover:text-slate-900 border-black/10 shadow-slate-200/30'
        }`}
        title={isFocusMode ? t.exitZenMode : t.enterZenMode}
      >
        {isFocusMode ? <EyeOff className="w-5 h-5 animate-pulse" /> : <Eye className="w-5 h-5" />}
      </button>
    </div>
  );
}
