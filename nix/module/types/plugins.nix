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
          Version to install and hold the plugin at. When unset, the newest
          version compatible with the server is installed and kept up to date.
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
        // optionalAttrs (plugin.configuration != null) {inherit (plugin) configuration;})
    cfg;
in {
  inherit pluginsConfigType mkPluginsConfig;
}
