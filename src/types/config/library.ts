import { z } from "zod";

export const IMAGE_TYPES: [string, ...string[]] = [
  "Primary",
  "Art",
  "Backdrop",
  "Banner",
  "Logo",
  "Thumb",
  "Disc",
  "Box",
  "Screenshot",
  "Menu",
  "Chapter",
  "BoxRear",
  "Profile",
];

export const ImageOptionConfigType: z.ZodObject<
  {
    type: z.ZodEnum<{ [K in (typeof IMAGE_TYPES)[number]]: K }>;
    limit: z.ZodNumber;
    minWidth: z.ZodNumber;
  },
  z.core.$strict
> = z
  .object({
    type: z.enum(IMAGE_TYPES),
    limit: z.number().int().min(0),
    minWidth: z.number().int().min(0),
  })
  .strict();

export const ImageOptionConfigListType: z.ZodArray<
  typeof ImageOptionConfigType
> = z.array(ImageOptionConfigType);

export const LibraryOptionsConfigType: z.ZodObject<{
  pathInfos: z.ZodArray<
    z.ZodObject<{
      path: z.ZodString;
    }>
  >;
  typeOptions: z.ZodOptional<
    z.ZodArray<
      z.ZodObject<{
        type: z.ZodString;
        metadataFetchers: z.ZodArray<z.ZodString>;
        metadataFetcherOrder: z.ZodOptional<
          z.ZodNullable<z.ZodArray<z.ZodString>>
        >;
        imageFetchers: z.ZodArray<z.ZodString>;
        imageFetcherOrder: z.ZodOptional<
          z.ZodNullable<z.ZodArray<z.ZodString>>
        >;
        similarItemProviders: z.ZodOptional<z.ZodArray<z.ZodString>>;
        similarItemProviderOrder: z.ZodOptional<z.ZodArray<z.ZodString>>;
        imageOptions: z.ZodOptional<typeof ImageOptionConfigListType>;
      }>
    >
  >;
  automaticallyAddToCollection: z.ZodOptional<z.ZodBoolean>;
  enableChapterImageExtraction: z.ZodOptional<z.ZodBoolean>;
  extractChapterImagesDuringLibraryScan: z.ZodOptional<z.ZodBoolean>;
  extractTrickplayImagesDuringLibraryScan: z.ZodOptional<z.ZodBoolean>;
  enableEmbeddedEpisodeInfos: z.ZodOptional<z.ZodBoolean>;
  enableEmbeddedExtraTitles: z.ZodOptional<z.ZodBoolean>;
  enableTrickplayImageExtraction: z.ZodOptional<z.ZodBoolean>;
  saveTrickplayWithMedia: z.ZodOptional<z.ZodBoolean>;
  metadataSavers: z.ZodOptional<z.ZodArray<z.ZodString>>;
  saveLocalMetadata: z.ZodOptional<z.ZodBoolean>;
  automaticRefreshIntervalDays: z.ZodOptional<z.ZodNumber>;
  enableRealtimeMonitor: z.ZodOptional<z.ZodBoolean>;
  enabled: z.ZodOptional<z.ZodBoolean>;
  enablePhotos: z.ZodOptional<z.ZodBoolean>;
  enableLUFSScan: z.ZodOptional<z.ZodBoolean>;
  enableAutomaticSeriesGrouping: z.ZodOptional<z.ZodBoolean>;
  enableEmbeddedTitles: z.ZodOptional<z.ZodBoolean>;
  skipSubtitlesIfEmbeddedSubtitlesPresent: z.ZodOptional<z.ZodBoolean>;
  skipSubtitlesIfAudioTrackMatches: z.ZodOptional<z.ZodBoolean>;
  requirePerfectSubtitleMatch: z.ZodOptional<z.ZodBoolean>;
  saveSubtitlesWithMedia: z.ZodOptional<z.ZodBoolean>;
  saveLyricsWithMedia: z.ZodOptional<z.ZodBoolean>;
  preferNonstandardArtistsTag: z.ZodOptional<z.ZodBoolean>;
  useCustomTagDelimiters: z.ZodOptional<z.ZodBoolean>;
  preferredMetadataLanguage: z.ZodOptional<z.ZodString>;
  metadataCountryCode: z.ZodOptional<z.ZodString>;
  seasonZeroDisplayName: z.ZodOptional<z.ZodString>;
  allowEmbeddedSubtitles: z.ZodOptional<
    z.ZodEnum<{
      AllowAll: "AllowAll";
      AllowText: "AllowText";
      AllowImage: "AllowImage";
      AllowNone: "AllowNone";
    }>
  >;
  disabledLocalMetadataReaders: z.ZodOptional<z.ZodArray<z.ZodString>>;
  localMetadataReaderOrder: z.ZodOptional<z.ZodArray<z.ZodString>>;
  disabledSubtitleFetchers: z.ZodOptional<z.ZodArray<z.ZodString>>;
  subtitleFetcherOrder: z.ZodOptional<z.ZodArray<z.ZodString>>;
  disabledMediaSegmentProviders: z.ZodOptional<z.ZodArray<z.ZodString>>;
  mediaSegmentProviderOrder: z.ZodOptional<z.ZodArray<z.ZodString>>;
  subtitleDownloadLanguages: z.ZodOptional<z.ZodArray<z.ZodString>>;
  disabledLyricFetchers: z.ZodOptional<z.ZodArray<z.ZodString>>;
  lyricFetcherOrder: z.ZodOptional<z.ZodArray<z.ZodString>>;
  customTagDelimiters: z.ZodOptional<z.ZodArray<z.ZodString>>;
  delimiterWhitelist: z.ZodOptional<z.ZodArray<z.ZodString>>;
}> = z
  .object({
    pathInfos: z.array(z.object({ path: z.string().min(1) }).strict()).min(1),
    typeOptions: z
      .array(
        z
          .object({
            type: z.string().min(1),
            metadataFetchers: z.array(z.string().min(1)),
            metadataFetcherOrder: z
              .array(z.string().min(1))
              .nullable()
              .optional(),
            imageFetchers: z.array(z.string().min(1)),
            imageFetcherOrder: z.array(z.string().min(1)).nullable().optional(),
            similarItemProviders: z.array(z.string().min(1)).optional(),
            similarItemProviderOrder: z.array(z.string().min(1)).optional(),
            imageOptions: ImageOptionConfigListType.optional(),
          })
          .strict(),
      )
      .optional(),
    automaticallyAddToCollection: z.boolean().optional(),
    enableChapterImageExtraction: z.boolean().optional(),
    extractChapterImagesDuringLibraryScan: z.boolean().optional(),
    extractTrickplayImagesDuringLibraryScan: z.boolean().optional(),
    enableEmbeddedEpisodeInfos: z.boolean().optional(),
    enableEmbeddedExtraTitles: z.boolean().optional(),
    enableTrickplayImageExtraction: z.boolean().optional(),
    saveTrickplayWithMedia: z.boolean().optional(),
    metadataSavers: z.array(z.string().min(1)).optional(),
    saveLocalMetadata: z.boolean().optional(),
    automaticRefreshIntervalDays: z.number().int().nonnegative().optional(),
    enableRealtimeMonitor: z.boolean().optional(),
    enabled: z.boolean().optional(),
    enablePhotos: z.boolean().optional(),
    enableLUFSScan: z.boolean().optional(),
    enableAutomaticSeriesGrouping: z.boolean().optional(),
    enableEmbeddedTitles: z.boolean().optional(),
    skipSubtitlesIfEmbeddedSubtitlesPresent: z.boolean().optional(),
    skipSubtitlesIfAudioTrackMatches: z.boolean().optional(),
    requirePerfectSubtitleMatch: z.boolean().optional(),
    saveSubtitlesWithMedia: z.boolean().optional(),
    saveLyricsWithMedia: z.boolean().optional(),
    preferNonstandardArtistsTag: z.boolean().optional(),
    useCustomTagDelimiters: z.boolean().optional(),
    preferredMetadataLanguage: z.string().optional(),
    metadataCountryCode: z.string().optional(),
    seasonZeroDisplayName: z.string().optional(),
    allowEmbeddedSubtitles: z
      .enum(["AllowAll", "AllowText", "AllowImage", "AllowNone"])
      .optional(),
    disabledLocalMetadataReaders: z.array(z.string().min(1)).optional(),
    localMetadataReaderOrder: z.array(z.string().min(1)).optional(),
    disabledSubtitleFetchers: z.array(z.string().min(1)).optional(),
    subtitleFetcherOrder: z.array(z.string().min(1)).optional(),
    disabledMediaSegmentProviders: z.array(z.string().min(1)).optional(),
    mediaSegmentProviderOrder: z.array(z.string().min(1)).optional(),
    subtitleDownloadLanguages: z.array(z.string().min(1)).optional(),
    disabledLyricFetchers: z.array(z.string().min(1)).optional(),
    lyricFetcherOrder: z.array(z.string().min(1)).optional(),
    customTagDelimiters: z.array(z.string().min(1)).optional(),
    delimiterWhitelist: z.array(z.string().min(1)).optional(),
  })
  .strict();

