import { describe, it, expect, vi } from "vitest";
import YAML from "yaml";
import { calculateUserPolicyDiff } from "../../src/apply/users";
import { mapUserPolicyConfigToSchema } from "../../src/mappers/users";
import { resolveValue } from "../../src/lib/file-refs";
import { UserPolicyConfigType } from "../../src/types/config/users";
import type { UserPolicyConfig } from "../../src/types/config/users";
import type { UserPolicySchema } from "../../src/types/schema/users";

vi.mock("../../src/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

async function parse(yaml: string): Promise<UserPolicyConfig> {
  return UserPolicyConfigType.parse(await resolveValue(YAML.parse(yaml)));
}

const limited: () => UserPolicySchema = (): UserPolicySchema =>
  ({
    IsHidden: false,
    MaxParentalRating: 9,
    MaxParentalSubRating: 2,
  }) as UserPolicySchema;

describe("clearing parental ratings", () => {
  it("keeps an explicit null and an absent key apart through YAML and zod", async () => {
    const cleared: UserPolicyConfig = await parse(
      "maxParentalRating: null\nisHidden: true",
    );
    expect(cleared.maxParentalRating).toBeNull();
    expect("maxParentalSubRating" in cleared).toBe(false);
  });

  it("maps null to an explicit null and leaves an absent key out", async () => {
    const mapped: Partial<UserPolicySchema> = mapUserPolicyConfigToSchema(
      await parse("maxParentalRating: null"),
    );
    expect(mapped).toEqual({ MaxParentalRating: null });
  });

  it("clears the rating on the server and a second run is a no-op", async () => {
    const desired: UserPolicyConfig = await parse("maxParentalRating: null");
    const first: UserPolicySchema | undefined = calculateUserPolicyDiff(
      limited(),
      desired,
    );
    expect(first).toEqual({
      IsHidden: false,
      MaxParentalRating: null,
      MaxParentalSubRating: 2,
    });
    expect(
      calculateUserPolicyDiff(first as UserPolicySchema, desired),
    ).toBeUndefined();
  });

  it("leaves a set rating alone when the key is absent", async () => {
    expect(
      calculateUserPolicyDiff(limited(), await parse("isHidden: false")),
    ).toBeUndefined();
  });

  it("clears both ratings together", async () => {
    const first: UserPolicySchema | undefined = calculateUserPolicyDiff(
      limited(),
      await parse("maxParentalRating: null\nmaxParentalSubRating: null"),
    );
    expect(first?.MaxParentalRating).toBeNull();
    expect(first?.MaxParentalSubRating).toBeNull();
  });

  it("still rejects a negative or non-integer rating", () => {
    expect(
      UserPolicyConfigType.safeParse({ maxParentalRating: -1 }).success,
    ).toBe(false);
    expect(
      UserPolicyConfigType.safeParse({ maxParentalSubRating: "x" }).success,
    ).toBe(false);
  });
});
