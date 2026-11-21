# Migrating from declarative-jellyfin

This guide is for NixOS users moving from
[declarative-jellyfin](https://github.com/Sveske-Juice/declarative-jellyfin)
(`services.declarative-jellyfin`) to jellarr (`services.jellarr`). The option
mapping was derived from the declarative-jellyfin source at commit
`a8f81812af6bc9017e6d85820a2fd60038c05589` and from jellarr's module under
`nix/module/`. The two are not drop-in compatible: option names, shapes and some
semantics differ.

## The model difference

declarative-jellyfin runs a wrapper in place of Jellyfin's `ExecStart`. On each
service start it writes Jellyfin's XML configuration files (`system.xml`,
`network.xml`, `encoding.xml`, `branding.xml`, `livetv.xml`), the per-library
`options.xml` and `.mblink` files, and rows in the SQLite database
(`jellyfin.db`: users, permissions, API keys). It does this with Jellyfin
stopped, then starts Jellyfin.

jellarr never touches those files. It waits for the running server to report
healthy and then reads and writes through Jellyfin's REST API, using an API key
(or an admin sign-in). For a migration this means:

- The data directory, database, users, libraries and settings you already have
  are kept. Nothing is recreated from scratch.
- jellarr compares what you declare with what the server reports and changes
  only the difference. Anything you do not declare keeps its current value.
- Settings that declarative-jellyfin wrote stay in the XML files and database
  after you remove it. Nothing rewrites them on the next start, so an option you
  leave out of jellarr keeps the value declarative-jellyfin last wrote.
- jellarr runs as its own `oneshot` unit after `jellyfin.service`, at boot, on
  config change, and on a timer (`services.jellarr.schedule`, default `daily`).
  It does not wrap or replace Jellyfin's `ExecStart`.

## Option mapping

Paths on the right are relative to `services.jellarr.config`. jellarr option
names follow the Jellyfin API names in camelCase. Every jellarr option is
optional unless noted; an unset option is left alone on the server.

Status values: same (same name and shape), renamed, different shape, no
equivalent.

### Service wrapper options

