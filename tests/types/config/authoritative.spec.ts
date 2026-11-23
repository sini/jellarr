import { describe, it, expect } from "vitest";
import type { ZodSafeParseResult } from "zod";
import { RootConfigType } from "../../../src/types/config/root";

const base: { version: number; base_url: string; system: object } = {
  version: 1,
  base_url: "http://localhost:8096",
  system: {},
};

function parse(extra: object): ZodSafeParseResult<unknown> {
  return RootConfigType.safeParse({ ...base, ...extra });
}

function messages(result: ZodSafeParseResult<unknown>): string {
  return result.success
    ? ""
    : result.error.issues
        .map((issue: { message: string }) => issue.message)
        .join("|");
}

describe("config/authoritative", () => {
  it("acceptsEveryFlagAndKeepList", () => {
    expect(
      parse({
        authoritative: {
          users: true,
          libraries: false,
          plugins: true,
          apiKeys: true,
          livetv: true,
          allowMassDelete: false,
          keep: {
            users: ["a"],
            libraries: ["b"],
            plugins: ["c"],
            apiKeys: ["d"],
          },
        },
      }).success,
    ).toBe(true);
  });

  it("rejectsUnknownKeys", () => {
    expect(parse({ authoritative: { user: true } }).success).toBe(false);
    expect(parse({ authoritative: { keep: { tasks: [] } } }).success).toBe(
      false,
    );
    expect(parse({ authoritative: { users: "yes" } }).success).toBe(false);
  });

  it("acceptsTheLiveTvAliasAndRejectsADisagreement", () => {
    expect(parse({ livetv: {}, authoritative: { livetv: true } }).success).toBe(
      true,
    );
    expect(
      parse({
        livetv: { authoritative: true },
        authoritative: { livetv: true },
      }).success,
    ).toBe(true);
    expect(
      messages(
        parse({
          livetv: { authoritative: true },
          authoritative: { livetv: false },
        }),
      ),
    ).toMatch(/alias of livetv\.authoritative/);
  });
});

describe("config/scheduledTasks", () => {
  it("acceptsKeyOrNameWithTriggers", () => {
    expect(
      parse({
        scheduledTasks: [
          {
            key: "RefreshLibrary",
            triggers: [
              { type: "DailyTrigger", timeOfDay: "03:30" },
              { type: "IntervalTrigger", interval: "6h", maxRuntime: "2h" },
              { type: "WeeklyTrigger", dayOfWeek: "Monday", timeOfDayTicks: 1 },
              { type: "StartupTrigger" },
            ],
          },
          { name: "Clean Cache Directory", triggers: [] },
        ],
      }).success,
    ).toBe(true);
  });

  it("rejectsATaskWithNeitherKeyNorName", () => {
    expect(messages(parse({ scheduledTasks: [{ triggers: [] }] }))).toMatch(
      /needs a key/,
    );
  });

  it("rejectsInconsistentTriggersAtValidationTime", () => {
    expect(
      messages(
        parse({
          scheduledTasks: [
            {
              key: "k",
              triggers: [{ type: "WeeklyTrigger", timeOfDay: "03:00" }],
            },
          ],
        }),
      ),
    ).toMatch(/needs timeOfDay and dayOfWeek/);
    expect(
      parse({
        scheduledTasks: [
          {
            key: "k",
            triggers: [{ type: "DailyTrigger", timeOfDay: "25:00" }],
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      parse({
        scheduledTasks: [{ key: "k", triggers: [{ type: "Bogus" }] }],
      }).success,
    ).toBe(false);
  });
});
