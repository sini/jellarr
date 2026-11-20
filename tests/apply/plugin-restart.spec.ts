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
const sso: PluginInfoSchema = {
  Name: "SSO-Auth",
  Id: "sso-id",
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
        [sso],
        [{ name: "SSO-Auth", configuration: { A: 1 } }],
      ),
    ).rejects.toThrow(
      /"SSO-Auth" declares a configuration but it cannot be read/,
    );
  });

  it("whenUndeclaredPluginReturns404_thenItIsSkipped", async () => {
    // Arrange
    const read: ReturnType<typeof vi.fn> = vi.fn().mockRejectedValue(missing);

    // Act
    const result: Map<string, unknown> =
      await getPluginConfigurationSchemaByName(
        clientReading(read),
        [sso],
        [{ name: "SSO-Auth" }],
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
        [{ name: "SSO-Auth", configuration: { A: 1 } }],
      ),
    ).rejects.toThrow(
      /"SSO-Auth" declares a configuration but is not installed/,
    );
  });

  it("whenDeclaredPluginReadsFine_thenItIsReturned", async () => {
    // Arrange
    const read: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue({ A: 0 });

    // Act
    const result: Map<string, unknown> =
      await getPluginConfigurationSchemaByName(
        clientReading(read),
        [sso],
        [{ name: "SSO-Auth", configuration: { A: 1 } }],
      );

    // Assert
    expect(result.get("SSO-Auth")).toEqual({
      id: "sso-id",
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
    name: "SSO Authentication",
    guid: "505CE9D1-D916-42FA-86CA-673EF241D7DF",
    version: "5.1.1",
  };
  const active: PluginInfoSchema = {
    Name: "SSO-Auth",
    Id: "505ce9d1d91642fa86ca673ef241d7df",
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
    ).rejects.toThrow(/did not become active.*SSO Authentication/);
  });
});
