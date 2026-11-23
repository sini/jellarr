import { logger } from "../lib/logger";
import type { JellyfinClient } from "../api/jellyfin.types";
import { mapNetworkingConfigToSchema } from "../mappers/networking";
import { type NetworkingConfig } from "../types/config/networking";
import { type NetworkConfigurationSchema } from "../types/schema/networking";
import { deepEqual } from "fast-equals";
import { overlaySupported } from "../lib/objects";

export function calculateNetworkingDiff(
  current: NetworkConfigurationSchema,
  desired: NetworkingConfig,
): NetworkConfigurationSchema | undefined {
  const next: Partial<NetworkConfigurationSchema> =
    mapNetworkingConfigToSchema(desired);

  const updated: NetworkConfigurationSchema = overlaySupported(
    "NetworkConfiguration",
    current,
    next,
    "networking",
  ) as NetworkConfigurationSchema;

  if (deepEqual(updated, current)) return undefined;

  logger.info(JSON.stringify(next));
  return updated;
}

export async function applyNetworking(
  client: JellyfinClient,
  updatedSchema: NetworkConfigurationSchema | undefined,
): Promise<void> {
  if (!updatedSchema) return;

  await client.updateNetworkingConfiguration(updatedSchema);
}
