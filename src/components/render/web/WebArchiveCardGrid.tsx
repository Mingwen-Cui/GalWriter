import { useLayoutEffect, useRef } from 'react';
import type { Language } from '../../../lib/i18n';
import { mountWebArchiveGrid, type WebArchiveCard } from './webArchiveGrid';

export function WebArchiveCardGrid(props: {
  cards: WebArchiveCard[];
  language: Language;
  interactive: boolean;
  onPlay: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const latest = useRef(props); latest.current = props;
  useLayoutEffect(() => {
    const mounted = mountWebArchiveGrid(root.current!, props.cards, props.language,
      (id) => latest.current.onPlay(id), (id) => latest.current.onDelete(id), props.interactive);
    return mounted.destroy;
  }, [props.cards, props.language, props.interactive]);
  return <div ref={root} />;
}