| declarative-jellyfin                                          | jellarr                                                                              | Status          | Note                                                                                                                                                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enable`                                                      | `services.jellarr.enable`, plus `services.jellyfin.enable`                           | different shape | Keep `services.jellyfin.enable = true`; declarative-jellyfin forced it on.                                                                                                             |
| `user`, `group`, `dataDir`, `configDir`, `cacheDir`, `logDir` | `services.jellyfin.user`, `.group`, `.dataDir`, `.configDir`, `.cacheDir`, `.logDir` | renamed         | declarative-jellyfin passed these through to `services.jellyfin`. Set them there directly, with the same values.                                                                       |
| `openFirewall`                                                | `services.jellyfin.openFirewall`                                                     | renamed         | declarative-jellyfin opened `network.publicHttpPort` and `publicHttpsPort`. The nixpkgs option opens its own fixed ports.                                                              |
| `package`, `jellyfin-ffmpeg`, `jellyfin-web`                  | `services.jellyfin.package` (and the nixpkgs ffmpeg/web overrides)                   | no equivalent   | declarative-jellyfin built a patched Jellyfin (it applies `remove-size-check.patch`). After removal you run stock `pkgs.jellyfin` unless you set `services.jellyfin.package` yourself. |
| `backups`, `backupDir`, `backupCount`                         | none                                                                                 | no equivalent   | jellarr makes no backups. Take your own before migrating (see below).                                                                                                                  |
| `serverId`                                                    | none                                                                                 | no equivalent   | declarative-jellyfin wrote `data/device.txt`. The file stays in the data directory, so the server id is unchanged.                                                                     |

### `system`

jellarr: `system.*`.

| declarative-jellyfin                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | jellarr                                                                                                        | Status                                | Note                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `serverName`, `preferredMetadataLanguage`, `metadataCountryCode`, `cachePath`, `metadataPath`, `logFileRetentionDays`, `isStartupWizardCompleted`, `enableMetrics`, `enableNormalizedItemByNameIds`, `isPortAuthorized`, `quickConnectAvailable`, `enableCaseSensitiveItemIds`, `disableLiveTvChannelUserDataName`, `sortReplaceCharacters`, `sortRemoveCharacters`, `sortRemoveWords`, `minResumePct`, `maxResumePct`, `minAudiobookResume`, `maxAudiobookResume`, `minResumeDurationSeconds`, `libraryMonitorDelay`, `libraryUpdateDuration`, `imageSavingConvention`, `skipDeserializationForBasicTypes`, `saveMetadataHidden`, `remoteClientBitrateLimit`, `enableFolderView`, `enableGroupingMoviesIntoCollections`, `enableGroupingShowsIntoCollections`, `displaySpecialsWithinSeasons`, `codecsUsed`, `enableExternalContentInSuggestions`, `imageExtractionTimeoutMs`, `enableSlowResponseWarning`, `slowResponseThresholdMs`, `corsHosts`, `activityLogRetentionDays`, `libraryScanFanoutConcurrency`, `libraryMetadataRefreshConcurrency`, `allowClientLogUpload`, `dummyChapterDuration`, `chapterImageResolution`, `parallelImageEncodingLimit` | `system.<same name>`                                                                                           | same                                  | Values are the Jellyfin API values. See the quirk notes below for types.                                                                                                                  |
| `inactiveSessionThreshhold`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `system.inactiveSessionThreshold`                                                                              | renamed                               | declarative-jellyfin has a typo (`Threshhold`); jellarr uses the correct spelling.                                                                                                        |
| `UICulture`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `system.uiCulture`                                                                                             | renamed                               | Capitalisation.                                                                                                                                                                           |
| `pluginRepositories`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `system.pluginRepositories`                                                                                    | different shape                       | declarative-jellyfin takes `[ { tag = "RepositoryInfo"; content = { Name; Url; Enabled; }; } ]`. jellarr takes `[ { name; url; enabled; } ]`. A declared list replaces the server's list. |
| `trickplayOptions.*` (`enableHwAcceleration`, `enableHwEncoding`, `processThreads`, `enableKeyFrameOnlyExtraction`, `scanBehavior`, `processPriority`, `interval`, `widthResolutions`, `tileWidth`, `tileHeight`, `qscale`, `jpegQuality`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `system.trickplayOptions.*`                                                                                    | same                                  |                                                                                                                                                                                           |
| `metadataOptions`, `contentTypes`, `pathSubstitutions`, `castReceiverApplications`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `system.metadataOptions`, `system.contentTypes`, `system.pathSubstitutions`, `system.castReceiverApplications` | same                                  | A declared list replaces the server's list and `[]` clears it. Fields the server adds to an entry are kept, so an entry can't unset a field by leaving it out.                            |
| `removeOldPlugins`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | none                                                                                                           | no equivalent                         | See "What jellarr cannot do".                                                                                                                                                             |
| none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `system.cacheSize`, `system.enableLegacyAuthorization`                                                         | no equivalent in declarative-jellyfin | jellarr-only options.                                                                                                                                                                     |

Quirk: declarative-jellyfin declares `enableExternalContentInSuggestions` as a
`bool` with the default `"Legacy"`, which is not a boolean. Check what the
server actually holds (`jellarr dump`) before you declare it.

### `network`

jellarr: `networking.*` (note the rename of the group).

| declarative-jellyfin                                                                                                                                                                                                                                                                                                                                                                                                                                                  | jellarr                     | Status  | Note                                      |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------- | ----------------------------------------- |
| `baseUrl`, `enableHttps`, `requireHttps`, `certificatePath`, `certificatePassword`, `internalHttpPort`, `internalHttpsPort`, `publicHttpPort`, `publicHttpsPort`, `autoDiscovery`, `enableUPnP`, `enableIPv4`, `enableIPv6`, `enableRemoteAccess`, `localNetworkSubnets`, `localNetworkAddresses`, `knownProxies`, `ignoreVirtualInterfaces`, `virtualInterfaceNames`, `enablePublishedServerUriByRequest`, `publishedServerUriBySubnet`, `isRemoteIPFilterBlacklist` | `networking.<same name>`    | same    | The group is `networking`, not `network`. |
| `remoteIpFilter`                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `networking.remoteIPFilter` | renamed | Capitalisation.                           |

### `encoding`

jellarr: `encoding.*`.

| declarative-jellyfin                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | jellarr                                                                                          | Status                                | Note                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------- | ------------------------------------ |
| `enableHardwareEncoding`, `allowHevcEncoding`, `allowAv1Encoding`, `encodingThreadCount`, `transcodingTempPath`, `enableFallbackFont`, `enableAudioVbr`, `downMixAudioBoost`, `downMixStereoAlgorithm`, `maxMuxingQueueSize`, `enableThrottling`, `throttleDelaySeconds`, `enableSegmentDeletion`, `segmentKeepSeconds`, `hardwareAccelerationType`, `encoderAppPathDisplay`, `vaapiDevice`, `qsvDevice`, `enableTonemapping`, `tonemappingAlgorithm`, `tonemappingMode`, `tonemappingRange`, `tonemappingDesat`, `tonemappingPeak`, `enableVppTonemapping`, `vppTonemappingBrightness`, `vppTonemappingContrast`, `encoderPreset`, `deinterlaceDoubleRate`, `deinterlaceMethod`, `enableDecodingColorDepth10Hevc`, `enableDecodingColorDepth10Vp9`, `enableDecodingColorDepth10HevcRext`, `enableDecodingColorDepth12HevcRext`, `hardwareDecodingCodecs`, `enableIntelLowPowerH264HwEncoder`, `enableIntelLowPowerHevcHwEncoder`, `enableEnhancedNvdecDecoder`, `preferSystemNativeHwDecoder`, `enableSubtitleExtraction`, `allowOnDemandMetadataBasedKeyframeExtractionForExtensions` | `encoding.<same name>`                                                                           | same                                  |                                      |
| `h254Crf`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `encoding.h264Crf`                                                                               | renamed                               | declarative-jellyfin typo (`h254`).  |
| `h256Crf`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `encoding.h265Crf`                                                                               | renamed                               | declarative-jellyfin typo (`h256`).  |
| `tonemapingParam`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `encoding.tonemappingParam`                                                                      | renamed                               | declarative-jellyfin typo (one `p`). |
| none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `encoding.enableVideoToolboxTonemapping`, `encoding.encoderAppPath`, `encoding.fallbackFontPath` | no equivalent in declarative-jellyfin | jellarr-only options.                |

### `branding`

jellarr: `branding.*`.

| declarative-jellyfin   | jellarr                        | Status          | Note                                                                                                                                                                                                                                                                                                      |
| ---------------------- | ------------------------------ | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `loginDisclaimer`      | `branding.loginDisclaimer`     | same            |                                                                                                                                                                                                                                                                                                           |
| `customCss`            | `branding.customCss`           | same            |                                                                                                                                                                                                                                                                                                           |
| `splashscreenEnabled`  | `branding.splashscreenEnabled` | same            |                                                                                                                                                                                                                                                                                                           |
| `splashscreenLocation` | `branding.splashscreenFile`    | different shape | A plain path to the image (not `{ _file }`). jellarr uploads it only when its bytes differ from the server's, and only with `splashscreenEnabled = true`; with the splashscreen disabled the run fails, because the server can't return the image to compare. jellarr can't remove a custom splashscreen. |

### `libraries`

declarative-jellyfin: an attribute set keyed by library name. jellarr:
`library.virtualFolders`, a list.

| declarative-jellyfin                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | jellarr                                                                                                                 | Status                                | Note                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| attribute name (`libraries.Movies`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `library.virtualFolders.*.name`                                                                                         | different shape                       | The name is now a field. Libraries are matched by name.                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `contentType`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `library.virtualFolders.*.collectionType`                                                                               | renamed                               | Same values, plus `"mixed"` in jellarr. Changing the type of an existing library is an error in jellarr.                                                                                                                                                                                                                                                                                                                                                                                                              |
| `pathInfos` (list of strings)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `library.virtualFolders.*.libraryOptions.pathInfos`                                                                     | different shape                       | List of `{ path = "..."; }`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `typeOptions` (attribute set keyed by item type)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `library.virtualFolders.*.libraryOptions.typeOptions`                                                                   | different shape                       | List of `{ type; metadataFetchers; imageFetchers; metadataFetcherOrder?; imageFetcherOrder?; }`. declarative-jellyfin filled defaults per `contentType`, used each attribute name verbatim as the `Type`, and set `metadataFetcherOrder`/`imageFetcherOrder` to the fetcher lists. jellarr only sends what you declare: use Jellyfin's item type names (`Movie`, `Series`, `Season`, `Episode`, `MusicAlbum`, …), and declare the two order lists yourself to keep the same ordering. See "Quirks the dry run shows". |
| `enabled`, `enablePhotos`, `enableRealtimeMonitor`, `enableLUFSScan`, `enableChapterImageExtraction`, `extractChapterImagesDuringLibraryScan`, `enableTrickplayImageExtraction`, `extractTrickplayImagesDuringLibraryScan`, `saveTrickplayWithMedia`, `saveLyricsWithMedia`, `saveLocalMetadata`, `enableAutomaticSeriesGrouping`, `enableEmbeddedTitles`, `enableEmbeddedExtraTitles`, `enableEmbeddedEpisodeInfos`, `automaticRefreshIntervalDays`, `seasonZeroDisplayName`, `preferredMetadataLanguage`, `metadataCountryCode`, `metadataSavers`, `disabledLocalMetadataReaders`, `localMetadataReaderOrder`, `disabledSubtitleFetchers`, `subtitleFetcherOrder`, `disabledMediaSegmentProviders`, `skipSubtitlesIfEmbeddedSubtitlesPresent`, `skipSubtitlesIfAudioTrackMatches`, `subtitleDownloadLanguages`, `requirePerfectSubtitleMatch`, `saveSubtitlesWithMedia`, `disabledLyricFetchers`, `lyricFetcherOrder`, `customTagDelimiters`, `delimiterWhitelist`, `automaticallyAddToCollection`, `allowEmbeddedSubtitles` | `library.virtualFolders.*.libraryOptions.<same name>`                                                                   | same                                  | Nested under `libraryOptions`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `mediaSegmentProvideOrder`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `library.virtualFolders.*.libraryOptions.mediaSegmentProviderOrder`                                                     | renamed                               | declarative-jellyfin typo (`Provide`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `libraryOptions.preferNonstandardArtistsTag`, `libraryOptions.useCustomTagDelimiters`, `virtualFolders.*.ignoreChanges` | no equivalent in declarative-jellyfin | jellarr-only. `ignoreChanges` lists library options jellarr must not manage.                                                                                                                                                                                                                                                                                                                                                                                                                                          |

### `users`

declarative-jellyfin: an attribute set keyed by user name. jellarr: `users`, a
list.

| declarative-jellyfin                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | jellarr                                                                                | Status                                | Note                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| attribute name (`users.admin`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `users.*.name`                                                                         | different shape                       | The name is now a field. Users are matched by name.                                                                                                                                                           |
| `password`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `users.*.password`                                                                     | same                                  | Plaintext in the Nix store. Prefer `passwordFile`.                                                                                                                                                            |
| `hashedPassword`, `hashedPasswordFile`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `users.*.passwordFile`                                                                 | different shape                       | A PBKDF2 hash cannot be used. See "Passwords".                                                                                                                                                                |
| `permissions.isAdministrator`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `users.*.policy.isAdministrator`                                                       | renamed                               | `permissions` is `policy`.                                                                                                                                                                                    |
| `permissions.enableAllFolders`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `users.*.policy.enableAllFolders`                                                      | renamed                               |                                                                                                                                                                                                               |
| `permissions.enableCollectionManagement`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `users.*.policy.enableCollectionManagement`                                            | renamed                               |                                                                                                                                                                                                               |
| `permissions.enableContentDownloading`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `users.*.policy.enableContentDownloading`                                              | renamed                               |                                                                                                                                                                                                               |
| `preferences.enabledLibraries`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `users.*.policy.enabledLibraries`                                                      | renamed                               | Library names. A non-empty list also sets `enableAllFolders = false` unless you declare `enableAllFolders` yourself. An empty list does nothing in jellarr (declarative-jellyfin read it as "all libraries"). |
| `loginAttemptsBeforeLockout`, `maxActiveSessions`, `remoteClientBitrateLimit`                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `users.*.policy.<same name>`                                                           | different shape                       | Top-level in declarative-jellyfin, under `policy` in jellarr. `loginAttemptsBeforeLockout` must be at least 1 in jellarr.                                                                                     |
| `displayMissingEpisodes`, `audioLanguagePreference`, `subtitleLanguagePreference`, `playDefaultAudioTrack`                                                                                                                                                                                                                                                                                                                                                                                                                      | `users.*.<same name>`                                                                  | same                                  |                                                                                                                                                                                                               |
| `subtitleMode`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `users.*.subtitleMode`                                                                 | different shape                       | declarative-jellyfin uses `"default"`, `"always"`, `"onlyForced"`, `"none"`, `"smart"`; jellarr uses `"Default"`, `"Always"`, `"OnlyForced"`, `"None"`, `"Smart"`.                                            |
| none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `users.*.policy.allowedTags`, `users.*.policy.blockedTags`, `users.*.orderedLibraries` | no equivalent in declarative-jellyfin | jellarr-only.                                                                                                                                                                                                 |
| `permissions.isHidden`, `isDisabled`, `enableSharedDeviceControl`, `enableRemoteAccess`, `enableLiveTvManagement`, `enableLiveTvAccess`, `enableMediaPlayback`, `enableAudioPlaybackTranscoding`, `enableVideoPlaybackTranscoding`, `enableContentDeletion`, `enableSyncTranscoding`, `enableMediaConversion`, `enableAllDevices`, `enableAllChannels`, `enablePublicSharing`, `enableRemoteControlOfOtherUsers`, `enablePlaybackRemuxing`, `forceRemoteSourceTranscoding`, `enableSubtitleManagement`, `enableLyricManagement` | `users.*.policy.<same name>`                                                           | same                                  | Every settable `UserPolicy` field is available, including `accessSchedules` and the library-valued lists, which take library names.                                                                           |
| `maxParentalAgeRating`, `maxParentalRatingSubScore`                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `users.*.policy.maxParentalRating`, `users.*.policy.maxParentalSubRating`              | renamed                               | Once set, these can't be cleared through jellarr: leaving them out means unmanaged.                                                                                                                           |
| `displayCollectionsView`, `enableNextEpisodeAutoPlay`, `hidePlayedInLatest`, `rememberAudioSelections`, `rememberSubtitleSelections`, `enableLocalPassword`, `enableUserPreferenceAccess`, `syncPlayAccess`                                                                                                                                                                                                                                                                                                                     | `users.*.policy.*` or `users.*.configuration.*`, same name                             | same                                  | Check `nix/module/types/users.nix` for which group each field is in.                                                                                                                                          |
| `enableAutoLogin`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | none                                                                                   | no equivalent                         | Jellyfin only reports it on the read-only user object; the API has no way to set it.                                                                                                                          |
| `mutable`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | none                                                                                   | no equivalent                         | jellarr always converges the fields you declare, like `mutable = false`. To stop managing a field, remove it from the config.                                                                                 |
| `id`, `internalId`, `normalizedUsername`, `authenticationProviderId`, `passwordResetProviderId`, `castReceiverId`, `invalidLoginAttemptCount`, `mustUpdatePassword`, `rowVersion`, `lastActivityDate`, `lastLoginDate`                                                                                                                                                                                                                                                                                                          | none                                                                                   | no equivalent                         | Database internals that declarative-jellyfin wrote. jellarr uses the API and does not need them.                                                                                                              |

### `plugins`

| declarative-jellyfin                                             | jellarr                                                   | Status          | Note                                                                                                                                                                             |
| ---------------------------------------------------------------- | --------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plugins` (list of `{ name; url; version; sha256; targetAbi; }`) | `plugins` (list of `{ name; version?; configuration?; }`) | different shape | See "Plugins". At the commit read, the `plugins` option is declared but nothing in the module reads it; only the `plugins` and `plugins/configurations` directories are created. |

