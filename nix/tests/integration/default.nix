{
  pkgs,
  jellyfinPackages,
  image,
}: let
  jellyfinTests = ["sanity" "library-update" "gaps" "locations" "authority" "network-restart"];
  versionIndependent = ["switch-apply"];
  # the image does not depend on the Jellyfin version, so one version stands in
  imageTests = ["container"];
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
      value = import ./${name}.nix {
        inherit pkgs image;
        jellyfinPackage = jellyfinPackages."12";
      };
    })
    imageTests
    ++ map (name: {
      inherit name;
      value = import ./${name}.nix {inherit pkgs;};
    })
    versionIndependent
  )
