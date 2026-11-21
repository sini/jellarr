import type {
  LiveTvConfig,
  ListingProviderConfig,
  TunerHostConfig,
} from "../types/config/livetv";
import type {
  LiveTvOptionsSchema,
  ListingsProviderInfoSchema,
  TunerHostInfoSchema,
} from "../types/schema/livetv";
import { withoutUndefined } from "../lib/objects";

/** The scalar options only: the lists go through their own endpoints. */
export function mapLiveTvOptionsConfigToSchema(
  desired: LiveTvConfig,
): Partial<LiveTvOptionsSchema> {
  return withoutUndefined({
    GuideDays: desired.guideDays,
    RecordingPath: desired.recordingPath,
    MovieRecordingPath: desired.movieRecordingPath,
    SeriesRecordingPath: desired.seriesRecordingPath,
    EnableRecordingSubfolders: desired.enableRecordingSubfolders,
    EnableOriginalAudioWithEncodedRecordings:
      desired.enableOriginalAudioWithEncodedRecordings,
    PrePaddingSeconds: desired.prePaddingSeconds,
    PostPaddingSeconds: desired.postPaddingSeconds,
    RecordingPostProcessor: desired.recordingPostProcessor,
    RecordingPostProcessorArguments: desired.recordingPostProcessorArguments,
    SaveRecordingNFO: desired.saveRecordingNfo,
    SaveRecordingImages: desired.saveRecordingImages,
  });
}

export function mapTunerHostConfigToSchema(
  desired: TunerHostConfig,
): TunerHostInfoSchema {
  return withoutUndefined({
    Type: desired.type,
    Url: desired.url,
    FriendlyName: desired.friendlyName,
    DeviceId: desired.deviceId,
    ImportFavoritesOnly: desired.importFavoritesOnly,
    AllowHWTranscoding: desired.allowHwTranscoding,
    AllowFmp4TranscodingContainer: desired.allowFmp4TranscodingContainer,
    AllowStreamSharing: desired.allowStreamSharing,
    FallbackMaxStreamingBitrate: desired.fallbackMaxStreamingBitrate,
    EnableStreamLooping: desired.enableStreamLooping,
    Source: desired.source,
    TunerCount: desired.tunerCount,
    UserAgent: desired.userAgent,
    IgnoreDts: desired.ignoreDts,
    ReadAtNativeFramerate: desired.readAtNativeFramerate,
  });
}

/** The password is left out: the server stores a hash and takes the plain text as a query parameter. */
export function mapListingProviderConfigToSchema(
  desired: ListingProviderConfig,
): ListingsProviderInfoSchema {
  return withoutUndefined({
    Type: desired.type,
    Username: desired.username,
    ListingsId: desired.listingsId,
    ZipCode: desired.zipCode,
    Country: desired.country,
    Path: desired.path,
    EnabledTuners: desired.enabledTuners,
    EnableAllTuners: desired.enableAllTuners,
    NewsCategories: desired.newsCategories,
    SportsCategories: desired.sportsCategories,
    KidsCategories: desired.kidsCategories,
    MovieCategories: desired.movieCategories,
    ChannelMappings: desired.channelMappings?.map(
      (mapping: { name: string; value: string }) => ({
        Name: mapping.name,
        Value: mapping.value,
      }),
    ),
    MoviePrefix: desired.moviePrefix,
    PreferredLanguage: desired.preferredLanguage,
    UserAgent: desired.userAgent,
  });
}
