import { describe, it, expect, vi } from "vitest";
import { calculateSystemDiff } from "../../src/apply/system";
import { calculateEncodingDiff } from "../../src/apply/encoding-options";
import { calculateNetworkingDiff } from "../../src/apply/networking";
import { calculateLibraryDiff } from "../../src/apply/library";
import { calculateBrandingOptionsDiff } from "../../src/apply/branding-options";
import { calculateMetadataDiff } from "../../src/apply/metadata";
import {
  calculateUserPolicyDiff,
  calculateUserConfigurationsDiff,
} from "../../src/apply/users";
import type { UserPolicySchema } from "../../src/types/schema/users";
import { calculatePluginConfigurationDiff } from "../../src/apply/plugins";

vi.mock("../../src/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

interface Pair {
  first: object | undefined;
  second: object | undefined;
}

/** Runs the diff, takes what it would write as the new server state, and diffs again. */
function twice(
  server: object,
  step: (state: never) => object | undefined,
): Pair {
  const first: object | undefined = step(structuredClone(server) as never);
  return {
    first,
    second:
      first === undefined ? undefined : step(structuredClone(first) as never),
  };
}

describe("a second run with an unchanged config changes nothing", () => {
  it("system", () => {
    const { first, second }: Pair = twice(
      { ServerName: "old", Server: "extra" } as never,
      (s: never): object | undefined =>
        calculateSystemDiff(s, {
          serverName: "new",
          codecsUsed: ["a", "b"],
          pluginRepositories: [{ name: "r", url: "https://r", enabled: true }],
          trickplayOptions: { widthResolutions: [320, 640] },
        } as never),
    );
    expect(first).toBeDefined();
    expect(second).toBeUndefined();
  });

  it("system: arrays of objects, against a server that adds fields to elements", () => {
    const desired: never = {
      metadataOptions: [
        { itemType: "Movie", imageFetcherOrder: ["TheMovieDb"] },
        { itemType: "Series" },
      ],
      contentTypes: [{ name: "/m", value: "movies" }],
      pathSubstitutions: [{ from: "/a", to: "/b" }],
      castReceiverApplications: [{ id: "A", name: "Stable" }],
    } as never;
    const server: object = {
      MetadataOptions: [
        {
          ItemType: "Movie",
          DisabledMetadataSavers: ["Nfo"],
          ImageFetcherOrder: ["Old"],
        },
        { ItemType: "Gone" },
      ],
      ContentTypes: [{ Name: "/m", Value: "movies", Extra: 1 }],
      PathSubstitutions: [{ From: "/a", To: "/old" }],
      CastReceiverApplications: [{ Id: "Z", Name: "Old" }],
    };
    const { first, second }: Pair = twice(
      server,
      (s: never): object | undefined => calculateSystemDiff(s, desired),
    );
    expect(first).toEqual({
      MetadataOptions: [
        {
          ItemType: "Movie",
          DisabledMetadataSavers: ["Nfo"],
          ImageFetcherOrder: ["TheMovieDb"],
        },
        { ItemType: "Series" },
      ],
      ContentTypes: [{ Name: "/m", Value: "movies", Extra: 1 }],
      PathSubstitutions: [{ From: "/a", To: "/b" }],
      CastReceiverApplications: [{ Id: "A", Name: "Stable" }],
    });
    expect(second).toBeUndefined();

    const empty: Pair = twice(
      { PathSubstitutions: [{ From: "/a", To: "/b" }] },
      (s: never): object | undefined =>
        calculateSystemDiff(s, { pathSubstitutions: [] } as never),
    );
    expect(empty.first).toEqual({ PathSubstitutions: [] });
    expect(empty.second).toBeUndefined();
  });

  it("encoding", () => {
    const { first, second }: Pair = twice(
      { EncoderPreset: "auto", Other: 1 } as never,
      (s: never): object | undefined =>
        calculateEncodingDiff(s, {
          encoderPreset: "slow",
          hardwareDecodingCodecs: ["h264", "hevc"],
        } as never),
    );
    expect(first).toBeDefined();
    expect(second).toBeUndefined();
  });

  it("networking", () => {
    const { first, second }: Pair = twice(
      { EnableUPnP: true, Other: 1 } as never,
      (s: never): object | undefined =>
        calculateNetworkingDiff(s, {
          enableUPnP: false,
          localNetworkSubnets: ["10.0.0.0/8", "192.168.0.0/16"],
        } as never),
    );
    expect(first).toBeDefined();
    expect(second).toBeUndefined();
  });

  it("branding", () => {
    const { first, second }: Pair = twice(
      { CustomCss: "" } as never,
      (s: never): object | undefined =>
        calculateBrandingOptionsDiff(s, {
          customCss: "a{}",
          splashscreenEnabled: true,
        } as never),
    );
    expect(first).toBeDefined();
    expect(second).toBeUndefined();
  });

  it("metadata", () => {
    const { first, second }: Pair = twice(
      { UseFileCreationTimeForDateAdded: false } as never,
      (s: never): object | undefined =>
        calculateMetadataDiff(s, { useFileCreationTimeForDateAdded: true }),
    );
    expect(first).toBeDefined();
    expect(second).toBeUndefined();
  });

  it("users: policy and configuration", () => {
    const folders: Map<string, string> = new Map([["Movies", "m1"]]);
    const policy: Pair = twice(
      {
        Other: 1,
        IsAdministrator: true,
        BlockedTags: [],
        EnabledFolders: [],
        EnableAllFolders: true,
      } as never,
      (s: never): object | undefined =>
        calculateUserPolicyDiff(
          s,
          {
            isAdministrator: false,
            blockedTags: ["x", "y"],
            enabledLibraries: ["Movies"],
          },
          folders,
        ),
    );
    expect(policy.first).toBeDefined();
    expect(policy.second).toBeUndefined();

    const configuration: Pair = twice(
      {
        Configuration: { Other: 1, OrderedViews: [], SubtitleMode: "Default" },
      } as never,
      (s: never): object | undefined => {
        const state: { Configuration: unknown } = s;
        const result: ReturnType<typeof calculateUserConfigurationsDiff> =
          calculateUserConfigurationsDiff(
            [
              { Name: "u", Id: "id", Configuration: state.Configuration },
            ] as never,
            [
              {
                name: "u",
                password: "p",
                orderedLibraries: ["Movies"],
                subtitleMode: "Always",
              },
            ],
            [{ Name: "Movies", ItemId: "m1" }] as never,
          );
        const next: unknown = result?.get("id");
        return next ? ({ Configuration: next } as never) : undefined;
      },
    );
    expect(configuration.first).toBeDefined();
    expect(configuration.second).toBeUndefined();
  });

  it("users: full policy and configuration, against a server that adds fields to schedules", () => {
    const folders: Map<string, string> = new Map([["Movies", "m1"]]);
    const policy: Pair = twice(
      {
        IsHidden: false,
        SyncPlayAccess: "CreateAndJoinGroups",
        BlockUnratedItems: [],
        EnableContentDeletionFromFolders: [],
        AccessSchedules: [
          {
            Id: 1,
            UserId: "u",
            DayOfWeek: "Everyday",
            StartHour: 1,
            EndHour: 2,
          },
        ],
      } as never,
      (s: never): object | undefined => {
        const state: UserPolicySchema = s;
        const next: UserPolicySchema | undefined = calculateUserPolicyDiff(
          state,
          {
            isHidden: true,
            syncPlayAccess: "JoinGroups",
            blockUnratedItems: ["Book"],
            enableContentDeletionFromLibraries: ["Movies"],
            accessSchedules: [
              { dayOfWeek: "Everyday", startHour: 1, endHour: 2 },
              { dayOfWeek: "Weekend", startHour: 8, endHour: 22 },
            ],
          },
          folders,
        );
        return next;
      },
    );
    expect(policy.first).toMatchObject({
      AccessSchedules: [
        { Id: 1, UserId: "u", DayOfWeek: "Everyday", StartHour: 1, EndHour: 2 },
        { DayOfWeek: "Weekend", StartHour: 8, EndHour: 22 },
      ],
    });
    expect(policy.second).toBeUndefined();

    const unchanged: UserPolicySchema | undefined = calculateUserPolicyDiff(
      {
        AccessSchedules: [
          {
            Id: 1,
            UserId: "u",
            DayOfWeek: "Everyday",
            StartHour: 1,
            EndHour: 2,
          },
        ],
      } as never,
      {
        accessSchedules: [{ dayOfWeek: "Everyday", startHour: 1, endHour: 2 }],
      },
    );
    expect(unchanged).toBeUndefined();

    const configuration: Pair = twice(
      {
        Configuration: {
          Other: 1,
          GroupedFolders: [],
          HidePlayedInLatest: false,
          CastReceiverId: null,
        },
      } as never,
      (s: never): object | undefined => {
        const state: { Configuration: unknown } = s;
        const result: ReturnType<typeof calculateUserConfigurationsDiff> =
          calculateUserConfigurationsDiff(
            [
              { Name: "u", Id: "id", Configuration: state.Configuration },
            ] as never,
            [
              {
                name: "u",
                password: "p",
                groupedLibraries: ["Movies"],
                hidePlayedInLatest: true,
                castReceiverId: "recv",
              },
            ],
            [{ Name: "Movies", ItemId: "m1" }] as never,
          );
        const next: unknown = result?.get("id");
        return next ? ({ Configuration: next } as never) : undefined;
      },
    );
    expect(configuration.first).toBeDefined();
    expect(configuration.second).toBeUndefined();
  });

  it("library, against a server that adds fields to nested elements", () => {
    const desired: never[] = [
      {
        name: "Movies",
        collectionType: "movies",
        libraryOptions: {
          pathInfos: [{ path: "/m" }],
          metadataSavers: ["Nfo"],
          typeOptions: [
            {
              type: "Movie",
              metadataFetchers: ["TheMovieDb"],
              imageFetchers: ["TheMovieDb"],
            },
          ],
        },
      },
    ] as never[];
    const folder: (options: unknown) => never = (options: unknown) =>
      ({
        Name: "Movies",
        ItemId: "m1",
        CollectionType: "movies",
        LibraryOptions: options,
      }) as never;

    const first: ReturnType<typeof calculateLibraryDiff> = calculateLibraryDiff(
      [
        folder({
          PathInfos: [{ Path: "/old" }],
          MetadataSavers: [],
          TypeOptions: [],
        }),
      ],
      desired,
    );
    expect(first?.toUpdate).toBeDefined();

    // NOTE: the server reads keys case-insensitively, stores PascalCase and adds its own fields to nested elements.
    const stored: Record<string, unknown> = structuredClone(
      first?.toUpdate?.[0]?.libraryOptions,
    ) as Record<string, unknown>;
    stored.TypeOptions = (
      stored.TypeOptions as Array<Record<string, unknown>>
    ).map((option: Record<string, unknown>) =>
      Object.fromEntries(
        Object.entries(option).map(([key, value]: [string, unknown]) => [
          key.charAt(0).toUpperCase() + key.slice(1),
          value,
        ]),
      ),
    );
    (stored.PathInfos as Array<Record<string, unknown>>)[0].NetworkPath = null;
    (stored.TypeOptions as Array<Record<string, unknown>>)[0].ImageOptions = [
      { Type: "Primary", Limit: 1, MinWidth: 0 },
    ];
    (
      stored.TypeOptions as Array<Record<string, unknown>>
    )[0].ImageFetcherOrder = null;

    expect(calculateLibraryDiff([folder(stored)], desired)).toBeUndefined();
  });

  it("plugins", () => {
    const { first, second }: Pair = twice(
      { Hand: "set", Providers: { primary: { Roles: ["a", "b"] } } } as never,
      (s: never): object | undefined =>
        calculatePluginConfigurationDiff(s, {
          Providers: { primary: { Roles: ["a"], Enabled: true } },
        }),
    );
    expect(first).toBeDefined();
    expect(second).toBeUndefined();
  });
});
