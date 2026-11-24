import { describe, it, expect, vi, type Mock } from "vitest";
import {
  applyDisplayPreferences,
  calculateDisplayPreferencesDiff,
  readDisplayPreferences,
} from "../../src/apply/display-preferences";
import { DisplayPreferencesConfigType } from "../../src/types/config/display-preferences";
import { UserConfigType } from "../../src/types/config/users";
import type { JellyfinClient } from "../../src/api/jellyfin.types";
import type { UserDtoSchema } from "../../src/types/schema/users";

vi.mock("../../src/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const users: UserDtoSchema[] = [{ Id: "u1", Name: "bob" } as UserDtoSchema];
const stored: Record<string, unknown> = {
  Id: "usersettings",
  Client: "emby",
  SortBy: "SortName",
  SortOrder: "Ascending",
  CustomPrefs: { keep: "me", theme: "dark" },
};

interface Spied {
  client: JellyfinClient;
  get: Mock;
  update: Mock;
}

function spied(prefs: Record<string, unknown>): Spied {
  const get: Mock = vi.fn().mockResolvedValue(structuredClone(prefs));
  const update: Mock = vi.fn().mockResolvedValue(undefined);
  return {
    client: {
      getDisplayPreferences: get,
      updateDisplayPreferences: update,
    } as unknown as JellyfinClient,
    get,
    update,
  };
}

function clientReturning(prefs: Record<string, unknown>): JellyfinClient {
  return spied(prefs).client;
}

async function plan(
  prefs: Record<string, unknown>,
  desired: Array<Record<string, unknown>>,
): Promise<ReturnType<typeof calculateDisplayPreferencesDiff>> {
  const config: Array<ReturnType<typeof UserConfigType.parse>> = [
    UserConfigType.parse({
      name: "bob",
      password: "x",
      displayPreferences: desired,
    }),
  ];
  const current: Awaited<ReturnType<typeof readDisplayPreferences>> =
    await readDisplayPreferences(clientReturning(prefs), users, config);
  return calculateDisplayPreferencesDiff(current, config);
}

describe("per-user display preferences", () => {
  it("whenCustomPrefsAreDeclared_thenDeclaredKeysMergeAndOthersSurvive", async () => {
    const changes: Awaited<ReturnType<typeof plan>> = await plan(stored, [
      { client: "emby", customPrefs: { theme: "light", added: true } },
    ]);
    expect(changes).toHaveLength(1);
    expect(changes?.[0]?.next).toMatchObject({
      SortBy: "SortName",
      CustomPrefs: { keep: "me", theme: "light", added: "true" },
    });
  });

  it("whenAlreadyApplied_thenSecondRunChangesNothing", async () => {
    const changes: Awaited<ReturnType<typeof plan>> = await plan(stored, [
      {
        client: "emby",
        sortOrder: "Ascending",
        customPrefs: { theme: "dark" },
      },
    ]);
    expect(changes).toBeUndefined();
  });

  it("whenIdIsOmitted_thenItDefaultsToUsersettings", async () => {
    const { client, get }: Spied = spied(stored);
    await readDisplayPreferences(client, users, [
      UserConfigType.parse({
        name: "bob",
        password: "x",
        displayPreferences: [{ client: "emby", showSidebar: true }],
      }),
    ]);
    expect(get).toHaveBeenCalledWith("u1", "usersettings", "emby");
  });

  it("whenApplied_thenEachChangeIsWrittenUnderItsIdAndClient", async () => {
    const { client, update }: Spied = spied(stored);
    await applyDisplayPreferences(client, [
      {
        userId: "u1",
        userName: "bob",
        id: "usersettings",
        client: "emby",
        current: {},
        next: { SortBy: "Name" },
      },
    ]);
    expect(update).toHaveBeenCalledWith(
      "u1",
      { SortBy: "Name" },
      "usersettings",
      "emby",
    );
  });

  it("whenTheEntryIsJellarrsOwnMarker_thenTheConfigIsRejected", () => {
    expect(
      DisplayPreferencesConfigType.safeParse({ client: "jellarr" }).success,
    ).toBe(false);
    expect(
      DisplayPreferencesConfigType.safeParse({ client: "emby", id: "jellarr" })
        .success,
    ).toBe(false);
  });

  it("whenTheSameIdAndClientAreDeclaredTwice_thenTheUserIsRejected", () => {
    expect(
      UserConfigType.safeParse({
        name: "bob",
        password: "x",
        displayPreferences: [{ client: "emby" }, { client: "emby" }],
      }).success,
    ).toBe(false);
  });

  it("whenTheUserDoesNotExistYet_thenNothingIsRead", async () => {
    const { client, get }: Spied = spied(stored);
    const current: Awaited<ReturnType<typeof readDisplayPreferences>> =
      await readDisplayPreferences(
        client,
        [],
        [
          UserConfigType.parse({
            name: "bob",
            password: "x",
            displayPreferences: [{ client: "emby" }],
          }),
        ],
      );
    expect(current.size).toBe(0);
    expect(get).not.toHaveBeenCalled();
  });
});
