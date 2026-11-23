import type { components } from "../../../generated/schema";

export type PublicSystemInfoSchema = components["schemas"]["PublicSystemInfo"];
export type StartupConfigurationDtoSchema =
  components["schemas"]["StartupConfigurationDto"];
export type StartupUserDtoSchema = components["schemas"]["StartupUserDto"];
// NOTE: Jellyfin 12 dropped EnableAutomaticPortMapping from this body; 10.11 still reads it.
export type StartupRemoteAccessDtoSchema =
  components["schemas"]["StartupRemoteAccessDto"] & {
    EnableAutomaticPortMapping?: boolean;
  };
