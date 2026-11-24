import type { JellyfinClient } from "../api/jellyfin.types";
import { logger } from "../lib/logger";
import { say } from "../lib/mode";
import type { DeviceConfigList } from "../types/config/devices";
import type { DeviceOptionsDtoSchema } from "../types/schema/devices";

export interface DeviceNameChange {
  id: string;
  from: string | null;
  to: string | null;
}

/** Reads the options of each declared device; a device the server does not know is absent. */
export async function readDeviceOptions(
  client: JellyfinClient,
  desired: DeviceConfigList,
): Promise<Map<string, DeviceOptionsDtoSchema>> {
  const out: Map<string, DeviceOptionsDtoSchema> = new Map();
  for (const device of desired) {
    const options: DeviceOptionsDtoSchema | undefined =
      await client.getDeviceOptions(device.id);
    if (options) out.set(device.id, options);
  }
  return out;
}

/**
 * A device id exists only once a client has connected with it, so a declared
 * device the server does not know is warned about and skipped rather than
 * failing a run that provisions the server before any client has signed in.
 */
export function calculateDeviceNameChanges(
  current: Map<string, DeviceOptionsDtoSchema>,
  desired: DeviceConfigList,
): DeviceNameChange[] | undefined {
  const changes: DeviceNameChange[] = [];
  for (const device of desired) {
    const options: DeviceOptionsDtoSchema | undefined = current.get(device.id);
    if (!options) {
      logger.warn(
        `device ${device.id} is not known to the server yet (no client has connected with it); its name was not set`,
      );
      continue;
    }
    const from: string | null = options.CustomName ?? null;
    if (from === device.customName) continue;
    logger.info(
      say(
        `Setting the name of device ${device.id}`,
        `Would set the name of device ${device.id}`,
      ),
    );
    changes.push({ id: device.id, from, to: device.customName });
  }
  return changes.length > 0 ? changes : undefined;
}

export async function applyDeviceNames(
  client: JellyfinClient,
  changes: DeviceNameChange[] | undefined,
): Promise<void> {
  if (!changes) return;
  for (const change of changes) {
    await client.updateDeviceOptions(change.id, {
      DeviceId: change.id,
      CustomName: change.to,
    });
  }
}
