{lib}: let
  secret = import ./secret.nix {inherit lib;};
  inherit (lib) types mkOption filterAttrs;
  inherit (types) nullOr;

  opt = type: description:
    mkOption {
      type = nullOr type;
      default = null;
      inherit description;
    };

  strs = types.listOf secret.str;

  tunerHostConfigType = types.submodule {
    options = {
      type = mkOption {
        type = secret.str;
        description = "Tuner host type, for example `m3u` or `hdhomerun`. With `url` it identifies the host.";
      };
      url = mkOption {
        type = secret.str;
        description = "Tuner host URL. With `type` it identifies the host.";
      };
      friendlyName = opt secret.str "Display name.";
      deviceId = opt secret.str "Device id.";
      importFavoritesOnly = opt types.bool "Import favorite channels only.";
      allowHwTranscoding = opt types.bool "Allow hardware transcoding.";
      allowFmp4TranscodingContainer = opt types.bool "Allow the fMP4 transcoding container.";
      allowStreamSharing = opt types.bool "Allow stream sharing.";
      fallbackMaxStreamingBitrate = opt types.int "Fallback maximum streaming bitrate.";
      enableStreamLooping = opt types.bool "Loop streams that end.";
      source = opt secret.str "Source.";
      tunerCount = opt types.int "Number of tuners.";
      userAgent = opt secret.str "User agent to send.";
      ignoreDts = opt types.bool "Ignore DTS.";
      readAtNativeFramerate = opt types.bool "Read the stream at its native frame rate.";
    };
  };

  channelMappingType = types.submodule {
    options = {
      name = mkOption {
        type = types.str;
        description = "Channel name on the tuner.";
      };
      value = mkOption {
        type = types.str;
        description = "Channel name in the guide.";
      };
    };
  };

  listingProviderConfigType = types.submodule {
    options = {
      type = mkOption {
        type = secret.str;
        description = "Provider type, for example `xmltv` or `SchedulesDirect`.";
      };
      username = opt secret.str "Account name. With `type`, `path` and `listingsId` it identifies the provider.";
      password = opt secret.str ''
        Account password in plain text; accepts a `_file` reference. The server
        stores a hash, so jellarr compares the hash and sends the password only
        when it differs.
      '';
      listingsId = opt secret.str "Lineup id. Part of the provider's identity.";
      zipCode = opt secret.str "Zip code.";
      country = opt secret.str "Country.";
      path = opt secret.str "File path or URL of an XMLTV guide. Part of the provider's identity.";
      enabledTuners = opt strs "Tuner ids the provider is enabled for.";
      enableAllTuners = opt types.bool "Enable the provider for all tuners.";
      newsCategories = opt strs "News categories.";
      sportsCategories = opt strs "Sports categories.";
      kidsCategories = opt strs "Kids categories.";
      movieCategories = opt strs "Movie categories.";
      channelMappings = opt (types.listOf channelMappingType) "Channel name mappings.";
      moviePrefix = opt secret.str "Movie prefix.";
      preferredLanguage = opt secret.str "Preferred language.";
      userAgent = opt secret.str "User agent to send.";
    };
  };

  liveTvConfigType = types.submodule {
    options = {
      guideDays = opt types.int "Days of guide data to fetch.";
      recordingPath = opt secret.str "Recording path.";
      movieRecordingPath = opt secret.str "Movie recording path.";
      seriesRecordingPath = opt secret.str "Series recording path.";
      enableRecordingSubfolders = opt types.bool "Record into subfolders.";
      enableOriginalAudioWithEncodedRecordings = opt types.bool "Keep the original audio with encoded recordings.";
      prePaddingSeconds = opt types.int "Seconds to start recording early.";
      postPaddingSeconds = opt types.int "Seconds to keep recording after the end.";
      recordingPostProcessor = opt secret.str "Post-processing program.";
      recordingPostProcessorArguments = opt secret.str "Post-processing arguments.";
      saveRecordingNfo = opt types.bool "Save an NFO next to recordings.";
      saveRecordingImages = opt types.bool "Save images next to recordings.";
      authoritative = opt types.bool ''
        When true, a declared `tunerHosts` or `listingProviders` list is
        authoritative: entries on the server that it does not declare are
        deleted. The default (false) only creates and updates, so nothing is
        ever removed. A list that is not declared is never touched.
      '';
      tunerHosts = opt (types.listOf tunerHostConfigType) "Tuner hosts, matched by type and url.";
      listingProviders = opt (types.listOf listingProviderConfigType) "Listings providers, matched by type plus path, username and listingsId.";
    };
  };

  dropNulls = filterAttrs (_: v: v != null);

  mkLiveTvConfig = cfg:
    dropNulls (cfg
      // {
        tunerHosts =
          if (cfg.tunerHosts or null) == null
          then null
          else map dropNulls cfg.tunerHosts;
        listingProviders =
          if (cfg.listingProviders or null) == null
          then null
          else map dropNulls cfg.listingProviders;
      });
in {
  inherit liveTvConfigType mkLiveTvConfig;
}
