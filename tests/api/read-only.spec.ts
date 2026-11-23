import { describe, it, expect, vi } from "vitest";
import { guardReadOnly } from "../../src/api/read-only";
import type { JellyfinClient } from "../../src/api/jellyfin.types";

describe("guardReadOnly", () => {
  it("blocks deleteSplashscreen but lets getSplashscreen through", async () => {
    const deleteSplashscreen: ReturnType<typeof vi.fn> = vi.fn();
    const getSplashscreen: ReturnType<typeof vi.fn> = vi
      .fn()
      .mockResolvedValue(new Uint8Array([1]));
    const guarded: JellyfinClient = guardReadOnly({
      deleteSplashscreen,
      getSplashscreen,
    } as unknown as JellyfinClient);

    expect(() => guarded.deleteSplashscreen()).toThrow(/read-only/);
    expect(deleteSplashscreen).not.toHaveBeenCalled();
    await expect(guarded.getSplashscreen()).resolves.toHaveLength(1);
  });
});
