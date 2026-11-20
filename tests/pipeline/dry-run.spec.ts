import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { JellyfinHttpError } from "../../src/api/errors";
import { guardReadOnly } from "../../src/api/read-only";
import type { JellyfinClient } from "../../src/api/jellyfin.types";

const READS: Record<string, unknown> = {
  getServerVersion: "10.11.0",
  getSystemConfiguration: { ServerName: "old" },
  getMetadataConfiguration: { UseFileCreationTimeForDateAdded: false },
  getEncodingConfiguration: { EncoderPreset: "auto" },
  getVirtualFolders: [],
  getBrandingConfiguration: {},
  getNetworkingConfiguration: {},
  getUsers: [
    {
      Name: "bob",
      Id: "u1",
      Policy: { IsAdministrator: true },
      Configuration: {},
    },
  ],
  getPlugins: [
    {
      Name: "Installed-Plugin",
      Id: "guid-installed",
      Version: "1.0.0.0",
      Status: "Active",
    },
  ],
  getPackages: [
    {
      name: "Installed Plugin",
      guid: "guid-installed",
      versions: [{ version: "1.0.0" }],
    },
    { name: "New Plugin", guid: "guid-new", versions: [{ version: "2.0.0" }] },
  ],
  getPluginConfiguration: { Flag: false },
  getApiKeys: [],
  getPublicSystemInfo: { StartupWizardCompleted: false },
};
const WRITES: string[] = [
  "updateSystemConfiguration",
  "updateMetadataConfiguration",
  "updateEncodingConfiguration",
  "addVirtualFolder",
  "updateLibraryOptions",
  "updateBrandingConfiguration",
  "updateNetworkingConfiguration",
  "createUser",
  "updateUserPolicy",
  "updateUserConfiguration",
  "updateUserPassword",
  "checkUserPassword",
  "authenticateByName",
  "setAccessToken",
  "installPackage",
  "uninstallPlugin",
  "restartServer",
  "updatePluginConfiguration",
  "createApiKey",
  "completeStartupWizard",
  "updateStartupConfiguration",
  "getStartupUser",
  "updateStartupUser",
  "setRemoteAccess",
];

const client: Record<string, ReturnType<typeof vi.fn>> = {};

vi.mock("../../src/api/jellyfin_client", () => ({
  createJellyfinClient: (): typeof client => client,
}));
vi.mock("../../src/lib/health", () => ({
  waitForHealth: (): Promise<void> => Promise.resolve(),
  waitForRestart: (): Promise<void> => Promise.resolve(),
  resolveWaitTimeoutMs: (): number => 1000,
}));

import { runPipeline, type PipelineResult } from "../../src/pipeline";

