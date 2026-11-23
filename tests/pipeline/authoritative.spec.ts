import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { guardReadOnly } from "../../src/api/read-only";
import type { JellyfinClient } from "../../src/api/jellyfin.types";

const client: Record<string, ReturnType<typeof vi.fn>> = {};
const calls: string[] = [];

vi.mock("../../src/api/jellyfin_client", () => ({
  createJellyfinClient: (): typeof client => client,
}));
vi.mock("../../src/lib/health", () => ({
  waitForHealth: (): Promise<void> => Promise.resolve(),
  waitForRestart: (): Promise<void> => Promise.resolve(),
  resolveWaitTimeoutMs: (): number => 1000,
}));

import { runPipeline } from "../../src/pipeline";

const DELETES: string[] = [
  "deleteUser",
  "deleteVirtualFolder",
  "deleteApiKey",
  "uninstallPlugin",
];

function reads(): Record<string, unknown> {
  return {
    getServerVersion: "10.11.0",
    getSystemConfiguration: {},
    getUsers: [
      { Id: "u-root", Name: "root", Policy: { IsAdministrator: true } },
      { Id: "u-ann", Name: "ann", Policy: { IsAdministrator: false } },
      { Id: "u-old", Name: "old", Policy: { IsAdministrator: false } },
    ],
    getCurrentUser: undefined,
    getVirtualFolders: [
      {
        Name: "Movies",
        ItemId: "f1",
        Locations: ["/m"],
        LibraryOptions: { PathInfos: [{ Path: "/m" }] },
      },
      { Name: "Gone", ItemId: "f2", Locations: [], LibraryOptions: {} },
    ],
    getApiKeys: [
      { AppName: "jellarr", AccessToken: "env-key" },
      { AppName: "stale", AccessToken: "stale-token" },
    ],
    getPlugins: [
      {
        Name: "Bundled",
        Id: "b",
        Version: "1",
        CanUninstall: false,
        Status: "Active",
      },
      {
        Name: "Extra",
        Id: "x",
        Version: "2",
        CanUninstall: true,
        Status: "Active",
      },
      {
        Name: "Mine",
        Id: "m",
        Version: "1",
        CanUninstall: true,
        Status: "Active",
      },
    ],
    getPackages: [],
    getPendingRestart: false,
    getScheduledTasks: [
      { Id: "t1", Key: "RefreshLibrary", Name: "Scan", Triggers: [] },
    ],
    getLiveTvOptions: {
      TunerHosts: [{ Id: "h", Type: "m3u", Url: "http://old" }],
    },
  };
}

const WRITES: string[] = [
  ...DELETES,
  "createUser",
  "addVirtualFolder",
  "createApiKey",
  "updateUserPolicy",
  "updateUserConfiguration",
  "updateTaskTriggers",
  "deleteTunerHost",
  "saveTunerHost",
  "restartServer",
  "installPackage",
  "updatePluginConfiguration",
  "updateLibraryOptions",
  "updateLiveTvOptions",
  "updateUserPassword",
  "checkUserPassword",
  "setAccessToken",
];

