{
  description = "Jellarr flake";

  inputs = {
    flake-parts.url = "github:hercules-ci/flake-parts";
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    # checks only: supplies the Jellyfin 10.11 package for the VM tests
    nixpkgs-jellyfin-10_11.url = "github:NixOS/nixpkgs/nixos-25.11";
    systems.url = "github:nix-systems/default";
    treefmt-nix = {
      inputs.nixpkgs.follows = "nixpkgs";
      url = "github:numtide/treefmt-nix";
    };
  };

  outputs = {
    self,
    flake-parts,
    nixpkgs,
    treefmt-nix,
    ...
  } @ inputs:
    flake-parts.lib.mkFlake {inherit inputs;} {
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
      ];

      flake = {
        # The default package is the flake's own build, so a consumer's nixpkgs
        # (whose fetchPnpmDeps may not know our fetcherVersion) cannot break it.
        nixosModules.default = {
          lib,
          pkgs,
          ...
        }: {
          imports = [./nix/module];
          services.jellarr.package = lib.mkDefault self.packages.${pkgs.stdenv.hostPlatform.system}.default;
        };
      };

      perSystem = {system, ...}: let
        pkgs = nixpkgs.legacyPackages.${system};
        treefmtFormatEval = treefmt-nix.lib.evalModule pkgs ./nix/formatting/treefmt-format.nix;
        treefmtLintEval = treefmt-nix.lib.evalModule pkgs ./nix/formatting/treefmt-lint.nix;
      in {
        checks =
          {
            formatting = treefmtFormatEval.config.build.check inputs.self;
            linting = treefmtLintEval.config.build.check inputs.self;
            module-package-override = import ./nix/tests/module {
              inherit nixpkgs pkgs system;
            };
            module-types = import ./nix/tests/module/types {inherit pkgs;};
          }
          # NixOS evaluations need systemd, which only exists on Linux.
          // nixpkgs.lib.optionalAttrs pkgs.stdenv.hostPlatform.isLinux (
            {
              module-bootstrap = import ./nix/tests/module/bootstrap.nix {
                inherit nixpkgs pkgs system;
              };
              module-default-package = import ./nix/tests/module/default-package.nix {
                inherit pkgs system;
                inherit (inputs.nixpkgs-jellyfin-10_11) lib;
                nixpkgs = inputs.nixpkgs-jellyfin-10_11;
                module = inputs.self.nixosModules.default;
                expected = inputs.self.packages.${system}.default;
              };
              module-options = import ./nix/tests/module/options.nix {
                inherit nixpkgs pkgs system;
              };
              image-config = import ./nix/tests/image-config.nix {
                inherit pkgs;
                image = inputs.self.packages.${system}.docker-image;
                package = inputs.self.packages.${system}.default;
              };
            }
            // import ./nix/tests/integration {
              inherit pkgs;
              image = inputs.self.packages.${system}.docker-image;
              jellyfinPackages = {
                "10_11" = inputs.nixpkgs-jellyfin-10_11.legacyPackages.${system}.jellyfin;
                "12" = pkgs.jellyfin;
              };
            }
          );

        formatter = treefmtFormatEval.config.build.wrapper;

        packages = let
          package = pkgs.callPackage ./nix/package.nix {};
        in {
          default = package;

          docker-image = import ./nix/docker-image.nix {
            inherit package pkgs;
          };
        };
      };
    };
}