### `apikeys`

| declarative-jellyfin                           | jellarr                               | Status          | Note                                                                                                                                             |
| ---------------------------------------------- | ------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apikeys.<name>.key`, `apikeys.<name>.keyPath` | `api_keys = [ { name = "<name>"; } ]` | different shape | declarative-jellyfin writes the key value you give it. jellarr only creates a key by name and the server generates the token. See "The API key". |

### `livetv`

| declarative-jellyfin                                                    | jellarr                                                    | Status          | Note                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------- | ---------------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `livetv.*` (tuner hosts, listing providers, recording paths, and so on) | `livetv.*`, `livetv.tunerHosts`, `livetv.listingProviders` | different shape | Tuner hosts are matched by type and url, listings providers by type, path, username and listings id. By default jellarr only adds and updates; `livetv.authoritative = true` also deletes entries it doesn't declare. A listings password is compared against the hash the server stores. |

### jellarr-only groups

`metadata.useFileCreationTimeForDateAdded` and `startup.*` (the first-boot
wizard) have no declarative-jellyfin counterpart. `startup` only acts on a
server whose wizard has not been completed, so it does nothing on a migrated
server.

## Decisions you make once

### Passwords

declarative-jellyfin takes a pre-hashed PBKDF2-SHA512 password (`hashedPassword`
or `hashedPasswordFile`) and writes the hash into the database. Jellyfin's API
only accepts plaintext, so jellarr cannot use the hash. Each user you declare
needs a plaintext `password` or `passwordFile` (exactly one of the two). Prefer
`passwordFile`, and make the file readable by the user jellarr runs as
(`services.jellarr.user`, default `jellarr`).

What jellarr does for a user that already exists on the server
(`src/apply/users.ts`, `reconcileUserPasswords`):

1. It checks whether one failed sign-in is safe. It reads the user's
   `LoginAttemptsBeforeLockout` and `InvalidLoginAttemptCount` and only probes
   while the count after one more failure stays below the limit. A stored
   unlimited limit is always safe; a reported `0` is read as `3`.
2. If it is not safe, it logs a warning and leaves the password unchanged.
3. If it is safe, it signs in as that user with the file's password, using its
   own device id (`jellarr-password-check`), and signs that session out again.
   - Accepted: the password already matches. Nothing is changed and no other
     session is affected.
   - Rejected (401): it sets the password to the file's value with
     `POST /Users/Password`.
   - Forbidden (403): it cannot verify the user (sign-in is not allowed for
     them), warns, and leaves the password unchanged.

So the cost is one failed sign-in per user whose password differs, which counts
toward that user's lockout limit, plus one reset. Setting a password makes
Jellyfin revoke that user's other sessions, so the user is signed out of their
other devices once. If you put the same plaintext in the file that the hash was
made from, the probe succeeds and nothing happens.

Users that jellarr creates (not on the server yet) get the password at creation
and are not probed. The admin jellarr itself signed in as, when it has to fall
back to a sign-in, is also skipped. A dry run never probes; it reports
`password not verified (dry run)` for each declared existing user.

### The API key

jellarr authenticates with `JELLARR_API_KEY` or `JELLARR_API_KEY_FILE`. Pick
one:

- **Reuse a key declarative-jellyfin already created.** If you have
  `apikeys.<name>.keyPath = "/run/secrets/x"`, set
  `services.jellarr.apiKeyFile = "/run/secrets/x"`. The key is already in the
  database and jellarr never deletes keys, so this needs no further step and no
  Jellyfin restart. This is the simplest path and also lets you dry-run before
  you switch.
- **`services.jellarr.bootstrap.enable = true`** with `bootstrap.apiKeyFile`
  (defaults to `services.jellarr.apiKeyFile`). A unit
  `jellarr-api-key-bootstrap` runs before jellarr, as root, on the Jellyfin
  host. If the key named `bootstrap.apiKeyName` (default `jellarr`) is missing
  or has a different value, it stops Jellyfin, writes the key into
  `jellyfin.db`, and starts Jellyfin again. It refuses to write unless the
  `ApiKeys` table has the expected 10.11 columns. If the key is already there
  with the same value it does nothing.
- **A key you provision yourself**, for example created in the dashboard, set as
  `services.jellarr.apiKeyFile`.
- **No key.** jellarr signs in by name as the first declared user whose
  `policy.isAdministrator` is `true` (or `startup.user`), using that user's
  password, and logs a warning. Each failed sign-in counts toward the admin's
  lockout limit.

Other applications' keys (`apikeys.<name>` in declarative-jellyfin) stay in the
database and keep working. jellarr's `api_keys` can only create a key by name if
no key with that name exists; the token is generated by Jellyfin, so you cannot
use it to restore a key with a known value. Leave other applications' keys alone
and do not list them under `api_keys`.

### Plugins

At the declarative-jellyfin commit read, the `plugins` option is not consumed by
the module, so plugins on your server were installed some other way (the
dashboard or by hand). jellarr installs plugins through Jellyfin's plugin
catalog:

- `name` is the catalog name, exactly as listed, case-sensitive. The plugin's
  repository must be in `system.pluginRepositories`.
- Installed copies are matched to the catalog entry by GUID, so a plugin whose
  installed name differs from its catalog name is still found. A plugin that is
  in no repository is left as it is when installed, and is an error when not.
- A plugin already installed at the version jellarr would choose is not
  reinstalled. Without `version`, jellarr keeps the plugin at the newest version
  the repositories offer for your Jellyfin version, so an update in the catalog
  is installed on the next run. Set `version` to hold it where it is. A
  `version` below the installed one is reported and not applied.
- Installing or upgrading a plugin restarts Jellyfin, because Jellyfin loads
  plugins at start. After an upgrade, older copies that Jellyfin reports as
  `Superseded` are uninstalled.
- `configuration` is merged into the plugin's current configuration: keys you
  declare are set, keys you do not declare keep their values. A list you declare
  replaces the current list. A plugin with a `configuration` that is not
  installed and loaded fails the run.

To get a plugin's current configuration as JSON to copy into `configuration`:

```sh
# list plugins and note the Id
curl -s -H "X-Emby-Token: $(cat /run/secrets/jellarr-api-key)" \
  http://localhost:8096/Plugins | jq '.[] | {Id, Name, Version, Status}'