describe("pipeline/authoritative", () => {
  let dir: string;
  let cfgFile: string;
  let output: string;

  async function run(body: string[], dryRun: boolean = false): Promise<void> {
    await fs.writeFile(
      cfgFile,
      [
        "version: 1",
        'base_url: "http://localhost:8096"',
        "system: {}",
        ...body,
        "",
      ].join("\n"),
    );
    await runPipeline(cfgFile, { dryRun });
  }

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "jellarr-auth-"));
    cfgFile = path.join(dir, "config.yml");
    process.env.JELLARR_API_KEY = "env-key";
    calls.length = 0;
    for (const [name, value] of Object.entries(reads())) {
      client[name] = vi.fn().mockImplementation(() => {
        calls.push(name);
        return Promise.resolve(structuredClone(value));
      });
    }
    for (const name of WRITES) {
      client[name] = vi.fn().mockImplementation(() => {
        calls.push(name);
        return Promise.resolve();
      });
    }
    output = "";
    const capture: (...args: unknown[]) => void = (...args: unknown[]) => {
      output += `${args.join(" ")}\n`;
    };
    vi.spyOn(console, "log").mockImplementation(capture);
    vi.spyOn(console, "warn").mockImplementation(capture);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("whenTheFlagsAreOff_thenNothingIsDeleted", async () => {
    await run(["users: [{ name: root, password: x }]"]);
    for (const name of DELETES) expect(client[name]).not.toHaveBeenCalled();
  });

  it("deletesUndeclaredEntriesAfterEveryCreateAndUpdate", async () => {
    await run([
      "authoritative: { users: true, libraries: true, apiKeys: true, plugins: true }",
      "users:",
      "  - { name: root, password: x, policy: { isAdministrator: true } }",
      "  - { name: ann, password: x }",
      "  - { name: newbie, password: x }",
      "library:",
      "  virtualFolders:",
      "    - name: Movies",
      "      collectionType: movies",
      "      libraryOptions: { pathInfos: [{ path: /m }] }",
      "    - name: Shows",
      "      collectionType: tvshows",
      "      libraryOptions: { pathInfos: [{ path: /s }] }",
      "api_keys: [{ name: jellarr }, { name: fresh }]",
      "plugins: [{ name: Mine }]",
    ]);

    expect(client.deleteUser).toHaveBeenCalledExactlyOnceWith("u-old");
    expect(client.deleteVirtualFolder).toHaveBeenCalledExactlyOnceWith("Gone");
    expect(client.deleteApiKey).toHaveBeenCalledExactlyOnceWith("stale-token");
    expect(client.uninstallPlugin).toHaveBeenCalledExactlyOnceWith("x", "2");
    const firstDelete: number = calls.findIndex((name: string) =>
      DELETES.includes(name),
    );
    for (const create of ["createUser", "addVirtualFolder", "createApiKey"]) {
      expect(calls.lastIndexOf(create)).toBeGreaterThanOrEqual(0);
      expect(calls.lastIndexOf(create)).toBeLessThan(firstDelete);
    }
    expect(calls.indexOf("deleteUser")).toBeLessThan(
      calls.indexOf("deleteVirtualFolder"),
    );
    expect(calls.indexOf("deleteApiKey")).toBeLessThan(
      calls.indexOf("uninstallPlugin"),
    );
    expect(calls.indexOf("uninstallPlugin")).toBeLessThan(
      calls.indexOf("restartServer"),
    );
  });

  it("whenDryRun_thenEachDeletionIsADestructivePlanLineAndNothingIsCalled", async () => {
    await run(
      [
        "authoritative: { users: true, libraries: true, apiKeys: true, plugins: true }",
        "users: [{ name: root, password: x, policy: { isAdministrator: true } }, { name: ann, password: x }]",
        "library: { virtualFolders: [{ name: Movies, collectionType: movies, libraryOptions: { pathInfos: [{ path: /m }] } }] }",
        "api_keys: [{ name: jellarr }]",
        "plugins: [{ name: Mine }]",
      ],
      true,
    );

    for (const name of WRITES) expect(client[name]).not.toHaveBeenCalled();
    expect(output).toContain(
      "DESTRUCTIVE user old: would be deleted, and its watch history is lost",
    );
    expect(output).toContain("DESTRUCTIVE library Gone: would be deleted");
    expect(output).toContain("DESTRUCTIVE api key stale: would be revoked");
    expect(output).toContain(
      "DESTRUCTIVE plugin Extra 2: would be uninstalled",
    );
    expect(output).toContain("DRY RUN: changes are pending");
    expect(output).not.toContain("stale-token");
  });

  it("theReadOnlyGuardBlocksEveryDelete", () => {
    const guarded: JellyfinClient = guardReadOnly(
      client as unknown as JellyfinClient,
    );
    expect(() => guarded.deleteUser("u")).toThrow(/read-only/);
    expect(() => guarded.deleteVirtualFolder("n")).toThrow(/read-only/);
    expect(() => guarded.deleteApiKey("t")).toThrow(/read-only/);
    expect(() => guarded.uninstallPlugin("i", "1")).toThrow(/read-only/);
    expect(() => guarded.updateTaskTriggers("t", [])).toThrow(/read-only/);
    expect(client.deleteUser).not.toHaveBeenCalled();
  });

  it("whenSomethingWouldBeMassDeleted_thenNothingAtAllIsDeletedAndTheErrorSaysHow", async () => {
    await expect(
      run([
        "authoritative: { users: true, libraries: true }",
        "users: [{ name: root, password: x, policy: { isAdministrator: true } }, { name: ann, password: x }, { name: old, password: x }]",
        "library: { virtualFolders: [] }",
      ]),
    ).rejects.toThrow(
      /authoritative\.libraries would delete 2 of 2.*allowMassDelete/s,
    );
    for (const name of DELETES) expect(client[name]).not.toHaveBeenCalled();
  });

  it("whenAllowMassDeleteIsSet_thenTheEmptyListIsHonoured", async () => {
    await run([
      "authoritative: { libraries: true, allowMassDelete: true }",
      "library: { virtualFolders: [] }",
    ]);
    expect(client.deleteVirtualFolder).toHaveBeenCalledTimes(2);
  });

  it("neverDeletesTheUserJellarrIsSignedInAs", async () => {
    client.getCurrentUser = vi
      .fn()
      .mockResolvedValue({ Id: "u-old", Name: "Old" });
    await run([
      "authoritative: { users: true }",
      "users: [{ name: root, password: x, policy: { isAdministrator: true } }, { name: ann, password: x }]",
    ]);
    expect(client.deleteUser).not.toHaveBeenCalled();
  });

  it("neverDeletesTheApiKeyJellarrUses", async () => {
    await run([
      "authoritative: { apiKeys: true }",
      "api_keys: [{ name: stale }]",
    ]);
    expect(client.deleteApiKey).not.toHaveBeenCalled();
  });

  it("neverDeletesTheLastAdministrator", async () => {
    await expect(
      run([
        "authoritative: { users: true, allowMassDelete: true }",
        "users: [{ name: ann, password: x }]",
      ]),
    ).rejects.toThrow(/last administrator/);
    expect(client.deleteUser).not.toHaveBeenCalled();
  });

  it("keepSparesNamedEntriesOfEveryKind", async () => {
    await run([
      "authoritative:",
      "  users: true",
      "  libraries: true",
      "  apiKeys: true",
      "  plugins: true",
      "  keep: { users: [old], libraries: [Gone], apiKeys: [stale], plugins: [Extra] }",
      "users: [{ name: root, password: x, policy: { isAdministrator: true } }, { name: ann, password: x }]",
      "library: { virtualFolders: [{ name: Movies, collectionType: movies, libraryOptions: { pathInfos: [{ path: /m }] } }] }",
      "api_keys: [{ name: jellarr }]",
      "plugins: [{ name: Mine }]",
    ]);
    for (const name of DELETES) expect(client[name]).not.toHaveBeenCalled();
  });

  it("authoritativeLiveTvIsAnAliasOfLiveTvAuthoritative", async () => {
    await run([
      "authoritative: { livetv: true }",
      "livetv: { tunerHosts: [] }",
    ]);
    expect(client.deleteTunerHost).toHaveBeenCalledExactlyOnceWith("h");
  });

  it("scheduledTasks_applyOnceThenAreIdempotent", async () => {
    const body: string[] = [
      "scheduledTasks:",
      "  - key: RefreshLibrary",
      "    triggers: [{ type: DailyTrigger, timeOfDay: '03:30' }]",
    ];
    await run(body);
    expect(client.updateTaskTriggers).toHaveBeenCalledExactlyOnceWith("t1", [
      { Type: "DailyTrigger", TimeOfDayTicks: 12600 * 10_000_000 },
    ]);

    client.getScheduledTasks = vi.fn().mockResolvedValue([
      {
        Id: "t1",
        Key: "RefreshLibrary",
        Triggers: [
          {
            Type: "DailyTrigger",
            TimeOfDayTicks: 12600 * 10_000_000,
            IntervalTicks: null,
            DayOfWeek: null,
            MaxRuntimeTicks: null,
          },
        ],
      },
    ]);
    client.updateTaskTriggers.mockClear();
    await run(body);
    expect(client.updateTaskTriggers).not.toHaveBeenCalled();
    expect(output).toContain("✓ scheduled task triggers already up to date");
  });

  it("scheduledTasks_dryRunPlansTheChangeAndUnknownKeysFail", async () => {
    await run(
      [
        "scheduledTasks: [{ key: RefreshLibrary, triggers: [{ type: StartupTrigger }] }]",
      ],
      true,
    );
    expect(output).toContain("scheduled task RefreshLibrary.triggers");
    expect(client.updateTaskTriggers).not.toHaveBeenCalled();
    await expect(
      run(["scheduledTasks: [{ key: Nope, triggers: [] }]"]),
    ).rejects.toThrow(/valid keys: RefreshLibrary/);
  });
});
