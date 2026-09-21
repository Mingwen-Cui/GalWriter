import { webElementTextPaintStyle } from './webElementStyle';
import type { PlayerSettingsPanelConfig } from './playerSettingsPanelConfig';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
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
  editableLabel?: ReactNode;
  onChange: (patch: Partial<PlayerSettingsValues>) => void;
  onClose: () => void;
};

export function PlayerSettingsPanel(props: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [labelHost, setLabelHost] = useState<HTMLElement | null>(null);
  const hasEditableLabel = props.editableLabel !== undefined;
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
  useLayoutEffect(() => {
    const current = latest.current;
    const host = root.current!;
    // This controller owns the DOM. React must not replace its inputs on value updates,
    // otherwise the controller retains detached nodes and native slider drags are lost.
    host.innerHTML = markup;
    const mounted = mountPlayerSettings(
      host,
      current.values,
      current.defaults,
      (patch) => latest.current.onChange(patch),
      () => latest.current.onClose(),
      JSON.parse(elementConfig),
    );
    controller.current = mounted;
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
    if (hasEditableLabel) {
      const label = host.querySelector<HTMLElement>('[data-role-label]');
      // The runtime owns the widget, while the editor owns only its label.
      label?.replaceChildren();
      setLabelHost(label);
    }
    return () => {
      mounted.destroy();
      if (controller.current === mounted) controller.current = null;
    };
  }, [markup, elementConfig, hasEditableLabel]);
  useLayoutEffect(() => {
    controller.current?.sync(props.values);
  }, [props.values]);
  return (
    <>
      {!props.element && <style>{PLAYER_SETTINGS_CSS}</style>}
      <div
        ref={root}
        className={props.element ? 'gw-ps-widget-surface' : 'gw-ps-surface'}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          if (hasEditableLabel) event.preventDefault();
        }}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Escape') props.onClose();
        }}
      />
      {hasEditableLabel && labelHost && createPortal(props.editableLabel, labelHost)}
    </>
  );
}
