/**
 * Every Jellyfin configuration field or endpoint jellarr deliberately does not
 * cover, with the reason. A new field in generated/schema.d.ts fails
 * tests/coverage/config-coverage.spec.ts until it is covered or listed here.
 * Keys are "<Dto>.<Field>" for fields and "<METHOD> <path>" for endpoints.
 */
export const FIELD_EXCLUSIONS: Record<string, string> = {
  "ServerConfiguration.PreviousVersion": "server-managed: written at startup",
  "ServerConfiguration.PreviousVersionStr":
    "server-managed: written at startup",
  "LiveTvOptions.MediaLocationsCreated": "server-managed: bookkeeping flag",
  "LibraryOptions.EnableInternetProviders":
    "deprecated: superseded by per-type fetcher lists",
  "UserPolicy.InvalidLoginAttemptCount": "server-managed: runtime counter",
  "TunerHostInfo.Id": "server-assigned: matched by url, never declared",
  "ListingsProviderInfo.Id": "server-assigned: matched by content",
  "AccessSchedule.UserId": "server-managed: set from the owning user",
  "DatabaseConfigurationOptions.DatabaseType":
    "dangerous: a wrong value stops the server; belongs to the host",
  "DatabaseConfigurationOptions.CustomProviderOptions":
    "dangerous: a wrong value stops the server; belongs to the host",
  "DatabaseConfigurationOptions.LockingBehavior":
    "dangerous: a wrong value stops the server; belongs to the host",
};

/** Fields not yet covered; each entry is deleted by the commit that covers it. */
export const PENDING_FIELDS: Record<string, string> = {
  "UserPolicy.AuthenticationProviderId": "pending: item 6",
  "UserPolicy.PasswordResetProviderId": "pending: item 6",
  "TypeOptions.ImageOptions": "pending: item 7",
  "ImageOption.Type": "pending: item 7",
  "ImageOption.Limit": "pending: item 7",
  "ImageOption.MinWidth": "pending: item 7",
  "DeviceOptionsDto.Id": "pending: item 8",
  "DeviceOptionsDto.DeviceId": "pending: item 8",
  "DeviceOptionsDto.CustomName": "pending: item 8",
};

export const ENDPOINT_EXCLUSIONS: Record<string, string> = {
  "POST /UserImage": "content: user avatars are images, not configuration",
  "DELETE /UserImage": "content: user avatars are images, not configuration",
  "POST /Library/VirtualFolders/Paths/Update":
    "covered through add and remove of media paths",
  "POST /LiveTv/ChannelMappings":
    "covered through listingProviders[].channelMappings",
  "POST /Repositories":
    "covered through system.pluginRepositories (ServerConfiguration)",
  "DELETE /Plugins/{pluginId}": "equivalent to the by-version uninstall",
  "POST /System/Configuration/{key}":
    "covered per named key (encoding, network, metadata, livetv, xbmcmetadata); database is excluded",
};

export const PENDING_ENDPOINTS: Record<string, string> = {
  "POST /Devices/Options": "pending: item 8",
  "POST /Library/VirtualFolders/Name": "pending: item 4",
  "POST /Users": "pending: item 5",
};
