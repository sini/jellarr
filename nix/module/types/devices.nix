{lib}: let
  inherit (lib) types mkOption;

  deviceConfigType = types.submodule {
    options = {
      id = mkOption {
        type = types.str;
        description = ''
          Device id, the one the client connects with. It exists only after a
          client has connected once; until then jellarr warns and skips it.
        '';
      };
      customName = mkOption {
        type = types.nullOr types.str;
        description = "Name shown for the device. `null` clears the custom name.";
      };
    };
  };

  devicesConfigType = types.listOf deviceConfigType;

  mkDevicesConfig = cfg:
    map (device:
      assert device.id != "" || throw "Device id cannot be empty"; {
        inherit (device) id customName;
      })
    cfg;
in {
  inherit devicesConfigType mkDevicesConfig;
}
