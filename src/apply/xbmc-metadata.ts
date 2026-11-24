import { logger } from "../lib/logger";
import type { JellyfinClient } from "../api/jellyfin.types";
import { mapXbmcMetadataConfigToSchema } from "../mappers/xbmc-metadata";
import { type XbmcMetadataConfig } from "../types/config/xbmc-metadata";
import { type XbmcMetadataOptionsSchema } from "../types/schema/xbmc-metadata";
import { deepEqual } from "fast-equals";
import { overlaySupported } from "../lib/objects";

export function calculateXbmcMetadataDiff(
  current: XbmcMetadataOptionsSchema,
  desired: XbmcMetadataConfig,
): XbmcMetadataOptionsSchema | undefined {
  const next: Partial<XbmcMetadataOptionsSchema> =
    mapXbmcMetadataConfigToSchema(desired);

  const updated: XbmcMetadataOptionsSchema = overlaySupported(
    "XbmcMetadataOptions",
    current,
    next,
    "xbmcMetadata",
  ) as XbmcMetadataOptionsSchema;

  if (deepEqual(updated, current)) return undefined;

  logger.info(JSON.stringify(next));
  return updated;
}

export async function applyXbmcMetadata(
  client: JellyfinClient,
  updatedSchema: XbmcMetadataOptionsSchema | undefined,
): Promise<void> {
  if (!updatedSchema) return;

  await client.updateXbmcMetadataConfiguration(updatedSchema);
}
