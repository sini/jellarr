{
  config,
  lib,
  pkgs,
  ...
}: let
  cfg = config.services.jellarr;
  bootstrapCfg = cfg.bootstrap;
  bootstrapEnabled = cfg.enable && bootstrapCfg.enable;

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
        in
          # sh
          ''
            set -euo pipefail

            DB="${dbPath}"
            API_KEY=$(cat ${bootstrapCfg.apiKeyFile} | tr -d '[:space:]')
            API_KEY_NAME="${bootstrapCfg.apiKeyName}"

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

            # Check if key exists and matches current value
            existing_token=$(sqlite3 "$DB" "SELECT AccessToken FROM ApiKeys WHERE Name='$API_KEY_NAME';")
            if [ "$existing_token" = "$API_KEY" ]; then
              echo "API key '$API_KEY_NAME' already exists with correct value, skipping"
              exit 0
            fi

            # Key missing or value changed - need to stop Jellyfin to safely update
            if [ -n "$existing_token" ]; then
              echo "API key '$API_KEY_NAME' value changed, updating..."
            else
              echo "Inserting API key '$API_KEY_NAME' into Jellyfin database..."
            fi
            systemctl stop ${cfg.jellyfinService}

            sleep 5

            sqlite3 -bail "$DB" <<SQL
            BEGIN IMMEDIATE;
            UPDATE ApiKeys SET AccessToken='$API_KEY', DateLastActivity=datetime('now') WHERE Name='$API_KEY_NAME';
            INSERT INTO ApiKeys (AccessToken, Name, DateCreated, DateLastActivity)
            SELECT '$API_KEY', '$API_KEY_NAME', datetime('now'), datetime('now')
            WHERE NOT EXISTS (SELECT 1 FROM ApiKeys WHERE Name='$API_KEY_NAME');
            COMMIT;
            SQL

            systemctl start ${cfg.jellyfinService}
            echo "API key configured, Jellyfin restarted"
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
