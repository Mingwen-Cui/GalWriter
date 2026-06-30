const sortJsonValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => sortJsonValue(item));
  }

  if (value && typeof value === 'object') {
    const sortedEntries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    const normalized: Record<string, unknown> = {};
    for (const [key, item] of sortedEntries) {
      normalized[key] = sortJsonValue(item);
    }
    return normalized;
  }

  return value;
};

export const stableStringify = (value: unknown): string => JSON.stringify(sortJsonValue(value));

