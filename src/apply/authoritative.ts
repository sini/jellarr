import { logger } from "../lib/logger";
import type { JellyfinClient } from "../api/jellyfin.types";
import type { AuthoritativeConfig } from "../types/config/authoritative";
import type {
  UserDtoSchema,
  UserPolicySchema,
  DisplayPreferencesDtoSchema,
} from "../types/schema/users";
import { parseDuration, TICKS_PER_SECOND } from "../mappers/scheduled-tasks";
import type { VirtualFolderInfoSchema } from "../types/schema/library";
import type { AuthenticationInfoSchema } from "../types/schema/api-keys";
import type { PluginInfoSchema } from "../types/schema/plugins";

export type DeletionKind = "users" | "libraries" | "plugins" | "apiKeys";

/** The CustomPrefs key under which jellarr records when it disabled a user. */
export const DISABLED_AT_KEY: string = "jellarr.disabledAt";

/**
 * A planned change. With no `action` it is a deletion; the user actions are
 * "disable" and "enable" (policy write plus marker) and "mark" (marker only).
 */
export interface Deletion {
  kind: DeletionKind;
  action?: "disable" | "enable" | "mark";
  /** The user's policy with IsDisabled already set; for disable and enable. */
  policy?: UserPolicySchema;
  /** Marker to write (ISO-8601 UTC), or null to remove it; for user actions. */
  marker?: string | null;
  name: string;
  /** User id, plugin id, or the API key's access token (never printed). */
  id: string;
  version?: string;
  /** The dry-run plan line, naming what the deletion costs. */
  plan: string;
}

export interface AuthoritativeState {
  users: UserDtoSchema[];
  folders: VirtualFolderInfoSchema[];
  apiKeys: AuthenticationInfoSchema[];
  plugins: PluginInfoSchema[];
  /** jellarr's disabledAt markers by user id (disable mode only). */
  markers?: Map<string, string>;
}

export interface Declared {
  users: string[];
  libraries: string[];
  plugins: string[];
  apiKeys: string[];
  /** Users whose policy.isAdministrator the config sets, by lowercase name. */
  adminOverrides: Map<string, boolean>;
  /** Users whose policy.isDisabled the config sets to true, by name; never re-enabled. */
  disabled?: string[];
}

export interface Protected {
  /** User names jellarr is signed in as or authenticated through. */
  users: string[];
  /** The access token jellarr authenticates with. */
  apiKeyToken: string | undefined;
}

const GONE: ReadonlySet<string | undefined> = new Set([
  "Deleted",
  "Superseded",
  "Superceded",
]);

const lower: (name: string | null | undefined) => string = (
  name: string | null | undefined,
): string => (name ?? "").toLowerCase();

function guardMassDelete(
  kind: DeletionKind,
  doomed: number,
  total: number,
  allow: boolean,
  verb: string = "delete",
): void {
  if (allow || doomed * 2 <= total) return;
  throw new Error(
    `authoritative.${kind} would ${verb} ${doomed.toString()} of ${total.toString()} ${kind}, more than half. A typo or an empty list in the config could do this; check the config, or set authoritative.allowMassDelete: true to proceed. Nothing was changed.`,
  );
}

const isDisabled: (user: UserDtoSchema) => boolean = (
  user: UserDtoSchema,
): boolean => user.Policy?.IsDisabled === true;

