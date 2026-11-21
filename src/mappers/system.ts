import {
  type SystemConfig,
  type TrickplayOptionsConfig,
  type PluginRepositoryConfig,
  type MetadataOptionsConfig,
  type ContentTypeConfig,
  type PathSubstitutionConfig,
  type CastReceiverApplicationConfig,
} from "../types/config/system";
import {
  type ServerConfigurationSchema,
  type TrickplayOptionsSchema,
  type PluginRepositorySchema,
  type MetadataOptionsSchema,
  type ContentTypeSchema,
  type PathSubstitutionSchema,
  type CastReceiverApplicationSchema,
} from "../types/schema/system";
import { withoutUndefined } from "../lib/objects";

export function toPluginRepositorySchemas(
  inRepos: PluginRepositoryConfig[],
): PluginRepositorySchema[] {
  return inRepos.map((r: PluginRepositoryConfig): PluginRepositorySchema => ({
    Name: r.name,
    Url: r.url,
    Enabled: r.enabled,
  }));
}

export function toMetadataOptionsSchemas(
  options: MetadataOptionsConfig[],
): MetadataOptionsSchema[] {
  return options.map((o: MetadataOptionsConfig): MetadataOptionsSchema =>
    withoutUndefined({
      ItemType: o.itemType,
      DisabledMetadataSavers: o.disabledMetadataSavers,
      LocalMetadataReaderOrder: o.localMetadataReaderOrder,
      DisabledMetadataFetchers: o.disabledMetadataFetchers,
      MetadataFetcherOrder: o.metadataFetcherOrder,
      DisabledImageFetchers: o.disabledImageFetchers,
      ImageFetcherOrder: o.imageFetcherOrder,
    }),
  );
}

export function toContentTypeSchemas(
  types: ContentTypeConfig[],
): ContentTypeSchema[] {
  return types.map((t: ContentTypeConfig): ContentTypeSchema => ({
    Name: t.name,
    Value: t.value,
  }));
}

export function toPathSubstitutionSchemas(
  substitutions: PathSubstitutionConfig[],
): PathSubstitutionSchema[] {
  return substitutions.map(
    (s: PathSubstitutionConfig): PathSubstitutionSchema => ({
      From: s.from,
      To: s.to,
    }),
  );
}

export function toCastReceiverApplicationSchemas(
  applications: CastReceiverApplicationConfig[],
): CastReceiverApplicationSchema[] {
  return applications.map(
    (a: CastReceiverApplicationConfig): CastReceiverApplicationSchema => ({
      Id: a.id,
      Name: a.name,
    }),
  );
}

export function toTrickplayOptionsSchema(
  cfg: TrickplayOptionsConfig,
): TrickplayOptionsSchema {
  return withoutUndefined({
    EnableHwAcceleration: cfg.enableHwAcceleration,
    EnableHwEncoding: cfg.enableHwEncoding,
    ProcessThreads: cfg.processThreads,
    EnableKeyFrameOnlyExtraction: cfg.enableKeyFrameOnlyExtraction,
    ScanBehavior: cfg.scanBehavior,
    ProcessPriority: cfg.processPriority,
    Interval: cfg.interval,
    WidthResolutions: cfg.widthResolutions,
    TileWidth: cfg.tileWidth,
    TileHeight: cfg.tileHeight,
    Qscale: cfg.qscale,
    JpegQuality: cfg.jpegQuality,
  }) as TrickplayOptionsSchema;
}