# read the configuration
curl -s -H "X-Emby-Token: $(cat /run/secrets/jellarr-api-key)" \
  http://localhost:8096/Plugins/<Id>/Configuration | jq .
```

`jellarr dump --baseUrl http://localhost:8096` (experimental, needs the API key
in the environment) prints the whole server as jellarr YAML, including each
plugin's configuration under `plugins`. Remove the keys you do not want to
manage before you use it.

### Secrets

In `services.jellarr.config`, any string option accepts
`{ _file = "/run/secrets/name"; }` in place of a literal. jellarr reads the file
when it runs and trims surrounding whitespace. Do not use `_file` for
`passwordFile`: that option already takes a path, and `_file` would substitute
the file's contents, not its path. Use `password = { _file = "..."; }` or
`passwordFile = "/run/secrets/name"`.

`${VAR}` inside a string is replaced from jellarr's environment, which you fill
with `services.jellarr.environmentFile`. `$${` is a literal `${`. Any other `$`
is left as written. A missing file or an undefined variable fails the run.
Substituted values are strings, so `${VAR}` cannot fill an integer or boolean
option.

## What jellarr cannot do

Some declarative-jellyfin behaviour has no jellarr equivalent, because jellarr
only uses Jellyfin's HTTP API and the API doesn't offer it. These are
limitations of the approach, not missing options:

