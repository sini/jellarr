{lib}: let
  secret = import ./secret.nix {inherit lib;};
  inherit (lib) types mkOption filterAttrs;
  inherit (types) nullOr;

  opt = type: description:
    mkOption {
      type = nullOr type;
      default = null;
      inherit description;
    };

  names = types.listOf secret.str;

  keepType = types.submodule {
    options = {
      users = opt names "User names to spare.";
      libraries = opt names "Library names to spare.";
      plugins = opt names "Plugin names to spare.";
      apiKeys = opt names "API key names (AppName) to spare.";
    };
  };

  authoritativeConfigType = types.submodule {
    options = {
      users = opt (types.either types.bool (types.enum ["delete" "disable"])) ''
        What to do with users the config does not declare. `true` or `"delete"`
        deletes them; DESTRUCTIVE: a deleted user's watch history is lost.
        `"disable"` sets `Policy.IsDisabled` instead, keeping the account and its
        watch history, and records when jellarr did so in the user's display
        preferences; a disabled user who is kept again is re-enabled. Never
        touches the user jellarr signs in as or the last (enabled) administrator.
      '';
      libraries = opt names "Library names to spare.";
      plugins = opt names "Plugin names to spare.";
      apiKeys = opt names "API key names (AppName) to spare.";
    };
  };

  authoritativeConfigType = types.submodule {
    options = {
      users = opt types.bool ''
        Delete users the config does not declare. DESTRUCTIVE: a deleted user's
        watch history is lost. Never deletes the user jellarr signs in as or the
        last administrator.
      '';
      libraries = opt types.bool ''
        Delete libraries the config does not declare, after the Locations
        reconciliation. Files on disk are not touched; the library's items and
        their watch state leave the database.
      '';
      plugins = opt types.bool ''
        Uninstall plugins the config does not declare. Only plugins the server
        reports as removable (`CanUninstall`) are considered; bundled plugins are
        never touched. Jellyfin restarts to unload them.
      '';
      apiKeys = opt types.bool ''
        Revoke API keys the config does not declare. Never revokes the key jellarr
        is using.
      '';
      livetv = opt types.bool "Alias of `livetv.authoritative`; set only one of them.";
      keep = opt keepType "Entries to spare, matched by name.";
      allowMassDelete = opt types.bool ''
        A run that would delete (or, for users in disable mode, disable or
        delete) more than half of the entries of a kind is refused unless this
        is true.
      '';
      deleteDisabledAfter = opt types.str ''
        With `users = "disable"` only: delete a user jellarr disabled once it has
        been disabled for this long, a duration such as `30d`, `12h` or `2w`. Unset means disabled users are never deleted.
      '';
    };
  };

  dropNulls = filterAttrs (_: v: v != null);

  mkAuthoritativeConfig = cfg:
    dropNulls (cfg
      // {
        keep =
          if (cfg.keep or null) == null
          then null
          else dropNulls cfg.keep;
      });
in {
  inherit authoritativeConfigType mkAuthoritativeConfig;
}
