import type { JellyfinClient } from "../api/jellyfin.types";
import type { NameIdPairSchema } from "../types/schema/users";
import type { UserConfig, UserConfigList } from "../types/config/users";

/**
 * Errors when a declared `authenticationProviderId` or `passwordResetProviderId`
 * is not one the server reports. A wrong provider can lock a user out, so an
 * unknown id stops the run before anything is written. Reads only, so a dry run
 * validates too.
 */
export async function validateUserProviders(
  client: JellyfinClient,
  desired: UserConfigList,
): Promise<void> {
  const checks: Array<{
    field: "authenticationProviderId" | "passwordResetProviderId";
    read: () => Promise<NameIdPairSchema[]>;
  }> = [
    {
      field: "authenticationProviderId",
      read: (): Promise<NameIdPairSchema[]> => client.getAuthProviders(),
    },
    {
      field: "passwordResetProviderId",
      read: (): Promise<NameIdPairSchema[]> =>
        client.getPasswordResetProviders(),
    },
  ];
  for (const { field, read } of checks) {
    const declared: Array<{ user: string; value: string }> = desired.flatMap(
      (user: UserConfig): Array<{ user: string; value: string }> => {
        const value: string | undefined = user.policy?.[field];
        return value === undefined ? [] : [{ user: user.name, value }];
      },
    );
    if (declared.length === 0) continue;
    const known: string[] = (await read()).flatMap(
      (provider: NameIdPairSchema) => (provider.Id ? [provider.Id] : []),
    );
    for (const { user, value } of declared) {
      if (!known.includes(value)) {
        throw new Error(
          `user "${user}" policy.${field} "${value}" is not a provider the server reports (known: ${known.join(", ") || "none"})`,
        );
      }
    }
  }
}