/** Disable mode: disable, re-enable, mark and age-delete users; same rails as deletion. */
function planUserSync(
  authoritative: AuthoritativeConfig,
  state: AuthoritativeState,
  declared: Declared,
  spared: Protected,
  keep: NonNullable<AuthoritativeConfig["keep"]>,
  clock: () => Date,
): Deletion[] {
  const now: Date = clock();
  const sparedNames: Set<string> = new Set(
    [...declared.users, ...(keep.users ?? []), ...spared.users].map(lower),
  );
  const markers: Map<string, string> =
    state.markers ?? new Map<string, string>();
  const nowIso: string = now.toISOString();
  const graceMs: number | undefined = authoritative.deleteDisabledAfter
    ? (parseDuration(authoritative.deleteDisabledAfter) ?? 0) /
      (TICKS_PER_SECOND / 1000)
    : undefined;
  const never: (from: Date) => string = (from: Date): string =>
    graceMs === undefined
      ? "never deleted"
      : `deletion after ${new Date(from.getTime() + graceMs).toISOString()}`;
  const out: Deletion[] = [];
  const shrinking: Set<string | undefined> = new Set();
  let removals: number = 0;

  for (const user of state.users) {
    if (!user.Id) continue;
    const name: string = user.Name ?? "?";
    const base: Pick<Deletion, "kind" | "name" | "id"> = {
      kind: "users",
      name,
      id: user.Id,
    };
    const stamp: string | undefined = markers.get(user.Id);
    const since: Date | undefined = stamp ? new Date(stamp) : undefined;
    const known: Date | undefined =
      since && !Number.isNaN(since.getTime()) ? since : undefined;
    if (sparedNames.has(lower(user.Name))) {
      // NOTE: only a jellarr marker licenses re-enabling; an administrator's own disable wins.
      if (
        stamp === undefined ||
        (declared.disabled ?? []).map(lower).includes(lower(user.Name))
      ) {
        continue;
      }
      const enable: boolean = isDisabled(user);
      out.push({
        ...base,
        action: enable ? "enable" : "mark",
        ...(enable
          ? {
              policy: { ...user.Policy, IsDisabled: false } as UserPolicySchema,
            }
          : {}),
        marker: null,
        plan: enable
          ? `would re-enable user ${name} (kept again)`
          : `would clear jellarr's stale disabled marker on user ${name}`,
      });
    } else if (!isDisabled(user)) {
      shrinking.add(user.Id);
      removals++;
      out.push({
        ...base,
        action: "disable",
        policy: { ...user.Policy, IsDisabled: true } as UserPolicySchema,
        marker: nowIso,
        plan: `would disable user ${name} (not declared or kept); ${never(now)}`,
      });
    } else if (!known) {
      if (stamp !== undefined) {
        logger.warn(
          `user ${name}: unreadable ${DISABLED_AT_KEY} marker "${stamp}"; rewriting it with the current time`,
        );
      }
      out.push({
        ...base,
        action: "mark",
        marker: nowIso,
        plan: `would record user ${name} (already disabled) as first seen now; ${never(now)}`,
      });
    } else if (
      graceMs !== undefined &&
      // NOTE: inclusive; a marker exactly deleteDisabledAfter old is due.
      now.getTime() - known.getTime() >= graceMs
    ) {
      shrinking.add(user.Id);
      removals++;
      out.push({
        ...base,
        plan: `DESTRUCTIVE would delete user ${name} (disabled by jellarr since ${known.toISOString()}), and its watch history is lost`,
      });
    }
  }

  if (removals > 0) {
    const adminsLeft: number = state.users.filter(
      (user: UserDtoSchema) =>
        !shrinking.has(user.Id) &&
        !isDisabled(user) &&
        (declared.adminOverrides.get(lower(user.Name)) ??
          user.Policy?.IsAdministrator ??
          false),
    ).length;
    if (adminsLeft === 0) {
      throw new Error(
        "authoritative.users would disable or delete the last enabled administrator; declare an administrator (users[].policy.isAdministrator) or list one under authoritative.keep.users. Nothing was changed.",
      );
    }
  }
  guardMassDelete(
    "users",
    removals,
    state.users.length,
    authoritative.allowMassDelete ?? false,
    "disable or delete",
  );
  return out;
}

/**
 * Works out every deletion before any is made, so a refused rail leaves the
 * server untouched. Every rail is enforced here.
 */
