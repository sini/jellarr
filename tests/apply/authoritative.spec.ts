import { describe, it, expect, vi } from "vitest";
import {
  planDeletions,
  applyDeletions,
  type AuthoritativeState,
  type Declared,
  type Protected,
  type Deletion,
} from "../../src/apply/authoritative";
import type { JellyfinClient } from "../../src/api/jellyfin.types";

const noneDeclared: Declared = {
  users: [],
  libraries: [],
  plugins: [],
  apiKeys: [],
  adminOverrides: new Map(),
};
const nobody: Protected = { users: [], apiKeyToken: undefined };

function state(over: Partial<AuthoritativeState> = {}): AuthoritativeState {
  return { users: [], folders: [], apiKeys: [], plugins: [], ...over };
}

const names: (deletions: Deletion[]) => string[] = (
  deletions: Deletion[],
): string[] => deletions.map((deletion: Deletion) => deletion.name);

describe("authoritative/users", () => {
  const users: AuthoritativeState["users"] = [
    { Id: "1", Name: "root", Policy: { IsAdministrator: true } },
    { Id: "2", Name: "Alice", Policy: { IsAdministrator: false } },
    { Id: "3", Name: "bob", Policy: { IsAdministrator: false } },
    { Id: "4", Name: "carol", Policy: { IsAdministrator: false } },
  ] as AuthoritativeState["users"];

  it("whenFlagIsOff_thenNothingIsDeleted", () => {
    expect(planDeletions({}, state({ users }), noneDeclared, nobody)).toEqual(
      [],
    );
    expect(
      planDeletions(undefined, state({ users }), noneDeclared, nobody),
    ).toEqual([]);
  });

  it("whenUndeclared_thenDeletedAndPlanWarnsAboutWatchHistory", () => {
    const result: Deletion[] = planDeletions(
      { users: true },
      state({ users }),
      { ...noneDeclared, users: ["root", "alice", "bob"] },
      nobody,
    );
    expect(names(result)).toEqual(["carol"]);
    expect(result[0]?.plan).toMatch(/^DESTRUCTIVE .*watch history is lost/);
  });

  it("whenTheSignedInUserIsUndeclared_thenItIsSpared", () => {
    const result: Deletion[] = planDeletions(
      { users: true },
      state({ users }),
      { ...noneDeclared, users: ["root", "alice", "bob"] },
      { users: ["CAROL"], apiKeyToken: undefined },
    );
    expect(result).toEqual([]);
  });

  it("whenTheOnlyAdministratorWouldGo_thenItRefuses", () => {
    expect(() =>
      planDeletions(
        { users: true, allowMassDelete: true },
        state({ users }),
        { ...noneDeclared, users: ["alice", "bob"] },
        nobody,
      ),
    ).toThrow(/last administrator/);
  });

  it("whenTheConfigDemotesTheOnlyDeclaredAdmin_thenItRefuses", () => {
    expect(() =>
      planDeletions(
        { users: true },
        state({ users }),
        {
          ...noneDeclared,
          users: ["root", "alice", "bob"],
          adminOverrides: new Map([["root", false]]),
        },
        nobody,
      ),
    ).toThrow(/last administrator/);
  });

  it("whenKeepListsAUser_thenItIsSpared", () => {
    const result: Deletion[] = planDeletions(
      { users: true, keep: { users: ["carol"] } },
      state({ users }),
      { ...noneDeclared, users: ["root", "alice", "bob"] },
      nobody,
    );
    expect(result).toEqual([]);
  });

  it("whenMoreThanHalfWouldGo_thenItRefusesUnlessAllowed", () => {
    const declared: Declared = { ...noneDeclared, users: ["root"] };
    expect(() =>
      planDeletions({ users: true }, state({ users }), declared, nobody),
    ).toThrow(/3 of 4 users, more than half.*allowMassDelete/s);
    expect(
      names(
        planDeletions(
          { users: true, allowMassDelete: true },
          state({ users }),
          declared,
          nobody,
        ),
      ),
    ).toEqual(["Alice", "bob", "carol"]);
  });

  it("whenExactlyHalfWouldGo_thenItProceeds", () => {
    const result: Deletion[] = planDeletions(
      { users: true },
      state({ users }),
      { ...noneDeclared, users: ["root", "alice"] },
      nobody,
    );
    expect(names(result)).toEqual(["bob", "carol"]);
  });
});

