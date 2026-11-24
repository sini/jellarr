import { describe, it, expect, vi, afterEach, type MockInstance } from "vitest";
import * as yaml from "yaml";

vi.mock("../../src/api/jellyfin_client", () => ({
  createJellyfinClient: (): object => ({
    getSystemConfiguration: () => Promise.resolve({ EnableMetrics: true }),
    getMetadataConfiguration: () => Promise.resolve({}),
    getXbmcMetadataConfiguration: () => Promise.resolve({}),
    getEncodingConfiguration: () =>
      Promise.resolve({
        EnableHardwareEncoding: true,
        HardwareAccelerationType: "vaapi",
        HardwareDecodingCodecs: [
          "h264",
          "hevc",
          "mpeg1video",
          "mpeg2video",
          "mpeg4",
          "vc1",
          "vp8",
          "vp9",
          "av1",
        ],
      }),
    getNetworkingConfiguration: () => Promise.resolve({}),
    getBrandingConfiguration: () => Promise.resolve({}),
    getPlugins: () => Promise.resolve([]),
    getApiKeys: () => Promise.resolve([]),
    getLiveTvOptions: () => Promise.resolve({}),
    getVirtualFolders: () => Promise.resolve([]),
    getUsers: () =>
      Promise.resolve([
        {
          Name: "admin",
          Policy: {
            IsAdministrator: true,
            LoginAttemptsBeforeLockout: -1,
            MaxActiveSessions: 0,
            RemoteClientBitrateLimit: 0,
          },
        },
        {
          Name: "kid",
          Policy: {
            LoginAttemptsBeforeLockout: 0,
            MaxActiveSessions: 0,
          },
        },
      ]),
    getScheduledTasks: () => Promise.resolve([]),
  }),
}));

import { runDump } from "../../src/dump";
import { RootConfigType } from "../../src/types/config/root";

describe("dump output round-trips through config validation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("validates once the passwords the dump cannot export are added", async () => {
    process.env.JELLARR_API_KEY = "key";
    vi.spyOn(console, "error").mockImplementation((): void => undefined);
    const log: MockInstance<typeof console.log> = vi
      .spyOn(console, "log")
      .mockImplementation((): void => undefined);

    await runDump("http://localhost:8096");

    const dumped: { users: Array<Record<string, unknown>> } = yaml.parse(
      log.mock.calls.map((c: unknown[]): string => String(c[0])).join("\n"),
    ) as { users: Array<Record<string, unknown>> };
    dumped.users = dumped.users.map(
      (u: Record<string, unknown>): Record<string, unknown> => ({
        ...u,
        password: "pw",
      }),
    );

    const result: ReturnType<typeof RootConfigType.safeParse> =
      RootConfigType.safeParse(dumped);
    expect(result.error?.issues ?? []).toEqual([]);
    expect(result.success).toBe(true);
  });
});
