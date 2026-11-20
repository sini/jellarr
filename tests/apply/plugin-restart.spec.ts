import { describe, it, expect, vi, type Mock } from "vitest";
import {
  getPluginConfigurationSchemaByName,
  waitForInstalledPluginsActive,
  restartJellyfin,
  type PluginInstall,
} from "../../src/apply/plugins";
import type { JellyfinClient } from "../../src/api/jellyfin.types";
import type { PluginInfoSchema } from "../../src/types/schema/plugins";

const waitForRestart: Mock<() => Promise<void>> = vi.hoisted(() =>
  vi.fn<() => Promise<void>>(),
);
vi.mock("../../src/lib/health", () => ({ waitForRestart }));
vi.mock("../../src/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const missing: Error = new Error("GET /Plugins/x/Configuration failed: 404");
const example: PluginInfoSchema = {
  Name: "Example-Plugin",
  Id: "example-id",
} as PluginInfoSchema;

function clientReading(read: ReturnType<typeof vi.fn>): JellyfinClient {
  return { getPluginConfiguration: read } as unknown as JellyfinClient;
}

describe("declared plugin configuration must be readable", () => {
  it("whenDeclaredPluginReturns404_thenItFailsTheRun", async () => {
    // Arrange
    const read: ReturnType<typeof vi.fn> = vi.fn().mockRejectedValue(missing);

    // Act + Assert
    await expect(
      getPluginConfigurationSchemaByName(
        clientReading(read),
        [example],
        [{ name: "Example-Plugin", configuration: { A: 1 } }],
      ),
    ).rejects.toThrow(
      /"Example-Plugin" declares a configuration but it cannot be read/,
    );
  });

  it("whenUndeclaredPluginReturns404_thenItIsSkipped", async () => {
    // Arrange
    const read: ReturnType<typeof vi.fn> = vi.fn().mockRejectedValue(missing);

    // Act
    const result: Map<string, unknown> =
      await getPluginConfigurationSchemaByName(
        clientReading(read),
        [example],
        [{ name: "Example-Plugin" }],
      );

    // Assert
    expect(result.size).toBe(0);
  });

  it("whenDeclaredPluginIsNotInstalled_thenItFailsTheRun", async () => {
    // Arrange
    const read: ReturnType<typeof vi.fn> = vi.fn();

    // Act + Assert
    await expect(
      getPluginConfigurationSchemaByName(
        clientReading(read),
        [],
        [{ name: "Example-Plugin", configuration: { A: 1 } }],
      ),
    ).rejects.toThrow(
      /"Example-Plugin" declares a configuration but is not installed/,
    );
  });

  it("whenDeclaredPluginReadsFine_thenItIsReturned", async () => {
    // Arrange
    const read: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue({ A: 0 });

    // Act
    const result: Map<string, unknown> =
      await getPluginConfigurationSchemaByName(
        clientReading(read),
        [example],
        [{ name: "Example-Plugin", configuration: { A: 1 } }],
      );

    // Assert
    expect(result.get("Example-Plugin")).toEqual({
      id: "example-id",
      configuration: { A: 0 },
    });
  });
});

describe("restartJellyfin", () => {
  it("whenCalled_thenRequestsRestartThenWaitsForTheServer", async () => {
    // Arrange
    const order: string[] = [];
    const client: JellyfinClient = {
      restartServer: vi.fn().mockImplementation(() => {
        order.push("restart");
        return Promise.resolve();
      }),
    } as unknown as JellyfinClient;
    waitForRestart.mockImplementation(() => {
      order.push("wait");
      return Promise.resolve();
    });

    // Act
    await restartJellyfin(client, "http://jf:8096", 1234);

    // Assert
    expect(order).toEqual(["restart", "wait"]);
    expect(waitForRestart).toHaveBeenCalledWith("http://jf:8096", {
      timeoutMs: 1234,
    });
  });
});

describe("waitForInstalledPluginsActive", () => {
  const install: PluginInstall = {
    name: "Example Plugin",
    guid: "0A1B2C3D-4E5F-4A6B-8C7D-9E0F1A2B3C4D",
    version: "5.1.1",
  };
  const active: PluginInfoSchema = {
    Name: "Example-Plugin",
    Id: "0a1b2c3d4e5f4a6b8c7d9e0f1a2b3c4d",
    Version: "5.1.1.0",
    Status: "Active",
  } as PluginInfoSchema;

  it("whenPluginTurnsActiveLater_thenResolvesWithTheFreshList", async () => {
    // Arrange
    const getPlugins: ReturnType<typeof vi.fn> = vi
      .fn()
      .mockRejectedValueOnce(new Error("503"))
      .mockResolvedValueOnce([{ ...active, Status: "Restart" }])
      .mockResolvedValue([active]);
    const client: JellyfinClient = { getPlugins } as unknown as JellyfinClient;

    // Act
    const result: PluginInfoSchema[] = await waitForInstalledPluginsActive(
      client,
      [install],
      5000,
      1,
    );

    // Assert
    expect(result).toEqual([active]);
    expect(getPlugins).toHaveBeenCalledTimes(3);
  });

  it("whenPluginNeverTurnsActive_thenFailsNamingIt", async () => {
    // Arrange
    const client: JellyfinClient = {
      getPlugins: vi.fn().mockResolvedValue([]),
    } as unknown as JellyfinClient;

    // Act + Assert
    await expect(
      waitForInstalledPluginsActive(client, [install], 20, 5),
    ).rejects.toThrow(/did not become active.*Example Plugin/);
  });
});
