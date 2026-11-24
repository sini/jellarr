{
  lib,
  assertEq,
  assertThrows,
  ...
}: let
  inherit (import ../../../module/types/devices.nix {inherit lib;}) mkDevicesConfig;
in [
  (assertEq "devices keep id and name, and null clears" (mkDevicesConfig [
      {
        id = "d1";
        customName = "Living room";
      }
      {
        id = "d2";
        customName = null;
      }
    ]) [
      {
        id = "d1";
        customName = "Living room";
      }
      {
        id = "d2";
        customName = null;
      }
    ])

  (assertThrows "reject empty device id" (mkDevicesConfig [
    {
      id = "";
      customName = "x";
    }
  ]))
]
