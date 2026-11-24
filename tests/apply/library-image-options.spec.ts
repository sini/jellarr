import { describe, it, expect, vi } from "vitest";
import { calculateLibraryDiff } from "../../src/apply/library";
import { mapVirtualFolderConfigToSchema } from "../../src/mappers/library";
import { LibraryOptionsConfigType } from "../../src/types/config/library";
import type { VirtualFolderConfig } from "../../src/types/config/library";
import type { VirtualFolderInfoSchema } from "../../src/types/schema/library";

vi.mock("../../src/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const declared: (imageOptions?: unknown[]) => VirtualFolderConfig = (
  imageOptions?: unknown[],
): VirtualFolderConfig =>
  ({
    name: "Movies",
    collectionType: "movies",
    libraryOptions: {
      pathInfos: [{ path: "/m" }],
      typeOptions: [
        {
          type: "Movie",
          metadataFetchers: ["TheMovieDb"],
          imageFetchers: ["TheMovieDb"],
          ...(imageOptions ? { imageOptions } : {}),
        },
      ],
    },
  }) as VirtualFolderConfig;

const onServer: (imageOptions: unknown[]) => VirtualFolderInfoSchema[] = (
  imageOptions: unknown[],
): VirtualFolderInfoSchema[] =>
  [
    {
      Name: "Movies",
      ItemId: "f1",
      CollectionType: "movies",
      LibraryOptions: {
        PathInfos: [{ Path: "/m" }],
        TypeOptions: [
          {
            Type: "Movie",
            MetadataFetchers: ["TheMovieDb"],
            ImageFetchers: ["TheMovieDb"],
            ImageOptions: imageOptions,
          },
        ],
      },
    },
  ] as unknown as VirtualFolderInfoSchema[];

describe("library typeOptions imageOptions", () => {
  it("whenDeclared_thenEveryFieldIsMapped", () => {
    const mapped: Partial<VirtualFolderInfoSchema> =
      mapVirtualFolderConfigToSchema(
        declared([{ type: "Backdrop", limit: 2, minWidth: 1280 }]),
      );
    expect(mapped.LibraryOptions?.TypeOptions?.[0]?.ImageOptions).toEqual([
      { Type: "Backdrop", Limit: 2, MinWidth: 1280 },
    ]);
  });

  it("whenUndeclared_thenTheServersImageOptionsAreCarriedOver", () => {
    const server: VirtualFolderInfoSchema[] = onServer([
      { Type: "Primary", Limit: 1, MinWidth: 0 },
    ]);
    expect(calculateLibraryDiff(server, [declared()])).toBeUndefined();
  });

  it("whenDeclaredDiffer_thenTheListIsReplacedWhole", () => {
    const diff: ReturnType<typeof calculateLibraryDiff> = calculateLibraryDiff(
      onServer([
        { Type: "Primary", Limit: 1, MinWidth: 0 },
        { Type: "Logo", Limit: 1, MinWidth: 0 },
      ]),
      [declared([{ type: "Primary", limit: 3, minWidth: 0 }])],
    );
    expect(
      diff?.toUpdate?.[0]?.libraryOptions.TypeOptions?.[0]?.ImageOptions,
    ).toEqual([{ Type: "Primary", Limit: 3, MinWidth: 0 }]);
  });

  it("whenAlreadyApplied_thenNothingChanges", () => {
    expect(
      calculateLibraryDiff(
        onServer([{ Type: "Backdrop", Limit: 2, MinWidth: 1280 }]),
        [declared([{ type: "Backdrop", limit: 2, minWidth: 1280 }])],
      ),
    ).toBeUndefined();
  });

  it("whenDeclaredEmpty_thenTheServersListIsCleared", () => {
    const diff: ReturnType<typeof calculateLibraryDiff> = calculateLibraryDiff(
      onServer([{ Type: "Primary", Limit: 1, MinWidth: 0 }]),
      [declared([])],
    );
    expect(
      diff?.toUpdate?.[0]?.libraryOptions.TypeOptions?.[0]?.ImageOptions,
    ).toEqual([]);
  });

  it("whenTheTypeIsNotAnImageType_thenTheConfigIsRejected", () => {
    const base: object = { pathInfos: [{ path: "/m" }] };
    const parse: (type: string) => boolean = (type: string): boolean =>
      LibraryOptionsConfigType.safeParse({
        ...base,
        typeOptions: [
          {
            type: "Movie",
            metadataFetchers: [],
            imageFetchers: [],
            imageOptions: [{ type, limit: 1, minWidth: 0 }],
          },
        ],
      }).success;
    expect(parse("Backdrop")).toBe(true);
    expect(parse("Wallpaper")).toBe(false);
  });
});
