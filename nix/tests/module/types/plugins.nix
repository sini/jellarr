{
  lib,
  assertEq,
  assertThrows,
  ...
}: let
  types = import ../../../module/types {inherit lib;};
  inherit (types.plugins) mkPluginsConfig;
in [
  (assertEq "valid name only" (mkPluginsConfig [
      {
        name = "Trakt";
        configuration = null;
      }
    ]) [
      {name = "Trakt";}
    ])

  (assertEq "with configuration" (mkPluginsConfig [
      {
        name = "Trakt";
        configuration = {TraktUsers = [{ExtraLogging = true;}];};
      }
    ]) [
      {
        name = "Trakt";
        configuration = {TraktUsers = [{ExtraLogging = true;}];};
      }
    ])

  (assertEq "configuration with various types" (mkPluginsConfig [
      {
        name = "SomePlugin";
        configuration = {
          stringValue = "test";
          numberValue = 123;
          booleanValue = true;
          nestedObject = {key = "value";};
          arrayValue = [1 2 3];
        };
      }
    ]) [
      {
        name = "SomePlugin";
        configuration = {
          stringValue = "test";
          numberValue = 123;
          booleanValue = true;
          nestedObject = {key = "value";};
          arrayValue = [1 2 3];
        };
      }
    ])

  (assertEq "multiple plugins" (mkPluginsConfig [
      {
        name = "Trakt";
        configuration = null;
      }
      {
        name = "Playback Reporting";
        configuration = null;
      }
    ]) [
      {name = "Trakt";}
      {name = "Playback Reporting";}
    ])

  (assertEq "mixed with/without config" (mkPluginsConfig [
      {
        name = "Trakt";
        configuration = {TraktUsers = [{ExtraLogging = true;}];};
      }
      {
        name = "Playback Reporting";
        configuration = null;
      }
    ]) [
      {
        name = "Trakt";
        configuration = {TraktUsers = [{ExtraLogging = true;}];};
      }
      {name = "Playback Reporting";}
    ])

  (assertEq "with repository" (mkPluginsConfig [
      {
        name = "Trakt";
        repository = "Dev";
        configuration = null;
      }
    ]) [
      {
        name = "Trakt";
        repository = "Dev";
      }
    ])

  (assertEq "null repository omitted" (mkPluginsConfig [
      {
        name = "Trakt";
        repository = null;
        configuration = null;
      }
    ]) [
      {name = "Trakt";}
    ])

  (assertEq "enabled false kept" (mkPluginsConfig [
      {
        name = "Trakt";
        enabled = false;
        configuration = null;
      }
    ]) [
      {
        name = "Trakt";
        enabled = false;
      }
    ])

  (assertEq "enabled true kept" (mkPluginsConfig [
      {
        name = "Trakt";
        enabled = true;
        configuration = null;
      }
    ]) [
      {
        name = "Trakt";
        enabled = true;
      }
    ])

  (assertEq "null enabled omitted" (mkPluginsConfig [
      {
        name = "Trakt";
        enabled = null;
        configuration = null;
      }
    ]) [
      {name = "Trakt";}
    ])

  (assertThrows "reject empty name" (mkPluginsConfig [
    {
      name = "";
      configuration = null;
    }
  ]))

  (assertThrows "reject empty name in array" (mkPluginsConfig [
    {
      name = "Trakt";
      configuration = null;
    }
    {
      name = "";
      configuration = null;
    }
  ]))
]
