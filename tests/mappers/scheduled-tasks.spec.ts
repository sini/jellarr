import { describe, it, expect } from "vitest";
import {
  mapTriggerConfigToSchema,
  normalizeTrigger,
  parseDuration,
  triggerProblem,
  triggersEqual,
  dumpTaskTriggers,
  TICKS_PER_SECOND,
} from "../../src/mappers/scheduled-tasks";

describe("mappers/scheduled-tasks", () => {
  it("parsesDurations", () => {
    expect(parseDuration("6h")).toBe(6 * 3600 * TICKS_PER_SECOND);
    expect(parseDuration("1h30m")).toBe(5400 * TICKS_PER_SECOND);
    expect(parseDuration("2w")).toBe(14 * 86400 * TICKS_PER_SECOND);
    expect(parseDuration("2d")).toBe(172800 * TICKS_PER_SECOND);
    expect(parseDuration("45s")).toBe(45 * TICKS_PER_SECOND);
    expect(parseDuration("soon")).toBeUndefined();
    expect(parseDuration("0h")).toBeUndefined();
  });

  it("mapsFriendlyFormsToTicks", () => {
    expect(
      mapTriggerConfigToSchema({
        type: "WeeklyTrigger",
        dayOfWeek: "Sunday",
        timeOfDay: "03:30",
        maxRuntime: "2h",
      }),
    ).toEqual({
      Type: "WeeklyTrigger",
      DayOfWeek: "Sunday",
      TimeOfDayTicks: (3 * 3600 + 30 * 60) * TICKS_PER_SECOND,
      MaxRuntimeTicks: 7200 * TICKS_PER_SECOND,
    });
    expect(
      mapTriggerConfigToSchema({ type: "IntervalTrigger", interval: "6h" }),
    ).toEqual({
      Type: "IntervalTrigger",
      IntervalTicks: 21600 * TICKS_PER_SECOND,
    });
  });

  it("passesRawTicksThrough", () => {
    expect(
      mapTriggerConfigToSchema({ type: "DailyTrigger", timeOfDayTicks: 5 }),
    ).toEqual({ Type: "DailyTrigger", TimeOfDayTicks: 5 });
  });

  it("rejectsInconsistentTriggers", () => {
    expect(triggerProblem({ type: "DailyTrigger" })).toMatch(/needs timeOfDay/);
    expect(
      triggerProblem({
        type: "DailyTrigger",
        timeOfDay: "03:00",
        timeOfDayTicks: 1,
      }),
    ).toMatch(/not both/);
    expect(
      triggerProblem({ type: "WeeklyTrigger", timeOfDay: "03:00" }),
    ).toMatch(/dayOfWeek/);
    expect(triggerProblem({ type: "IntervalTrigger", interval: "x" })).toMatch(
      /not a duration/,
    );
    expect(triggerProblem({ type: "StartupTrigger", interval: "1h" })).toMatch(
      /takes no/,
    );
    expect(triggerProblem({ type: "StartupTrigger" })).toBeUndefined();
    expect(
      triggerProblem({ type: "IntervalTrigger", intervalTicks: 10 }),
    ).toBeUndefined();
  });

  it("normalisesServerNullsAndIrrelevantFields", () => {
    expect(
      normalizeTrigger({
        Type: "StartupTrigger",
        TimeOfDayTicks: 0,
        IntervalTicks: null,
        DayOfWeek: null,
        MaxRuntimeTicks: null,
      }),
    ).toEqual({ Type: "StartupTrigger" });
  });

  it("comparesIgnoringOrderAndNulls", () => {
    expect(
      triggersEqual(
        [
          { Type: "StartupTrigger", MaxRuntimeTicks: null },
          { Type: "DailyTrigger", TimeOfDayTicks: 9 },
        ],
        [
          { Type: "DailyTrigger", TimeOfDayTicks: 9 },
          { Type: "StartupTrigger" },
        ],
      ),
    ).toBe(true);
    expect(
      triggersEqual([{ Type: "DailyTrigger", TimeOfDayTicks: 9 }], []),
    ).toBe(false);
    expect(triggersEqual(null, [])).toBe(true);
  });

  it("dumpsTriggersInTickForm", () => {
    expect(
      dumpTaskTriggers({
        Key: "RefreshLibrary",
        Triggers: [
          { Type: "IntervalTrigger", IntervalTicks: 7, DayOfWeek: null },
        ],
      }),
    ).toEqual({
      key: "RefreshLibrary",
      triggers: [{ type: "IntervalTrigger", intervalTicks: 7 }],
    });
    expect(dumpTaskTriggers({ Name: "no key" })).toBeUndefined();
  });
});
