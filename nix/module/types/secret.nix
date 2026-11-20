{lib}: let
  inherit (lib) types;

  # not a submodule: the module system reserves `_file` there
  fileRef =
    types.addCheck types.attrs (v: builtins.attrNames v == ["_file"] && builtins.isString v._file)
    // {
      description = "{ _file = \"/path\"; } reference (the path must be a string)";
    };
in {
  inherit fileRef;
  str = types.either types.str fileRef;
}
