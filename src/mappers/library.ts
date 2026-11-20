import type {
  LibraryOptionName,
  VirtualFolderConfig,
} from "../types/config/library";
import type {
  LibraryOptionsSchema,
  VirtualFolderInfoSchema,
} from "../types/schema/library";
import { withoutUndefined } from "../lib/objects";

type TypeOptionConfig = NonNullable<
  VirtualFolderConfig["libraryOptions"]["typeOptions"]
>[number];
type TypeOptionsSchema = NonNullable<
  LibraryOptionsSchema["TypeOptions"]
>[number];

/** The LibraryOptions field each library option is written to. */
export const LIBRARY_OPTION_FIELDS: Record<
  LibraryOptionName,
  keyof LibraryOptionsSchema
> = {
  pathInfos: "PathInfos",
  typeOptions: "TypeOptions",
  automaticallyAddToCollection: "AutomaticallyAddToCollection",
  enableChapterImageExtraction: "EnableChapterImageExtraction",
  extractChapterImagesDuringLibraryScan:
    "ExtractChapterImagesDuringLibraryScan",
  extractTrickplayImagesDuringLibraryScan:
    "ExtractTrickplayImagesDuringLibraryScan",
  enableEmbeddedEpisodeInfos: "EnableEmbeddedEpisodeInfos",
  enableEmbeddedExtraTitles: "EnableEmbeddedExtrasTitles",
  enableTrickplayImageExtraction: "EnableTrickplayImageExtraction",
  saveTrickplayWithMedia: "SaveTrickplayWithMedia",
  metadataSavers: "MetadataSavers",
  saveLocalMetadata: "SaveLocalMetadata",
  automaticRefreshIntervalDays: "AutomaticRefreshIntervalDays",
  enableRealtimeMonitor: "EnableRealtimeMonitor",
  enabled: "Enabled",
  enablePhotos: "EnablePhotos",
  enableLUFSScan: "EnableLUFSScan",
  enableAutomaticSeriesGrouping: "EnableAutomaticSeriesGrouping",
  enableEmbeddedTitles: "EnableEmbeddedTitles",
  skipSubtitlesIfEmbeddedSubtitlesPresent:
    "SkipSubtitlesIfEmbeddedSubtitlesPresent",
  skipSubtitlesIfAudioTrackMatches: "SkipSubtitlesIfAudioTrackMatches",
  requirePerfectSubtitleMatch: "RequirePerfectSubtitleMatch",
  saveSubtitlesWithMedia: "SaveSubtitlesWithMedia",
  saveLyricsWithMedia: "SaveLyricsWithMedia",
  preferNonstandardArtistsTag: "PreferNonstandardArtistsTag",
  useCustomTagDelimiters: "UseCustomTagDelimiters",
  preferredMetadataLanguage: "PreferredMetadataLanguage",
  metadataCountryCode: "MetadataCountryCode",
  seasonZeroDisplayName: "SeasonZeroDisplayName",
  allowEmbeddedSubtitles: "AllowEmbeddedSubtitles",
  disabledLocalMetadataReaders: "DisabledLocalMetadataReaders",
  localMetadataReaderOrder: "LocalMetadataReaderOrder",
  disabledSubtitleFetchers: "DisabledSubtitleFetchers",
  subtitleFetcherOrder: "SubtitleFetcherOrder",
  disabledMediaSegmentProviders: "DisabledMediaSegmentProviders",
  mediaSegmentProviderOrder: "MediaSegmentProviderOrder",
  subtitleDownloadLanguages: "SubtitleDownloadLanguages",
  disabledLyricFetchers: "DisabledLyricFetchers",
  lyricFetcherOrder: "LyricFetcherOrder",
  customTagDelimiters: "CustomTagDelimiters",
  delimiterWhitelist: "DelimiterWhitelist",
};

