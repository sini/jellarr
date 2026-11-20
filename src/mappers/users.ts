import { readFileSync } from "fs";
import { addSecret } from "../lib/logger";
import { type UserConfig, type UserPolicyConfig } from "../types/config/users";
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

export function mapUserPolicyConfigToSchema(
  desired: UserPolicyConfig,
  folderNameToIdMap?: Map<string, string>,
): Partial<UserPolicySchema> {
  const out: Partial<UserPolicySchema> = {};

  if (typeof desired.allowedTags !== "undefined") {
    out.AllowedTags = desired.allowedTags;
  }

  if (typeof desired.blockedTags !== "undefined") {
    out.BlockedTags = desired.blockedTags;
  }

  if (typeof desired.isAdministrator !== "undefined") {
    out.IsAdministrator = desired.isAdministrator;
  }

  if (typeof desired.loginAttemptsBeforeLockout !== "undefined") {
    out.LoginAttemptsBeforeLockout = desired.loginAttemptsBeforeLockout;
  }

  if (typeof desired.maxActiveSessions !== "undefined") {
    out.MaxActiveSessions = desired.maxActiveSessions;
  }

  if (typeof desired.remoteClientBitrateLimit !== "undefined") {
    out.RemoteClientBitrateLimit = desired.remoteClientBitrateLimit;
  }

  if (typeof desired.enableAllFolders !== "undefined") {
    out.EnableAllFolders = desired.enableAllFolders;
  }

  if (typeof desired.enableCollectionManagement !== "undefined") {
    out.EnableCollectionManagement = desired.enableCollectionManagement;
  }

  if (typeof desired.enableContentDownloading !== "undefined") {
    out.EnableContentDownloading = desired.enableContentDownloading;
  }

  if (
    typeof desired.enabledLibraries !== "undefined" &&
    desired.enabledLibraries.length > 0
  ) {
    if (typeof desired.enableAllFolders === "undefined") {
      out.EnableAllFolders = false;
    }

    if (!folderNameToIdMap) {
      throw new Error(
        "policy.enabledLibraries requires available libraries to resolve names",
      );
    }

    out.EnabledFolders = desired.enabledLibraries.map(
      (folderName: string): string => {
        const id: string | undefined = folderNameToIdMap.get(folderName);
        if (!id) {
          throw new Error(
            `Library '${folderName}' not found while resolving enabledLibraries`,
          );
        }
        return id;
      },
    );
  }

  return out;
}

export function mapUserConfigToConfiguration(
  desired: UserConfig,
  folderNameToIdMap?: Map<string, string>,
): Partial<UserConfigurationSchema> {
  const out: Partial<UserConfigurationSchema> = {};

  if (typeof desired.orderedLibraries !== "undefined") {
    out.OrderedViews = desired.orderedLibraries.map((name: string): string => {
      const id: string | undefined = folderNameToIdMap?.get(name);
      if (!id) {
        throw new Error(
          `Library '${name}' not found while resolving orderedLibraries`,
        );
      }

      return id;
    });
  }

  if (typeof desired.audioLanguagePreference !== "undefined") {
    out.AudioLanguagePreference = desired.audioLanguagePreference;
  }

  if (typeof desired.playDefaultAudioTrack !== "undefined") {
    out.PlayDefaultAudioTrack = desired.playDefaultAudioTrack;
  }

  if (typeof desired.displayMissingEpisodes !== "undefined") {
    out.DisplayMissingEpisodes = desired.displayMissingEpisodes;
  }

  if (typeof desired.subtitleLanguagePreference !== "undefined") {
    out.SubtitleLanguagePreference = desired.subtitleLanguagePreference;
  }

  if (typeof desired.subtitleMode !== "undefined") {
    out.SubtitleMode = desired.subtitleMode;
  }

  return out;
}
