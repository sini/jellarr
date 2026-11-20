/**
 * Drop keys whose value is `undefined`. Mappers diff their output against the
 * live server config, so an omitted option must be absent rather than an
 * explicit `undefined`, which json-diff-ts would otherwise report as a spurious
 * change.
 */
export function withoutUndefined<T extends Record<string, unknown>>(
  obj: T,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(
      ([, value]: [string, unknown]) => value !== undefined,
    ),
  ) as Partial<T>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Overlays desired onto current: objects merge key by key, so keys desired
 * does not mention survive; arrays and scalars desired declares replace the
 * current value whole, so a shrunk, reordered or edited array lands exactly.
 * A key whose desired value is undefined counts as not declared.
 */
export function overlay(current: unknown, desired: unknown): unknown {
  if (!isPlainObject(desired) || !isPlainObject(current)) return desired;
  const merged: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(desired)) {
    if (value !== undefined) merged[key] = overlay(current[key], value);
  }
  return merged;
}
