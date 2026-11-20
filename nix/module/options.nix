{
  config,
  lib,
  pkgs,
  ...
}: let
  types = import ./types {inherit lib;};
in {
  imports = [
    (lib.mkRenamedOptionModule ["services" "jellarr" "bootstrap" "jellyfinService"] ["services" "jellarr" "jellyfinService"])
  ];

  options.services.jellarr = {
    bootstrap = {
      enable = lib.mkEnableOption ''
        API key bootstrap service.

        WARNING: This requires Jellarr to run on the same host as Jellyfin.
        The bootstrap service will stop Jellyfin, insert the API key into
        the database, and restart Jellyfin. This only runs once - if the
        key already exists, it skips insertion.

        For deployments where Jellarr runs on a different host than Jellyfin,
        you must provision the API key manually (via Jellyfin UI or a separate
        script on the Jellyfin host) and provide it via environmentFile.
      '';

      apiKeyFile = lib.mkOption {
        default = config.services.jellarr.apiKeyFile;
        defaultText = lib.literalExpression "config.services.jellarr.apiKeyFile";
        description = ''
          Path to a file containing the API key to insert into Jellyfin's database.
          The file should contain only the API key value (whitespace is trimmed).
          This is typically a sops-nix managed secret.
        '';
        example = "/run/secrets/jellarr-api-key";
        type = lib.types.nullOr lib.types.path;
      };

      apiKeyName = lib.mkOption {
        default = "jellarr";
        description = ''
          Name/label for the API key in Jellyfin's API keys list.
          Used to identify the key and prevent duplicate insertions.
        '';
        type = lib.types.str;
      };

      jellyfinDataDir = lib.mkOption {
        default = config.services.jellyfin.dataDir;
        description = ''
          Jellyfin's data directory where the database is stored.
          The database path will be: {jellyfinDataDir}/data/jellyfin.db

          Defaults to config.services.jellyfin.dataDir.
        '';
        type = lib.types.path;
      };
    };

    apiKeyFile = lib.mkOption {
      default = null;
      description = ''
        File holding the API key jellarr authenticates with. It is delivered
        through systemd `LoadCredential` and exposed as `JELLARR_API_KEY_FILE`,
        so the service user needs no read access to the path. Do not also set
        `JELLARR_API_KEY` in `environmentFile`. Also the default for
        `bootstrap.apiKeyFile`.
      '';
      example = "/run/secrets/jellarr-api-key";
      type = lib.types.nullOr lib.types.path;
    };

    config = lib.mkOption {
      default = null;
      description = "Jellarr configuration, as typed options. Set exactly one of `config` and `configFile`.";
      type = lib.types.nullOr types.root.rootConfigType;
    };

    configFile = lib.mkOption {
      default = null;
      description = ''
        Path to a YAML or JSON jellarr configuration, used as is instead of the
        typed `config`. Set exactly one of `config` and `configFile`.
      '';
      type = lib.types.nullOr lib.types.path;
    };

    jellyfinService = lib.mkOption {
      default = "jellyfin.service";
      description = ''
        Jellyfin systemd unit that jellarr runs after and wants. Set to null
        when Jellyfin runs elsewhere.
      '';
      type = lib.types.nullOr lib.types.str;
    };

    waitTimeout = lib.mkOption {
      default = 300;
      description = "Seconds jellarr waits for Jellyfin to report healthy before giving up (`JELLARR_WAIT_TIMEOUT`).";
      type = lib.types.ints.unsigned;
    };

    dataDir = lib.mkOption {
      default = "/var/lib/jellarr";
      description = "Working directory for jellarr (repos/, config/, etc.).";
      type = lib.types.path;
    };

    enable = lib.mkEnableOption "jellarr synchronization service";

    environmentFile = lib.mkOption {
      default = null;
      description = ''
        Environment file as defined in {manpage}`systemd.exec(5)`.
      '';
      type = lib.types.nullOr lib.types.path;
    };

    package = lib.mkOption {
      default = pkgs.callPackage ../package.nix {};
      defaultText = lib.literalExpression "pkgs.callPackage ../package.nix {}";
      description = "Package to run for the jellarr service.";
      type = lib.types.package;
    };

    group = lib.mkOption {
      default = "jellarr";
      description = "Group for the jellarr service.";
      type = lib.types.str;
    };

    schedule = lib.mkOption {
      default = "daily";
      description = "Run interval for the timer.";
      type = lib.types.str;
    };

    user = lib.mkOption {
      default = "jellarr";
      description = "User to run the jellarr service as.";
      type = lib.types.str;
    };
  };
}
