import { Plus, Trash2, Wrench } from 'lucide-react';

import type { Language } from '../../../lib/i18n';
import {
  createDefaultVariable,
  sanitizeRenpyIdentifier,
  validateRenpyIdentifier,
} from './codeExport/model';
import type {
  RenpyCharacterConfig,
  RenpyExportSettings,
  RenpyVariableChange,
  RenpyVariableConfig,
} from './codeExport/types';
import { getCodeText } from './i18n';
const fieldClass =
  'h-8 w-full rounded-md border border-[var(--vr-border)] bg-[var(--vr-bg)] px-2 text-xs text-[var(--vr-text)]';

export function CharacterInspector({
  character,
  language,
  onChange,
}: {
  character: RenpyCharacterConfig;
  language: Language;
  onChange: (value: RenpyCharacterConfig) => void;
}) {
  const invalid = validateRenpyIdentifier(character.codeName);
  return (
    <div className="space-y-3 p-3">
      <h3 className="text-xs font-black">{getCodeText(language, 'Character inspector')}</h3>
      <Field label={getCodeText(language, 'Display name')}>
        <input
          className={fieldClass}
          value={character.displayName}
          onChange={(event) => onChange({ ...character, displayName: event.target.value })}
        />
      </Field>
      <Field label={getCodeText(language, 'Code name')}>
        <div className="flex gap-1">
          <input
            className={fieldClass}
            value={character.codeName}
            onChange={(event) => onChange({ ...character, codeName: event.target.value })}
          />
          <button
            type="button"
            title={getCodeText(language, 'Auto-fix')}
            onClick={() =>
              onChange({
                ...character,
                codeName: sanitizeRenpyIdentifier(
                  character.codeName || character.displayName,
                  'character',
                ),
              })
            }
            className="rounded-md border border-[var(--vr-border)] px-2"
          >
            <Wrench className="h-3.5 w-3.5" />
          </button>
        </div>
        {invalid && <p className="mt-1 text-[10px] text-red-400">{invalid}</p>}
      </Field>
      <Field label={getCodeText(language, 'Dialogue abbreviation')}>
        <input
          className={fieldClass}
          value={character.abbreviation}
          onChange={(event) => onChange({ ...character, abbreviation: event.target.value })}
        />
      </Field>
      <Field label={getCodeText(language, 'Default sprite URL')}>
        <input
          className={fieldClass}
          value={character.defaultSprite || ''}
          onChange={(event) =>
            onChange({ ...character, defaultSprite: event.target.value || undefined })
          }
        />
      </Field>
      <div>
        <div className="mb-1 text-[10px] font-bold text-[var(--vr-text-muted)]">
          {getCodeText(language, 'Expression to sprite')}
        </div>
        {Object.entries(character.expressions).map(([name, url]) => (
          <div key={name} className="mb-1 grid grid-cols-[90px_1fr_28px] gap-1">
            <input
              className={fieldClass}
              value={name}
              onChange={(event) => {
                const next = { ...character.expressions };
                delete next[name];
                next[event.target.value] = url;
                onChange({ ...character, expressions: next });
              }}
            />
            <input
              className={fieldClass}
              value={url}
              onChange={(event) =>
                onChange({
                  ...character,
                  expressions: { ...character.expressions, [name]: event.target.value },
                })
              }
            />
            <button
              type="button"
              onClick={() => {
                const next = { ...character.expressions };
                delete next[name];
                onChange({ ...character, expressions: next });
              }}
              className="rounded-md border border-[var(--vr-border)]"
            >
              <Trash2 className="mx-auto h-3 w-3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            onChange({
              ...character,
              expressions: {
                ...character.expressions,
                [`expression_${Object.keys(character.expressions).length + 1}`]: '',
              },
            })
          }
          className="mt-1 flex items-center gap-1 text-[11px] text-[var(--vr-accent-strong)]"
        >
          <Plus className="h-3 w-3" />
          {getCodeText(language, 'Add expression')}
        </button>
      </div>
    </div>
  );
}

