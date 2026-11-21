import { logger } from "../lib/logger";
import type { JellyfinClient } from "../api/jellyfin.types";
import { mapSystemConfigurationConfigToSchema } from "../mappers/system";
import { type SystemConfig } from "../types/config/system";
import { type ServerConfigurationSchema } from "../types/schema/system";
import { deepEqual } from "fast-equals";
import { carryServerFields, overlay } from "../lib/objects";

/**
 * Diff the desired system configuration against the server's current state.
 *
 * Desired is overlaid onto current: every scalar and every array the config
 * declares (PluginRepositories, MetadataOptions, WidthResolutions, the string
 * lists) replaces the server's value whole, so a shrunk, emptied or reordered
 * array lands exactly; fields and arrays the partial config omits keep the
 * server's value. Fields the server adds to an array element are carried over.
 */
function withServerElementFields(
  next: Partial<ServerConfigurationSchema>,
  current: ServerConfigurationSchema,
): Partial<ServerConfigurationSchema> {
  const carried: Partial<ServerConfigurationSchema> = { ...next };
  if (next.MetadataOptions) {
    carried.MetadataOptions = carryServerFields(
      next.MetadataOptions,
      current.MetadataOptions,
      (o: { ItemType?: string | null }) => o.ItemType,
    );
  }
  if (next.ContentTypes) {
    carried.ContentTypes = carryServerFields(
      next.ContentTypes,
      current.ContentTypes,
      (t: { Name?: string | null }) => t.Name,
    );
  }
  if (next.PathSubstitutions) {
    carried.PathSubstitutions = carryServerFields(
      next.PathSubstitutions,
      current.PathSubstitutions,
      (s: { From?: string }) => s.From,
    );
  }
  if (next.CastReceiverApplications) {
    carried.CastReceiverApplications = carryServerFields(
      next.CastReceiverApplications,
      current.CastReceiverApplications,
      (a: { Id?: string }) => a.Id,
    );
  }
  return carried;
}

export function calculateSystemDiff(
  current: ServerConfigurationSchema,
  desired: SystemConfig,
): ServerConfigurationSchema | undefined {
  const next: Partial<ServerConfigurationSchema> = withServerElementFields(
    mapSystemConfigurationConfigToSchema(desired),
    current,
  );
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
