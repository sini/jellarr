{lib}: let
  secret = import ./secret.nix {inherit lib;};
  inherit (lib) types mkOption;

  inherit (types) nullOr;

  accessScheduleType = types.submodule {
    options = {
      dayOfWeek = mkOption {
        type = types.enum ["Sunday" "Monday" "Tuesday" "Wednesday" "Thursday" "Friday" "Saturday" "Everyday" "Weekday" "Weekend"];
        description = "Day or day group the schedule applies to.";
      };
      startHour = mkOption {
        type = types.numbers.between 0 24;
        description = "Start hour (0 to 24, fractions allowed).";
      };
      endHour = mkOption {
        type = types.numbers.between 0 24;
        description = "End hour (0 to 24, fractions allowed).";
      };
    };
  };

  userPolicyConfigType = types.submodule {
    options = {
      isAdministrator = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Whether the user is an administrator.";
      };
      isHidden = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Hide the user from login screens.";
      };
      isDisabled = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Disable the user account.";
      };
      loginAttemptsBeforeLockout = mkOption {
        type = nullOr types.int;
        default = null;
        description = "Number of login attempts before lockout (-1 never locks out, 0 uses the server default).";
      };
      maxActiveSessions = mkOption {
        type = nullOr types.int;
        default = null;
        description = "Maximum concurrent active sessions for the user (0 is unlimited).";
      };
      remoteClientBitrateLimit = mkOption {
        type = nullOr types.ints.unsigned;
        default = null;
        description = "Internet streaming bitrate limit for remote clients (bits per second).";
      };
      maxParentalRating = mkOption {
        type = nullOr (types.either types.ints.unsigned (types.enum ["unrestricted"]));
        default = null;
        description = ''
          Maximum parental rating the user may see. `null` leaves it unmanaged;
          `"unrestricted"` clears the limit on the server.
        '';
      };
      maxParentalSubRating = mkOption {
        type = nullOr (types.either types.ints.unsigned (types.enum ["unrestricted"]));
        default = null;
        description = ''
          Maximum parental sub-rating the user may see. `null` leaves it
          unmanaged; `"unrestricted"` clears the limit on the server.
        '';
      };
      enableAllFolders = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Allow user to access all folders.";
      };
      enableCollectionManagement = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Allow user to manage collections.";
      };
      enableSubtitleManagement = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Allow user to manage subtitles.";
      };
      enableLyricManagement = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Allow user to manage lyrics.";
      };
      enableContentDownloading = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Allow user to download media content.";
      };
      enableContentDeletion = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Allow user to delete content from every library.";
      };
      enableUserPreferenceAccess = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Allow user to change their own preferences.";
      };
      enableRemoteControlOfOtherUsers = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Allow user to remote control other users.";
      };
      enableSharedDeviceControl = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Allow user to control shared devices.";
      };
      enableRemoteAccess = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Allow user to connect from outside the local network.";
      };
      enableLiveTvManagement = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Allow user to manage Live TV.";
      };
      enableLiveTvAccess = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Allow user to watch Live TV.";
      };
      enableMediaPlayback = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Allow user to play media.";
      };
      enableAudioPlaybackTranscoding = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Allow audio playback that needs transcoding.";
      };
      enableVideoPlaybackTranscoding = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Allow video playback that needs transcoding.";
      };
      enablePlaybackRemuxing = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Allow playback that needs remuxing.";
      };
      forceRemoteSourceTranscoding = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Force transcoding of remote media sources.";
      };
      enableSyncTranscoding = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Allow transcoding for sync.";
      };
      enableMediaConversion = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Allow user to convert media.";
      };
      enableAllDevices = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Allow access from all devices.";
      };
      enableAllChannels = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Allow access to all channels.";
      };
      enablePublicSharing = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Allow user to share items publicly.";
      };
      syncPlayAccess = mkOption {
        type = nullOr (types.enum ["CreateAndJoinGroups" "JoinGroups" "None"]);
        default = null;
        description = "What SyncPlay features the user can access.";
      };
      enabledLibraries = mkOption {
        type = nullOr (types.listOf secret.str);
        default = null;
        description = "List of library names the user can access.";
      };
      enableContentDeletionFromLibraries = mkOption {
        type = nullOr (types.listOf secret.str);
        default = null;
        description = "Library names the user can delete content from.";
      };
      blockedMediaLibraries = mkOption {
        type = nullOr (types.listOf secret.str);
        default = null;
        description = "Library names blocked for the user (legacy; prefer enabledLibraries).";
      };
      enabledDevices = mkOption {
        type = nullOr (types.listOf secret.str);
        default = null;
        description = "Device ids the user can access from.";
      };
      enabledChannels = mkOption {
        type = nullOr (types.listOf secret.str);
        default = null;
        description = "Channel ids the user can access.";
      };
      blockedChannels = mkOption {
        type = nullOr (types.listOf secret.str);
        default = null;
        description = "Channel ids blocked for the user.";
      };
      allowedTags = mkOption {
        type = nullOr (types.listOf secret.str);
        default = null;
        description = "Only show items with these tags. An empty list removes the restriction.";
      };
      blockedTags = mkOption {
        type = nullOr (types.listOf secret.str);
        default = null;
        description = "Hide items with these tags. An empty list removes the restriction.";
      };
      blockUnratedItems = mkOption {
        type = nullOr (types.listOf (types.enum ["Movie" "Trailer" "Series" "Music" "Book" "LiveTvChannel" "LiveTvProgram" "ChannelContent" "Other"]));
        default = null;
        description = "Unrated item types hidden from the user.";
      };
      accessSchedules = mkOption {
        type = nullOr (types.listOf accessScheduleType);
        default = null;
        description = "Times of day the user may access the server. An empty list removes the restriction.";
      };
    };
  };

  displayPreferencesType = types.submodule {
    options = {
      client = mkOption {
        type = types.str;
        description = "Client name the entry belongs to, such as `emby` for Jellyfin Web.";
      };
      id = mkOption {
        type = nullOr types.str;
        default = null;
        description = "Display preferences id. Defaults to `usersettings`, where Jellyfin Web keeps a user's settings.";
      };
      viewType = mkOption {
        type = nullOr types.str;
        default = null;
        description = "Type of the view.";
      };
      sortBy = mkOption {
        type = nullOr types.str;
        default = null;
        description = "Field to sort by.";
      };
      indexBy = mkOption {
        type = nullOr types.str;
        default = null;
        description = "Field to index by.";
      };
      rememberIndexing = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Remember the indexing.";
      };
      primaryImageHeight = mkOption {
        type = nullOr types.ints.unsigned;
        default = null;
        description = "Height of the primary image.";
      };
      primaryImageWidth = mkOption {
        type = nullOr types.ints.unsigned;
        default = null;
        description = "Width of the primary image.";
      };
      customPrefs = mkOption {
        type = nullOr (types.attrsOf (types.oneOf [types.str types.int types.bool]));
        default = null;
        description = "Client-specific preferences. Declared keys are merged; other keys are kept. Values are stored as strings.";
      };
      scrollDirection = mkOption {
        type = nullOr (types.enum ["Horizontal" "Vertical"]);
        default = null;
        description = "Scroll direction.";
      };
      showBackdrop = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Show backdrops.";
      };
      rememberSorting = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Remember the sorting.";
      };
      sortOrder = mkOption {
        type = nullOr (types.enum ["Ascending" "Descending"]);
        default = null;
        description = "Sort order.";
      };
      showSidebar = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Show the sidebar.";
      };
    };
  };

  userConfigType = types.submodule {
    options = {
      name = mkOption {
        type = secret.str;
        description = "User name.";
      };
      renameFrom = mkOption {
        type = nullOr types.str;
        default = null;
        description = ''
          Previous name of this user. When a user with that name exists and
          none with the new name does, the account is renamed instead of a new
          one created; when both exist, jellarr stops with an error. It does
          nothing once the rename happened, so it can stay in the config.
        '';
      };
      password = mkOption {
        type = nullOr secret.str;
        default = null;
        description = "User password (plaintext, for development only).";
      };
      passwordFile = mkOption {
        type = nullOr types.str;
        default = null;
        description = "Path to file containing user password.";
      };
      policy = mkOption {
        type = nullOr userPolicyConfigType;
        default = null;
        description = "User policy configuration.";
      };
      orderedLibraries = mkOption {
        type = nullOr (types.listOf secret.str);
        default = null;
        description = "Library names in home screen order. Omit to preserve the order, or use an empty list to reset it.";
      };
      groupedLibraries = mkOption {
        type = nullOr (types.listOf secret.str);
        default = null;
        description = "Library names grouped into one view.";
      };
      latestItemsExcludedLibraries = mkOption {
        type = nullOr (types.listOf secret.str);
        default = null;
        description = "Library names excluded from the latest items rows.";
      };
      myMediaExcludedLibraries = mkOption {
        type = nullOr (types.listOf secret.str);
        default = null;
        description = "Library names hidden from the My Media row.";
      };
      displayMissingEpisodes = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Show missing episodes for the user.";
      };
      displayCollectionsView = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Show a collections view on the home screen.";
      };
      enableLocalPassword = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Require a password on the local network.";
      };
      hidePlayedInLatest = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Hide played items from the latest items rows.";
      };
      rememberAudioSelections = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Remember the audio track chosen for the previous item.";
      };
      rememberSubtitleSelections = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Remember the subtitle track chosen for the previous item.";
      };
      enableNextEpisodeAutoPlay = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Play the next episode automatically.";
      };
      subtitleLanguagePreference = mkOption {
        type = nullOr secret.str;
        default = null;
        description = "Subtitle language preference code.";
      };
      subtitleMode = mkOption {
        type = nullOr (types.enum ["Default" "Always" "OnlyForced" "None" "Smart"]);
        default = null;
        description = "Subtitle playback mode for the user.";
      };
      audioLanguagePreference = mkOption {
        type = nullOr secret.str;
        default = null;
        description = "Audio language preference code.";
      };
      playDefaultAudioTrack = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Play the default audio track regardless of the preferred language.";
      };
      castReceiverId = mkOption {
        type = nullOr secret.str;
        default = null;
        description = "Id of the selected cast receiver.";
      };
      displayPreferences = mkOption {
        type = nullOr (types.listOf displayPreferencesType);
        default = null;
        description = ''
          Per-user display preferences, matched by (id, client). Declared
          fields and `customPrefs` keys are merged into the stored entry;
          everything else stays as the server has it. The entry jellarr keeps
          its own markers in cannot be declared.
        '';
      };
    };
  };

  usersConfigType = nullOr (types.listOf userConfigType);

  # Declared lists are authoritative, so an empty list is kept; only an empty entry is an error.
  checkEntries = c: names:
    lib.all (
      n:
        (c.${n} or null)
        == null
        || lib.all (e: e != "" || throw "${n} entries cannot be empty") c.${n}
    )
    names;

  presentOnly = lib.filterAttrs (_: v: v != null);

  mkUserPolicyConfig = cfg: let
    c =
      if cfg == null
      then {}
      else cfg;
  in
    assert checkEntries c ["enabledLibraries" "enableContentDeletionFromLibraries" "blockedMediaLibraries" "enabledDevices" "enabledChannels" "blockedChannels" "allowedTags" "blockedTags"];
    assert (c.loginAttemptsBeforeLockout or null)
    == null
    || c.loginAttemptsBeforeLockout >= (-1)
    || throw "loginAttemptsBeforeLockout must be at least -1";
      presentOnly c
      # "unrestricted" renders as an explicit null, which clears the limit.
      // lib.genAttrs (lib.filter (n: (c.${n} or null) == "unrestricted") ["maxParentalRating" "maxParentalSubRating"]) (_: null);

  mkUsersConfig = cfg:
    map (
      user:
        assert user.name != "" || throw "User name cannot be empty";
        assert (user.password != null)
        != (user.passwordFile != null)
        || throw "User '${user.name}' must specify exactly one of 'password' or 'passwordFile'";
        assert checkEntries user ["orderedLibraries" "groupedLibraries" "latestItemsExcludedLibraries" "myMediaExcludedLibraries"];
          presentOnly (user
            // {
              policy =
                if (user.policy or null) == null
                then null
                else mkUserPolicyConfig user.policy;
              displayPreferences =
                if (user.displayPreferences or null) == null
                then null
                else map presentOnly user.displayPreferences;
            })
    )
    cfg;
in {
  inherit usersConfigType mkUsersConfig;
}
