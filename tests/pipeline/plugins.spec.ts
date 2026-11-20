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
  waitForRestart: (): Promise<void> => {
    order.push("wait");
    return Promise.resolve();
  },
  resolveWaitTimeoutMs: (): number => 1000,
}));

import { runPipeline } from "../../src/pipeline";

const GUID: string = "505ce9d1-d916-42fa-86ca-673ef241d7df";
const catalog: unknown[] = [
  {
    name: "SSO Authentication",
    guid: GUID,
    versions: [{ version: "5.1.1", repositoryUrl: "https://r/manifest" }],
  },
];
const activeSso: Record<string, string> = {
  Name: "SSO-Auth",
  Id: GUID,
  Version: "5.1.1.0",
  Status: "Active",
};

describe("pipeline/plugin restart", () => {
  let cfgFile: string;
  let dir: string;

  async function writeConfig(withConfiguration: boolean): Promise<void> {
    await fs.writeFile(
      cfgFile,
      [
        "version: 1",
        'base_url: "http://localhost:8096"',
        "system: {}",
        "plugins:",
        '  - name: "SSO Authentication"',
        ...(withConfiguration
          ? ["    configuration:", "      Enabled: true"]
          : []),
        "",
      ].join("\n"),
    );
  }

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "jellarr-plugins-"));
    cfgFile = path.join(dir, "config.yml");
    process.env.JELLARR_API_KEY = "key";
    order.length = 0;
    Object.assign(client, {
      getSystemConfiguration: step("system", {}),
      getPackages: step("packages", catalog),
      getServerVersion: step("version", "10.11.0"),
      installPackage: step("install"),
      uninstallPlugin: step("uninstall"),
      restartServer: step("restart"),
      getPluginConfiguration: step("readConfig", { Enabled: false }),
      updatePluginConfiguration: step("writeConfig"),
    });
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("whenPluginIsInstalled_thenRestartsWaitsRefetchesAndConfigures", async () => {
    // Arrange
    await writeConfig(true);
    client.getPlugins = vi
      .fn()
      .mockImplementationOnce(() => {
        order.push("plugins(before)");
        return Promise.resolve([]);
      })
      .mockImplementation(() => {
        order.push("plugins(after)");
        return Promise.resolve([activeSso]);
      });

    // Act
    await runPipeline(cfgFile);

    // Assert
    expect(order.filter((name: string) => name !== "system")).toEqual([
      "plugins(before)",
      "packages",
      "version",
      "install",
      "restart",
      "wait",
      "plugins(after)",
      "readConfig",
      "writeConfig",
    ]);
  });

  it("whenNothingChanged_thenServerIsNotRestarted", async () => {
    // Arrange
    await writeConfig(true);
    client.getPlugins = vi.fn().mockResolvedValue([activeSso]);
    client.getPluginConfiguration = step("readConfig", { Enabled: true });

    // Act
    await runPipeline(cfgFile);

    // Assert
    expect(client.restartServer).not.toHaveBeenCalled();
    expect(client.installPackage).not.toHaveBeenCalled();
  });

  it("whenSupersededCopyIsRemoved_thenServerRestartsAgain", async () => {
    // Arrange
    await writeConfig(false);
    const old: Record<string, string> = {
      ...activeSso,
      Version: "5.0.0.0",
      Status: "Superseded",
    };
    client.getPlugins = vi.fn().mockResolvedValue([activeSso, old]);

    // Act
    await runPipeline(cfgFile);

    // Assert
    expect(client.uninstallPlugin).toHaveBeenCalledWith(GUID, "5.0.0.0");
    expect(client.restartServer).toHaveBeenCalledTimes(1);
    expect(order.indexOf("uninstall")).toBeLessThan(order.indexOf("restart"));
  });

  it("whenDeclaredConfigurationCannotBeReadAfterRestart_thenRunFails", async () => {
    // Arrange
    await writeConfig(true);
    client.getPlugins = vi.fn().mockResolvedValue([activeSso]);
    client.getPluginConfiguration = vi
      .fn()
      .mockRejectedValue(new Error("GET /Plugins/x/Configuration failed: 404"));

    // Act + Assert
    await expect(runPipeline(cfgFile)).rejects.toThrow(
      /declares a configuration but it cannot be read/,
    );
  });
});
