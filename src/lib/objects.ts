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
 * A key whose desired value is undefined counts as not declared, and a null
 * over a null or absent key changes nothing.
 */
export function overlay(current: unknown, desired: unknown): unknown {
  if (!isPlainObject(desired) || !isPlainObject(current)) return desired;
  const merged: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(desired)) {
    // NOTE: Jellyfin omits a null field, so a declared null over an absent key is already in place.
    if (value === null && current[key] == null) continue;
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

interface SchemaNode {
  $ref?: string;
  properties?: Record<string, SchemaNode>;
  items?: SchemaNode;
  allOf?: SchemaNode[];
  oneOf?: SchemaNode[];
  anyOf?: SchemaNode[];
}

let serverVersion: string = "an unknown version";
let serverSchemas: Record<string, SchemaNode> | undefined;
const warnedUnsupported: Set<string> = new Set();

/** Names the connected server in "not supported" warnings. */
export function setServerVersion(version: string): void {
  serverVersion = version;
}

/**
 * Takes the connected server's own OpenAPI document, the authority on which
 * fields it knows. Without one, nothing is skipped.
 */
export function setServerSpec(spec: unknown): void {
  serverSchemas = (
    spec as { components?: { schemas?: Record<string, SchemaNode> } }
  ).components?.schemas;
}

/** Forgets the server spec and which paths were already warned about (tests). */
export function resetServerSpec(): void {
  serverSchemas = undefined;
  serverVersion = "an unknown version";
  warnedUnsupported.clear();
}

function resolveNode(node: SchemaNode | undefined): SchemaNode | undefined {
  if (!node) return undefined;
  if (node.$ref) {
    return resolveNode(serverSchemas?.[node.$ref.replace(/^.*\//, "")]);
  }
  const wrapped: SchemaNode | undefined = [
    ...(node.allOf ?? []),
    ...(node.oneOf ?? []),
    ...(node.anyOf ?? []),
  ].find((alternative: SchemaNode) => alternative.$ref);
  return wrapped ? resolveNode(wrapped) : node;
}

function pruneUnsupported(
  node: SchemaNode | undefined,
  desired: unknown,
  path: string,
): unknown {
  const schema: SchemaNode | undefined = resolveNode(node);
  if (Array.isArray(desired)) {
    return desired.map((element: unknown) =>
      pruneUnsupported(schema?.items, element, `${path}[]`),
    );
  }
  if (!isPlainObject(desired) || !schema?.properties) return desired;
  const known: Record<string, SchemaNode> = schema.properties;
  const kept: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(desired)) {
    if (value === undefined) continue;
    if (!(key in known)) {
      const message: string = `${path}.${key} is not supported by Jellyfin ${serverVersion}; skipped`;
      if (!warnedUnsupported.has(message)) {
        warnedUnsupported.add(message);
        logger.warn(message);
      }
      continue;
    }
    kept[key] = pruneUnsupported(known[key], value, `${path}.${key}`);
  }
  return kept;
}

/**
 * Drops from `desired` every key the connected server's schema `typeName`
 * does not define, warning once per path. A server that predates a field (or
 * dropped it) ignores it on write and never reports it back, so keeping it
 * would read as drift on every run. Absence from the server's current object
 * proves nothing, since Jellyfin omits null fields. Applies through nested
 * objects and array elements.
 */
export function withoutUnsupported<T>(
  typeName: string,
  desired: T,
  path: string,
): T {
  return pruneUnsupported({ $ref: typeName }, desired, path) as T;
}

/** `overlay` that first drops the keys the server's schema does not define. */
export function overlaySupported(
  typeName: string,
  current: unknown,
  desired: unknown,
  path: string,
): unknown {
  return overlay(current, withoutUnsupported(typeName, desired, path));
}
