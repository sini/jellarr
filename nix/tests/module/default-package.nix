# The flake module's default package must not depend on the consumer's
# nixpkgs: evaluate it against an older nixpkgs (nixos-25.11), where building
# nix/package.nix with that nixpkgs fails on fetcherVersion.
{
  nixpkgs,
  pkgs,
  system,
  module,
  expected,
  ...
}: let
  eval = mod:
    nixpkgs.lib.nixosSystem {
      inherit system;
      modules = [
        mod
        {
          services.jellarr = {
            enable = true;
            config = {
              version = 1;
              base_url = "http://localhost:8096";
            };
          };
          system.stateVersion = "26.05";
        }
      ];
    };

  viaFlake = (eval module).config.services.jellarr.package;
  viaPath = builtins.tryEval (eval ../../module).config.services.jellarr.package.drvPath;

  overridden =
    (eval {
      imports = [module];
      services.jellarr.package = pkgs.hello;
    }).config.services.jellarr.package;
in
  # control: the bare path still breaks on the old nixpkgs
  assert !viaPath.success;
  assert viaFlake.drvPath == expected.drvPath;
  assert overridden.drvPath == pkgs.hello.drvPath;
    pkgs.runCommand "jellarr-module-default-package" {} ''
      touch $out
    ''
