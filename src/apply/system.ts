import { logger } from "../lib/logger";
import type { JellyfinClient } from "../api/jellyfin.types";
import { mapSystemConfigurationConfigToSchema } from "../mappers/system";
import { type SystemConfig } from "../types/config/system";
import { type ServerConfigurationSchema } from "../types/schema/system";
import { deepEqual } from "fast-equals";
import { overlay } from "../lib/objects";

/**
 * Diff the desired system configuration against the server's current state.
 *
 * Desired is overlaid onto current: every scalar and every array the config
 * declares (PluginRepositories, WidthResolutions, the string lists) replaces
 * the server's value whole, so a shrunk, emptied or reordered array lands
 * exactly; fields and arrays the partial config omits keep the server's value.
 */
export function calculateSystemDiff(
  current: ServerConfigurationSchema,
  desired: SystemConfig,
): ServerConfigurationSchema | undefined {
  const next: ServerConfigurationSchema =
    mapSystemConfigurationConfigToSchema(desired);
  const updated: ServerConfigurationSchema = overlay(
    current,
    next,
  ) as ServerConfigurationSchema;

  if (deepEqual(updated, current)) return undefined;

  logger.info(JSON.stringify(next));
  return updated;
}

export async function applySystem(
  client: JellyfinClient,
  updatedSchema: ServerConfigurationSchema | undefined,
): Promise<void> {
  if (!updatedSchema) return;

  await client.updateSystemConfiguration(updatedSchema);
}
