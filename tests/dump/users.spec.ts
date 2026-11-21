import { describe, it, expect, vi, afterEach, type MockInstance } from "vitest";
import * as yaml from "yaml";

vi.mock("../../src/api/jellyfin_client", () => ({
  createJellyfinClient: (): object => ({
    getSystemConfiguration: () => Promise.resolve({}),
    getMetadataConfiguration: () => Promise.resolve({}),
    getEncodingConfiguration: () => Promise.resolve({}),
    getNetworkingConfiguration: () => Promise.resolve({}),
    getBrandingConfiguration: () => Promise.resolve({}),
    getPlugins: () => Promise.resolve([]),
    getApiKeys: () => Promise.resolve([]),
    getLiveTvOptions: () => Promise.resolve({}),
    getVirtualFolders: () =>
      Promise.resolve([
        { Name: "Movies", ItemId: "m1" },
        { Name: "Music", ItemId: "m2" },
      ]),
    getUsers: () =>
      Promise.resolve([
        {
          Name: "alex",
          Id: "u1",
          Policy: {
            IsHidden: true,
            MaxParentalRating: 7,
            SyncPlayAccess: "JoinGroups",
            BlockUnratedItems: ["Book"],
            EnabledChannels: [],
            BlockedTags: null,
            EnableContentDeletionFromFolders: ["m2"],
            AccessSchedules: [
              {
                Id: 3,
                UserId: "u1",
                DayOfWeek: "Weekend",
                StartHour: 8,
                EndHour: 22,
              },
            ],
            AuthenticationProviderId: "internal",
            InvalidLoginAttemptCount: 2,
          },
          Configuration: {
            HidePlayedInLatest: false,
            MyMediaExcludes: ["m1"],
            CastReceiverId: "recv",
          },
        },
      ]),
  }),
}));

import { runDump } from "../../src/dump";

describe("dump: users", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports the full policy and configuration with library names", async () => {
    process.env.JELLARR_API_KEY = "key";
    vi.spyOn(console, "error").mockImplementation((): void => undefined);
    const log: MockInstance<typeof console.log> = vi
      .spyOn(console, "log")
      .mockImplementation((): void => undefined);

    await runDump("http://localhost:8096");

    const dumped: { users: Array<Record<string, unknown>> } = yaml.parse(
      String(log.mock.calls[0]?.[0]),
    ) as { users: Array<Record<string, unknown>> };
    expect(dumped.users[0]).toEqual({
      name: "alex",
      policy: {
        isHidden: true,
        maxParentalRating: 7,
        syncPlayAccess: "JoinGroups",
        blockUnratedItems: ["Book"],
        enabledChannels: [],
        enableContentDeletionFromLibraries: ["Music"],
        accessSchedules: [{ dayOfWeek: "Weekend", startHour: 8, endHour: 22 }],
      },
      hidePlayedInLatest: false,
      myMediaExcludedLibraries: ["Movies"],
      castReceiverId: "recv",
    });
  });
});
