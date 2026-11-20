{
  nixpkgs,
  pkgs,
  system,
}: let
  evaluated = nixpkgs.lib.nixosSystem {
    inherit system;
    modules = [
      ../../module
      {
        services.jellarr = {
          enable = true;
          bootstrap = {
            enable = true;
            apiKeyFile = "/etc/jellarr-api-key";
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
  inherit (evaluated.config.systemd) services;
  script = services.jellarr-api-key-bootstrap.script;
  has = nixpkgs.lib.hasInfix;
in
  assert has "pragma_table_info('ApiKeys')" script;
  assert has "exit 1" script;
  assert has "sqlite3 -bail" script;
  assert has "UPDATE ApiKeys SET AccessToken" script;
  assert has "WHERE NOT EXISTS" script;
  assert !(has "DELETE FROM ApiKeys" script);
    pkgs.runCommand "jellarr-module-bootstrap" {} ''
      touch $out
    ''
