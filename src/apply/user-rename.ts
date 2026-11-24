import type { JellyfinClient } from "../api/jellyfin.types";
import { logger } from "../lib/logger";
import { say } from "../lib/mode";
import type { UserConfigList } from "../types/config/users";
import type { UserDtoSchema } from "../types/schema/users";

export interface UserRename {
  id: string;
  from: string;
  to: string;
}

/**
 * A user declared with `renameFrom` is renamed when the old name exists and
 * the new one does not. When neither exists the user is created under the new
 * name; when only the new one exists the rename already happened. Both
 * existing is an error, since jellarr cannot say which account is meant.
 */
export function calculateUserRenames(
  current: UserDtoSchema[],
  desired: UserConfigList,
): UserRename[] | undefined {
  const renames: UserRename[] = [];
  for (const user of desired) {
    if (user.renameFrom === undefined) continue;
    const old: UserDtoSchema | undefined = current.find(
      (candidate: UserDtoSchema) => candidate.Name === user.renameFrom,
    );
    if (!old?.Id) continue;
    if (
      current.some((candidate: UserDtoSchema) => candidate.Name === user.name)
    ) {
      throw new Error(
        `Cannot rename user: both "${user.renameFrom}" and "${user.name}" exist; remove one or drop renameFrom`,
      );
    }
    logger.info(
      say(
        `Renaming user ${user.renameFrom} to ${user.name}`,
        `Would rename user ${user.renameFrom} to ${user.name}`,
      ),
    );
    renames.push({ id: old.Id, from: user.renameFrom, to: user.name });
  }
  return renames.length > 0 ? renames : undefined;
}

/** The server's users as they will read after the renames. */
export function renameUsersInMemory(
  current: UserDtoSchema[],
  renames: UserRename[],
): UserDtoSchema[] {
  return current.map((user: UserDtoSchema): UserDtoSchema => {
    const rename: UserRename | undefined = renames.find(
      (candidate: UserRename) => candidate.id === user.Id,
    );
    return rename ? { ...user, Name: rename.to } : user;
  });
}

export async function applyUserRenames(
  client: JellyfinClient,
  current: UserDtoSchema[],
  renames: UserRename[] | undefined,
): Promise<void> {
  if (!renames) return;
  for (const rename of renames) {
    const user: UserDtoSchema | undefined = current.find(
      (candidate: UserDtoSchema) => candidate.Id === rename.id,
    );
    await client.renameUser(rename.id, { ...user, Name: rename.to });
  }
}
