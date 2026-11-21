import { createHash } from "crypto";
import { deepEqual } from "fast-equals";
import type { JellyfinClient } from "../api/jellyfin.types";
import { overlay } from "../lib/objects";
import {
  mapLiveTvOptionsConfigToSchema,
  mapListingProviderConfigToSchema,
  mapTunerHostConfigToSchema,
} from "../mappers/livetv";
import type {
  LiveTvConfig,
  ListingProviderConfig,
  TunerHostConfig,
} from "../types/config/livetv";
import type {
  LiveTvOptionsSchema,
  ListingsProviderInfoSchema,
  TunerHostInfoSchema,
} from "../types/schema/livetv";

export interface ListChange<T> {
  label: string;
  /** Absent for an entry that does not exist yet. */
  current: T | undefined;
  next: T;
  /** Listing providers only: plain text to send when the stored hash differs. */
  password?: string;
}

export interface LiveTvDiff {
  options?: { current: LiveTvOptionsSchema; next: LiveTvOptionsSchema };
  hosts: Array<ListChange<TunerHostInfoSchema>>;
  hostsToDelete: TunerHostInfoSchema[];
  providers: Array<ListChange<ListingsProviderInfoSchema>>;
  providersToDelete: ListingsProviderInfoSchema[];
}

const hostKey: (host: TunerHostInfoSchema) => string = (
  host: TunerHostInfoSchema,
): string => `${host.Type ?? ""}|${host.Url ?? ""}`;

// NOTE: a provider's identity is its type plus whichever of path, username and lineup it has; xmltv uses the path, Schedules Direct the other two.
const providerKey: (provider: ListingsProviderInfoSchema) => string = (
  provider: ListingsProviderInfoSchema,
): string =>
  [provider.Type, provider.Path, provider.Username, provider.ListingsId]
    .map((part: string | null | undefined) => part ?? "")
    .join("|");

/** The server keeps a lowercase SHA-1 hex of a listings password, never the plain text. */
function passwordMatches(
  stored: string | null | undefined,
  plain: string,
): boolean {
  const hashed: string = createHash("sha1").update(plain).digest("hex");
  return stored === hashed || stored === plain;
}

interface Wanted<T> {
  item: T;
  /** Listing providers only. */
  password?: string;
}

function reconcile<T extends object>(
  kind: string,
  currentList: T[],
  desiredList: Array<Wanted<T>>,
  key: (item: T) => string,
  authoritative: boolean,
): { changes: Array<ListChange<T>>; stale: T[] } {
  const seen: Set<string> = new Set();
  const changes: Array<ListChange<T>> = [];
  for (const { item, password } of desiredList) {
    const id: string = key(item);
    if (seen.has(id)) throw new Error(`livetv: duplicate ${kind} ${id}`);
    seen.add(id);
    const existing: T | undefined = currentList.find(
      (entry: T) => key(entry) === id,
    );
    const next: T = existing ? (overlay(existing, item) as T) : item;
    const passwordChanged: boolean =
      password !== undefined &&
      !passwordMatches(
        (existing as { Password?: string } | undefined)?.Password,
        password,
      );
    if (!existing || passwordChanged || !deepEqual(existing, next)) {
      changes.push({
        label: `livetv ${kind} ${id}`,
        current: existing,
        next,
        password: passwordChanged ? password : undefined,
      });
    }
  }
  const stale: T[] = authoritative
    ? currentList.filter((entry: T) => !seen.has(key(entry)))
    : [];
  return { changes, stale };
}

export function calculateLiveTvDiff(
  current: LiveTvOptionsSchema,
  desired: LiveTvConfig,
): LiveTvDiff | undefined {
  const authoritative: boolean = desired.authoritative ?? false;

  const nextOptions: LiveTvOptionsSchema = overlay(
    current,
    mapLiveTvOptionsConfigToSchema(desired),
  ) as LiveTvOptionsSchema;

  const hosts: ReturnType<typeof reconcile<TunerHostInfoSchema>> = reconcile(
    "tuner host",
    current.TunerHosts ?? [],
    (desired.tunerHosts ?? []).map((host: TunerHostConfig) => ({
      item: mapTunerHostConfigToSchema(host),
    })),
    hostKey,
    authoritative && desired.tunerHosts !== undefined,
  );

  const providers: ReturnType<typeof reconcile<ListingsProviderInfoSchema>> =
    reconcile(
      "listings provider",
      current.ListingProviders ?? [],
      (desired.listingProviders ?? []).map(
        (provider: ListingProviderConfig) => ({
          item: mapListingProviderConfigToSchema(provider),
          password: provider.password,
        }),
      ),
      providerKey,
      authoritative && desired.listingProviders !== undefined,
    );

  const diff: LiveTvDiff = {
    hosts: hosts.changes,
    hostsToDelete: hosts.stale,
    providers: providers.changes,
    providersToDelete: providers.stale,
  };
  if (!deepEqual(current, nextOptions)) {
    diff.options = { current, next: nextOptions };
  }

  return diff.options ||
    diff.hosts.length ||
    diff.hostsToDelete.length ||
    diff.providers.length ||
    diff.providersToDelete.length
    ? diff
    : undefined;
}

export async function applyLiveTv(
  client: JellyfinClient,
  diff: LiveTvDiff | undefined,
): Promise<void> {
  if (!diff) return;
  // NOTE: the options post replaces the lists wholesale, so it goes first and the per-entry calls re-read the server's lists.
  if (diff.options) await client.updateLiveTvOptions(diff.options.next);
  for (const host of diff.hostsToDelete) {
    if (host.Id) await client.deleteTunerHost(host.Id);
  }
  for (const change of diff.hosts) await client.saveTunerHost(change.next);
  for (const provider of diff.providersToDelete) {
    if (provider.Id) await client.deleteListingProvider(provider.Id);
  }
  for (const change of diff.providers) {
    await client.saveListingProvider(change.next, change.password);
  }
}
