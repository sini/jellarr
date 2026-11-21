{
  nixpkgs,
  pkgs,
  system,
}: let
  eval = extra:
    nixpkgs.lib.nixosSystem {
      inherit system;
      modules = [
        ../../module
        {
          services.jellarr.enable = true;
          services.jellyfin.enable = true;
          system.stateVersion = "26.05";
        }
        extra
      ];
    };

  typed = eval {
    services.jellarr = {
      apiKeyFile = "/run/secrets/key";
      waitTimeout = 42;
      bootstrap.enable = true;
      config = {
        version = 1;
        base_url = "http://localhost:8096";
        networking.certificatePassword = {_file = "/run/secrets/cert";};
        users = [
          {
            name = "admin";
            password = {_file = "/run/secrets/pw2";};
          }
        ];
      };
    };
  };
  svc = typed.config.systemd.services.jellarr;
  rendered = builtins.head typed.config.systemd.timers.jellarr-apply.restartTriggers;

  withFile = eval {
    services.jellarr.configFile = "/etc/jellarr.yml";
  };
  both = eval {
    services.jellarr.configFile = "/etc/jellarr.yml";
    services.jellarr.config = {
      version = 1;
      base_url = "http://x";
    };
  };
  neither = eval {};
  renamed = eval {
    services.jellarr.bootstrap.jellyfinService = "jf.service";
    services.jellarr.config = {
      version = 1;
      base_url = "http://x";
    };
  };
  refAccepted = ref:
    (builtins.tryEval (builtins.deepSeq
      (eval {
        services.jellarr.config = {
          version = 1;
          base_url = "http://x";
          networking.certificatePassword = ref;
        };
      }).config.services.jellarr.config.networking.certificatePassword
      true)).success;
  pathAccepted = path:
    (builtins.tryEval (builtins.deepSeq
      (eval {
        services.jellarr.config = {
          version = 1;
          base_url = "http://x";
          users = [
            {
              name = "admin";
              passwordFile = path;
            }
          ];
        };
      }).config.services.jellarr.config.users
      true)).success;
  failing = e: builtins.filter (a: !a.assertion && nixpkgs.lib.hasInfix "jellarr" a.message) e.config.assertions != [];
in
  assert nixpkgs.lib.elem "jellyfin.service" svc.after;
  assert nixpkgs.lib.elem "jellyfin.service" svc.wants;
  assert svc.environment.JELLARR_WAIT_TIMEOUT == "42";
  assert svc.environment.JELLARR_API_KEY_FILE == "%d/api-key";
  assert svc.serviceConfig.LoadCredential == ["api-key:/run/secrets/key"];
  assert typed.config.services.jellarr.bootstrap.apiKeyFile == "/run/secrets/key";
  assert !(failing typed);
  assert !(failing withFile);
  assert failing both;
  assert failing neither;
  assert refAccepted {_file = "/run/secrets/ok";};
  assert !(refAccepted {
    _file = "/run/secrets/x";
    extra = "y";
  });
  assert !(refAccepted {_file = 1;});
  assert !(refAccepted {_file = /run/secrets/x;});
  assert pathAccepted "/run/secrets/pw";
  assert pathAccepted "\${CREDENTIALS_DIRECTORY}/admin";
  assert !(pathAccepted {_file = "/run/secrets/pw";});
  assert renamed.config.services.jellarr.jellyfinService == "jf.service";
    pkgs.runCommand "jellarr-module-options" {} ''
      grep -F '"certificatePassword":{"_file":"/run/secrets/cert"}' ${rendered}
      grep -F '"_file":"/run/secrets/pw2"' ${rendered}
      touch $out
    ''
