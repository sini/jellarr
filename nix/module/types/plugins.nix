{lib}: let
  secret = import ./secret.nix {inherit lib;};
  inherit (lib) types mkOption optionalAttrs;

  inherit (types) nullOr;

  pluginConfigType = types.submodule {
    options = {
      name = mkOption {
        type = secret.str;
        description = "Plugin name, as listed in the plugin catalog.";
      };
      version = mkOption {
        type = nullOr secret.str;
        default = null;
        description = ''
          Version to install and hold the plugin at, whatever `upgrade` says.
          When unset, the newest version compatible with the server is
          installed if the plugin is missing; an installed copy is left alone
          unless `upgrade` is true.
        '';
      };
      upgrade = mkOption {
        type = nullOr types.bool;
        default = null;
        description = ''
          Whether an installed plugin with no `version` is upgraded to the
          newest compatible version, with a Jellyfin restart. Unset means
          false: the plugin is installed when missing and never upgraded. A
          `version` pins that exact version and takes precedence.
        '';
      };
      repository = mkOption {
        type = nullOr secret.str;
        default = null;
        description = ''
          Name of a repository declared in `system.pluginRepositories`. When
          set, only versions from that repository are candidates and installs
          use it. When unset, versions from every repository are candidates.
        '';
      };
      enabled = mkOption {
        type = nullOr types.bool;
        default = null;
        description = ''
          Whether the plugin is enabled. When unset, the plugin's state is left
          alone. Jellyfin applies a change after a restart, which jellarr
          performs. The `configuration` of a plugin set to `false` is not
          applied, because a disabled plugin is not loaded.
        '';
      };
      configuration = mkOption {
        type = nullOr types.attrs;
        default = null;
        description = "Plugin configuration (arbitrary key-value pairs).";
      };
    };
  };

  pluginsConfigType = nullOr (types.listOf pluginConfigType);

  mkPluginsConfig = cfg:
    map (plugin:
      assert plugin.name != "" || throw "Plugin name cannot be empty";
        {}
        // {inherit (plugin) name;}
        // optionalAttrs (plugin ? version && plugin.version != null) {inherit (plugin) version;}
        // optionalAttrs (plugin ? repository && plugin.repository != null) {inherit (plugin) repository;}
        // optionalAttrs (plugin ? upgrade && plugin.upgrade != null) {inherit (plugin) upgrade;}
        // optionalAttrs (plugin ? enabled && plugin.enabled != null) {inherit (plugin) enabled;}
        // optionalAttrs (plugin.configuration != null) {inherit (plugin) configuration;})
    cfg;
in {
  inherit pluginsConfigType mkPluginsConfig;
}
