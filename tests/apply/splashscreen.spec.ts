import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import {
  calculateSplashscreenUpload,
  applySplashscreen,
  calculateSplashscreenRemoval,
  applySplashscreenRemoval,
} from "../../src/apply/splashscreen";
import type { JellyfinClient } from "../../src/api/jellyfin.types";

/** A fake server that keeps the uploaded image and serves it back, as Jellyfin does. */
function fakeServer(initial: Uint8Array): {
  client: JellyfinClient;
  uploads: Uint8Array[];
} {
  let stored: Uint8Array = initial;
  const uploads: Uint8Array[] = [];
  const client: JellyfinClient = {
    getSplashscreen: (): Promise<Uint8Array> => Promise.resolve(stored),
    uploadSplashscreen: (image: Uint8Array): Promise<void> => {
      stored = image;
      uploads.push(image);
      return Promise.resolve();
    },
  } as unknown as JellyfinClient;
  return { client, uploads };
}

describe("splashscreen", () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "jellarr-splash-"));
    file = path.join(dir, "splash.png");
    await fs.writeFile(file, Buffer.from([1, 2, 3]));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("uploads once and the second run with the same file uploads nothing", async () => {
    const { client, uploads }: ReturnType<typeof fakeServer> = fakeServer(
      new Uint8Array([9, 9]),
    );

    await applySplashscreen(
      client,
      await calculateSplashscreenUpload(client, file),
    );
    await applySplashscreen(
      client,
      await calculateSplashscreenUpload(client, file),
    );

    expect(uploads).toHaveLength(1);
    expect(Buffer.from(uploads[0]).equals(Buffer.from([1, 2, 3]))).toBe(true);
  });

  it("uploads again when the file content changes", async () => {
    const { client, uploads }: ReturnType<typeof fakeServer> = fakeServer(
      new Uint8Array([1, 2, 3]),
    );
    expect(await calculateSplashscreenUpload(client, file)).toBeUndefined();

    await fs.writeFile(file, Buffer.from([4]));
    await applySplashscreen(
      client,
      await calculateSplashscreenUpload(client, file),
    );

    expect(uploads).toHaveLength(1);
  });

  it("fails when the file is missing", async () => {
    const { client }: ReturnType<typeof fakeServer> = fakeServer(
      new Uint8Array(),
    );
    await expect(
      calculateSplashscreenUpload(client, path.join(dir, "nope.png")),
    ).rejects.toThrow(/ENOENT/);
  });

  describe("removal", () => {
    it.each([
      [true, new Uint8Array([1]), true],
      [true, new Uint8Array(), false],
      [false, new Uint8Array([1]), false],
      [undefined, new Uint8Array([1]), false],
    ])(
      "when enabled=%s and the server returns %j then removal is %s",
      async (
        enabled: boolean | undefined,
        image: Uint8Array,
        expected: boolean,
      ) => {
        const { client }: ReturnType<typeof fakeServer> = fakeServer(image);
        expect(await calculateSplashscreenRemoval(client, enabled)).toBe(
          expected,
        );
      },
    );

    it("does not read the splashscreen while it is disabled", async () => {
      const getSplashscreen: ReturnType<typeof vi.fn> = vi.fn();
      const client: JellyfinClient = {
        getSplashscreen,
      } as unknown as JellyfinClient;
      await calculateSplashscreenRemoval(client, false);
      expect(getSplashscreen).not.toHaveBeenCalled();
    });

    it("deletes once, and the second run finds the 404 and does nothing", async () => {
      let stored: Uint8Array = new Uint8Array([1, 2]);
      const deleteSplashscreen: ReturnType<typeof vi.fn> = vi
        .fn()
        .mockImplementation((): Promise<void> => {
          stored = new Uint8Array();
          return Promise.resolve();
        });
      const client: JellyfinClient = {
        getSplashscreen: (): Promise<Uint8Array> => Promise.resolve(stored),
        deleteSplashscreen,
      } as unknown as JellyfinClient;

      await applySplashscreenRemoval(
        client,
        await calculateSplashscreenRemoval(client, true),
      );
      await applySplashscreenRemoval(
        client,
        await calculateSplashscreenRemoval(client, true),
      );

      expect(deleteSplashscreen).toHaveBeenCalledTimes(1);
    });
  });
});
