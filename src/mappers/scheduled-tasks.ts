import { deepEqual } from "fast-equals";
import type {
  ScheduledTaskConfig,
  TaskTriggerConfig,
} from "../types/config/scheduled-tasks";
import type {
  TaskInfoSchema,
  TaskTriggerInfoSchema,
} from "../types/schema/scheduled-tasks";

/** .NET ticks: 100 ns units. */
export const TICKS_PER_SECOND: number = 10_000_000;

const UNIT_SECONDS: Record<string, number> = {
  w: 604_800,
  d: 86_400,
  h: 3_600,
  m: 60,
  s: 1,
};

/** "6h", "90m", "1h30m", "2d", "2w" or "45s" to ticks; undefined when malformed. */
export function parseDuration(text: string): number | undefined {
  const trimmed: string = text.trim().toLowerCase();
  if (!/^(\d+[wdhms])+$/.test(trimmed)) return undefined;
  let seconds: number = 0;
  for (const [, amount, unit] of trimmed.matchAll(/(\d+)([wdhms])/g)) {
    seconds += Number(amount) * (UNIT_SECONDS[unit] ?? 0);
  }
  return seconds > 0 ? seconds * TICKS_PER_SECOND : undefined;
}

function parseTimeOfDay(text: string): number {
  const [hours = 0, minutes = 0, seconds = 0]: number[] = text
    .split(":")
    .map(Number);
  return (hours * 3_600 + minutes * 60 + seconds) * TICKS_PER_SECOND;
}

/** Why a trigger declaration is unusable, or undefined when it is fine. */
export function triggerProblem(trigger: TaskTriggerConfig): string | undefined {
  const type: TaskTriggerConfig["type"] = trigger.type;
  if (trigger.timeOfDay !== undefined && trigger.timeOfDayTicks !== undefined) {
    return "set timeOfDay or timeOfDayTicks, not both";
  }
  if (trigger.interval !== undefined && trigger.intervalTicks !== undefined) {
    return "set interval or intervalTicks, not both";
  }
  if (
    trigger.maxRuntime !== undefined &&
    trigger.maxRuntimeTicks !== undefined
  ) {
    return "set maxRuntime or maxRuntimeTicks, not both";
  }
  if (trigger.interval !== undefined && !parseDuration(trigger.interval)) {
    return `interval "${trigger.interval}" is not a duration such as "6h", "90m" or "1h30m"`;
  }
  if (trigger.maxRuntime !== undefined && !parseDuration(trigger.maxRuntime)) {
    return `maxRuntime "${trigger.maxRuntime}" is not a duration such as "2h" or "90m"`;
  }
  const hasTime: boolean =
    trigger.timeOfDay !== undefined || trigger.timeOfDayTicks !== undefined;
  const hasInterval: boolean =
    trigger.interval !== undefined || trigger.intervalTicks !== undefined;
  const hasDay: boolean = trigger.dayOfWeek !== undefined;
  if (type === "DailyTrigger" && (!hasTime || hasInterval || hasDay)) {
    return "DailyTrigger needs timeOfDay (and no interval or dayOfWeek)";
  }
  if (type === "WeeklyTrigger" && (!hasTime || !hasDay || hasInterval)) {
    return "WeeklyTrigger needs timeOfDay and dayOfWeek (and no interval)";
  }
  if (type === "IntervalTrigger" && (!hasInterval || hasTime || hasDay)) {
    return "IntervalTrigger needs interval (and no timeOfDay or dayOfWeek)";
  }
  if (type === "StartupTrigger" && (hasTime || hasInterval || hasDay)) {
    return "StartupTrigger takes no timeOfDay, interval or dayOfWeek";
  }
  return undefined;
}

export function mapTriggerConfigToSchema(
  trigger: TaskTriggerConfig,
): TaskTriggerInfoSchema {
  const timeOfDay: number | undefined =
    trigger.timeOfDayTicks ??
    (trigger.timeOfDay !== undefined
      ? parseTimeOfDay(trigger.timeOfDay)
      : undefined);
  const interval: number | undefined =
    trigger.intervalTicks ??
    (trigger.interval !== undefined
      ? parseDuration(trigger.interval)
      : undefined);
  const maxRuntime: number | undefined =
    trigger.maxRuntimeTicks ??
    (trigger.maxRuntime !== undefined
      ? parseDuration(trigger.maxRuntime)
      : undefined);
  return {
    Type: trigger.type,
    ...(timeOfDay !== undefined ? { TimeOfDayTicks: timeOfDay } : {}),
    ...(interval !== undefined ? { IntervalTicks: interval } : {}),
    ...(trigger.dayOfWeek ? { DayOfWeek: trigger.dayOfWeek } : {}),
    ...(maxRuntime !== undefined ? { MaxRuntimeTicks: maxRuntime } : {}),
  };
}

/** Only the fields that mean something for the trigger's type, nulls dropped, so two spellings of one trigger compare equal. */
export function normalizeTrigger(
  trigger: TaskTriggerInfoSchema,
): TaskTriggerInfoSchema {
  const type: TaskTriggerInfoSchema["Type"] = trigger.Type;
  const time: number | null | undefined = trigger.TimeOfDayTicks;
  const interval: number | null | undefined = trigger.IntervalTicks;
  const day: TaskTriggerInfoSchema["DayOfWeek"] = trigger.DayOfWeek;
  const max: number | null | undefined = trigger.MaxRuntimeTicks;
  const timed: boolean = type === "DailyTrigger" || type === "WeeklyTrigger";
  return {
    ...(type ? { Type: type } : {}),
    ...(timed && time != null ? { TimeOfDayTicks: time } : {}),
    ...(type === "IntervalTrigger" && interval != null
      ? { IntervalTicks: interval }
      : {}),
    ...(type === "WeeklyTrigger" && day ? { DayOfWeek: day } : {}),
    ...(max != null ? { MaxRuntimeTicks: max } : {}),
  };
}

function sortedTriggers(
  triggers: TaskTriggerInfoSchema[] | null | undefined,
): string[] {
  return (triggers ?? [])
    .map((trigger: TaskTriggerInfoSchema) =>
      JSON.stringify(normalizeTrigger(trigger)),
    )
    .sort();
}

/** Order does not matter to the server, so it does not count as drift. */
export function triggersEqual(
  current: TaskTriggerInfoSchema[] | null | undefined,
  desired: TaskTriggerInfoSchema[],
): boolean {
  return deepEqual(sortedTriggers(current), sortedTriggers(desired));
}

export function dumpTaskTriggers(
  task: TaskInfoSchema,
): ScheduledTaskConfig | undefined {
  if (!task.Key) return undefined;
  return {
    key: task.Key,
    triggers: (task.Triggers ?? []).map(
      (trigger: TaskTriggerInfoSchema): TaskTriggerConfig => {
        const normal: TaskTriggerInfoSchema = normalizeTrigger(trigger);
        return {
          type: normal.Type as TaskTriggerConfig["type"],
          ...(normal.TimeOfDayTicks !== undefined &&
          normal.TimeOfDayTicks !== null
            ? { timeOfDayTicks: normal.TimeOfDayTicks }
            : {}),
          ...(normal.IntervalTicks !== undefined &&
          normal.IntervalTicks !== null
            ? { intervalTicks: normal.IntervalTicks }
            : {}),
          ...(normal.DayOfWeek ? { dayOfWeek: normal.DayOfWeek } : {}),
          ...(normal.MaxRuntimeTicks !== undefined &&
          normal.MaxRuntimeTicks !== null
            ? { maxRuntimeTicks: normal.MaxRuntimeTicks }
            : {}),
        };
      },
    ),
  };
}
