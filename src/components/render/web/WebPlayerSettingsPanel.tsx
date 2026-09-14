import { useEffect, useMemo, useRef } from 'react';
import type { Language } from '../../../lib/i18n';
import type { WebMenuElement } from '../video/shared/types';
import {
  mountPlayerSettings,
  playerSettingsMarkup,
  PLAYER_SETTINGS_CSS,
  type PlayerSettingsValues,
} from './playerSettingsPanel';

type Props = {
  language: Language;
  values: PlayerSettingsValues;
  defaults: PlayerSettingsValues;
  elements: WebMenuElement[];
  onChange: (patch: Partial<PlayerSettingsValues>) => void;
  onClose: () => void;
};

export function PlayerSettingsPanel(props: Props) {
  const root = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const controller = useRef<ReturnType<typeof mountPlayerSettings> | null>(null);
  const markup = useMemo(() => playerSettingsMarkup(props.language), [props.language]);
  // Only template semantics change the markup. Slider updates must preserve focus and dragging.
  const elementConfig = JSON.stringify(
    props.elements.map(({ role, text, visible, disabled }) => ({ role, text, visible, disabled })),
  );
  useEffect(() => {
    const current = latest.current;
    controller.current = mountPlayerSettings(
      root.current!,
      current.values,
      current.defaults,
      (patch) => latest.current.onChange(patch),
      () => latest.current.onClose(),
      JSON.parse(elementConfig),
    );
    return () => {
      controller.current?.destroy();
      controller.current = null;
    };
  }, [markup, elementConfig]);
  useEffect(() => {
    controller.current?.sync(props.values);
  }, [props.values]);
  return (
    <>
      <style>{PLAYER_SETTINGS_CSS}</style>
      <div
        ref={root}
        className="gw-ps-surface"
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Escape') props.onClose();
        }}
        dangerouslySetInnerHTML={{ __html: markup }}
      />
    </>
  );
}
