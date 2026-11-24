import { logger } from "../lib/logger";
import type { JellyfinClient } from "../api/jellyfin.types";
import type { StartupConfig } from "../types/config/startup";
import type { PublicSystemInfoSchema } from "../types/schema/startup";
import { getPassword } from "../mappers/users";

/** The wizard runs only when asked: `completeStartupWizard: true` or a declared `startup.user`. */
export function wantsStartupWizard(startup: StartupConfig): boolean {
  return startup.completeStartupWizard === true || startup.user !== undefined;
}

/**
 * Drives the first-boot wizard of a pristine server (StartupWizardCompleted
 * is false): server settings, remote access, the admin user, then completion.
 * Does nothing unless `wantsStartupWizard`, or on a server whose wizard is
 * already complete. Once it runs, completion is implied unless
 * `completeStartupWizard: false`. Returns whether it ran.
 */
export async function applyStartupWizard(
  client: JellyfinClient,
  startup: StartupConfig,
): Promise<boolean> {
  if (!wantsStartupWizard(startup)) return false;
  const info: PublicSystemInfoSchema = await client.getPublicSystemInfo();
  if (info.StartupWizardCompleted !== false) {
    logger.info("✓ startup wizard already completed");
    return false;
  }

  if (
    startup.serverName !== undefined ||
    startup.preferredMetadataLanguage !== undefined ||
    startup.metadataCountryCode !== undefined ||
    startup.uiCulture !== undefined
  ) {
    logger.info("→ configuring startup server settings");
    await client.updateStartupConfiguration({
      ServerName: startup.serverName,
      PreferredMetadataLanguage: startup.preferredMetadataLanguage,
      MetadataCountryCode: startup.metadataCountryCode,
      UICulture: startup.uiCulture,
    });
  }

  if (startup.remoteAccess) {
    logger.info("→ configuring remote access");
    const dropsPortMapping: boolean =
      Number.parseInt(info.Version ?? "", 10) >= 12;
    if (dropsPortMapping) {
      logger.warn(
        `startup.remoteAccess.enableAutomaticPortMapping is not supported by Jellyfin ${info.Version ?? "12"}; skipped`,
      );
    }
    await client.setRemoteAccess({
      EnableRemoteAccess: startup.remoteAccess.enableRemoteAccess,
      ...(dropsPortMapping
        ? {}
        : {
            EnableAutomaticPortMapping:
              startup.remoteAccess.enableAutomaticPortMapping,
          }),
    });
  }

  if (startup.user) {
    logger.info(`→ creating startup admin "${startup.user.name}"`);
    // NOTE: Jellyfin only creates the initial user when it is read before it is written.
    await client.getStartupUser();
    await client.updateStartupUser({
      Name: startup.user.name,
      Password: getPassword(startup.user),
    });
  }

  if (startup.completeStartupWizard !== false) {
    logger.info("→ marking startup wizard as complete");
    await client.completeStartupWizard();
    logger.info("✓ startup wizard complete");
  }
  return true;
}
