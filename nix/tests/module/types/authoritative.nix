{
  lib,
  assertEq,
  ...
}: let
  types = import ../../../module/types {inherit lib;};
  inherit (types.authoritative) mkAuthoritativeConfig;
in [
  (assertEq "unset flags and keep lists are dropped" (mkAuthoritativeConfig {
      users = true;
      libraries = null;
      plugins = null;
      apiKeys = false;
      livetv = null;
      allowMassDelete = null;
      keep = {
        users = ["admin"];
        libraries = null;
        plugins = null;
        apiKeys = ["jellarr"];
      };
    }) {
      users = true;
      apiKeys = false;
      keep = {
        users = ["admin"];
        apiKeys = ["jellarr"];
      };
    })

  (assertEq "everything null renders as an empty object" (mkAuthoritativeConfig {
    users = null;
    libraries = null;
    plugins = null;
    apiKeys = null;
    livetv = null;
    allowMassDelete = null;
    keep = null;
  }) {})

  (assertEq "allowMassDelete and the livetv alias pass through" (mkAuthoritativeConfig {
      livetv = true;
      allowMassDelete = true;
      keep = null;
    }) {
      livetv = true;
      allowMassDelete = true;
    })
]
