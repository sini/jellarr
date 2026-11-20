import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

const client: {
  getSystemConfiguration: ReturnType<typeof vi.fn>;
  getNetworkingConfiguration: ReturnType<typeof vi.fn>;
  updateNetworkingConfiguration: ReturnType<typeof vi.fn>;
} = {
  getSystemConfiguration: vi.fn(),
  getNetworkingConfiguration: vi.fn(),
  updateNetworkingConfiguration: vi.fn(),
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

describe("pipeline/secrets", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "jellarr-pipeline-"));
    process.env.JELLARR_API_KEY = "key";
    process.env.JELLARR_TEST_PREFIX = "media";
    client.getSystemConfiguration.mockResolvedValue({});
    client.getNetworkingConfiguration.mockResolvedValue({});
    client.updateNetworkingConfiguration.mockResolvedValue(undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    delete process.env.JELLARR_TEST_PREFIX;
    vi.restoreAllMocks();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("applies _file and ${VAR} secrets resolved to the networking update", async () => {
    // Arrange
    const secretFile: string = path.join(dir, "cert-password");
    await fs.writeFile(secretFile, "s3cret\n");
    const cfgFile: string = path.join(dir, "config.yml");
    await fs.writeFile(
      cfgFile,
      [
        "version: 1",
        'base_url: "http://localhost:8096"',
        "system: {}",
        "networking:",
        `  certificatePassword: { _file: ${secretFile} }`,
        '  baseUrl: "/${JELLARR_TEST_PREFIX}"',
        "",
      ].join("\n"),
    );

    // Act
    await runPipeline(cfgFile);

    // Assert
    expect(client.updateNetworkingConfiguration).toHaveBeenCalledTimes(1);
    expect(client.updateNetworkingConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({
        CertificatePassword: "s3cret",
        BaseUrl: "/media",
      }),
    );
  });
});
