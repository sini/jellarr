import { z } from "zod";

export const TRIGGER_TYPES: readonly [
  "DailyTrigger",
  "WeeklyTrigger",
  "IntervalTrigger",
  "StartupTrigger",
] = ["DailyTrigger", "WeeklyTrigger", "IntervalTrigger", "StartupTrigger"];

export const DAYS_OF_WEEK: readonly [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const TaskTriggerConfigType: z.ZodObject<{
  type: z.ZodEnum<{
    DailyTrigger: "DailyTrigger";
    WeeklyTrigger: "WeeklyTrigger";
    IntervalTrigger: "IntervalTrigger";
    StartupTrigger: "StartupTrigger";
  }>;
  timeOfDayTicks: z.ZodOptional<z.ZodNumber>;
  timeOfDay: z.ZodOptional<z.ZodString>;
  intervalTicks: z.ZodOptional<z.ZodNumber>;
  interval: z.ZodOptional<z.ZodString>;
  dayOfWeek: z.ZodOptional<
    z.ZodEnum<{
      Sunday: "Sunday";
      Monday: "Monday";
      Tuesday: "Tuesday";
      Wednesday: "Wednesday";
      Thursday: "Thursday";
      Friday: "Friday";
      Saturday: "Saturday";
    }>
  >;
  maxRuntimeTicks: z.ZodOptional<z.ZodNumber>;
  maxRuntime: z.ZodOptional<z.ZodString>;
}> = z
  .object({
    type: z.enum(TRIGGER_TYPES),
    timeOfDayTicks: z.number().int().nonnegative().optional(),
    timeOfDay: z
      .string()
      .regex(
        /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/,
        'timeOfDay must be "HH:MM" or "HH:MM:SS"',
      )
      .optional(),
    intervalTicks: z.number().int().positive().optional(),
    interval: z.string().optional(),
    dayOfWeek: z.enum(DAYS_OF_WEEK).optional(),
    maxRuntimeTicks: z.number().int().positive().optional(),
    maxRuntime: z.string().optional(),
  })
  .strict();

export type TaskTriggerConfig = z.infer<typeof TaskTriggerConfigType>;

export const ScheduledTaskConfigType: z.ZodObject<{
  key: z.ZodOptional<z.ZodString>;
  name: z.ZodOptional<z.ZodString>;
  triggers: z.ZodArray<typeof TaskTriggerConfigType>;
}> = z
  .object({
    key: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    triggers: z.array(TaskTriggerConfigType),
  })
  .strict();

export type ScheduledTaskConfig = z.infer<typeof ScheduledTaskConfigType>;

export const ScheduledTaskConfigListType: z.ZodArray<
  typeof ScheduledTaskConfigType
> = z.array(ScheduledTaskConfigType);
