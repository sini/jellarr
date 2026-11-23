import { logger } from "../lib/logger";
import type { JellyfinClient } from "../api/jellyfin.types";
import type { AuthoritativeConfig } from "../types/config/authoritative";
import type { UserDtoSchema } from "../types/schema/users";
import type { VirtualFolderInfoSchema } from "../types/schema/library";
import type { AuthenticationInfoSchema } from "../types/schema/api-keys";
import type { PluginInfoSchema } from "../types/schema/plugins";

export type DeletionKind = "users" | "libraries" | "plugins" | "apiKeys";

export interface Deletion {
  kind: DeletionKind;
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
}

export interface Declared {
  users: string[];
  libraries: string[];
  plugins: string[];
  apiKeys: string[];
  /** Users whose policy.isAdministrator the config sets, by lowercase name. */
  adminOverrides: Map<string, boolean>;
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
): void {
  if (allow || doomed * 2 <= total) return;
  throw new Error(
    `authoritative.${kind} would delete ${doomed.toString()} of ${total.toString()} ${kind}, more than half. A typo or an empty list in the config could do this; check the config, or set authoritative.allowMassDelete: true to proceed. Nothing was deleted.`,
  );
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
): Deletion[] {
  if (!authoritative) return [];
  const keep: NonNullable<AuthoritativeConfig["keep"]> =
    authoritative.keep ?? {};
  const allow: boolean = authoritative.allowMassDelete ?? false;
  const deletions: Deletion[] = [];

  if (authoritative.users) {
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
