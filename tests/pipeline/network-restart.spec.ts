import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type MockInstance,
} from "vitest";
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
  waitForRestart: (url: string): Promise<void> => {
    order.push(`wait ${url}`);
    return Promise.resolve();
  },
  resolveWaitTimeoutMs: (): number => 1000,
}));

import { runPipeline } from "../../src/pipeline";

describe("pipeline/network restart", () => {
  let cfgFile: string;
  let dir: string;

  async function writeConfig(networking: string[]): Promise<void> {
    await fs.writeFile(
      cfgFile,
      [
        "version: 1",
        'base_url: "http://localhost:8096"',
        "system: {}",
        "networking:",
        ...networking.map((line: string) => `  ${line}`),
        "",
      ].join("\n"),
    );
  }

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "jellarr-netrestart-"));
    cfgFile = path.join(dir, "config.yml");
    process.env.JELLARR_API_KEY = "key";
    order.length = 0;
    Object.assign(client, {
      getSystemConfiguration: step("system", {}),
      getServerVersion: step("version", "10.11.0"),
      getNetworkingConfiguration: step("readNet", {
        BaseUrl: "",
        InternalHttpPort: 8096,
        InternalHttpsPort: 8920,
        LocalNetworkSubnets: [],
      }),
      updateNetworkingConfiguration: step("writeNet"),
      restartServer: step("restart"),
      getPendingRestart: step("marker", false),
    });
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("whenPortChanges_thenRestartsOnceAfterTheWriteAndWaitsOnTheNewPort", async () => {
    // Arrange
    await writeConfig(["internalHttpPort: 8097", "enableHttps: true"]);

    // Act
    await runPipeline(cfgFile);

    // Assert
    expect(
      order.filter((n: string) => ["writeNet", "restart"].includes(n)),
    ).toEqual(["writeNet", "restart"]);
    expect(client.restartServer).toHaveBeenCalledTimes(1);
    expect(order).toContain("wait http://localhost:8097");
  });

  it("whenBaseUrlChanges_thenWritesLastAndDoesNotCallTheDeadRestartEndpoint", async () => {
    // Arrange
    await writeConfig(["baseUrl: /jf"]);
    const warn: MockInstance<typeof console.warn> = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    // Act
    await runPipeline(cfgFile);

    // Assert
    expect(client.updateNetworkingConfiguration).toHaveBeenCalledTimes(1);
    expect(client.restartServer).not.toHaveBeenCalled();
    expect(String(warn.mock.calls[0]?.[0])).toContain("restart it yourself");
  });

  it("whenOnlyLiveFieldsChange_thenServerIsNotRestarted", async () => {
    // Arrange
    await writeConfig(["localNetworkSubnets: ['192.168.1.0/24']"]);

    // Act
    await runPipeline(cfgFile);

    // Assert
    expect(client.updateNetworkingConfiguration).toHaveBeenCalledTimes(1);
    expect(client.restartServer).not.toHaveBeenCalled();
  });

  it("whenNothingChanges_thenServerIsNotRestarted", async () => {
    // Arrange
    await writeConfig(["internalHttpPort: 8096"]);

    // Act
    await runPipeline(cfgFile);

    // Assert
    expect(client.restartServer).not.toHaveBeenCalled();
  });

  it("whenDryRun_thenReportsTheRestartAndTouchesNothing", async () => {
    // Arrange
    await writeConfig(["internalHttpPort: 8097", "enableHttps: true"]);
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => {
      lines.push(a.map(String).join(" "));
    });

    // Act
    await runPipeline(cfgFile, { dryRun: true });

    // Assert
    expect(lines.join("\n")).toContain(
      "would restart Jellyfin to apply enableHttps, internalHttpPort",
    );
    expect(client.updateNetworkingConfiguration).not.toHaveBeenCalled();
    expect(client.restartServer).not.toHaveBeenCalled();
  });
});
