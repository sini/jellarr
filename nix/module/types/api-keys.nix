{lib}: let
  secret = import ./secret.nix {inherit lib;};
  inherit (lib) types mkOption;

  apiKeyConfigType = types.submodule {
    options = {
      name = mkOption {
        type = secret.str;
        description = "Name (AppName) of the API key to create.";
      };
    };
  };

  apiKeysConfigType = types.listOf apiKeyConfigType;

  mkApiKeysConfig = cfg: map (k: {inherit (k) name;}) cfg;
in {
  inherit apiKeysConfigType mkApiKeysConfig;
}
