import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

const order: string[] = [];
const client: Record<string, ReturnType<typeof vi.fn>> = {};

function step(name: string, value?: unknown): ReturnType<typeof vi.fn> {
  return vi.fn().mockImplementation(() => {
    order.push(name);
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

describe("pipeline/first boot", () => {
  let dir: string;
  let cfgFile: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "jellarr-boot-"));
    cfgFile = path.join(dir, "config.yml");
    const pwFile: string = path.join(dir, "pw");
    await fs.writeFile(pwFile, "s3cret\n");
    await fs.writeFile(
      cfgFile,
      [
        "version: 1",
        'base_url: "http://localhost:8096"',
        "system: {}",
        "startup:",
        "  serverName: Home",
        "  user:",
        "    name: admin",
        `    passwordFile: ${pwFile}`,
        "",
      ].join("\n"),
    );
    delete process.env.JELLARR_API_KEY;
    order.length = 0;
    Object.assign(client, {
      getPublicSystemInfo: step("info", { StartupWizardCompleted: false }),
      updateStartupConfiguration: step("configuration"),
      getStartupUser: step("getUser"),
      updateStartupUser: step("user"),
      completeStartupWizard: step("complete"),
      authenticateByName: step("authenticate", "tok"),
      setAccessToken: step("setToken"),
      getSystemConfiguration: step("systemConfiguration", {}),
    });
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("whenServerPristine_thenWizardRunsThenAdminSignsIn", async () => {
    // Act
    await runPipeline(cfgFile);

    // Assert
    expect(order).toEqual([
      "info",
      "configuration",
      "getUser",
      "user",
      "complete",
      "authenticate",
      "setToken",
      "systemConfiguration",
    ]);
    expect(client.authenticateByName).toHaveBeenCalledWith("admin", "s3cret");
  });

  it("whenWizardAlreadyCompleted_thenWizardIsSkippedAndKeyIsUsed", async () => {
    // Arrange
    process.env.JELLARR_API_KEY = "key";
    client.getPublicSystemInfo = step("info", { StartupWizardCompleted: true });

    // Act
    await runPipeline(cfgFile);

    // Assert
    expect(order).toEqual(["info", "systemConfiguration"]);
  });
});
