{
  lib,
  assertEq,
  ...
}: let
  types = import ../../../module/types {inherit lib;};
  inherit (types.livetv) mkLiveTvConfig;
in [
  (assertEq "unset fields are dropped, lists are cleaned entry by entry" (mkLiveTvConfig {
      guideDays = 7;
      recordingPath = null;
      authoritative = true;
      tunerHosts = [
        {
          type = "m3u";
          url = "http://tv.example/l.m3u";
          tunerCount = null;
        }
      ];
      listingProviders = [
        {
          type = "SchedulesDirect";
          username = "me";
          password = {_file = "/run/secrets/sd";};
          path = null;
        }
      ];
    }) {
      guideDays = 7;
      authoritative = true;
      tunerHosts = [
        {
          type = "m3u";
          url = "http://tv.example/l.m3u";
        }
      ];
      listingProviders = [
        {
          type = "SchedulesDirect";
          username = "me";
          password = {_file = "/run/secrets/sd";};
        }
      ];
    })

  (assertEq "an empty declared list is kept" (mkLiveTvConfig {
      tunerHosts = [];
      listingProviders = null;
    }) {
      tunerHosts = [];
    })
]
