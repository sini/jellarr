import { z } from "zod";

export const AccessScheduleConfigType: z.ZodObject<{
  dayOfWeek: z.ZodEnum<{
    Sunday: "Sunday";
    Monday: "Monday";
    Tuesday: "Tuesday";
    Wednesday: "Wednesday";
    Thursday: "Thursday";
    Friday: "Friday";
    Saturday: "Saturday";
    Everyday: "Everyday";
    Weekday: "Weekday";
    Weekend: "Weekend";
  }>;
  startHour: z.ZodNumber;
  endHour: z.ZodNumber;
}> = z.object({
  dayOfWeek: z.enum([
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Everyday",
    "Weekday",
    "Weekend",
  ]),
  startHour: z.number().min(0).max(24),
  endHour: z.number().min(0).max(24),
});

export type AccessScheduleConfig = z.infer<typeof AccessScheduleConfigType>;

export const UserPolicyConfigType: z.ZodObject<{
  isAdministrator: z.ZodOptional<z.ZodBoolean>;
  isHidden: z.ZodOptional<z.ZodBoolean>;
  isDisabled: z.ZodOptional<z.ZodBoolean>;
  loginAttemptsBeforeLockout: z.ZodOptional<z.ZodNumber>;
  maxActiveSessions: z.ZodOptional<z.ZodNumber>;
  remoteClientBitrateLimit: z.ZodOptional<z.ZodNumber>;
  maxParentalRating: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
  maxParentalSubRating: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
  enableAllFolders: z.ZodOptional<z.ZodBoolean>;
  enableCollectionManagement: z.ZodOptional<z.ZodBoolean>;
  enableSubtitleManagement: z.ZodOptional<z.ZodBoolean>;
  enableLyricManagement: z.ZodOptional<z.ZodBoolean>;
  enableContentDownloading: z.ZodOptional<z.ZodBoolean>;
  enableContentDeletion: z.ZodOptional<z.ZodBoolean>;
  enableUserPreferenceAccess: z.ZodOptional<z.ZodBoolean>;
  enableRemoteControlOfOtherUsers: z.ZodOptional<z.ZodBoolean>;
  enableSharedDeviceControl: z.ZodOptional<z.ZodBoolean>;
  enableRemoteAccess: z.ZodOptional<z.ZodBoolean>;
  enableLiveTvManagement: z.ZodOptional<z.ZodBoolean>;
  enableLiveTvAccess: z.ZodOptional<z.ZodBoolean>;
  enableMediaPlayback: z.ZodOptional<z.ZodBoolean>;
  enableAudioPlaybackTranscoding: z.ZodOptional<z.ZodBoolean>;
  enableVideoPlaybackTranscoding: z.ZodOptional<z.ZodBoolean>;
  enablePlaybackRemuxing: z.ZodOptional<z.ZodBoolean>;
  forceRemoteSourceTranscoding: z.ZodOptional<z.ZodBoolean>;
  enableSyncTranscoding: z.ZodOptional<z.ZodBoolean>;
  enableMediaConversion: z.ZodOptional<z.ZodBoolean>;
  enableAllDevices: z.ZodOptional<z.ZodBoolean>;
  enableAllChannels: z.ZodOptional<z.ZodBoolean>;
  enablePublicSharing: z.ZodOptional<z.ZodBoolean>;
  syncPlayAccess: z.ZodOptional<
    z.ZodEnum<{
      CreateAndJoinGroups: "CreateAndJoinGroups";
      JoinGroups: "JoinGroups";
      None: "None";
    }>
  >;
  enabledLibraries: z.ZodOptional<z.ZodArray<z.ZodString>>;
  enableContentDeletionFromLibraries: z.ZodOptional<z.ZodArray<z.ZodString>>;
  blockedMediaLibraries: z.ZodOptional<z.ZodArray<z.ZodString>>;
  enabledDevices: z.ZodOptional<z.ZodArray<z.ZodString>>;
  enabledChannels: z.ZodOptional<z.ZodArray<z.ZodString>>;
  blockedChannels: z.ZodOptional<z.ZodArray<z.ZodString>>;
  allowedTags: z.ZodOptional<z.ZodArray<z.ZodString>>;
  blockedTags: z.ZodOptional<z.ZodArray<z.ZodString>>;
  blockUnratedItems: z.ZodOptional<
    z.ZodArray<
      z.ZodEnum<{
        Movie: "Movie";
        Trailer: "Trailer";
        Series: "Series";
        Music: "Music";
        Book: "Book";
        LiveTvChannel: "LiveTvChannel";
        LiveTvProgram: "LiveTvProgram";
        ChannelContent: "ChannelContent";
        Other: "Other";
      }>
    >
  >;
  accessSchedules: z.ZodOptional<z.ZodArray<typeof AccessScheduleConfigType>>;
}> = z.object({
  isAdministrator: z.boolean().optional(),
  isHidden: z.boolean().optional(),
  isDisabled: z.boolean().optional(),
  loginAttemptsBeforeLockout: z.number().int().min(-1).optional(),
  maxActiveSessions: z.number().int().min(0).optional(),
  remoteClientBitrateLimit: z.number().int().min(0).optional(),
  // NOTE: an explicit null clears the limit; an absent key leaves it unmanaged.
  maxParentalRating: z.number().int().min(0).nullable().optional(),
  maxParentalSubRating: z.number().int().min(0).nullable().optional(),
  enableAllFolders: z.boolean().optional(),
  enableCollectionManagement: z.boolean().optional(),
  enableSubtitleManagement: z.boolean().optional(),
  enableLyricManagement: z.boolean().optional(),
  enableContentDownloading: z.boolean().optional(),
  enableContentDeletion: z.boolean().optional(),
  enableUserPreferenceAccess: z.boolean().optional(),
  enableRemoteControlOfOtherUsers: z.boolean().optional(),
  enableSharedDeviceControl: z.boolean().optional(),
  enableRemoteAccess: z.boolean().optional(),
  enableLiveTvManagement: z.boolean().optional(),
  enableLiveTvAccess: z.boolean().optional(),
  enableMediaPlayback: z.boolean().optional(),
  enableAudioPlaybackTranscoding: z.boolean().optional(),
  enableVideoPlaybackTranscoding: z.boolean().optional(),
  enablePlaybackRemuxing: z.boolean().optional(),
  forceRemoteSourceTranscoding: z.boolean().optional(),
  enableSyncTranscoding: z.boolean().optional(),
  enableMediaConversion: z.boolean().optional(),
  enableAllDevices: z.boolean().optional(),
  enableAllChannels: z.boolean().optional(),
  enablePublicSharing: z.boolean().optional(),
  syncPlayAccess: z
    .enum(["CreateAndJoinGroups", "JoinGroups", "None"])
    .optional(),
  enabledLibraries: z
    .array(z.string().min(1, "Library name is required"))
    .optional(),
  enableContentDeletionFromLibraries: z
    .array(z.string().min(1, "Library name is required"))
    .optional(),
  blockedMediaLibraries: z
    .array(z.string().min(1, "Library name is required"))
    .optional(),
  enabledDevices: z.array(z.string().min(1)).optional(),
  enabledChannels: z.array(z.string().min(1)).optional(),
  blockedChannels: z.array(z.string().min(1)).optional(),
  allowedTags: z.array(z.string().min(1)).optional(),
  blockedTags: z.array(z.string().min(1)).optional(),
  blockUnratedItems: z
    .array(
      z.enum([
        "Movie",
        "Trailer",
        "Series",
        "Music",
        "Book",
        "LiveTvChannel",
        "LiveTvProgram",
        "ChannelContent",
        "Other",
      ]),
    )
    .optional(),
  accessSchedules: z.array(AccessScheduleConfigType).optional(),
});