export function planDeletions(
  authoritative: AuthoritativeConfig | undefined,
  state: AuthoritativeState,
  declared: Declared,
  spared: Protected,
  clock: () => Date = (): Date => new Date(),
): Deletion[] {
  if (!authoritative) return [];
  const keep: NonNullable<AuthoritativeConfig["keep"]> =
    authoritative.keep ?? {};
  const allow: boolean = authoritative.allowMassDelete ?? false;
  const deletions: Deletion[] = [];

  if (authoritative.users === "disable") {
    deletions.push(
      ...planUserSync(authoritative, state, declared, spared, keep, clock),
    );
  } else if (authoritative.users) {
    const sparedNames: Set<string> = new Set(
      [...declared.users, ...(keep.users ?? []), ...spared.users].map(lower),
    );
    const doomed: UserDtoSchema[] = state.users.filter(
      (user: UserDtoSchema) => user.Id && !sparedNames.has(lower(user.Name)),
    );
    const doomedIds: Set<string | undefined> = new Set(
      doomed.map((user: UserDtoSchema) => user.Id),
    );
    if (doomed.length > 0) {
      const adminsLeft: number = state.users.filter(
        (user: UserDtoSchema) =>
          !doomedIds.has(user.Id) &&
          (declared.adminOverrides.get(lower(user.Name)) ??
            user.Policy?.IsAdministrator ??
            false),
      ).length;
      if (adminsLeft === 0) {
        throw new Error(
          "authoritative.users would delete the last administrator; declare an administrator (users[].policy.isAdministrator) or list one under authoritative.keep.users. Nothing was deleted.",
        );
      }
    }
    guardMassDelete("users", doomed.length, state.users.length, allow);
    for (const user of doomed) {
      deletions.push({
        kind: "users",
        name: user.Name ?? "?",
        id: user.Id ?? "",
        plan: `DESTRUCTIVE user ${user.Name ?? "?"}: would be deleted, and its watch history is lost`,
      });
    }
  }

  if (authoritative.libraries) {
    const sparedNames: Set<string> = new Set([
      ...declared.libraries,
      ...(keep.libraries ?? []),
    ]);
    const doomed: VirtualFolderInfoSchema[] = state.folders.filter(
      (folder: VirtualFolderInfoSchema) =>
        folder.Name && !sparedNames.has(folder.Name),
    );
    guardMassDelete("libraries", doomed.length, state.folders.length, allow);
    for (const folder of doomed) {
      deletions.push({
        kind: "libraries",
        name: folder.Name ?? "?",
        id: folder.Name ?? "",
        plan: `DESTRUCTIVE library ${folder.Name ?? "?"}: would be deleted, and its items and their watch state leave the database; files on disk stay`,
      });
    }
  }

  if (authoritative.apiKeys) {
    const sparedNames: Set<string> = new Set([
      ...declared.apiKeys,
      ...(keep.apiKeys ?? []),
    ]);
    const doomed: AuthenticationInfoSchema[] = state.apiKeys.filter(
      (key: AuthenticationInfoSchema) =>
        key.AccessToken &&
        key.AccessToken !== spared.apiKeyToken &&
        !sparedNames.has(key.AppName ?? ""),
    );
    guardMassDelete("apiKeys", doomed.length, state.apiKeys.length, allow);
    for (const key of doomed) {
      deletions.push({
        kind: "apiKeys",
        name: key.AppName ?? "?",
        id: key.AccessToken ?? "",
        plan: `DESTRUCTIVE api key ${key.AppName ?? "?"}: would be revoked`,
      });
    }
  }

  if (authoritative.plugins) {
    const sparedNames: Set<string> = new Set([
      ...declared.plugins,
      ...(keep.plugins ?? []),
    ]);
    // NOTE: only plugins the server reports as uninstallable count; bundled ones never do.
    const removable: PluginInfoSchema[] = state.plugins.filter(
      (plugin: PluginInfoSchema) =>
        plugin.CanUninstall === true && !GONE.has(plugin.Status),
    );
    const doomed: PluginInfoSchema[] = removable.filter(
      (plugin: PluginInfoSchema) =>
        plugin.Id && plugin.Version && !sparedNames.has(plugin.Name ?? ""),
    );
    guardMassDelete("plugins", doomed.length, removable.length, allow);
    for (const plugin of doomed) {
      deletions.push({
        kind: "plugins",
        name: plugin.Name ?? "?",
        id: plugin.Id ?? "",
        version: plugin.Version ?? "",
        plan: `DESTRUCTIVE plugin ${plugin.Name ?? "?"} ${plugin.Version ?? ""}: would be uninstalled, and Jellyfin restarts to unload it`,
      });
    }
  }

  return deletions;
}

/** Runs the planned deletions in their order: users, libraries, API keys, plugins. */
export async function applyDeletions(
  client: JellyfinClient,
  deletions: Deletion[],
): Promise<void> {
  for (const deletion of deletions) {
    if (deletion.action) {
      logger.info(`User ${deletion.action}: ${deletion.name}`);
      if (deletion.policy) {
        await client.updateUserPolicy(deletion.id, deletion.policy);
      }
      await writeMarker(client, deletion.id, deletion.marker ?? null);
      continue;
    }
    logger.info(`Deleting ${deletion.kind} entry: ${deletion.name}`);
    switch (deletion.kind) {
      case "users":
        await client.deleteUser(deletion.id);
        break;
      case "libraries":
        await client.deleteVirtualFolder(deletion.id);
        break;
      case "apiKeys":
        await client.deleteApiKey(deletion.id);
        break;
      case "plugins":
        await client.uninstallPlugin(deletion.id, deletion.version ?? "");
        break;
    }
  }
}

async function writeMarker(
  client: JellyfinClient,
  userId: string,
  marker: string | null,
): Promise<void> {
  const prefs: DisplayPreferencesDtoSchema =
    await client.getDisplayPreferences(userId);
  const rest: Record<string, string | null> = Object.fromEntries(
    Object.entries(prefs.CustomPrefs ?? {}).filter(
      ([key]: [string, string | null]) => key !== DISABLED_AT_KEY,
    ),
  );
  const custom: Record<string, string | null> =
    marker === null ? rest : { ...rest, [DISABLED_AT_KEY]: marker };
  await client.updateDisplayPreferences(userId, {
    ...prefs,
    CustomPrefs: custom,
  });
}