export function mapVirtualFolderConfigToSchema(
  config: VirtualFolderConfig,
): Partial<VirtualFolderInfoSchema> {
  const opts: VirtualFolderConfig["libraryOptions"] = config.libraryOptions;

  const libraryOptions: Partial<LibraryOptionsSchema> = withoutUndefined({
    PathInfos: opts.pathInfos.map((pathInfo: { path: string }) => ({
      Path: pathInfo.path,
    })),
    TypeOptions: opts.typeOptions?.map(
      (typeOption: TypeOptionConfig): TypeOptionsSchema =>
        withoutUndefined({
          Type: typeOption.type,
          MetadataFetchers: typeOption.metadataFetchers,
          MetadataFetcherOrder: typeOption.metadataFetcherOrder,
          ImageFetchers: typeOption.imageFetchers,
          ImageFetcherOrder: typeOption.imageFetcherOrder,
        }),
    ),
    AutomaticallyAddToCollection: opts.automaticallyAddToCollection,
    EnableChapterImageExtraction: opts.enableChapterImageExtraction,
    ExtractChapterImagesDuringLibraryScan:
      opts.extractChapterImagesDuringLibraryScan,
    ExtractTrickplayImagesDuringLibraryScan:
      opts.extractTrickplayImagesDuringLibraryScan,
    EnableEmbeddedEpisodeInfos: opts.enableEmbeddedEpisodeInfos,
    EnableEmbeddedExtrasTitles: opts.enableEmbeddedExtraTitles,
    EnableTrickplayImageExtraction: opts.enableTrickplayImageExtraction,
    SaveTrickplayWithMedia: opts.saveTrickplayWithMedia,
    MetadataSavers: opts.metadataSavers,
    SaveLocalMetadata: opts.saveLocalMetadata,
    AutomaticRefreshIntervalDays: opts.automaticRefreshIntervalDays,
    EnableRealtimeMonitor: opts.enableRealtimeMonitor,
    Enabled: opts.enabled,
    EnablePhotos: opts.enablePhotos,
    EnableLUFSScan: opts.enableLUFSScan,
    EnableAutomaticSeriesGrouping: opts.enableAutomaticSeriesGrouping,
    EnableEmbeddedTitles: opts.enableEmbeddedTitles,
    SkipSubtitlesIfEmbeddedSubtitlesPresent:
      opts.skipSubtitlesIfEmbeddedSubtitlesPresent,
    SkipSubtitlesIfAudioTrackMatches: opts.skipSubtitlesIfAudioTrackMatches,
    RequirePerfectSubtitleMatch: opts.requirePerfectSubtitleMatch,
    SaveSubtitlesWithMedia: opts.saveSubtitlesWithMedia,
    SaveLyricsWithMedia: opts.saveLyricsWithMedia,
    PreferNonstandardArtistsTag: opts.preferNonstandardArtistsTag,
    UseCustomTagDelimiters: opts.useCustomTagDelimiters,
    PreferredMetadataLanguage: opts.preferredMetadataLanguage,
    MetadataCountryCode: opts.metadataCountryCode,
    SeasonZeroDisplayName: opts.seasonZeroDisplayName,
    AllowEmbeddedSubtitles: opts.allowEmbeddedSubtitles,
    DisabledLocalMetadataReaders: opts.disabledLocalMetadataReaders,
    LocalMetadataReaderOrder: opts.localMetadataReaderOrder,
    DisabledSubtitleFetchers: opts.disabledSubtitleFetchers,
    SubtitleFetcherOrder: opts.subtitleFetcherOrder,
    DisabledMediaSegmentProviders: opts.disabledMediaSegmentProviders,
    MediaSegmentProviderOrder: opts.mediaSegmentProviderOrder,
    SubtitleDownloadLanguages: opts.subtitleDownloadLanguages,
    DisabledLyricFetchers: opts.disabledLyricFetchers,
    LyricFetcherOrder: opts.lyricFetcherOrder,
    CustomTagDelimiters: opts.customTagDelimiters,
    DelimiterWhitelist: opts.delimiterWhitelist,
  });

  return {
    Name: config.name,
    CollectionType: config.collectionType,
    LibraryOptions: libraryOptions as LibraryOptionsSchema,
  };
}

/**
 * Replace the ignored options of a desired folder with the values the server
 * currently has, so they neither show up in the diff nor get overwritten when
 * another option drives an update.
 */
export function withIgnoredLibraryOptions(
  desired: Partial<VirtualFolderInfoSchema>,
  current: VirtualFolderInfoSchema,
  ignoreChanges: readonly LibraryOptionName[],
): Partial<VirtualFolderInfoSchema> {
  if (ignoreChanges.length === 0) return desired;

  const ignored: Set<string> = new Set(
    ignoreChanges.map(
      (option: LibraryOptionName): string => LIBRARY_OPTION_FIELDS[option],
    ),
  );
  const libraryOptions: Record<string, unknown> = Object.fromEntries([
    ...Object.entries(desired.LibraryOptions ?? {}).filter(
      ([field]: [string, unknown]): boolean => !ignored.has(field),
    ),
    ...Object.entries(current.LibraryOptions ?? {}).filter(
      ([field]: [string, unknown]): boolean => ignored.has(field),
    ),
  ]);

  return {
    ...desired,
    LibraryOptions: libraryOptions as LibraryOptionsSchema,
  };
}

export function mapVirtualFolderInfoSchemaToAddVirtualFolderDtoSchema(
  virtualFolderInfoSchema: VirtualFolderInfoSchema,
): { LibraryOptions: VirtualFolderInfoSchema["LibraryOptions"] } {
  return {
    LibraryOptions: virtualFolderInfoSchema.LibraryOptions,
  };
}
