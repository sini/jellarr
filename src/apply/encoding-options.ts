import { logger } from "../lib/logger";
import type { JellyfinClient } from "../api/jellyfin.types";
import { mapEncodingOptionsConfigToSchema } from "../mappers/encoding-options";
import { type EncodingOptionsConfig } from "../types/config/encoding-options";
import { type EncodingOptionsSchema } from "../types/schema/encoding-options";
import { deepEqual } from "fast-equals";
import { overlaySupported } from "../lib/objects";

export function calculateEncodingDiff(
  current: EncodingOptionsSchema,
  desired: EncodingOptionsConfig,
): EncodingOptionsSchema | undefined {
  const next: Partial<EncodingOptionsSchema> =
    mapEncodingOptionsConfigToSchema(desired);

  const updated: EncodingOptionsSchema = overlaySupported(
    "EncodingOptions",
    current,
    next,
    "encoding",
  ) as EncodingOptionsSchema;

  if (deepEqual(updated, current)) return undefined;

  logger.info(JSON.stringify(next));
  return updated;
}

export async function applyEncoding(
  client: JellyfinClient,
  updatedSchema: EncodingOptionsSchema | undefined,
): Promise<void> {
  if (!updatedSchema) return;

  await client.updateEncodingConfiguration(updatedSchema);
}
