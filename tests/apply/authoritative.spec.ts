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

describe("authoritative/users disable mode", () => {
  const now: Date = new Date("2026-03-10T12:00:00.000Z");
  const clock: () => Date = (): Date => now;
  const day: number = 86_400_000;
  const ago: (days: number) => string = (days: number): string =>
    new Date(now.getTime() - days * day).toISOString();
  const users: AuthoritativeState["users"] = [
    { Id: "1", Name: "root", Policy: { IsAdministrator: true } },
    { Id: "2", Name: "ann", Policy: { IsAdministrator: false } },
    { Id: "3", Name: "bob", Policy: { IsAdministrator: false } },
  ] as AuthoritativeState["users"];
  const declared: Declared = { ...noneDeclared, users: ["root"] };
  const plan: (
    cfg: Parameters<typeof planDeletions>[0],
    st: Partial<AuthoritativeState>,
    over?: Partial<Declared>,
  ) => Deletion[] = (
    cfg: Parameters<typeof planDeletions>[0],
    st: Partial<AuthoritativeState>,
    over: Partial<Declared> = {},
  ): Deletion[] =>
    planDeletions(
      cfg,
      state({ users, ...st }),
      { ...declared, ...over },
      nobody,
      clock,
    );

  it("whenUndeclared_thenDisabledWithAMarkerAndNothingDeleted", () => {
    const result: Deletion[] = plan(
      { users: "disable", allowMassDelete: true },
      {},
    );
    expect(result.map((r: Deletion) => r.action)).toEqual([
      "disable",
      "disable",
    ]);
    expect(result[0]?.policy?.IsDisabled).toBe(true);
    expect(result[0]?.marker).toBe(now.toISOString());
    expect(result[0]?.plan).toBe(
      "would disable user ann (not declared or kept); never deleted",
    );
  });

  it("whenDeleteDisabledAfterIsSet_thenThePlanNamesTheDate", () => {
    const result: Deletion[] = plan(
      { users: "disable", deleteDisabledAfter: "2d", allowMassDelete: true },
      {},
    );
    expect(result[0]?.plan).toBe(
      "would disable user ann (not declared or kept); deletion after 2026-03-12T12:00:00.000Z",
    );
  });

  it("whenAlreadyDisabledWithoutMarker_thenItGetsAMarkerNowAndStaysDisabled", () => {
    const disabled: AuthoritativeState["users"] = [
      users[0],
      { Id: "2", Name: "ann", Policy: { IsDisabled: true } },
    ] as AuthoritativeState["users"];
    const result: Deletion[] = plan(
      { users: "disable", deleteDisabledAfter: "1d" },
      { users: disabled },
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      action: "mark",
      marker: now.toISOString(),
    });
    expect(result[0]?.policy).toBeUndefined();
  });

  it("whenKeptWithAMarker_thenReEnabledAndMarkerCleared", () => {
    const disabled: AuthoritativeState["users"] = [
      users[0],
      { Id: "2", Name: "ann", Policy: { IsDisabled: true } },
    ] as AuthoritativeState["users"];
    const result: Deletion[] = plan(
      { users: "disable", keep: { users: ["ann"] } },
      { users: disabled, markers: new Map([["2", ago(1)]]) },
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ action: "enable", marker: null });
    expect(result[0]?.policy?.IsDisabled).toBe(false);
    expect(result[0]?.plan).toBe("would re-enable user ann (kept again)");
  });

  it("whenKeptWithoutAMarker_thenAnAdministratorsDisableWins", () => {
    const disabled: AuthoritativeState["users"] = [
      users[0],
      { Id: "2", Name: "ann", Policy: { IsDisabled: true } },
    ] as AuthoritativeState["users"];
    expect(
      plan({ users: "disable", keep: { users: ["ann"] } }, { users: disabled }),
    ).toEqual([]);
  });

  it("whenKeptAndDeclaredDisabledInTheConfig_thenItIsNotReEnabled", () => {
    const disabled: AuthoritativeState["users"] = [
      users[0],
      { Id: "2", Name: "ann", Policy: { IsDisabled: true } },
    ] as AuthoritativeState["users"];
    expect(
      plan(
        { users: "disable" },
        { users: disabled, markers: new Map([["2", ago(1)]]) },
        { users: ["root", "ann"], disabled: ["ann"] },
      ),
    ).toEqual([]);
  });

  it("whenTheMarkerPassesTheThreshold_thenDeleted", () => {
    const disabled: AuthoritativeState["users"] = [
      users[0],
      { Id: "2", Name: "ann", Policy: { IsDisabled: true } },
    ] as AuthoritativeState["users"];
    const result: Deletion[] = plan(
      { users: "disable", deleteDisabledAfter: "1d" },
      { users: disabled, markers: new Map([["2", ago(2)]]) },
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.action).toBeUndefined();
    expect(result[0]?.plan).toBe(
      `DESTRUCTIVE would delete user ann (disabled by jellarr since ${ago(2)}), and its watch history is lost`,
    );
  });

  it("whenTheMarkerIsYoungerThanTheThreshold_thenNothingHappens", () => {
    const disabled: AuthoritativeState["users"] = [
      users[0],
      { Id: "2", Name: "ann", Policy: { IsDisabled: true } },
    ] as AuthoritativeState["users"];
    expect(
      plan(
        { users: "disable", deleteDisabledAfter: "3d" },
        { users: disabled, markers: new Map([["2", ago(2)]]) },
      ),
    ).toEqual([]);
    expect(
      plan(
        { users: "disable" },
        { users: disabled, markers: new Map([["2", ago(900)]]) },
      ),
    ).toEqual([]);
  });

  it("holdsTheRailsInDisableMode", () => {
    expect(() => plan({ users: "disable" }, {})).toThrow(
      /2 of 3 users, more than half.*allowMassDelete/s,
    );
    expect(() =>
      plan(
        { users: "disable", allowMassDelete: true },
        {},
        { users: ["ann", "bob"] },
      ),
    ).toThrow(/last enabled administrator/);
    expect(
      plan({ users: "disable", keep: { users: ["ann", "bob"] } }, {}),
    ).toEqual([]);
  });

  it("whenRunTwice_thenTheSecondRunChangesNothing", async () => {
    const store: Map<
      string,
      { policy: Record<string, unknown>; marker?: string }
    > = new Map();
    const cfg: Parameters<typeof planDeletions>[0] = {
      users: "disable",
      deleteDisabledAfter: "1d",
      allowMassDelete: true,
    };
    const snapshot: () => AuthoritativeState = (): AuthoritativeState =>
      state({
        users: users.map((u: AuthoritativeState["users"][number]) => ({
          ...u,
          Policy: { ...u.Policy, ...(store.get(u.Id ?? "")?.policy ?? {}) },
        })) as AuthoritativeState["users"],
        markers: new Map(
          [...store].flatMap(([id, v]: [string, { marker?: string }]) =>
            v.marker ? [[id, v.marker] as [string, string]] : [],
          ),
        ),
      });
    const deleteUser: ReturnType<typeof vi.fn> = vi.fn();
    const fake: JellyfinClient = {
      updateUserPolicy: (id: string, policy: Record<string, unknown>) => {
        store.set(id, { ...store.get(id), policy });
        return Promise.resolve();
      },
      getDisplayPreferences: (id: string) =>
        Promise.resolve({
          CustomPrefs: store.get(id)?.marker
            ? { "jellarr.disabledAt": store.get(id)?.marker }
            : {},
        }),
      updateDisplayPreferences: (
        id: string,
        body: { CustomPrefs?: Record<string, string> },
      ) => {
        const marker: string | undefined =
          body.CustomPrefs?.["jellarr.disabledAt"];
        store.set(id, {
          policy: store.get(id)?.policy ?? {},
          ...(marker ? { marker } : {}),
        });
        return Promise.resolve();
      },
      deleteUser,
    } as unknown as JellyfinClient;

    const first: Deletion[] = planDeletions(
      cfg,
      snapshot(),
      declared,
      nobody,
      clock,
    );
    expect(first).toHaveLength(2);
    await applyDeletions(fake, first);
    expect(planDeletions(cfg, snapshot(), declared, nobody, clock)).toEqual([]);
    const later: Date = new Date(now.getTime() + 2 * day);
    const deletes: Deletion[] = planDeletions(
      cfg,
      snapshot(),
      declared,
      nobody,
      (): Date => later,
    );
    expect(deletes.map((d: Deletion) => d.action)).toEqual([
      undefined,
      undefined,
    ]);
    await applyDeletions(fake, deletes);
    expect(deleteUser).toHaveBeenCalledTimes(2);
  });

  const onlyAnn: (marker: string | undefined) => Deletion[] = (
    marker: string | undefined,
  ): Deletion[] =>
    plan(
      { users: "disable", deleteDisabledAfter: "30d" },
      {
        users: [
          users[0],
          { Id: "2", Name: "ann", Policy: { IsDisabled: true } },
        ] as AuthoritativeState["users"],
        markers: new Map(marker === undefined ? [] : [["2", marker]]),
      },
    );
  const offset: (ms: number) => string = (ms: number): string =>
    new Date(now.getTime() - ms).toISOString();

  it("whenTheMarkerIsOneMsShortOfTheThreshold_thenNotDeleted", () => {
    expect(onlyAnn(offset(30 * day - 1))).toEqual([]);
  });

  it("whenTheMarkerIsExactlyTheThreshold_thenDeleted", () => {
    expect(onlyAnn(offset(30 * day)).map((r: Deletion) => r.action)).toEqual([
      undefined,
    ]);
  });

  it("whenTheMarkerIsUnparseable_thenRewrittenNowAndNeverDeleted", () => {
    const result: Deletion[] = onlyAnn("garbage");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      action: "mark",
      marker: now.toISOString(),
    });
  });

  it("whenReEnabled_thenTheWriteDropsOnlyTheMarkerAndKeepsOtherPrefs", async () => {
    const prefs: { CustomPrefs: Record<string, string> } = {
      CustomPrefs: {
        "jellarr.disabledAt": ago(1),
        "other.client": " keep me\u00e9 ",
        "web.theme": "dark",
      },
    };
    const written: unknown[] = [];
    const fake: JellyfinClient = {
      updateUserPolicy: vi.fn(),
      getDisplayPreferences: (): Promise<unknown> => Promise.resolve(prefs),
      updateDisplayPreferences: (
        userId: string,
        body: unknown,
      ): Promise<void> => {
        written.push(body);
        return Promise.resolve();
      },
    } as unknown as JellyfinClient;
    const disabled: AuthoritativeState["users"] = [
      users[0],
      { Id: "2", Name: "ann", Policy: { IsDisabled: true } },
    ] as AuthoritativeState["users"];
    const result: Deletion[] = plan(
      { users: "disable", keep: { users: ["ann"] } },
      { users: disabled, markers: new Map([["2", ago(1)]]) },
    );
    await applyDeletions(fake, result);
    const body: { CustomPrefs: Record<string, string> } = written[0] as {
      CustomPrefs: Record<string, string>;
    };
    expect("jellarr.disabledAt" in body.CustomPrefs).toBe(false);
    expect(body.CustomPrefs).toEqual({
      "other.client": " keep me\u00e9 ",
      "web.theme": "dark",
    });
  });

  it("whenDisabledAgainAfterAReEnable_thenAFreshTimestampIsWritten", async () => {
    const written: Array<{ CustomPrefs: Record<string, string> }> = [];
    const fake: JellyfinClient = {
      updateUserPolicy: vi.fn(),
      getDisplayPreferences: (): Promise<unknown> =>
        Promise.resolve({ CustomPrefs: {} }),
      updateDisplayPreferences: (
        userId: string,
        body: { CustomPrefs: Record<string, string> },
      ): Promise<void> => {
        written.push(body);
        return Promise.resolve();
      },
    } as unknown as JellyfinClient;
    await applyDeletions(
      fake,
      plan({ users: "disable", allowMassDelete: true }, {}),
    );
    expect(written[0]?.CustomPrefs["jellarr.disabledAt"]).toBe(
      now.toISOString(),
    );
  });

  describe("usersScope", () => {
    const scoped: AuthoritativeState["users"] = [
      { Id: "1", Name: "root", Policy: { IsAdministrator: true } },
      { Id: "2", Name: "sso1", Policy: { AuthenticationProviderId: "p" } },
      { Id: "3", Name: "sso2", Policy: { AuthenticationProviderId: "q" } },
      {
        Id: "4",
        Name: "sso3",
        Policy: { AuthenticationProviderId: "p", IsDisabled: true },
      },
      { Id: "5", Name: "local", Policy: { IsDisabled: true } },
    ] as AuthoritativeState["users"];
    const scope: { authenticationProviderId: string | string[] } = {
      authenticationProviderId: "p",
    };

    it("whenScoped_thenOnlyThatProvidersUsersAreCandidatesInDisableMode", () => {
      const result: Deletion[] = plan(
        { users: "disable", usersScope: scope },
        { users: scoped, markers: new Map([["5", ago(900)]]) },
      );
      expect(
        result.map((r: Deletion) => `${r.name}:${r.action ?? "delete"}`),
      ).toEqual(["sso1:disable", "sso3:mark"]);
    });

    it("whenScoped_thenDeleteModeLeavesOtherUsersAlone", () => {
      const result: Deletion[] = plan(
        { users: true, usersScope: scope, allowMassDelete: true },
        { users: scoped },
      );
      expect(names(result)).toEqual(["sso1", "sso3"]);
    });

    it("whenScoped_thenReEnableTouchesOnlyScopedUsers", () => {
      const result: Deletion[] = plan(
        {
          users: "disable",
          usersScope: scope,
          keep: { users: ["sso3", "local"] },
        },
        {
          users: scoped,
          markers: new Map([
            ["4", ago(1)],
            ["5", ago(1)],
          ]),
        },
      );
      expect(
        result.map((r: Deletion) => `${r.name}:${r.action ?? "delete"}`),
      ).toEqual(["sso1:disable", "sso3:enable"]);
    });

    it("whenScoped_thenTheListFormMatchesAnyListedProvider", () => {
      const result: Deletion[] = plan(
        {
          users: "disable",
          usersScope: { authenticationProviderId: ["p", "q"] },
          allowMassDelete: true,
        },
        { users: scoped },
      );
      expect(result.map((r: Deletion) => r.name)).toEqual([
        "sso1",
        "sso2",
        "sso3",
      ]);
    });

    it("whenScoped_thenTheMassRailCountsOnlyUsersInScope", () => {
      expect(
        plan({ users: "disable", usersScope: scope }, { users: scoped }),
      ).toHaveLength(2);
      expect(() =>
        plan(
          { users: "disable", usersScope: { authenticationProviderId: "q" } },
          { users: scoped },
        ),
      ).toThrow(/1 of 1 users, more than half/);
    });

    it("whenNoScopeIsSet_thenEveryUserIsInScope", () => {
      expect(
        plan({ users: "disable", allowMassDelete: true }, { users: scoped })
          .length,
      ).toBeGreaterThan(2);
    });
  });
});
