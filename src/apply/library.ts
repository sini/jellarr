import { logger } from "../lib/logger";
import { deepEqual } from "fast-equals";
import { carryServerFields, overlay, withoutUnsupported } from "../lib/objects";
import type { JellyfinClient } from "../api/jellyfin.types";
import type { VirtualFolderConfig } from "../types/config/library";
import type {
  VirtualFolderInfoSchema,
  CollectionTypeSchema,
  AddVirtualFolderDtoSchema,
  UpdateLibraryOptionsDtoSchema,
  LibraryOptionsSchema,
} from "../types/schema/library";
import {
  mapVirtualFolderConfigToSchema,
  mapVirtualFolderInfoSchemaToAddVirtualFolderDtoSchema,
  withIgnoredLibraryOptions,
} from "../mappers/library";

export interface LibraryDiff {
  toCreate?: VirtualFolderInfoSchema[];
  toUpdate?: Array<{
    id: string;
    name: string;
    libraryOptions: LibraryOptionsSchema;
  }>;
}

function resolveFolderId(
  folder: VirtualFolderInfoSchema | undefined,
): string | undefined {
  if (!folder) return undefined;
  return (
    (folder as { Id?: string }).Id ??
    (folder as { ItemId?: string | null }).ItemId ??
    undefined
  );
}

/**
 * Declared arrays of objects are authoritative as a set and an order, but the
 * server adds fields to their elements (a TypeOption's ImageOptions, a path's
 * NetworkPath). Carry those over from the current element with the same
 * identity so they neither read as drift nor get wiped by the update.
 */
function withServerElementFields(
  desired: LibraryOptionsSchema,
  current: LibraryOptionsSchema,
): LibraryOptionsSchema {
  return {
    ...desired,
    ...(desired.PathInfos
      ? {
          PathInfos: carryServerFields(
            desired.PathInfos,
            current.PathInfos,
            (info: { Path?: string | null }) => info.Path,
          ),
        }
      : {}),
    ...(desired.TypeOptions
      ? {
          TypeOptions: carryServerFields(
            desired.TypeOptions,
            current.TypeOptions,
            (option: { Type?: string | null }) => option.Type,
          ),
        }
      : {}),
  } as LibraryOptionsSchema;
}

export function calculateLibraryDiff(
  current: VirtualFolderInfoSchema[],
  desired: VirtualFolderConfig[],
): LibraryDiff | undefined {
  if (desired.length === 0) {
    return undefined;
  }

  const currentByName: Map<string, VirtualFolderInfoSchema> = new Map(
    current.flatMap(
      (
        folder: VirtualFolderInfoSchema,
      ): Array<[string, VirtualFolderInfoSchema]> =>
        folder.Name ? [[folder.Name, folder]] : [],
    ),
  );

  const next: VirtualFolderInfoSchema[] = desired.map(
    (folder: VirtualFolderConfig): VirtualFolderInfoSchema => {
      const mapped: Partial<VirtualFolderInfoSchema> =
        mapVirtualFolderConfigToSchema(folder);
      const currentFolder: VirtualFolderInfoSchema | undefined =
        currentByName.get(folder.name);
      return (
        currentFolder
          ? withIgnoredLibraryOptions(
              mapped,
              currentFolder,
              folder.ignoreChanges ?? [],
            )
          : mapped
      ) as VirtualFolderInfoSchema;
    },
  );

  for (const folder of next) {
    const name: string | undefined = folder.Name ?? undefined;
    if (!name) continue;
    const currentFolder: VirtualFolderInfoSchema | undefined =
      currentByName.get(name);
    const currentType: string | undefined =
      (currentFolder?.CollectionType as string | undefined) ?? undefined;
    const desiredType: string | undefined =
      (folder.CollectionType as string | undefined) ?? undefined;
    if (
      currentFolder &&
      typeof currentType !== "undefined" &&
      typeof desiredType !== "undefined" &&
      currentType !== desiredType
    ) {
      throw new Error(
        `Library '${name}' collectionType change is not supported (current: ${currentType}, desired: ${desiredType})`,
      );
    }
  }

  const toCreate: VirtualFolderInfoSchema[] = next.filter(
    (folder: VirtualFolderInfoSchema) =>
      !!folder.Name && !currentByName.has(folder.Name),
  );

  const toUpdate: NonNullable<LibraryDiff["toUpdate"]> = [];
  for (const folder of next) {
    const name: string | undefined = folder.Name ?? undefined;
    const currentFolder: VirtualFolderInfoSchema | undefined = name
      ? currentByName.get(name)
      : undefined;
    const existingId: string | undefined = resolveFolderId(currentFolder);
    const libraryOptions: LibraryOptionsSchema | undefined =
      folder.LibraryOptions as LibraryOptionsSchema | undefined;
    if (!name || !existingId || !libraryOptions) continue;

    const currentOptions: LibraryOptionsSchema =
      currentFolder?.LibraryOptions ?? ({} as LibraryOptionsSchema);
    const wanted: LibraryOptionsSchema = withoutUnsupported(
      currentOptions,
      withServerElementFields(libraryOptions, currentOptions),
      `library ${name}`,
    );
    if (deepEqual(overlay(currentOptions, wanted), currentOptions)) continue;
    logger.info(`Library options differ: ${name}`);
    toUpdate.push({ id: existingId, name, libraryOptions: wanted });
  }

  if (toCreate.length === 0 && toUpdate.length === 0) return undefined;

  return {
    toCreate: toCreate.length > 0 ? toCreate : undefined,
    toUpdate: toUpdate.length > 0 ? toUpdate : undefined,
  };
}

export async function applyLibrary(
  client: JellyfinClient,
  diffResult: LibraryDiff | undefined,
): Promise<void> {
  if (!diffResult) return;

  const { toCreate, toUpdate }: LibraryDiff = diffResult;

  if (!toCreate && !toUpdate) return;

  if (toCreate) {
    for (const virtualFolder of toCreate) {
      if (!virtualFolder.Name) {
        logger.warn("Skipping virtual folder without a Name");
        continue;
      }

      const name: string = virtualFolder.Name;
      const collectionType: CollectionTypeSchema =
        virtualFolder.CollectionType as CollectionTypeSchema;

      logger.info(`Creating virtual folder: ${name}`);

      const addVirtualFolderDto: AddVirtualFolderDtoSchema =
        mapVirtualFolderInfoSchemaToAddVirtualFolderDtoSchema(virtualFolder);

      await client.addVirtualFolder(name, collectionType, addVirtualFolderDto);

      logger.info(`✓ Created virtual folder: ${name} (${collectionType})`);
    }
  }

  if (toUpdate) {
    for (const update of toUpdate) {
      const payload: UpdateLibraryOptionsDtoSchema = {
        Id: update.id,
        LibraryOptions: update.libraryOptions,
      };

      logger.info(`Updating library options: ${update.name}`);
      await client.updateLibraryOptions(update.id, payload);
      logger.info(`✓ Updated library options: ${update.name}`);
    }
  }
}
