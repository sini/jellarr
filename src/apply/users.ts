import type { JellyfinClient, PasswordCheck } from "../api/jellyfin.types";
import { say } from "../lib/mode";
import { logger } from "../lib/logger";
import type {
  UserConfig,
  UserConfigList,
  UserPolicyConfig,
} from "../types/config/users";
import type {
  UserDtoSchema,
  UserPolicySchema,
  UserConfigurationSchema,
} from "../types/schema/users";
import {
  mapUserConfigToCreateSchema,
  mapUserPolicyConfigToSchema,
  mapUserConfigToConfiguration,
  getPassword,
} from "../mappers/users";
import type { VirtualFolderInfoSchema } from "../types/schema/library";
import { carryServerFields, withoutUnsupported } from "../lib/objects";
import { deepEqual } from "fast-equals";

const POLICY_LIBRARY_KEYS: ReadonlyArray<keyof UserPolicyConfig> = [
  "enabledLibraries",
  "enableContentDeletionFromLibraries",
  "blockedMediaLibraries",
];

function buildFolderNameToIdMap(
  virtualFolders: VirtualFolderInfoSchema[] | undefined,
): Map<string, string> {
  const folderNameToIdMap: Map<string, string> = new Map();

  for (const folder of virtualFolders ?? []) {
    const name: string | undefined = folder.Name ?? undefined;
    const id: string | undefined =
      (folder as { Id?: string }).Id ??
      (folder as { ItemId?: string | null }).ItemId ??
      undefined;

    if (!name || !id) continue;
    if (!folderNameToIdMap.has(name)) {
      folderNameToIdMap.set(name, id);
    }
  }

  return folderNameToIdMap;
}

export function calculateNewUsersDiff(
  current: UserDtoSchema[],
  desired: UserConfigList,
): UserConfig[] | undefined {
  if (desired.length === 0) return undefined;

  const out: UserConfig[] = desired.filter(
    (desiredUser: UserConfig) =>
      !current.find((user: UserDtoSchema) => user.Name === desiredUser.name),
  );

  return out.length === 0 ? undefined : out;
}

export async function createNewUsers(
  client: JellyfinClient,
  users: UserConfig[] | undefined,
): Promise<void> {
  if (!users) return;

  for (const userConfig of users) {
    await client.createUser(mapUserConfigToCreateSchema(userConfig));
  }
}

export function calculateUserPolicyDiff(
  current: UserPolicySchema,
  desired: UserPolicyConfig,
  folderNameToIdMap?: Map<string, string>,
): UserPolicySchema | undefined {
  // NOTE: Jellyfin omits a null field, so a declared null over an absent key is already in place.
  const mapped: Partial<UserPolicySchema> = Object.fromEntries(
    Object.entries(
      withoutUnsupported(
        "UserPolicy",
        mapUserPolicyConfigToSchema(desired, folderNameToIdMap),
        "users.policy",
      ),
    ).filter(
      ([key, value]: [string, unknown]) =>
        !(value === null && (current as Record<string, unknown>)[key] == null),
    ),
  ) as Partial<UserPolicySchema>;

  const next: UserPolicySchema = {
    ...current,
    ...mapped,
    ...(mapped.AccessSchedules
      ? {
          AccessSchedules: carryServerFields(
            mapped.AccessSchedules,
            current.AccessSchedules ?? undefined,
            (schedule: {
              DayOfWeek?: string;
              StartHour?: number;
              EndHour?: number;
            }) =>
              JSON.stringify([
                schedule.DayOfWeek,
                schedule.StartHour,
                schedule.EndHour,
              ]),
          ),
        }
      : {}),
  };

  return deepEqual(next, current) ? undefined : next;
}

export function calculateUserPoliciesDiff(
  current: UserDtoSchema[],
  desired: UserConfigList,
  virtualFolders?: VirtualFolderInfoSchema[],
): Map<string, UserPolicySchema> | undefined {
  if (desired.length === 0) return undefined;

  const userPoliciesToUpdate: Map<string, UserPolicySchema> = new Map();
  const enabledLibraryNames: string[] = desired.flatMap(
    (userConfig: UserConfig): string[] =>
      POLICY_LIBRARY_KEYS.flatMap(
        (key: keyof UserPolicyConfig): string[] =>
          (userConfig.policy?.[key] as string[] | undefined) ?? [],
      ),
  );

  const hasEnabledFoldersDefined: boolean = desired.some(
    (userConfig: UserConfig) =>
      POLICY_LIBRARY_KEYS.some(
        (key: keyof UserPolicyConfig) =>
          typeof userConfig.policy?.[key] !== "undefined",
      ),
  );

  const folderNameToIdMap: Map<string, string> | undefined =
    hasEnabledFoldersDefined && virtualFolders
      ? buildFolderNameToIdMap(virtualFolders)
      : hasEnabledFoldersDefined
        ? new Map()
        : undefined;

  if (
    enabledLibraryNames.length > 0 &&
    (folderNameToIdMap?.size === 0 || !folderNameToIdMap)
  ) {
    throw new Error(
      "policy library names provided but no libraries were found to resolve names",
    );
  }

  desired.forEach((userConfig: UserConfig) => {
    const currentUserDtoSchema: UserDtoSchema | undefined = current.find(
      (curr: UserDtoSchema) => curr.Name === userConfig.name,
    );

    const hasPolicyUpdates: boolean =
      typeof userConfig.policy !== "undefined" ||
      typeof userConfig.maxActiveSessions !== "undefined";

    if (currentUserDtoSchema?.Id && hasPolicyUpdates) {
      const currentPolicy: UserPolicySchema =
        (currentUserDtoSchema.Policy as UserPolicySchema | undefined) ??
        ({} as UserPolicySchema);
      const desiredPolicy: UserPolicyConfig = {
        ...(userConfig.policy ?? {}),
        ...(typeof userConfig.maxActiveSessions !== "undefined"
          ? { maxActiveSessions: userConfig.maxActiveSessions }
          : {}),
      };

      const userPolicyDiff: UserPolicySchema | undefined =
        calculateUserPolicyDiff(
          currentPolicy,
          desiredPolicy,
          folderNameToIdMap,
        );

      if (userPolicyDiff) {
        logger.info(
          say(
            `Updating user policy: ${userConfig.name}`,
            `Would update user policy: ${userConfig.name}`,
          ),
        );
        userPoliciesToUpdate.set(currentUserDtoSchema.Id, userPolicyDiff);
      }
    }
  });

  return userPoliciesToUpdate.size > 0 ? userPoliciesToUpdate : undefined;
}

