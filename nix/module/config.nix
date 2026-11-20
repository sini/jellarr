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
  processedConfig = types.root.mkConfig cfg.config;
  configFile = pkgs.writeText "jellarr-config.yml" (pkgs.lib.generators.toYAML {} processedConfig);
in {
  config = lib.mkMerge [
    (lib.mkIf cfg.enable {
      systemd = {
        services.jellarr = {
          after =
            [
              "network-online.target"
              "systemd-tmpfiles-setup.service"
            ]
            ++ lib.optional bootstrapEnabled "jellarr-api-key-bootstrap.service";
          description = "Run jellarr (packaged) once";
          preStart =
            # sh
            ''
              install -D -m 0644 ${configFile} ${cfg.dataDir}/config/config.yml
              chown ${cfg.user}:${cfg.group} ${cfg.dataDir}/config/config.yml

              for i in $(seq 1 120); do
                ${pkgs.curl}/bin/curl -sf ${processedConfig.base_url}/System/Info/Public >/dev/null && exit 0
                sleep 1
              done

              echo "Jellyfin not running or not ready at ${processedConfig.base_url}"

              exit 1
            '';
          serviceConfig = {
            EnvironmentFile = lib.optional (cfg.environmentFile != null) cfg.environmentFile;
            ExecStart = lib.getExe cfg.package;
            Group = cfg.group;
            Type = "oneshot";
            User = cfg.user;
            WorkingDirectory = cfg.dataDir;
          };
          restartTriggers = [configFile];
          wants = ["network-online.target"];
          # Starting multi-user.target on switch runs the oneshot again; no RemainAfterExit, so the timer keeps re-running it.
          wantedBy = ["multi-user.target"];
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
          message = "services.jellarr.bootstrap.apiKeyFile must be set when bootstrap is enabled.";
        }
      ];

      systemd.services.jellarr-api-key-bootstrap = {
        after = [bootstrapCfg.jellyfinService];
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
            systemctl stop ${bootstrapCfg.jellyfinService}

            sleep 5

            sqlite3 -bail "$DB" <<SQL
            BEGIN IMMEDIATE;
            UPDATE ApiKeys SET AccessToken='$API_KEY', DateLastActivity=datetime('now') WHERE Name='$API_KEY_NAME';
            INSERT INTO ApiKeys (AccessToken, Name, DateCreated, DateLastActivity)
            SELECT '$API_KEY', '$API_KEY_NAME', datetime('now'), datetime('now')
            WHERE NOT EXISTS (SELECT 1 FROM ApiKeys WHERE Name='$API_KEY_NAME');
            COMMIT;
            SQL

            systemctl start ${bootstrapCfg.jellyfinService}
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