export type UserPolicyConfig = z.infer<typeof UserPolicyConfigType>;

export const UserConfigType: z.ZodObject<{
  name: z.ZodString;
  password: z.ZodOptional<z.ZodString>;
  passwordFile: z.ZodOptional<z.ZodString>;
  policy: z.ZodOptional<typeof UserPolicyConfigType>;
  orderedLibraries: z.ZodOptional<z.ZodArray<z.ZodString>>;
  groupedLibraries: z.ZodOptional<z.ZodArray<z.ZodString>>;
  latestItemsExcludedLibraries: z.ZodOptional<z.ZodArray<z.ZodString>>;
  myMediaExcludedLibraries: z.ZodOptional<z.ZodArray<z.ZodString>>;
  displayMissingEpisodes: z.ZodOptional<z.ZodBoolean>;
  displayCollectionsView: z.ZodOptional<z.ZodBoolean>;
  enableLocalPassword: z.ZodOptional<z.ZodBoolean>;
  hidePlayedInLatest: z.ZodOptional<z.ZodBoolean>;
  rememberAudioSelections: z.ZodOptional<z.ZodBoolean>;
  rememberSubtitleSelections: z.ZodOptional<z.ZodBoolean>;
  enableNextEpisodeAutoPlay: z.ZodOptional<z.ZodBoolean>;
  subtitleLanguagePreference: z.ZodOptional<z.ZodString>;
  subtitleMode: z.ZodOptional<
    z.ZodEnum<{
      Default: "Default";
      Always: "Always";
      OnlyForced: "OnlyForced";
      None: "None";
      Smart: "Smart";
    }>
  >;
  audioLanguagePreference: z.ZodOptional<z.ZodString>;
  playDefaultAudioTrack: z.ZodOptional<z.ZodBoolean>;
  castReceiverId: z.ZodOptional<z.ZodString>;
  maxActiveSessions: z.ZodOptional<z.ZodNumber>;
}> = z
  .object({
    name: z.string().min(1, "User name is required"),
    password: z.string().optional(),
    passwordFile: z.string().optional(),
    policy: UserPolicyConfigType.optional(),
    orderedLibraries: z
      .array(z.string().min(1, "Library name is required"))
      .optional(),
    groupedLibraries: z
      .array(z.string().min(1, "Library name is required"))
      .optional(),
    latestItemsExcludedLibraries: z
      .array(z.string().min(1, "Library name is required"))
      .optional(),
    myMediaExcludedLibraries: z
      .array(z.string().min(1, "Library name is required"))
      .optional(),
    displayMissingEpisodes: z.boolean().optional(),
    displayCollectionsView: z.boolean().optional(),
    enableLocalPassword: z.boolean().optional(),
    hidePlayedInLatest: z.boolean().optional(),
    rememberAudioSelections: z.boolean().optional(),
    rememberSubtitleSelections: z.boolean().optional(),
    enableNextEpisodeAutoPlay: z.boolean().optional(),
    subtitleLanguagePreference: z.string().min(1).optional(),
    subtitleMode: z
      .enum(["Default", "Always", "OnlyForced", "None", "Smart"])
      .optional(),
    audioLanguagePreference: z.string().min(1).optional(),
    playDefaultAudioTrack: z.boolean().optional(),
    castReceiverId: z.string().min(1).optional(),
    maxActiveSessions: z.number().int().min(0).optional(),
  })
  .strict()
  .refine(
    (data: { password?: string; passwordFile?: string }) => {
      const hasPassword: boolean =
        data.password !== undefined && data.password.trim() !== "";
      const hasPasswordFile: boolean =
        data.passwordFile !== undefined && data.passwordFile.trim() !== "";
      return hasPassword !== hasPasswordFile;
    },
    {
      message: "Must specify exactly one of 'password' or 'passwordFile'",
      path: [],
    },
  );

export type UserConfig = z.infer<typeof UserConfigType>;

export const UserConfigListType: z.ZodArray<typeof UserConfigType> =
  z.array(UserConfigType);

export type UserConfigList = z.infer<typeof UserConfigListType>;
