import { describe, it, expect, vi, type Mock } from "vitest";
import {
  applyUserRenames,
  calculateUserRenames,
  renameUsersInMemory,
} from "../../src/apply/user-rename";
import {
  authenticateAsAdmin,
  resolveAdminCredentials,
} from "../../src/apply/auth";
import { UserConfigType } from "../../src/types/config/users";
import { RootConfigType } from "../../src/types/config/root";
import type { JellyfinClient } from "../../src/api/jellyfin.types";
import type { UserDtoSchema } from "../../src/types/schema/users";
import type { UserConfig } from "../../src/types/config/users";

vi.mock("../../src/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const wanted: (name: string, renameFrom?: string) => UserConfig = (
  name: string,
  renameFrom?: string,
): UserConfig =>
  UserConfigType.parse({
    name,
    password: "pw",
    ...(renameFrom ? { renameFrom } : {}),
  });
const server: (...names: string[]) => UserDtoSchema[] = (
  ...names: string[]
): UserDtoSchema[] =>
  names.map((userName: string): UserDtoSchema => ({
    Name: userName,
    Id: `id-${userName}`,
  }));

describe("user renameFrom", () => {
  it("whenOldExistsAndNewDoesNot_thenItIsRenamedById", () => {
    expect(calculateUserRenames(server("old"), [wanted("new", "old")])).toEqual(
      [{ id: "id-old", from: "old", to: "new" }],
    );
  });

  it("whenAlreadyRenamedOrNeitherExists_thenItIsANoOp", () => {
    expect(
      calculateUserRenames(server("new"), [wanted("new", "old")]),
    ).toBeUndefined();
    expect(
      calculateUserRenames(server("other"), [wanted("new", "old")]),
    ).toBeUndefined();
  });

  it("whenBothExist_thenItIsAnError", () => {
    expect(() =>
      calculateUserRenames(server("old", "new"), [wanted("new", "old")]),
    ).toThrow(/both "old" and "new" exist/);
  });

  it("whenRenamedInMemory_thenLaterPlanningSeesTheNewName", () => {
    expect(
      renameUsersInMemory(server("old"), [
        { id: "id-old", from: "old", to: "new" },
      ]).map((user: UserDtoSchema) => user.Name),
    ).toEqual(["new"]);
  });

  it("whenApplied_thenTheWholeUserIsPostedWithTheNewName", async () => {
    const renameUser: Mock = vi.fn().mockResolvedValue(undefined);
    const users: UserDtoSchema[] = [
      { Name: "old", Id: "u1", Configuration: { PlayDefaultAudioTrack: true } },
    ];
    await applyUserRenames({ renameUser } as unknown as JellyfinClient, users, [
      { id: "u1", from: "old", to: "new" },
    ]);
    expect(renameUser).toHaveBeenCalledWith("u1", {
      Name: "new",
      Id: "u1",
      Configuration: { PlayDefaultAudioTrack: true },
    });
  });

  it("whenTheConfigIsInvalid_thenItIsRejected", () => {
    const parse: (users: unknown[]) => boolean = (users: unknown[]): boolean =>
      RootConfigType.safeParse({
        version: 1,
        base_url: "http://x:8096",
        system: {},
        users,
      }).success;
    const user: (name: string, renameFrom?: string) => unknown = (
      name: string,
      renameFrom?: string,
    ): unknown => ({
      name,
      password: "p",
      ...(renameFrom ? { renameFrom } : {}),
    });
    expect(parse([user("a", "a")])).toBe(false);
    expect(parse([user("a", "b"), user("b")])).toBe(false);
    expect(parse([user("a", "c"), user("b", "c")])).toBe(false);
    expect(parse([user("a", "b")])).toBe(true);
  });
});

describe("admin sign-in across a rename", () => {
  const cfg: (
    renameFrom?: string,
  ) => ReturnType<typeof RootConfigType.parse> = (
    renameFrom?: string,
  ): ReturnType<typeof RootConfigType.parse> =>
    RootConfigType.parse({
      version: 1,
      base_url: "http://x:8096",
      system: {},
      users: [
        {
          name: "root",
          password: "pw",
          policy: { isAdministrator: true },
          ...(renameFrom ? { renameFrom } : {}),
        },
      ],
    });

  it("whenTheNewNameDoesNotExistYet_thenTheOldNameSignsIn", async () => {
    const authenticateByName: Mock = vi
      .fn()
      .mockRejectedValueOnce(new Error("401"))
      .mockResolvedValueOnce("tok");
    const setAccessToken: Mock = vi.fn();
    const admin: Awaited<ReturnType<typeof authenticateAsAdmin>> =
      await authenticateAsAdmin(
        { authenticateByName, setAccessToken } as unknown as JellyfinClient,
        cfg("admin"),
        "no key",
      );
    expect(authenticateByName.mock.calls).toEqual([
      ["root", "pw"],
      ["admin", "pw"],
    ]);
    expect(setAccessToken).toHaveBeenCalledWith("tok");
    expect(admin.name).toBe("root");
  });

  it("whenNoRenameIsDeclared_thenOnlyTheDeclaredNameIsTried", async () => {
    const authenticateByName: Mock = vi
      .fn()
      .mockRejectedValue(new Error("401"));
    await expect(
      authenticateAsAdmin(
        {
          authenticateByName,
          setAccessToken: vi.fn(),
        } as unknown as JellyfinClient,
        cfg(),
        "no key",
      ),
    ).rejects.toThrow(/Signing in as admin "root" failed/);
    expect(authenticateByName).toHaveBeenCalledTimes(1);
  });

  it("whenEveryNameFails_thenTheErrorNamesTheDeclaredAdmin", async () => {
    const authenticateByName: Mock = vi
      .fn()
      .mockRejectedValue(new Error("401"));
    await expect(
      authenticateAsAdmin(
        {
          authenticateByName,
          setAccessToken: vi.fn(),
        } as unknown as JellyfinClient,
        cfg("admin"),
        "no key",
      ),
    ).rejects.toThrow(/Signing in as admin "root" failed/);
    expect(authenticateByName).toHaveBeenCalledTimes(2);
  });

  it("whenTheWizardUserIsRenamedByAUserEntry_thenTheNewNameIsAlsoTried", () => {
    const config: ReturnType<typeof RootConfigType.parse> =
      RootConfigType.parse({
        version: 1,
        base_url: "http://x:8096",
        system: {},
        startup: { user: { name: "setup", password: "pw" } },
        users: [{ name: "root", password: "pw", renameFrom: "setup" }],
      });
    expect(resolveAdminCredentials(config)?.alternateNames).toEqual(["root"]);
  });
});
