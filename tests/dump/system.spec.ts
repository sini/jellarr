import { describe, it, expect, vi, afterEach, type MockInstance } from "vitest";
import * as yaml from "yaml";

vi.mock("../../src/api/jellyfin_client", () => ({
  createJellyfinClient: (): object => ({
    getSystemConfiguration: () =>
      Promise.resolve({
        MetadataOptions: [
          { ItemType: "Movie", DisabledMetadataSavers: ["Nfo"] },
        ],
        ContentTypes: [{ Name: "/media/movies", Value: "movies" }],
        PathSubstitutions: [{ From: "/data", To: "/mnt/data" }],
        CastReceiverApplications: [{ Id: "ABC123", Name: "Stable" }],
      }),
    getMetadataConfiguration: () => Promise.resolve({}),
    getEncodingConfiguration: () => Promise.resolve({}),
    getNetworkingConfiguration: () => Promise.resolve({}),
    getBrandingConfiguration: () => Promise.resolve({}),
    getPlugins: () => Promise.resolve([]),
    getApiKeys: () => Promise.resolve([]),
    getLiveTvOptions: () => Promise.resolve({}),
    getScheduledTasks: () =>
      Promise.resolve([
        {
          Id: "t1",
          Key: "RefreshLibrary",
          Name: "Scan",
          Triggers: [
            {
              Type: "DailyTrigger",
              TimeOfDayTicks: 108000000000,
              MaxRuntimeTicks: null,
            },
          ],
        },
        { Id: "t2", Key: "CleanCache", Triggers: [] },
        { Id: "t3", Name: "keyless", Triggers: [] },
      ]),
    getVirtualFolders: () => Promise.resolve([]),
    getUsers: () => Promise.resolve([]),
  }),
}));

import { runDump } from "../../src/dump";

describe("dump: system arrays of objects", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports metadataOptions, contentTypes, pathSubstitutions and castReceiverApplications", async () => {
    process.env.JELLARR_API_KEY = "key";
    vi.spyOn(console, "error").mockImplementation((): void => undefined);
    const log: MockInstance<typeof console.log> = vi
      .spyOn(console, "log")
      .mockImplementation((): void => undefined);

    await runDump("http://localhost:8096");

    const dumped: { system: Record<string, unknown> } = yaml.parse(
      String(log.mock.calls[0]?.[0]),
    ) as { system: Record<string, unknown> };
    expect(dumped.system).toMatchObject({
      metadataOptions: [{ itemType: "Movie", disabledMetadataSavers: ["Nfo"] }],
      contentTypes: [{ name: "/media/movies", value: "movies" }],
      pathSubstitutions: [{ from: "/data", to: "/mnt/data" }],
      castReceiverApplications: [{ id: "ABC123", name: "Stable" }],
    });
  });

  it("exports every keyed task's current triggers", async () => {
    process.env.JELLARR_API_KEY = "key";
    vi.spyOn(console, "error").mockImplementation((): void => undefined);
    const log: MockInstance<typeof console.log> = vi
      .spyOn(console, "log")
      .mockImplementation((): void => undefined);

    await runDump("http://localhost:8096");

    const dumped: { scheduledTasks: unknown[] } = yaml.parse(
      String(log.mock.calls[0]?.[0]),
    ) as { scheduledTasks: unknown[] };
    expect(dumped.scheduledTasks).toEqual([
      {
        key: "RefreshLibrary",
        triggers: [{ type: "DailyTrigger", timeOfDayTicks: 108000000000 }],
      },
      { key: "CleanCache", triggers: [] },
    ]);
  });
});