export type LibraryOptionName = keyof z.infer<typeof LibraryOptionsConfigType>;

export const LIBRARY_OPTION_NAMES: [LibraryOptionName, ...LibraryOptionName[]] =
  Object.keys(LibraryOptionsConfigType.shape) as [
    LibraryOptionName,
    ...LibraryOptionName[],
  ];

export const VirtualFolderConfigType: z.ZodObject<{
  name: z.ZodString;
  collectionType: z.ZodEnum<{
    movies: "movies";
    tvshows: "tvshows";
    music: "music";
    musicvideos: "musicvideos";
    homevideos: "homevideos";
    boxsets: "boxsets";
    books: "books";
    mixed: "mixed";
  }>;
  libraryOptions: typeof LibraryOptionsConfigType;
  renameFrom: z.ZodOptional<z.ZodString>;
  ignoreChanges: z.ZodOptional<
    z.ZodArray<z.ZodEnum<{ [K in LibraryOptionName]: K }>>
  >;
}> = z
  .object({
    name: z.string().min(1),
    collectionType: z.enum([
      "movies",
      "tvshows",
      "music",
      "musicvideos",
      "homevideos",
      "boxsets",
      "books",
      "mixed",
    ]),
    libraryOptions: LibraryOptionsConfigType,
    renameFrom: z.string().min(1).optional(),
    ignoreChanges: z.array(z.enum(LIBRARY_OPTION_NAMES)).optional(),
  })
  .strict()
  .refine(
    (folder: { name: string; renameFrom?: string | undefined }) =>
      folder.renameFrom !== folder.name,
    { message: "renameFrom must differ from name", path: ["renameFrom"] },
  );

