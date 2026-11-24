import { resolveApiKey } from "../lib/api-key";
import { createJellyfinClient } from "../api/jellyfin_client";
import type { JellyfinClient } from "../api/jellyfin.types";
import type {
  ServerConfigurationSchema,
  PluginRepositorySchema,
  MetadataOptionsSchema,
  ContentTypeSchema,
  PathSubstitutionSchema,
  CastReceiverApplicationSchema,
} from "../types/schema/system";
import type { MetadataConfigurationSchema } from "../types/schema/metadata";
import type { XbmcMetadataOptionsSchema } from "../types/schema/xbmc-metadata";
import type { EncodingOptionsSchema } from "../types/schema/encoding-options";
import type { NetworkConfigurationSchema } from "../types/schema/networking";
import type {
  VirtualFolderInfoSchema,
  MediaPathInfoSchema,
  TypeOptionsSchema,
} from "../types/schema/library";
import type { BrandingOptionsDtoSchema } from "../types/schema/branding-options";
import type { UserDtoSchema } from "../types/schema/users";
import {
  CONFIGURATION_LIBRARY_FIELDS,
  POLICY_FIELDS,
  POLICY_LIBRARY_FIELDS,
  USER_CONFIGURATION_FIELDS,
  dumpFields,
} from "../mappers/users";
import type {
  PluginInfoSchema,
  BasePluginConfigurationSchema,
} from "../types/schema/plugins";
import type { AuthenticationInfoSchema } from "../types/schema/api-keys";
import type {
  LiveTvOptionsSchema,
  ListingsProviderInfoSchema,
  TunerHostInfoSchema,
} from "../types/schema/livetv";
import type { TaskInfoSchema } from "../types/schema/scheduled-tasks";
import { dumpTaskTriggers } from "../mappers/scheduled-tasks";
import * as yaml from "yaml";
import { DEFAULT_DISPLAY_PREFERENCES_ID } from "../types/config/display-preferences";
import type { DisplayPreferencesDtoSchema } from "../types/schema/users";

function dumpDisplayPreferences(
  prefs: DisplayPreferencesDtoSchema,
): Record<string, unknown> {
  return {
    client: "emby",
    id: DEFAULT_DISPLAY_PREFERENCES_ID,
    viewType: prefs.ViewType ?? undefined,
    sortBy: prefs.SortBy ?? undefined,
    indexBy: prefs.IndexBy ?? undefined,
    rememberIndexing: prefs.RememberIndexing,
    primaryImageHeight: prefs.PrimaryImageHeight,
    primaryImageWidth: prefs.PrimaryImageWidth,
    customPrefs: prefs.CustomPrefs,
    scrollDirection: prefs.ScrollDirection,
    showBackdrop: prefs.ShowBackdrop,
    rememberSorting: prefs.RememberSorting,
    sortOrder: prefs.SortOrder,
    showSidebar: prefs.ShowSidebar,
  };
}

interface PluginWithConfig {
  name: string;
  enabled?: boolean;
  configuration?: BasePluginConfigurationSchema;
}

