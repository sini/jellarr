import { readFileSync } from "fs";
import { addSecret } from "../lib/logger";
import { withoutUndefined } from "../lib/objects";
import {
  type AccessScheduleConfig,
  type UserConfig,
  type UserPolicyConfig,
} from "../types/config/users";
import {
  type CreateUserByNameSchema,
  type UserPolicySchema,
  type UserConfigurationSchema,
} from "../types/schema/users";

export function getPlaintextPassword(config: UserConfig): string | undefined {
  return config.password;
}

export function getPasswordFromFile(config: UserConfig): string | undefined {
  if (config.passwordFile === undefined) return undefined;
  const contents: string = readFileSync(config.passwordFile, "utf8").trim();
  addSecret(contents);
  return contents;
}

export function getPassword(config: UserConfig): string {
  const password: string =
    getPlaintextPassword(config) ?? getPasswordFromFile(config) ?? "";
  if (password.trim() === "") {
    throw new Error(
      `Password for user ${config.name} is empty${config.passwordFile === undefined ? "" : ` (passwordFile ${config.passwordFile} has no content)`}`,
    );
  }
  return password;
}

export function mapUserConfigToCreateSchema(
  desired: UserConfig,
): CreateUserByNameSchema {
  return {
    Name: desired.name,
    Password: getPassword(desired),
  };
}

export const POLICY_FIELDS: ReadonlyArray<[string, string]> = [
  ["isAdministrator", "IsAdministrator"],
  ["isHidden", "IsHidden"],
  ["isDisabled", "IsDisabled"],
  ["loginAttemptsBeforeLockout", "LoginAttemptsBeforeLockout"],
  ["maxActiveSessions", "MaxActiveSessions"],
  ["remoteClientBitrateLimit", "RemoteClientBitrateLimit"],
  ["maxParentalRating", "MaxParentalRating"],
  ["maxParentalSubRating", "MaxParentalSubRating"],
  ["enableAllFolders", "EnableAllFolders"],
  ["enableCollectionManagement", "EnableCollectionManagement"],
  ["enableSubtitleManagement", "EnableSubtitleManagement"],
  ["enableLyricManagement", "EnableLyricManagement"],
  ["enableContentDownloading", "EnableContentDownloading"],
  ["enableContentDeletion", "EnableContentDeletion"],
  ["enableUserPreferenceAccess", "EnableUserPreferenceAccess"],
  ["enableRemoteControlOfOtherUsers", "EnableRemoteControlOfOtherUsers"],
  ["enableSharedDeviceControl", "EnableSharedDeviceControl"],
  ["enableRemoteAccess", "EnableRemoteAccess"],
  ["enableLiveTvManagement", "EnableLiveTvManagement"],
  ["enableLiveTvAccess", "EnableLiveTvAccess"],
  ["enableMediaPlayback", "EnableMediaPlayback"],
  ["enableAudioPlaybackTranscoding", "EnableAudioPlaybackTranscoding"],
  ["enableVideoPlaybackTranscoding", "EnableVideoPlaybackTranscoding"],
  ["enablePlaybackRemuxing", "EnablePlaybackRemuxing"],
  ["forceRemoteSourceTranscoding", "ForceRemoteSourceTranscoding"],
  ["enableSyncTranscoding", "EnableSyncTranscoding"],
  ["enableMediaConversion", "EnableMediaConversion"],
  ["enableAllDevices", "EnableAllDevices"],
  ["enableAllChannels", "EnableAllChannels"],
  ["enablePublicSharing", "EnablePublicSharing"],
  ["syncPlayAccess", "SyncPlayAccess"],
  ["enabledDevices", "EnabledDevices"],
  ["enabledChannels", "EnabledChannels"],
  ["blockedChannels", "BlockedChannels"],
  ["allowedTags", "AllowedTags"],
  ["blockedTags", "BlockedTags"],
  ["blockUnratedItems", "BlockUnratedItems"],
  ["accessSchedules", "AccessSchedules"],
];

export const USER_CONFIGURATION_FIELDS: ReadonlyArray<[string, string]> = [
  ["displayMissingEpisodes", "DisplayMissingEpisodes"],
  ["displayCollectionsView", "DisplayCollectionsView"],
  ["enableLocalPassword", "EnableLocalPassword"],
  ["hidePlayedInLatest", "HidePlayedInLatest"],
  ["rememberAudioSelections", "RememberAudioSelections"],
  ["rememberSubtitleSelections", "RememberSubtitleSelections"],
  ["enableNextEpisodeAutoPlay", "EnableNextEpisodeAutoPlay"],
  ["subtitleLanguagePreference", "SubtitleLanguagePreference"],
  ["subtitleMode", "SubtitleMode"],
  ["audioLanguagePreference", "AudioLanguagePreference"],
  ["playDefaultAudioTrack", "PlayDefaultAudioTrack"],
  ["castReceiverId", "CastReceiverId"],
];

