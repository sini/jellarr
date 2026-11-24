import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

const order: string[] = [];
const client: Record<string, ReturnType<typeof vi.fn>> = {};

function step(name: string, value?: unknown): ReturnType<typeof vi.fn> {
  return vi.fn().mockImplementation((...args: unknown[]) => {
    order.push(
      `${name}${args.length > 0 ? `(${args.map((a: unknown) => (typeof a === "string" ? a : "…")).join(",")})` : ""}`,
    );
    return Promise.resolve(value);
  });
}

vi.mock("../../src/api/jellyfin_client", () => ({
  createJellyfinClient: (): typeof client => client,
}));
vi.mock("../../src/lib/health", () => ({
  waitForHealth: (): Promise<void> => Promise.resolve(),
  waitForRestart: (): Promise<void> => Promise.resolve(),
  resolveWaitTimeoutMs: (): number => 1000,
}));

import { runPipeline } from "../../src/pipeline";

describe("pipeline/user rename", () => {
  let dir: string;
  let cfgFile: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "jellarr-rename-"));
    cfgFile = path.join(dir, "config.yml");
    delete process.env.JELLARR_API_KEY;
    order.length = 0;
    const admin: Record<string, unknown> = {
      Name: "admin",
      Id: "u1",
      Policy: { IsAdministrator: true },
      Configuration: {},
    };
    Object.assign(client, {
      getSystemConfiguration: step("system", {}),
      setAccessToken: step("token"),
      authenticateByName: vi.fn().mockImplementation((name: string) => {
        order.push(`signin(${name})`);
        return name === "admin"
          ? Promise.resolve("tok")
          : Promise.reject(new Error("401"));
      }),
      getUsers: vi
        .fn()
        .mockResolvedValueOnce([admin])
        .mockResolvedValue([{ ...admin, Name: "root" }]),
      renameUser: step("rename"),
      updateUserPolicy: step("policy"),
      checkUserPassword: step("check", "valid"),
    });
    await fs.writeFile(
      cfgFile,
      [
        "version: 1",
        'base_url: "http://localhost:8096"',
        "system: {}",
        "users:",
        "  - name: root",
        "    renameFrom: admin",
        "    password: hunter2",
        "    policy: { isAdministrator: true }",
        "",
      ].join("\n"),
    );
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("whenAdminIsRenamedWithoutAnApiKey_thenItSignsInByTheOldNameThenRenames", async () => {
    await runPipeline(cfgFile);

    expect(
      order.filter((name: string) => /^(signin|rename)/.test(name)),
    ).toEqual(["signin(root)", "signin(admin)", "rename(u1,…)"]);
    expect(client.renameUser).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ Name: "root", Id: "u1" }),
    );
  });

  it("whenAlreadyRenamed_thenNothingIsRenamedAgain", async () => {
    client.getUsers = vi
      .fn()
      .mockResolvedValue([
        {
          Name: "root",
          Id: "u1",
          Policy: { IsAdministrator: true },
          Configuration: {},
        },
      ]);
    client.authenticateByName = vi.fn().mockResolvedValue("tok");

    await runPipeline(cfgFile);

    expect(client.renameUser).not.toHaveBeenCalled();
  });
});
