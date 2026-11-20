import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { isProbeSafe, reconcileUserPasswords } from "../../src/apply/users";
import type {
  JellyfinClient,
  PasswordCheck,
} from "../../src/api/jellyfin.types";
import type { UserDtoSchema } from "../../src/types/schema/users";
import type { UserConfigList } from "../../src/types/config/users";

interface Fixture {
  client: JellyfinClient;
  checkUserPassword: ReturnType<typeof vi.fn>;
  updateUserPassword: ReturnType<typeof vi.fn>;
}

function makeClient(check: PasswordCheck): Fixture {
  const checkUserPassword: ReturnType<typeof vi.fn> = vi
    .fn()
    .mockResolvedValue(check);
  const updateUserPassword: ReturnType<typeof vi.fn> = vi
    .fn()
    .mockResolvedValue(undefined);
  return {
    client: {
      checkUserPassword,
      updateUserPassword,
    } as unknown as JellyfinClient,
    checkUserPassword,
    updateUserPassword,
  };
}

const alice: UserDtoSchema = {
  Name: "alice",
  Id: "id-alice",
  Policy: {
    LoginAttemptsBeforeLockout: -1,
    InvalidLoginAttemptCount: 0,
  } as UserDtoSchema["Policy"],
};

describe("apply/users password reconciliation", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "jellarr-pw-"));
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(dir, { recursive: true, force: true });
  });

  async function desiredFromFile(contents: string): Promise<UserConfigList> {
    const passwordFile: string = path.join(dir, "alice-pw");
    await fs.writeFile(passwordFile, contents);
    return [{ name: "alice", passwordFile }];
  }

  it("whenProbeSucceeds_thenPasswordIsNotSet", async () => {
    // Arrange
    const fx: Fixture = makeClient("valid");
    const { client, checkUserPassword, updateUserPassword }: Fixture = fx;

    // Act
    await reconcileUserPasswords(
      client,
      [alice],
      await desiredFromFile("pw\n"),
      new Set(),
    );

    // Assert
    expect(checkUserPassword).toHaveBeenCalledWith("alice", "pw");
    expect(updateUserPassword).not.toHaveBeenCalled();
  });

  it("whenProbeFails_thenPasswordFromFileIsSet", async () => {
    // Arrange
    const fx: Fixture = makeClient("invalid");
    const { client, updateUserPassword }: Fixture = fx;

    // Act
    await reconcileUserPasswords(
      client,
      [alice],
      await desiredFromFile("pw\n"),
      new Set(),
    );

    // Assert
    expect(updateUserPassword).toHaveBeenCalledWith("id-alice", "pw");
  });

  it("whenSignInIsForbidden_thenPasswordIsLeftAlone", async () => {
    // Arrange
    const fx: Fixture = makeClient("unverifiable");
    const { client, updateUserPassword }: Fixture = fx;

    // Act
    await reconcileUserPasswords(
      client,
      [alice],
      await desiredFromFile("pw"),
      new Set(),
    );

    // Assert
    expect(updateUserPassword).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("Cannot verify"),
    );
  });

  it("whenOneFailureWouldLockTheUserOut_thenSkipsWithoutProbingOrSetting", async () => {
    // Arrange
    const fx: Fixture = makeClient("valid");
    const { client, checkUserPassword, updateUserPassword }: Fixture = fx;
    const nearLockout: UserDtoSchema = {
      ...alice,
      Policy: {
        LoginAttemptsBeforeLockout: 3,
        InvalidLoginAttemptCount: 2,
      } as UserDtoSchema["Policy"],
    };

    // Act
    await reconcileUserPasswords(
      client,
      [nearLockout],
      await desiredFromFile("pw"),
      new Set(),
    );

    // Assert
    expect(checkUserPassword).not.toHaveBeenCalled();
    expect(updateUserPassword).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("left unchanged"),
    );
  });

  it("whenUserIsSkippedOrUnknown_thenNothingIsCalled", async () => {
    // Arrange
    const fx: Fixture = makeClient("invalid");
    const { client, checkUserPassword, updateUserPassword }: Fixture = fx;
    const desired: UserConfigList = await desiredFromFile("pw");

    // Act
    await reconcileUserPasswords(client, [alice], desired, new Set(["alice"]));
    await reconcileUserPasswords(client, [], desired, new Set());

    // Assert
    expect(checkUserPassword).not.toHaveBeenCalled();
    expect(updateUserPassword).not.toHaveBeenCalled();
  });

  it.each([
    [undefined, 0, true],
    [null, 0, true],
    [-1, 0, true],
    [0, 0, true],
    [0, 1, true],
    [0, 2, false],
    [-1, 99, true],
    [5, 3, true],
    [5, 4, false],
    [3, 2, false],
    [1, 0, false],
  ])(
    "isProbeSafe(limit=%s, count=%s) is %s",
    (limit: number | null | undefined, count: number, safe: boolean) => {
      expect(
        isProbeSafe({
          LoginAttemptsBeforeLockout: limit,
          InvalidLoginAttemptCount: count,
        } as UserDtoSchema["Policy"]),
      ).toBe(safe);
    },
  );
});
