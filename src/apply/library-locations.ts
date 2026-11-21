import type { JellyfinClient } from "../api/jellyfin.types";
import type { VirtualFolderConfig } from "../types/config/library";
import type { VirtualFolderInfoSchema } from "../types/schema/library";

/**
 * Jellyfin scans a library's `.mblink` shortcut files, which
 * `VirtualFolderInfo.Locations` lists, not `LibraryOptions.PathInfos`. The two
 * can disagree: a stale shortcut, or the same folder linked twice.
 */
export interface LocationChange {
  name: string;
  /** Declared paths with no shortcut. */
  add: string[];
  /** Linked more than once: every shortcut is removed, then one is re-added. */
  relink: string[];
  /** Linked but not declared. */
  remove: string[];
  /** How many shortcuts each path to remove has. */
  copies: Map<string, number>;
}

export function calculateLocationChanges(
  current: VirtualFolderInfoSchema[],
  desired: VirtualFolderConfig[],
): LocationChange[] {
  const changes: LocationChange[] = [];
  for (const folder of desired) {
    if (folder.ignoreChanges?.includes("pathInfos")) continue;
    const existing: VirtualFolderInfoSchema | undefined = current.find(
      (candidate: VirtualFolderInfoSchema) => candidate.Name === folder.name,
    );
    // NOTE: a library that does not exist yet is created with its paths.
    if (!existing) continue;

    const wanted: string[] = [
      ...new Set(
        folder.libraryOptions.pathInfos.map(
          (info: { path: string }) => info.path,
        ),
      ),
    ];
    const copies: Map<string, number> = new Map();
    for (const location of existing.Locations ?? []) {
      copies.set(location, (copies.get(location) ?? 0) + 1);
    }

    const change: LocationChange = {
      name: folder.name,
      add: wanted.filter((path: string) => !copies.has(path)),
      relink: wanted.filter((path: string) => (copies.get(path) ?? 0) > 1),
      remove: [...copies.keys()].filter(
        (path: string) => !wanted.includes(path),
      ),
      copies,
    };
    if (change.add.length || change.relink.length || change.remove.length) {
      changes.push(change);
    }
  }
  return changes;
}

/** One plan line per add, removal and relink; removals say what they cost. */
export function describeLocationChange(change: LocationChange): string[] {
  return [
    ...change.add.map(
      (path: string) => `library ${change.name}: would link ${path}`,
    ),
    ...change.relink.map(
      (path: string) =>
        `library ${change.name}: would collapse ${(change.copies.get(path) ?? 0).toString()} links of ${path} into one`,
    ),
    ...change.remove.map(
      (path: string) =>
        `library ${change.name}: would unlink ${path}, which is not declared; its items leave the library on the next scan`,
    ),
  ];
}

export async function applyLocationChanges(
  client: JellyfinClient,
  changes: LocationChange[],
): Promise<void> {
  for (const change of changes) {
    for (const path of change.add) {
      await client.addMediaPath(change.name, path);
    }
    // NOTE: the server removes one shortcut per call but every PathInfos entry, so removal repeats per copy and the path is linked again once.
    for (const path of change.relink) {
      for (let i: number = 0; i < (change.copies.get(path) ?? 0); i++) {
        await client.removeMediaPath(change.name, path);
      }
      await client.addMediaPath(change.name, path);
    }
    for (const path of change.remove) {
      for (let i: number = 0; i < (change.copies.get(path) ?? 0); i++) {
        await client.removeMediaPath(change.name, path);
      }
    }
  }
}
