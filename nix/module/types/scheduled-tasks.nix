{lib}: let
  secret = import ./secret.nix {inherit lib;};
  inherit (lib) types mkOption filterAttrs;
  inherit (types) nullOr;

  opt = type: description:
    mkOption {
      type = nullOr type;
      default = null;
      inherit description;
    };

  triggerConfigType = types.submodule {
    options = {
      type = mkOption {
        type = types.enum ["DailyTrigger" "WeeklyTrigger" "IntervalTrigger" "StartupTrigger"];
        description = "Trigger type.";
      };
      timeOfDay = opt secret.str ''Time of day as "HH:MM" or "HH:MM:SS", for daily and weekly triggers.'';
      timeOfDayTicks = opt types.int "Time of day in .NET ticks (100 ns); instead of `timeOfDay`.";
      interval = opt secret.str ''Interval such as "6h", "90m" or "1h30m", for interval triggers.'';
      intervalTicks = opt types.int "Interval in .NET ticks; instead of `interval`.";
      dayOfWeek = opt (types.enum ["Sunday" "Monday" "Tuesday" "Wednesday" "Thursday" "Friday" "Saturday"]) "Day of the week, for weekly triggers.";
      maxRuntime = opt secret.str ''Longest the task may run, such as "2h".'';
      maxRuntimeTicks = opt types.int "Longest runtime in .NET ticks; instead of `maxRuntime`.";
    };
  };

  scheduledTaskConfigType = types.submodule {
    options = {
      key = opt secret.str "Stable task key such as `RefreshLibrary` (preferred over `name`).";
      name = opt secret.str "Task display name, used when `key` is unset or unknown.";
      triggers = mkOption {
        type = types.listOf triggerConfigType;
        description = "The task's complete trigger list; it replaces the server's. An empty list clears the triggers.";
      };
    };
  };

  scheduledTasksConfigType = types.listOf scheduledTaskConfigType;

  dropNulls = filterAttrs (_: v: v != null);

  mkScheduledTasksConfig = cfg:
    map (task: dropNulls (task // {triggers = map dropNulls task.triggers;})) cfg;
in {
  inherit scheduledTasksConfigType mkScheduledTasksConfig;
}