- **Pre-hashed passwords.** The API accepts only plaintext passwords, so a
  PBKDF2 hash can never be applied. You need the plaintext in a `passwordFile`.
  Putting in the plaintext the hash was made from avoids the one-time reset
  described in "Passwords".
- **API keys with a chosen value through the API.** Jellyfin generates every
  token it creates, so `api_keys` can only create a key by name. A key with a
  known value has to be written into the database directly. The NixOS module's
  `bootstrap` does that for jellarr's own key and, through
  `bootstrap.extraKeys = { <name> = <file>; }`, for any other application's key
  you want to keep. Keys that are already in the database keep working, and
  jellarr never deletes keys.
- **A dry run without an API key.** Signing in creates a session and a failed
  sign-in counts toward the user's lockout limit, so `--dry-run` never signs in.
  Reuse a key declarative-jellyfin created, or provision one, before the first
  dry run.
- **Backups.** jellarr changes the server in place and keeps no copy. Archive
  the data directory yourself (step 1 below).
- **The server id.** jellarr never writes `data/device.txt`; the file
  declarative-jellyfin wrote stays and keeps the same id.
- **Patched packages.** declarative-jellyfin's `package`, `jellyfin-ffmpeg` and
  `jellyfin-web` options built its own derivations. jellarr doesn't package
  Jellyfin; set `services.jellyfin.package` and use nixpkgs overrides.
