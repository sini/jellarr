import type { JellyfinClient } from "../api/jellyfin.types";
import { logger } from "../lib/logger";
import { say } from "../lib/mode";
import type { VirtualFolderConfig } from "../types/config/library";
import type { VirtualFolderInfoSchema } from "../types/schema/library";

export interface LibraryRename {
  from: string;
  to: string;
}

/**
 * A library declared with `renameFrom` is renamed when the old name exists
 * and the new one does not. When neither exists the library is created under
 * its new name later; when only the new one exists the rename already
 * happened. Both existing is an error, since jellarr cannot say which holds
 * the media.
 */
export function calculateLibraryRenames(
  current: VirtualFolderInfoSchema[],
  desired: VirtualFolderConfig[],
): LibraryRename[] | undefined {
  const names: Set<string> = new Set(
    current.flatMap((folder: VirtualFolderInfoSchema) =>
      folder.Name ? [folder.Name] : [],
    ),
  );
  const renames: LibraryRename[] = [];
  for (const folder of desired) {
    if (folder.renameFrom === undefined) continue;
    if (!names.has(folder.renameFrom)) continue;
    if (names.has(folder.name)) {
      throw new Error(
        `Cannot rename library: both "${folder.renameFrom}" and "${folder.name}" exist; remove one or drop renameFrom`,
      );
    }
    logger.info(
      say(
        `Renaming library ${folder.renameFrom} to ${folder.name}`,
        `Would rename library ${folder.renameFrom} to ${folder.name}`,
      ),
    );
    renames.push({ from: folder.renameFrom, to: folder.name });
  }
  return renames.length > 0 ? renames : undefined;
}

/** The server's folders as they will read after the renames. */
export function renameInMemory(
  current: VirtualFolderInfoSchema[],
  renames: LibraryRename[],
): VirtualFolderInfoSchema[] {
  return current.map(
    (folder: VirtualFolderInfoSchema): VirtualFolderInfoSchema => {
      const rename: LibraryRename | undefined = renames.find(
        (candidate: LibraryRename) => candidate.from === folder.Name,
      );
      return rename ? { ...folder, Name: rename.to } : folder;
    },
  );
}

/**
 * Jellyfin moves the library's folder on a rename but only re-creates its
 * library item (its id and options) in the library validation that
 * refreshLibrary starts in the background. Until then the renamed library is
 * listed without an id or options, so a reconciliation would see nothing to
 * compare. Waits until every renamed library is complete.
 */
export async function waitForRenamedLibraries(
  client: JellyfinClient,
  renames: LibraryRename[],
  timeoutMs: number,
  intervalMs: number = 1000,
): Promise<VirtualFolderInfoSchema[]> {
  const deadline: number = Date.now() + timeoutMs;
  for (;;) {
    const folders: VirtualFolderInfoSchema[] = await client.getVirtualFolders();
    const pending: string[] = renames
      .map((rename: LibraryRename) => rename.to)
      .filter(
        (name: string) =>
          !folders.some(
            (folder: VirtualFolderInfoSchema) =>
              folder.Name === name &&
              folder.LibraryOptions !== undefined &&
              (folder.ItemId ?? (folder as { Id?: string }).Id) !== undefined,
          ),
      );
    if (pending.length === 0) return folders;
    if (Date.now() >= deadline) {
      throw new Error(
        `Renamed ${pending.map((name: string) => `"${name}"`).join(", ")} but Jellyfin did not finish re-creating the library within ${(timeoutMs / 1000).toString()}s`,
      );
    }
    await new Promise<void>((resolve: () => void) =>
      setTimeout(resolve, intervalMs),
    );
  }
}

export async function applyLibraryRenames(
  client: JellyfinClient,
  renames: LibraryRename[] | undefined,
): Promise<void> {
  if (!renames) return;
  for (const rename of renames) {
    await client.renameVirtualFolder(rename.from, rename.to);
  }
}
