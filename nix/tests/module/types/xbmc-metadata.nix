{
  lib,
  assertEq,
  ...
}: let
  inherit (import ../../../module/types/xbmc-metadata.nix {inherit lib;}) mkXbmcMetadataConfig;

  nullConfig = {
    userId = null;
    releaseDateFormat = null;
    saveImagePathsInNfo = null;
    enablePathSubstitution = null;
    enableExtraThumbsDuplication = null;
  };
in [
  (assertEq "xbmcMetadata empty config" (mkXbmcMetadataConfig nullConfig) {})

  (assertEq "xbmcMetadata false is kept" (mkXbmcMetadataConfig (nullConfig // {saveImagePathsInNfo = false;})) {
    saveImagePathsInNfo = false;
  })

  (assertEq "xbmcMetadata every field" (mkXbmcMetadataConfig {
      userId = "u1";
      releaseDateFormat = "yyyy";
      saveImagePathsInNfo = true;
      enablePathSubstitution = false;
      enableExtraThumbsDuplication = true;
    }) {
      userId = "u1";
      releaseDateFormat = "yyyy";
      saveImagePathsInNfo = true;
      enablePathSubstitution = false;
      enableExtraThumbsDuplication = true;
    })
]