export function VariableInspector({
  variable,
  language,
  onChange,
  onDelete,
}: {
  variable: RenpyVariableConfig;
  language: Language;
  onChange: (value: RenpyVariableConfig) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black">{getCodeText(language, 'Variable inspector')}</h3>
        {variable.id !== 'gw_score' && (
          <button type="button" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5 text-red-400" />
          </button>
        )}
      </div>
      <Field label={getCodeText(language, 'Display name')}>
        <input
          className={fieldClass}
          value={variable.displayName}
          onChange={(event) => onChange({ ...variable, displayName: event.target.value })}
        />
      </Field>
      <Field label={getCodeText(language, 'Code name')}>
        <input
          className={fieldClass}
          value={variable.codeName}
          onChange={(event) => onChange({ ...variable, codeName: event.target.value })}
        />
      </Field>
      <Field label={getCodeText(language, 'Type')}>
        <select
          className={fieldClass}
          value={variable.type}
          onChange={(event) => {
            const type = event.target.value as RenpyVariableConfig['type'];
            onChange({
              ...variable,
              type,
              initialValue: type === 'number' ? 0 : type === 'boolean' ? false : '',
            });
          }}
        >
          <option value="number">number</option>
          <option value="boolean">boolean</option>
          <option value="string">string</option>
        </select>
      </Field>
      <Field label={getCodeText(language, 'Initial value')}>
        {variable.type === 'boolean' ? (
          <select
            className={fieldClass}
            value={String(variable.initialValue)}
            onChange={(event) =>
              onChange({ ...variable, initialValue: event.target.value === 'true' })
            }
          >
            <option value="false">false</option>
            <option value="true">true</option>
          </select>
        ) : (
          <input
            className={fieldClass}
            type={variable.type === 'number' ? 'number' : 'text'}
            value={String(variable.initialValue)}
            onChange={(event) =>
              onChange({
                ...variable,
                initialValue:
                  variable.type === 'number' ? Number(event.target.value) : event.target.value,
              })
            }
          />
        )}
      </Field>
    </div>
  );
}