export async function runDump(baseUrl: string): Promise<void> {
  const apiKey: string | undefined = resolveApiKey();
  if (!apiKey) {
    throw new Error("JELLARR_API_KEY or JELLARR_API_KEY_FILE is required");
  }

  const client: JellyfinClient = createJellyfinClient(baseUrl, apiKey);

  console.error("⚠️  EXPERIMENTAL: Dumping Jellyfin configuration...\n");

  const [
    systemConfig,
    metadataConfig,
    xbmcConfig,
    encodingConfig,
    networkingConfig,
    virtualFolders,
    brandingConfig,
    users,
    plugins,
    apiKeys,
    liveTv,
    scheduledTasks,
  ]: [
    ServerConfigurationSchema,
    MetadataConfigurationSchema,
    XbmcMetadataOptionsSchema,
    EncodingOptionsSchema,
    NetworkConfigurationSchema,
    VirtualFolderInfoSchema[],
    BrandingOptionsDtoSchema,
    UserDtoSchema[],
    PluginInfoSchema[],
    AuthenticationInfoSchema[],
    LiveTvOptionsSchema,
    TaskInfoSchema[],
  ] = await Promise.all([
    client.getSystemConfiguration(),
    client.getMetadataConfiguration(),
    client.getXbmcMetadataConfiguration(),
    client.getEncodingConfiguration(),
    client.getNetworkingConfiguration(),
    client.getVirtualFolders(),
    client.getBrandingConfiguration(),
    client.getUsers(),
    client.getPlugins(),
    client.getApiKeys(),
    client.getLiveTvOptions(),
    client.getScheduledTasks(),
  ]);

  const pluginsWithConfig: PluginWithConfig[] = await Promise.all(
    plugins.map(async (plugin: PluginInfoSchema): Promise<PluginWithConfig> => {
      const base: PluginWithConfig = {
        name: plugin.Name ?? "unknown",
        ...(plugin.Status === "Disabled" ? { enabled: false } : {}),
      };
      if (!plugin.Id || plugin.Status === "Disabled") return base;
      try {
        const pluginConfig: BasePluginConfigurationSchema =
          await client.getPluginConfiguration(plugin.Id);
        return { ...base, configuration: pluginConfig };
      } catch {
        return base;
      }
    }),
  );

  const webPreferences: Map<string, DisplayPreferencesDtoSchema> = new Map();
  for (const user of users) {
    if (!user.Id) continue;
    try {
      const prefs: DisplayPreferencesDtoSchema =
        await client.getDisplayPreferences(
          user.Id,
          DEFAULT_DISPLAY_PREFERENCES_ID,
          "emby",
        );
      if (Object.keys(prefs.CustomPrefs ?? {}).length > 0) {
        webPreferences.set(user.Id, prefs);
      }
    } catch {
      continue;
    }
  }

  const folderIdToNameMap: Map<string, string> = new Map(
    virtualFolders.flatMap(
      (folder: VirtualFolderInfoSchema): Array<[string, string]> => {
        const id: string | undefined =
          (folder as { Id?: string }).Id ??
          (folder as { ItemId?: string | null }).ItemId ??
          undefined;
        return folder.Name && id ? [[id, folder.Name]] : [];
      },
    ),
  );

  const resolveLibraryNames: (
    enabledFolderIds: string[] | null | undefined,
  ) => string[] | undefined = (
    enabledFolderIds: string[] | null | undefined,
  ): string[] | undefined => {
    if (!enabledFolderIds) return undefined;
    return enabledFolderIds.map(
      (folderId: string) => folderIdToNameMap.get(folderId) ?? folderId,
    );
  };

  const config: object = {
    version: 1,
    base_url: baseUrl,

    system: {
      serverName: systemConfig.ServerName,
      enableMetrics: systemConfig.EnableMetrics,
      pluginRepositories: systemConfig.PluginRepositories?.map(
        (repo: PluginRepositorySchema) => ({
          name: repo.Name ?? "",
          url: repo.Url ?? "",
          enabled: repo.Enabled ?? false,
        }),
      ),
      metadataOptions: systemConfig.MetadataOptions?.map(
        (o: MetadataOptionsSchema) => ({
          itemType: o.ItemType ?? "",
          disabledMetadataSavers: o.DisabledMetadataSavers ?? undefined,
          localMetadataReaderOrder: o.LocalMetadataReaderOrder ?? undefined,
          disabledMetadataFetchers: o.DisabledMetadataFetchers ?? undefined,
          metadataFetcherOrder: o.MetadataFetcherOrder ?? undefined,
          disabledImageFetchers: o.DisabledImageFetchers ?? undefined,
          imageFetcherOrder: o.ImageFetcherOrder ?? undefined,
        }),
      ),
      contentTypes: systemConfig.ContentTypes?.map((t: ContentTypeSchema) => ({
        name: t.Name ?? "",
        value: t.Value ?? "",
      })),
      pathSubstitutions: systemConfig.PathSubstitutions?.map(
        (s: PathSubstitutionSchema) => ({ from: s.From ?? "", to: s.To ?? "" }),
      ),
      castReceiverApplications: systemConfig.CastReceiverApplications?.map(
        (a: CastReceiverApplicationSchema) => ({
          id: a.Id,
          name: a.Name,
        }),
      ),
      trickplayOptions: {
        enableHwAcceleration:
          systemConfig.TrickplayOptions?.EnableHwAcceleration,
        enableHwEncoding: systemConfig.TrickplayOptions?.EnableHwEncoding,
        enableKeyFrameOnlyExtraction:
          systemConfig.TrickplayOptions?.EnableKeyFrameOnlyExtraction,
        scanBehavior: systemConfig.TrickplayOptions?.ScanBehavior,
        processPriority: systemConfig.TrickplayOptions?.ProcessPriority,
        interval: systemConfig.TrickplayOptions?.Interval,
        widthResolutions: systemConfig.TrickplayOptions?.WidthResolutions,
        tileWidth: systemConfig.TrickplayOptions?.TileWidth,
        tileHeight: systemConfig.TrickplayOptions?.TileHeight,
        qscale: systemConfig.TrickplayOptions?.Qscale,
        jpegQuality: systemConfig.TrickplayOptions?.JpegQuality,
        processThreads: systemConfig.TrickplayOptions?.ProcessThreads,
      },
      imageSavingConvention: systemConfig.ImageSavingConvention,
      chapterImageResolution: systemConfig.ChapterImageResolution,
      sortReplaceCharacters: systemConfig.SortReplaceCharacters,
      sortRemoveCharacters: systemConfig.SortRemoveCharacters,
      sortRemoveWords: systemConfig.SortRemoveWords,
      codecsUsed: systemConfig.CodecsUsed,
      corsHosts: systemConfig.CorsHosts,
      cachePath: systemConfig.CachePath,
      metadataPath: systemConfig.MetadataPath,
      preferredMetadataLanguage: systemConfig.PreferredMetadataLanguage,
      metadataCountryCode: systemConfig.MetadataCountryCode,
      uiCulture: systemConfig.UICulture,
      logFileRetentionDays: systemConfig.LogFileRetentionDays,
      minResumePct: systemConfig.MinResumePct,
      maxResumePct: systemConfig.MaxResumePct,
      minResumeDurationSeconds: systemConfig.MinResumeDurationSeconds,
      minAudiobookResume: systemConfig.MinAudiobookResume,
      maxAudiobookResume: systemConfig.MaxAudiobookResume,
      inactiveSessionThreshold: systemConfig.InactiveSessionThreshold,
      libraryMonitorDelay: systemConfig.LibraryMonitorDelay,
      libraryUpdateDuration: systemConfig.LibraryUpdateDuration,
      cacheSize: systemConfig.CacheSize,
      remoteClientBitrateLimit: systemConfig.RemoteClientBitrateLimit,
      imageExtractionTimeoutMs: systemConfig.ImageExtractionTimeoutMs,
      slowResponseThresholdMs: systemConfig.SlowResponseThresholdMs,
      activityLogRetentionDays: systemConfig.ActivityLogRetentionDays,
      libraryScanFanoutConcurrency: systemConfig.LibraryScanFanoutConcurrency,
      libraryMetadataRefreshConcurrency:
        systemConfig.LibraryMetadataRefreshConcurrency,
      dummyChapterDuration: systemConfig.DummyChapterDuration,
      parallelImageEncodingLimit: systemConfig.ParallelImageEncodingLimit,
      isStartupWizardCompleted: systemConfig.IsStartupWizardCompleted,
      enableNormalizedItemByNameIds: systemConfig.EnableNormalizedItemByNameIds,
      isPortAuthorized: systemConfig.IsPortAuthorized,
      quickConnectAvailable: systemConfig.QuickConnectAvailable,
      enableCaseSensitiveItemIds: systemConfig.EnableCaseSensitiveItemIds,
      disableLiveTvChannelUserDataName:
        systemConfig.DisableLiveTvChannelUserDataName,
      skipDeserializationForBasicTypes:
        systemConfig.SkipDeserializationForBasicTypes,
      saveMetadataHidden: systemConfig.SaveMetadataHidden,
      enableFolderView: systemConfig.EnableFolderView,
      enableGroupingMoviesIntoCollections:
        systemConfig.EnableGroupingMoviesIntoCollections,
      enableGroupingShowsIntoCollections:
        systemConfig.EnableGroupingShowsIntoCollections,
      displaySpecialsWithinSeasons: systemConfig.DisplaySpecialsWithinSeasons,
      enableExternalContentInSuggestions:
        systemConfig.EnableExternalContentInSuggestions,
      enableSlowResponseWarning: systemConfig.EnableSlowResponseWarning,
      allowClientLogUpload: systemConfig.AllowClientLogUpload,
      enableLegacyAuthorization: systemConfig.EnableLegacyAuthorization,
    },

    metadata: {
      useFileCreationTimeForDateAdded:
        metadataConfig.UseFileCreationTimeForDateAdded,
    },

    xbmcMetadata: {
      userId: xbmcConfig.UserId,
      releaseDateFormat: xbmcConfig.ReleaseDateFormat,
      saveImagePathsInNfo: xbmcConfig.SaveImagePathsInNfo,
      enablePathSubstitution: xbmcConfig.EnablePathSubstitution,
      enableExtraThumbsDuplication: xbmcConfig.EnableExtraThumbsDuplication,
    },

    encoding: {
      enableHardwareEncoding: encodingConfig.EnableHardwareEncoding,
      hardwareAccelerationType: encodingConfig.HardwareAccelerationType,
      vaapiDevice: encodingConfig.VaapiDevice,
      qsvDevice: encodingConfig.QsvDevice,
      hardwareDecodingCodecs: encodingConfig.HardwareDecodingCodecs,
      enableDecodingColorDepth10Hevc:
        encodingConfig.EnableDecodingColorDepth10Hevc,
      enableDecodingColorDepth10Vp9:
        encodingConfig.EnableDecodingColorDepth10Vp9,
      enableDecodingColorDepth10HevcRext:
        encodingConfig.EnableDecodingColorDepth10HevcRext,
      enableDecodingColorDepth12HevcRext:
        encodingConfig.EnableDecodingColorDepth12HevcRext,
      allowHevcEncoding: encodingConfig.AllowHevcEncoding,
      allowAv1Encoding: encodingConfig.AllowAv1Encoding,
      enableFallbackFont: encodingConfig.EnableFallbackFont,
      enableAudioVbr: encodingConfig.EnableAudioVbr,
      enableThrottling: encodingConfig.EnableThrottling,
      enableSegmentDeletion: encodingConfig.EnableSegmentDeletion,
      enableTonemapping: encodingConfig.EnableTonemapping,
      enableVppTonemapping: encodingConfig.EnableVppTonemapping,
      enableVideoToolboxTonemapping:
        encodingConfig.EnableVideoToolboxTonemapping,
      deinterlaceDoubleRate: encodingConfig.DeinterlaceDoubleRate,
      enableEnhancedNvdecDecoder: encodingConfig.EnableEnhancedNvdecDecoder,
      preferSystemNativeHwDecoder: encodingConfig.PreferSystemNativeHwDecoder,
      enableIntelLowPowerH264HwEncoder:
        encodingConfig.EnableIntelLowPowerH264HwEncoder,
      enableIntelLowPowerHevcHwEncoder:
        encodingConfig.EnableIntelLowPowerHevcHwEncoder,
      enableSubtitleExtraction: encodingConfig.EnableSubtitleExtraction,
      encodingThreadCount: encodingConfig.EncodingThreadCount,
      maxMuxingQueueSize: encodingConfig.MaxMuxingQueueSize,
      throttleDelaySeconds: encodingConfig.ThrottleDelaySeconds,
      segmentKeepSeconds: encodingConfig.SegmentKeepSeconds,
      h264Crf: encodingConfig.H264Crf,
      h265Crf: encodingConfig.H265Crf,
      downMixAudioBoost: encodingConfig.DownMixAudioBoost,
      tonemappingDesat: encodingConfig.TonemappingDesat,
      tonemappingPeak: encodingConfig.TonemappingPeak,
      tonemappingParam: encodingConfig.TonemappingParam,
      vppTonemappingBrightness: encodingConfig.VppTonemappingBrightness,
      vppTonemappingContrast: encodingConfig.VppTonemappingContrast,
      transcodingTempPath: encodingConfig.TranscodingTempPath,
      fallbackFontPath: encodingConfig.FallbackFontPath,
      encoderAppPath: encodingConfig.EncoderAppPath,
      encoderAppPathDisplay: encodingConfig.EncoderAppPathDisplay,
      downMixStereoAlgorithm: encodingConfig.DownMixStereoAlgorithm,
      tonemappingAlgorithm: encodingConfig.TonemappingAlgorithm,
      tonemappingMode: encodingConfig.TonemappingMode,
      tonemappingRange: encodingConfig.TonemappingRange,
      encoderPreset: encodingConfig.EncoderPreset,
      deinterlaceMethod: encodingConfig.DeinterlaceMethod,
      subtitleExtractionTimeoutMinutes:
        encodingConfig.SubtitleExtractionTimeoutMinutes,
      hlsAudioSeekStrategy: encodingConfig.HlsAudioSeekStrategy,
      allowOnDemandMetadataBasedKeyframeExtractionForExtensions:
        encodingConfig.AllowOnDemandMetadataBasedKeyframeExtractionForExtensions,
    },

    networking: {
      baseUrl: networkingConfig.BaseUrl,
      enableHttps: networkingConfig.EnableHttps,
      requireHttps: networkingConfig.RequireHttps,
      certificatePath: networkingConfig.CertificatePath,
      certificatePassword: networkingConfig.CertificatePassword,
      internalHttpPort: networkingConfig.InternalHttpPort,
      internalHttpsPort: networkingConfig.InternalHttpsPort,
      publicHttpPort: networkingConfig.PublicHttpPort,
      publicHttpsPort: networkingConfig.PublicHttpsPort,
      autoDiscovery: networkingConfig.AutoDiscovery,
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      enableUPnP: networkingConfig.EnableUPnP,
      enableIPv4: networkingConfig.EnableIPv4,
      enableIPv6: networkingConfig.EnableIPv6,
      enableRemoteAccess: networkingConfig.EnableRemoteAccess,
      localNetworkSubnets: networkingConfig.LocalNetworkSubnets,
      localNetworkAddresses: networkingConfig.LocalNetworkAddresses,
      knownProxies: networkingConfig.KnownProxies,
      ignoreVirtualInterfaces: networkingConfig.IgnoreVirtualInterfaces,
      virtualInterfaceNames: networkingConfig.VirtualInterfaceNames,
      enablePublishedServerUriByRequest:
        networkingConfig.EnablePublishedServerUriByRequest,
      publishedServerUriBySubnet: networkingConfig.PublishedServerUriBySubnet,
      remoteIPFilter: networkingConfig.RemoteIPFilter,
      isRemoteIPFilterBlacklist: networkingConfig.IsRemoteIPFilterBlacklist,
    },

    library: {
      virtualFolders: virtualFolders.map((folder: VirtualFolderInfoSchema) => ({
        name: folder.Name ?? "",
        collectionType: folder.CollectionType ?? "mixed",
        libraryOptions: {
          pathInfos:
            folder.LibraryOptions?.PathInfos?.map((p: MediaPathInfoSchema) => ({
              path: p.Path ?? "",
            })) ?? [],
          typeOptions: folder.LibraryOptions?.TypeOptions?.map(
            (typeOpt: TypeOptionsSchema) => ({
              type: typeOpt.Type ?? "",
              metadataFetchers: typeOpt.MetadataFetchers ?? [],
              metadataFetcherOrder: typeOpt.MetadataFetcherOrder ?? undefined,
              imageFetchers: typeOpt.ImageFetchers ?? [],
              imageFetcherOrder: typeOpt.ImageFetcherOrder ?? undefined,
              similarItemProviders: typeOpt.SimilarItemProviders,
              similarItemProviderOrder: typeOpt.SimilarItemProviderOrder,
            }),
          ),
          automaticallyAddToCollection:
            folder.LibraryOptions?.AutomaticallyAddToCollection,
          enableChapterImageExtraction:
            folder.LibraryOptions?.EnableChapterImageExtraction,
          extractChapterImagesDuringLibraryScan:
            folder.LibraryOptions?.ExtractChapterImagesDuringLibraryScan,
          extractTrickplayImagesDuringLibraryScan:
            folder.LibraryOptions?.ExtractTrickplayImagesDuringLibraryScan,
          enableEmbeddedEpisodeInfos:
            folder.LibraryOptions?.EnableEmbeddedEpisodeInfos,
          enableEmbeddedExtraTitles:
            folder.LibraryOptions?.EnableEmbeddedExtrasTitles,
          enableTrickplayImageExtraction:
            folder.LibraryOptions?.EnableTrickplayImageExtraction,
          saveTrickplayWithMedia: folder.LibraryOptions?.SaveTrickplayWithMedia,
          metadataSavers: folder.LibraryOptions?.MetadataSavers ?? undefined,
          saveLocalMetadata: folder.LibraryOptions?.SaveLocalMetadata,
          automaticRefreshIntervalDays:
            folder.LibraryOptions?.AutomaticRefreshIntervalDays,
          enableRealtimeMonitor: folder.LibraryOptions?.EnableRealtimeMonitor,
          enabled: folder.LibraryOptions?.Enabled,
          enablePhotos: folder.LibraryOptions?.EnablePhotos,
          enableLUFSScan: folder.LibraryOptions?.EnableLUFSScan,
          enableAutomaticSeriesGrouping:
            folder.LibraryOptions?.EnableAutomaticSeriesGrouping,
          enableEmbeddedTitles: folder.LibraryOptions?.EnableEmbeddedTitles,
          skipSubtitlesIfEmbeddedSubtitlesPresent:
            folder.LibraryOptions?.SkipSubtitlesIfEmbeddedSubtitlesPresent,
          skipSubtitlesIfAudioTrackMatches:
            folder.LibraryOptions?.SkipSubtitlesIfAudioTrackMatches,
          requirePerfectSubtitleMatch:
            folder.LibraryOptions?.RequirePerfectSubtitleMatch,
          saveSubtitlesWithMedia: folder.LibraryOptions?.SaveSubtitlesWithMedia,
          saveLyricsWithMedia: folder.LibraryOptions?.SaveLyricsWithMedia,
          preferNonstandardArtistsTag:
            folder.LibraryOptions?.PreferNonstandardArtistsTag,
          useCustomTagDelimiters: folder.LibraryOptions?.UseCustomTagDelimiters,
          preferredMetadataLanguage:
            folder.LibraryOptions?.PreferredMetadataLanguage,
          metadataCountryCode: folder.LibraryOptions?.MetadataCountryCode,
          seasonZeroDisplayName: folder.LibraryOptions?.SeasonZeroDisplayName,
          allowEmbeddedSubtitles: folder.LibraryOptions?.AllowEmbeddedSubtitles,
          disabledLocalMetadataReaders:
            folder.LibraryOptions?.DisabledLocalMetadataReaders,
          localMetadataReaderOrder:
            folder.LibraryOptions?.LocalMetadataReaderOrder ?? undefined,
          disabledSubtitleFetchers:
            folder.LibraryOptions?.DisabledSubtitleFetchers,
          subtitleFetcherOrder: folder.LibraryOptions?.SubtitleFetcherOrder,
          disabledMediaSegmentProviders:
            folder.LibraryOptions?.DisabledMediaSegmentProviders,
          mediaSegmentProviderOrder:
            folder.LibraryOptions?.MediaSegmentProviderOrder,
          subtitleDownloadLanguages:
            folder.LibraryOptions?.SubtitleDownloadLanguages ?? undefined,
          disabledLyricFetchers: folder.LibraryOptions?.DisabledLyricFetchers,
          lyricFetcherOrder: folder.LibraryOptions?.LyricFetcherOrder,
          customTagDelimiters: folder.LibraryOptions?.CustomTagDelimiters,
          delimiterWhitelist: folder.LibraryOptions?.DelimiterWhitelist,
        },
      })),
    },

    branding: {
      loginDisclaimer: brandingConfig.LoginDisclaimer,
      customCss: brandingConfig.CustomCss,
      splashscreenEnabled: brandingConfig.SplashscreenEnabled,
    },

    users: users.map((user: UserDtoSchema) => ({
      name: user.Name ?? "",
      ...(user.Id && webPreferences.has(user.Id)
        ? {
            displayPreferences: [
              dumpDisplayPreferences(
                webPreferences.get(user.Id) as DisplayPreferencesDtoSchema,
              ),
            ],
          }
        : {}),
      policy: {
        ...dumpFields(user.Policy, POLICY_FIELDS),
        ...dumpFields(user.Policy, POLICY_LIBRARY_FIELDS, resolveLibraryNames),
        ...(user.Policy?.AccessSchedules
          ? {
              accessSchedules: user.Policy.AccessSchedules.map(
                (schedule: {
                  DayOfWeek?: string;
                  StartHour?: number;
                  EndHour?: number;
                }) => ({
                  dayOfWeek: schedule.DayOfWeek,
                  startHour: schedule.StartHour,
                  endHour: schedule.EndHour,
                }),
              ),
            }
          : {}),
      },
      ...dumpFields(user.Configuration, USER_CONFIGURATION_FIELDS),
      ...dumpFields(
        user.Configuration,
        CONFIGURATION_LIBRARY_FIELDS,
        resolveLibraryNames,
      ),
    })),

    plugins: pluginsWithConfig,

    api_keys: apiKeys.map((key: AuthenticationInfoSchema) => ({
      name: key.AppName,
    })),

    scheduledTasks: scheduledTasks.flatMap((task: TaskInfoSchema) => {
      const dumped: ReturnType<typeof dumpTaskTriggers> =
        dumpTaskTriggers(task);
      return dumped ? [dumped] : [];
    }),

    livetv: {
      guideDays: liveTv.GuideDays ?? undefined,
      recordingPath: liveTv.RecordingPath ?? undefined,
      movieRecordingPath: liveTv.MovieRecordingPath ?? undefined,
      seriesRecordingPath: liveTv.SeriesRecordingPath ?? undefined,
      enableRecordingSubfolders: liveTv.EnableRecordingSubfolders,
      enableOriginalAudioWithEncodedRecordings:
        liveTv.EnableOriginalAudioWithEncodedRecordings,
      prePaddingSeconds: liveTv.PrePaddingSeconds,
      postPaddingSeconds: liveTv.PostPaddingSeconds,
      recordingPostProcessor: liveTv.RecordingPostProcessor ?? undefined,
      recordingPostProcessorArguments:
        liveTv.RecordingPostProcessorArguments ?? undefined,
      saveRecordingNfo: liveTv.SaveRecordingNFO,
      saveRecordingImages: liveTv.SaveRecordingImages,
      tunerHosts: (liveTv.TunerHosts ?? []).map(
        (host: TunerHostInfoSchema) => ({
          type: host.Type ?? "",
          url: host.Url ?? "",
          friendlyName: host.FriendlyName ?? undefined,
          deviceId: host.DeviceId ?? undefined,
          importFavoritesOnly: host.ImportFavoritesOnly,
          allowHwTranscoding: host.AllowHWTranscoding,
          allowFmp4TranscodingContainer: host.AllowFmp4TranscodingContainer,
          allowStreamSharing: host.AllowStreamSharing,
          fallbackMaxStreamingBitrate: host.FallbackMaxStreamingBitrate,
          enableStreamLooping: host.EnableStreamLooping,
          source: host.Source ?? undefined,
          tunerCount: host.TunerCount,
          userAgent: host.UserAgent ?? undefined,
          ignoreDts: host.IgnoreDts,
          readAtNativeFramerate: host.ReadAtNativeFramerate,
        }),
      ),
      listingProviders: (liveTv.ListingProviders ?? []).map(
        (provider: ListingsProviderInfoSchema) => ({
          type: provider.Type ?? "",
          username: provider.Username ?? undefined,
          listingsId: provider.ListingsId ?? undefined,
          zipCode: provider.ZipCode ?? undefined,
          country: provider.Country ?? undefined,
          path: provider.Path ?? undefined,
          enabledTuners: provider.EnabledTuners ?? undefined,
          enableAllTuners: provider.EnableAllTuners,
          newsCategories: provider.NewsCategories ?? undefined,
          sportsCategories: provider.SportsCategories ?? undefined,
          kidsCategories: provider.KidsCategories ?? undefined,
          movieCategories: provider.MovieCategories ?? undefined,
          channelMappings: provider.ChannelMappings?.map(
            (mapping: { Name?: string | null; Value?: string | null }) => ({
              name: mapping.Name ?? "",
              value: mapping.Value ?? "",
            }),
          ),
          moviePrefix: provider.MoviePrefix ?? undefined,
          preferredLanguage: provider.PreferredLanguage ?? undefined,
          userAgent: provider.UserAgent ?? undefined,
        }),
      ),
    },
  };

  console.log(yaml.stringify(config));

  console.error(
    "\n⚠️  Note: User and listings-provider passwords cannot be exported. Add them manually.",
  );
}
