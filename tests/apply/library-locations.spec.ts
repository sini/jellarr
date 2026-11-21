import { describe, it, expect } from "vitest";
import {
  calculateLocationChanges,
  describeLocationChange,
  applyLocationChanges,
  type LocationChange,
} from "../../src/apply/library-locations";
import type { JellyfinClient } from "../../src/api/jellyfin.types";
import type { VirtualFolderConfig } from "../../src/types/config/library";
import type { VirtualFolderInfoSchema } from "../../src/types/schema/library";

function declared(
  paths: string[],
  extra: Partial<VirtualFolderConfig> = {},
): VirtualFolderConfig[] {
  return [
    {
      name: "Movies",
      collectionType: "movies",
      libraryOptions: { pathInfos: paths.map((path: string) => ({ path })) },
      ...extra,
    } as VirtualFolderConfig,
  ];
}

/** Behaves like Jellyfin 10.11: remove drops the first shortcut but every PathInfos entry; add always links. */
function fakeServer(locations: string[]): {
  client: JellyfinClient;
  folders: () => VirtualFolderInfoSchema[];
  calls: string[];
} {
  let links: string[] = [...locations];
  const calls: string[] = [];
  const client: JellyfinClient = {
    addMediaPath: (name: string, path: string): Promise<void> => {
      calls.push(`add ${path}`);
      links = [...links, path];
      return Promise.resolve();
    },
    removeMediaPath: (name: string, path: string): Promise<void> => {
      calls.push(`remove ${path}`);
      const i: number = links.indexOf(path);
      if (i >= 0) links.splice(i, 1);
      return Promise.resolve();
    },
  } as unknown as JellyfinClient;
  return {
    client,
    folders: (): VirtualFolderInfoSchema[] => [
      { Name: "Movies", Locations: [...links] },
    ],
    calls,
  };
}

describe("library locations", () => {
  it("finds nothing when every declared path is linked once", () => {
    expect(
      calculateLocationChanges(
        [{ Name: "Movies", Locations: ["/b", "/a"] }],
        declared(["/a", "/b"]),
      ),
    ).toEqual([]);
  });

  it("finds a stale location, a missing one and a duplicate", () => {
    const change: LocationChange = calculateLocationChanges(
      [{ Name: "Movies", Locations: ["/a", "/b", "/b"] }],
      declared(["/b", "/c"]),
    )[0];
    expect(change.add).toEqual(["/c"]);
    expect(change.relink).toEqual(["/b"]);
    expect(change.remove).toEqual(["/a"]);
    const lines: string = describeLocationChange(change).join("\n");
    expect(lines).toContain("would unlink /a");
    expect(lines).toContain("items leave the library");
    expect(lines).toContain("collapse 2 links of /b");
    expect(lines).toContain("would link /c");
  });

  it("leaves a library alone when pathInfos is ignored or the library is new", () => {
    const current: VirtualFolderInfoSchema[] = [
      { Name: "Movies", Locations: ["/a", "/a"] },
    ];
    expect(
      calculateLocationChanges(
        current,
        declared(["/b"], { ignoreChanges: ["pathInfos"] }),
      ),
    ).toEqual([]);
    expect(calculateLocationChanges([], declared(["/b"]))).toEqual([]);
  });

  it("converges in one run and a second run changes nothing", async () => {
    const server: ReturnType<typeof fakeServer> = fakeServer([
      "/a",
      "/b",
      "/b",
    ]);
    const cfg: VirtualFolderConfig[] = declared(["/b", "/c"]);

    await applyLocationChanges(
      server.client,
      calculateLocationChanges(server.folders(), cfg),
    );

    expect([...(server.folders()[0]?.Locations ?? [])].sort()).toEqual([
      "/b",
      "/c",
    ]);
    expect(calculateLocationChanges(server.folders(), cfg)).toEqual([]);
    expect(server.calls.filter((c: string) => c === "remove /b")).toHaveLength(
      2,
    );
  });
});