export const POLICY_LIBRARY_FIELDS: ReadonlyArray<[string, string]> = [
  ["enabledLibraries", "EnabledFolders"],
  ["enableContentDeletionFromLibraries", "EnableContentDeletionFromFolders"],
  ["blockedMediaLibraries", "BlockedMediaFolders"],
];

export const CONFIGURATION_LIBRARY_FIELDS: ReadonlyArray<[string, string]> = [
  ["orderedLibraries", "OrderedViews"],
  ["groupedLibraries", "GroupedFolders"],
  ["latestItemsExcludedLibraries", "LatestItemsExcludes"],
  ["myMediaExcludedLibraries", "MyMediaExcludes"],
];

export function mapAccessSchedules(
  schedules: AccessScheduleConfig[],
): NonNullable<UserPolicySchema["AccessSchedules"]> {
  return schedules.map((schedule: AccessScheduleConfig) => ({
    DayOfWeek: schedule.dayOfWeek,
    StartHour: schedule.startHour,
    EndHour: schedule.endHour,
  }));
}

function resolveLibraries(
  field: string,
  names: string[],
  folderNameToIdMap: Map<string, string> | undefined,
  scope: string = "",
): string[] {
  if (names.length === 0) return [];
  if (!folderNameToIdMap) {
    throw new Error(
      `${scope}${field} requires available libraries to resolve names`,
    );
  }
  return names.map((name: string): string => {
    const id: string | undefined = folderNameToIdMap.get(name);
    if (!id) {
      throw new Error(`Library '${name}' not found while resolving ${field}`);
    }
    return id;
  });
}

function mapFields(
  desired: object,
  fields: ReadonlyArray<[string, string]>,
  convert?: (config: string, value: unknown) => unknown,
): Record<string, unknown> {
  const source: Record<string, unknown> = desired as Record<string, unknown>;
  return withoutUndefined(
    Object.fromEntries(
      fields.map(([config, schema]: [string, string]) => [
        schema,
        source[config] === undefined
          ? undefined
          : (convert?.(config, source[config]) ?? source[config]),
      ]),
    ),
  );
}

export function mapUserPolicyConfigToSchema(
  desired: UserPolicyConfig,
  folderNameToIdMap?: Map<string, string>,
): Partial<UserPolicySchema> {
  const out: Partial<UserPolicySchema> = {
    ...mapFields(desired, POLICY_FIELDS),
    ...mapFields(
      desired,
      POLICY_LIBRARY_FIELDS,
      (field: string, value: unknown) =>
        resolveLibraries(
          field,
          value as string[],
          folderNameToIdMap,
          "policy.",
        ),
    ),
  };

  if (desired.accessSchedules !== undefined) {
    out.AccessSchedules = mapAccessSchedules(desired.accessSchedules);
  }

  if (
    desired.enabledLibraries !== undefined &&
    desired.enabledLibraries.length > 0 &&
    desired.enableAllFolders === undefined
  ) {
    out.EnableAllFolders = false;
  }

  return out;
}

export function mapUserConfigToConfiguration(
  desired: UserConfig,
  folderNameToIdMap?: Map<string, string>,
): Partial<UserConfigurationSchema> {
  return {
    ...mapFields(desired, USER_CONFIGURATION_FIELDS),
    ...mapFields(
      desired,
      CONFIGURATION_LIBRARY_FIELDS,
      (field: string, value: unknown) =>
        resolveLibraries(field, value as string[], folderNameToIdMap),
    ),
  };
}

/**
 * The inverse of the field tables: server-shaped values to config keys, with
 * nulls dropped so an unset server field stays out of a dumped config.
 */
export function dumpFields(
  source: object | null | undefined,
  fields: ReadonlyArray<[string, string]>,
  convert: (value: never) => unknown = (value: never): unknown => value,
): Record<string, unknown> {
  const server: Record<string, unknown> = (source ?? {}) as Record<
    string,
    unknown
  >;
  return withoutUndefined(
    Object.fromEntries(
      fields.map(([config, schema]: [string, string]) => [
        config,
        server[schema] === null || server[schema] === undefined
          ? undefined
          : convert(server[schema] as never),
      ]),
    ),
  );
}
