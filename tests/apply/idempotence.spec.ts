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
      { Other: 1 } as never,
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
      { Configuration: { Other: 1 } } as never,
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
      [folder({ PathInfos: [{ Path: "/old" }] })],
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
