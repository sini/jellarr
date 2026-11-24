import { describe, it, expect, vi, type Mock } from "vitest";
import {
  applyDeviceNames,
  calculateDeviceNameChanges,
  readDeviceOptions,
} from "../../src/apply/devices";
import { DeviceConfigListType } from "../../src/types/config/devices";
import type { JellyfinClient } from "../../src/api/jellyfin.types";

const warn: Mock = vi.hoisted(() => vi.fn());
vi.mock("../../src/lib/logger", () => ({
  logger: { info: vi.fn(), warn, error: vi.fn() },
}));

function server(known: Record<string, string | null>): {
  client: JellyfinClient;
  update: Mock;
} {
  const update: Mock = vi.fn().mockResolvedValue(undefined);
  return {
    client: {
      getDeviceOptions: vi
        .fn()
        .mockImplementation((id: string) =>
          Promise.resolve(
            id in known ? { DeviceId: id, CustomName: known[id] } : undefined,
          ),
        ),
      updateDeviceOptions: update,
    } as unknown as JellyfinClient,
    update,
  };
}

describe("device names", () => {
  it("whenTheNameDiffers_thenItIsChangedOnce", async () => {
    const { client, update }: ReturnType<typeof server> = server({ d1: "Old" });
    const desired: Array<{ id: string; customName: string | null }> = [
      { id: "d1", customName: "Living room" },
    ];
    const changes: ReturnType<typeof calculateDeviceNameChanges> =
      calculateDeviceNameChanges(
        await readDeviceOptions(client, desired),
        desired,
      );
    expect(changes).toEqual([{ id: "d1", from: "Old", to: "Living room" }]);
    await applyDeviceNames(client, changes);
    expect(update).toHaveBeenCalledWith("d1", {
      DeviceId: "d1",
      CustomName: "Living room",
    });
  });

  it("whenAlreadyNamed_thenNothingChanges", async () => {
    const { client }: ReturnType<typeof server> = server({ d1: "Living room" });
    const desired: Array<{ id: string; customName: string | null }> = [
      { id: "d1", customName: "Living room" },
    ];
    expect(
      calculateDeviceNameChanges(
        await readDeviceOptions(client, desired),
        desired,
      ),
    ).toBeUndefined();
  });

  it("whenNullIsDeclaredOverAName_thenTheNameIsCleared", async () => {
    const { client }: ReturnType<typeof server> = server({ d1: "Old" });
    const desired: Array<{ id: string; customName: string | null }> = [
      { id: "d1", customName: null },
    ];
    expect(
      calculateDeviceNameChanges(
        await readDeviceOptions(client, desired),
        desired,
      ),
    ).toEqual([{ id: "d1", from: "Old", to: null }]);
  });

  it("whenNullIsDeclaredOverNoName_thenNothingChanges", async () => {
    const { client }: ReturnType<typeof server> = server({ d1: null });
    const desired: Array<{ id: string; customName: string | null }> = [
      { id: "d1", customName: null },
    ];
    expect(
      calculateDeviceNameChanges(
        await readDeviceOptions(client, desired),
        desired,
      ),
    ).toBeUndefined();
  });

  it("whenTheDeviceIsUnknown_thenItIsSkippedWithAWarning", async () => {
    const { client }: ReturnType<typeof server> = server({});
    const desired: Array<{ id: string; customName: string | null }> = [
      { id: "ghost", customName: "X" },
    ];
    const current: Awaited<ReturnType<typeof readDeviceOptions>> =
      await readDeviceOptions(client, desired);
    expect(calculateDeviceNameChanges(current, desired)).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("ghost"));
  });

  it("whenAnIdIsDeclaredTwice_thenTheConfigIsRejected", () => {
    expect(
      DeviceConfigListType.safeParse([
        { id: "a", customName: "x" },
        { id: "a", customName: "y" },
      ]).success,
    ).toBe(false);
    expect(
      DeviceConfigListType.safeParse([{ id: "a", customName: "x" }]).success,
    ).toBe(true);
  });
});