- **`mutable`.** There is no per-user switch. jellarr always converges the
  fields you declare and never touches the ones you don't, which behaves like
  `mutable = false` for declared fields and `mutable = true` for everything
  else.
- **`removeOldPlugins`.** jellarr uninstalls only older copies of plugins you
  declare, and only once Jellyfin reports them as superseded. It never removes a
  plugin you haven't declared.

A few jellarr behaviours are worth knowing before you rely on them:

- jellarr never deletes users, libraries, undeclared plugins or API keys.
  Removing one from the config stops jellarr managing it; it stays on the
  server.
- Declared lists replace the server's lists, and `[]` clears one. That includes
  `policy.enabledLibraries = [ ]`, which removes the user's access to every
  library unless `enableAllFolders` is true.
- A user whose `accessSchedules` or other policy forbids signing in can't have
  their password checked, so jellarr leaves it unchanged with a warning until a
  sign-in is allowed.

## Quirks the dry run shows

A dry run against a server declarative-jellyfin managed usually shows a few
changes even when your config matches the old one. These are expected:

- **A library `typeOptions` entry changes its `Type`.** declarative-jellyfin
  writes the attribute name as the item type, so `typeOptions.Movies` became
  `Type: "Movies"`. Jellyfin's item type is `Movie`, so an entry like that
  probably never applied. Declaring the real type name replaces the old entry,
  because declared lists replace the server's.
