import { logger } from "../lib/logger";
import { JellyfinHttpError } from "../api/errors";
import type { JellyfinClient } from "../api/jellyfin.types";
import type { RootConfig } from "../types/config/root";
import type { UserConfig } from "../types/config/users";
import { getPassword } from "../mappers/users";

export interface AdminCredentials {
  name: string;
  password: string;
}

/**
 * The admin Jellarr signs in as when it has no working API key: the
 * `startup.user` the first-boot wizard creates, else the first user in
 * `users` whose policy sets isAdministrator.
 */
export function resolveAdminCredentials(
  cfg: RootConfig,
): AdminCredentials | undefined {
  if (cfg.startup?.user) {
    return {
      name: cfg.startup.user.name,
      password: getPassword(cfg.startup.user),
    };
  }
  const admin: UserConfig | undefined = cfg.users?.find(
    (user: UserConfig) => user.policy?.isAdministrator === true,
  );
  return admin ? { name: admin.name, password: getPassword(admin) } : undefined;
}

/**
 * Signs in by name and makes the returned token the client's credential for
 * the rest of the run. Returns the credentials used, so later steps know
 * that user's password is verified.
 */
export async function authenticateAsAdmin(
  client: JellyfinClient,
  cfg: RootConfig,
  reason: string,
): Promise<AdminCredentials> {
  const admin: AdminCredentials | undefined = resolveAdminCredentials(cfg);
  if (!admin) {
    throw new Error(
      `${reason}, and no admin to sign in as: set JELLARR_API_KEY, or declare a user with policy.isAdministrator`,
    );
  }
  logger.warn(
    `${reason}; falling back to signing in as admin "${admin.name}" with its password`,
  );
  client.setAccessToken(
    await client.authenticateByName(admin.name, admin.password),
  );
  return admin;
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof JellyfinHttpError && error.status === 401;
}
