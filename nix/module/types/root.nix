{lib}: let
  secret = import ./secret.nix {inherit lib;};
  inherit (lib) types mkOption optionalAttrs;
  inherit (types) nullOr;

  subTypes = {
    authoritative = import ./authoritative.nix {inherit lib;};
    scheduledTasks = import ./scheduled-tasks.nix {inherit lib;};
    apiKeys = import ./api-keys.nix {inherit lib;};
    devices = import ./devices.nix {inherit lib;};
    brandingOptions = import ./branding-options.nix {inherit lib;};
    encodingOptions = import ./encoding-options.nix {inherit lib;};
    library = import ./library.nix {inherit lib;};
    livetv = import ./livetv.nix {inherit lib;};
    networking = import ./networking.nix {inherit lib;};
    metadata = import ./metadata.nix {inherit lib;};
    xbmcMetadata = import ./xbmc-metadata.nix {inherit lib;};
    plugins = import ./plugins.nix {inherit lib;};
    startup = import ./startup.nix {inherit lib;};
    system = import ./system.nix {inherit lib;};
    users = import ./users.nix {inherit lib;};
  };

  rootConfigType = types.submodule {
    options = {
      version = mkOption {
        type = types.int;
        description = "Configuration version (must be positive).";
      };
      base_url = mkOption {
        type = secret.str;
        description = "Jellyfin server base URL.";
      };
      system = mkOption {
        type = nullOr subTypes.system.systemConfigType;
        default = null;
        description = "System configuration.";
      };
      metadata = mkOption {
        type = nullOr subTypes.metadata.metadataConfigType;
        default = null;
        description = "Metadata configuration.";
      };
      xbmcMetadata = mkOption {
        type = nullOr subTypes.xbmcMetadata.xbmcMetadataConfigType;
        default = null;
        description = "NFO saving options (the `xbmcmetadata` named configuration).";
      };
      encoding = mkOption {
        type = nullOr subTypes.encodingOptions.encodingOptionsConfigType;
        default = null;
        description = "Encoding options configuration.";
      };
      networking = mkOption {
        type = nullOr subTypes.networking.networkingConfigType;
        default = null;
        description = "Networking configuration.";
      };
      library = mkOption {
        type = nullOr subTypes.library.libraryConfigType;
        default = null;
        description = "Library configuration.";
      };
      branding = mkOption {
        type = nullOr subTypes.brandingOptions.brandingOptionsConfigType;
        default = null;
        description = "Branding options configuration.";
      };
      users = mkOption {
        type = nullOr subTypes.users.usersConfigType;
        default = null;
        description = "Users configuration.";
      };
      plugins = mkOption {
        type = nullOr subTypes.plugins.pluginsConfigType;
        default = null;
        description = "Plugins configuration.";
      };
      startup = mkOption {
        type = nullOr subTypes.startup.startupConfigType;
        default = null;
        description = "Startup configuration.";
      };
      api_keys = mkOption {
        type = nullOr subTypes.apiKeys.apiKeysConfigType;
        default = null;
        description = "API keys to create.";
      };
      devices = mkOption {
        type = nullOr subTypes.devices.devicesConfigType;
        default = null;
        description = "Custom names for devices, matched by device id.";
      };
      livetv = mkOption {
        type = nullOr subTypes.livetv.liveTvConfigType;
        default = null;
        description = "Live TV configuration.";
      };
      authoritative = mkOption {
        type = nullOr subTypes.authoritative.authoritativeConfigType;
        default = null;
        description = ''
          Opt-in deletion of server entries the config does not declare. Off by
          default: jellarr never deletes users, libraries, plugins or API keys
          unless a flag here is set.
        '';
      };
      reconcilePasswords = mkOption {
        type = nullOr types.bool;
        default = null;
        description = ''
          Whether jellarr sets the declared password of an existing user when
          a sign-in with it is rejected. Unset means false: a password is set
          only when the user is created. `users.*.reconcilePassword` overrides
          this per user.
        '';
      };
      scheduledTasks = mkOption {
        type = nullOr subTypes.scheduledTasks.scheduledTasksConfigType;
        default = null;
        description = "Scheduled task triggers. A declared task's trigger list replaces the server's; undeclared tasks are untouched.";
      };
    };
  };

  mkConfig = cfg:
    assert cfg.version >= 1 || throw "Version must be a positive integer";
    assert cfg.base_url != "" || throw "base_url must not be empty";
      {
        inherit (cfg) version base_url;
        # the runtime schema requires `system`; an empty one changes nothing
        system =
          if cfg ? system && cfg.system != null
          then subTypes.system.mkSystemConfig cfg.system
          else {};
      }
      // optionalAttrs (cfg ? metadata && cfg.metadata != null) {
        metadata = subTypes.metadata.mkMetadataConfig cfg.metadata;
      }
      // optionalAttrs (cfg ? xbmcMetadata && cfg.xbmcMetadata != null) {
        xbmcMetadata = subTypes.xbmcMetadata.mkXbmcMetadataConfig cfg.xbmcMetadata;
      }
      // optionalAttrs (cfg ? encoding && cfg.encoding != null) {
        encoding = subTypes.encodingOptions.mkEncodingOptionsConfig cfg.encoding;
      }
      // optionalAttrs (cfg ? networking && cfg.networking != null) {
        networking = subTypes.networking.mkNetworkingConfig cfg.networking;
      }
      // optionalAttrs (cfg ? library && cfg.library != null) {
        library = subTypes.library.mkLibraryConfig cfg.library;
      }
      // optionalAttrs (cfg ? branding && cfg.branding != null) {
        branding = subTypes.brandingOptions.mkBrandingOptionsConfig cfg.branding;
      }
      // optionalAttrs (cfg ? users && cfg.users != null) {
        users = subTypes.users.mkUsersConfig cfg.users;
      }
      // optionalAttrs (cfg ? plugins && cfg.plugins != null) {
        plugins = subTypes.plugins.mkPluginsConfig cfg.plugins;
      }
      // optionalAttrs (cfg ? startup && cfg.startup != null) {
        startup = subTypes.startup.mkStartupConfig cfg.startup;
      }
      // optionalAttrs (cfg ? devices && cfg.devices != null) {
        devices = subTypes.devices.mkDevicesConfig cfg.devices;
      }
      // optionalAttrs (cfg ? api_keys && cfg.api_keys != null) {
        api_keys = subTypes.apiKeys.mkApiKeysConfig cfg.api_keys;
      }
      // optionalAttrs (cfg ? livetv && cfg.livetv != null) {
        livetv = subTypes.livetv.mkLiveTvConfig cfg.livetv;
      }
      // optionalAttrs (cfg ? authoritative && cfg.authoritative != null) {
        authoritative = subTypes.authoritative.mkAuthoritativeConfig cfg.authoritative;
      }
      // optionalAttrs (cfg ? reconcilePasswords && cfg.reconcilePasswords != null) {
        inherit (cfg) reconcilePasswords;
      }
      // optionalAttrs (cfg ? scheduledTasks && cfg.scheduledTasks != null) {
        scheduledTasks = subTypes.scheduledTasks.mkScheduledTasksConfig cfg.scheduledTasks;
      };
in {
  inherit rootConfigType mkConfig;
}