- **Fetcher order lists disappear from a `typeOptions` entry.** declarative-
  jellyfin set `metadataFetcherOrder` and `imageFetcherOrder` to the fetcher
  lists. Declare them in jellarr if you want the same order.
- **Whitespace in strings.** Values are compared exactly, so a string from an
  indented Nix heredoc, such as `branding.customCss`, can differ only by its
  leading spaces. It converges to your value on the first run.
- **Settings you newly declare,** such as an empty list on the server becoming
  the list you wrote.
- **Stale or duplicate library locations.** declarative-jellyfin can leave stale
  or duplicate `.mblink` files in a library's folder, so Jellyfin scans paths
  the config no longer declares, or the same folder twice. jellarr now cleans
  these up: it unlinks locations that are not in `pathInfos` and collapses
  duplicates, and the dry run lists each one. Unlinking drops that location's
  items from the library on the next scan, so read those lines before applying.

## What the first run does to your server

Checked against `src/` on this branch:

- Users you do not declare are never touched (`src/apply/users.ts` only
  processes declared names). jellarr never deletes users.
- Libraries are matched by name and updated in place through
  `updateLibraryOptions`; they are not recreated. A declared library whose name
  does not exist is created. Changing an existing library's `collectionType` is
  an error (`src/apply/library.ts`).
- Libraries you do not declare are left alone.
- Plugins that are installed at the target version are not reinstalled. Plugins
  you do not declare are not touched or removed. Undeclared plugins are not
  upgraded either.
- Declared lists replace the server's lists (`pluginRepositories`, trickplay
  `widthResolutions`, library `pathInfos` and `typeOptions`, fetcher lists,
  `enabledLibraries`, and so on). Scalars you declare replace the server's
  value. Objects merge key by key, and options you do not declare keep the
  server's value (`overlay` in `src/lib/objects.ts`).
- Plugin settings you do not declare keep their values (`mergeDeclared` in
  `src/apply/plugins.ts`). Lists inside a plugin configuration are replaced by
  the declared list.
- Declared users that exist get a password probe (see "Passwords"), then have
  only the policy and configuration fields you declared compared and written.
- A declared API key name that already exists is not recreated.
- The data and cache directories keep the ownership and modes
  declarative-jellyfin last set. Its `ExecStartPre` ran `chown -R` and
  `chmod -R 750` over both on every start; that goes away with the switch, and
  jellarr never touches either directory.

Because lists replace, a declared `pluginRepositories` that omits a repository
you use will remove it from the server. Run the dry run first.

## Step by step

1. **Back up the data directory.** Stop Jellyfin and archive it, for example:
   `systemctl stop jellyfin && tar -C /var/lib -czf /root/jellyfin-premigration.tar.gz jellyfin && systemctl start jellyfin`.
   declarative-jellyfin's own backups (`backupDir`) are tarballs of its own
   design and not a substitute. Keep the data directory in place for the
   migration: do not delete or move it.
2. **Translate your config.** Use the mapping above. Start from `jellarr dump`
   if you have a key, and trim it to the settings you want managed. Declare only
   what you want enforced.
3. **Dry-run against the live server, before changing NixOS.** You need the
   jellarr CLI and an API key (a dry run never signs in):

   ```sh
   JELLARR_API_KEY_FILE=/run/secrets/jellarr-api-key \
     nix run github:sini/jellarr -- --dry-run --configFile ./config.yml
   ```

   `config.yml` is the YAML form of `services.jellarr.config`; the keys are the
   same (`version`, `base_url`, `system`, `networking`, `library`, `users`, and
   so on). Read the plan. The exit code is 0 when nothing would change and 2
   when changes are pending (an error exits 1). Expect existing users to show
   `password not verified (dry run)`. See "Quirks the dry run shows" for the
   changes to expect.

   If your config points at credential paths that only exist inside the jellarr
   unit, such as `passwordFile = "${CREDENTIALS_DIRECTORY}/admin"`, run the dry
   run as a transient unit with the same name and credentials, so the paths
   resolve the same way:

   ```sh
   systemd-run --unit=jellarr --wait --pipe \
     -p LoadCredential=api-key:/run/secrets/jellarr-api-key \
     -p LoadCredential=admin:/run/secrets/jellyfin-admin \
     -p Environment=JELLARR_API_KEY_FILE=%d/api-key \
     /path/to/jellarr --dry-run --configFile /etc/jellarr/config.yml
   ```

