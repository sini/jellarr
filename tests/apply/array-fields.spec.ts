import { describe, it, expect, vi } from "vitest";
import { calculateSystemDiff } from "../../src/apply/system";
import { calculateEncodingDiff } from "../../src/apply/encoding-options";
import { calculateNetworkingDiff } from "../../src/apply/networking";
import { calculateLibraryDiff } from "../../src/apply/library";
import {
  calculateUserPolicyDiff,
  calculateUserConfigurationsDiff,
} from "../../src/apply/users";

vi.mock("../../src/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

type Item = string | number | Record<string, unknown>;
/** Returns the array the module would write, or undefined when it writes nothing. */
type Run = (current: Item[], desired: Item[]) => Item[] | undefined;

const strings: Record<string, [Item[], Item[]]> = {
  shrink: [["a", "b"], ["a"]],
  empty: [["a", "b"], []],
  "middle removal": [
    ["a", "b", "c"],
    ["a", "c"],
  ],
  grow: [["a"], ["a", "b"]],
  reorder: [
    ["a", "b", "c"],
    ["c", "a", "b"],
  ],
  "swap one element": [
    ["a", "b"],
    ["a", "z"],
  ],
};

function battery(
  name: string,
  run: Run,
  cases: Record<string, [Item[], Item[]]> = strings,
  expected: (desired: Item[]) => Item[] = (desired: Item[]) => desired,
): void {
  describe(name, () => {
    for (const [label, [current, desired]] of Object.entries(cases)) {
      it(`${label} lands exactly`, () => {
        expect(run(structuredClone(current), structuredClone(desired))).toEqual(
          expected(desired),
        );
      });
    }
    it("identical is no change", () => {
      const same: Item[] = cases.shrink[0];
      expect(run(structuredClone(same), structuredClone(same))).toBeUndefined();
    });
  });
}

const nums: Record<string, [Item[], Item[]]> = {
  shrink: [[160, 320, 640], [160]],
  empty: [[160, 320], []],
  "middle removal": [
    [160, 320, 640],
    [160, 640],
  ],
  grow: [[160], [160, 320]],
  reorder: [
    [160, 320, 640],
    [640, 160, 320],
  ],
};

const repos: Record<string, [Item[], Item[]]> = ((): Record<
  string,
  [Item[], Item[]]
> => {
  const r: (n: string) => Item = (n: string) => ({
    Name: n,
    Url: `https://${n}`,
    Enabled: true,
  });
  return {
    shrink: [[r("a"), r("b")], [r("a")]],
    empty: [[r("a"), r("b")], []],
    "middle removal": [
      [r("a"), r("b"), r("c")],
      [r("a"), r("c")],
    ],
    grow: [[r("a")], [r("a"), r("b")]],
    reorder: [
      [r("a"), r("b"), r("c")],
      [r("c"), r("a"), r("b")],
    ],
  };
})();

describe("system arrays", () => {
  for (const [field, key] of [
    ["codecsUsed", "CodecsUsed"],
    ["corsHosts", "CorsHosts"],
    ["sortReplaceCharacters", "SortReplaceCharacters"],
    ["sortRemoveCharacters", "SortRemoveCharacters"],
    ["sortRemoveWords", "SortRemoveWords"],
  ] as const) {
    battery(
      key,
      (c: Item[], d: Item[]) =>
        (
          calculateSystemDiff(
            { [key]: c } as never,
            {
              [field]: d,
            } as never,
          ) as Record<string, Item[]> | undefined
        )?.[key],
    );
  }
  battery(
    "TrickplayOptions.WidthResolutions",
    (c: Item[], d: Item[]) =>
      (
        calculateSystemDiff(
          { TrickplayOptions: { WidthResolutions: c } } as never,
          { trickplayOptions: { widthResolutions: d } } as never,
        ) as { TrickplayOptions: { WidthResolutions: Item[] } } | undefined
      )?.TrickplayOptions.WidthResolutions,
    nums,
  );
  battery(
    "PluginRepositories (objects)",
    (c: Item[], d: Item[]) =>
      (
        calculateSystemDiff(
          { PluginRepositories: c } as never,
          {
            pluginRepositories: d.map((x: Item) => {
              const o: Record<string, unknown> = x as Record<string, unknown>;
              return { name: o.Name, url: o.Url, enabled: o.Enabled };
            }),
          } as never,
        ) as { PluginRepositories: Item[] } | undefined
      )?.PluginRepositories,
    repos,
  );
});

describe("encoding arrays", () => {
  for (const [field, key] of [
    ["hardwareDecodingCodecs", "HardwareDecodingCodecs"],
    [
      "allowOnDemandMetadataBasedKeyframeExtractionForExtensions",
      "AllowOnDemandMetadataBasedKeyframeExtractionForExtensions",
    ],
  ] as const) {
    battery(
      key,
      (c: Item[], d: Item[]) =>
        (
          calculateEncodingDiff(
            { [key]: c } as never,
            {
              [field]: d,
            } as never,
          ) as Record<string, Item[]> | undefined
        )?.[key],
    );
  }
});

describe("networking arrays", () => {
  for (const [field, key] of [
    ["localNetworkSubnets", "LocalNetworkSubnets"],
    ["localNetworkAddresses", "LocalNetworkAddresses"],
    ["knownProxies", "KnownProxies"],
    ["virtualInterfaceNames", "VirtualInterfaceNames"],
    ["publishedServerUriBySubnet", "PublishedServerUriBySubnet"],
    ["remoteIPFilter", "RemoteIPFilter"],
  ] as const) {
    battery(
      key,
      (c: Item[], d: Item[]) =>
        (
          calculateNetworkingDiff(
            { [key]: c } as never,
            {
              [field]: d,
            } as never,
          ) as Record<string, Item[]> | undefined
        )?.[key],
    );
  }
});

function libraryRun(
  field: string,
  schemaKey: string,
  wrap: (items: Item[]) => unknown = (items: Item[]) => items,
): Run {
  return (c: Item[], d: Item[]) => {
    const current: unknown[] = [
      {
        Name: "Movies",
        ItemId: "id1",
        CollectionType: "movies",
        LibraryOptions: {
          PathInfos: [{ Path: "/m" }],
          [schemaKey]: wrap(c),
        },
      },
    ];
    const desired: unknown[] = [
      {
        name: "Movies",
        collectionType: "movies",
        libraryOptions: { pathInfos: [{ path: "/m" }], [field]: d },
      },
    ];
    const result: ReturnType<typeof calculateLibraryDiff> =
      calculateLibraryDiff(current as never, desired as never);
    return (
      result?.toUpdate?.[0]?.libraryOptions as
        Record<string, Item[]> | undefined
    )?.[schemaKey];
  };
}

describe("library arrays", () => {
  for (const [field, key] of [
    ["metadataSavers", "MetadataSavers"],
    ["disabledLocalMetadataReaders", "DisabledLocalMetadataReaders"],
    ["localMetadataReaderOrder", "LocalMetadataReaderOrder"],
    ["disabledSubtitleFetchers", "DisabledSubtitleFetchers"],
    ["subtitleFetcherOrder", "SubtitleFetcherOrder"],
    ["disabledMediaSegmentProviders", "DisabledMediaSegmentProviders"],
    ["mediaSegmentProviderOrder", "MediaSegmentProviderOrder"],
    ["subtitleDownloadLanguages", "SubtitleDownloadLanguages"],
    ["disabledLyricFetchers", "DisabledLyricFetchers"],
    ["lyricFetcherOrder", "LyricFetcherOrder"],
    ["customTagDelimiters", "CustomTagDelimiters"],
    ["delimiterWhitelist", "DelimiterWhitelist"],
  ] as const) {
    battery(key, libraryRun(field, key));
  }

  const paths: Record<string, [Item[], Item[]]> = {
    shrink: [[{ Path: "/a" }, { Path: "/b" }], [{ Path: "/a" }]],
    "middle removal": [
      [{ Path: "/a" }, { Path: "/b" }, { Path: "/c" }],
      [{ Path: "/a" }, { Path: "/c" }],
    ],
    grow: [[{ Path: "/a" }], [{ Path: "/a" }, { Path: "/b" }]],
    reorder: [
      [{ Path: "/a" }, { Path: "/b" }],
      [{ Path: "/b" }, { Path: "/a" }],
    ],
  };
  describe("PathInfos (objects)", () => {
    for (const [label, [c, d]] of Object.entries(paths)) {
      it(`${label} lands exactly`, () => {
        const result: ReturnType<typeof calculateLibraryDiff> =
          calculateLibraryDiff(
            [
              {
                Name: "Movies",
                ItemId: "id1",
                CollectionType: "movies",
                LibraryOptions: { PathInfos: c },
              },
            ] as never,
            [
              {
                name: "Movies",
                collectionType: "movies",
                libraryOptions: {
                  pathInfos: d.map((x: Item) => ({
                    path: (x as { Path: string }).Path,
                  })),
                },
              },
            ] as never,
          );
        expect(result?.toUpdate?.[0]?.libraryOptions.PathInfos).toEqual(d);
      });
    }
  });

  describe("TypeOptions (objects with nested arrays; the config's own key case is sent as-is)", () => {
    const t: (type: string, m: string[], i: string[]) => Item = (
      type: string,
      m: string[],
      i: string[],
    ) => ({ type, metadataFetchers: m, imageFetchers: i });
    const cases: Record<string, [Item[], Item[]]> = {
      "nested fetcher shrink": [
        [t("Movie", ["a", "b"], ["x"])],
        [t("Movie", ["a"], ["x"])],
      ],
      "nested fetcher middle removal": [
        [t("Movie", ["a", "b", "c"], ["x"])],
        [t("Movie", ["a", "c"], ["x"])],
      ],
      "nested fetcher reorder": [
        [t("Movie", ["a", "b"], ["x"])],
        [t("Movie", ["b", "a"], ["x"])],
      ],
      "type removed": [
        [t("Movie", ["a"], ["x"]), t("Series", ["a"], ["x"])],
        [t("Movie", ["a"], ["x"])],
      ],
    };
    for (const [label, [c, d]] of Object.entries(cases)) {
      it(`${label} lands exactly`, () => {
        const result: ReturnType<typeof calculateLibraryDiff> =
          calculateLibraryDiff(
            [
              {
                Name: "Movies",
                ItemId: "id1",
                CollectionType: "movies",
                LibraryOptions: {
                  PathInfos: [{ Path: "/m" }],
                  TypeOptions: c,
                },
              },
            ] as never,
            [
              {
                name: "Movies",
                collectionType: "movies",
                libraryOptions: {
                  pathInfos: [{ path: "/m" }],
                  typeOptions: d,
                },
              },
            ] as never,
          );
        expect(result?.toUpdate?.[0]?.libraryOptions.TypeOptions).toEqual(d);
      });
    }
  });
});

describe("user arrays", () => {
  for (const [field, key] of [
    ["allowedTags", "AllowedTags"],
    ["blockedTags", "BlockedTags"],
  ] as const) {
    battery(
      `policy ${key}`,
      (c: Item[], d: Item[]) =>
        (
          calculateUserPolicyDiff(
            { [key]: c } as never,
            {
              [field]: d,
            } as never,
          ) as Record<string, Item[]> | undefined
        )?.[key],
    );
  }

  const folders: Map<string, string> = new Map([
    ["a", "1"],
    ["b", "2"],
    ["c", "3"],
  ]);
  const ids: (items: Item[]) => Item[] = (items: Item[]) =>
    items.map((x: Item) => folders.get(x as string) as string);
  const idCases: Record<string, [Item[], Item[]]> = {};
  for (const [label, [c, d]] of Object.entries(strings)) {
    if (!d.includes("z")) idCases[label] = [c, d];
  }
  const enabledCases: Record<string, [Item[], Item[]]> = { ...idCases };
  // NOTE: enabledLibraries: [] is deliberately ignored (see mappers/users tests), so it is not a clearing case.
  delete enabledCases.empty;
  battery(
    "policy EnabledFolders",
    (c: Item[], d: Item[]) =>
      (
        calculateUserPolicyDiff(
          { EnableAllFolders: false, EnabledFolders: ids(c) } as never,
          { enabledLibraries: d } as never,
          folders,
        ) as { EnabledFolders: Item[] } | undefined
      )?.EnabledFolders,
    enabledCases,
    ids,
  );
  battery(
    "configuration OrderedViews",
    (c: Item[], d: Item[]) =>
      calculateUserConfigurationsDiff(
        [
          {
            Name: "u",
            Id: "uid",
            Configuration: { OrderedViews: ids(c) },
          },
        ] as never,
        [{ name: "u", password: "p", orderedLibraries: d }] as never,
        [
          { Name: "a", ItemId: "1" },
          { Name: "b", ItemId: "2" },
          { Name: "c", ItemId: "3" },
        ] as never,
      )?.get("uid")?.OrderedViews as Item[] | undefined,
    idCases,
    ids,
  );
});
