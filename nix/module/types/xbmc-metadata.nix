{lib}: let
  inherit (lib) types mkOption optionalAttrs;
  inherit (types) nullOr;

  xbmcMetadataConfigType = types.submodule {
    options = {
      userId = mkOption {
        type = nullOr types.str;
        default = null;
        description = ''
          Id of the Jellyfin user whose watched state is saved in NFO files.
        '';
      };
      releaseDateFormat = mkOption {
        type = nullOr types.str;
        default = null;
        description = "Date format used for release dates in NFO files.";
      };
      saveImagePathsInNfo = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Save image paths in NFO files.";
      };
      enablePathSubstitution = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Apply the server's path substitutions to paths in NFO files.";
      };
      enableExtraThumbsDuplication = mkOption {
        type = nullOr types.bool;
        default = null;
        description = "Copy extrafanart to extrathumbs when saving images.";
      };
    };
  };

  mkXbmcMetadataConfig = cfg:
    {}
    // optionalAttrs (cfg.userId != null) {inherit (cfg) userId;}
    // optionalAttrs (cfg.releaseDateFormat != null) {inherit (cfg) releaseDateFormat;}
    // optionalAttrs (cfg.saveImagePathsInNfo != null) {inherit (cfg) saveImagePathsInNfo;}
    // optionalAttrs (cfg.enablePathSubstitution != null) {inherit (cfg) enablePathSubstitution;}
    // optionalAttrs (cfg.enableExtraThumbsDuplication != null) {inherit (cfg) enableExtraThumbsDuplication;};
in {
  inherit xbmcMetadataConfigType mkXbmcMetadataConfig;
}
