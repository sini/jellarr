import { describe, it, expect, vi, type Mock } from "vitest";
import { validateUserProviders } from "../../src/apply/user-providers";
import { mapUserPolicyConfigToSchema } from "../../src/mappers/users";
import { UserConfigType } from "../../src/types/config/users";
import type { JellyfinClient } from "../../src/api/jellyfin.types";

const AUTH: string =
  "Jellyfin.Server.Implementations.Users.DefaultAuthenticationProvider";
const RESET: string =
  "Jellyfin.Server.Implementations.Users.DefaultPasswordResetProvider";

function spied(): { client: JellyfinClient; auth: Mock; reset: Mock } {
  const auth: Mock = vi.fn().mockResolvedValue([{ Name: "Default", Id: AUTH }]);
  const reset: Mock = vi
    .fn()
    .mockResolvedValue([{ Name: "Default", Id: RESET }]);
  return {
    client: {
      getAuthProviders: auth,
      getPasswordResetProviders: reset,
    } as unknown as JellyfinClient,
    auth,
    reset,
  };
}

const user: (
  policy: Record<string, unknown>,
) => ReturnType<typeof UserConfigType.parse> = (
  policy: Record<string, unknown>,
): ReturnType<typeof UserConfigType.parse> =>
  UserConfigType.parse({ name: "bob", password: "x", policy });

describe("user provider ids", () => {
  it("whenTheyAreMapped_thenTheyReachThePolicy", () => {
    expect(
      mapUserPolicyConfigToSchema({
        authenticationProviderId: AUTH,
        passwordResetProviderId: RESET,
      }),
    ).toEqual({
      AuthenticationProviderId: AUTH,
      PasswordResetProviderId: RESET,
    });
  });

  it("whenBothAreKnown_thenValidationPasses", async () => {
    const { client }: ReturnType<typeof spied> = spied();
    await expect(
      validateUserProviders(client, [
        user({
          authenticationProviderId: AUTH,
          passwordResetProviderId: RESET,
        }),
      ]),
    ).resolves.toBeUndefined();
  });

  it("whenTheAuthenticationProviderIsUnknown_thenItIsAnErrorListingTheKnownIds", async () => {
    const { client }: ReturnType<typeof spied> = spied();
    await expect(
      validateUserProviders(client, [
        user({ authenticationProviderId: "Nope" }),
      ]),
    ).rejects.toThrow(
      new RegExp(
        `user "bob" policy.authenticationProviderId "Nope" is not a provider the server reports.*${AUTH}`,
      ),
    );
  });

  it("whenThePasswordResetProviderIsUnknown_thenItIsAnError", async () => {
    const { client }: ReturnType<typeof spied> = spied();
    await expect(
      validateUserProviders(client, [
        user({ passwordResetProviderId: "Nope" }),
      ]),
    ).rejects.toThrow(/passwordResetProviderId "Nope"/);
  });

  it("whenNoProviderIsDeclared_thenTheServerIsNotAsked", async () => {
    const { client, auth, reset }: ReturnType<typeof spied> = spied();
    await validateUserProviders(client, [user({ isHidden: true })]);
    expect(auth).not.toHaveBeenCalled();
    expect(reset).not.toHaveBeenCalled();
  });
});
