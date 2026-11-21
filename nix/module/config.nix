{
  config,
  lib,
  pkgs,
  ...
}: let
  cfg = config.services.jellarr;
  bootstrapCfg = cfg.bootstrap;
  bootstrapEnabled = cfg.enable && bootstrapCfg.enable;
  allKeys = {${bootstrapCfg.apiKeyName} = bootstrapCfg.apiKeyFile;} // bootstrapCfg.extraKeys;

  types = import ./types {inherit lib;};
  configFile =
    if cfg.configFile != null
    then cfg.configFile
    else pkgs.writeText "jellarr-config.yml" (pkgs.lib.generators.toYAML {} (types.root.mkConfig cfg.config));
in {
  config = lib.mkMerge [
    (lib.mkIf cfg.enable {
      assertions = [
        {
          assertion = (cfg.config != null) != (cfg.configFile != null);
          message = "Exactly one of services.jellarr.config and services.jellarr.configFile must be set.";
        }
      ];

      systemd = {
        services.jellarr = {
          after =
            [
              "network-online.target"
              "systemd-tmpfiles-setup.service"
            ]
            ++ lib.optional (cfg.jellyfinService != null) cfg.jellyfinService
            ++ lib.optional bootstrapEnabled "jellarr-api-key-bootstrap.service";
          description = "Run jellarr (packaged) once";
          preStart =
            # sh
            ''
              install -D -m 0644 ${configFile} ${cfg.dataDir}/config/config.yml
              chown ${cfg.user}:${cfg.group} ${cfg.dataDir}/config/config.yml
            '';
          environment =
            {JELLARR_WAIT_TIMEOUT = toString cfg.waitTimeout;}
            // lib.optionalAttrs (cfg.apiKeyFile != null) {JELLARR_API_KEY_FILE = "%d/api-key";};
          serviceConfig = {
            LoadCredential = lib.optional (cfg.apiKeyFile != null) "api-key:${cfg.apiKeyFile}";
            EnvironmentFile = lib.optional (cfg.environmentFile != null) cfg.environmentFile;
            ExecStart = lib.getExe cfg.package;
            Group = cfg.group;
            Type = "oneshot";
            User = cfg.user;
            WorkingDirectory = cfg.dataDir;
          };
          restartIfChanged = false;
          wants = ["network-online.target"] ++ lib.optional (cfg.jellyfinService != null) cfg.jellyfinService;
        };

        # A target orders itself after every unit it wants, so a service wanted by
        # multi-user.target would hold up boot and switch until jellarr exits. This
        # timer starts it instead: once when it activates (boot, or a restart on
        # config change) without blocking either.
        timers.jellarr-apply = {
          description = "Run jellarr at boot and when its config changes";
          restartTriggers = [configFile];
          timerConfig = {
            OnActiveSec = 0;
            Unit = "jellarr.service";
          };
          wantedBy = ["timers.target"];
        };

        timers.jellarr = {
          description = "Schedule jellarr run";
          partOf = ["jellarr.service"];
          timerConfig = {
            OnCalendar = cfg.schedule;
            Persistent = true;
            RandomizedDelaySec = "5m";
          };
          wantedBy = ["timers.target"];
        };

        tmpfiles.rules = [
          "d ${cfg.dataDir} 0755 ${cfg.user} ${cfg.group} -"
          "d ${cfg.dataDir}/config 0755 ${cfg.user} ${cfg.group} -"
        ];
      };

      users = {
        groups = lib.mkIf (cfg.group == "jellarr") {
          ${cfg.group} = {};
        };

        users = lib.mkIf (cfg.user == "jellarr") {
          jellarr = {
            description = "jellarr user";
            inherit (cfg) group;
            home = cfg.dataDir;
            isSystemUser = true;
          };
        };
      };
    })

    (lib.mkIf bootstrapEnabled {
      assertions = [
        {
          assertion = bootstrapCfg.apiKeyFile != null;
          message = "services.jellarr.bootstrap.apiKeyFile (or services.jellarr.apiKeyFile) must be set when bootstrap is enabled.";
        }
        {
          assertion = cfg.jellyfinService != null;
          message = "services.jellarr.jellyfinService must be set when bootstrap is enabled.";
        }
        {
          assertion = !(builtins.hasAttr bootstrapCfg.apiKeyName bootstrapCfg.extraKeys);
          message = "services.jellarr.bootstrap.extraKeys must not contain apiKeyName (${bootstrapCfg.apiKeyName}); that key is set by apiKeyFile.";
        }
        {
          assertion = lib.all (name: builtins.match "[A-Za-z0-9._ -]+" name != null) (builtins.attrNames allKeys);
          message = "services.jellarr.bootstrap key names (apiKeyName and extraKeys) may only contain letters, digits, '.', '_', '-' and spaces.";
        }
      ];

      systemd.services.jellarr-api-key-bootstrap = {
        after = [cfg.jellyfinService];
        description = "Bootstrap API key into Jellyfin database for Jellarr";
        path = [
          pkgs.coreutils
          pkgs.sqlite
          pkgs.systemd
        ];
        script = let
          dbPath = "${bootstrapCfg.jellyfinDataDir}/data/jellyfin.db";
          addKeys = lib.concatStringsSep "\n" (lib.mapAttrsToList (
              name: file: "add_key ${lib.escapeShellArg name} ${lib.escapeShellArg (toString file)}"
            )
            allKeys);
        in
          # sh
          ''
            set -euo pipefail

            DB="${dbPath}"

            declare -A wanted
            add_key() {
              local token
              token=$(tr -d '[:space:]' < "$2")
              if ! [[ "$token" =~ ^[A-Za-z0-9._~+/=-]+$ ]]; then
                echo "API key '$1': $2 is empty or holds characters outside A-Za-z0-9._~+/=-" >&2
                exit 1
              fi
              wanted["$1"]=$token
            }
            ${addKeys}

            until [ -e "$DB" ]; do
              sleep 1
            done

            # Jellyfin 10.11 schema; refuse to write into anything else
            # the file appears before Jellyfin's migrations create the table
            for _ in $(seq 1 180); do
              cols=$(sqlite3 "$DB" "SELECT group_concat(name) FROM (SELECT name FROM pragma_table_info('ApiKeys') ORDER BY name);" || true)
              [ -n "$cols" ] && break
              sleep 1
            done
            expected="AccessToken,DateCreated,DateLastActivity,Id,Name"
            if [ "$cols" != "$expected" ]; then
              echo "ApiKeys schema mismatch: got '$cols', expected '$expected'" >&2
              exit 1
            fi

            # Check which keys are missing or hold a different value
            mapfile -t names < <(printf '%s\n' "''${!wanted[@]}" | sort)
            changed=()
            for name in "''${names[@]}"; do
              existing_token=$(sqlite3 "$DB" "SELECT AccessToken FROM ApiKeys WHERE Name='$name';")
              if [ "$existing_token" = "''${wanted[$name]}" ]; then
                echo "API key '$name' already exists with correct value, skipping"
              elif [ -n "$existing_token" ]; then
                echo "API key '$name' value changed, updating..."
                changed+=("$name")
              else
                echo "Inserting API key '$name' into Jellyfin database..."
                changed+=("$name")
              fi
            done
            [ "''${#changed[@]}" -eq 0 ] && exit 0

            # Stop Jellyfin once to update every changed key safely
            systemctl stop ${cfg.jellyfinService}

            sleep 5

            {
              echo "BEGIN IMMEDIATE;"
              for name in "''${changed[@]}"; do
                token="''${wanted[$name]}"
                echo "UPDATE ApiKeys SET AccessToken='$token', DateLastActivity=datetime('now') WHERE Name='$name';"
                echo "INSERT INTO ApiKeys (AccessToken, Name, DateCreated, DateLastActivity) SELECT '$token', '$name', datetime('now'), datetime('now') WHERE NOT EXISTS (SELECT 1 FROM ApiKeys WHERE Name='$name');"
              done
              echo "COMMIT;"
            } | sqlite3 -bail "$DB"

            systemctl start ${cfg.jellyfinService}
            echo "API keys configured, Jellyfin restarted"
          '';
        serviceConfig = {
          Type = "oneshot";
          User = "root";
        };
        # Don't use wantedBy multi-user.target - that causes deadlock because
        # the script runs systemctl stop/start during NixOS activation.
        # Instead, only run when jellarr.service needs it.
        requiredBy = ["jellarr.service"];
        before = ["jellarr.service"];
      };
    })
  ];
}