4. **Switch the NixOS config.** Remove `services.declarative-jellyfin` and the
   declarative-jellyfin module import. Keep `services.jellyfin` and set the
   options declarative-jellyfin used to forward (`user`, `group`, `dataDir`,
   `openFirewall`, and so on) directly on it. Add `services.jellarr`. Then
   `nixos-rebuild switch`. Because the wrapper is gone, Jellyfin starts with its
   stock `ExecStart`; the existing XML files and database are read as they are.
5. **Check the run.** `systemctl status jellarr` and `journalctl -u jellarr`.
   jellarr applies at switch (through `timers.jellarr-apply`) and then on its
   timer. Run `systemctl start jellarr` to apply again. The switch also restarts
   Jellyfin, because its start command changes; jellarr waits for it to finish
   starting. Before 0.3.1 that wait could end too early and the first run failed
   with a 500 from `/System/Info/Public`; if you see that on 0.3.0, run
   `systemctl start jellarr` once more.

   A major Jellyfin upgrade can run a long database migration at first start,
   during which `/health` answers 200 but every authenticated request
   answers 503. jellarr retries those until the wait timeout, so set
   `waitTimeout` (`JELLARR_WAIT_TIMEOUT`) to cover the migration.

6. **Re-run the dry run** with the same config. It should exit 0.

## Rolling back

jellarr changes the server in place, so a NixOS rollback alone does not undo
what it already applied. To return to declarative-jellyfin:

1. Stop Jellyfin and restore the archive from step 1 into the data directory
   (this reverts users, passwords, libraries and plugin versions to the
   pre-migration state).
2. `nixos-rebuild switch --rollback`, or boot the previous generation, which has
   declarative-jellyfin back.

If you only want to stop jellarr from managing the server, set
`services.jellarr.enable = false`. Settings it already applied stay as they are
on the server, and nothing rewrites them.

## Example

Before, with declarative-jellyfin:

```nix
{
  services.declarative-jellyfin = {
    enable = true;
    openFirewall = true;

    system = {
      serverName = "Home";
      preferredMetadataLanguage = "en";
      metadataCountryCode = "US";
    };

    encoding = {
      enableHardwareEncoding = true;
      hardwareAccelerationType = "vaapi";
      vaapiDevice = "/dev/dri/renderD128";
      h254Crf = 23;
    };

    network.publicHttpPort = 8096;

    branding.loginDisclaimer = "Authorised users only";

    libraries.Movies = {
      contentType = "movies";
      pathInfos = [ "/data/movies" ];
      enableRealtimeMonitor = true;
    };

    users = {
      admin = {
        hashedPasswordFile = "/run/secrets/jellyfin-admin-hash";
        permissions.isAdministrator = true;
      };
      alice = {
        hashedPasswordFile = "/run/secrets/jellyfin-alice-hash";
        mutable = false;
        permissions.enableAllFolders = false;
        preferences.enabledLibraries = [ "Movies" ];
        subtitleMode = "onlyForced";
      };
    };

    apikeys.jellarr.keyPath = "/run/secrets/jellarr-api-key";
  };
}
```

After, with jellarr:

```nix
{
  imports = [ inputs.jellarr.nixosModules.default ];

  services.jellyfin = {
    enable = true;
    openFirewall = true;
  };

  services.jellarr = {
    enable = true;
    user = "jellyfin";
    group = "jellyfin";
    # the key declarative-jellyfin already put in the database
    apiKeyFile = "/run/secrets/jellarr-api-key";

    config = {
      version = 1;
      base_url = "http://localhost:8096";

      system = {
        serverName = "Home";
        preferredMetadataLanguage = "en";
        metadataCountryCode = "US";
      };

      encoding = {
        enableHardwareEncoding = true;
        hardwareAccelerationType = "vaapi";
        vaapiDevice = "/dev/dri/renderD128";
        h264Crf = 23;
      };

      networking.publicHttpPort = 8096;

      branding.loginDisclaimer = "Authorised users only";

      library.virtualFolders = [
        {
          name = "Movies";
          collectionType = "movies";
          libraryOptions = {
            pathInfos = [ { path = "/data/movies"; } ];
            enableRealtimeMonitor = true;
          };
        }
      ];

      users = [
        {
          name = "admin";
          # plaintext, not the PBKDF2 hash
          passwordFile = "/run/secrets/jellyfin-admin";
          policy.isAdministrator = true;
        }
        {
          name = "alice";
          passwordFile = "/run/secrets/jellyfin-alice";
          policy.enabledLibraries = [ "Movies" ];
          subtitleMode = "OnlyForced";
        }
      ];
    };
  };
}
```

What changed: the wrapper options moved to `services.jellyfin`; `network` became
`networking`; `h254Crf` became `h264Crf`; the library and users became lists;
`contentType` became `collectionType`; `pathInfos` entries became `{ path }`;
`permissions` and `preferences.enabledLibraries` became `policy`; `subtitleMode`
is capitalised; the hashes became plaintext `passwordFile`s; `mutable = false`
has no counterpart because jellarr always enforces what it is given.
