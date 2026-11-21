{
  nixpkgs,
  pkgs,
  system,
}: let
  evaluate = extraKeys:
    nixpkgs.lib.nixosSystem {
      inherit system;
      modules = [
        ../../module
        {
          services.jellarr = {
            enable = true;
            bootstrap = {
              enable = true;
              apiKeyFile = "/etc/jellarr-api-key";
              inherit extraKeys;
            };
            config = {
              version = 1;
              base_url = "http://localhost:8096";
            };
          };
          services.jellyfin.enable = true;
          system.stateVersion = "26.05";
        }
      ];
    };
  evaluated = evaluate {};
  withExtra = evaluate {
    "app-one" = "/etc/app-one-key";
    "app two" = "/etc/app-two-key";
  };
  clash = evaluate {jellarr = "/etc/other-key";};
  badName = evaluate {"x'; DROP TABLE ApiKeys; --" = "/etc/k";};
  inherit (evaluated.config.systemd) services;
  script = services.jellarr-api-key-bootstrap.script;
  extraScript = withExtra.config.systemd.services.jellarr-api-key-bootstrap.script;
  has = nixpkgs.lib.hasInfix;
  failing = e:
    builtins.filter (a: !a.assertion && has "services.jellarr" (toString a.message)) e.config.assertions;
  count = needle: text: builtins.length (builtins.filter (x: x == needle) (nixpkgs.lib.splitString "\n" text));
in
  assert has "pragma_table_info('ApiKeys')" script;
  assert has "exit 1" script;
  assert has "sqlite3 -bail" script;
  assert has "UPDATE ApiKeys SET AccessToken" script;
  assert has "WHERE NOT EXISTS" script;
  assert !(has "DELETE FROM ApiKeys" script);
  assert has "add_key jellarr /etc/jellarr-api-key" script;
  assert !(has "add_key app-one" script);
  assert has "add_key jellarr /etc/jellarr-api-key" extraScript;
  assert has "add_key app-one /etc/app-one-key" extraScript;
  assert has "add_key 'app two' /etc/app-two-key" extraScript;
  assert has "pragma_table_info('ApiKeys')" extraScript;
  assert has "A-Za-z0-9._~+/=-" extraScript;
  assert count "systemctl stop jellyfin.service" extraScript == 1;
  assert count "systemctl start jellyfin.service" extraScript == 1;
  assert !(has "DELETE FROM ApiKeys" extraScript);
  assert failing evaluated == [];
  assert failing withExtra == [];
  assert builtins.length (failing clash) == 1;
  assert has "extraKeys must not contain apiKeyName" (builtins.head (failing clash)).message;
  assert builtins.length (failing badName) == 1;
  assert services.jellarr.wantedBy == [];
  assert !services.jellarr.restartIfChanged;
  assert evaluated.config.systemd.timers.jellarr-apply.restartTriggers != [];
  assert !(services.jellarr.serviceConfig.RemainAfterExit or false);
  assert evaluated.config.systemd.timers.jellarr.wantedBy == ["timers.target"];
    pkgs.runCommand "jellarr-module-bootstrap" {} ''
      touch $out
    ''