export type VirtualFolderConfig = z.infer<typeof VirtualFolderConfigType>;

export const LibraryConfigType: z.ZodObject<{
  virtualFolders: z.ZodOptional<z.ZodArray<typeof VirtualFolderConfigType>>;
}> = z
  .object({
    virtualFolders: z.array(VirtualFolderConfigType).optional(),
  })
  .strict()
  .superRefine(
    (
      library: { virtualFolders?: VirtualFolderConfig[] | undefined },
      ctx: z.RefinementCtx,
    ): void => {
      const folders: VirtualFolderConfig[] = library.virtualFolders ?? [];
      const names: Set<string> = new Set(
        folders.map((folder: VirtualFolderConfig) => folder.name),
      );
      const sources: Set<string> = new Set();
      folders.forEach((folder: VirtualFolderConfig, index: number): void => {
        if (folder.renameFrom === undefined) return;
        const problem: string | undefined = names.has(folder.renameFrom)
          ? `renameFrom "${folder.renameFrom}" is also a declared library name`
          : sources.has(folder.renameFrom)
            ? `renameFrom "${folder.renameFrom}" is used by more than one library`
            : undefined;
        sources.add(folder.renameFrom);
        if (problem) {
          ctx.addIssue({
            code: "custom",
            path: ["virtualFolders", index, "renameFrom"],
            message: problem,
          });
        }
      });
    },
  );

export type LibraryConfig = z.infer<typeof LibraryConfigType>;
