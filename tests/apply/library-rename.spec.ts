import { describe, it, expect, vi, type Mock } from "vitest";
import {
  applyLibraryRenames,
  calculateLibraryRenames,
  renameInMemory,
  waitForRenamedLibraries,
} from "../../src/apply/library-rename";
import {
  LibraryConfigType,
  type VirtualFolderConfig,
} from "../../src/types/config/library";
import type { JellyfinClient } from "../../src/api/jellyfin.types";
import type { VirtualFolderInfoSchema } from "../../src/types/schema/library";

vi.mock("../../src/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const folder: (name: string, renameFrom?: string) => VirtualFolderConfig = (
  name: string,
  renameFrom?: string,
): VirtualFolderConfig =>
  ({
    name,
    collectionType: "movies",
    libraryOptions: { pathInfos: [{ path: "/m" }] },
    ...(renameFrom ? { renameFrom } : {}),
  }) as VirtualFolderConfig;
const server: (...names: string[]) => VirtualFolderInfoSchema[] = (
  ...names: string[]
): VirtualFolderInfoSchema[] =>
  names.map((folderName: string): VirtualFolderInfoSchema => ({
    Name: folderName,
  }));

describe("library renameFrom", () => {
  it("whenOldExistsAndNewDoesNot_thenItIsRenamed", () => {
    expect(
      calculateLibraryRenames(server("Films"), [folder("Movies", "Films")]),
    ).toEqual([{ from: "Films", to: "Movies" }]);
  });

  it("whenAlreadyRenamed_thenItIsANoOp", () => {
    expect(
      calculateLibraryRenames(server("Movies"), [folder("Movies", "Films")]),
    ).toBeUndefined();
  });

  it("whenNeitherExists_thenItIsANoOpAndTheLibraryIsCreatedLater", () => {
    expect(
      calculateLibraryRenames(server("Shows"), [folder("Movies", "Films")]),
    ).toBeUndefined();
  });

  it("whenBothExist_thenItIsAnError", () => {
    expect(() =>
      calculateLibraryRenames(server("Films", "Movies"), [
        folder("Movies", "Films"),
      ]),
    ).toThrow(/both "Films" and "Movies" exist/);
  });

  it("whenNoRenameFromIsDeclared_thenNothingIsRenamed", () => {
    expect(
      calculateLibraryRenames(server("Films"), [folder("Movies")]),
    ).toBeUndefined();
  });

  it("whenRenamedInMemory_thenLaterPlanningSeesTheNewName", () => {
    expect(
      renameInMemory(server("Films", "Shows"), [
        { from: "Films", to: "Movies" },
      ]).map((f: VirtualFolderInfoSchema) => f.Name),
    ).toEqual(["Movies", "Shows"]);
  });

  it("whenApplied_thenEachRenameHitsTheClient", async () => {
    const renameVirtualFolder: Mock = vi.fn().mockResolvedValue(undefined);
    await applyLibraryRenames(
      { renameVirtualFolder } as unknown as JellyfinClient,
      [{ from: "Films", to: "Movies" }],
    );
    expect(renameVirtualFolder).toHaveBeenCalledWith("Films", "Movies");
  });

  it("whenTheRenamedLibraryIsStillIncomplete_thenItWaitsForIdAndOptions", async () => {
    const getVirtualFolders: Mock = vi
      .fn()
      .mockResolvedValueOnce([{ Name: "Movies" }])
      .mockResolvedValueOnce([
        { Name: "Movies", ItemId: "f1", LibraryOptions: {} },
      ]);
    const folders: VirtualFolderInfoSchema[] = await waitForRenamedLibraries(
      { getVirtualFolders } as unknown as JellyfinClient,
      [{ from: "Films", to: "Movies" }],
      1000,
      0,
    );
    expect(getVirtualFolders).toHaveBeenCalledTimes(2);
    expect(folders[0]?.ItemId).toBe("f1");
  });

  it("whenTheRenamedLibraryNeverCompletes_thenItTimesOut", async () => {
    const getVirtualFolders: Mock = vi
      .fn()
      .mockResolvedValue([{ Name: "Movies" }]);
    await expect(
      waitForRenamedLibraries(
        { getVirtualFolders } as unknown as JellyfinClient,
        [{ from: "Films", to: "Movies" }],
        0,
        0,
      ),
    ).rejects.toThrow(/did not finish re-creating the library/);
  });

  it("whenRenameFromEqualsNameOrCollides_thenTheConfigIsRejected", () => {
    const parse: (folders: VirtualFolderConfig[]) => boolean = (
      folders: VirtualFolderConfig[],
    ): boolean =>
      LibraryConfigType.safeParse({ virtualFolders: folders }).success;
    expect(parse([folder("Movies", "Movies")])).toBe(false);
    expect(parse([folder("Movies", "Films"), folder("Films")])).toBe(false);
    expect(parse([folder("Movies", "Films"), folder("Shows", "Films")])).toBe(
      false,
    );
    expect(parse([folder("Movies", "Films")])).toBe(true);
  });
});
