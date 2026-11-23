import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  overlaySupported,
  resetServerSpec,
  setServerSpec,
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

// NOTE: a Jellyfin 10.11 server's own spec has no HlsAudioSeekStrategy, SubtitleExtractionTimeoutMinutes or SimilarItemProviders.
const SPEC_10_11: object = {
  components: {
    schemas: {
      Thing: {
        properties: {
          A: { type: "integer" },
          N: { allOf: [{ $ref: "#/components/schemas/Inner" }] },
          L: { type: "array", items: { $ref: "#/components/schemas/Inner" } },
        },
      },
      Inner: { properties: { T: { type: "string" } } },
      EncodingOptions: {
        properties: {
          EnableHardwareEncoding: { type: "boolean" },
          EncodingThreadCount: { type: "integer" },
        },
      },
      LibraryOptions: {
        properties: {
          PathInfos: { type: "array", items: { type: "object" } },
          TypeOptions: {
            type: "array",
            items: { $ref: "#/components/schemas/TypeOptions" },
          },
        },
      },
      TypeOptions: {
        properties: {
          Type: { type: "string" },
          MetadataFetchers: { type: "array", items: { type: "string" } },
          ImageFetchers: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};

// NOTE: Jellyfin omits null fields, so the server's current object cannot be used to tell what it knows.
const server1011: () => EncodingOptionsSchema = (): EncodingOptionsSchema =>
  ({
    EnableHardwareEncoding: false,
    EncodingThreadCount: -1,
  }) as unknown as EncodingOptionsSchema;

describe("withoutUnsupported", () => {
  beforeEach((): void => {
    vi.clearAllMocks();
    resetServerSpec();
    setServerSpec(SPEC_10_11);
    setServerVersion("10.11.4");
  });

  it("drops a key the server's schema lacks and warns once with the path and version", () => {
    const kept: object = withoutUnsupported("Thing", { A: 2, B: 3 }, "x");
    withoutUnsupported("Thing", { B: 3 }, "x");
    expect(kept).toEqual({ A: 2 });
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      "x.B is not supported by Jellyfin 10.11.4; skipped",
    );
  });

  it("keeps a key the schema defines, whatever the value", () => {
    expect(withoutUnsupported("Thing", { A: null }, "x")).toEqual({ A: null });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("recurses through $ref, allOf wrappers and array elements", () => {
    const kept: object = withoutUnsupported(
      "Thing",
      { N: { T: "a", B: 3 }, L: [{ T: "Movie", S: ["x"] }] },
      "x",
    );
    expect(kept).toEqual({ N: { T: "a" }, L: [{ T: "Movie" }] });
    expect(logger.warn).toHaveBeenCalledWith(
      "x.N.B is not supported by Jellyfin 10.11.4; skipped",
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "x.L[].S is not supported by Jellyfin 10.11.4; skipped",
    );
  });

  it("keeps everything for a type the spec does not describe, and without a spec", () => {
    expect(withoutUnsupported("Unknown", { A: 1 }, "x")).toEqual({ A: 1 });
    resetServerSpec();
    expect(withoutUnsupported("Thing", { Z: 1 }, "x")).toEqual({ Z: 1 });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("overlaySupported never adds an unsupported key to the result", () => {
    expect(
      overlaySupported("Thing", { A: 1, C: 9 }, { A: 2, B: 3 }, "x"),
    ).toEqual({ A: 2, C: 9 });
  });
});

describe("a declared field the server does not know", () => {
  beforeEach((): void => {
    vi.clearAllMocks();
    resetServerSpec();
    setServerSpec(SPEC_10_11);
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

  it("encoding: a field the server omits because it is null is still sent", () => {
    const result: EncodingOptionsSchema | undefined = calculateEncodingDiff(
      server1011(),
      { encodingThreadCount: 4 },
    );
    expect(result?.EncodingThreadCount).toBe(4);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("encoding: a config declaring only unsupported fields is a no-op", () => {
    expect(
      calculateEncodingDiff(server1011(), {
        hlsAudioSeekStrategy: "TrimCopiedAudio",
      }),
    ).toBeUndefined();
  });

  it("encoding: is written when the server's schema defines the field (Jellyfin 12)", () => {
    setServerSpec({
      components: {
        schemas: {
          EncodingOptions: {
            properties: {
              ...(
                SPEC_10_11 as {
                  components: {
                    schemas: Record<string, { properties: object }>;
                  };
                }
              ).components.schemas.EncodingOptions.properties,
              HlsAudioSeekStrategy: { type: "string" },
            },
          },
        },
      },
    });
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
