import { describe, it, expect, vi, afterEach, type MockInstance } from "vitest";
import * as yaml from "yaml";

vi.mock("../../src/api/jellyfin_client", () => ({
  createJellyfinClient: (): object => ({
    getSystemConfiguration: () => Promise.resolve({}),
    getMetadataConfiguration: () => Promise.resolve({}),
    getXbmcMetadataConfiguration: () => Promise.resolve({}),
    getEncodingConfiguration: () =>
      Promise.resolve({
        SubtitleExtractionTimeoutMinutes: 5,
        HlsAudioSeekStrategy: "TranscodeAudio",
      }),
    getNetworkingConfiguration: () => Promise.resolve({}),
    getBrandingConfiguration: () => Promise.resolve({}),
    getPlugins: () => Promise.resolve([]),
    getApiKeys: () => Promise.resolve([]),
    getLiveTvOptions: () => Promise.resolve({}),
    getVirtualFolders: () =>
      Promise.resolve([
        {
          Name: "Movies",
          CollectionType: "movies",
          LibraryOptions: {
            PathInfos: [{ Path: "/m" }],
            TypeOptions: [
              {
                Type: "Movie",
                SimilarItemProviders: ["Local"],
                SimilarItemProviderOrder: ["Local"],
              },
            ],
          },
        },
      ]),
    getUsers: () => Promise.resolve([]),
    getScheduledTasks: () => Promise.resolve([]),
  }),
}));

import { runDump } from "../../src/dump";

describe("dump: Jellyfin 12 fields", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports the encoding fields and the typeOptions similar-item providers", async () => {
    process.env.JELLARR_API_KEY = "key";
    vi.spyOn(console, "error").mockImplementation((): void => undefined);
    const log: MockInstance<typeof console.log> = vi
      .spyOn(console, "log")
      .mockImplementation((): void => undefined);

    await runDump("http://localhost:8096");

    const dumped: {
      encoding: Record<string, unknown>;
      library: {
        virtualFolders: Array<{
          libraryOptions: { typeOptions: Array<Record<string, unknown>> };
        }>;
      };
    } = yaml.parse(String(log.mock.calls[0]?.[0])) as never;
    expect(dumped.encoding).toMatchObject({
      subtitleExtractionTimeoutMinutes: 5,
      hlsAudioSeekStrategy: "TranscodeAudio",
    });
    expect(
      dumped.library.virtualFolders[0].libraryOptions.typeOptions[0],
    ).toMatchObject({
      similarItemProviders: ["Local"],
      similarItemProviderOrder: ["Local"],
    });
  });
});
