import { logger } from "./logger";

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

/**
 * Elements of a declared array replace the server's whole, but the server may
 * add fields to each element (Id, UserId, NetworkPath). Carry those over from
 * the current element with the same identity so they neither read as drift nor
 * get wiped by the update.
 */
export function carryServerFields<T extends object>(
  wanted: T[] | undefined,
  existing: T[] | undefined,
  identity: (item: T) => unknown,
): T[] | undefined {
  return wanted?.map((item: T): T => {
    const match: T | undefined = existing?.find(
      (candidate: T) => identity(candidate) === identity(item),
    );
    return match ? { ...match, ...item } : item;
  });
}

let serverVersion: string = "an unknown version";
const warnedUnsupported: Set<string> = new Set();

/** Names the connected server in "not supported" warnings. */
export function setServerVersion(version: string): void {
  serverVersion = version;
}

/** Forgets which unsupported paths were already warned about (tests). */
export function resetUnsupportedWarnings(): void {
  warnedUnsupported.clear();
}

function shapeOf(elements: unknown[]): Record<string, unknown> {
  const shape: Record<string, unknown> = {};
  for (const element of elements) {
    if (!isPlainObject(element)) continue;
    for (const [key, value] of Object.entries(element)) {
      if (!(key in shape) || shape[key] === null) shape[key] = value;
    }
  }
  return shape;
}

function pruneUnsupported(
  current: unknown,
  desired: unknown,
  path: string,
): unknown {
  if (Array.isArray(desired) && Array.isArray(current)) {
    const shape: Record<string, unknown> = shapeOf(current);
    if (Object.keys(shape).length === 0) return desired;
    return desired.map((element: unknown) =>
      pruneUnsupported(shape, element, `${path}[]`),
    );
  }
  if (!isPlainObject(desired) || !isPlainObject(current)) return desired;
  if (Object.keys(current).length === 0) return desired;
  const kept: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(desired)) {
    if (value === undefined) continue;
    if (!(key in current)) {
      const message: string = `${path}.${key} is not supported by Jellyfin ${serverVersion}; skipped`;
      if (!warnedUnsupported.has(message)) {
        warnedUnsupported.add(message);
        logger.warn(message);
      }
      continue;
    }
    kept[key] = pruneUnsupported(current[key], value, `${path}.${key}`);
  }
  return kept;
}

/**
 * Drops from `desired` every key the server's `current` object does not have,
 * warning once per path. A server returns every field it knows, so a missing
 * key means it predates the field (or dropped it): sending it would write
 * nothing and read as drift on every run. Applies recursively.
 */
export function withoutUnsupported<T>(
  current: unknown,
  desired: T,
  path: string,
): T {
  return pruneUnsupported(current, desired, path) as T;
}

/** `overlay` that first drops the keys the server does not support. */
export function overlaySupported(
  current: unknown,
  desired: unknown,
  path: string,
): unknown {
  return overlay(current, withoutUnsupported(current, desired, path));
}
