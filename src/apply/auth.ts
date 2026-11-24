import { logger } from "../lib/logger";
import { JellyfinHttpError } from "../api/errors";
import type { JellyfinClient } from "../api/jellyfin.types";
import type { RootConfig } from "../types/config/root";
import type { UserConfig } from "../types/config/users";
import { getPassword } from "../mappers/users";

export interface AdminCredentials {
  name: string;
  password: string;
  /** Other names the account may still carry on the server, because of a rename. */
  alternateNames: string[];
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
    const wizardName: string = cfg.startup.user.name;
    return {
      name: wizardName,
      password: getPassword(cfg.startup.user),
      alternateNames: (cfg.users ?? []).flatMap((user: UserConfig): string[] =>
        user.renameFrom === wizardName ? [user.name] : [],
      ),
    };
  }
  const admin: UserConfig | undefined = cfg.users?.find(
    (user: UserConfig) => user.policy?.isAdministrator === true,
  );
  return admin
    ? {
        name: admin.name,
        password: getPassword(admin),
        alternateNames: admin.renameFrom ? [admin.renameFrom] : [],
      }
    : undefined;
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
  // NOTE: a sign-in by a name no account carries counts against nobody, so
  let firstError: unknown;
  for (const name of [admin.name, ...admin.alternateNames]) {
    try {
      client.setAccessToken(
        await client.authenticateByName(name, admin.password),
      );
      return admin;
    } catch (error) {
      firstError ??= error;
    }
  }
  const detail: string =
    firstError instanceof Error ? firstError.message : String(firstError);
  throw new Error(
    `Signing in as admin "${admin.name}" failed (${detail}). Each failed sign-in counts toward the admin's lockout limit, so do not retry blindly; check the password first.`,
    { cause: firstError },
  );
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof JellyfinHttpError && error.status === 401;
}