export function NodeInspector({
  nodeId,
  settings,
  language,
  isCondition,
  legacyCondition,
  onChange,
}: {
  nodeId: string;
  settings: RenpyExportSettings;
  language: Language;
  isCondition: boolean;
  legacyCondition?: { threshold: number; ranges: Array<{ id: string; min: number; max: number }> };
  onChange: (settings: RenpyExportSettings) => void;
}) {
  if (isCondition) {
    const config = settings.conditions[nodeId] || {
      variableId: 'gw_score',
      threshold: legacyCondition?.threshold || 0,
      ranges: legacyCondition?.ranges || [],
    };
    const update = (patch: Partial<typeof config>) =>
      onChange({
        ...settings,
        conditions: { ...settings.conditions, [nodeId]: { ...config, ...patch } },
      });
    return (
      <div className="space-y-3 p-3">
        <h3 className="text-xs font-black">{getCodeText(language, 'Condition variable')}</h3>
        <select
          className={fieldClass}
          value={config.variableId}
          onChange={(event) => update({ variableId: event.target.value })}
        >
          {settings.variables
            .filter((variable) => variable.type === 'number')
            .map((variable) => (
              <option key={variable.id} value={variable.id}>
                {variable.displayName} · {variable.codeName}
              </option>
            ))}
        </select>
        <Field label=">= threshold">
          <input
            type="number"
            className={fieldClass}
            value={config.threshold ?? 0}
            onChange={(event) => update({ threshold: Number(event.target.value) })}
          />
        </Field>
        <div>
          <div className="mb-1 text-[10px] font-bold text-[var(--vr-text-muted)]">
            {getCodeText(language, 'Interval rules')}
          </div>
          {(config.ranges || []).map((range, index) => (
            <div key={range.id} className="mb-1 grid grid-cols-[1fr_1fr_28px] gap-1">
              <input
                type="number"
                className={fieldClass}
                value={range.min}
                onChange={(event) =>
                  update({
                    ranges: (config.ranges || []).map((item, itemIndex) =>
                      itemIndex === index ? { ...item, min: Number(event.target.value) } : item,
                    ),
                  })
                }
              />
              <input
                type="number"
                className={fieldClass}
                value={range.max}
                onChange={(event) =>
                  update({
                    ranges: (config.ranges || []).map((item, itemIndex) =>
                      itemIndex === index ? { ...item, max: Number(event.target.value) } : item,
                    ),
                  })
                }
              />
              <button
                type="button"
                onClick={() =>
                  update({
                    ranges: (config.ranges || []).filter((_, itemIndex) => itemIndex !== index),
                  })
                }
                className="rounded-md border border-[var(--vr-border)]"
              >
                <Trash2 className="mx-auto h-3 w-3" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              update({
                ranges: [
                  ...(config.ranges || []),
                  { id: `range_${(config.ranges || []).length + 1}`, min: 0, max: 10 },
                ],
              })
            }
            className="mt-1 flex items-center gap-1 text-[11px] text-[var(--vr-accent-strong)]"
          >
            <Plus className="h-3 w-3" />
            {getCodeText(language, 'Add interval')}
          </button>
        </div>
        <p className="text-[10px] leading-4 text-[var(--vr-text-muted)]">
          {getCodeText(language, 'Condition semantics help')}
        </p>
      </div>
    );
  }
  const config = settings.nodes[nodeId] || {};
  const updateChanges = (changes: RenpyVariableChange[]) =>
    onChange({
      ...settings,
      nodes: { ...settings.nodes, [nodeId]: { ...config, variableChanges: changes } },
    });
  return (
    <div className="space-y-3 p-3">
      <h3 className="text-xs font-black">{getCodeText(language, 'Story node')}</h3>
      <Field label={getCodeText(language, 'Speaker')}>
        <select
          className={fieldClass}
          value={config.speakerId || ''}
          onChange={(event) =>
            onChange({
              ...settings,
              nodes: {
                ...settings.nodes,
                [nodeId]: {
                  ...config,
                  speakerId: event.target.value || undefined,
                  expression: undefined,
                },
              },
            })
          }
        >
          <option value="">{getCodeText(language, 'Narrator')}</option>
          {settings.characters.map((character) => (
            <option key={character.sourceNodeId} value={character.sourceNodeId}>
              {character.displayName}
            </option>
          ))}
        </select>
      </Field>
      {config.speakerId && (
        <Field label={getCodeText(language, 'Expression')}>
          <select
            className={fieldClass}
            value={config.expression || ''}
            onChange={(event) =>
              onChange({
                ...settings,
                nodes: {
                  ...settings.nodes,
                  [nodeId]: { ...config, expression: event.target.value || undefined },
                },
              })
            }
          >
            <option value="">{getCodeText(language, 'Default sprite')}</option>
            {Object.keys(
              settings.characters.find((item) => item.sourceNodeId === config.speakerId)
                ?.expressions || {},
            ).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <div>
        <div className="mb-1 text-[10px] font-bold text-[var(--vr-text-muted)]">
          {getCodeText(language, 'On-enter variable changes')}
        </div>
        {(config.variableChanges || []).map((change, index) => {
          const variable = settings.variables.find((item) => item.id === change.variableId);
          return (
            <div
              key={`${change.variableId}-${index}`}
              className="mb-1 grid grid-cols-[1fr_72px_76px_28px] gap-1"
            >
              <select
                className={fieldClass}
                value={change.variableId}
                onChange={(event) =>
                  updateChanges(
                    (config.variableChanges || []).map((item, itemIndex) =>
                      itemIndex === index ? { ...item, variableId: event.target.value } : item,
                    ),
                  )
                }
              >
                {settings.variables.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.displayName}
                  </option>
                ))}
              </select>
              <select
                className={fieldClass}
                value={change.operation}
                onChange={(event) =>
                  updateChanges(
                    (config.variableChanges || []).map((item, itemIndex) =>
                      itemIndex === index
                        ? {
                            ...item,
                            operation: event.target.value as RenpyVariableChange['operation'],
                          }
                        : item,
                    ),
                  )
                }
              >
                <option value="add">+</option>
                <option value="subtract">−</option>
                <option value="set">=</option>
              </select>
              <input
                className={fieldClass}
                type={variable?.type === 'number' ? 'number' : 'text'}
                value={String(change.value)}
                onChange={(event) =>
                  updateChanges(
                    (config.variableChanges || []).map((item, itemIndex) =>
                      itemIndex === index
                        ? {
                            ...item,
                            value:
                              variable?.type === 'number'
                                ? Number(event.target.value)
                                : variable?.type === 'boolean'
                                  ? event.target.value === 'true'
                                  : event.target.value,
                          }
                        : item,
                    ),
                  )
                }
              />
              <button
                type="button"
                onClick={() =>
                  updateChanges(
                    (config.variableChanges || []).filter((_, itemIndex) => itemIndex !== index),
                  )
                }
                className="rounded-md border border-[var(--vr-border)]"
              >
                <Trash2 className="mx-auto h-3 w-3" />
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() =>
            updateChanges([
              ...(config.variableChanges || []),
              { variableId: settings.variables[0]?.id || 'gw_score', operation: 'add', value: 0 },
            ])
          }
          className="mt-1 flex items-center gap-1 text-[11px] text-[var(--vr-accent-strong)]"
        >
          <Plus className="h-3 w-3" />
          {getCodeText(language, 'Add change')}
        </button>
      </div>
    </div>
  );
}

export const addVariable = (settings: RenpyExportSettings) => ({
  ...settings,
  variables: [...settings.variables, createDefaultVariable(settings.variables.length)],
});
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold text-[var(--vr-text-muted)]">{label}</span>
      {children}
    </label>
  );
}
