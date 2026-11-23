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
      deleteDisabledAfter = null;
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
    deleteDisabledAfter = null;
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

  (assertEq "disable mode and deleteDisabledAfter pass through" (mkAuthoritativeConfig {
      users = "disable";
      deleteDisabledAfter = "30d";
      keep = null;
    }) {
      users = "disable";
      deleteDisabledAfter = "30d";
    })

  (assertEq "delete mode passes through" (mkAuthoritativeConfig {
      users = "delete";
      keep = null;
    }) {
      users = "delete";
    })

  (assertEq "usersScope passes through, single id or list" (mkAuthoritativeConfig {
      users = "disable";
      usersScope.authenticationProviderId = ["a" "b"];
      keep = null;
    }) {
      users = "disable";
      usersScope.authenticationProviderId = ["a" "b"];
    })
]
