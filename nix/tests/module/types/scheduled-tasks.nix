{
  lib,
  assertEq,
  assertThrows,
  ...
}: let
  types = import ../../../module/types {inherit lib;};
  inherit (types.scheduledTasks) mkScheduledTasksConfig scheduledTasksConfigType;
  check = value:
    lib.modules.evalModules {
      modules = [
        {
          options.tasks = lib.mkOption {type = scheduledTasksConfigType;};
          config.tasks = value;
        }
      ];
    };
in [
  (assertEq "empty list" (mkScheduledTasksConfig []) [])

  (assertEq "null fields are dropped per task and per trigger" (mkScheduledTasksConfig [
      {
        key = "RefreshLibrary";
        name = null;
        triggers = [
          {
            type = "DailyTrigger";
            timeOfDay = "03:30";
            timeOfDayTicks = null;
            interval = null;
            intervalTicks = null;
            dayOfWeek = null;
            maxRuntime = "2h";
            maxRuntimeTicks = null;
          }
          {
            type = "StartupTrigger";
            timeOfDay = null;
            timeOfDayTicks = null;
            interval = null;
            intervalTicks = null;
            dayOfWeek = null;
            maxRuntime = null;
            maxRuntimeTicks = null;
          }
        ];
      }
    ]) [
      {
        key = "RefreshLibrary";
        triggers = [
          {
            type = "DailyTrigger";
            timeOfDay = "03:30";
            maxRuntime = "2h";
          }
          {type = "StartupTrigger";}
        ];
      }
    ])

  (assertEq "an empty trigger list is kept, since it clears the triggers" (mkScheduledTasksConfig [
      {
        name = "Clean Cache Directory";
        key = null;
        triggers = [];
      }
    ]) [
      {
        name = "Clean Cache Directory";
        triggers = [];
      }
    ])

  (assertThrows "an unknown trigger type is rejected"
    (check [
      {
        key = "x";
        triggers = [{type = "HourlyTrigger";}];
      }
    ]).config.tasks)

  (assertThrows "an unknown day is rejected"
    (check [
      {
        key = "x";
        triggers = [
          {
            type = "WeeklyTrigger";
            dayOfWeek = "Funday";
          }
        ];
      }
    ]).config.tasks)
]
