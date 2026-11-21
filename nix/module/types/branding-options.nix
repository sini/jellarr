{lib}: let
  secret = import ./secret.nix {inherit lib;};
  inherit (lib) types mkOption optionalAttrs;

  inherit (types) nullOr;

  brandingOptionsConfigType = types.submodule {
    options = {
      loginDisclaimer = mkOption {
        type = nullOr secret.str;
        default = null;
        description = "Custom login disclaimer text (supports HTML).";
      };
      customCss = mkOption {
        type = nullOr secret.str;
        default = null;
        description = "Custom CSS to apply to the Jellyfin web interface.";
      };
      splashscreenEnabled = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Enable or disable the splashscreen.";
      };
      splashscreenFile = mkOption {
        type = nullOr types.path;
        default = null;
        description = ''
          Image file to upload as the custom splashscreen. It is compared byte for
          byte with what the server serves and uploaded only when different. Removal
          is not supported: the API cannot say whether a custom image is set.
          A plain path; `_file` references are not accepted.
        '';
      };
    };
  };

  mkBrandingOptionsConfig = cfg:
    {}
    // optionalAttrs (cfg ? loginDisclaimer && cfg.loginDisclaimer != null) {inherit (cfg) loginDisclaimer;}
    // optionalAttrs (cfg ? customCss && cfg.customCss != null) {inherit (cfg) customCss;}
    // optionalAttrs (cfg ? splashscreenEnabled && cfg.splashscreenEnabled != null) {inherit (cfg) splashscreenEnabled;}
    // optionalAttrs (cfg ? splashscreenFile && cfg.splashscreenFile != null) {splashscreenFile = toString cfg.splashscreenFile;};
in {
  inherit brandingOptionsConfigType mkBrandingOptionsConfig;
}