describe("authoritative/libraries", () => {
  const folders: AuthoritativeState["folders"] = [
    { Name: "Movies" },
    { Name: "Shows" },
    { Name: 'Odd "name"' },
  ];

  it("whenUndeclared_thenDeleted", () => {
    const result: Deletion[] = planDeletions(
      { libraries: true },
      state({ folders }),
      { ...noneDeclared, libraries: ["Movies", "Shows"] },
      nobody,
    );
    expect(names(result)).toEqual(['Odd "name"']);
  });

  it("whenTheListIsEmpty_thenItRefuses", () => {
    expect(() =>
      planDeletions(
        { libraries: true },
        state({ folders }),
        noneDeclared,
        nobody,
      ),
    ).toThrow(/3 of 3 libraries/);
  });

  it("whenKeepListsOne_thenItIsSpared", () => {
    const result: Deletion[] = planDeletions(
      { libraries: true, keep: { libraries: ["Shows"] } },
      state({ folders }),
      { ...noneDeclared, libraries: ["Movies"] },
      nobody,
    );
    expect(names(result)).toEqual(['Odd "name"']);
  });
});

describe("authoritative/apiKeys", () => {
  const apiKeys: AuthoritativeState["apiKeys"] = [
    { AppName: "jellarr", AccessToken: "t-active" },
    { AppName: "old", AccessToken: "t-old" },
    { AppName: "other", AccessToken: "t-other" },
    { AppName: "kept", AccessToken: "t-kept" },
  ];

  it("whenUndeclared_thenRevokedByTokenAndTheActiveKeyIsSpared", () => {
    const result: Deletion[] = planDeletions(
      { apiKeys: true, keep: { apiKeys: ["kept"] } },
      state({ apiKeys }),
      noneDeclared,
      { users: [], apiKeyToken: "t-active" },
    );
    expect(result.map((deletion: Deletion) => deletion.id)).toEqual([
      "t-old",
      "t-other",
    ]);
    expect(JSON.stringify(result.map((d: Deletion) => d.plan))).not.toContain(
      "t-old",
    );
  });

  it("whenMoreThanHalfWouldGo_thenItRefuses", () => {
    expect(() =>
      planDeletions(
        { apiKeys: true },
        state({ apiKeys }),
        { ...noneDeclared, apiKeys: ["jellarr"] },
        nobody,
      ),
    ).toThrow(/3 of 4 apiKeys/);
  });
});

describe("authoritative/plugins", () => {
  const plugins: AuthoritativeState["plugins"] = [
    {
      Name: "Bundled",
      Id: "b",
      Version: "1",
      CanUninstall: false,
      Status: "Active",
    },
    {
      Name: "Declared",
      Id: "d",
      Version: "1",
      CanUninstall: true,
      Status: "Active",
    },
    {
      Name: "Extra",
      Id: "e",
      Version: "2",
      CanUninstall: true,
      Status: "Active",
    },
    {
      Name: "Old",
      Id: "o",
      Version: "1",
      CanUninstall: true,
      Status: "Superseded",
    },
    {
      Name: "Kept",
      Id: "k",
      Version: "1",
      CanUninstall: true,
      Status: "Active",
    },
    {
      Name: "Declared2",
      Id: "d2",
      Version: "1",
      CanUninstall: true,
      Status: "Active",
    },
  ];

  it("whenUndeclared_thenOnlyRemovableLivePluginsAreUninstalled", () => {
    const result: Deletion[] = planDeletions(
      { plugins: true, keep: { plugins: ["Kept"] } },
      state({ plugins }),
      { ...noneDeclared, plugins: ["Declared", "Declared2"] },
      nobody,
    );
    expect(result).toMatchObject([
      { kind: "plugins", name: "Extra", id: "e", version: "2" },
    ]);
  });

  it("whenBundledPluginsAreTheOnlyOnes_thenNothingIsEverTouched", () => {
    expect(
      planDeletions(
        { plugins: true, allowMassDelete: true },
        state({ plugins: [plugins[0] as never] }),
        noneDeclared,
        nobody,
      ),
    ).toEqual([]);
  });

  it("whenAllRemovableWouldGo_thenItRefuses", () => {
    expect(() =>
      planDeletions(
        { plugins: true },
        state({ plugins }),
        noneDeclared,
        nobody,
      ),
    ).toThrow(/more than half/);
  });
});

describe("authoritative/applyDeletions", () => {
  it("callsTheMatchingEndpointPerKind", async () => {
    const client: Record<string, ReturnType<typeof vi.fn>> = {
      deleteUser: vi.fn(),
      deleteVirtualFolder: vi.fn(),
      deleteApiKey: vi.fn(),
      uninstallPlugin: vi.fn(),
    };
    await applyDeletions(client as unknown as JellyfinClient, [
      { kind: "users", name: "a", id: "u1", plan: "" },
      { kind: "libraries", name: "L", id: "L", plan: "" },
      { kind: "apiKeys", name: "k", id: "tok", plan: "" },
      { kind: "plugins", name: "p", id: "pid", version: "3", plan: "" },
    ]);
    expect(client.deleteUser).toHaveBeenCalledWith("u1");
    expect(client.deleteVirtualFolder).toHaveBeenCalledWith("L");
    expect(client.deleteApiKey).toHaveBeenCalledWith("tok");
    expect(client.uninstallPlugin).toHaveBeenCalledWith("pid", "3");
  });
});
