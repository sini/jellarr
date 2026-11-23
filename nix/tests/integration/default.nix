{
  pkgs,
  jellyfinPackages,
}: let
  jellyfinTests = ["sanity" "library-update" "gaps" "locations" "authority"];
  versionIndependent = ["switch-apply"];
in
  builtins.listToAttrs (
    builtins.concatMap (variant:
      map (name: {
        name = "${name}-jellyfin-${variant}";
        value = import ./${name}.nix {
          inherit pkgs;
          jellyfinPackage = jellyfinPackages.${variant};
        };
      })
      jellyfinTests)
    (builtins.attrNames jellyfinPackages)
    ++ map (name: {
      inherit name;
      value = import ./${name}.nix {inherit pkgs;};
    })
    versionIndependent
  )
