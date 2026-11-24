import { describe, it, expect, vi } from "vitest";
import {
  applyPluginStates,
  calculatePluginStateChanges,
} from "../../src/apply/plugins";
import type { JellyfinClient } from "../../src/api/jellyfin.types";
import type { PluginInfoSchema } from "../../src/types/schema/plugins";
import { PluginConfigType } from "../../src/types/config/plugins";

vi.mock("../../src/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const GUID: string = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const copy: (status: string, version?: string) => PluginInfoSchema = (
  status: string,
  version: string = "5.1.1.0",
): PluginInfoSchema =>
  ({
    Name: "Example-Plugin",
    Id: GUID,
    Version: version,
    Status: status,
  }) as PluginInfoSchema;
const catalog: Array<{ name: string; guid: string; versions: [] }> = [
  { name: "Example Plugin", guid: GUID, versions: [] },
];

describe("plugin enabled flag", () => {
  it("whenEnabledFalseAndPluginActive_thenItIsDisabled", () => {
    const changes: ReturnType<typeof calculatePluginStateChanges> =
      calculatePluginStateChanges([copy("Active")], catalog, [
        { name: "Example Plugin", enabled: false },
      ]);
    expect(changes).toEqual([
      { name: "Example Plugin", id: GUID, version: "5.1.1.0", enable: false },
    ]);
  });

  it("whenEnabledTrueAndPluginDisabled_thenItIsEnabled", () => {
    const changes: ReturnType<typeof calculatePluginStateChanges> =
      calculatePluginStateChanges([copy("Disabled")], catalog, [
        { name: "Example Plugin", enabled: true },
      ]);
    expect(changes).toEqual([
      { name: "Example Plugin", id: GUID, version: "5.1.1.0", enable: true },
    ]);
  });

  it("whenStateAlreadyMatches_thenNothingChanges", () => {
    expect(
      calculatePluginStateChanges([copy("Disabled")], catalog, [
        { name: "Example Plugin", enabled: false },
      ]),
    ).toBeUndefined();
    expect(
      calculatePluginStateChanges([copy("Active")], catalog, [
        { name: "Example Plugin", enabled: true },
      ]),
    ).toBeUndefined();
  });

  it("whenEnabledIsUndeclared_thenStateIsLeftAlone", () => {
    expect(
      calculatePluginStateChanges([copy("Disabled")], catalog, [
        { name: "Example Plugin" },
      ]),
    ).toBeUndefined();
  });

  it("whenOlderCopyIsSuperseded_thenOnlyTheLiveCopyIsTouched", () => {
    const changes: ReturnType<typeof calculatePluginStateChanges> =
      calculatePluginStateChanges(
        [copy("Superseded", "5.0.0.0"), copy("Active", "5.1.1.0")],
        catalog,
        [{ name: "Example Plugin", enabled: false }],
      );
    expect(changes?.map((c: { version: string }) => c.version)).toEqual([
      "5.1.1.0",
    ]);
  });

  it("whenApplied_thenEnableAndDisableHitTheirEndpoints", async () => {
    const client: Pick<JellyfinClient, "enablePlugin" | "disablePlugin"> = {
      enablePlugin: vi.fn().mockResolvedValue(undefined),
      disablePlugin: vi.fn().mockResolvedValue(undefined),
    };
    await applyPluginStates(client as JellyfinClient, [
      { name: "A", id: "a", version: "1", enable: true },
      { name: "B", id: "b", version: "2", enable: false },
    ]);
    expect(client.enablePlugin).toHaveBeenCalledWith("a", "1");
    expect(client.disablePlugin).toHaveBeenCalledWith("b", "2");
  });

  it("whenSchemaParsed_thenEnabledMustBeBoolean", () => {
    expect(
      PluginConfigType.safeParse({ name: "x", enabled: false }).success,
    ).toBe(true);
    expect(
      PluginConfigType.safeParse({ name: "x", enabled: "no" }).success,
    ).toBe(false);
  });
});