export function mapSystemConfigurationConfigToSchema(
  desired: SystemConfig,
): Partial<ServerConfigurationSchema> {
  return withoutUndefined({
    ServerName: desired.serverName,
    EnableMetrics: desired.enableMetrics,
    PluginRepositories:
      desired.pluginRepositories !== undefined
        ? toPluginRepositorySchemas(desired.pluginRepositories)
        : undefined,
    TrickplayOptions:
      desired.trickplayOptions !== undefined
        ? toTrickplayOptionsSchema(desired.trickplayOptions)
        : undefined,
    MetadataOptions:
      desired.metadataOptions !== undefined
        ? toMetadataOptionsSchemas(desired.metadataOptions)
        : undefined,
    ContentTypes:
      desired.contentTypes !== undefined
        ? toContentTypeSchemas(desired.contentTypes)
        : undefined,
    PathSubstitutions:
      desired.pathSubstitutions !== undefined
        ? toPathSubstitutionSchemas(desired.pathSubstitutions)
        : undefined,
    CastReceiverApplications:
      desired.castReceiverApplications !== undefined
        ? toCastReceiverApplicationSchemas(desired.castReceiverApplications)
        : undefined,
    ImageSavingConvention: desired.imageSavingConvention,
    ChapterImageResolution: desired.chapterImageResolution,
    SortReplaceCharacters: desired.sortReplaceCharacters,
    SortRemoveCharacters: desired.sortRemoveCharacters,
    SortRemoveWords: desired.sortRemoveWords,
    CodecsUsed: desired.codecsUsed,
    CorsHosts: desired.corsHosts,
    CachePath: desired.cachePath,
    MetadataPath: desired.metadataPath,
    PreferredMetadataLanguage: desired.preferredMetadataLanguage,
    MetadataCountryCode: desired.metadataCountryCode,
    UICulture: desired.uiCulture,
    LogFileRetentionDays: desired.logFileRetentionDays,
    MinResumePct: desired.minResumePct,
    MaxResumePct: desired.maxResumePct,
    MinResumeDurationSeconds: desired.minResumeDurationSeconds,
    MinAudiobookResume: desired.minAudiobookResume,
    MaxAudiobookResume: desired.maxAudiobookResume,
    InactiveSessionThreshold: desired.inactiveSessionThreshold,
    LibraryMonitorDelay: desired.libraryMonitorDelay,
    LibraryUpdateDuration: desired.libraryUpdateDuration,
    CacheSize: desired.cacheSize,
    RemoteClientBitrateLimit: desired.remoteClientBitrateLimit,
    ImageExtractionTimeoutMs: desired.imageExtractionTimeoutMs,
    SlowResponseThresholdMs: desired.slowResponseThresholdMs,
    ActivityLogRetentionDays: desired.activityLogRetentionDays,
    LibraryScanFanoutConcurrency: desired.libraryScanFanoutConcurrency,
    LibraryMetadataRefreshConcurrency:
      desired.libraryMetadataRefreshConcurrency,
    DummyChapterDuration: desired.dummyChapterDuration,
    ParallelImageEncodingLimit: desired.parallelImageEncodingLimit,
    IsStartupWizardCompleted: desired.isStartupWizardCompleted,
    EnableNormalizedItemByNameIds: desired.enableNormalizedItemByNameIds,
    IsPortAuthorized: desired.isPortAuthorized,
    QuickConnectAvailable: desired.quickConnectAvailable,
    EnableCaseSensitiveItemIds: desired.enableCaseSensitiveItemIds,
    DisableLiveTvChannelUserDataName: desired.disableLiveTvChannelUserDataName,
    SkipDeserializationForBasicTypes: desired.skipDeserializationForBasicTypes,
    SaveMetadataHidden: desired.saveMetadataHidden,
    EnableFolderView: desired.enableFolderView,
    EnableGroupingMoviesIntoCollections:
      desired.enableGroupingMoviesIntoCollections,
    EnableGroupingShowsIntoCollections:
      desired.enableGroupingShowsIntoCollections,
    DisplaySpecialsWithinSeasons: desired.displaySpecialsWithinSeasons,
    EnableExternalContentInSuggestions:
      desired.enableExternalContentInSuggestions,
    EnableSlowResponseWarning: desired.enableSlowResponseWarning,
    AllowClientLogUpload: desired.allowClientLogUpload,
    EnableLegacyAuthorization: desired.enableLegacyAuthorization,
  }) as Partial<ServerConfigurationSchema>;
}
