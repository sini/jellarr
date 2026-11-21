import { z } from "zod";

export const TunerHostConfigType: z.ZodObject<{
  type: z.ZodString;
  url: z.ZodString;
  friendlyName: z.ZodOptional<z.ZodString>;
  deviceId: z.ZodOptional<z.ZodString>;
  importFavoritesOnly: z.ZodOptional<z.ZodBoolean>;
  allowHwTranscoding: z.ZodOptional<z.ZodBoolean>;
  allowFmp4TranscodingContainer: z.ZodOptional<z.ZodBoolean>;
  allowStreamSharing: z.ZodOptional<z.ZodBoolean>;
  fallbackMaxStreamingBitrate: z.ZodOptional<z.ZodNumber>;
  enableStreamLooping: z.ZodOptional<z.ZodBoolean>;
  source: z.ZodOptional<z.ZodString>;
  tunerCount: z.ZodOptional<z.ZodNumber>;
  userAgent: z.ZodOptional<z.ZodString>;
  ignoreDts: z.ZodOptional<z.ZodBoolean>;
  readAtNativeFramerate: z.ZodOptional<z.ZodBoolean>;
}> = z
  .object({
    type: z.string().min(1, "Tuner host type cannot be empty"),
    url: z.string().min(1, "Tuner host url cannot be empty"),
    friendlyName: z.string().optional(),
    deviceId: z.string().optional(),
    importFavoritesOnly: z.boolean().optional(),
    allowHwTranscoding: z.boolean().optional(),
    allowFmp4TranscodingContainer: z.boolean().optional(),
    allowStreamSharing: z.boolean().optional(),
    fallbackMaxStreamingBitrate: z.number().int().optional(),
    enableStreamLooping: z.boolean().optional(),
    source: z.string().optional(),
    tunerCount: z.number().int().optional(),
    userAgent: z.string().optional(),
    ignoreDts: z.boolean().optional(),
    readAtNativeFramerate: z.boolean().optional(),
  })
  .strict();

export type TunerHostConfig = z.infer<typeof TunerHostConfigType>;

export const ChannelMappingConfigType: z.ZodObject<{
  name: z.ZodString;
  value: z.ZodString;
}> = z.object({ name: z.string(), value: z.string() }).strict();

export const ListingProviderConfigType: z.ZodObject<{
  type: z.ZodString;
  username: z.ZodOptional<z.ZodString>;
  password: z.ZodOptional<z.ZodString>;
  listingsId: z.ZodOptional<z.ZodString>;
  zipCode: z.ZodOptional<z.ZodString>;
  country: z.ZodOptional<z.ZodString>;
  path: z.ZodOptional<z.ZodString>;
  enabledTuners: z.ZodOptional<z.ZodArray<z.ZodString>>;
  enableAllTuners: z.ZodOptional<z.ZodBoolean>;
  newsCategories: z.ZodOptional<z.ZodArray<z.ZodString>>;
  sportsCategories: z.ZodOptional<z.ZodArray<z.ZodString>>;
  kidsCategories: z.ZodOptional<z.ZodArray<z.ZodString>>;
  movieCategories: z.ZodOptional<z.ZodArray<z.ZodString>>;
  channelMappings: z.ZodOptional<z.ZodArray<typeof ChannelMappingConfigType>>;
  moviePrefix: z.ZodOptional<z.ZodString>;
  preferredLanguage: z.ZodOptional<z.ZodString>;
  userAgent: z.ZodOptional<z.ZodString>;
}> = z
  .object({
    type: z.string().min(1, "Listings provider type cannot be empty"),
    username: z.string().optional(),
    password: z.string().optional(),
    listingsId: z.string().optional(),
    zipCode: z.string().optional(),
    country: z.string().optional(),
    path: z.string().optional(),
    enabledTuners: z.array(z.string()).optional(),
    enableAllTuners: z.boolean().optional(),
    newsCategories: z.array(z.string()).optional(),
    sportsCategories: z.array(z.string()).optional(),
    kidsCategories: z.array(z.string()).optional(),
    movieCategories: z.array(z.string()).optional(),
    channelMappings: z.array(ChannelMappingConfigType).optional(),
    moviePrefix: z.string().optional(),
    preferredLanguage: z.string().optional(),
    userAgent: z.string().optional(),
  })
  .strict();

export type ListingProviderConfig = z.infer<typeof ListingProviderConfigType>;

export const LiveTvConfigType: z.ZodObject<{
  guideDays: z.ZodOptional<z.ZodNumber>;
  recordingPath: z.ZodOptional<z.ZodString>;
  movieRecordingPath: z.ZodOptional<z.ZodString>;
  seriesRecordingPath: z.ZodOptional<z.ZodString>;
  enableRecordingSubfolders: z.ZodOptional<z.ZodBoolean>;
  enableOriginalAudioWithEncodedRecordings: z.ZodOptional<z.ZodBoolean>;
  prePaddingSeconds: z.ZodOptional<z.ZodNumber>;
  postPaddingSeconds: z.ZodOptional<z.ZodNumber>;
  recordingPostProcessor: z.ZodOptional<z.ZodString>;
  recordingPostProcessorArguments: z.ZodOptional<z.ZodString>;
  saveRecordingNfo: z.ZodOptional<z.ZodBoolean>;
  saveRecordingImages: z.ZodOptional<z.ZodBoolean>;
  authoritative: z.ZodOptional<z.ZodBoolean>;
  tunerHosts: z.ZodOptional<z.ZodArray<typeof TunerHostConfigType>>;
  listingProviders: z.ZodOptional<z.ZodArray<typeof ListingProviderConfigType>>;
}> = z
  .object({
    guideDays: z.number().int().optional(),
    recordingPath: z.string().optional(),
    movieRecordingPath: z.string().optional(),
    seriesRecordingPath: z.string().optional(),
    enableRecordingSubfolders: z.boolean().optional(),
    enableOriginalAudioWithEncodedRecordings: z.boolean().optional(),
    prePaddingSeconds: z.number().int().optional(),
    postPaddingSeconds: z.number().int().optional(),
    recordingPostProcessor: z.string().optional(),
    recordingPostProcessorArguments: z.string().optional(),
    saveRecordingNfo: z.boolean().optional(),
    saveRecordingImages: z.boolean().optional(),
    authoritative: z.boolean().optional(),
    tunerHosts: z.array(TunerHostConfigType).optional(),
    listingProviders: z.array(ListingProviderConfigType).optional(),
  })
  .strict();

export type LiveTvConfig = z.infer<typeof LiveTvConfigType>;
