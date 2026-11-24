import { deepEqual } from "fast-equals";
import type { JellyfinClient } from "../api/jellyfin.types";
import { logger } from "../lib/logger";
import { say } from "../lib/mode";
import { overlay } from "../lib/objects";
import { mapDisplayPreferencesConfigToSchema } from "../mappers/display-preferences";
import { DEFAULT_DISPLAY_PREFERENCES_ID } from "../types/config/display-preferences";
import type { UserConfigList } from "../types/config/users";
import type {
  DisplayPreferencesDtoSchema,
  UserDtoSchema,
} from "../types/schema/users";

export interface CurrentDisplayPreferences {
  userId: string;
  userName: string;
  id: string;
  client: string;
  current: DisplayPreferencesDtoSchema;
}

export interface DisplayPreferencesChange extends CurrentDisplayPreferences {
  next: DisplayPreferencesDtoSchema;
}

const keyOf: (userId: string, id: string, client: string) => string = (
  userId: string,
  id: string,
  client: string,
): string => JSON.stringify([userId, id, client]);

/** Reads each declared (id, client) entry of every declared user that exists. */
export async function readDisplayPreferences(
  client: JellyfinClient,
  users: UserDtoSchema[],
  desired: UserConfigList,
): Promise<Map<string, CurrentDisplayPreferences>> {
  const out: Map<string, CurrentDisplayPreferences> = new Map();
  for (const wanted of desired) {
    const user: UserDtoSchema | undefined = users.find(
      (candidate: UserDtoSchema) => candidate.Name === wanted.name,
    );
    if (!user?.Id) continue;
    for (const entry of wanted.displayPreferences ?? []) {
      const id: string = entry.id ?? DEFAULT_DISPLAY_PREFERENCES_ID;
      out.set(keyOf(user.Id, id, entry.client), {
        userId: user.Id,
        userName: wanted.name,
        id,
        client: entry.client,
        current: await client.getDisplayPreferences(user.Id, id, entry.client),
      });
    }
  }
  return out;
}

/**
 * Overlays the declared fields on the stored entry: declared keys win, and
 * every other field and CustomPrefs key stays as the server has it.
 */
export function calculateDisplayPreferencesDiff(
  current: Map<string, CurrentDisplayPreferences>,
  desired: UserConfigList,
): DisplayPreferencesChange[] | undefined {
  const changes: DisplayPreferencesChange[] = [];
  for (const wanted of desired) {
    for (const entry of wanted.displayPreferences ?? []) {
      const id: string = entry.id ?? DEFAULT_DISPLAY_PREFERENCES_ID;
      const stored: CurrentDisplayPreferences | undefined = [
        ...current.values(),
      ].find(
        (candidate: CurrentDisplayPreferences) =>
          candidate.userName === wanted.name &&
          candidate.id === id &&
          candidate.client === entry.client,
      );
      if (!stored) continue;
      const next: DisplayPreferencesDtoSchema = overlay(
        stored.current,
        mapDisplayPreferencesConfigToSchema(entry),
      ) as DisplayPreferencesDtoSchema;
      if (deepEqual(next, stored.current)) continue;
      logger.info(
        say(
          `Updating display preferences ${id}/${entry.client} of ${wanted.name}`,
          `Would update display preferences ${id}/${entry.client} of ${wanted.name}`,
        ),
      );
      changes.push({ ...stored, next });
    }
  }
  return changes.length > 0 ? changes : undefined;
}

export async function applyDisplayPreferences(
  client: JellyfinClient,
  changes: DisplayPreferencesChange[] | undefined,
): Promise<void> {
  if (!changes) return;
  for (const change of changes) {
    await client.updateDisplayPreferences(
      change.userId,
      change.next,
      change.id,
      change.client,
    );
  }
}
