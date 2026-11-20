{pkgs}: let
  tests = ["sanity" "switch-apply"];
in
  builtins.listToAttrs (map (name: {
      inherit name;
      value = import ./${name}.nix {inherit pkgs;};
    })
    tests)
