import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { applyStartupWizard } from "../../src/apply/startup";
import type { JellyfinClient } from "../../src/api/jellyfin.types";
import type { StartupConfig } from "../../src/types/config/startup";

interface Calls {
  order: string[];
  client: JellyfinClient;
  spies: Record<string, ReturnType<typeof vi.fn>>;
}

function makeClient(wizardCompleted: boolean | null | undefined): Calls {
  const order: string[] = [];
  const record: (name: string) => () => Promise<void> =
    (name: string) => (): Promise<void> => {
      order.push(name);
      return Promise.resolve();
    };
  const spies: Record<string, ReturnType<typeof vi.fn>> = {
    getPublicSystemInfo: vi.fn().mockResolvedValue({
      StartupWizardCompleted: wizardCompleted,
    }),
    updateStartupConfiguration: vi
      .fn()
      .mockImplementation(record("configuration")),
    setRemoteAccess: vi.fn().mockImplementation(record("remoteAccess")),
    getStartupUser: vi.fn().mockImplementation(record("getUser")),
    updateStartupUser: vi.fn().mockImplementation(record("user")),
    completeStartupWizard: vi.fn().mockImplementation(record("complete")),
  };
  return { order, client: spies as unknown as JellyfinClient, spies };
}

describe("apply/startup", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "jellarr-startup-"));
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("whenServerIsPristine_thenRunsWizardStepsInOrder", async () => {
    // Arrange
    const passwordFile: string = path.join(dir, "pw");
    await fs.writeFile(passwordFile, "s3cret\n");
    const { order, client, spies }: Calls = makeClient(false);
    const startup: StartupConfig = {
      serverName: "Home",
      uiCulture: "en-US",
      remoteAccess: {
        enableRemoteAccess: false,
        enableAutomaticPortMapping: false,
      },
      user: { name: "admin", passwordFile },
    };

    // Act
    const ran: boolean = await applyStartupWizard(client, startup);

    // Assert
    expect(ran).toBe(true);
    expect(order).toEqual([
      "configuration",
      "remoteAccess",
      "getUser",
      "user",
      "complete",
    ]);
    expect(spies.updateStartupConfiguration).toHaveBeenCalledWith({
      ServerName: "Home",
      UICulture: "en-US",
      PreferredMetadataLanguage: undefined,
      MetadataCountryCode: undefined,
    });
    expect(spies.updateStartupUser).toHaveBeenCalledWith({
      Name: "admin",
      Password: "s3cret",
    });
  });

  it.each([true, null, undefined])(
    "whenWizardCompleted=%s_thenNothingIsCalled",
    async (completed: boolean | null | undefined) => {
      // Arrange
      const { order, client }: Calls = makeClient(completed);

      // Act
      const ran: boolean = await applyStartupWizard(client, {
        serverName: "Home",
        user: { name: "admin", password: "pw" },
        completeStartupWizard: true,
      });

      // Assert
      expect(ran).toBe(false);
      expect(order).toEqual([]);
    },
  );

  it("whenCompleteStartupWizardFalse_thenWizardIsLeftOpen", async () => {
    // Arrange
    const { order, client }: Calls = makeClient(false);

    // Act
    await applyStartupWizard(client, {
      user: { name: "admin", password: "pw" },
      completeStartupWizard: false,
    });

    // Assert
    expect(order).toEqual(["getUser", "user"]);
  });

  it("whenOnlyCompleteStartupWizardSet_thenPristineServerIsJustCompleted", async () => {
    // Arrange
    const { order, client }: Calls = makeClient(false);

    // Act
    await applyStartupWizard(client, { completeStartupWizard: true });

    // Assert
    expect(order).toEqual(["complete"]);
  });
});
