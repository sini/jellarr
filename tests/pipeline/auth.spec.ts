import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { JellyfinHttpError } from "../../src/api/errors";

const client: {
  getSystemConfiguration: ReturnType<typeof vi.fn>;
  setAccessToken: ReturnType<typeof vi.fn>;
  authenticateByName: ReturnType<typeof vi.fn>;
  getUsers: ReturnType<typeof vi.fn>;
  updateUserPolicy: ReturnType<typeof vi.fn>;
  checkUserPassword: ReturnType<typeof vi.fn>;
} = {
  getSystemConfiguration: vi.fn(),
  setAccessToken: vi.fn(),
  authenticateByName: vi.fn(),
  getUsers: vi.fn(),
  updateUserPolicy: vi.fn(),
  checkUserPassword: vi.fn(),
};

vi.mock("../../src/api/jellyfin_client", () => ({
  createJellyfinClient: (): typeof client => client,
}));
vi.mock("../../src/lib/health", () => ({
  waitForHealth: (): Promise<void> => Promise.resolve(),
  waitForRestart: (): Promise<void> => Promise.resolve(),
  resolveWaitTimeoutMs: (): number => 1000,
}));

import { runPipeline } from "../../src/pipeline";

describe("pipeline/auth fallback", () => {
  let dir: string;
  let cfgFile: string;

  async function writeConfig(withAdmin: boolean): Promise<void> {
    const passwordFile: string = path.join(dir, "admin-pw");
    await fs.writeFile(passwordFile, "hunter2\n");
    await fs.writeFile(
      cfgFile,
      [
        "version: 1",
        'base_url: "http://localhost:8096"',
        "system: {}",
        ...(withAdmin
          ? [
              "users:",
              "  - name: root",
              `    passwordFile: ${passwordFile}`,
              "    policy: { isAdministrator: true }",
            ]
          : []),
        "",
      ].join("\n"),
    );
  }

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "jellarr-auth-"));
    cfgFile = path.join(dir, "config.yml");
    delete process.env.JELLARR_API_KEY;
    client.getSystemConfiguration.mockReset().mockResolvedValue({});
    client.setAccessToken.mockReset();
    client.authenticateByName.mockReset().mockResolvedValue("tok");
    client.getUsers.mockReset().mockResolvedValue([
      {
        Name: "root",
        Id: "u1",
        Policy: { IsAdministrator: true },
        Configuration: {},
      },
    ]);
    client.updateUserPolicy.mockReset();
    client.checkUserPassword.mockReset().mockResolvedValue("valid");
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("whenApiKeyWorks_thenNoNameLoginHappens", async () => {
    // Arrange
    process.env.JELLARR_API_KEY = "key";
    await writeConfig(true);

    // Act
    await runPipeline(cfgFile);

    // Assert
    expect(client.authenticateByName).not.toHaveBeenCalled();
    expect(client.checkUserPassword).toHaveBeenCalledWith("root", "hunter2");
  });

  it("whenApiKeyAbsent_thenSignsInAsConfiguredAdminAndWarns", async () => {
    // Arrange
    await writeConfig(true);

    // Act
    await runPipeline(cfgFile);

    // Assert
    expect(client.authenticateByName).toHaveBeenCalledWith("root", "hunter2");
    expect(client.setAccessToken).toHaveBeenCalledWith("tok");
    expect(client.checkUserPassword).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("JELLARR_API_KEY is not set"),
    );
  });

  it("whenFirstCallReturns401_thenSignsInAndRetries", async () => {
    // Arrange
    process.env.JELLARR_API_KEY = "stale";
    await writeConfig(true);
    client.getSystemConfiguration
      .mockRejectedValueOnce(
        new JellyfinHttpError("GET /System/Configuration failed: 401", 401),
      )
      .mockResolvedValueOnce({});

    // Act
    await runPipeline(cfgFile);

    // Assert
    expect(client.authenticateByName).toHaveBeenCalledTimes(1);
    expect(client.getSystemConfiguration).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("was rejected (401)"),
    );
  });

  it("whenFirstCallFailsWithNon401_thenErrorPropagatesWithoutFallback", async () => {
    // Arrange
    process.env.JELLARR_API_KEY = "key";
    await writeConfig(true);
    client.getSystemConfiguration.mockRejectedValue(
      new JellyfinHttpError("GET /System/Configuration failed: 500", 500),
    );

    // Act + Assert
    await expect(runPipeline(cfgFile)).rejects.toThrow(/500/);
    expect(client.authenticateByName).not.toHaveBeenCalled();
  });

  it("whenFallbackSignInFails_thenErrorWarnsRetriesCountTowardLockout", async () => {
    // Arrange
    await writeConfig(true);
    client.authenticateByName.mockRejectedValue(
      new JellyfinHttpError("POST /Users/AuthenticateByName failed: 401", 401),
    );

    // Act + Assert
    await expect(runPipeline(cfgFile)).rejects.toThrow(
      /counts toward the admin's lockout limit|toward the admin's lockout/,
    );
  });

  it("whenNoCredentialAvailable_thenHardError", async () => {
    // Arrange
    await writeConfig(false);

    // Act + Assert
    await expect(runPipeline(cfgFile)).rejects.toThrow(
      /no admin to sign in as/,
    );
    expect(client.getSystemConfiguration).not.toHaveBeenCalled();
  });

  it("whenKeyRejectedAndNoAdminConfigured_thenHardError", async () => {
    // Arrange
    process.env.JELLARR_API_KEY = "stale";
    await writeConfig(false);
    client.getSystemConfiguration.mockRejectedValue(
      new JellyfinHttpError("GET /System/Configuration failed: 401", 401),
    );

    // Act + Assert
    await expect(runPipeline(cfgFile)).rejects.toThrow(
      /no admin to sign in as/,
    );
  });
});
