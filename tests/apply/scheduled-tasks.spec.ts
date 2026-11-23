import { describe, it, expect, vi } from "vitest";
import {
  calculateTaskTriggerChanges,
  applyTaskTriggerChanges,
} from "../../src/apply/scheduled-tasks";
import type { TaskInfoSchema } from "../../src/types/schema/scheduled-tasks";
import type { JellyfinClient } from "../../src/api/jellyfin.types";
import { TICKS_PER_SECOND } from "../../src/mappers/scheduled-tasks";

const tasks: TaskInfoSchema[] = [
  { Id: "t1", Key: "RefreshLibrary", Name: "Scan Media Library", Triggers: [] },
  {
    Id: "t2",
    Key: "CleanCache",
    Name: "Clean Cache Directory",
    Triggers: [
      { Type: "IntervalTrigger", IntervalTicks: 3600 * TICKS_PER_SECOND },
    ],
  },
];

describe("apply/scheduled-tasks", () => {
  it("replacesTheTriggerListOfADeclaredTask", () => {
    const changes: ReturnType<typeof calculateTaskTriggerChanges> =
      calculateTaskTriggerChanges(tasks, [
        { key: "RefreshLibrary", triggers: [{ type: "StartupTrigger" }] },
      ]);
    expect(changes).toMatchObject([
      { id: "t1", next: [{ Type: "StartupTrigger" }] },
    ]);
  });

  it("leavesUndeclaredTasksAlone", () => {
    expect(
      calculateTaskTriggerChanges(tasks, [
        { key: "RefreshLibrary", triggers: [{ type: "StartupTrigger" }] },
      ]).map((change: { id: string }) => change.id),
    ).toEqual(["t1"]);
  });

  it("whenTheSameConfigIsAppliedTwice_thenNothingChanges", () => {
    const desired: Parameters<typeof calculateTaskTriggerChanges>[1] = [
      {
        key: "CleanCache",
        triggers: [{ type: "IntervalTrigger", interval: "1h" }],
      },
    ];
    expect(calculateTaskTriggerChanges(tasks, desired)).toEqual([]);
  });

  it("whenAnEmptyListIsDeclared_thenTriggersAreCleared", () => {
    expect(
      calculateTaskTriggerChanges(tasks, [{ key: "CleanCache", triggers: [] }]),
    ).toMatchObject([{ id: "t2", next: [] }]);
  });

  it("fallsBackToTheNameWhenTheKeyIsAbsent", () => {
    expect(
      calculateTaskTriggerChanges(tasks, [
        { name: "Scan Media Library", triggers: [{ type: "StartupTrigger" }] },
      ]),
    ).toMatchObject([{ id: "t1" }]);
  });

  it("whenTheKeyIsUnknown_thenItListsTheValidKeys", () => {
    expect(() =>
      calculateTaskTriggerChanges(tasks, [{ key: "Nope", triggers: [] }]),
    ).toThrow(/key "Nope".*valid keys: CleanCache, RefreshLibrary/);
  });

  it("whenATaskIsDeclaredTwice_thenItFails", () => {
    expect(() =>
      calculateTaskTriggerChanges(tasks, [
        { key: "CleanCache", triggers: [] },
        { name: "Clean Cache Directory", triggers: [] },
      ]),
    ).toThrow(/more than once/);
  });

  it("postsTheTriggersToTheTask", async () => {
    const client: { updateTaskTriggers: ReturnType<typeof vi.fn> } = {
      updateTaskTriggers: vi.fn(),
    };
    await applyTaskTriggerChanges(client as unknown as JellyfinClient, [
      { id: "t1", label: "x", current: [], next: [{ Type: "StartupTrigger" }] },
    ]);
    expect(client.updateTaskTriggers).toHaveBeenCalledWith("t1", [
      { Type: "StartupTrigger" },
    ]);
  });
});