export function calculateUserConfigurationsDiff(
  current: UserDtoSchema[],
  desired: UserConfigList,
  virtualFolders?: VirtualFolderInfoSchema[],
): Map<string, UserConfigurationSchema> | undefined {
  if (desired.length === 0) return undefined;

  const userConfigsToUpdate: Map<string, UserConfigurationSchema> = new Map();
  const folderNameToIdMap: Map<string, string> =
    buildFolderNameToIdMap(virtualFolders);

  desired.forEach((userConfig: UserConfig) => {
    const currentUserDtoSchema: UserDtoSchema | undefined = current.find(
      (curr: UserDtoSchema) => curr.Name === userConfig.name,
    );

    if (currentUserDtoSchema?.Id) {
      const currentConfig: UserConfigurationSchema =
        (currentUserDtoSchema.Configuration as
          UserConfigurationSchema | undefined) ?? {};
      const desiredConfig: Partial<UserConfigurationSchema> =
        withoutUnsupported(
          "UserConfiguration",
          mapUserConfigToConfiguration(userConfig, folderNameToIdMap),
          "users.configuration",
        );

      const next: UserConfigurationSchema = {
        ...currentConfig,
        ...desiredConfig,
      };

      if (!deepEqual(next, currentConfig)) {
        userConfigsToUpdate.set(currentUserDtoSchema.Id, next);
      }
    }
  });

  return userConfigsToUpdate.size > 0 ? userConfigsToUpdate : undefined;
}

export async function applyUserPolicies(
  client: JellyfinClient,
  policies: Map<string, UserPolicySchema> | undefined,
): Promise<void> {
  if (!policies) return;

  for (const [userId, policy] of policies) {
    await client.updateUserPolicy(userId, policy);
  }
}

export async function applyUserConfigurations(
  client: JellyfinClient,
  configurations: Map<string, UserConfigurationSchema> | undefined,
): Promise<void> {
  if (!configurations) return;

  for (const [userId, configuration] of configurations) {
    await client.updateUserConfiguration(userId, configuration);
  }
}

/**
 * Whether one failed sign-in is safe for this user. Jellyfin counts a failed
 * AuthenticateByName and disables the account once the count reaches its
 * LoginAttemptsBeforeLockout policy, so a probe is only made while the count
 * after a failure would stay below the limit. Jellyfin 10.11 reports a stored
 * null as -1 (never locks) and maps a written 0 to 3 (UserManager.cs:457, 638,
 * 816-820); a reported 0 is therefore read as 3.
 */
export function isProbeSafe(
  policy: UserPolicySchema | null | undefined,
): boolean {
  const reported: number = policy?.LoginAttemptsBeforeLockout ?? -1;
  const limit: number = reported === 0 ? 3 : reported;
  if (limit < 0) return true;
  return (policy?.InvalidLoginAttemptCount ?? 0) + 1 < limit;
}

/** The per-user `reconcilePassword` wins over the top-level `reconcilePasswords`; both default to off. */
export function wantsPasswordReconcile(
  user: UserConfig,
  reconcilePasswords: boolean | undefined,
): boolean {
  return user.reconcilePassword ?? reconcilePasswords ?? false;
}

/**
 * Sets the password of existing users whose current password differs from
 * the configured one. Setting a password revokes the user's other tokens, so
 * it is only done after a probe sign-in (own device id, signed out again)
 * fails; a user too close to lockout to probe is left unchanged. Only users
 * for which `wantsPasswordReconcile` holds are looked at.
 */
export async function reconcileUserPasswords(
  client: JellyfinClient,
  current: UserDtoSchema[],
  desired: UserConfigList,
  skip: ReadonlySet<string>,
  reconcilePasswords: boolean | undefined,
): Promise<void> {
  for (const userConfig of desired) {
    if (skip.has(userConfig.name)) continue;
    if (!wantsPasswordReconcile(userConfig, reconcilePasswords)) continue;
    const user: UserDtoSchema | undefined = current.find(
      (candidate: UserDtoSchema) => candidate.Name === userConfig.name,
    );
    if (!user?.Id) continue;
    const password: string = getPassword(userConfig);

    if (isProbeSafe(user.Policy)) {
      const check: PasswordCheck = await client.checkUserPassword(
        userConfig.name,
        password,
      );
      if (check === "valid") continue;
      if (check === "unverifiable") {
        logger.warn(
          `Cannot verify the password of user ${userConfig.name} (sign-in forbidden); leaving it unchanged`,
        );
        continue;
      }
    } else {
      logger.warn(
        `Cannot verify the password of user ${userConfig.name} without lockout risk; left unchanged`,
      );
      continue;
    }

    logger.info(`Setting password: ${userConfig.name}`);
    await client.updateUserPassword(user.Id, password);
  }
}
