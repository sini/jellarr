import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import {
  calculateSplashscreenUpload,
  applySplashscreen,
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
});
