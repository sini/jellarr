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
          byte with what the server serves and uploaded only when different.
          A plain path; `_file` references are not accepted. To go back to the
          default, use `removeSplashscreen` instead.
        '';
      };
      removeSplashscreen = mkOption {
        type = nullOr types.bool;
        default = null;
        description = ''
          Delete the custom splashscreen. The server serves the custom image only
          while the splashscreen is enabled, so removal happens only then (set
          `splashscreenEnabled = true` to have it applied); when disabled, nothing
          is done. Cannot be combined with `splashscreenFile`.
        '';
      };
    };
  };

  mkBrandingOptionsConfig = cfg:
    lib.throwIf ((cfg.removeSplashscreen or null) == true && (cfg.splashscreenFile or null) != null)
    "services.jellarr: branding.removeSplashscreen cannot be combined with branding.splashscreenFile"
    {}
    // optionalAttrs (cfg ? loginDisclaimer && cfg.loginDisclaimer != null) {inherit (cfg) loginDisclaimer;}
    // optionalAttrs (cfg ? customCss && cfg.customCss != null) {inherit (cfg) customCss;}
    // optionalAttrs (cfg ? splashscreenEnabled && cfg.splashscreenEnabled != null) {inherit (cfg) splashscreenEnabled;}
    // optionalAttrs (cfg ? splashscreenFile && cfg.splashscreenFile != null) {splashscreenFile = toString cfg.splashscreenFile;}
    // optionalAttrs (cfg ? removeSplashscreen && cfg.removeSplashscreen != null) {inherit (cfg) removeSplashscreen;};
in {
  inherit brandingOptionsConfigType mkBrandingOptionsConfig;
}
