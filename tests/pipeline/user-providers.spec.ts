import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

const client: Record<string, ReturnType<typeof vi.fn>> = {};

vi.mock("../../src/api/jellyfin_client", () => ({
  createJellyfinClient: (): typeof client => client,
}));
vi.mock("../../src/lib/health", () => ({
  waitForHealth: (): Promise<void> => Promise.resolve(),
  waitForRestart: (): Promise<void> => Promise.resolve(),
  resolveWaitTimeoutMs: (): number => 1000,
}));

import { runPipeline } from "../../src/pipeline";

describe("pipeline/user provider ids", () => {
  let dir: string;
  let cfgFile: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "jellarr-prov-"));
    cfgFile = path.join(dir, "config.yml");
    process.env.JELLARR_API_KEY = "key";
    Object.assign(client, {
      getSystemConfiguration: vi.fn().mockResolvedValue({}),
      getUsers: vi
        .fn()
        .mockResolvedValue([
          { Name: "bob", Id: "u1", Policy: {}, Configuration: {} },
        ]),
      getAuthProviders: vi
        .fn()
        .mockResolvedValue([{ Name: "Default", Id: "Known" }]),
      getPasswordResetProviders: vi.fn().mockResolvedValue([]),
      updateUserPolicy: vi.fn().mockResolvedValue(undefined),
      updateUserConfiguration: vi.fn().mockResolvedValue(undefined),
      checkUserPassword: vi.fn().mockResolvedValue("valid"),
    });
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(dir, { recursive: true, force: true });
  });

  async function run(providerId: string): Promise<unknown> {
    await fs.writeFile(
      cfgFile,
      [
        "version: 1",
        'base_url: "http://localhost:8096"',
        "system: {}",
        "users:",
        "  - name: bob",
        "    password: pw",
        `    policy: { authenticationProviderId: ${providerId} }`,
        "",
      ].join("\n"),
    );
    return runPipeline(cfgFile);
  }

  it("whenTheProviderIsUnknown_thenTheRunFailsBeforeAnyUserWrite", async () => {
    await expect(run("Typo")).rejects.toThrow(
      /not a provider the server reports/,
    );
    expect(client.updateUserPolicy).not.toHaveBeenCalled();
  });

  it("whenTheProviderIsKnown_thenItIsWrittenToThePolicyOnce", async () => {
    await run("Known");
    expect(client.updateUserPolicy).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ AuthenticationProviderId: "Known" }),
    );
  });
});
