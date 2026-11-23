import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  overlaySupported,
  resetUnsupportedWarnings,
  setServerVersion,
  withoutUnsupported,
} from "../../src/lib/objects";
import { logger } from "../../src/lib/logger";
import { calculateEncodingDiff } from "../../src/apply/encoding-options";
import { calculateLibraryDiff } from "../../src/apply/library";
import type { EncodingOptionsSchema } from "../../src/types/schema/encoding-options";
import type { VirtualFolderInfoSchema } from "../../src/types/schema/library";
import type { VirtualFolderConfig } from "../../src/types/config/library";

vi.mock("../../src/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// NOTE: a Jellyfin 10.11 EncodingOptions has no HlsAudioSeekStrategy or SubtitleExtractionTimeoutMinutes.
const server1011: () => EncodingOptionsSchema = (): EncodingOptionsSchema =>
  ({
    EnableHardwareEncoding: false,
    EncodingThreadCount: -1,
  }) as unknown as EncodingOptionsSchema;

describe("withoutUnsupported", () => {
  beforeEach((): void => {
    vi.clearAllMocks();
    resetUnsupportedWarnings();
    setServerVersion("10.11.4");
  });

  it("drops a key the server lacks and warns once with the path and version", () => {
    const current: object = { A: 1 };
    const kept: object = withoutUnsupported(current, { A: 2, B: 3 }, "x");
    withoutUnsupported(current, { B: 3 }, "x");
    expect(kept).toEqual({ A: 2 });
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      "x.B is not supported by Jellyfin 10.11.4; skipped",
    );
  });

  it("keeps a key the server has, even when its value is null", () => {
    expect(withoutUnsupported({ A: null }, { A: "v" }, "x")).toEqual({
      A: "v",
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("recurses into objects and into the elements of arrays", () => {
    const current: object = { N: { A: 1 }, L: [{ T: "Movie" }] };
    const kept: object = withoutUnsupported(
      current,
      { N: { A: 2, B: 3 }, L: [{ T: "Movie", S: ["x"] }] },
      "x",
    );
    expect(kept).toEqual({ N: { A: 2 }, L: [{ T: "Movie" }] });
    expect(logger.warn).toHaveBeenCalledWith(
      "x.N.B is not supported by Jellyfin 10.11.4; skipped",
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "x.L[].S is not supported by Jellyfin 10.11.4; skipped",
    );
  });

  it("keeps everything when the server object or array is empty", () => {
    expect(withoutUnsupported({}, { A: 1 }, "x")).toEqual({ A: 1 });
    expect(withoutUnsupported({ L: [] }, { L: [{ A: 1 }] }, "x")).toEqual({
      L: [{ A: 1 }],
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("overlaySupported never adds an unsupported key to the result", () => {
    expect(overlaySupported({ A: 1, C: 9 }, { A: 2, B: 3 }, "x")).toEqual({
      A: 2,
      C: 9,
    });
  });
});

describe("a declared field the server does not know", () => {
  beforeEach((): void => {
    vi.clearAllMocks();
    resetUnsupportedWarnings();
    setServerVersion("10.11.4");
  });

  it("encoding: is skipped, so a second run is a no-op", () => {
    const run: (
      server: EncodingOptionsSchema,
    ) => EncodingOptionsSchema | undefined = (server: EncodingOptionsSchema) =>
      calculateEncodingDiff(server, {
        encodingThreadCount: 4,
        hlsAudioSeekStrategy: "TranscodeAudio",
        subtitleExtractionTimeoutMinutes: 5,
      });
    const first: EncodingOptionsSchema | undefined = run(server1011());
    expect(first).toEqual({
      EnableHardwareEncoding: false,
      EncodingThreadCount: 4,
    });
    expect(first).not.toHaveProperty("HlsAudioSeekStrategy");
    expect(
      run(structuredClone(first) as EncodingOptionsSchema),
    ).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });

  it("encoding: a config declaring only unsupported fields is a no-op", () => {
    expect(
      calculateEncodingDiff(server1011(), {
        hlsAudioSeekStrategy: "TrimCopiedAudio",
      }),
    ).toBeUndefined();
  });

  it("encoding: is written when the server reports the field (Jellyfin 12)", () => {
    const server12: EncodingOptionsSchema = {
      ...server1011(),
      HlsAudioSeekStrategy: "TrimCopiedAudio",
      SubtitleExtractionTimeoutMinutes: 1,
    };
    const first: EncodingOptionsSchema | undefined = calculateEncodingDiff(
      server12,
      { hlsAudioSeekStrategy: "TranscodeAudio" },
    );
    expect(first?.HlsAudioSeekStrategy).toBe("TranscodeAudio");
    expect(
      calculateEncodingDiff(first as EncodingOptionsSchema, {
        hlsAudioSeekStrategy: "TranscodeAudio",
      }),
    ).toBeUndefined();
  });

  it("library: similarItemProviders on a type the server lists without it is skipped", () => {
    const folders: VirtualFolderInfoSchema[] = [
      {
        ItemId: "m1",
        Name: "Movies",
        CollectionType: "movies",
        LibraryOptions: {
          PathInfos: [{ Path: "/m" }],
          TypeOptions: [
            {
              Type: "Movie",
              MetadataFetchers: [] as string[],
              ImageFetchers: [] as string[],
            },
          ],
        },
      } as VirtualFolderInfoSchema,
    ];
    const desired: VirtualFolderConfig[] = [
      {
        name: "Movies",
        collectionType: "movies",
        libraryOptions: {
          pathInfos: [{ path: "/m" }],
          typeOptions: [
            {
              type: "Movie",
              metadataFetchers: [],
              imageFetchers: [],
              similarItemProviders: ["Tmdb"],
            },
          ],
        },
      },
    ];
    expect(calculateLibraryDiff(folders, desired)).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      "library Movies.TypeOptions[].SimilarItemProviders is not supported by Jellyfin 10.11.4; skipped",
    );
  });
});
