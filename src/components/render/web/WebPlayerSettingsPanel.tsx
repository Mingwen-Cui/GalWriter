import { webElementTextPaintStyle } from './webElementStyle';
import type { PlayerSettingsPanelConfig } from './playerSettingsPanelConfig';
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
  config?: PlayerSettingsPanelConfig;
  values: PlayerSettingsValues;
  defaults: PlayerSettingsValues;
  elements: WebMenuElement[];
  element?: WebMenuElement;
  onChange: (patch: Partial<PlayerSettingsValues>) => void;
  onClose: () => void;
};

export function PlayerSettingsPanel(props: Props) {
  const root = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const controller = useRef<ReturnType<typeof mountPlayerSettings> | null>(null);
  const configKey = JSON.stringify(props.config || {});
  const widgetKey = JSON.stringify(props.element || null);
  const markup = useMemo(
    () =>
      playerSettingsMarkup(
        props.language,
        JSON.parse(configKey),
        JSON.parse(widgetKey) || undefined,
      ),
    [props.language, configKey, widgetKey],
  );
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
    if (current.element) {
      root.current?.querySelectorAll<HTMLElement>('[data-role-label]').forEach((label) => {
        Object.assign(label.style, webElementTextPaintStyle(current.element!), {
          fontFamily: current.element!.fontFamily || 'inherit',
          fontWeight: String(current.element!.fontWeight || 500),
          textAlign: current.element!.textAlign || 'left',
          visibility: current.element!.textVisible === false ? 'hidden' : 'visible',
        });
      });
    }
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
      {!props.element && <style>{PLAYER_SETTINGS_CSS}</style>}
      <div
        ref={root}
        className={props.element ? 'gw-ps-widget-surface' : 'gw-ps-surface'}
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