describe("pipeline/dry run", () => {
  let dir: string;
  let cfgFile: string;
  let output: string;

  async function writeConfig(body: string[]): Promise<void> {
    await fs.writeFile(
      cfgFile,
      ["version: 1", 'base_url: "http://localhost:8096"', ...body, ""].join(
        "\n",
      ),
    );
  }

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "jellarr-dry-"));
    cfgFile = path.join(dir, "config.yml");
    process.env.JELLARR_API_KEY = "key";
    process.env.JELLARR_DRY_TOKEN = "env-s3cret";
    for (const [name, value] of Object.entries(READS)) {
      client[name] = vi.fn().mockResolvedValue(structuredClone(value));
    }
    for (const name of WRITES) client[name] = vi.fn();
    output = "";
    const capture: (...args: unknown[]) => void = (...args: unknown[]) => {
      output += `${args.join(" ")}\n`;
    };
    vi.spyOn(console, "log").mockImplementation(capture);
    vi.spyOn(console, "warn").mockImplementation(capture);
  });

  afterEach(async () => {
    delete process.env.JELLARR_DRY_TOKEN;
    delete process.env.JELLARR_DRY_RUN;
    vi.restoreAllMocks();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("whenEveryModuleHasChanges_thenNoWriteOrSignInHappensAndSecretsAreMasked", async () => {
    // Arrange
    const secretFile: string = path.join(dir, "cert-pw");
    await fs.writeFile(secretFile, "file-s3cret\n");
    await writeConfig([
      "system: { serverName: new }",
      "metadata: { useFileCreationTimeForDateAdded: true }",
      "encoding: { encoderPreset: slow }",
      "library:",
      "  virtualFolders:",
      "    - name: Movies",
      "      collectionType: movies",
      "      libraryOptions: { pathInfos: [{ path: /m }] }",
      "branding: { customCss: 'a{}' }",
      "networking:",
      `  certificatePassword: { _file: ${secretFile} }`,
      '  baseUrl: "/${JELLARR_DRY_TOKEN}"',
      "users:",
      "  - name: bob",
      "    password: pw",
      "    policy: { isAdministrator: false }",
      "  - name: carol",
      "    password: pw",
      "plugins:",
      "  - name: Installed Plugin",
      "    configuration: { Flag: true }",
      "  - name: New Plugin",
      "    configuration: { Never: shown }",
      "api_keys: [{ name: k }]",
      "startup: { serverName: x }",
    ]);

    // Act
    const result: PipelineResult = await runPipeline(cfgFile, {
      dryRun: true,
    });

    // Assert
    expect(result).toEqual({ dryRun: true, pending: true });
    for (const name of WRITES) expect(client[name]).not.toHaveBeenCalled();
    for (const expected of [
      'system.ServerName: "old" → "new"',
      "metadata.UseFileCreationTimeForDateAdded: false → true",
      "encoding.EncoderPreset",
      "library Movies: would be created",
      "branding.CustomCss",
      "networking.CertificatePassword: *** → ***",
      "networking.BaseUrl: *** → ***",
      "user carol: would be created",
      "user bob.policy.IsAdministrator: true → false",
      "user bob: password not verified (dry run)",
      "plugin New Plugin: install 2.0.0",
      "plugin Installed-Plugin.configuration.Flag: false → true",
      "api key k: would be created",
      "startup: the first-boot wizard would run",
      "DRY RUN: changes are pending (passwords were not verified)",
      "Would update user policy: bob",
      "Would install plugin: New Plugin",
    ]) {
      expect(output).toContain(expected);
    }
    expect(output).not.toContain("s3cret");
    expect(output).not.toContain("Never");
    for (const live of [
      "Updating user policy",
      "Installing plugin",
      "Updating plugin configuration",
    ]) {
      expect(output).not.toContain(live);
    }
  });

  it("whenNothingWouldChange_thenPendingIsFalse", async () => {
    // Arrange
    await writeConfig(["system: {}"]);

    // Act
    const result: PipelineResult = await runPipeline(cfgFile, {
      dryRun: true,
    });

    // Assert
    expect(result).toEqual({ dryRun: true, pending: false });
    expect(output).toContain("DRY RUN: nothing would change");
    expect(output).not.toContain("passwords were not verified");
  });

  it("whenEnvVarIsSet_thenDryRunIsOn", async () => {
    // Arrange
    process.env.JELLARR_DRY_RUN = "1";
    await writeConfig(["system: { serverName: new }"]);

    // Act
    const result: PipelineResult = await runPipeline(cfgFile);

    // Assert
    expect(result.pending).toBe(true);
    expect(client.updateSystemConfiguration).not.toHaveBeenCalled();
  });

  it("whenNoApiKey_thenItIsAnErrorAndNothingIsCalled", async () => {
    // Arrange
    delete process.env.JELLARR_API_KEY;
    await writeConfig(["system: {}"]);

    // Act + Assert
    await expect(runPipeline(cfgFile, { dryRun: true })).rejects.toThrow(
      /requires JELLARR_API_KEY/,
    );
    expect(client.authenticateByName).not.toHaveBeenCalled();
    expect(client.getSystemConfiguration).not.toHaveBeenCalled();
  });

  it("whenKeyIsRejected_thenItIsAnErrorNotAFallback", async () => {
    // Arrange
    await writeConfig([
      "system: {}",
      "users: [{ name: a, password: p, policy: { isAdministrator: true } }]",
    ]);
    client.getSystemConfiguration.mockRejectedValue(
      new JellyfinHttpError("401", 401),
    );

    // Act + Assert
    await expect(runPipeline(cfgFile, { dryRun: true })).rejects.toThrow(
      /never signs in/,
    );
    expect(client.authenticateByName).not.toHaveBeenCalled();
  });
});

describe("guardReadOnly", () => {
  it("allows reads and throws on everything else", async () => {
    const wrapped: JellyfinClient = guardReadOnly({
      getUsers: vi.fn().mockResolvedValue([]),
      createUser: vi.fn(),
      authenticateByName: vi.fn(),
    } as unknown as JellyfinClient);

    await expect(wrapped.getUsers()).resolves.toEqual([]);
    expect(() => wrapped.createUser({ Name: "x" })).toThrow(/read-only/);
    expect(() => wrapped.authenticateByName("a", "b")).toThrow(/read-only/);
  });
});
